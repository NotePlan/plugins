// @flow

import bqpjs from 'bqpjs'
import { createPrettyOpenNoteLink } from '../../../helpers/general'
import { clo, log } from '../../../helpers/dev'
import type { DataQueryingConfig } from '../NPDataQuerying'
import pluginJson from '../../plugin.json'

export function queryToRPN(searchQuery: string): Array<string> {
  const result = bqpjs(searchQuery)
  if (result && result.rpn) {
    return result.rpn
  }
  return []
}

export function formatSearchOutput(results: Array<any>, searchQuery: string, config: DataQueryingConfig): string {
  let output = [`### Searching for: "${searchQuery}":\n---`]
  if (results.length === 0) {
    output.push('*No results found*')
  }
  const linksOnly = config.linksOnly || false
  // clo(results, 'formatSearchOutput::results')
  results.forEach((r) => {
    let segment = ''
    let content = ''
    const item = r.item
    const pl = createPrettyOpenNoteLink(item.title, item.filename, true)
    if (!linksOnly) {
      if (!item || !item.content) {
        content = item.title ? `File: "${item.title}"` : 'File Contents Unreadable' // an item like a PDF may have no content
      } else {
        r.matches &&
          r.matches?.forEach((m, x) => {
            const { key, value } = m
            const len = value.length - 1
            let lowestStart = len,
              highestEnd = 0
            m.indices?.forEach((index) => {
              const [startPos, endPos] = index
              if (startPos < lowestStart || lowestStart === len) {
                lowestStart = startPos
              }
              if (endPos > highestEnd || highestEnd === 0) {
                highestEnd = endPos
              }
            })
            content = getSurroundingChars(value, lowestStart, highestEnd, config)
            // if title is in the output but does not contain the search term, remove it from the output (the title link is already there)
            const findTitle = `# ${item.title}\\s*`
            const titleRE = new RegExp(findTitle, 'mg')
            content = content.replace(titleRE, '')
          })
      }
      output.push(`${pl}\n... ${content} ...\n---`)
    } else {
      // links only
      output.push(`${pl}\n`)
    }
  })
  return output.join(`\n`)
}

/**
 * Get a string of surrounding chars and highlight the match
 * @param {*} value - the text value found
 * @param {*} start - index of first char to include
 * @param {*} end - note that end is inclusive (conforms to Fuse results) slice is exclusive
 * @param {*} beforeAfter - how many chars before and after to include
 * @param {*} max - max length of the result
 * @returns
 */
export function getSurroundingChars(value: string, start: number, end: number, config: DataQueryingConfig): string {
  const max = Number(config.maxSearchResultLine ?? 200)
  const beforeAfter = Number(config.charsBeforeAndAfter ?? 100)
  const sampleSize = end - start + 1
  const fullPotentialLength = 4 + sampleSize + Number(beforeAfter) * 2
  let baft = Number(fullPotentialLength) > max ? Math.floor((max - sampleSize - 4) / 2) : beforeAfter
  if (baft < 0) baft = 0
  const foundString = value.slice(start, end + 1)
  const bs = start - baft < 0 ? 0 : start - baft
  const as = end + baft > value.length ? value.length : end + baft + 1
  let before = start - 1 > 0 ? value.slice(bs, start) : ''
  let after = end + 1 <= value.length ? value.slice(end + 1, as) : ''
  const maybeHighlight = foundString.length > 20 ? '' : '**' // make bold but only if string is short
  const output = `${before}${maybeHighlight}${foundString}${maybeHighlight}${after}`.slice(0, max)
  return config.ignoreNewLines ? output.replace(/\n/gm, ' ') : output
}

// export function getMatchText(indices, content) {}
