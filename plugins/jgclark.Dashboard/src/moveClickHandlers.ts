// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions that need to refresh Dashboard
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { WEBVIEW_WINDOW_ID } from './constants'
import { getOpenItemParasForTimePeriod, getRelevantOverdueTasks, getDashboardSettings, moveItemBetweenCalendarNotes, handlerResult } from './dashboardHelpers'
import { validateAndFlattenMessageObject } from './shared'
import { type MessageDataObject, type TBridgeClickHandlerResult } from './types'
import { clo, JSP, logDebug, logError, logInfo, logWarn, logTimer } from '@np/helpers/dev'
import {
  calcOffsetDateStr,
  getDateStringFromCalendarFilename,
  getTodaysDateHyphenated,
  getTodaysDateUnhyphenated,
  RE_DATE,
  RE_DATE_INTERVAL,
  RE_NP_WEEK_SPEC,
  replaceArrowDatesInString,
} from '@np/helpers/dateTime'
import { getGlobalSharedData, sendToHTMLWindow } from '@np/helpers/HTMLView'
import { getNPWeekData } from '@np/helpers/NPdateTime'
import { getParagraphFromStaticObject } from '@np/helpers/NPParagraph'

//-----------------------------------------------------------------
// constants

const checkThreshold = 20 // number beyond which to check with user whether to proceed

//-----------------------------------------------------------------

/**
 * Move an item from one calendar note to a different one.
 * The date to move to is indicated by controlStr, which is a relative date.
 * TODO: Extend to move sub-items as well, if wanted.
 * Note: is similar but different to dashboardHelpers::moveItemBetweenCalendarNotes().
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
        logDebug('moveFromCalToCal', `- used NPWeekData instead -> ${newDateStr}`)
      } else {
        throw new Error(`Can't get NPWeekData for '${String(offsetNum)}w' when moving task from ${filename} (${startDateStr})`)
      }
    }
  } else if (dateOrInterval.match(RE_DATE)) {
    newDateStr = controlStr
  } else {
    logError('moveFromCalToCal', `bad move date/interval: ${dateOrInterval}`)
    return handlerResult(false)
  }
  logDebug('moveFromCalToCal', `move task from ${startDateStr} -> ${newDateStr}`)

    // Do the actual move 
  const res = await moveItemBetweenCalendarNotes(startDateStr, newDateStr, content, config.newTaskSectionHeading ?? '')

  if (res) {
    logDebug('moveFromCalToCal', `-> appeared to move item succesfully`)
    // Send a message to update all the calendar sections (as its too hard to work out which of the sections to update)
    return handlerResult(true, ['REFRESH_ALL_CALENDAR_SECTIONS', 'START_DELAYED_REFRESH_TIMER'])
  } else {
    logWarn('moveFromCalToCal', `-> moveFromCalToCal to ${newDateStr} not successful`)
    return handlerResult(false)
  }
  } catch (error) {
    logError('moveFromCalToCal', JSP(error))
    return { success: false }
  }
}
