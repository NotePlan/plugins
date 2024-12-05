// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions for 'move all' actions for Weeks.
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
// import pluginJson from '../plugin.json'
import { WEBVIEW_WINDOW_ID } from './constants'
import { getOpenItemParasForTimePeriod, getRelevantOverdueTasks, getDashboardSettings, moveItemBetweenCalendarNotes, handlerResult } from './dashboardHelpers'
import { validateAndFlattenMessageObject } from './shared'
import { type MessageDataObject, type TBridgeClickHandlerResult } from './types'
import { clo, JSP, logDebug, logError, logInfo, logWarn, logTimer } from '@helpers/dev'
import {
  calcOffsetDateStr,
  getDateStringFromCalendarFilename,
  getNPWeekStr,
  getTodaysDateHyphenated,
  getTodaysDateUnhyphenated,
  RE_DATE,
  RE_DATE_INTERVAL,
  RE_NP_WEEK_SPEC,
  replaceArrowDatesInString,
} from '@helpers/dateTime'
import { getGlobalSharedData, sendToHTMLWindow } from '@helpers/HTMLView'
import { getNPWeekData } from '@helpers/NPdateTime'
import { getParagraphFromStaticObject } from '@helpers/NPParagraph'
import { showMessageYesNo } from '@helpers/userInput'

//-----------------------------------------------------------------
// constants

const checkThreshold = 20 // number beyond which to check with user whether to proceed

//-----------------------------------------------------------------

/**
 * Function to schedule or move all open items from this week to next week.
 * Uses config setting 'rescheduleNotMove' to decide whether to reschedule or move.
 * @param {MessageDataObject} data
 * @returns {TBridgeClickHandlerResult}
 */
