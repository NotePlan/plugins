// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions for 'move all' actions for Weeks.
// Last updated 2025-04-09 for v2.2.0.a12
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { WEBVIEW_WINDOW_ID } from './constants'
import { getOpenItemParasForTimePeriod, getDashboardSettings } from './dashboardHelpers'
import { type MessageDataObject, type TBridgeClickHandlerResult } from './types'
import { clo, JSP, logDebug, logError, logInfo, logWarn, logTimer } from '@helpers/dev'
import {
  calcOffsetDateStr,
  getNPWeekStr,
  replaceArrowDatesInString,
} from '@helpers/dateTime'
import { getGlobalSharedData, sendToHTMLWindow } from '@helpers/HTMLView'
import {
  moveItemBetweenCalendarNotes,
} from '@helpers/NPMoveItems'
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
export async function scheduleAllThisWeekNextWeek(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {
    let numberScheduled = 0
    const config = await getDashboardSettings()
    const thisStartTime = new Date()
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)

    // If called with modifierKey 'meta', then toggle from usual config.rescheduleNotMove behaviour to the opposite
    const rescheduleNotMove = data.modifierKey === 'meta' ? !config.rescheduleNotMove : config.rescheduleNotMove
    if (config.rescheduleNotMove !== rescheduleNotMove) logDebug('scheduleAllThisWeekNextWeek', `starting with rescheduleNotMove setting overridden toggled to ${String(rescheduleNotMove)}`)

    // Get paras for all open items in yesterday's note
    const thisWeekDateStr = getNPWeekStr(today)
    const thisWeekNote = DataStore.calendarNoteByDate(today, 'week')
    const nextWeekDateStr = calcOffsetDateStr(thisWeekDateStr, '1w')
    const nextWeekNote = DataStore.calendarNoteByDateString(nextWeekDateStr)

    if (!thisWeekNote) {
      logWarn('scheduleAllThisWeekNextWeek', `Oddly I can't find a weekly note for today (${thisWeekDateStr})`)
      return { success: false }
    }
    if (!nextWeekNote) {
      logWarn('scheduleAllThisWeekNextWeek', `I can't get next week's weekly note (${nextWeekDateStr}). Does it exist yet?`)
      return { success: false }
    }
    logDebug('scheduleAllThisWeekNextWeek', `Starting with this week's note (${thisWeekDateStr}) -> (${nextWeekDateStr})`)

    // Get list of open tasks/checklists from this calendar note
    // First, override one config item so we can work on separate dated vs scheduled items
    config.separateSectionForReferencedNotes = true
    const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForTimePeriod(thisWeekNote.filename, 'week', config)
    const initialTotalToMove = combinedSortedParas.length + sortedRefParas.length

    // Remove child items from the two lists of paras
    const combinedSortedParasWithoutChildren = combinedSortedParas.filter((dp) => !dp.isAChild)
    const sortedRefParasWithoutChildren = sortedRefParas.filter((dp) => !dp.isAChild)
    const totalToMove = combinedSortedParasWithoutChildren.length + sortedRefParasWithoutChildren.length
    if (totalToMove !== initialTotalToMove) {
      logDebug('scheduleAllThisWeekNextWeek', `- Excluding children reduced total to move from ${initialTotalToMove} to ${totalToMove}`)
    }

    // If there are lots, then double check whether to proceed.
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
    if (combinedSortedParasWithoutChildren.length > 0) {
      reactWindowData.pluginData.refreshing = ['W']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for section ['W']`)

      if (config.rescheduleNotMove) {
        // For each para append ' >' and next week's ISO date
        for (const dashboardPara of combinedSortedParasWithoutChildren) {
          c++
          logDebug('scheduleAllThisWeekNextWeek', `- Scheduling item ${c}/${totalToMove} "${dashboardPara.content}" to next week`)
          // Convert each reduced para back to the full one to update
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p) {
            p.content = replaceArrowDatesInString(p.content, `>${nextWeekDateStr}`)
            if (p.note) {
              p.note.updateParagraph(p)
              // $FlowIgnore[incompatible-call] test above is still valid
              DataStore.updateCache(p.note, false)
            }
            numberScheduled++
          }
        }
        logDebug('scheduleAllThisWeekNextWeek', `scheduled ${String(numberScheduled)} open items from this week's note`)
      } else {
        // For each para move to next week's note
        for (const para of combinedSortedParasWithoutChildren) {
          c++
          logDebug('scheduleAllThisWeekNextWeek', `- Moving item ${c}/${totalToMove} "${para.content}" to next week`)
          const res = await moveItemBetweenCalendarNotes(thisWeekDateStr, nextWeekDateStr, para.rawContent, config.newTaskSectionHeading, config.newTaskSectionHeadingLevel)
          if (res) {
            // logDebug('scheduleAllThisWeekNextWeek', `-> appeared to move item succesfully`)
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
    if (sortedRefParasWithoutChildren.length > 0) {
      reactWindowData.pluginData.refreshing = ['W']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ['W']`)

      // For each para append ' >YYYY-Wnn'
      for (const dashboardPara of sortedRefParasWithoutChildren) {
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
            logDebug('scheduleAllThisWeekNextWeek', `- Scheduling referenced para ${c}/${totalToMove} from note ${thisNote.filename} with new content "${p.content}"`)
            thisNote.updateParagraph(p)
            numberScheduled++
          } else {
            logWarn('scheduleAllThisWeekNextWeek', `Couldn't find para matching "${dashboardPara.content}"`)
          }
          // Update cache to allow it to be re-read on refresh
          DataStore.updateCache(thisNote, false)
        }
      }
      logTimer('scheduleAllThisWeekNextWeek', thisStartTime, `scheduled ${String(numberScheduled)} open items from this week to next week`)
    }

    // remove progress indicator
    reactWindowData.pluginData.refreshing = false
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `scheduleAllThisWeekNextWeek week finished `)

    // Update display of this section
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
export async function scheduleAllLastWeekThisWeek(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {
    let numberScheduled = 0
    const config = await getDashboardSettings()
    const thisStartTime = new Date()
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)

    // If called with modifierKey 'meta', then toggle from usual config.rescheduleNotMove behaviour to the opposite
    const rescheduleNotMove = data.modifierKey === 'meta' ? !config.rescheduleNotMove : config.rescheduleNotMove
    if (config.rescheduleNotMove !== rescheduleNotMove) logDebug('scheduleAllLastWeekThisWeek', `starting with rescheduleNotMove setting overridden toggled to ${String(rescheduleNotMove)}`)

    // Get paras for all open items in yesterday's note
    const thisWeekDateStr = getNPWeekStr(today)
    const thisWeekNote = DataStore.calendarNoteByDate(today, 'week')
    const lastWeekDateStr = calcOffsetDateStr(thisWeekDateStr, '-1w')
    const lastWeekNote = DataStore.calendarNoteByDateString(lastWeekDateStr)
    if (!lastWeekNote) {
      logWarn('scheduleAllLastWeekThisWeek', `Oddly I can't find last week's weekly note for today (${lastWeekDateStr})`)
      return { success: false }
    }
    if (!thisWeekNote) {
      logWarn('scheduleAllLastWeekThisWeek', `I can't get this week's weekly note (${thisWeekDateStr}). Does it exist yet?`)
      return { success: false }
    }
    logDebug('scheduleAllLastWeekThisWeek', `Starting for last week's note (${lastWeekDateStr} -> ${thisWeekDateStr}`)

    // Get list of open tasks/checklists from this calendar note
    // First, override one config item so we can work on separate dated vs scheduled items
    config.separateSectionForReferencedNotes = true
    const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForTimePeriod(lastWeekNote.filename, 'week', config)
    const initialTotalToMove = combinedSortedParas.length + sortedRefParas.length
    // Remove child items from the two lists of paras
    const combinedSortedParasWithoutChildren = combinedSortedParas.filter((dp) => !dp.isAChild)
    const sortedRefParasWithoutChildren = sortedRefParas.filter((dp) => !dp.isAChild)
    const totalToMove = combinedSortedParasWithoutChildren.length + sortedRefParasWithoutChildren.length
    if (totalToMove !== initialTotalToMove) {
      logDebug('scheduleAllLastWeekThisWeek', `- Excluding children reduced total to move from ${initialTotalToMove} to ${totalToMove}`)
    }


    // If there are lots, then double check whether to proceed.
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
    if (combinedSortedParasWithoutChildren.length > 0) {
      reactWindowData.pluginData.refreshing = ['W']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for section [LW']`)

      if (config.rescheduleNotMove) {
        // For each para append ' >' and this week's ISO date
        for (const dashboardPara of combinedSortedParasWithoutChildren) {
          c++
          logDebug('scheduleAllLastWeekThisWeek', `- Scheduling item ${c}/${totalToMove} "${dashboardPara.content}" to this week`)
          // Convert each reduced para back to the full one to update
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p && p.note) {
            p.content = replaceArrowDatesInString(p.content, `>${thisWeekDateStr}`)
            // $FlowIgnore[incompatible-use]
            p.note.updateParagraph(p)
            // $FlowIgnore[incompatible-call] test above is still valid
            DataStore.updateCache(p.note, false)
            numberScheduled++
          }
        }
        logDebug('scheduleAllLastWeekThisWeek', `scheduled ${String(numberScheduled)} open items from last week's note`)
      } else {
        // For each para move to this week's note
        for (const para of combinedSortedParasWithoutChildren) {
          c++
          logDebug('scheduleAllLastWeekThisWeek', `- Moving item ${c}/${totalToMove} "${para.content}" to this week`)
          const res = await moveItemBetweenCalendarNotes(lastWeekDateStr, thisWeekDateStr, para.rawContent, config.newTaskSectionHeading, config.newTaskSectionHeadingLevel)
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
    clo(sortedRefParasWithoutChildren, `scheduleAllLastWeekThisWeek: sortedRefParasWithoutChildren`)

    if (sortedRefParasWithoutChildren.length > 0) {
      reactWindowData.pluginData.refreshing = ['W']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for section ['LW']`)

      // For each para append ' >YYYY-Wnn'
      for (const dashboardPara of sortedRefParasWithoutChildren) {
        c++
        const thisNote = DataStore.noteByFilename(dashboardPara.filename, dashboardPara.noteType)
        if (!thisNote) {
          logWarn('scheduleAllLastWeekThisWeek', `Oddly I can't find the note for "${dashboardPara.content}", so can't process this item`)
        } else {
          // Convert each reduced para back to the full one to update.
          // FIXME: fails because indents is 0 not 1
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p && p.note) {
            p.content = replaceArrowDatesInString(p.content, `>${thisWeekDateStr}`)
            logDebug('scheduleAllLastWeekThisWeek', `- Scheduling referenced para ${c}/${totalToMove} from note ${thisNote.filename} with new content "${p.content}"`)
            thisNote.updateParagraph(p)
            // Update cache to allow it to be re-read on refresh
            DataStore.updateCache(thisNote, false)
            numberScheduled++
          } else {
            logWarn('scheduleAllLastWeekThisWeek', `Couldn't find para matching "${dashboardPara.content}"`)
            clo(dashboardPara, `scheduleAllLastWeekThisWeek: dashboardPara`)
          }
        }
      }
      logTimer('scheduleAllLastWeekThisWeek', thisStartTime, `scheduled ${String(numberScheduled)} open items from last week to this week`)
    } else {
      // logDebug('scheduleAllLastWeekThisWeek', `- No ref paras for last week found`)
    }

    // remove progress indicator
    reactWindowData.pluginData.refreshing = false
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `scheduleAllLastWeekThisWeek week finished `)

    // Update display of these 2 sections
    return { success: true, actionsOnSuccess: ['REFRESH_SECTION_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], sectionCodes: ['LW', 'W'] }
  } catch (error) {
    logError('scheduleAllLastWeekThisWeek', error.message)
    return { success: false }
  }
}
