// @flow
//-----------------------------------------------------------------------------
// Progress update on some key goals to include in notes
// Jonathan Clark, @jgclark
// Last updated 26.4.2022 for v0.7.1, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  calcHashtagStatsPeriod,
  calcMentionStatsPeriod,
  getSummariesSettings,
  getPeriodStartEndDates,
} from './summaryHelpers'
import { unhyphenatedDate } from '../../helpers/dateTime'
import { log, logWarn, logError } from '../../helpers/dev'
import { getTagParamsFromString, rangeToString } from '../../helpers/general'

//-------------------------------------------------------------------------------

function getSelectedParaIndex(): number {
  const { paragraphs, selection } = Editor
  // Get current selection, and its range
  if (selection == null) {
    logWarn(pluginJson, `No selection found, so stopping.`)
    return 0
  }
  const range = Editor.paragraphRangeAtCharacterIndex(selection.start)
  // log(pluginJson, `  Cursor/Selection.start: ${rangeToString(range)}`)

  // Work out what selectedPara number(index) this selected selectedPara is
  let firstSelParaIndex = 0
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    if (p.contentRange?.start === range.start) {
      firstSelParaIndex = i
      break
    }
  }
  // log(pluginJson, `  firstSelParaIndex = ${firstSelParaIndex}`)
  return firstSelParaIndex
}

/**
 * Work out the @mention stats of interest so far this week/month, and write out to current note.
 * Default to looking at week to date ("wtd") but allow month to date ("mtd") as well.
 * @author @jgclark
 *
 * @param {string?} params - can pass parameter string e.g. "{interval: 'mtd', heading: 'Progress'}"
 * @return {string?} - either return string to Template, or void to plugin
 */
export async function insertProgressUpdate(params?: string): Promise<string | void > {
  // Get config setting
  let config = await getSummariesSettings()
  // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
  // If there are params passed, then we've been called by a template command (and so use those).
  const interval = await getTagParamsFromString(params ?? '', 'interval', 'wtd')
  const heading = await getTagParamsFromString(params ?? '', 'heading', config.progressHeading)

  // Get time period
  const [fromDate, toDate, periodString, periodPartStr] = await getPeriodStartEndDates('', interval)
  if (fromDate == null || toDate == null) {
    log(pluginJson, `insertProgressUpdate: Error calculating dates for week to date`)
    return `Error calculating dates for week to date`
  }
  const fromDateStr = unhyphenatedDate(fromDate)
  const toDateStr = unhyphenatedDate(toDate)
  log(pluginJson, `  calculating ${interval} for ${periodString} (= ${fromDateStr} - ${toDateStr}):`)
  // Get day of week (Sunday is first day of the week) or day of month
  const dateWithinInterval = interval === 'wtd' ? new Date().getDay() + 1 : new Date().getDate()

  // Calc hashtags stats (returns two maps)
  const hOutputArray = []
  // $FlowIgnore[invalid-tuple-arity]
  let hResults = await calcHashtagStatsPeriod(fromDateStr, toDateStr, config.progressHashtags, [])
  const hCounts = hResults?.[0]
  const hSumTotals = hResults?.[1]
  if (hSumTotals == null || hCounts == null) {
    logWarn(pluginJson, `No results from calcHashtagStatsPeriod`)
  } else {
    // Process 'Counts'
    for (const [key, value] of hCounts) {
      // .entries() implied
      const hashtagString = key.slice(1) // show without leading '#' to avoid double counting issues
      hOutputArray.push(`${hashtagString}\t${value}`)
    }
    // If there's nothing to report, let's make that clear, otherwise sort output
    if (hOutputArray.length > 0) {
      hOutputArray.sort()
    } else {
      hOutputArray.push('(none)')
    }
  }

  // Calc mentions stats (returns two maps)
  const mOutputArray = []
  // $FlowIgnore[invalid-tuple-arity]
  let mResults = await calcMentionStatsPeriod(fromDateStr, toDateStr, config.progressMentions, [])
  const mCounts = mResults?.[0]
  const mSumTotals = mResults?.[1]
  if (mCounts == null || mSumTotals == null) {
    logWarn(pluginJson, `No results from calcMentionsStatsPeriod`)
  } else {
    // First process more complex 'SumTotals', calculating appropriately
    for (const [key, value] of mSumTotals) {
      // .entries() implied
      const mentionString = key.slice(1) // show without leading '@' to avoid double counting issues
      const count = mCounts.get(key)
      if (count != null) {
        const total = value.toLocaleString()
        const average = (value / count).toFixed(1)
        mOutputArray.push(`${mentionString}\t${count}\t(total ${total}\taverage ${average})`)
        mCounts.delete(key) // remove the entry from the next map, as not longer needed
      }
    }
    // Then process simpler 'Counts'
    for (const [key, value] of mCounts) {
      const mentionString = key.slice(1) // show without leading '@' to avoid double counting issues
      mOutputArray.push(`${mentionString}\t${value}`)
    }
    // If there's nothing to report, let's make that clear, otherwise sort output
    if (mOutputArray.length > 0) {
      mOutputArray.sort()
    } else {
      mOutputArray.push('(none)')
    }
  }

  if (params) {
    // this was a template command call
    return `### ${heading}: Day ${dateWithinInterval} for ${periodString}\n`
      .concat(mOutputArray.join('\n'), hOutputArray.length ? '\n' : '', hOutputArray.join('\n'))
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
        `${heading}: Day ${dateWithinInterval} for ${periodString}`,
        currentLineIndex,
        3,
      )
      Editor.insertParagraph(mOutputArray.join('\n'), currentLineIndex + 1, 'text')
      Editor.insertParagraph(hOutputArray.join('\n'), currentLineIndex + 1 + mOutputArray.length, 'text')
      log(pluginJson, `  appended results to current note for day ${dateWithinInterval}.`)
    }
  }
}
