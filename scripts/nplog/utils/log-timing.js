#!/usr/bin/env node
'use strict'

// Diagnostic: how stale is a NotePlan log file relative to the events it
// records, and -- when two files are given -- does either one ever lose a
// line the other has?
//
// Three modes:
//
//   1. Single file (--file only): tails one file and, for every COMPLETE
//      line (never a still-partial one), reports wall-clock-now minus the
//      line's own inner timestamp. Also tracks lines seen partial on one
//      poll and completed on a later one, and how long that took. This is
//      the original measure-flush-delay.js behavior.
//
//   2. Two files, live (--file + --compare-file): checks the two sources for
//      completeness against each other. The intended pairing is "Full-Log"
//      -- the main JSLog file nplog itself reads -- against "MCP-Log", a
//      single plugin's `_MCP-console.log` (what the NotePlan MCP's
//      `noteplan_plugins action:"log"` reads). Same content, but the
//      MCP-Log has the outer flush-timestamp and "JSLog:" marker already
//      stripped, and gets TRUNCATED on every plugin invocation rather than
//      appended to.
//
//      Known-noisy lines (see ../noise-exclusions.js, the same list nplog's
//      live viewer uses) are dropped before they're even counted -- they
//      dominated early gap reports and are structural, not a completeness
//      signal.
//
//      Lines are matched by their first PREFIX_LEN (100) characters, FIFO
//      per distinct prefix -- not the full text. Two lines that share a
//      100-char prefix are almost always "the same line" (timestamp +
//      level + function name + the start of the message already
//      disambiguates unrelated lines), so treating them as a hard GAP just
//      because a trailing detail differs was misleading. When the prefix
//      matches but the full text doesn't, it's reported separately as a
//      "near match" with both full tails shown -- that's the interesting
//      part worth reading, not classifying as missing. Caveat: two
//      genuinely different lines that happen to share the same 100-char
//      prefix (e.g. two near-identical reminder log lines) would
//      incorrectly pair up; this is a heuristic tradeoff, not exact.
//
//      A line that shows up on one side and doesn't show up on the other
//      (exactly or via near-match) within --gap-timeout-ms is reported as a
//      GAP -- the actual completeness signal: whichever file didn't get it
//      either never will (Full-Log: filtered out somehow) or already lost
//      it (MCP-Log: truncated by a later invocation before we polled).
//      Full-Log flush lag has been observed well past a minute, so the gap
//      timeout defaults generously (see gapTimeoutMs below) -- too short
//      and it mislabels merely-slow lines as missing. On quit ('q'/Ctrl-C),
//      everything still pending is immediately reported as a gap
//      regardless of --gap-timeout-ms -- there's no more time left for it
//      to match, so a session shorter than the timeout still gets a real
//      answer instead of an empty gap report.
//
//   3. Replay (--replay FILE, no live files needed): re-runs the exact same
//      matching/exclusion/reporting logic against a file recorded earlier
//      with --record, instead of live-tailing and waiting on NotePlan. Use
//      this to iterate on the matching logic itself -- tweak PREFIX_LEN or
//      the noise-exclusions list and re-run instantly against a fixed
//      dataset, rather than re-triggering a Dashboard refresh every time.
//
// --record FILE (live modes only): appends every processed (non-excluded)
// line from both sides to FILE as NDJSON ({side, wallMs, payload}), so a
// live session can be replayed later.
//
// Interactive controls (live modes, needs a TTY): 'c' clears all
// accumulated stats and pending state -- run it right before firing the
// NotePlan action you want to isolate, so the numbers that follow are for
// that action alone. Ctrl-C (or 'q') prints a final summary and exits.
//
// Usage:
//   node log-timing.js [--file PATH] [--poll-ms N] [--report-every SECS]
//   node log-timing.js --file FULL_LOG --compare-file MCP_CONSOLE_LOG [--gap-timeout-ms N] [--record FILE]
//   node log-timing.js --replay FILE [--gap-timeout-ms N]
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

// How many leading characters make two lines "the same line" for matching
// purposes -- see the file header for the reasoning and the tradeoff.
const PREFIX_LEN = 100

