/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Summary commands for notes
// Jonathan Clark
// Last updated 2026-01-30 for v1.0.3 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { combineTermArrays, mergeAverageAndTotalDuplicates, processTerms } from './gatherOccurrencesHelpers'
import { getSummariesSettings as getSettingsFromModule, type SummariesConfig } from './summarySettings'
import { TMOccurrences, makeSparkline, makeYesNoLine } from './TMOccurrences'
import type { OccurrencesToLookFor } from './TMOccurrences'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import {
  getDateStringFromCalendarFilename,
  getISODateStringFromYYYYMMDD,
  isDailyNote,
  convertISODateFilenameToNPDayFilename,
  withinDateRange,
} from '@helpers/dateTime'
import { clo, clof, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { caseInsensitiveMatch, caseInsensitiveStartsWith } from '@helpers/search'

// Re-export for backward compatibility
export { TMOccurrences, makeSparkline, makeYesNoLine }
export type { OccurrencesToLookFor }

//------------------------------------------------------------------------------
// Plotly info -- from v2.32.0
// Documentation: https://plotly.com/javascript/

// ES6 module: import Plotly from 'plotly.js-dist-min'

// HTML Script element:
// <head>
//     <script src="https://cdn.plot.ly/plotly-2.32.0.min.js" charset="utf-8"></script>
// </head>
// <body>
//     <div id="gd"></div>
// 
//     <script>
//         Plotly.newPlot("gd", /* JSON object */ {
//             "data": [{ "y": [1, 2, 3] }],
//             "layout": { "width": 600, "height": 400}
//         })
//     </script>
// </body>

// or Native ES6 import:
// <script type="module">
//   import "https://cdn.plot.ly/plotly-2.32.0.min.js"
//   Plotly.newPlot("gd", [{y: [1, 2, 3] }])
// </script>

//------------------------------------------------------------------------------
// Constants

const MAX_SPARKLINE_DAYS = 31

/**
 * Get config settings using Config V2 system.
 * Re-exports from settings module for backward compatibility.
 * @returns {Promise<SummariesConfig>} Object with configuration
 * @throws {Error} If settings cannot be loaded
 */
export async function getSummariesSettings(): Promise<SummariesConfig> {
  return await getSettingsFromModule()
}

//------------------------------------------------------------------------------

/**
 * Gather all occurrences of requested hashtags and mentions from daily notes for a given period.
 * 
 * This function processes calendar notes within the specified date range and collects statistics
 * for hashtags and mentions based on the configuration in occToLookFor. It handles:
 * - Yes/No items (simple presence/absence tracking)
 * - Count items (number of occurrences)
 * - Total items (sum of numeric values)
 * - Average items (average of numeric values)
 * - Checklist items (if reference note is configured)
 * 
 * WORKAROUNDS FOR API BUGS:
 * - NotePlan's API reports hierarchical hashtags (#one/two/three) as multiple tags (#one, #one/two, #one/two/three).
 *   We process tags in reverse order and skip shorter tags that are subsets of longer ones.
 * - Mentions like @repeat(1/7) are sometimes returned incomplete (@repeat(1). We skip these.
 * - Mentions with mismatched brackets are skipped.
 * 
 * Note: This will look at Teamspace notes, but this has not been tested.
 * 
 * @author @jgclark, with addition by @aaronpoweruser
 * @param {string} periodString - Human-readable period description (e.g., "January 2025")
 * @param {string} fromDateStr - Start date in YYYY-MM-DD format
 * @param {string} toDateStr - End date in YYYY-MM-DD format
 * @param {OccurrencesToLookFor} occToLookFor - Configuration object specifying which occurrences to gather
 * @returns {Array<TMOccurrences>} Array of TMOccurrences objects, one per term being tracked
 * @throws {Error} If date range is invalid or reference note cannot be found
 */
export function gatherOccurrences(
  periodString: string,
  fromDateStr: string,
  toDateStr: string,
  occToLookFor: OccurrencesToLookFor
): Array<TMOccurrences> {
  try {
    const calendarNotesInPeriod = DataStore.calendarNotes.filter(
      (n) =>
        isDailyNote(n) &&
        withinDateRange(getDateStringFromCalendarFilename(n.filename), convertISODateFilenameToNPDayFilename(fromDateStr), convertISODateFilenameToNPDayFilename(toDateStr)))
    if (calendarNotesInPeriod.length === 0) {
      logWarn('gatherOccurrences', `- no matching calendar notes found between ${fromDateStr} and ${toDateStr}`)
      return [] // for completeness
    }

    logInfo('gatherOccurrences', `starting with ${calendarNotesInPeriod.length} calendar notes (including week/month notes) for '${periodString}' (${fromDateStr} - ${toDateStr})`)
    let tmOccurrencesArr: Array<TMOccurrences> = [] // to hold what we find

    // Note: in the following is a workaround to an API 'feature' in note.hashtags
    // where #one/two/three gets reported as #one, #one/two, and #one/two/three.
    // To take account of this the tag/mention loops below go backwards to use the longest first

    //------------------------------
    // Review each wanted YesNo type
    let startTime = new Date()
    // make sure this is an array first
    const YesNoListArr = (typeof occToLookFor.GOYesNo === 'string')
      // $FlowIgnore[incompatible-type]
      ? (occToLookFor.GOYesNo !== "")
        ? occToLookFor.GOYesNo.split(',')
        : []
      : occToLookFor.GOYesNo
    logDebug('gatherOccurrences', `GOYesNo = <${String(occToLookFor.GOYesNo)}> type ${typeof occToLookFor.GOYesNo}`)

    for (const wantedItem of YesNoListArr) {
      // initialise a new TMOccurence for this YesNo item
      const thisOcc = new TMOccurrences(wantedItem, 'yesno', fromDateStr, toDateStr)

      // For each daily note in the period
      for (const n of calendarNotesInPeriod) {
        const thisDateStr = getISODateStringFromYYYYMMDD(getDateStringFromCalendarFilename(n.filename))

        // Look at hashtags first ...
        const seenTags = n.hashtags.slice().reverse()
        let lastTag = ''
        for (const tag of seenTags) {
          // if this tag is starting subset of the last one, assume this is an example of the bug, so skip this tag
          if (caseInsensitiveStartsWith(tag, lastTag)) {
            // logDebug('gatherOccurrences', `- Found ${tag} but ignoring as part of a longer hashtag of the same name`)
          }
          else {
            // check this is one of the ones we're after, then add
            if (caseInsensitiveMatch(tag, wantedItem)) {
              // logDebug('gatherOccurrences', `- Found matching occurrence ${tag} on date ${n.filename}`)
              thisOcc.addOccurrence(tag, thisDateStr)
            } else {
              // logDebug('gatherOccurrences', `- x ${tag} not wanted`)
            }
          }
          lastTag = tag
        }

        // Then mentions ...
        const seenMentions = n.mentions.slice().reverse()
        // const lastMention = ''
        for (const mention of seenMentions) {
          // First need to add a check for a bug: `@repeat(1/7)` is returned as `@repeat(1/7), @repeat(1`. Skip the incomplete one.
          if (mention.match(/^@repeat\(\d+$/)) { // e.g. @repeat(4/ 
            continue // skip this mention
          }
          // Also skip where there are mis-matched brackets in this single mention e.g. `@run(12 @distance(6.5)`
          if (mention.match(/\(([^\)]+$|[^\)]+\s@.*\(.*\))/)) {
            logInfo('gatherOccurrences', `- Skipping ill-formed mention '${mention}' on date ${n.filename}`)
            continue // skip this mention
          }

          // check this is one of the ones we're after, then add
          if (caseInsensitiveMatch(mention, wantedItem)) {
            // logDebug('gatherOccurrences', `- Found matching occurrence ${mention} on date ${n.filename}`)
            thisOcc.addOccurrence(mention, thisDateStr)
          } else {
            // logDebug('gatherOccurrences', `- x ${mention} not wanted`)
          }
        }
      }
      tmOccurrencesArr.push(thisOcc)
    }
    logTimer('gatherOccurrences', startTime, `Gathered YesNoList`)
    logDebug('gatherOccurrences', `Now ${tmOccurrencesArr.length} occObjects`)

    // Now compute Completed Checklist items, if Reference note is set
    // Note: this was added by @aaronpoweruser.
    // TODO: It would make more sense to refactor this to have the GO...Setting be the checklist array, not the note name.
    if ((occToLookFor.GOChecklistRefNote ?? '') !== '') {
      startTime = new Date()
      const CompletedChecklistItems = gatherCompletedChecklistItems(calendarNotesInPeriod, fromDateStr, toDateStr, occToLookFor)
      tmOccurrencesArr = tmOccurrencesArr.concat(CompletedChecklistItems)
      logTimer('gatherOccurrences', startTime, `Gathered CompletedChecklistItems data`)
    }

    //------------------------------
    // Review each wanted hashtag
    startTime = new Date()

    // Process hashtags: combine count/average/total arrays, merge duplicates, then process
    const countHashtagsArr = stringListOrArrayToArray(occToLookFor.GOHashtagsCount, ',')
    const averageHashtagsArr = stringListOrArrayToArray(occToLookFor.GOHashtagsAverage, ',')
    const totalHashtagsArr = stringListOrArrayToArray(occToLookFor.GOHashtagsTotal, ',')
    const combinedHashtags = combineTermArrays(countHashtagsArr, averageHashtagsArr, totalHashtagsArr)
    logDebug('gatherOccurrences', `${String(combinedHashtags.length)} sorted combinedHashtags: <${String(combinedHashtags)}>`)

    // Merge terms that appear as both 'average' and 'total' into 'all'
    mergeAverageAndTotalDuplicates(combinedHashtags)

    // Process all hashtags using helper function
    const hashtagOccurrences = processTerms(combinedHashtags, calendarNotesInPeriod, fromDateStr, toDateStr, true)
    tmOccurrencesArr.push(...hashtagOccurrences)
    logTimer('gatherOccurrences', startTime, `Gathered ${String(combinedHashtags.length)} combinedHashtags`)
    logDebug('gatherOccurrences', `Now ${tmOccurrencesArr.length} occObjects`)

    //------------------------------
    // Now repeat for @mentions
    startTime = new Date()

    // Process mentions: combine count/average/total arrays, merge duplicates, then process
    const countMentionsArr = stringListOrArrayToArray(occToLookFor.GOMentionsCount, ',')
    const averageMentionsArr = stringListOrArrayToArray(occToLookFor.GOMentionsAverage, ',')
    const totalMentionsArr = stringListOrArrayToArray(occToLookFor.GOMentionsTotal, ',')
    const combinedMentions = combineTermArrays(countMentionsArr, averageMentionsArr, totalMentionsArr)
    logDebug('gatherOccurrences', `sorted combinedMentions: <${String(combinedMentions)}>`)

    // Merge terms that appear as both 'average' and 'total' into 'all'
    mergeAverageAndTotalDuplicates(combinedMentions)

    // Process all mentions using helper function
    const mentionOccurrences = processTerms(combinedMentions, calendarNotesInPeriod, fromDateStr, toDateStr, false)
    tmOccurrencesArr.push(...mentionOccurrences)
    logTimer('gatherOccurrences', startTime, `Gathered ${String(combinedMentions.length)} combinedMentions`)
    logDebug('gatherOccurrences', `Now ${tmOccurrencesArr.length} occObjects`)

    logDebug('gatherOccurrences', `Finished with ${tmOccurrencesArr.length} occObjects`)
    return tmOccurrencesArr
  }
  catch (error) {
    logError('gatherOccurrences', `Failed to gather occurrences for period ${periodString} (${fromDateStr} - ${toDateStr}): ${error.message}`)
    return [] // Return empty array on error to allow calling code to continue
  }
}

/**
 * Gather all occurrences of requested checklist items for a given period.
 * 
 * This function reads checklist items from a reference note (specified in GOChecklistRefNote)
 * and tracks which ones were completed in daily calendar notes during the period.
 * 
 * It only inspects the daily calendar notes for the period. Checklist items are tracked
 * as Yes/No items (presence/absence on each day).
 * 
 * @author @aaronpoweruser
 * @param {Array<TNote>} calendarNotesInPeriod - Daily calendar notes for the period
 * @param {string} fromDateStr - Start date in YYYY-MM-DD format
 * @param {string} toDateStr - End date in YYYY-MM-DD format
 * @param {OccurrencesToLookFor} occToLookFor - Configuration object. Must include .GOChecklistRefNote (from setting 'progressChecklistReferenceNote')
 * @returns {Array<TMOccurrences>} Array of TMOccurrences objects, one per checklist item
 * @throws {Error} If reference note is not set or cannot be found
 */
function gatherCompletedChecklistItems(calendarNotesInPeriod: Array<TNote>, fromDateStr: string, toDateStr: string, occToLookFor: OccurrencesToLookFor): Array<TMOccurrences> {
  try {
    if ((occToLookFor.GOChecklistRefNote ?? '') === '') {
      throw new Error("Reference note for checklists is not set. Please configure the setting 'progressChecklistReferenceNote' with the title of your reference note.")
    }

    const tmOccurrencesArr: Array<TMOccurrences> = []
    const completedTypes = ['checklistDone', 'checklistScheduled']

    const foundNotes = DataStore.projectNoteByTitle(occToLookFor.GOChecklistRefNote, true, true)
    const referenceNote = foundNotes?.[0]
    if (referenceNote == null) {
      throw new Error(`Cannot find reference note with title '${occToLookFor.GOChecklistRefNote}'. Please check the setting 'progressChecklistReferenceNote' and ensure the note exists.`)
    }

    // Get all the checklist items from the reference note
    const refNoteParas = referenceNote.paragraphs ?? []
    for (const para of refNoteParas) {
      if (para.type === 'checklist') {
        logDebug('gatherCompletedChecklistItems', `Found checklist in reference note ${para.content}`)
        // pad the term with a space to fix emojis being clobered by sparklines
        const thisOcc = new TMOccurrences(` ${para.content}`, 'yesno', fromDateStr, toDateStr)
        tmOccurrencesArr.push(thisOcc)
      }
    }

    // For each daily note in the period check for occurrences of the checklist items
    for (const currentNote of calendarNotesInPeriod) {
      const thisDateStr = getISODateStringFromYYYYMMDD(getDateStringFromCalendarFilename(currentNote.filename))
      for (const para of currentNote.paragraphs) {
        if (completedTypes.includes(para.type)) {
          for (const checklistTMO of tmOccurrencesArr) {
            // pad the term with a space to fix emojis being clobered
            if (checklistTMO.term === ` ${para.content}`) {
              // logDebug('gatherCompletedChecklistItems', `Found matching occurrence ${para.content} in note ${currentNote.filename}`)
              checklistTMO.addOccurrence(checklistTMO.term, thisDateStr)
            }
          }
        }
      }
    }
    return tmOccurrencesArr
  }
  catch (error) {
    logError('gatherCompletedChecklistItems', `Failed to gather checklist items for period ${fromDateStr} - ${toDateStr}: ${error.message}`)
    return []
  }
}

/**
 * Generate output lines for each term, according to the specified style.
 * 
 * Currently only supports style 'markdown', which produces formatted markdown output
 * with optional sparkline graphs for visual representation of data over time.
 * 
 * Sparklines are only shown if:
 * - requestToShowSparklines is true
 * - The period is MAX_SPARKLINE_DAYS days or less (to prevent overly wide displays)
 * 
 * @param {Array<TMOccurrences>} occObjs - Array of occurrence objects to format
 * @param {string} periodString - Human-readable period description
 * @param {string} fromDateStr - Start date in YYYY-MM-DD format
 * @param {string} toDateStr - End date in YYYY-MM-DD format
 * @param {string} style - Output style (currently only 'markdown' is supported)
 * @param {boolean} requestToShowSparklines - Whether to include sparkline graphs
 * @param {boolean} sortOutput - Whether to sort output alphabetically
 * @returns {Promise<Array<string>>} Array of formatted output lines
 */
export async function generateProgressUpdate(
  occObjs: Array<TMOccurrences>, periodString: string, fromDateStr: string, toDateStr: string, style: string, requestToShowSparklines: boolean, sortOutput: boolean
): Promise<Array<string>> {
  try {
    logDebug('generateProgressUpdate', `starting for ${periodString} (${fromDateStr} - ${toDateStr}) with ${occObjs.length} occObjs and sparklines? ${String(requestToShowSparklines)}`)

    const config = await getSummariesSettings()

    const toDateMom = moment(toDateStr, "YYYY-MM-DD")
    const fromDateMom = moment(fromDateStr, "YYYY-MM-DD")
    const daysBetween = toDateMom.diff(fromDateMom, 'days')
    // Include sparklines only if this period is a month or less
    const showSparklines = (requestToShowSparklines && daysBetween <= MAX_SPARKLINE_DAYS)
    // Get length of longest progress term (to use with sparklines)
    const maxTermLen = Math.max(...occObjs.map((m) => m.term.length))

    const outputArray: Array<string> = []
    for (const occObj of occObjs) {
      // occObj.logValuesMap()
      let thisOutput = ''
      switch (style) {
        case 'markdown': {
          if (showSparklines) {
            thisOutput = "`" + occObj.getTerm(maxTermLen) + " " + occObj.getSparklineForPeriod('ascii', config) + "`"
          } else {
            thisOutput = "**" + occObj.getTerm() + "**: "
          }
          thisOutput += " " + occObj.getSummaryForPeriod('text')
          break
        }
        default: {
          logError('generateProgressUpdate', `style '${style}' is not available`)
          break
        }
      }
      outputArray.push(thisOutput)
      if (sortOutput) {
        if (showSparklines) {
          // sort using locale-aware sorting (having trimmed off non-text at start of line)
          outputArray.sort((a, b) => a.slice(1).trim().localeCompare(b.slice(1).trim()))

        } else {
          // sort using locale-aware sorting
          outputArray.sort((a, b) => a.localeCompare(b))
        }
      }
    }
    outputArray.push('') // to ensure next content after this goes onto a new line
    return outputArray
  }
  catch (error) {
    logError('generateProgressUpdate', `Failed to generate progress update for ${periodString} (${fromDateStr} - ${toDateStr}): ${error.message}`)
    return [] // Return empty array on error
  }
}
