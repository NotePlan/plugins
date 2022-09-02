// @flow
//-----------------------------------------------------------------------------
// Progress update on some key goals to include in notes
// Jonathan Clark, @jgclark
// Last updated 2.9.2022 for v0.13.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  calcHashtagStatsPeriod, // previous method
  calcMentionStatsPeriod, // previous method
  gatherOccurrences,
  generateProgressUpdate,
  getSummariesSettings,
  TMOccurrences
} from './summaryHelpers'
import {
  getDateStringFromCalendarFilename,
  toLocaleDateString,
  unhyphenatedDate,
  withinDateRange,
} from '@helpers/dateTime'
import { getPeriodStartEndDates } from '@helpers/NPDateTime'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import {
  CaseInsensitiveMap,
  displayTitle,
  getTagParamsFromString,
} from '@helpers/general'
import { replaceSection } from '@helpers/note'
import { getSelectedParaIndex } from '@helpers/NPParagraph'
import {
  caseInsensitiveMatch,
  caseInsensitiveStartsWith,
} from '@helpers/search'
import { caseInsensitiveCompare } from '@helpers/sorting'

//-------------------------------------------------------------------------------

/**
 * Work out the progress stats of interest (on hashtags and/or mentions) so far this week or month, and write out to current note.
 * Defaults to looking at week to date ("wtd") but can specify month to date ("mtd") as well, or 'last7d', 'last2w', 'last4w'.
 * If it's week to date, then use the user's first day of week from NP setting.
 * @author @jgclark
 *
 * @param {string?} params - can pass parameter string e.g. "{interval: 'mtd', heading: 'Progress'}"
 * @return {string?} - either return string to Template, or void to plugin
 */
