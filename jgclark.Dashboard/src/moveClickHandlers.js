// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions that need to refresh Dashboard
// Last updated for v2.1.0.b
//-----------------------------------------------------------------------------

// import moment from 'moment/min/moment-with-locales'
import { allCalendarSectionCodes, } from './constants'
import {
  getDashboardSettings,
  handlerResult,
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
import { getNPWeekData, type NotePlanWeekInfo } from '@helpers/NPdateTime'
import {
  moveItemBetweenCalendarNotes,
  moveItemToRegularNote,
} from '@helpers/NPMoveItems'
import { findParaFromStringAndFilename } from '@helpers/NPParagraph'
import { scheduleItem } from '@helpers/NPScheduleItems'
import { showMessage } from '@helpers/userInput'
import { scheduleItemLiteMethod } from '../../helpers/NPScheduleItems'

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
  const { filename, content, controlStr } = validateAndFlattenMessageObject(data)
  const config = await getDashboardSettings()
  const dateOrInterval = String(controlStr)
  logDebug('doMoveFromCalToCal', `Starting with controlStr ${controlStr}`)
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
      newDateStr, content,
      config.newTaskSectionHeading ?? '', config.newTaskSectionHeadingLevel ?? 2)

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

// Instruction to move task from a note to a project note.
// Note: Requires user input, so most of the work is done in moveItemToRegularNote() on plugin side.
export async function doMoveToNote(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content, itemType, para } = validateAndFlattenMessageObject(data)
  logDebug('doMoveToNote', `starting -> ${filename} / ${content} / ${itemType}`)
  const newNote: TNote | null | void = await moveItemToRegularNote(filename, content, itemType)
  if (newNote) {
    logDebug('doMoveToNote', `Success: moved to -> "${newNote?.title || ''}"`)
    logDebug('doMoveToNote', `- now needing to find the TPara for ${para.type}:"${content}" ...`)
    // updatedParagraph (below) is an actual NP object (TParagraph) not a TParagraphForDashboard, so we need to go and find it again
    const updatedParagraph = newNote.paragraphs.find((p) => p.content === content && p.type === para.type)
    if (updatedParagraph) {
      logDebug('doMoveToNote', `- Sending update line request $JSP(updatedParagraph)`)
      return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph })
    } else {
      logWarn('doMoveToNote', `Couldn't find updated paragraph. Resorting to refreshing all enabled sections :-(`)
      return handlerResult(true, ['REFRESH_ALL_ENABLED_SECTIONS'], { sectionCodes: allCalendarSectionCodes })
    }
  } else {
    return handlerResult(false)
  }
}

/**
 * Reschedule (i.e. update the >date) an item in place.
 * The new date is indicated by the controlStr ('t' or date interval),
 * or failing that the dateString (an NP date).
 * Note: now defaults to changing the item to being type 'rescheduled' or 'checklistScheduled', as well as ???
 * FIXME: need to do both parts of  a proper 'reschedule'
 * @param {MessageDataObject} data for the item
 * @returns {TBridgeClickHandlerResult} how to handle this result
 */
export async function doRescheduleItem(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content, controlStr } = validateAndFlattenMessageObject(data)
  const config: TDashboardSettings = await getDashboardSettings()
  // logDebug('doRescheduleItem', `- config.rescheduleNotMove = ${config.rescheduleNotMove}`)
  logDebug('doRescheduleItem', `Starting with filename: ${filename}, content: "${content}", controlStr: ${controlStr}`)
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
  logDebug('doRescheduleItem', `change due date on task from ${startDateStr} -> ${newDateStr}`)

  // Make the actual change to reschedule the item
  // v1:
  // const theLine = thePara.content
  // const changedLine = replaceArrowDatesInString(thePara.content, `>${newDateStr}`)
  // logDebug('doRescheduleItem', `Found line "${theLine}" -> changed line: "${changedLine}"`)
  // thePara.content = changedLine
  // v2:
  // const res = scheduleItem(thePara, newDateStr, config.useRescheduleMarker)
  // v3: choice of 2 schedule methods
  const res = (config.useLiteScheduleMethod)
    ? scheduleItem(thePara, newDateStr)
    : scheduleItemLiteMethod(thePara, newDateStr)
  const thisNote = thePara.note
  if (thisNote) {
    thisNote.updateParagraph(thePara)
    logDebug('doRescheduleItem', `- appeared to update line OK using ${config.useLiteScheduleMethod ? 'lite' : 'NP full'} method -> {${thePara.content}}`)

    // Ask for cache refresh for this note -- done above
    // DataStore.updateCache(thisNote, false)

    // refresh all enabled sections, as we don't know here which if any section the moved task might need to be added to (if any)
    // logDebug('doRescheduleItem', `------------ refresh enabled ------------`)
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON', 'REFRESH_ALL_ENABLED_SECTIONS'], { updatedParagraph: thePara })
  } else {
    logWarn('doRescheduleItem', `- some other failure`)
    return handlerResult(false)
  }
}
