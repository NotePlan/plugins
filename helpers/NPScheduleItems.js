// @flow
// -----------------------------------------------------------------
// Helpers for scheduling open tasks/checklists in paragraphs.
// -----------------------------------------------------------------

import {
  findScheduledDates,
  getDateStringFromCalendarFilename,
  getDisplayDateStrFromFilenameDateStr,
  getFilenameDateStrFromDisplayDateStr,
  replaceArrowDatesInString,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getHeadingHierarchyForThisPara } from '@helpers/headings'
import { findParaFromStringAndFilename } from '@helpers/NPParagraph'
import { findHeading, smartAppendPara, smartCreateSectionsAndPara, smartPrependPara } from '@helpers/paragraph'

/**
 * Remove any scheduled date (e.g. >YYYY-MM-DD or >YYYY-Www) from given line in note identified by filename.
 * Now also changes para type to 'open'/'checklist' if it wasn't already.
 * @author @jgclark
 * @param {string} filename of note
 * @param {string} content line to identify and change
 * @returns {boolean} success?
 */
export function unscheduleItem(filename: string, content: string): boolean {
  try {
    // find para
    const possiblePara: TParagraph | boolean = findParaFromStringAndFilename(filename, content)
    if (typeof possiblePara === 'boolean') {
      throw new Error('unscheduleItem: no para found')
    }
    // Get the paragraph to change
    const thisPara = possiblePara
    const thisNote = thisPara.note
    if (!thisNote) throw new Error(`Could not get note for filename ${filename}`)

    // Find and then remove any scheduled dates
    const thisLine = possiblePara.content
    logDebug('unscheduleItem', `unscheduleItem('${thisLine}'`)
    thisPara.content = replaceArrowDatesInString(thisLine, '')
    logDebug('unscheduleItem', `unscheduleItem('${thisPara.content}'`)
    // And then change type
    if (thisPara.type === 'checklistScheduled') thisPara.type = 'checklist'
    if (thisPara.type === 'scheduled') thisPara.type = 'open'
    // Update to DataStore
    thisNote.updateParagraph(thisPara)
    return true
  } catch (error) {
    logError('unscheduleItem', error.message)
    return false
  }
}

/**
 * Note: This is the 'Lite' method of Scheduling, preferred by JGC. See also 'Full' method below.
 * Schedule an open item for a given date (e.g. >YYYY-MM-DD, >YYYY-Www, >today etc.) for a given paragraph.
 * It adds the '>' to the start of the date, and appends to the end of the para.
 * It removes any existing scheduled >dates.
 * It does not change the para type, or Add a new line in the destination date's note.
 * Note: Therefore this is the only method to use if you are scheduling an item in a regular note.
 * @author @jgclark
 * @param {TParagraph} para of open item
 * @param {string} dateStrToAdd, without leading '>'. Can be special date 'today'.
 * @returns {boolean} success?
 */
export function scheduleItemLiteMethod(thisPara: TParagraph, dateStrToAdd: string): boolean {
  try {
    const thisNote = thisPara.note
    const origContent = thisPara.content
    if (!thisNote) throw new Error(`Could not get note for para '${origContent}'`)

    const origDateStr = thisNote.type === 'Calendar' ? getDateStringFromCalendarFilename(thisNote.filename) : findScheduledDates(origContent)[0]
    logDebug('scheduleItemLiteMethod', `Starting to schedule from ${origDateStr} to '${dateStrToAdd}'`)

    // In existing line find and then remove any existing scheduled dates, and add new scheduled date
    thisPara.content = replaceArrowDatesInString(origContent, `>${dateStrToAdd}`)
    logDebug('scheduleItemLiteMethod', `-> '${thisPara.content}'`)
    // Update to DataStore
    thisNote.updateParagraph(thisPara)

    // Ask for cache refresh for these notes
    DataStore.updateCache(thisNote, false)

    return true
  } catch (error) {
    logError('scheduleItemLiteMethod', error.message)
    return false
  }
}

