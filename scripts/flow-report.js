#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * flow-report — per-plugin Flow error accounting with a regression ratchet.
 *
 * `flow check` reports one error per (source-type x destination-slot) pair, so a single bad
 * annotation can produce thousands of lines. This script collapses that noise by deduplicating
 * to unique `file:line:error-code` sites, which is a far better proxy for "things to fix".
 *
 * Usage:
 *   node scripts/flow-report.js                    # print the per-plugin table vs the baseline
 *   node scripts/flow-report.js --check            # exit 1 if any plugin regressed vs a baseline
 *                                                  # NOTE: CI no longer uses this -- the repo is at zero
 *                                                  # errors and .github/workflows gates on `npx flow check`.
 *   node scripts/flow-report.js --update-baseline  # rewrite scripts/flow-baseline.json
 *   node scripts/flow-report.js --json-file <path> # reuse a saved `flow check --json` output
 *   node scripts/flow-report.js --plugin <name>    # list the individual sites for one plugin
 */

'use strict'

const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const PROJECT_ROOT = path.resolve(__dirname, '..')
const BASELINE_PATH = path.join(__dirname, 'flow-baseline.json')

/**
 * Parse argv into a simple options object.
 * @param {Array<string>} argv
 * @returns {{check: boolean, updateBaseline: boolean, jsonFile: string|null, plugin: string|null}}
 */
function parseArgs(argv) {
  const opts = { check: false, updateBaseline: false, jsonFile: null, plugin: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--check') opts.check = true
    else if (arg === '--update-baseline') opts.updateBaseline = true
    else if (arg === '--json-file') opts.jsonFile = argv[++i]
    else if (arg === '--plugin') opts.plugin = argv[++i]
    else if (arg === '--help' || arg === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('/**')[1])
      process.exit(0)
    }
  }
  return opts
}

/**
 * Run `flow check --show-all-errors --json` and return the parsed result.
 * Flow exits non-zero when errors exist, which is the normal case here, so we read stdout
 * regardless of exit status and only fail if the output is unparseable.
 * @returns {Object} the parsed Flow JSON report
 */