export async function scheduleAllThisWeekNextWeek(_data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {
    let numberScheduled = 0
    const config = await getDashboardSettings()
    // Override one config item so we can work on separate dated vs scheduled items
    config.separateSectionForReferencedNotes = true
    const thisStartTime = new Date()
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)

    // Get paras for all open items in yesterday's note
    // TODO: get this from reactWindowData.pluginData instead
    const thisWeekDateStr = getNPWeekStr(today)
    const nextWeekDateStr = calcOffsetDateStr(thisWeekDateStr, '1w')
    const thisWeekNote = DataStore.calendarNoteByDate(today, 'week')

    if (!thisWeekNote) {
      logWarn('scheduleAllThisWeekNextWeek', `Oddly I can't find a weekly note for today (${thisWeekDateStr})`)
      return { success: false }
    } else {
      logDebug('scheduleAllThisWeekNextWeek', `Starting with this week's note${thisWeekDateStr}`)
    }
    logDebug('scheduleAllThisWeekNextWeek', `Starting with this week's note ${thisWeekDateStr} -> ${nextWeekDateStr}`)

    //   Get list of open tasks/checklists from this calendar note
    const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForTimePeriod('week', thisWeekNote, config)
    const totalToMove = combinedSortedParas.length + sortedRefParas.length

    // If there are lots, then double check whether to proceed
    // TODO: get this from newer settings instead
    // Note: platform limitation: can't run CommandBar from HTMLView on iOS/iPadOS
    if (NotePlan.environment.platform === 'macOS' && totalToMove > checkThreshold) {
      const res = await showMessageYesNo(
        `Are you sure you want to ${config.rescheduleNotMove ? 'schedule' : 'move'} ${totalToMove} items to next week?`,
        ['Yes', 'No'],
        'Move This Week to Next Week',
        false,
      )
      if (res !== 'Yes') {
        logDebug('scheduleAllThisWeekNextWeek', 'User cancelled operation.')
        return { success: false }
      }
    }

    let c = 0
    if (combinedSortedParas.length > 0) {
      reactWindowData.pluginData.refreshing = ['W']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for section ['W']`)

      if (config.rescheduleNotMove) {
        // For each para append ' >' and next week's ISO date
        for (const dashboardPara of combinedSortedParas) {
          c++
          logDebug('scheduleAllThisWeekNextWeek', `- scheduling "${dashboardPara.content}" to next week`)
          // Convert each reduced para back to the full one to update
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p) {
            p.content = replaceArrowDatesInString(p.content, `>${nextWeekDateStr}`)
            p.note?.updateParagraph(p)
            DataStore.updateCache(p.note, false)
            numberScheduled++
          }
        }
        logDebug('scheduleAllThisWeekNextWeek', `scheduled ${String(numberScheduled)} open items from this week's note`)
      } else {
        // For each para move to next week's note
        for (const para of combinedSortedParas) {
          logDebug('scheduleAllThisWeekNextWeek', `- moving "${para.content}" to next week`)
          c++
          const res = await moveItemBetweenCalendarNotes(thisWeekDateStr, nextWeekDateStr, para.content, config.newTaskSectionHeading ?? '')
          if (res) {
            logDebug('scheduleAllThisWeekNextWeek', `-> appeared to move item succesfully`)
            numberScheduled++
          } else {
            logWarn('scheduleAllThisWeekNextWeek', `-> moveFromCalToCal from {this weekDateStr} to ${nextWeekDateStr} not successful`)
          }
        }
        logTimer('scheduleAllThisWeekNextWeek', thisStartTime, `moved ${String(numberScheduled)} open items from this week to next week's note`)
        // Update cache to allow it to be re-read on refresh
        DataStore.updateCache(thisWeekNote, false)
      }
    }

    // Now do the same for items scheduled to this week from other notes
    if (sortedRefParas.length > 0) {
      reactWindowData.pluginData.refreshing = ['W']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ['W']`)

      // For each para append ' >YYYY-Wnn'
      for (const dashboardPara of sortedRefParas) {
        c++
        // CommandBar.showLoading(true, `Scheduling item ${c} to tomorrow`, c / totalToMove)
        const thisNote = DataStore.noteByFilename(dashboardPara.filename, dashboardPara.noteType)
        if (!thisNote) {
          logWarn('scheduleAllThisWeekNextWeek', `Oddly I can't find the note for "${dashboardPara.content}", so can't process this item`)
        } else {
          // Convert each reduced para back to the full one to update.
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p) {
            p.content = replaceArrowDatesInString(p.content, `>${nextWeekDateStr}`)
            logDebug('scheduleAllThisWeekNextWeek', `- scheduling referenced para "${p.content}" from note ${thisNote.filename}`)
            thisNote.updateParagraph(p)
          } else {
            logWarn('scheduleAllYesterdayOpenToThis week', `Couldn't find para matching "${dashboardPara.content}"`)
          }

          numberScheduled++
          // Update cache to allow it to be re-read on refresh
          DataStore.updateCache(thisNote, false)
        }
      }
      logDebug('scheduleAllThisWeekNextWeek', `-> scheduled ${String(numberScheduled)} open items from this week to tomorrow`)
    }

    // remove progress indicator
    reactWindowData.pluginData.refreshing = false
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `scheduleAllThisWeekNextWeek week finished `)

    // Update display of these 2 sections
    logDebug('scheduleAllThisWeekNextWeek', `returning {true, REFRESH_SECTION_IN_JSON, [W]}`)
    return { success: true, actionsOnSuccess: ['REFRESH_SECTION_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], sectionCodes: ['W'] }
  } catch (error) {
    logError('scheduleAllThisWeekNextWeek', error.message)
    return { success: false }
  }
}

/**
 * Function to schedule or move all open items from last week to this week.
 * Uses config setting 'rescheduleNotMove' to decide whether to reschedule or move.
 * @param {MessageDataObject} data
 * @returns {TBridgeClickHandlerResult}
 */
