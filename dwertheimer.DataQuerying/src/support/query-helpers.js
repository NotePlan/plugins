// import { createBabelOutputPluginFac÷tory } from '@rollup/plugin-babel'
import bqpjs from 'bqpjs'
import { createCallbackUrl, createPrettyLink } from '../../../helpers/general'
import { clo } from '../../../helpers/dev'

export function queryToRPN(searchQuery: string): Array<string> {
  const result = bqpjs(searchQuery)
  if (result && result.rpn) {
    return result.rpn
  }
  return []
}

export function formatSearchOutput(results: Array<any>, searchQuery: string, config: { [string]: mixed }): Array<any> {
  let output = [`### Searching for: "${searchQuery}":\n`]
  const linksOnly = config.linksOnly || false
  clo(results, 'formatSearchOutput::results')
  results.forEach((r) => {
    let segment = ''
    let content = ''
    const item = r.item
    const pl = createPrettyLink(item.title, item.filename, true)
    if (!linksOnly) {
      if (!item || !item.content) {
        content = item.title || '' // an item like a PDF may have no content
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
            content = getSurroundingChars(value, lowestStart, highestEnd, 30, 30, config.maxSearchResultLine ?? 100)
          })
      }
      output.push(`${pl}\n... ${content} ...\n---`)
    } else {
      // links only
    }
    output.push(`${pl}\n`)
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
export function getSurroundingChars(value: string, start: number, end: number, beforeAfter: number, max: number): string {
  const sampleSize = end - start + 1
  const fullPotentialLength = 4 + sampleSize + beforeAfter * 2
  const baft = fullPotentialLength > max ? Math.floor((max - sampleSize - 4) / 2) : beforeAfter
  const foundString = value.slice(start, end + 1)
  const bs = start - baft < 0 ? 0 : start - baft
  const as = end + baft > value.length ? value.length : end + baft + 1
  const before = start - 1 > 0 ? value.slice(bs, start) : ''
  const after = end + 1 <= value.length ? value.slice(end + 1, as) : ''
  return `${before} **${foundString}** ${after}`
}

export function getMatchText(indices, content) {}