export async function insertProgressUpdate(params?: string): Promise<string | void> {
  try {
    // Get config setting
    const config = await getSummariesSettings()
    // Use configuration setting as default for time period
    let period = config.progressPeriod

    // If there are params passed, then we've been called by a template command (and so use those).
    // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
    const heading = await getTagParamsFromString(params ?? '', 'heading', config.progressHeading)
    const showSparklines = await getTagParamsFromString(params ?? '', 'showSparklines', config.showSparklines)
    // TEST: Allow 'period' instead of 'interval'
    const intervalParam = await getTagParamsFromString(params ?? '', 'interval', '')
    if (intervalParam !== '') {
      period = intervalParam
    }
    const periodParam = await getTagParamsFromString(params ?? '', 'period', '')
    if (periodParam !== '') {
      period = periodParam
    }

    logDebug(pluginJson, `starting for period ${period} titled '${heading}' and showSparklines? ${showSparklines}`)

    // Get time period of interest
    const [fromDate, toDate, periodType, periodString, periodPartStr] = await getPeriodStartEndDates('', period)
    if (fromDate == null || toDate == null) {
      throw new Error(`Error: failed to calculate dates`)
    }
    if (fromDate > toDate) {
      throw new Error(`Error: requested fromDate ${String(fromDate)} is after toDate ${String(toDate)}`)
    }
    const fromDateStr = unhyphenatedDate(fromDate)
    const toDateStr = unhyphenatedDate(toDate)

    // Main work: calculate the progress update as an array of strings
    const tmOccurrencesArray = await gatherOccurrences(periodString, fromDateStr, toDateStr, config.progressHashtags, [], config.progressMentions, [], config.progressYesNo)

    const output = generateProgressUpdate(tmOccurrencesArray, periodString, fromDateStr, toDateStr, 'markdown', showSparklines).join('\n')

    // Send output to chosen required destination
    if (params) {
      // this was a template command call, so simply return the output text
      logDebug(pluginJson, `-> returning text to template for '${heading}: ${periodPartStr} for ${periodString}'`)
      return `${'#'.repeat(config.headingLevel)} ${heading}: ${periodPartStr} for ${periodString}\n${output}`
    } else {
      // This is called by a plugin command
      // Mow decide whether to write to current note (the only option before v0.10)
      // or update the relevant section in the current Weekly note (added at v0.10)
      switch (config.progressDestination) {
        case 'daily': {
          const destNote = DataStore.calendarNoteByDate(new Date(), 'day')
          if (destNote) {
            logDebug(pluginJson, `- about to update section '${heading}' in daily note '${destNote.filename}' for ${periodPartStr}`)
            // Replace or add Section
            replaceSection(destNote, heading, `${heading}: ${periodPartStr} for ${periodString}`, config.headingLevel, output)
            logInfo(pluginJson, `Updated section '${heading}' in daily note '${destNote.filename}' for ${periodPartStr}`)
          } else {
            logError(pluginJson, `Cannot find weekly note to write to`)
          }
          break
        }
        case 'weekly': {
          // get weekly
          const destNote = DataStore.calendarNoteByDate(new Date(), 'week')
          if (destNote) {
            logDebug(pluginJson, `- about to update section '${heading}' in weekly note '${destNote.filename}' for ${periodPartStr}`)
            // Replace or add Section
            replaceSection(destNote, heading, `${heading}: ${periodPartStr} for ${periodString}`, config.headingLevel, output)
            logInfo(pluginJson, `Updated section '${heading}' in weekly note '${destNote.filename}' for ${periodPartStr}`)
          } else {
            logError(pluginJson, `Cannot find weekly note to write to`)
          }
          break
        }

        default: {
          // = 'current'
          const currentNote = Editor.note
          if (currentNote == null) {
            // Now insert the summary to the current note
            logError(pluginJson, `No note is open in the Editor, so I can't write to it.`)
          } else {
            let currentLineIndex = getSelectedParaIndex()
            if (currentLineIndex === 0) {
              logError(pluginJson, `Couldn't find correct cursor position, so will append to note instead.`)
              currentLineIndex = Editor.paragraphs.length - 1
            }
            logDebug(pluginJson, `\tinserting results to current note (${currentNote.filename ?? ''}) at line ${currentLineIndex}`)
            // Replace or add Section
            replaceSection(currentNote, heading, `${heading}: ${periodPartStr} for ${periodString}`, config.headingLevel, output)
            logInfo(pluginJson, `Appended progress update for ${periodPartStr} to current note`)
          }
          break
        }
      }
    }
  }
  catch (error) {
    logError(pluginJson, error.message)
  }
}

/**
 * NOTE: NOW DEPRECATED IN FAVOUR OF gatherOccurrences and generateProgressUpdate.
 * 
 * Work out the progress stats of interest (on hashtags and/or mentions) so far this week or month, and return a string.
 * Default to looking at week to date ("wtd") but allow month to date ("mtd") as well.
 * If it's week to date, then use the user's first day of week
 * @author @jgclark
 *
 * @param {string} periodString - week to date ("wtd") or month to date ("mtd")
 * @param {string} fromDateStr
 * @param {string} toDateStr
 * @param {Array<string>} hashtagList
 * @param {Array<string>} mentionList
 * @param {boolean?} showSparklines
 * @return {string} - return string
 */