function parseArgs(argv) {
  // Full-Log flush lag is not a fixed cost -- observed up to ~55s in practice, documented
  // historically up to two hours -- so a short timeout mislabels lines that are just slow, not
  // missing, as one-sided gaps. Defaulting to 2 minutes trades faster gap feedback for correctness;
  // raise it further with --gap-timeout-ms if the Full-Log is still catching up when this fires.
  const opts = { file: null, compareFile: null, pollMs: 100, reportEverySec: 15, gapTimeoutMs: 120000, record: null, replay: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file') opts.file = argv[++i]
    else if (argv[i] === '--compare-file') opts.compareFile = argv[++i]
    else if (argv[i] === '--poll-ms') opts.pollMs = Number(argv[++i])
    else if (argv[i] === '--report-every') opts.reportEverySec = Number(argv[++i])
    else if (argv[i] === '--gap-timeout-ms') opts.gapTimeoutMs = Number(argv[++i])
    else if (argv[i] === '--record') opts.record = argv[++i]
    else if (argv[i] === '--replay') opts.replay = argv[++i]
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

// Same exclusion list nplog's live viewer uses, so "known noise" means the
// same thing in both tools. Missing/unreadable file just means no exclusions.
function loadExclusions() {
  try {
    const list = require('../noise-exclusions.js')
    return Array.isArray(list) ? list : []
  } catch (err) {
    return []
  }
}
const EXCLUSIONS = loadExclusions()
function isExcluded(text) {
  for (let i = 0; i < EXCLUSIONS.length; i++) {
    if (EXCLUSIONS[i].test(text)) return true
  }
  return false
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

// Group by exact payload and split on frequency rather than just capping by
// rank. A high repeat count is a good proxy for "structural noise" (a
// render-loop or a plugin-list scan hitting the same line every pass); a
// one-off or rarely-seen line is much more likely to be something actually
// worth a human's attention. So: summarize the frequent bucket (a handful of
// samples is enough to identify it), but never cap the rare bucket -- that's
// the one the question "is this meaningful or noise" is actually about.
function splitByFrequency(payloads, freqThreshold) {
  const counts = new Map()
  for (const p of payloads) counts.set(p, (counts.get(p) || 0) + 1)
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const frequent = entries.filter(([, c]) => c > freqThreshold)
  const rare = entries.filter(([, c]) => c <= freqThreshold)
  return { frequent, rare, uniqueCount: entries.length }
}

function excerpt(text, maxLen = PREFIX_LEN) {
  const oneLine = text.split('\n')[0]
  return oneLine.length > maxLen ? `${oneLine.slice(0, maxLen)}…` : oneLine
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
  // onEntry(payload, wallMs), if given, fires for every line that makes it
  // past exclusion filtering -- used to persist a live session with --record.
  constructor(label, filePath, normalize, onEntry) {
    this.label = label
    this.filePath = filePath
    this.tailer = filePath ? new Tailer(filePath) : null
    this.normalize = normalize
    this.onEntry = onEntry || null
    this.delays = []
    this.partials = []
    this.completedNoTimestamp = 0
    this.linesTotal = 0
    this.excludedCount = 0
  }

  // Shared stats/exclusion pipeline for one already-normalized, non-null
  // payload. Returns {payload, wallMs} if it counts, null if excluded.
  _ingest(payload, wallMs) {
    if (isExcluded(payload)) {
      this.excludedCount++
      return null
    }
    const innerTs = extractInnerStampMs(payload)
    if (innerTs !== null) this.delays.push(wallMs - innerTs)
    else this.completedNoTimestamp++
    return { payload, wallMs }
  }

  poll() {
    if (!this.tailer) return [] // replay-only instance; use recordEntry() instead
    const completed = this.tailer.poll((ms) => this.partials.push(ms))
    const out = []
    for (const { rawLine, wallMs } of completed) {
      this.linesTotal++
      const payload = this.normalize(rawLine)
      if (payload === null) continue
      const entry = this._ingest(payload, wallMs)
      if (entry) {
        if (this.onEntry) this.onEntry(payload, wallMs)
        out.push(entry)
      }
    }
    return out
  }

  // Offline equivalent of poll() for replaying a previously recorded,
  // already-normalized line. Returns the same shape poll() does (or null).
  recordEntry(payload, wallMs) {
    this.linesTotal++
    return this._ingest(payload, wallMs)
  }

  reset() {
    this.delays = []
    this.partials = []
    this.completedNoTimestamp = 0
    this.linesTotal = 0
    this.excludedCount = 0
    if (this.tailer) this.tailer.reset()
  }

  printReport() {
    const d = stats(this.delays)
    console.log(`[${this.label}] lines: ${this.linesTotal} (${this.delays.length} timestamped, ${this.completedNoTimestamp} not, ${this.excludedCount} excluded)`)
    if (d) console.log(`  own-timestamp delay (vs wall clock): min ${fmtMs(d.min)}  avg ${fmtMs(d.avg)}  max ${fmtMs(d.max)}`)
    const p = stats(this.partials)
    if (p) console.log(`  partial-line completion: n=${p.n}  min ${fmtMs(p.min)}  avg ${fmtMs(p.avg)}  max ${fmtMs(p.max)}`)
    if (this.tailer && this.tailer.truncations) {
      console.log(`  truncated ${this.tailer.truncations}x (${this.tailer.truncationsWithLoss}x with unread content lost)`)
    }
  }

  // One row for the cross-file summary table -- own-timestamp delay is
  // wall-clock-now minus each line's own embedded timestamp, computed
  // identically for both files (this is not Full-Log-specific).
  statsRow() {
    const d = stats(this.delays)
    const trunc = this.tailer && this.tailer.truncations ? `${this.tailer.truncations}x (${this.tailer.truncationsWithLoss} w/ loss)` : '-'
    return [
      this.label,
      this.linesTotal,
      this.delays.length,
      d ? fmtMs(d.min) : '-',
      d ? fmtMs(d.avg) : '-',
      d ? fmtMs(d.max) : '-',
      this.excludedCount || '-',
      trunc,
    ]
  }
}

// ---- cross-file matching -----------------------------------------------
// FIFO per PREFIX_LEN-char key, so repeated identical (or near-identical)
// lines match in arrival order rather than colliding. Values carry the full
// payload (not just wallMs) so a prefix match can be checked for an exact
// tail and, if it differs, reported as a near-match rather than a hard gap.

class PendingQueue {
  constructor() {
    this.map = new Map()
  }
  push(key, entry) {
    if (!this.map.has(key)) this.map.set(key, [])
    this.map.get(key).push(entry)
  }
  popOldest(key) {
    const arr = this.map.get(key)
    if (!arr || !arr.length) return null
    const e = arr.shift()
    if (!arr.length) this.map.delete(key)
    return e
  }
  // yields [key, entry] for everything older than cutoff, removing them
  drainStale(cutoffWall) {
    const out = []
    for (const [key, arr] of this.map) {
      while (arr.length && arr[0].wallMs <= cutoffWall) out.push([key, arr.shift()])
      if (!arr.length) this.map.delete(key)
    }
    return out
  }
  clear() {
    this.map.clear()
  }
  // Oldest entry across every key -- each per-key array is already FIFO
  // (pushed in arrival order), so only its head can be the oldest.
  oldestWall() {
    let oldest = null
    for (const arr of this.map.values()) {
      if (arr.length && (oldest === null || arr[0].wallMs < oldest)) oldest = arr[0].wallMs
    }
    return oldest
  }
  size() {
    let n = 0
    for (const arr of this.map.values()) n += arr.length
    return n
  }
}

// Bundles the matching/reporting state and closures shared between the live
// comparator and the offline replay path, so neither has to duplicate the
// other's logic. logLine is injected because only the live path needs it to
// clear the in-place countdown first; replay just wants plain console.log.
function makeComparator(a, b, opts, logLine) {
  const pendingFromA = new PendingQueue() // a saw it, waiting on b
  const pendingFromB = new PendingQueue() // b saw it, waiting on a
  let matchCount = 0
  let gaps = [] // {label: a.label|b.label, payload}
  let nearMatches = [] // {fullLog, mcp} -- same PREFIX_LEN prefix, different full text

  function handleSide(entries, ownPending, otherPending, mySideLabel) {
    for (const { payload, wallMs } of entries) {
      const key = payload.slice(0, PREFIX_LEN)
      const found = otherPending.popOldest(key)
      if (found === null) {
        ownPending.push(key, { payload, wallMs })
        continue
      }
      if (found.payload === payload) {
        matchCount++
        continue
      }
      const fullLogText = mySideLabel === a.label ? payload : found.payload
      const mcpLogText = mySideLabel === a.label ? found.payload : payload
      nearMatches.push({ fullLog: fullLogText, mcp: mcpLogText })
    }
  }

  // force=true (used right before the final summary, live or replay) drains
  // everything still pending regardless of age -- there's no more time left
  // for it to match, so the final report should account for it rather than
  // silently omitting anything that hadn't yet crossed --gap-timeout-ms.
  function sweepGaps(force) {
    const cutoff = force ? Infinity : Date.now() - opts.gapTimeoutMs
    const tagFor = (otherLabel) => (force ? '(still pending at exit)' : `(never reached ${otherLabel} within ${fmtMs(opts.gapTimeoutMs)})`)
    for (const [, entry] of pendingFromA.drainStale(cutoff)) {
      gaps.push({ label: a.label, payload: entry.payload })
      logLine(`GAP    only in ${a.label} ${tagFor(b.label)}   ${excerpt(entry.payload)}`)
    }
    for (const [, entry] of pendingFromB.drainStale(cutoff)) {
      gaps.push({ label: b.label, payload: entry.payload })
      logLine(`GAP    only in ${b.label} ${tagFor(a.label)}   ${excerpt(entry.payload)}`)
    }
  }

  // A line repeated more than this many times within one gap side is treated
  // as structural noise (a render loop, a plugin-list scan) and only
  // summarized; anything at or below it is shown in full, uncapped -- that's
  // the bucket worth actually reading.
  const NOISE_FREQ_THRESHOLD = 3
  const MAX_NOISE_SAMPLES = 5

  function printGapExamples(label, otherLabel) {
    const payloads = gaps.filter((g) => g.label === label).map((g) => g.payload)
    if (!payloads.length) return
    const { frequent, rare, uniqueCount } = splitByFrequency(payloads, NOISE_FREQ_THRESHOLD)
    console.log(`\n${label} only (never reached ${otherLabel}): ${payloads.length} total, ${uniqueCount} unique`)

    if (frequent.length) {
      const shown = frequent.slice(0, MAX_NOISE_SAMPLES)
      const omittedOccurrences = frequent.slice(MAX_NOISE_SAMPLES).reduce((n, [, c]) => n + c, 0)
      console.log(`  Repeated >${NOISE_FREQ_THRESHOLD}x (likely structural noise, not a completeness gap):`)
      for (const [payload, count] of shown) console.log(`    x${count}  ${excerpt(payload)}`)
      if (frequent.length > MAX_NOISE_SAMPLES) {
        console.log(`    ... +${frequent.length - MAX_NOISE_SAMPLES} more frequent unique lines (${omittedOccurrences} more occurrences)`)
      }
    }
    if (rare.length) {
      console.log(`  Seen ≤${NOISE_FREQ_THRESHOLD}x each -- worth a look, shown in full (${rare.length}):`)
      for (const [payload, count] of rare) console.log(`    x${count}  ${excerpt(payload, 220)}`)
    }
  }

  const MAX_NEAR_MATCH_EXAMPLES = 10

  function printNearMatches() {
    if (!nearMatches.length) return
    console.log(`\nNear matches (same first ${PREFIX_LEN} chars, different tail): ${nearMatches.length}`)
    const shown = nearMatches.slice(0, MAX_NEAR_MATCH_EXAMPLES)
    for (const { fullLog, mcp } of shown) {
      console.log(`  prefix: ${excerpt(fullLog, PREFIX_LEN)}`)
      console.log(`    ${a.label} tail: ${JSON.stringify(fullLog.slice(PREFIX_LEN, PREFIX_LEN + 150))}`)
      console.log(`    ${b.label} tail:  ${JSON.stringify(mcp.slice(PREFIX_LEN, PREFIX_LEN + 150))}`)
    }
    if (nearMatches.length > shown.length) console.log(`  ... +${nearMatches.length - shown.length} more`)
  }

  function printSummary(final) {
    logLine(final ? '\n=== Final summary ===\n' : `\n--- rolling report (${new Date().toLocaleTimeString()}) ---\n`)
    console.log('Own-timestamp delay vs wall clock, per file:')
    console.log(
      renderTable(
        ['Source', 'Lines', 'Timestamped', 'Delay-min', 'Delay-avg', 'Delay-max', 'Excluded', 'Truncations'],
        [a.statsRow(), b.statsRow()],
      ),
    )

    console.log(`\nMatched lines (seen in both files): ${matchCount}`)

    printNearMatches()
    printGapExamples(a.label, b.label)
    printGapExamples(b.label, a.label)

    const stillPendingA = pendingFromA.size()
    const stillPendingB = pendingFromB.size()
    if (stillPendingA || stillPendingB) {
      console.log(`\nStill waiting to match: ${stillPendingA} from ${a.label}, ${stillPendingB} from ${b.label} (< ${fmtMs(opts.gapTimeoutMs)} old)`)
    }
  }

  function clearAll() {
    a.reset()
    b.reset()
    pendingFromA.clear()
    pendingFromB.clear()
    matchCount = 0
    gaps = []
    nearMatches = []
  }

  function oldestPendingWall() {
    const oa = pendingFromA.oldestWall()
    const ob = pendingFromB.oldestWall()
    return oa === null ? ob : ob === null ? oa : Math.min(oa, ob)
  }

  function totalPending() {
    return pendingFromA.size() + pendingFromB.size()
  }

  return { pendingFromA, pendingFromB, handleSide, sweepGaps, printSummary, clearAll, oldestPendingWall, totalPending }
}

function makeRecorder(filePath, sideLabel) {
  if (!filePath) return null
  const stream = fs.createWriteStream(filePath, { flags: 'a' })
  return {
    write(payload, wallMs) {
      stream.write(`${JSON.stringify({ side: sideLabel, wallMs, payload })}\n`)
    },
    close() {
      stream.end()
    },
  }
}

function runCompare(opts) {
  const recorderA = makeRecorder(opts.record, 'Full-Log')
  const recorderB = makeRecorder(opts.record, 'MCP-Log')
  const a = new Source('Full-Log', opts.file, normalizeMainLine, recorderA && recorderA.write)
  const b = new Source('MCP-Log', opts.compareFile, normalizeConsoleLine, recorderB && recorderB.write)

  // Live "keep waiting" countdown, written with \r so it updates in place
  // rather than spamming the scrollback -- only when stdout is a real TTY,
  // since a piped/redirected output would otherwise get raw \r bytes mixed
  // into it. countdownLine holds the currently-displayed text (or '' if
  // nothing's shown) so clearCountdown() knows how many columns to blank.
  let countdownLine = ''
  function clearCountdown() {
    if (countdownLine) {
      process.stdout.write(`\r${' '.repeat(countdownLine.length)}\r`)
      countdownLine = ''
    }
  }
  // Anything that prints a real line of output must go through this first,
  // so it doesn't get smashed onto the end of the in-place countdown.
  function logLine(text) {
    clearCountdown()
    console.log(text)
  }

  const cmp = makeComparator(a, b, opts, logLine)

  function clearAllWithBanner() {
    cmp.clearAll()
    logLine(`\n=== cleared @ ${new Date().toLocaleTimeString()} -- go trigger the NotePlan action now ===\n`)
  }

  console.log(`Full-Log: ${opts.file}`)
  console.log(`MCP-Log:  ${opts.compareFile}`)
  if (opts.record) console.log(`Recording to: ${opts.record}`)
  console.log(`Polling every ${opts.pollMs}ms. Gap timeout ${fmtMs(opts.gapTimeoutMs)}. Press 'c' to clear and start a fresh window, 'q'/Ctrl-C for a final summary.\n`)

  const pollTimer = setInterval(() => {
    cmp.handleSide(a.poll(), cmp.pendingFromA, cmp.pendingFromB, a.label)
    cmp.handleSide(b.poll(), cmp.pendingFromB, cmp.pendingFromA, b.label)
    cmp.sweepGaps()
  }, opts.pollMs)
  const reportTimer = setInterval(() => cmp.printSummary(false), Math.max(1000, opts.reportEverySec * 1000))

  // Ticks the in-place "keep waiting" line so it's obvious whether it's
  // still worth leaving the process running -- shows the oldest pending
  // line's remaining time until it either matches or becomes a reported gap.
  function tickCountdown() {
    const oldest = cmp.oldestPendingWall()
    if (oldest === null) return clearCountdown()
    const remaining = Math.max(0, opts.gapTimeoutMs - (Date.now() - oldest))
    const text = `⏳ ${fmtMs(remaining)} until oldest pending line resolves (${cmp.totalPending()} pending) -- 'q' for a report now`
    process.stdout.write(`\r${text.padEnd(countdownLine.length)}`)
    countdownLine = text
  }
  const countdownTimer = process.stdout.isTTY ? setInterval(tickCountdown, 1000) : null

  setupKeys(clearAllWithBanner, () => {
    clearInterval(pollTimer)
    clearInterval(reportTimer)
    if (countdownTimer) clearInterval(countdownTimer)
    clearCountdown()
    cmp.sweepGaps(true) // force -- flush everything still pending as a gap, not just what's timed out
    cmp.printSummary(true)
    if (recorderA) recorderA.close()
    if (recorderB) recorderB.close()
    process.exit(0)
  })
}

// One-shot: re-run the same matching/exclusion/reporting logic against a
// file recorded earlier with --record, instead of live-tailing. Entries are
// replayed in original wall-clock order so FIFO matching behaves exactly as
// it would have live, then everything left unmatched is immediately swept
// as a gap (there's no more data coming) and a single summary is printed.
function runReplay(opts) {
  const a = new Source('Full-Log', null, normalizeMainLine, null)
  const b = new Source('MCP-Log', null, normalizeConsoleLine, null)
  const cmp = makeComparator(a, b, opts, (text) => console.log(text))

  let raw
  try {
    raw = fs.readFileSync(opts.replay, 'utf8')
  } catch (err) {
    console.error(`log-timing --replay: can't read ${opts.replay}: ${err.message}`)
    process.exit(1)
  }

  const entries = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      const rec = JSON.parse(line)
      if (rec && typeof rec.payload === 'string' && Number.isFinite(rec.wallMs)) entries.push(rec)
    } catch (err) {
      // skip a malformed line rather than aborting the whole replay
    }
  }
  entries.sort((x, y) => x.wallMs - y.wallMs)

  const countA = entries.filter((e) => e.side === a.label).length
  const countB = entries.filter((e) => e.side === b.label).length
  console.log(`Replaying ${entries.length} recorded lines from ${opts.replay} (${countA} ${a.label}, ${countB} ${b.label})\n`)

  for (const rec of entries) {
    const src = rec.side === a.label ? a : rec.side === b.label ? b : null
    if (!src) continue
    const entry = src.recordEntry(rec.payload, rec.wallMs)
    if (!entry) continue // excluded
    if (rec.side === a.label) cmp.handleSide([entry], cmp.pendingFromA, cmp.pendingFromB, a.label)
    else cmp.handleSide([entry], cmp.pendingFromB, cmp.pendingFromA, b.label)
  }

  cmp.sweepGaps(true) // no more data coming -- everything unmatched is final
  cmp.printSummary(true)
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
if (opts.replay) {
  runReplay(opts)
} else {
  opts.file = opts.file || findLatestLog()
  if (!opts.file) {
    console.error('log-timing: no co.noteplan.NotePlan3*.log found; pass --file explicitly')
    process.exit(1)
  }
  if (opts.compareFile) runCompare(opts)
  else runSingle(opts)
}