/**
 * Note: This is the 'Full' method of Scheduling, as performed by NotePlan UI on items in Calendar notes. See original 'Lite' method above.
 * Schedule an open item for a given date (e.g. >YYYY-MM-DD, >YYYY-Www, >today etc.) for a given paragraph.
 * In more detail this:
 * - adds the '>' to the start of the date, and appends to the end of the para.
 * - removes any existing scheduled >dates.
 * - changes the para type to 'scheduled'/'checklistScheduled'
 * - makes original line become `- [>] item >new_date`
 * - and new line `- [ ] item <old_date`
 * Note: It doesn't make sense to run this on a para from regular note. If it tries it will redirect to use the 'Lite' method above.
 * @author @jgclark
 * @param {TParagraph} origPara of open item
 * @param {string} dateStrToAdd, without leading '>'. Can be special date 'today'.
 * @param {string?} newTaskSectionHeading, which can be empty, in which case it will be added at the end of the note.
 * @param {number?} newTaskSectionHeadingLevel heading level to use for new headings (optional, defaults to 2)
 * @returns {boolean} success?
 */
export function scheduleItem(origPara: TParagraph, dateStrToAdd: string, newTaskSectionHeading: string = '', newTaskSectionHeadingLevel: number = 2): boolean {
  try {
    const originNote = origPara.note
    if (!originNote) throw new Error(`Could not get note for existing para`)
    if (originNote.type === 'Notes') {
      logDebug('scheduleItem', `It doesn't make sense to run this on a para from regular note '${originNote.filename}'. Will call scheduleItemLiteMethod instead.`)
      return scheduleItemLiteMethod(origPara, dateStrToAdd)
    }

    const origDateStr = getDisplayDateStrFromFilenameDateStr(originNote.filename)
    const origContent = origPara.content
    const origType = origPara.type
    if (!originNote) throw new Error(`Could not get note for para '${origContent}'`)
    logDebug('scheduleItem', `Starting to schedule from ${origDateStr} to '${dateStrToAdd}'`)

    // In existing line find and then remove any existing scheduled dates, and add new scheduled date
    origPara.content = replaceArrowDatesInString(origContent, `>${dateStrToAdd}`)
    // Change line type (if not already *Scheduled)
    if (origType === 'checklist') origPara.type = 'checklistScheduled'
    if (origType === 'open') origPara.type = 'scheduled'
    logDebug('scheduleItem', `Orig -> '${origPara.content}' type '${origPara.type}' in note ${originNote.filename}`)

    // Update to DataStore, and ask for cache refresh
    originNote.updateParagraph(origPara)
    DataStore.updateCache(originNote, false)
    logDebug('scheduleItem', `-> orig updated`)

    // Then add new line in destination note
    const dateStrToAddForAPICall = getFilenameDateStrFromDisplayDateStr(dateStrToAdd)
    const destNote = DataStore.calendarNoteByDateString(dateStrToAddForAPICall)
    if (!destNote) throw new Error(`Could not get note for new date ${dateStrToAddForAPICall}`)
    const newContent = replaceArrowDatesInString(origContent, `<${origDateStr}`)
    const newType = origType
    const heading = newTaskSectionHeading
    // Handle options for where to insert the new lines (see also NPMoveItems::moveItemBetweenCalendarNotes())
    if (heading === '<<top of note>>') {
      // Handle this special case
      logDebug('scheduleItem', `- Adding line '${newContent}' to start of active part of note '${displayTitle(destNote)}' using smartPrependPara()`)
      smartPrependPara(destNote, newContent, origType)
    }
    else if (heading === '' || heading === '<<bottom of note>>') {
      logDebug('scheduleItem', `- Adding line '${newContent}' to start of active part of note '${displayTitle(destNote)}' using smartAppendPara()`)
      smartAppendPara(destNote, newContent, origType)
    }
    else if (heading === '<<carry forward>>') {
      // Get preceding headings for origPara
      const headingHierarchy = getHeadingHierarchyForThisPara(origPara).reverse()
      logDebug('scheduleItem', `- Calling smartCreateSectionsAndPara() to add line '${newContent}' to '${displayTitle(destNote)}' with headingHierarchy: [${String(headingHierarchy)}]`)
      const firstHeadingPara = findHeading(originNote, headingHierarchy[0])
      const firstHeadingLevel = firstHeadingPara?.headingLevel ?? newTaskSectionHeadingLevel
      smartCreateSectionsAndPara(destNote, newContent, origType, headingHierarchy, firstHeadingLevel)
    } else {
      logDebug('scheduleItem', `New -> '${newContent}' type '${newType}' under heading ${heading}`)
      destNote.addParagraphBelowHeadingTitle(newContent, newType, heading, true, true)
    }
    logDebug('scheduleItem', `-> new added to ${destNote.filename}`)

    // Ask for cache refresh for new note
    DataStore.updateCache(destNote, false)

    return true
  } catch (error) {
    logError('scheduleItem', error.message)
    return false
  }
}
