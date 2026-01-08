// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions that need to refresh Dashboard
// Last updated 2026-01-04 for v2.4.0.b by @jgclark
//-----------------------------------------------------------------------------

import {
  getDashboardSettings,
  handlerResult,
  makeDashboardParas,
} from './dashboardHelpers'
import { validateAndFlattenMessageObject } from './shared'
import type { MessageDataObject, TBridgeClickHandlerResult, TDashboardSettings } from './types'
import { clo, JSP, logDebug, logError, logInfo, logWarn, logTimer, timer, } from '@helpers/dev'
import {
  getDateStringFromCalendarFilename,
  getTodaysDateHyphenated,
  RE_DATE,
  RE_DATE_INTERVAL,
  RE_NP_WEEK_SPEC,
} from '@helpers/dateTime'
import { displayTitle } from '@helpers/general'
import { calcOffsetDateStr, getNPWeekData, getDateStrFromRelativeDateString } from '@helpers/NPdateTime'
import {
  moveItemBetweenCalendarNotes,
  moveItemToRegularNote,
} from '@helpers/NPMoveItems'
import { findParaFromStringAndFilename } from '@helpers/NPParagraph'
import { scheduleItem, scheduleItemLiteMethod } from '@helpers/NPScheduleItems'

//-----------------------------------------------------------------

/**
 * Calculate the new date string from a control string (date interval or date).
 * Handles 't' for today, date intervals (e.g., '1w', '2d'), and explicit dates.
 * @param {string} dateOrInterval - the control string ('t', date interval, or date)
 * @param {string} baseDateStr - the base date string to use for calculations (today's date for reschedule, original date for move)
 * @param {TDashboardSettings} config - dashboard settings
 * @param {string} filename - filename for error messages
 * @param {boolean} isReschedule - if true, uses 'longer' mode for intervals; if false, uses 'offset' mode
 * @returns {string} the calculated new date string
 */
function calculateNewDateStr(
  dateOrInterval: string,
  baseDateStr: string,
  config: TDashboardSettings,
  filename: string,
  isReschedule: boolean = false,
): string {
  if (dateOrInterval === 't') {
    // Special case to change to '>today'
    return config.useTodayDate ? 'today' : getTodaysDateHyphenated()
  } else if (dateOrInterval.match(RE_DATE_INTERVAL)) {
    const offsetUnit = dateOrInterval.charAt(dateOrInterval.length - 1) // get last character
    // To calculate new date, use today's date (not the original date on the task) + offset
    const calcMode = isReschedule ? 'longer' : 'offset'
    let newDateStr = calcOffsetDateStr(getTodaysDateHyphenated(), dateOrInterval, calcMode)

    // But, we now know the above doesn't observe NP week start, so override with an NP-specific function where offset is of type 'week'
    if (offsetUnit === 'w') {
      // For move operations, only use NPWeekData if baseDateStr is not already a week spec
      // For reschedule operations, always use NPWeekData for weeks
      if (isReschedule || !baseDateStr.match(RE_NP_WEEK_SPEC)) {
        const offsetNum = Number(dateOrInterval.substr(0, dateOrInterval.length - 1)) // return all but last character
        const NPWeekData = getNPWeekData(baseDateStr, offsetNum, 'week')
        if (NPWeekData) {
          newDateStr = NPWeekData.weekString
          logDebug('calculateNewDateStr', `- used NPWeekData instead -> ${newDateStr}`)
        } else {
          throw new Error(`Can't get NPWeekData for '${String(offsetNum)}w' when ${isReschedule ? 'rescheduling' : 'moving'} task from ${filename} (${baseDateStr})`)
        }
      }
    }
    return newDateStr
  } else if (dateOrInterval.match(RE_DATE)) {
    return dateOrInterval
  } else {
    throw new Error(`bad move date/interval: ${dateOrInterval}`)
  }
}

/**
 * Move an item from one calendar note to a different one.
 * The date to move to is indicated by controlStr, which is a relative date.
 * TODO: Extend to move sub-items as well, if wanted.
 * Note: the main work is done by dashboardHelpers::moveItemBetweenCalendarNotes().
 * @param {MessageDataObject} data for the item
 * @returns {TBridgeClickHandlerResult} how to handle this result
 */
