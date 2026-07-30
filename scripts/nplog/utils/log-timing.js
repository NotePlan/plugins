#!/usr/bin/env node
'use strict'

// Diagnostic: how stale is a NotePlan log file relative to the events it
// records, and -- when two files are given -- which one gets a given line
// first, and does either one ever lose a line the other has?
//
// Two modes:
//
//   1. Single file (--file only): tails one file and, for every COMPLETE
//      line (never a still-partial one), reports wall-clock-now minus the
//      line's own inner timestamp. Also tracks lines seen partial on one
//      poll and completed on a later one, and how long that took. This is
//      the original measure-flush-delay.js behavior.
//
//   2. Two files (--file + --compare-file): also races the two sources
//      against each other. The intended pairing is "Full-Log" -- the main
//      JSLog file nplog itself reads -- against "MCP-Log", a single
//      plugin's `_MCP-console.log` (what the NotePlan MCP's
//      `noteplan_plugins action:"log"` reads). Same content, but the
//      MCP-Log has the outer flush-timestamp and "JSLog:" marker already
//      stripped, and gets TRUNCATED on every plugin invocation rather than
//      appended to. Matching lines (by exact payload text, FIFO per
//      distinct payload so repeated identical lines don't get confused
//      with each other) are reported as MATCH with which side arrived
//      first and by how much. A line that shows up on one side and
//      doesn't show up on the other within --gap-timeout-ms is reported as
//      a GAP -- this is the completeness signal: it means whichever file
//      didn't get it either never will (Full-Log: filtered out somehow) or
//      already lost it (MCP-Log: truncated by a later invocation before we
//      polled). Full-Log flush lag has been observed well past a minute,
//      so the gap timeout defaults generously (see gapTimeoutMs below) --
//      too short and it mislabels merely-slow lines as missing.
//
// Interactive controls (needs a TTY): 'c' clears all accumulated stats and
// pending state -- run it right before firing the NotePlan action you want
// to isolate, so the numbers that follow are for that action alone. Ctrl-C
// (or 'q') prints a final summary and exits.
//
// Usage:
//   node log-timing.js [--file PATH] [--poll-ms N] [--report-every SECS]
//   node log-timing.js --file FULL_LOG --compare-file MCP_CONSOLE_LOG [--gap-timeout-ms N]
//
// --file defaults to the newest co.noteplan.NotePlan3*.log, same discovery
// nplog itself uses.

const fs = require('fs')
const os = require('os')
const path = require('path')

const LOG_DIR = process.env.NPLOG_DIR || path.join(os.homedir(), 'Library/Containers/co.noteplan.NotePlan3/Data/Library/Application Support/co.noteplan.NotePlan3/Logs')
const JSLOG_MARKER = 'JSLog:'
const LEADING_TS_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?[ \t]?/
const INNER_TS_RE = /^(?:\[[^\]]*\]\s*)?(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)/

function parseArgs(argv) {
  // Full-Log flush lag is not a fixed cost -- observed up to ~55s in practice, documented
  // historically up to two hours -- so a short timeout mislabels lines that are just slow, not
  // missing, as one-sided gaps. Defaulting to 2 minutes trades faster gap feedback for correctness;
  // raise it further with --gap-timeout-ms if the Full-Log is still catching up when this fires.
  const opts = { file: null, compareFile: null, pollMs: 100, reportEverySec: 15, gapTimeoutMs: 120000 }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file') opts.file = argv[++i]
    else if (argv[i] === '--compare-file') opts.compareFile = argv[++i]
    else if (argv[i] === '--poll-ms') opts.pollMs = Number(argv[++i])
    else if (argv[i] === '--report-every') opts.reportEverySec = Number(argv[++i])
    else if (argv[i] === '--gap-timeout-ms') opts.gapTimeoutMs = Number(argv[++i])
  }
  return opts
}

