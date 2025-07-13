// @flow
// ----------------------------------------------------------------------------
// Command to Shift Dates
// @jgclark
// Last updated 2025-01-20 for v0.22.2, by @jgclark
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getEventsSettings } from './eventsHelpers'
import {
  calcOffsetDateStr,
  RE_DONE_DATE_OPT_TIME,
  RE_ISO_DATE,
  RE_ISO_DATE_ALL,
  RE_NP_MONTH_SPEC,
  RE_NP_MONTH_ALL,
  RE_NP_QUARTER_SPEC,
  RE_NP_QUARTER_ALL,
  RE_NP_WEEK_SPEC,
  RE_NP_WEEK_ALL,
  RE_NP_YEAR_SPEC,
  RE_NP_YEAR_ALL,
  splitIntervalToParts,
} from '@helpers/dateTime'
import { getNPWeekData } from '@helpers/NPdateTime'
import { clo, log, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { stripBlockIDsFromString } from '@helpers/stringTransforms'
import { askDateInterval, showMessage } from '@helpers/userInput'

// ----------------------------------------------------------------------------

/**
 * Shift Dates -- user command entry point.
 * Gets data ready for shiftDatesCore() function.
 * @author @jgclark
 */
export async function shiftDates(): Promise<void> {
  try {
    // Get working selection as an array of paragraphs
    const { paragraphs, selection, note } = Editor
    let pArr: $ReadOnlyArray<TParagraph> = []
    const startingCursorPos = selection?.start ?? 0
    if (Editor == null || paragraphs == null || note == null) {
      logError(pluginJson, `No note or content found to process. Stopping.`)
      await showMessage('No note or content found to process.', 'OK', 'Shift Dates')
      return
    }
    const selectionLength = selection?.length ?? 0
    if (selectionLength > 0) {
      // Use just the selected paragraphs
      pArr = Editor.selectedParagraphs.slice() // to tell Flow it's no longer a $ReadOnlyArray
    } else {
      // Use the whole note
      pArr = paragraphs.slice(0, findEndOfActivePartOfNote(note) + 1)
    }
    logDebug(pluginJson, `shiftDates starting for ${pArr.length} lines`)
    if (pArr.length === 0) {
      await showMessage('Please select some lines to process.', 'OK', 'Shift Dates')
      throw new Error(`Empty selection found. Stopping.`)
    }

    // Get interval to use
    const interval = await askDateInterval("{question:'What interval would you like me to shift these dates by?'}")
    if (interval === '') {
      await showMessage(`Sorry, that was not a valid date interval.`)
      throw new Error(`No valid interval supplied. Stopping.`)
    }

    // Do main work
    const updatedCount = await shiftDatesCore(note, pArr, interval)

    // undo selection for safety, and because the end won't now be correct
    Editor.highlightByIndex(startingCursorPos, 0)

    // Notify user
    logDebug(pluginJson, `Shifted ${updatedCount} dates in ${pArr.length} lines`)
    await showMessage(`Shifted ${updatedCount} dates in ${pArr.length} lines`, 'OK', 'Shift Dates')
  } catch (err) {
    logError(pluginJson, `shiftDates: ${err.message}`)
  }
}

/**
 * Shift Dates -- core function called by other entry point(s).
 * Go through currently selected lines in the open note and shift YYYY-MM-DD, YYYY-Www and YYYY-MM dates by an interval given by the user.
 * Optionally removes @done(...) dates if wanted, but doesn't touch other others than don't have whitespace or newline before them.
 * Optionally will un-complete completed tasks/checklists.
 * @author @jgclark
 * @param {TNote} noteToProcess
 * @param {Array<TParagraph>} parasToProcess
 * @param {string} interval - the interval to shift the dates by
 */
export async function shiftDatesCore(note: TNote, parasToProcess: Array<TParagraph>, interval: string): Promise<number> {
  try {
    const config = await getEventsSettings()
    const intervalParts = splitIntervalToParts(interval)

    // Iterate over all paras
    let updatedCount = 0
    parasToProcess.forEach((p) => {
      const origContent = p.content
      let dates: Array<string> = []
      let originalDateStr = ''

      // Work on lines with dates
      if (
        origContent.match(RE_ISO_DATE) || origContent.match(RE_NP_WEEK_SPEC) || origContent.match(RE_NP_MONTH_SPEC)
        || origContent.match(RE_NP_QUARTER_SPEC) || origContent.match(RE_NP_YEAR_SPEC)) {
        logDebug('shiftDatesCore', `#${String(p.lineIndex)}: ${origContent}`)
        // As we're about to update the string, first 'unhook' it from any sync'd copies
        let updatedContent = stripBlockIDsFromString(origContent)

        // If wanted, remove @done(...) part
        const doneDatePart = (updatedContent.match(RE_DONE_DATE_OPT_TIME)) ?? ['']
        // logDebug('shiftDatesCore', `>> ${String(doneDatePart)}`)
        if (config.removeDoneDates && doneDatePart[0] !== '') {
          updatedContent = updatedContent.replace(doneDatePart[0], '')
        }

        // If wanted, remove any processedTagName
        if (config.removeProcessedTagName && updatedContent.includes(config.processedTagName)) {
          updatedContent = updatedContent.replace(config.processedTagName, '')
        }

        // If wanted, set any complete or cancelled tasks/checklists to not complete
        if (config.uncompleteTasks) {
          if (p.type === 'done') {
            // logDebug('shiftDatesCore', `>> changed done -> open`)
            p.type = 'open'
          } else if (p.type === 'cancelled') {
            // logDebug('shiftDatesCore', `>> changed cancelled -> open`)
            p.type = 'open'
          } else if (p.type === 'scheduled') {
            // logDebug('shiftDatesCore', `>> changed scheduled -> open`)
            p.type = 'open'
          } else if (p.type === 'checklistDone') {
            // logDebug('shiftDatesCore', `>> changed checklistDone -> checklist`)
            p.type = 'checklist'
          } else if (p.type === 'checklistScheduled') {
            // logDebug('shiftDatesCore', `>> changed checklistScheduled -> checklist`)
            p.type = 'checklist'
          } else if (p.type === 'checklistCancelled') {
            // logDebug('shiftDatesCore', `>> changed checklistCancelled -> checklist`)
            p.type = 'checklist'
          }
        }

        logDebug('shiftDatesCore', `  -> ${updatedContent}`)

        // For any YYYY-MM-DD dates in the line (can make sense in metadata lines to have multiples)
        let shiftedDateStr = ''
        if (updatedContent.match(RE_ISO_DATE)) {
          // Process all YYYY-MM-DD dates in the line
          dates = updatedContent.match(RE_ISO_DATE_ALL) ?? []
          for (const thisDate of dates) {
            originalDateStr = thisDate
            shiftedDateStr = calcOffsetDateStr(originalDateStr, interval)
            // Replace date part with the new shiftedDateStr
            updatedContent = updatedContent.replace(originalDateStr, shiftedDateStr)
            logDebug('shiftDatesCore', `- ${originalDateStr}: DAY match found -> ${shiftedDateStr} from interval ${interval}`)
            updatedCount += 1
          }
          // logDebug('shiftDatesCore', `-> ${updatedContent}`)
        }
        // For any YYYY-Wnn dates in the line (might in future make sense in metadata lines to have multiples)
        if (updatedContent.match(RE_NP_WEEK_SPEC)) {
          // Process all YYYY-Www dates in the line
          dates = updatedContent.match(RE_NP_WEEK_ALL) ?? []
          for (const thisDate of dates) {
            originalDateStr = thisDate
            // v1: but doesn't handle different start-of-week settings
            // shiftedDateStr = calcOffsetDateStr(originalDateStr, interval)
            // v2: using NPdateTime::getNPWeekData instead
            const thisWeekInfo = getNPWeekData(originalDateStr, intervalParts.number, intervalParts.type)
            if (thisWeekInfo) {
              shiftedDateStr = thisWeekInfo?.weekString
              // Replace date part with the new shiftedDateStr
              updatedContent = updatedContent.replace(originalDateStr, shiftedDateStr)
              logDebug('shiftDatesCore', `- ${originalDateStr}: WEEK match found -> ${shiftedDateStr} from interval ${interval}`)
              updatedCount += 1
            } else {
              logWarn('shiftDatesCore', `No week data found for ${originalDateStr} - will skip this line`)
            }
          }
          // logDebug('shiftDatesCore', `-> ${updatedContent}`)
        }
        // For any YYYY-MM dates in the line (might in future make sense in metadata lines to have multiples)
        // (Note: the regex ensures we don't match on YYYY-MM-DD dates as well)
        if (updatedContent.match(RE_NP_MONTH_SPEC)) {
          dates = updatedContent.match(RE_NP_MONTH_ALL) ?? []
          // Process all YYYY-MM dates in the line
          for (const thisDate of dates) {
            originalDateStr = thisDate
            shiftedDateStr = calcOffsetDateStr(originalDateStr, interval)
            // Replace date part with the new shiftedDateStr
            updatedContent = updatedContent.replace(originalDateStr, shiftedDateStr)
            logDebug('shiftDatesCore', `- ${originalDateStr}: MONTH match found -> ${shiftedDateStr} from interval ${interval}`)
            updatedCount += 1
          }
          // logDebug('shiftDatesCore', `-> ${updatedContent}`)
        }

        // For any YYYY-Qq dates in the line (might in future make sense in metadata lines to have multiples)
        if (updatedContent.match(RE_NP_QUARTER_SPEC)) {
          dates = updatedContent.match(RE_NP_QUARTER_ALL) ?? []
          // Process all YYYY-Qq dates in the line
          for (const thisDate of dates) {
            originalDateStr = thisDate
            shiftedDateStr = calcOffsetDateStr(originalDateStr, interval)
            // Replace date part with the new shiftedDateStr
            updatedContent = updatedContent.replace(originalDateStr, shiftedDateStr)
            logDebug('shiftDatesCore', `- ${originalDateStr}: QUARTER match found -> ${shiftedDateStr} from interval ${interval}`)
            updatedCount += 1
          }
          // logDebug('shiftDatesCore', `-> ${updatedContent}`)
        }

        // For any YYYY dates in the line (might in future make sense in metadata lines to have multiples)
        // (Note: the regex ensures we don't match on YYYY-MM or YYYY-MM-DD dates as well)
        if (updatedContent.match(RE_NP_YEAR_SPEC)) {
          dates = updatedContent.match(RE_NP_YEAR_ALL) ?? []
          // Process all YYYY dates in the line
          for (const thisDate of dates) {
            originalDateStr = thisDate
            shiftedDateStr = calcOffsetDateStr(originalDateStr, interval)
            // Replace date part with the new shiftedDateStr
            updatedContent = updatedContent.replace(originalDateStr, shiftedDateStr)
            logDebug('shiftDatesCore', `- ${originalDateStr}: YEAR match found -> ${shiftedDateStr} from interval ${interval}`)
            updatedCount += 1
          }
          // logDebug('shiftDatesCore', `-> ${updatedContent}`)
        }

        // Update the paragraph content
        p.content = updatedContent.trimEnd()
        // logDebug('shiftDatesCore', `-> '${p.content}'`)
      }
    })
    // Write all paragraphs to the note
    note.updateParagraphs(parasToProcess)

    return updatedCount
  } catch (err) {
    logError(pluginJson, err.message)
    return 0
  }
}
