// @flow
//-----------------------------------------------------------------------------
// Progress update on some key goals to include in notes
// Jonathan Clark, @jgclark
// Last updated 12.8.2022 for v0.12.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  calcHashtagStatsPeriod,
  calcMentionStatsPeriod,
  getSummariesSettings,
  TMOccurrences
} from './summaryHelpers'
import {
  getDateStringFromCalendarFilename,
  withinDateRange,
  unhyphenatedDate
} from '@helpers/dateTime'
import { getPeriodStartEndDates } from '@helpers/NPDateTime'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'
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
import { spark_line } from './ascii-graphs-lib'

//-------------------------------------------------------------------------------

export async function testProgressUpdate(params?: string): Promise<void> {
  await insertProgressUpdate("{ interval: 'mtd', heading: 'Habits', showSparkline: false }")
}

/**
 * Work out the progress stats of interest (on hashtags and/or mentions) so far this week or month, and write out to current note.
 * Defaults to looking at week to date ("wtd") but can specify month to date ("mtd") as well.
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
    // If there are params passed, then we've been called by a template command (and so use those).
    // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
    const interval = await getTagParamsFromString(params ?? '', 'interval', 'userwtd')
    const heading = await getTagParamsFromString(params ?? '', 'heading', config.progressHeading)
    const showSparklines = await getTagParamsFromString(params ?? '', 'showSparklines', config.showSparklines)

    // Get time period of interest
    const [fromDate, toDate, periodType, periodString, periodPartStr] = await getPeriodStartEndDates('', interval)
    if (fromDate == null || toDate == null) {
      throw new Error(`Error calculating dates`)
    }
    if (fromDate > toDate) {
      throw new Error(`Error: requested fromDate is after toDate`)
    }
    const fromDateStr = unhyphenatedDate(fromDate)
    const toDateStr = unhyphenatedDate(toDate)

    // Main work: calculate the progress update as an array of strings
    // const outputArray = calcProgressUpdate(periodString, fromDateStr, toDateStr, config.progressHashtags, config.progressMentions, config.showSparklines)

    const tmOccurrencesArray = await gatherOccurrences(periodString, fromDateStr, toDateStr, config.progressHashtags, config.progressMentions)

    const output = generateProgressUpdate(tmOccurrencesArray, periodString, fromDateStr, toDateStr, config.showSparklines).join('\n')

    // Send output to chosen required destination
    if (params) {
      // this was a template command call, so simply return the output text
      logDebug(pluginJson, `-> returning text to template for '${heading}: ${periodPartStr} for ${periodString}'`)
      return `### ${heading}: ${periodPartStr} for ${periodString}\n${output}`
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
          if (Editor == null) {
            // Now insert the summary to the current note
            logError(pluginJson, `No note is open in the Editor, so I can't write to it.`)
          } else {
            let currentLineIndex = getSelectedParaIndex()
            if (currentLineIndex === 0) {
              logError(pluginJson, `Couldn't find correct cursor position, so will append to note instead.`)
              currentLineIndex = Editor.paragraphs.length - 1
            }
            logDebug(pluginJson, `\tinserting results to current note (${Editor.filename ?? ''}) at line ${currentLineIndex}`)
            Editor.insertHeading(`${heading}: ${periodPartStr} for ${periodString}`, currentLineIndex, 3)
            Editor.insertParagraph(output, currentLineIndex + 1, 'text')
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

function gatherOccurrences(periodString: string, fromDateStr: string, toDateStr: string, progressHashtags: Array<string>, progressMentions: Array<string>): Array<TMOccurrences> {
  try {

    logDebug('gatherOccurrences', `starting for ${periodString} (${fromDateStr}-${toDateStr})`)
    const periodDailyNotes = DataStore.calendarNotes.filter(
      (p) => withinDateRange(getDateStringFromCalendarFilename(p.filename), fromDateStr, toDateStr))
    if (periodDailyNotes.length === 0) {
      logWarn('calcHashtagStatsPeriod', `no matching daily notes found between ${fromDateStr} and ${toDateStr}`)
      return [] // for completeness
    }

    // Note: in the following is a workaround to an API 'feature' in note.hashtags
    // where #one/two/three gets reported as #one, #one/two, and #one/two/three.
    // Go backwards through the hashtag array, and then check

    let tmOccurrencesArr: Array<TMOccurrences> = [] // to hold what we find 

    // Review each wanted hashtag
    for (let wantedTag of progressHashtags) {
      // initialise a new TMOccurence for this mention
      const thisOcc = new TMOccurrences(wantedTag, 'count', fromDateStr, toDateStr)

      // For each daily note in the period
      for (const n of periodDailyNotes) {
        const seenTags = n.hashtags.slice().reverse()
        let lastTag = ''
        for (const tag of seenTags) {
          // if this tag is starting subset of the last one, assume this is an example of the bug, so skip this tag
          if (caseInsensitiveStartsWith(tag, lastTag)) {
            logDebug('calcHashtagStatsPeriod', `- Found ${tag} but ignoring as part of a longer hashtag of the same name`)
          }
          else {
            // check this is on inclusion, or not on exclusion list, before adding
            if (caseInsensitiveMatch(tag, wantedTag)) {
              logDebug('gatherOccurrences', `found matching occurrence ${tag} on date ${n.filename}`)
              thisOcc.addOccurrence(tag, getDateStringFromCalendarFilename(n.filename))
            } else {
              logDebug('gatherOccurrences', `- x ${tag} not wanted`)
            }
          }
          lastTag = tag
        }
      }
      tmOccurrencesArr.push(thisOcc)
    }

    // Now repeat for @mentions
    for (let wantedMention of progressMentions) {
      // initialise a new TMOccurence for this mention
      const thisOcc = new TMOccurrences(wantedMention, 'all', fromDateStr, toDateStr)

      // For each daily note in the period
      for (const n of periodDailyNotes) {
        const thisDateStr = getDateStringFromCalendarFilename(n.filename)
        const seenMentions = n.mentions.slice().reverse()
        let lastMention = ''
        for (const mention of seenMentions) {
          const mentionWithoutNumberPart = (mention.split('(', 1))[0]
          // logDebug('gatherOccurrences', `- reviewing ${mention} [${mentionWithoutNumberPart}] looking for ${wantedMention} on ${thisDateStr}`)
          // if this tag is starting subset of the last one, assume this is an example of the issue, so skip this tag
          if (caseInsensitiveStartsWith(mention, lastMention)) {
            logDebug('calcHashtagStatsPeriod', `- Found ${mention} but ignoring as part of a longer mention of the same name`)
            continue
          }
          else {
            // check this is on inclusion, or not on exclusion list, before adding
            if (caseInsensitiveMatch(mentionWithoutNumberPart, wantedMention)) {
              thisOcc.addOccurrence(mention, thisDateStr)
            } else {
              // logDebug('gatherOccurrences', `- x ${mention} not wanted`)
            }
          }
          lastMention = mention
        }
      }
      tmOccurrencesArr.push(thisOcc)
    }

    // const testOccObjA = new TMOccurrences('@work', 'average', '2022-W32', 7)
    // testOccObjA.addOccurrence('4', '20220812')
    // testOccObjA.addOccurrence('8.2', '20220813')
    // testOccObjA.addOccurrence('14.4', '20220815')
    // testOccObjA.addOccurrence('-2.2', '20220817')
    // tmOccurrencesArr.push(testOccObjA)

    // const testOccObjB = new TMOccurrences('#dogwalk', 'yesno', '2022-W32', 7)
    // testOccObjB.addOccurrence('1', '20220813')
    // testOccObjB.addOccurrence('1', '20220814')
    // testOccObjB.addOccurrence('1', '20220816')
    // tmOccurrencesArr.push(testOccObjB)

    // const testOccObjC = new TMOccurrences('#dogwalk', 'total', '2022-W32', 7)
    // testOccObjC.addOccurrence('4.6', '20220812')
    // testOccObjC.addOccurrence('2.3', '20220815')
    // testOccObjC.addOccurrence('4.5', '20220817')
    // tmOccurrencesArr.push(testOccObjC)

    logDebug('gatherOccurrences', `Finished with ${tmOccurrencesArr.length} occObjects`)
    return tmOccurrencesArr
  }
  catch (error) {
    logError('gatherOccurrences', error.message)
    return [] // for completness
  }
}

function generateProgressUpdate(occObjs: Array<TMOccurrences>, periodString: string, fromDateStr: string, toDateStr: string, showSparklines: boolean): Array<string> {
  try {
    logDebug('generateProgressUpdate', `starting for ${periodString} (${fromDateStr}-${toDateStr})`)
    let outputArray: Array<string> = []
    for (let occObj of occObjs) {
      // occObj.logValuesMap()
      let thisOutput = ''
      if (showSparklines) {
        thisOutput = "`" + occObj.getTerm(12) + " " + occObj.getSparkline('ascii') + "`"
      } else {
        thisOutput = occObj.getTerm(12)
      }
      thisOutput += " " + occObj.getStats('text')
      outputArray.push(thisOutput)
    }
    return outputArray
  }
  catch (error) {
    logError('gatherOccurrences', error.message)
    return [] // for completeness
  }
}

/**
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
        logDebug(pluginJson, `no matching hashtags found in ${periodString}`)
      } else {
        // logDebug("hSumTotals results:")
        // for (const [key, value] of hSumTotals.entries()) {
        //   logDebug(`  ${key}: ${value}`)
        // }

        // First process more complex 'SumTotals', calculating appropriately
        for (const [key, value] of hSumTotals.entries()) {
          const tagString = key.slice(1) // show without leading '#' to avoid double counting issues
          const total = hSumTotals.get(key) ?? NaN
          if (isNaN(total)) {
            logDebug(`  no totals for ${key}`)
          } else {
            const count = hSumTotals.get(key) ?? NaN
            const totalStr = value.toLocaleString()
            const avgStr = (value / count).toLocaleString([], { maximumSignificantDigits: 2 })
            const sparkline = (showSparklines) ? generateSparkline(tagString, [], 'ascii') : ''
            outputArray.push(`\`${tagString}\t${sparkline}\`\t${count}\t(total ${totalStr}\tavg ${avgStr})`)
            hCounts.delete(key) // remove the entry from the next map, as no longer needed
          }
        }

        // logDebug("hCounts results:")
        // for (const [key, value] of hCounts.entries()) {
        //   logDebug(`  ${key}: ${value}`)
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
        logDebug(pluginJson, `no matching mentions found in ${periodString}`)
      } else {
        // logDebug("mSumTotals results:")
        // for (const [key, value] of mSumTotals.entries()) {
        //   logDebug(`  ${key}: ${value}`)
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
            const sparkline = (showSparklines) ? generateSparkline(mentionString, [], 'ascii') : ''
            outputArray.push(`\`${mentionString}\t${sparkline}\`\t${count}\t(total ${totalStr}\tavg ${avgStr})`)
            mCounts.delete(key) // remove the entry from the next map, as not longer needed
          }
        }
      }

      // logDebug("mCounts results:")
      // for (const [key, value] of mCounts.entries()) {
      //   logDebug(`  ${key}: ${value}`)
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
    logError(pluginJson, error.message)
    return '' // for completeness
  }
}

/**
 * Generate an ASCII-art sparkline of the provided values.
 * Notes:
 * - will require minimum 0 in the sparkline
 * - allows for NaN in the array of values, which implies a missing data point, and will be displayed differently
 * @param {string} tagString 
 * @param {Array<number>} tagValues
 * @returns 
 */
function generateSparkline(tagString: string, tagValues: Array<number> = [], style: string = 'ascii'): string { // TODO: in time remove = []
  // randomly generated length array 0 <= A[N] <= 39
  const values = (tagValues.length === 0) ? tagValues :
    Array.from({ length: 20 }, () => Math.floor(Math.random() * 40))

  let out = ''
  switch (style) {
    case 'ascii': {
      // using characters "█▇▆▅▄▃▁"
      // Or possible some of ∙▣⍟⊚●★✪☓■▒▉█☗
      const sparklineOptions = { min: 0, addStats: false, divider: '|', missingDataChar: '☓' }
      out = spark_line(values, sparklineOptions)
      break
    }
    default: {
      logError('generateSparkline', `style '${style}' is not available`)
      break
    }
  }
  return out
}