function findLatestLog() {
  const dirs = [LOG_DIR, path.join(LOG_DIR, 'Logs')]
  let best = null
  for (const dir of dirs) {
    let entries
    try {
      entries = fs.readdirSync(dir)
    } catch (err) {
      continue
    }
    for (const name of entries) {
      if (!name.startsWith('co.noteplan.NotePlan3') || !name.endsWith('.log')) continue
      const full = path.join(dir, name)
      let st
      try {
        st = fs.statSync(full)
      } catch (err) {
        continue
      }
      if (!best || st.mtimeMs > best.mtimeMs) best = { full, mtimeMs: st.mtimeMs }
    }
  }
  return best ? best.full : null
}

function extractInnerStampMs(payload) {
  const m = INNER_TS_RE.exec(payload)
  if (!m) return null
  const ms = Date.parse(m[1].replace(' ', 'T'))
  return Number.isFinite(ms) ? ms : null
}

function fmtMs(ms) {
  const sign = ms < 0 ? '-' : ''
  ms = Math.abs(ms)
  if (ms < 1000) return `${sign}${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${sign}${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  return `${sign}${m}m${Math.round(s - m * 60)}s`
}

function stats(arr) {
  if (!arr.length) return null
  const min = Math.min(...arr)
  const max = Math.max(...arr)
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length
  return { min, max, avg, n: arr.length }
}

// Plain monospace table -- right-pads every column to the widest cell (plus
// its header) in that column, so it lines up in any terminal without needing
// box-drawing characters.
function renderTable(headers, rows) {
  const widths = headers.map((h, i) => Math.max(String(h).length, ...rows.map((r) => String(r[i]).length)))
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ').trimEnd()
  return [line(headers), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)].join('\n')
}

// Repeated identical lines (noise messages especially) would otherwise bury
// genuinely distinct examples under dozens of copies of the same one. Group
// by exact payload, sort by frequency, and cap how many distinct examples
// print -- the count alongside each still shows how much it dominated.
function summarizeExamples(payloads, maxExamples) {
  const counts = new Map()
  for (const p of payloads) counts.set(p, (counts.get(p) || 0) + 1)
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const shown = sorted.slice(0, maxExamples)
  const omitted = sorted.length - shown.length
  const omittedOccurrences = omitted > 0 ? sorted.slice(maxExamples).reduce((n, [, c]) => n + c, 0) : 0
  return { shown, uniqueCount: sorted.length, omitted, omittedOccurrences }
}

// ---- tailing: one instance per file, independent position/carry state ----
// Truncation (size < position, e.g. _MCP-console.log rewritten on every
// plugin invocation) restarts from 0 rather than erroring. If we had unread
// bytes at truncation time, that content is gone -- counted as "lost to
// truncation" since we'll never see it.

class Tailer {
  constructor(filePath) {
    this.filePath = filePath
    // Doesn't exist yet is normal, not an error -- e.g. a plugin's
    // _MCP-console.log before that plugin has ever logged anything. Start
    // at 0 so whatever gets written first is picked up.
    try {
      this.position = fs.statSync(filePath).size
    } catch (err) {
      this.position = 0
    }
    this.carry = ''
    this.carryStartWall = null
    this.truncations = 0
    this.truncationsWithLoss = 0
  }

  // Returns [{ rawLine, wallMs }, ...] for lines completed this poll.
  // partialCb(durationMs) fires when a line seen partial on an earlier poll
  // completes on this one.
  poll(partialCb) {
    let st
    try {
      st = fs.statSync(this.filePath)
    } catch (err) {
      return []
    }
    if (st.size < this.position) {
      this.truncations++
      if (this.position > 0) this.truncationsWithLoss++
      this.position = 0
      this.carry = ''
      this.carryStartWall = null
    }
    if (st.size === this.position) return []

    const len = st.size - this.position
    const fd = fs.openSync(this.filePath, 'r')
    let text
    try {
      const buf = Buffer.allocUnsafe(len)
      const got = fs.readSync(fd, buf, 0, len, this.position)
      this.position += got
      text = buf.slice(0, got).toString('utf8')
    } finally {
      fs.closeSync(fd)
    }

    const now = Date.now()
    const oldCarryHadContent = this.carry.length > 0
    const combined = this.carry + text
    const parts = combined.split('\n')
    this.carry = parts.pop()

    if (oldCarryHadContent && parts.length > 0) {
      if (this.carryStartWall !== null && partialCb) partialCb(now - this.carryStartWall)
      this.carryStartWall = null
    }
    if (this.carry.length > 0 && this.carryStartWall === null) this.carryStartWall = now
    else if (this.carry.length === 0) this.carryStartWall = null

    return parts.filter(Boolean).map((rawLine) => ({ rawLine, wallMs: now }))
  }

  reset() {
    // does NOT move position -- "clear" resets stats/matching, not the tail
    this.truncations = 0
    this.truncationsWithLoss = 0
  }
}

// Main log: strip outer flush-timestamp + "JSLog:" marker to get the same
// payload form the console log already uses natively. Returns null for
// NotePlan's own native (non-plugin) log lines, which the console log never
// has anyway.
function normalizeMainLine(rawLine) {
  const body = rawLine.replace(LEADING_TS_RE, '')
  if (!body.startsWith(JSLOG_MARKER)) return null
  return body.slice(JSLOG_MARKER.length).replace(/^[ \t]/, '')
}

function normalizeConsoleLine(rawLine) {
  return rawLine
}

class Source {
  constructor(label, filePath, normalize) {
    this.label = label
    this.filePath = filePath
    this.tailer = new Tailer(filePath)
    this.normalize = normalize
    this.delays = []
    this.partials = []
    this.completedNoTimestamp = 0
    this.linesTotal = 0
  }

  poll() {
    const completed = this.tailer.poll((ms) => this.partials.push(ms))
    const out = []
    for (const { rawLine, wallMs } of completed) {
      this.linesTotal++
      const payload = this.normalize(rawLine)
      if (payload === null) continue
      const innerTs = extractInnerStampMs(payload)
      if (innerTs !== null) this.delays.push(wallMs - innerTs)
      else this.completedNoTimestamp++
      out.push({ payload, wallMs, innerTs })
    }
    return out
  }

  reset() {
    this.delays = []
    this.partials = []
    this.completedNoTimestamp = 0
    this.linesTotal = 0
    this.tailer.reset()
  }

  printReport() {
    const d = stats(this.delays)
    console.log(`[${this.label}] lines: ${this.linesTotal} (${this.delays.length} timestamped, ${this.completedNoTimestamp} not)`)
    if (d) console.log(`  own-timestamp delay (vs wall clock): min ${fmtMs(d.min)}  avg ${fmtMs(d.avg)}  max ${fmtMs(d.max)}`)
    const p = stats(this.partials)
    if (p) console.log(`  partial-line completion: n=${p.n}  min ${fmtMs(p.min)}  avg ${fmtMs(p.avg)}  max ${fmtMs(p.max)}`)
    if (this.tailer.truncations) {
      console.log(`  truncated ${this.tailer.truncations}x (${this.tailer.truncationsWithLoss}x with unread content lost)`)
    }
  }

  // One row for the cross-file summary table -- own-timestamp delay is
  // wall-clock-now minus each line's own embedded timestamp, computed
  // identically for both files (this is not Full-Log-specific).
  statsRow() {
    const d = stats(this.delays)
    const trunc = this.tailer.truncations ? `${this.tailer.truncations}x (${this.tailer.truncationsWithLoss} w/ loss)` : '-'
    return [
      this.label,
      this.linesTotal,
      this.delays.length,
      d ? fmtMs(d.min) : '-',
      d ? fmtMs(d.avg) : '-',
      d ? fmtMs(d.max) : '-',
      trunc,
    ]
  }
}

// ---- cross-file matching -----------------------------------------------
// FIFO per distinct payload string, so repeated identical lines (which do
// happen -- duplicate WebView log spam, repeated noise messages) match in
// arrival order rather than colliding.

class PendingQueue {
  constructor() {
    this.map = new Map()
  }
  push(payload, wallMs) {
    if (!this.map.has(payload)) this.map.set(payload, [])
    this.map.get(payload).push(wallMs)
  }
  popOldest(payload) {
    const arr = this.map.get(payload)
    if (!arr || !arr.length) return null
    const w = arr.shift()
    if (!arr.length) this.map.delete(payload)
    return w
  }
  // yields [payload, wallMs] for everything older than cutoff, removing them
  drainStale(cutoffWall) {
    const out = []
    for (const [payload, arr] of this.map) {
      while (arr.length && arr[0] <= cutoffWall) out.push([payload, arr.shift()])
      if (!arr.length) this.map.delete(payload)
    }
    return out
  }
  clear() {
    this.map.clear()
  }
}

function excerpt(text) {
  const oneLine = text.split('\n')[0]
  return oneLine.length > 100 ? `${oneLine.slice(0, 100)}…` : oneLine
}

function runCompare(opts) {
  const a = new Source('Full-Log', opts.file, normalizeMainLine)
  const b = new Source('MCP-Log', opts.compareFile, normalizeConsoleLine)
  const pendingFromA = new PendingQueue() // a saw it, waiting on b
  const pendingFromB = new PendingQueue() // b saw it, waiting on a

  let matches = []
  let gaps = [] // {label: a.label|b.label, payload}

  function clearAll() {
    a.reset()
    b.reset()
    pendingFromA.clear()
    pendingFromB.clear()
    matches = []
    gaps = []
    console.log(`\n=== cleared @ ${new Date().toLocaleTimeString()} -- go trigger the NotePlan action now ===\n`)
  }

  function handleSide(sideLabel, entries, ownPending, otherPending, otherLabel) {
    for (const { payload, wallMs } of entries) {
      const otherWall = otherPending.popOldest(payload)
      if (otherWall !== null) {
        const delta = wallMs - otherWall // >0 => this side was later
        const firstLabel = delta >= 0 ? otherLabel : sideLabel
        const deltaAbs = Math.abs(delta)
        matches.push({ deltaMs: deltaAbs, firstLabel })
        console.log(`MATCH  Δ${fmtMs(deltaAbs)}  ${firstLabel} first   ${excerpt(payload)}`)
      } else {
        ownPending.push(payload, wallMs)
      }
    }
  }

  function sweepGaps() {
    const cutoff = Date.now() - opts.gapTimeoutMs
    for (const [payload] of pendingFromA.drainStale(cutoff)) {
      gaps.push({ label: a.label, payload })
      console.log(`GAP    only in ${a.label} (never reached ${b.label} within ${fmtMs(opts.gapTimeoutMs)})   ${excerpt(payload)}`)
    }
    for (const [payload] of pendingFromB.drainStale(cutoff)) {
      gaps.push({ label: b.label, payload })
      console.log(`GAP    only in ${b.label} (never reached ${a.label} within ${fmtMs(opts.gapTimeoutMs)})   ${excerpt(payload)}`)
    }
  }

  const MAX_GAP_EXAMPLES = 8

  function printGapExamples(label, otherLabel) {
    const payloads = gaps.filter((g) => g.label === label).map((g) => g.payload)
    if (!payloads.length) return
    const { shown, uniqueCount, omitted, omittedOccurrences } = summarizeExamples(payloads, MAX_GAP_EXAMPLES)
    console.log(`\n${label} only (never reached ${otherLabel}): ${payloads.length} total, ${uniqueCount} unique`)
    for (const [payload, count] of shown) {
      console.log(`  x${count}  ${excerpt(payload)}`)
    }
    if (omitted > 0) console.log(`  ... +${omitted} more unique (${omittedOccurrences} more occurrences)`)
  }

  function printSummary(final) {
    console.log(final ? '\n=== Final summary ===\n' : `\n--- rolling report (${new Date().toLocaleTimeString()}) ---\n`)
    console.log('Own-timestamp delay vs wall clock, per file:')
    console.log(
      renderTable(['Source', 'Lines', 'Timestamped', 'Delay-min', 'Delay-avg', 'Delay-max', 'Truncations'], [a.statsRow(), b.statsRow()]),
    )

    const d = stats(matches.map((m) => m.deltaMs))
    console.log(`\nMatched lines (seen in both files): ${matches.length}`)
    if (d) {
      const aFirst = matches.filter((m) => m.firstLabel === a.label).length
      const bFirst = matches.filter((m) => m.firstLabel === b.label).length
      console.log(`  race delta: min ${fmtMs(d.min)}  avg ${fmtMs(d.avg)}  max ${fmtMs(d.max)}`)
      console.log(`  ${a.label} first: ${aFirst}   ${b.label} first: ${bFirst}`)
    }

    printGapExamples(a.label, b.label)
    printGapExamples(b.label, a.label)

    const stillPendingA = [...pendingFromA.map.values()].reduce((n, arr) => n + arr.length, 0)
    const stillPendingB = [...pendingFromB.map.values()].reduce((n, arr) => n + arr.length, 0)
    if (stillPendingA || stillPendingB) {
      console.log(`\nStill waiting to match: ${stillPendingA} from ${a.label}, ${stillPendingB} from ${b.label} (< ${fmtMs(opts.gapTimeoutMs)} old)`)
    }
  }

  console.log(`${a.label}: ${opts.file}`)
  console.log(`${b.label}:  ${opts.compareFile}`)
  console.log(`Polling every ${opts.pollMs}ms. Gap timeout ${fmtMs(opts.gapTimeoutMs)}. Press 'c' to clear and start a fresh window, 'q'/Ctrl-C for a final summary.\n`)

  const pollTimer = setInterval(() => {
    handleSide(a.label, a.poll(), pendingFromA, pendingFromB, b.label)
    handleSide(b.label, b.poll(), pendingFromB, pendingFromA, a.label)
    sweepGaps()
  }, opts.pollMs)
  const reportTimer = setInterval(() => printSummary(false), Math.max(1000, opts.reportEverySec * 1000))

  setupKeys(clearAll, () => {
    clearInterval(pollTimer)
    clearInterval(reportTimer)
    printSummary(true)
    process.exit(0)
  })
}

function runSingle(opts) {
  const src = new Source('LOG', opts.file, (rawLine) => normalizeMainLine(rawLine) ?? rawLine)
  console.log(`Tailing: ${opts.file}`)
  console.log(`Polling every ${opts.pollMs}ms, rolling report every ${opts.reportEverySec}s. Press 'c' to clear, 'q'/Ctrl-C for a final summary.\n`)

  const pollTimer = setInterval(() => src.poll(), opts.pollMs)
  const reportTimer = setInterval(() => {
    console.log(`\n--- rolling report (${new Date().toLocaleTimeString()}) ---`)
    src.printReport()
  }, Math.max(1000, opts.reportEverySec * 1000))

  setupKeys(
    () => {
      src.reset()
      console.log(`\n=== cleared @ ${new Date().toLocaleTimeString()} ===\n`)
    },
    () => {
      clearInterval(pollTimer)
      clearInterval(reportTimer)
      console.log('\n=== Final summary ===')
      src.printReport()
      process.exit(0)
    },
  )
}

// 'c' to clear, 'q' or Ctrl-C to quit. Falls back to Ctrl-C-only if stdin
// isn't a TTY (e.g. piped/backgrounded), same spirit as nplog's own raw-mode
// requirement.
function setupKeys(onClear, onQuit) {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      if (chunk === 'c' || chunk === 'C') return onClear()
      if (chunk === 'q' || chunk === 'Q' || chunk === '\x03') return onQuit()
    })
  }
  process.on('SIGINT', onQuit)
  process.on('SIGTERM', onQuit)
}

const opts = parseArgs(process.argv.slice(2))
opts.file = opts.file || findLatestLog()
if (!opts.file) {
  console.error('log-timing: no co.noteplan.NotePlan3*.log found; pass --file explicitly')
  process.exit(1)
}
if (opts.compareFile) runCompare(opts)
else runSingle(opts)