function calcProgressUpdate(periodString: string, fromDateStr: string, toDateStr: string, hashtagList: Array<string>, mentionList: Array<string>, showSparklines: boolean = true): string {
  try {
    logDebug('calcProgressUpdate', `starting for ${periodString} (= ${fromDateStr} - ${toDateStr}):`)

    // Calc hashtags stats (returns two maps) for just the inclusion list 'progressHashtags'
    const outputArray: Array<string> = []

    // First check progressHashtags is not empty
    if (hashtagList.length > 0) {
      const hResults = calcHashtagStatsPeriod(fromDateStr, toDateStr, hashtagList, [])
      const hCounts: CaseInsensitiveMap<number> = hResults?.[0] ?? new CaseInsensitiveMap < number > ()
      const hSumTotals: CaseInsensitiveMap<number> = hResults?.[1] ?? new CaseInsensitiveMap < number > ()
      if (hSumTotals == null && hCounts == null) {
        logDebug('calcProgressUpdate', `no matching hashtags found in ${periodString}`)
      } else {
        // logDebug('calcProgressUpdate', "hSumTotals results:")
        // for (const [key, value] of hSumTotals.entries()) {
        //   logDebug('calcProgressUpdate', `  ${key}: ${value}`)
        // }

        // First process more complex 'SumTotals', calculating appropriately
        for (const [key, value] of hSumTotals.entries()) {
          const tagString = key.slice(1) // show without leading '#' to avoid double counting issues
          const total = hSumTotals.get(key) ?? NaN
          if (isNaN(total)) {
            logDebug('calcProgressUpdate', `  no totals for ${key}`)
          } else {
            const count = hSumTotals.get(key) ?? NaN
            const totalStr = value.toLocaleString()
            const avgStr = (value / count).toLocaleString([], { maximumSignificantDigits: 2 })
            outputArray.push(`${tagString}\t${count}\t(total ${totalStr}\tavg ${avgStr})`)
            hCounts.delete(key) // remove the entry from the next map, as no longer needed
          }
        }

        // logDebug('calcProgressUpdate', "hCounts results:")
        // for (const [key, value] of hCounts.entries()) {
        //   logDebug('calcProgressUpdate', `  ${key}: ${value}`)
        // }

        // Then process simpler 'Counts'
        for (const [key, value] of hCounts.entries()) {
          const hashtagString = key.slice(1) // show without leading '#' to avoid double counting issues
          outputArray.push(`${hashtagString}\t${value}`)
        }
      }
    }

    // Calc mentions stats (returns two maps) for just the inclusion list 'progressMentions'
    // First check progressMentions is not empty
    if (mentionList.length > 0) {
      const mResults = calcMentionStatsPeriod(fromDateStr, toDateStr, mentionList, [])
      const mCounts: CaseInsensitiveMap<number> = mResults?.[0] ?? new CaseInsensitiveMap < number > ()
      const mSumTotals: CaseInsensitiveMap<number> = mResults?.[1] ?? new CaseInsensitiveMap < number > ()
      if (mCounts == null && mSumTotals == null) {
        logDebug('calcProgressUpdate', `no matching mentions found in ${periodString}`)
      } else {
        // logDebug('calcProgressUpdate', "mSumTotals results:")
        // for (const [key, value] of mSumTotals.entries()) {
        //   logDebug('calcProgressUpdate', `  ${key}: ${value}`)
        // }

        // First process more complex 'SumTotals', calculating appropriately
        for (const [key, value] of mSumTotals.entries()) {
          const mentionString = key.slice(1) // show without leading '@' to avoid double counting issues
          const total = mSumTotals.get(key) ?? NaN
          if (isNaN(total)) {
            logDebug(`  no totals for ${key}`)
          } else {
            const count = mCounts.get(key) ?? NaN
            const totalStr = value.toLocaleString()
            const avgStr = (value / count).toLocaleString([], { maximumSignificantDigits: 2 })
            outputArray.push(`${mentionString}\t${count}\t(total ${totalStr}\tavg ${avgStr})`)
            mCounts.delete(key) // remove the entry from the next map, as not longer needed
          }
        }
      }

      // logDebug('calcProgressUpdate', "mCounts results:")
      // for (const [key, value] of mCounts.entries()) {
      //   logDebug('calcProgressUpdate', `  ${key}: ${value}`)
      // }

      // Then process simpler 'Counts'
      for (const [key, value] of mCounts.entries()) {
        const mentionString = key.slice(1) // show without leading '@' to avoid double counting issues
        outputArray.push(`${mentionString}\t${value}`)
      }
    }

    // If there's been nothing to report, let's make that clear, otherwise sort output
    if (outputArray.length > 0) {
      outputArray.sort(caseInsensitiveCompare)
    } else {
      outputArray.push('(none)')
    }
    return outputArray.join('\n')
  }
  catch (error) {
    logError('calcProgressUpdate', error.message)
    return '' // for completeness
  }
}