function runFlow() {
  let stdout = ''
  try {
    stdout = execFileSync('npx', ['flow', 'check', '--show-all-errors', '--json'], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      maxBuffer: 512 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch (error) {
    stdout = error.stdout || ''
  }
  if (!stdout.trim()) throw new Error('flow check produced no output — is flow-bin installed?')
  return JSON.parse(stdout)
}

/**
 * The file an error is anchored to: the first message that carries a source location.
 * @param {Object} error a single entry from the Flow report's `errors` array
 * @returns {string} absolute path, or '?' when Flow gave no location
 */
function primaryFile(error) {
  for (const message of error.message) {
    if (message.loc && message.loc.source) return message.loc.source
  }
  return '?'
}

/**
 * Path relative to the project root, with Flow's own lib files bucketed under `(flowlib)`.
 * @param {string} absolutePath
 * @returns {string}
 */
function relativePath(absolutePath) {
  if (absolutePath.startsWith(PROJECT_ROOT)) return path.relative(PROJECT_ROOT, absolutePath)
  return `(flowlib)/${path.basename(absolutePath)}`
}

/**
 * Collapse a Flow report into unique `file:line:code` sites grouped by plugin.
 * @param {Object} report the parsed Flow JSON report
 * @returns {{sites: Array<Object>, rawTotal: number, byPlugin: Object}}
 */
function collectSites(report) {
  const seen = new Map()
  const rawByPlugin = {}
  for (const error of report.errors) {
    const file = relativePath(primaryFile(error))
    const plugin = file.split(path.sep)[0]
    rawByPlugin[plugin] = (rawByPlugin[plugin] || 0) + 1
    const line = error.message[0] && error.message[0].loc ? error.message[0].loc.start.line : 0
    const code = (error.error_codes && error.error_codes[0]) || 'none'
    const key = `${file}:${line}:${code}`
    if (seen.has(key)) continue
    const descr = error.message.map((m) => m.descr).join(' ')
    seen.set(key, { key, file, plugin, line, code, descr })
  }
  const sites = [...seen.values()]
  const byPlugin = {}
  for (const site of sites) {
    const entry = byPlugin[site.plugin] || (byPlugin[site.plugin] = { sites: 0, raw: 0, test: 0, src: 0 })
    entry.sites++
    if (/__tests__|\.test\.|__mocks__|\.spec\./.test(site.file)) entry.test++
    else entry.src++
  }
  for (const plugin of Object.keys(byPlugin)) byPlugin[plugin].raw = rawByPlugin[plugin] || 0
  return { sites, rawTotal: report.errors.length, byPlugin }
}

/**
 * Read the committed baseline, or an empty one if it doesn't exist yet.
 * @returns {{generated: string, rawTotal: number, byPlugin: Object}|null}
 */
function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
}

/**
 * Print the per-plugin table, marking regressions and improvements against the baseline.
 * @param {Object} byPlugin current counts
 * @param {Object|null} baseline
 * @returns {Array<string>} plugin names that regressed
 */
function printTable(byPlugin, baseline) {
  const baselineByPlugin = (baseline && baseline.byPlugin) || {}
  const names = [...new Set([...Object.keys(byPlugin), ...Object.keys(baselineByPlugin)])]
  names.sort((a, b) => (byPlugin[b] ? byPlugin[b].sites : 0) - (byPlugin[a] ? byPlugin[a].sites : 0) || a.localeCompare(b))

  const regressed = []
  console.log('')
  console.log(`${'plugin'.padEnd(38)}${'sites'.padStart(7)}${'src'.padStart(7)}${'test'.padStart(7)}${'raw'.padStart(8)}${'  vs baseline'}`)
  console.log('-'.repeat(80))
  for (const name of names) {
    const now = byPlugin[name] || { sites: 0, src: 0, test: 0, raw: 0 }
    const was = baselineByPlugin[name]
    let delta = ''
    if (was) {
      const diff = now.sites - was.sites
      if (diff > 0) {
        delta = `  +${diff} REGRESSED`
        regressed.push(name)
      } else if (diff < 0) {
        delta = `  ${diff}`
      } else {
        delta = '  ='
      }
    } else {
      delta = '  (new)'
    }
    if (now.sites === 0 && !was) continue
    console.log(
      `${name.padEnd(38)}${String(now.sites).padStart(7)}${String(now.src).padStart(7)}${String(now.test).padStart(7)}${String(now.raw).padStart(8)}${delta}`,
    )
  }
  return regressed
}

/**
 * Entry point.
 */
function main() {
  const opts = parseArgs(process.argv.slice(2))
  const report = opts.jsonFile ? JSON.parse(fs.readFileSync(opts.jsonFile, 'utf8')) : runFlow()
  const { sites, rawTotal, byPlugin } = collectSites(report)

  if (opts.plugin) {
    const matching = sites.filter((s) => s.plugin === opts.plugin).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
    console.log(`\n${opts.plugin}: ${matching.length} unique sites\n`)
    for (const site of matching) console.log(`${site.file}:${site.line}  [${site.code}] ${site.descr.slice(0, 150)}`)
    return
  }

  const baseline = readBaseline()
  const regressed = printTable(byPlugin, baseline)
  console.log('-'.repeat(80))
  const baselineTotal = baseline ? Object.values(baseline.byPlugin).reduce((sum, p) => sum + p.sites, 0) : null
  console.log(`TOTAL: ${sites.length} unique sites (${rawTotal} raw errors)${baselineTotal !== null ? ` — baseline was ${baselineTotal}` : ''}`)

  if (opts.updateBaseline) {
    const payload = { generated: new Date().toISOString(), rawTotal, byPlugin }
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`)
    console.log(`\nBaseline written to ${path.relative(PROJECT_ROOT, BASELINE_PATH)}`)
    return
  }

  if (opts.check) {
    if (regressed.length > 0) {
      console.error(`\nFlow regression in: ${regressed.join(', ')}`)
      console.error(`Run \`node scripts/flow-report.js --plugin <name>\` to see the sites, or fix them.`)
      process.exit(1)
    }
    console.log('\nNo Flow regressions.')
  }
}

main()
