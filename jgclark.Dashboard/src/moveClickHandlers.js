// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions that need to refresh Dashboard
// Last updated 2025-07-18 for v2.3.0.b6
//-----------------------------------------------------------------------------

// import moment from 'moment/min/moment-with-locales'
// import { allCalendarSectionCodes, } from './constants'
import {
  getDashboardSettings,
  handlerResult,
  makeDashboardParas,
} from './dashboardHelpers'
import { validateAndFlattenMessageObject } from './shared'
import type { MessageDataObject, TBridgeClickHandlerResult, TDashboardSettings } from './types'
import { clo, JSP, logDebug, logError, logInfo, logWarn, logTimer, timer, } from '@helpers/dev'
import {
  calcOffsetDateStr,
  getDateStringFromCalendarFilename,
  getTodaysDateHyphenated,
  RE_DATE,
  RE_DATE_INTERVAL,
  RE_NP_WEEK_SPEC,
} from '@helpers/dateTime'
import { displayTitle } from '@helpers/general'
import { getNPWeekData, type NotePlanWeekInfo } from '@helpers/NPdateTime'
import {
  moveItemBetweenCalendarNotes,
  moveItemToRegularNote,
} from '@helpers/NPMoveItems'
import {
  // findParaFromRawContentAndFilename,
  findParaFromStringAndFilename
} from '@helpers/NPParagraph'
import { scheduleItem, scheduleItemLiteMethod } from '@helpers/NPScheduleItems'
import { showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------

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
    const { filename, rawContent, controlStr } = validateAndFlattenMessageObject(data)
    const config = await getDashboardSettings()
    const dateOrInterval = String(controlStr)
    logDebug('doMoveFromCalToCal', `Starting with controlStr ${controlStr} and rawContent {${rawContent}}`)

    let startDateStr = getDateStringFromCalendarFilename(filename, true)
    let newDateStr = ''
    if (dateOrInterval === 't') {
    // Special case to change to '>today'

      startDateStr = getDateStringFromCalendarFilename(filename, true)
      newDateStr = getTodaysDateHyphenated()
    } else if (dateOrInterval.match(RE_DATE_INTERVAL)) {
      const offsetUnit = dateOrInterval.charAt(dateOrInterval.length - 1) // get last character

      startDateStr = getDateStringFromCalendarFilename(filename, true)
      // To calculate new date, use today's date (not the original date on the task) + offset
      newDateStr = calcOffsetDateStr(getTodaysDateHyphenated(), dateOrInterval, 'offset') // 'longer'

      // But, we now know the above doesn't observe NP week start, so override with an NP-specific function where offset is of type 'week' but startDateStr is not of type 'week'
      if (offsetUnit === 'w' && !startDateStr.match(RE_NP_WEEK_SPEC)) {
        const offsetNum = Number(dateOrInterval.substr(0, dateOrInterval.length - 1)) // return all but last character
        const NPWeekData = getNPWeekData(startDateStr, offsetNum, 'week')
        if (NPWeekData) {
          newDateStr = NPWeekData.weekString
          logDebug('doMoveFromCalToCal', `- used NPWeekData instead -> ${newDateStr}`)
        } else {
          throw new Error(`Can't get NPWeekData for '${String(offsetNum)}w' when moving task from ${filename} (${startDateStr})`)
        }
      }
    } else if (dateOrInterval.match(RE_DATE)) {
      newDateStr = controlStr
    } else {
      logError('doMoveFromCalToCal', `bad move date/interval: ${dateOrInterval}`)
      return handlerResult(false)
    }
    logDebug('doMoveFromCalToCal', `move task from ${startDateStr} -> ${newDateStr}`)

    // Do the actual move 
    const res = await moveItemBetweenCalendarNotes(startDateStr,
      newDateStr, rawContent,
      config.newTaskSectionHeading, config.newTaskSectionHeadingLevel)

    if (res) {
      logDebug('doMoveFromCalToCal', `-> appeared to move item succesfully`)
      // Send a message to update all the calendar sections (as its too hard to work out which of the sections to update)
      return handlerResult(true, ['REFRESH_ALL_CALENDAR_SECTIONS', 'START_DELAYED_REFRESH_TIMER'])
    } else {
      logWarn('doMoveFromCalToCal', `-> doMoveFromCalToCal to ${newDateStr} not successful`)
      return handlerResult(false)
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
      logError('doMoveToNote', `- no ID for item: ${JSP(item)}`)
      return handlerResult(false)
    }
    logDebug('doMoveToNote', `starting for ID ${item.ID} / ${filename} / {${rawContent}} / ${itemType}`)
    const newPara: ?TParagraph = await moveItemToRegularNote(filename, rawContent, itemType, config.newTaskSectionHeadingLevel, true)

    if (!newPara) {
      logError('doMoveToNote', `- no new para made for ID ${item.ID}`)
      return handlerResult(false)
    }
    const newNote = newPara.note
    if (!newNote) {
      logError('doMoveToNote', `- no new note for ID ${item.ID}`)
      return handlerResult(false)
    }

    // Now find the new paragraph in the destination note to update the display
    // const newParagraph: TParagraph | boolean = findParaFromRawContentAndFilename(newNote.filename, rawContent)
    // if (typeof newParagraph === 'boolean') {
    //   logError('doMoveToNote', `- can't find new paragraph in note '${newNote.filename}' based on rawContent {${rawContent}}`)
    // } else {
    //   // If success, then update the display
    //   if (newNote) {
        logDebug('doMoveToNote', `Success: moved to -> '${displayTitle(newNote)}'`)
        // Update the display for this line (as it will probably still be relevant in its section)
        logDebug('doMoveToNote', `- Sending update line request for ID ${item.ID}`)
    const newDashboardPara = makeDashboardParas([newPara])[0]
    logDebug('doMoveToNote', `- newDashboardPara: ${JSP(newDashboardPara)}`)
    return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph: newDashboardPara })
    //   }
    // }
    // return handlerResult(false)
  } catch (error) {
    logError('doMoveToNote', JSP(error))
    return { success: false }
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
  const { filename, content, controlStr } = validateAndFlattenMessageObject(data)
  const config: TDashboardSettings = await getDashboardSettings()
  // Following logging to get to the bottom of the issue with non-numeric settings
  logDebug('doRescheduleItem', `Starting with filename: ${filename}, content: "${content}", controlStr: ${controlStr}`)
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
    await showMessage(`Note ${filename} doesn't seem to contain "{${content}}"`)
    return handlerResult(false)
  }
  const origNoteType = thePara.note?.type

  if (dateOrInterval === 't') {
    // Special case to change to '>today' (or the actual date equivalent)
    newDateStr = config.useTodayDate ? 'today' : getTodaysDateHyphenated()
    logDebug('doRescheduleItem', `- move task in ${filename} -> 'today'`)
  } else if (dateOrInterval.match(RE_DATE_INTERVAL)) {
    const dateInterval = dateOrInterval
    const offsetUnit = dateInterval.charAt(dateInterval.length - 1) // get last character
    // Get today's date, ignoring current date on task. Note: this means we always start with a *day* base date, not week etc.
    startDateStr = getTodaysDateHyphenated()
    // Get the new date, but output using the longer of the two types of dates given
    newDateStr = calcOffsetDateStr(startDateStr, dateInterval, 'longer')

    // But, we now know the above doesn't observe NP week start, so override with an NP-specific function where offset is of type 'week'
    if (offsetUnit === 'w') {
      const offsetNum = Number(dateInterval.substr(0, dateInterval.length - 1)) // return all but last character
      // $FlowFixMe(incompatible-type)
      const NPWeekData: NotePlanWeekInfo = getNPWeekData(startDateStr, offsetNum, 'week')
      // clo(NPWeekData, "NPWeekData:")
      newDateStr = NPWeekData.weekString
      logDebug('doRescheduleItem', `- used NPWeekData instead -> ${newDateStr}`)
    }
  } else if (dateOrInterval.match(RE_DATE)) {
    newDateStr = controlStr
    logDebug('doRescheduleItem', `- newDateStr ${newDateStr} from controlStr`)
  } else {
    logError('doRescheduleItem', `bad move date/interval: ${dateOrInterval}`)
    return handlerResult(false)
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
    logDebug('doRescheduleItem', `- appeared to update line OK using ${origNoteType === 'Notes' || config.useLiteScheduleMethod ? 'lite' : 'NP full'} method -> {${thePara.content}}`)

    // Note: No need to ask for cache refresh for this note -- done in functions above

    // refresh all enabled sections, as we don't know here which if any section the moved task might need to be added to (if any)
    logDebug('doRescheduleItem', `------------ refresh enabled ------------`)
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON', 'REFRESH_ALL_ENABLED_SECTIONS'], { updatedParagraph: thePara })
  } else {
    logWarn('doRescheduleItem', `- some other failure`)
    return handlerResult(false)
  }
}