export async function doMoveFromCalToCal(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {
    const { filename, rawContent, controlStr, thisSectionCode, sectionCodes } = validateAndFlattenMessageObject(data)
    const config = await getDashboardSettings()
    const dateOrInterval = String(controlStr)
    logDebug('doMoveFromCalToCal', `Starting with controlStr ${controlStr} and rawContent {${rawContent}}`)

    const startDateStr: string = getDateStringFromCalendarFilename(filename, true)
    let newDateStr = ''
    try {
      newDateStr = calculateNewDateStr(dateOrInterval, startDateStr, config, filename, false)
    } catch (error) {
      logWarn('doMoveFromCalToCal', `Error "${String(error)}" for calculateNewDateStr`)
      return handlerResult(false, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: [thisSectionCode], errorMsg: `Error calculating date from '${dateOrInterval}' from '${startDateStr}'. I will refresh this section, then please try again.`, errorMessageLevel: 'WARN' })
    }
    logDebug('doMoveFromCalToCal', `move task from ${startDateStr} -> ${newDateStr}`)

    // Convert relative date strings (like 'today') to actual date strings for moveItemBetweenCalendarNotes
    // moveItemBetweenCalendarNotes needs actual date strings, not relative ones
    newDateStr = getDateStrFromRelativeDateString(newDateStr) || newDateStr
    logDebug('doMoveFromCalToCal', `- converted relative date '${newDateStr}' -> actual date '${newDateStr}'`)

    // Do the actual move 
    const res = await moveItemBetweenCalendarNotes(filename,
      newDateStr, rawContent,
      config.newTaskSectionHeading, config.newTaskSectionHeadingLevel)

    if (res) {
      logDebug('doMoveFromCalToCal', `-> appeared to move item successfully`)
      // Send a message to update just the calendar sections that were affected by the move
      return handlerResult(true, ['REFRESH_SECTION_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], { sectionCodes: sectionCodes })
    } else {
      logWarn('doMoveFromCalToCal', `-> to date ${newDateStr} not successful`)
      return handlerResult(false, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: [thisSectionCode], errorMsg: `Moving item from note ${startDateStr} to date ${newDateStr} not successful. I will refresh this section, then please try again.`, errorMessageLevel: 'WARN' })
    }
  } catch (error) {
    logError('doMoveFromCalToCal', JSP(error))
    return { success: false }
  }
}

/**
 * Instruction to move task from any note to a regular note.
 * Note: Requires user input, so most of the work is done in moveItemToRegularNote() on plugin side.
 * @param {MessageDataObject} data for the item
 * @returns {TBridgeClickHandlerResult} how to handle this result
 */
export async function doMoveToNote(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {
    const config = await getDashboardSettings()
    const { filename, rawContent, itemType, item } = validateAndFlattenMessageObject(data)
    if (!(item?.ID)) {
      throw new Error(`Can't find ID for item)}`)
    }
    logDebug('doMoveToNote', `starting for ID ${item.ID} / ${filename} / {${rawContent}} / ${itemType}`)
    const newPara: ?TParagraph = await moveItemToRegularNote(filename, rawContent, itemType, config.newTaskSectionHeadingLevel, true)

    if (!newPara) {
      throw new Error(`Moving item to note '${filename}' not successful. This is most often caused by changing a task in NotePlan since the last time the Dashboard was refreshed. Please refresh and try again.`)
    }
    const newNote = newPara.note
    if (!newNote) {
      throw new Error(`Can't find new note after moving item ${item.ID} to note '${filename}'. This is most often caused by changing a task in NotePlan since the the Dashboard and try again. If it persists, please report it to the developer.`)
    }
    logDebug('doMoveToNote', `Success: moved to -> '${displayTitle(newNote)}'`)

    // Update the display for this line (as it will probably still be relevant in its section)
    const newDashboardPara = makeDashboardParas([newPara])[0]
    logDebug('doMoveToNote', `- newDashboardPara: ${JSP(newDashboardPara)}`)
    return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph: newDashboardPara })
  } catch (error) {
    logError('doMoveToNote', JSP(error))
    return handlerResult(false, [], { errorMsg: error.message, errorMessageLevel: 'ERROR' })
  }
}

/**
 * Reschedule (i.e. update the >date) an item in place.
 * The new date is indicated by the controlStr ('t' or date interval), or failing that the dateString (an NP date).
 * Can now do full (NP-style) 'schedule' or my preferred 'lite' method.
 * @param {MessageDataObject} data for the item
 * @returns {TBridgeClickHandlerResult} how to handle this result
 */
