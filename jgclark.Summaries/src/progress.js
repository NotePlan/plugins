// @flow
//-----------------------------------------------------------------------------
// Progress update on some key goals to include in notes
// Jonathan Clark, @jgclark
// Last updated 21.6.2022 for v0.9.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  calcHashtagStatsPeriod,
  calcMentionStatsPeriod,
  getPeriodStartEndDates,
  getSummariesSettings,
} from './summaryHelpers'
import { unhyphenatedDate } from '@helpers/dateTime'
import { log, logError } from '@helpers/dev'
import {
  CaseInsensitiveMap,
  getTagParamsFromString
} from '@helpers/general'
import { getSelectedParaIndex } from '@helpers/NPParagraph'
import { caseInsensitiveCompare } from '@helpers/sorting'

//-------------------------------------------------------------------------------

/**
 * Work out the @mention stats of interest so far this week/month, and write out to current note.
 * Default to looking at week to date ("wtd") but allow month to date ("mtd") as well.
 * If it's week to date, then use the user's first day of week
 * @author @jgclark
 *
 * @param {string?} params - can pass parameter string e.g. "{interval: 'mtd', heading: 'Progress'}"
 * @return {string?} - either return string to Template, or void to plugin
 */
export async function insertProgressUpdate(params?: string): Promise<string | void > {
  // Get config setting
  const config = await getSummariesSettings()
  // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
  // If there are params passed, then we've been called by a template command (and so use those).
  const interval = await getTagParamsFromString(params ?? '', 'interval', 'userwtd')
  const heading = await getTagParamsFromString(params ?? '', 'heading', config.progressHeading)

  // Get time period
  const [fromDate, toDate, periodString, periodPartStr] = await getPeriodStartEndDates('', interval)
  if (fromDate == null || toDate == null) {
    log(pluginJson, `insertProgressUpdate: Error calculating dates`)
    return `Error calculating dates`
  }
  const fromDateStr = unhyphenatedDate(fromDate)
  const toDateStr = unhyphenatedDate(toDate)
  log(pluginJson, `  calculating ${interval} for ${periodString} ${interval} (= ${fromDateStr} - ${toDateStr}):`)

  // Calc hashtags stats (returns two maps) for just the inclusion list 'progressHashtags'
  const outputArray = []
  // First check progressHashtags is not empty
  if (config.progressHashtags.length > 0) {
    const hResults = calcHashtagStatsPeriod(fromDateStr, toDateStr, config.progressHashtags, [])
    const hCounts: CaseInsensitiveMap<number> = hResults?.[0] ?? new CaseInsensitiveMap < number >
    const hSumTotals: CaseInsensitiveMap<number> = hResults?.[1] ?? new CaseInsensitiveMap < number >
    if (hSumTotals == null && hCounts == null) {
      log(pluginJson, `no matching hashtags found in ${periodString}`)
    } else {

      console.log("hSumTotals results:")
      for (const [key, value] of hSumTotals.entries()) {
        console.log(`  ${key}: ${value}`)
      }

      // First process more complex 'SumTotals', calculating appropriately
      for (const [key, value] of hSumTotals.entries()) {
        const tagString = key.slice(1) // show without leading '#' to avoid double counting issues
        const total = hSumTotals.get(key) ?? NaN
        if (isNaN(total)) {
          // console.log(`  no totals for ${key}`)
        } else {
          const count = hSumTotals.get(key) ?? NaN
          const totalStr = value.toLocaleString()
          const avgStr = (value / count).toLocaleString([], { maximumSignificantDigits: 2 })
          outputArray.push(`${tagString}\t${count}\t(total ${totalStr}\taverage ${avgStr})`)
          hCounts.delete(key) // remove the entry from the next map, as no longer needed
        }
      }

      console.log("hCounts results:")
      for (const [key, value] of hCounts.entries()) {
        console.log(`  ${key}: ${value}`)
      }

      // Then process simpler 'Counts'
      for (const [key, value] of hCounts.entries()) {
        const hashtagString = key.slice(1) // show without leading '#' to avoid double counting issues
        outputArray.push(`${hashtagString}\t${value}`)
      }
    }
  }

  // Calc mentions stats (returns two maps) for just the inclusion list 'progressMentions'
  // First check progressMentions is not empty
  if (config.progressMentions.length > 0) {
    const mResults = calcMentionStatsPeriod(fromDateStr, toDateStr, config.progressMentions, [])
    const mCounts: CaseInsensitiveMap<number> = mResults?.[0] ?? new CaseInsensitiveMap < number >
    const mSumTotals: CaseInsensitiveMap<number> = mResults?.[1] ?? new CaseInsensitiveMap < number >
    if (mCounts == null && mSumTotals == null) {
      log(pluginJson, `no matching mentions found in ${periodString}`)
    } else {

      console.log("mSumTotals results:")
      for (const [key, value] of mSumTotals.entries()) {
        console.log(`  ${key}: ${value}`)
      }

      // First process more complex 'SumTotals', calculating appropriately
      for (const [key, value] of mSumTotals.entries()) {
        const mentionString = key.slice(1) // show without leading '@' to avoid double counting issues
        const total = mSumTotals.get(key) ?? NaN
        if (isNaN(total)) {
          // console.log(`  no totals for ${key}`)
        } else {
          const count = mCounts.get(key) ?? NaN
          const totalStr = value.toLocaleString()
          const avgStr = (value / count).toLocaleString([], { maximumSignificantDigits: 2 })
          outputArray.push(`${mentionString}\t${count}\t(total ${totalStr}\taverage ${avgStr})`)
          mCounts.delete(key) // remove the entry from the next map, as not longer needed
        }
      }

      console.log("mCounts results:")
      for (const [key, value] of mCounts.entries()) {
        console.log(`  ${key}: ${value}`)
      }

      // Then process simpler 'Counts'
      for (const [key, value] of mCounts.entries()) {
        const mentionString = key.slice(1) // show without leading '@' to avoid double counting issues
        outputArray.push(`${mentionString}\t${value}`)
      }
    }
  }

  // If there's been nothing to report, let's make that clear, otherwise sort output
  if (outputArray.length > 0) {
    outputArray.sort(caseInsensitiveCompare)
  } else {
    outputArray.push('(none)')
  }

  if (params) {
    // this was a template command call
    return `### ${heading}: ${periodPartStr} for ${periodString}\n${outputArray.join('\n')}`
  } else {
    // this is a plugin called from inside an editor
    if (Editor == null) {
      // Now insert the summary to the current note
      logError(pluginJson, `No note is open`)
    } else {
      let currentLineIndex = getSelectedParaIndex()
      if (currentLineIndex === 0) {
        logError(pluginJson, `Couldn't find correct cursor position, so will append to note instead.`)
        currentLineIndex = Editor.paragraphs.length - 1
      }
      // log(pluginJson, `\tinserting results to current note (${Editor.filename ?? ''}) at line ${currentLineIndex}`)
      Editor.insertHeading(
        `${heading}: ${periodPartStr} for ${periodString}`,
        currentLineIndex,
        3,
      )
      Editor.insertParagraph(outputArray.join('\n'), currentLineIndex + 1, 'text')
      log(pluginJson, `  appended results to current note for ${periodPartStr}.`)
    }
  }
}
