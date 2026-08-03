#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * flow-emit-audit — prove that a change was type-only.
 *
 * Transforms every changed source file with Babel at a base revision and at the working tree,
 * then diffs the emitted JavaScript. Flow annotations and casts are erased by
 * @babel/preset-flow, so a type-only change must emit byte-identical output. Anything that
 * differs is a real code change and should be reviewed as one.
 *
 * Usage:
 *   node scripts/flow-emit-audit.js                 # compare working tree against `main`
 *   node scripts/flow-emit-audit.js --base <rev>    # compare against another revision
 *   node scripts/flow-emit-audit.js --show          # also print the emitted-JS diff for each
 *
 * NB: the file list comes from `git diff <base>` (no `..HEAD`), so it covers committed *and*
 * uncommitted changes. Using `<base>..HEAD` would silently skip anything not yet committed.
 */

'use strict'

const { execFileSync } = require('child_process')
const babel = require('@babel/core')
const fs = require('fs')

const BABEL_OPTS = {
  presets: [['@babel/preset-flow'], ['@babel/preset-react']],
  comments: false,
  compact: false,
  babelrc: false,
  configFile: false,
}

/**
 * Run a git command and return stdout, or null if it failed.
 * @param {Array<string>} args
 * @returns {string|null}
 */
function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch (error) {
    return null
  }
}

/**
 * Entry point.
 */
function main() {
  const argv = process.argv.slice(2)
  const base = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'main'
  const show = argv.includes('--show')

  const listed = git(['diff', base, '--name-only', '--', '*.js', '*.jsx'])
  if (listed === null) {
    console.error(`Could not diff against '${base}'.`)
    process.exit(2)
  }
  const files = listed.split('\n').filter(Boolean)

  const identical = []
  const differs = []
  const skipped = []

  for (const file of files) {
    const before = git(['show', `${base}:${file}`])
    if (before === null) {
      skipped.push(`${file}  (not in ${base} — new file)`)
      continue
    }
    if (!fs.existsSync(file)) {
      skipped.push(`${file}  (deleted)`)
      continue
    }
    const after = fs.readFileSync(file, 'utf8')
    let emittedBefore, emittedAfter
    try {
      emittedBefore = babel.transformSync(before, { ...BABEL_OPTS, filename: file }).code
      emittedAfter = babel.transformSync(after, { ...BABEL_OPTS, filename: file }).code
    } catch (error) {
      skipped.push(`${file}  (babel: ${error.message.split('\n')[0].slice(0, 70)})`)
      continue
    }
    if (emittedBefore === emittedAfter) identical.push(file)
    else differs.push({ file, emittedBefore, emittedAfter })
  }

  console.log(`\nbase: ${base}   files compared: ${files.length}`)
  console.log(`  emitted JS identical (type-only): ${identical.length}`)
  console.log(`  emitted JS CHANGED:               ${differs.length}`)
  console.log(`  skipped:                          ${skipped.length}`)
  if (skipped.length) console.log(skipped.map((s) => `    ${s}`).join('\n'))

  if (differs.length) {
    console.log(`\nFiles whose emitted JS changed — review each as a code change:`)
    for (const d of differs) console.log(`    ${d.file}`)
    if (show) {
      for (const d of differs) {
        console.log(`\n${'='.repeat(78)}\n${d.file}\n${'='.repeat(78)}`)
        const a = d.emittedBefore.split('\n')
        const b = d.emittedAfter.split('\n')
        const bSet = new Set(b)
        const aSet = new Set(a)
        for (const line of a) if (!bSet.has(line)) console.log(`  - ${line.trim()}`)
        for (const line of b) if (!aSet.has(line)) console.log(`  + ${line.trim()}`)
      }
    }
  }
  console.log('')
}

main()