export async function doRescheduleItem(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content, controlStr, sectionCodes } = validateAndFlattenMessageObject(data)
  const config: TDashboardSettings = await getDashboardSettings()
  // Following logging to get to the bottom of the issue with non-numeric settings
  logDebug('doRescheduleItem', `Starting with filename: ${filename}, content: "${content}", controlStr: ${controlStr}, sectionCodes: ${sectionCodes}`)
  logDebug('doRescheduleItem', `- config.rescheduleNotMove = ${String(config.rescheduleNotMove)}`)
  logDebug('doRescheduleItem', `- config.useLiteScheduleMethod = ${String(config.useLiteScheduleMethod)}`)
  logDebug('doRescheduleItem', `- config.newTaskSectionHeading = ${String(config.newTaskSectionHeading)}`)
  logDebug('doRescheduleItem', `- config.newTaskSectionHeadingLevel = ${typeof config.newTaskSectionHeadingLevel} ${String(config.newTaskSectionHeadingLevel)}`)
  const dateOrInterval = String(controlStr)
  // const dateInterval = controlStr || ''
  let startDateStr = ''
  let newDateStr = ''

  const thePara = findParaFromStringAndFilename(filename, content)
  if (typeof thePara === 'boolean') {
    logWarn('doRescheduleItem', `- note ${filename} doesn't seem to contain {${content}}`)
    clo(data, `doRescheduleItem -> data`)
    return handlerResult(false, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: sectionCodes, errorMsg: `Note ${filename} doesn't seem to contain {${content}}. I will refresh this Section; please then try again.`, errorMessageLevel: 'WARN' })
  }
  const origNoteType = thePara.note?.type

  try {
    // For reschedule, we use today's date as the base for intervals (not the original date on the task)
    startDateStr = getTodaysDateHyphenated()
    newDateStr = calculateNewDateStr(dateOrInterval, startDateStr, config, filename, true)
    if (dateOrInterval === 't') {
      logDebug('doRescheduleItem', `- move task in ${filename} -> 'today'`)
    } else if (dateOrInterval.match(RE_DATE)) {
      logDebug('doRescheduleItem', `- newDateStr ${newDateStr} from controlStr`)
    }
  } catch (error) {
    logError('doRescheduleItem', String(error))
    return handlerResult(false, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: sectionCodes, errorMsg: `Couldn't calculate new date for from '${dateOrInterval}' from '${startDateStr}'. I will refresh this Section; please then try again.`, errorMessageLevel: 'WARN' })
  }
  logDebug('doRescheduleItem', `change due date on task from '${startDateStr ?? '?'}' -> '${newDateStr}'`)

  // Make the actual change to reschedule the item
  // v1:
  // const theLine = thePara.content
  // const changedLine = replaceArrowDatesInString(thePara.content, `>${newDateStr}`)
  // logDebug('doRescheduleItem', `Found line "${theLine}" -> changed line: "${changedLine}"`)
  // thePara.content = changedLine
  // v2:
  // const res = scheduleItem(thePara, newDateStr, config.useRescheduleMarker)
  // v3: choice of 2 schedule methods
  // Note: need to use the 'Lite' method if the para is in a regular (not calendar) note
  const res = (origNoteType === 'Notes' || config.useLiteScheduleMethod)
    ? scheduleItemLiteMethod(thePara, newDateStr)
    : scheduleItem(thePara, newDateStr, config.newTaskSectionHeading, config.newTaskSectionHeadingLevel)
  const thisNote = thePara.note
  if (thisNote) {
    thisNote.updateParagraph(thePara)
    logDebug('doRescheduleItem', `-> appeared to update line OK using ${origNoteType === 'Notes' || config.useLiteScheduleMethod ? 'lite' : 'NP full'} method -> {${thePara.content}}`)

    // Note: No need to ask for cache refresh for this note -- done in functions above

    // refresh all enabled sections, as we don't know here which if any section the moved task might need to be added to (if any)
    // TODO: but we could be a bit smarter about this ...
    logDebug('doRescheduleItem', `------------ refresh section(s) ${String(sectionCodes)} ------------`)
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON', 'REFRESH_SECTION_IN_JSON'], { updatedParagraph: thePara, sectionCodes: sectionCodes })
  } else {
    logWarn('doRescheduleItem', `-> some other failure`)
    return handlerResult(false, [], { errorMsg: `Couldn't get the note this was scheduled to for some unknown reason.`, errorMessageLevel: 'ERROR' })
  }
}