export async function scheduleAllLastWeekThisWeek(_data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {
    let numberScheduled = 0
    const config = await getDashboardSettings()
    // Override one config item so we can work on separate dated vs scheduled items
    config.separateSectionForReferencedNotes = true
    const thisStartTime = new Date()
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)

    // Get paras for all open items in yesterday's note
    // TODO: get this from reactWindowData.pluginData instead
    const thisWeekDateStr = getNPWeekStr(today)
    const thisWeekNote = DataStore.calendarNoteByDate(today, 'week')
    const lastWeekDateStr = calcOffsetDateStr(thisWeekDateStr, '-1w')
    const lastWeekNote = DataStore.calendarNoteByDateString(lastWeekDateStr)

    if (!lastWeekNote) {
      logWarn('scheduleAllLastWeekThisWeek', `Oddly I can't find a weekly note for today (${lastWeekDateStr})`)
      return { success: false }
    } else {
      logDebug('scheduleAllLastWeekThisWeek', `Starting with last week's note${lastWeekDateStr}`)
    }
    logDebug('scheduleAllLastWeekThisWeek', `Starting with last week's note ${lastWeekDateStr} -> ${thisWeekDateStr}`)

    // Get list of open tasks/checklists from this calendar note
    const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForTimePeriod('week', lastWeekNote, config)
    const totalToMove = combinedSortedParas.length + sortedRefParas.length

    // If there are lots, then double check whether to proceed
    // TODO: get this from newer settings instead
    // Note: platform limitation: can't run CommandBar from HTMLView on iOS/iPadOS
    if (NotePlan.environment.platform === 'macOS' && totalToMove > checkThreshold) {
      const res = await showMessageYesNo(
        `Are you sure you want to ${config.rescheduleNotMove ? 'schedule' : 'move'} ${totalToMove} items to this week?`,
        ['Yes', 'No'],
        'Move This Week to Next Week',
        false,
      )
      if (res !== 'Yes') {
        logDebug('scheduleAllLastWeekThisWeek', 'User cancelled operation.')
        return { success: false }
      }
    }

    let c = 0
    if (combinedSortedParas.length > 0) {
      reactWindowData.pluginData.refreshing = ['W']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for section ['W']`)

      if (config.rescheduleNotMove) {
        // For each para append ' >' and this week's ISO date
        for (const dashboardPara of combinedSortedParas) {
          c++
          logDebug('scheduleAllLastWeekThisWeek', `- scheduling "${dashboardPara.content}" to this week`)
          // Convert each reduced para back to the full one to update
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p) {
            p.content = replaceArrowDatesInString(p.content, `>${thisWeekDateStr}`)
            p.note?.updateParagraph(p)
            DataStore.updateCache(p.note, false)
            numberScheduled++
          }
        }
        logDebug('scheduleAllLastWeekThisWeek', `scheduled ${String(numberScheduled)} open items from last week's note`)
      } else {
        // For each para move to this week's note
        for (const para of combinedSortedParas) {
          logDebug('scheduleAllLastWeekThisWeek', `- moving "${para.content}" to this week`)
          c++
          const res = await moveItemBetweenCalendarNotes(lastWeekDateStr, thisWeekDateStr, para.content, config.newTaskSectionHeading ?? '')
          if (res) {
            logDebug('scheduleAllLastWeekThisWeek', `-> appeared to move item succesfully`)
            numberScheduled++
          } else {
            logWarn('scheduleAllLastWeekThisWeek', `-> moveFromCalToCal from ${lastWeekDateStr} to ${thisWeekDateStr} not successful`)
          }
        }
        logTimer('scheduleAllLastWeekThisWeek', thisStartTime, `moved ${String(numberScheduled)} open items from last week to this week's note`)
        // Update cache to allow it to be re-read on refresh
        DataStore.updateCache(thisWeekNote, false)
      }
    }

    // Now do the same for items scheduled to last week from other notes
    if (sortedRefParas.length > 0) {
      reactWindowData.pluginData.refreshing = ['W']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ['W']`)

      // For each para append ' >YYYY-Wnn'
      for (const dashboardPara of sortedRefParas) {
        c++
        // CommandBar.showLoading(true, `Scheduling item ${c} to tomorrow`, c / totalToMove)
        const thisNote = DataStore.noteByFilename(dashboardPara.filename, dashboardPara.noteType)
        if (!thisNote) {
          logWarn('scheduleAllLastWeekThisWeek', `Oddly I can't find the note for "${dashboardPara.content}", so can't process this item`)
        } else {
          // Convert each reduced para back to the full one to update.
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p) {
            p.content = replaceArrowDatesInString(p.content, `>${thisWeekDateStr}`)
            logDebug('scheduleAllLastWeekThisWeek', `- scheduling referenced para "${p.content}" from note ${thisNote.filename}`)
            thisNote.updateParagraph(p)
          } else {
            logWarn('scheduleAllYesterdayOpenToThis week', `Couldn't find para matching "${dashboardPara.content}"`)
          }

          numberScheduled++
          // Update cache to allow it to be re-read on refresh
          DataStore.updateCache(thisNote, false)
        }
      }
      logDebug('scheduleAllLastWeekThisWeek', `-> scheduled ${String(numberScheduled)} open items from last week to tomorrow`)
    }

    // remove progress indicator
    reactWindowData.pluginData.refreshing = false
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `scheduleAllLastWeekThisWeek week finished `)

    // Update display of these 2 sections
    logDebug('scheduleAllLastWeekThisWeek', `returning {true, REFRESH_SECTION_IN_JSON, [W]}`)
    return { success: true, actionsOnSuccess: ['REFRESH_SECTION_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], sectionCodes: ['W'] }
  } catch (error) {
    logError('scheduleAllLastWeekThisWeek', error.message)
    return { success: false }
  }
}
