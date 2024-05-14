// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions that need to refresh Dashboard
// Last updated 14.5.2024 for v2.0.0 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  getOpenItemParasForCurrentTimePeriod,
  getRelevantOverdueTasks,
  getSettings,
  moveItemBetweenCalendarNotes,
} from './dashboardHelpers'
// import { showDashboardReact } from './reactMain'
import {
  type TBridgeClickHandlerResult, type MessageDataObject,
} from './types'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import {
  getDateStringFromCalendarFilename,
  getTodaysDateHyphenated,
  getTodaysDateUnhyphenated,
  removeDateTagsAndToday,
} from '@helpers/dateTime'
import { getParagraphFromStaticObject } from '@helpers/NPParagraph'
import { getGlobalSharedData, sendToHTMLWindow } from '@helpers/HTMLView'
import { showMessageYesNo } from '@helpers/userInput'

//-----------------------------------------------------------------
// constants

const checkThreshold = 20 // number beyond which to check with user whether to proceed
const WEBVIEW_WINDOW_ID = `${pluginJson['plugin.id']}.main`

//-----------------------------------------------------------------
/**
 * Function to schedule or move all open items from yesterday to today
 * Uses config setting 'rescheduleNotMove' to decide whether to reschedule or move.
 * @param {MessageDataObject} data
 * @returns {TBridgeClickHandlerResult}
 */
export async function scheduleAllYesterdayOpenToToday(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {
    let numberScheduled = 0
    const config = await getSettings()
    // For these purposes override one config item:
    config.separateSectionForReferencedNotes = true
    const thisStartTime = new Date()
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)

    // Get paras for all open items in yesterday's note
    // TODO: get this from reactWindowData.pluginData instead
    const yesterdayDateStr = new moment().subtract(1, 'days').format('YYYYMMDD')
    const todayDateStr = getTodaysDateHyphenated()
    const yesterdaysNote = DataStore.calendarNoteByDateString(yesterdayDateStr)
    if (!yesterdaysNote) {
      logWarn('scheduleAllYesterdayOpenToToday', `Oddly I can't find a daily note for yesterday ${yesterdayDateStr}`)
      return { success: false }
    } else {
      logDebug('scheduleAllYesterdayOpenToToday', `Starting with yesterday's note: ${yesterdayDateStr}`)
    }

    // Get list of open tasks/checklists from this calendar note
    const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForCurrentTimePeriod("day", yesterdaysNote, config)
    const totalToMove = combinedSortedParas.length + sortedRefParas.length

    // If there are lots, then double check whether to proceed
    // TODO: get this from newer settings instead
    if (totalToMove > checkThreshold) {
      const res = await showMessageYesNo(`Are you sure you want to ${config.rescheduleNotMove ? 'schedule' : 'move'} ${totalToMove} items to today?`, ['Yes', 'No'], 'Move Yesterday to Today', false)
      if (res !== 'Yes') {
        logDebug('scheduleAllYesterdayOpenToToday', 'User cancelled operation.')
        return { success: false }
      }
    }

    let c = 0
    if (combinedSortedParas.length > 0) {
      // TODO: start a progress indicator
      reactWindowData.pluginData.refreshing = ['DT', 'DY']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(['DT', 'DY'])}`)

      if (config.rescheduleNotMove) {
        // Determine if we need to use 'today' or schedule to the specific date.
        logDebug('scheduleAllYesterdayOpenToToday', `useTodayDate setting is ${config.useTodayDate}`)
        const newDateStr = config.useTodayDate ? 'today' : getTodaysDateHyphenated()
        // For each para append ' >today'
        for (const dashboardPara of combinedSortedParas) {
          c++
          // CommandBar.showLoading(true, `Scheduling item ${c} to ${newDateStr}`, c / totalToMove)
          logDebug('scheduleAllYesterdayOpenToToday', `- scheduling {${dashboardPara.content}} to ${newDateStr}`)
          dashboardPara.content = `${dashboardPara.content} >${newDateStr}`
          // Convert each reduced para back to the full one to update
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p) yesterdaysNote.updateParagraph(p)
          numberScheduled++
        }

        logDebug('scheduleAllYesterdayOpenToToday', `scheduled ${String(numberScheduled)} open items from yesterday's note to today's`)
      } else {
        // For each para move to today's note
        for (const para of combinedSortedParas) {
          logDebug('scheduleAllYesterdayOpenToToday', `- moving {${para.content}} to today`)
          c++
          // CommandBar.showLoading(true, `Moving item ${c} to today`, c / totalToMove)
          logDebug('scheduleAllYesterdayOpenToToday', `Moving item ${c} to today`)
          const res = await moveItemBetweenCalendarNotes(yesterdayDateStr, todayDateStr, para.content, config.newTaskSectionHeading ?? '')
          if (res) {
            logDebug('scheduleAllYesterdayOpenToToday', `-> appeared to move item succesfully`)
            numberScheduled++
          } else {
            logWarn('scheduleAllYesterdayOpenToToday', `-> moveFromCalToCal from {yesterdayDateStr} to ${todayDateStr} not successful`)
          }
        }
        logDebug('scheduleAllYesterdayOpenToToday', `moved ${String(numberScheduled)} open items from yesterday's note to today's`)
        // TEST: Update cache to allow it to be re-read on refresh
        DataStore.updateCache(yesterdaysNote)
      }
    }

    // Now do the same for items scheduled to yesterday from other notes
    if (sortedRefParas.length > 0) {
      reactWindowData.pluginData.refreshing = ['DT', 'DY']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(['DT', 'DY'])}`)

      // Determine if we need to use 'today' or schedule to the specific date.
      logDebug('scheduleAllYesterdayOpenToToday', `useTodayDate setting is ${config.useTodayDate}`)
      const newDateStr = config.useTodayDate ? 'today' : getTodaysDateHyphenated()
      // For each para append the date to move to.
      for (const dashboardPara of sortedRefParas) {
        c++
        // CommandBar.showLoading(true, `Scheduling item ${c} to ${newDateStr}`, c / totalToMove)
        const thisNote = DataStore.noteByFilename(dashboardPara.filename, dashboardPara.noteType)
        if (!thisNote) {
          logWarn('scheduleAllYesterdayOpenToToday', `Oddly I can't find the note for {${dashboardPara.content}}, so can't process this item`)
        } else {
          dashboardPara.content = `${removeDateTagsAndToday(dashboardPara.content)} >${newDateStr}`
          logDebug('scheduleAllYesterdayOpenToToday', `- scheduling referenced dashboardPara from note ${thisNote.filename} with new content {${dashboardPara.content}} `)
          // Convert each reduced para back to the full one to update.
          // FIXME: doesn't work
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p) thisNote.updateParagraph(p)
          numberScheduled++
          // TEST:
          DataStore.updateCache(thisNote)
        }
      }
      logDebug('scheduleAllYesterdayOpenToToday', `-> scheduled ${String(numberScheduled)} open items from yesterday in project notes to today (in ${timer(thisStartTime)})`)
    }
    // remove progress indicator
    reactWindowData.pluginData.refreshing = false
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `scheduleAllYesterdayOpenToToday finished `)

    // FIXME: processActionOnReturn doesn't have filename in its data:
    //   processActionOnReturn(handlerResult: TBridgeClickHandlerResult, data: MessageDataObject)
    return { success: true, actionsOnSuccess: ['REFRESH_SECTION_IN_JSON'], sectionCodes: ['DY', 'DT'] }
  }
  catch (error) {
    logError('scheduleAllYesterdayOpenToToday', JSP(error))
    return { success: false }
  }
}

/**
 * Function to schedule or move all open items from today to tomorrow
 * Uses config setting 'rescheduleNotMove' to decide whether to reschedule or move.
 * @param {MessageDataObject} data
 * @returns {TBridgeClickHandlerResult}
 */
export async function scheduleAllTodayTomorrow(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {

    let numberScheduled = 0
    const config = await getSettings()
    // For these purposes override one config item:
    config.separateSectionForReferencedNotes = true
    const thisStartTime = new Date()
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)

    // Get paras for all open items in yesterday's note
    // TODO: get this from reactWindowData.pluginData instead
    const todayDateStr = getTodaysDateUnhyphenated()
    const tomorrowDateStr = new moment().add(1, 'days').format('YYYYMMDD')
    const tomorrowISODateStr = new moment().add(1, 'days').format('YYYY-MM-DD')
    const todaysNote = DataStore.calendarNoteByDateString(todayDateStr)
    if (!todaysNote) {
      logWarn('scheduleAllTodayTomorrow', `Oddly I can't find a daily note for today (${todayDateStr})`)
      return { success: false }
    } else {
      logDebug('scheduleAllTodayTomorrow', `Starting with today's note${todayDateStr}`)
    }

    // Get list of open tasks/checklists from this calendar note
    const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForCurrentTimePeriod("day", todaysNote, config)
    const totalToMove = combinedSortedParas.length + sortedRefParas.length

    // If there are lots, then double check whether to proceed
    // TODO: get this from newer settings instead
    if (totalToMove > checkThreshold) {
      const res = await showMessageYesNo(`Are you sure you want to ${config.rescheduleNotMove ? 'schedule' : 'nove'} ${totalToMove} items to tomorrow?`, ['Yes', 'No'], 'Move Yesterday to Today', false)
      if (res !== 'Yes') {
        logDebug('scheduleAllTodayTomorrow', 'User cancelled operation.')
        return { success: false }
      }
    }

    let c = 0
    if (combinedSortedParas.length > 0) {
      // TODO: start a progress indicator
      reactWindowData.pluginData.refreshing = ['DT', 'DO']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(['DT', 'DO'])}`)

      if (config.rescheduleNotMove) {
        // For each para append ' >' and tomorrow's ISO date
        for (const dashboardPara of combinedSortedParas) {
          c++
          // CommandBar.showLoading(true, `Scheduling item ${c} to tomorrow`, c / totalToMove)
          logDebug('scheduleAllTodayTomorrow', `- scheduling {${dashboardPara.content}} to tomorrow`)
          dashboardPara.content = `${dashboardPara.content} >${tomorrowISODateStr}`
          // Convert each reduced para back to the full one to update
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p) todaysNote.updateParagraph(p)
          numberScheduled++
        }
        logDebug('scheduleAllTodayTomorrow', `scheduled ${String(numberScheduled)} open items from today's note`)
      } else {
        // For each para move to tomorrow's note
        for (const para of combinedSortedParas) {
          logDebug('scheduleAllTodayTomorrow', `- moving {${para.content}} to tomorrow`)
          c++
          // CommandBar.showLoading(true, `Moving item ${c} to tomorrow`, c / totalToMove)
          const res = await moveItemBetweenCalendarNotes(todayDateStr, tomorrowDateStr, para.content, config.newTaskSectionHeading ?? '')
          if (res) {
            // logDebug('scheduleAllTodayTomorrow', `-> appeared to move item succesfully`)
            numberScheduled++
          } else {
            logWarn('scheduleAllTodayTomorrow', `-> moveFromCalToCal from {todayDateStr} to ${tomorrowDateStr} not successful`)
          }
        }
        logDebug('scheduleAllTodayTomorrow', `moved ${String(numberScheduled)} open items from today to tomorrow's note (in ${timer(thisStartTime)})`)
        // Update cache to allow it to be re-read on refresh
        DataStore.updateCache(todaysNote)
      }
    }

    // Now do the same for items scheduled to today from other notes
    if (sortedRefParas.length > 0) {
      reactWindowData.pluginData.refreshing = ['DT', 'DO']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(['DT', 'DO'])}`)

      // For each para append ' >tomorrow'
      for (const dashboardPara of sortedRefParas) {
        c++
        // CommandBar.showLoading(true, `Scheduling item ${c} to tomorrow`, c / totalToMove)
        const thisNote = DataStore.noteByFilename(dashboardPara.filename, dashboardPara.noteType)
        if (!thisNote) {
          logWarn('scheduleAllTodayTomorrow', `Oddly I can't find the note for {${dashboardPara.content}}, so can't process this item`)
        } else {
          dashboardPara.content = `${removeDateTagsAndToday(dashboardPara.content)} >${tomorrowISODateStr}`
          logDebug('scheduleAllTodayTomorrow', `- scheduling referenced para {${dashboardPara.content}} from note ${thisNote.filename}`)
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p) thisNote.updateParagraph(p)
          numberScheduled++
          // Note: Whether this is used seems not to make any difference
          DataStore.updateCache(thisNote)
        }
      }
      logDebug('scheduleAllTodayTomorrow', `-> scheduled ${String(numberScheduled)} open items from today to tomorrow`)
    }

    // remove progress indicator
    reactWindowData.pluginData.refreshing = false
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `scheduleAllYesterdayOpenToToday finished `)

    return { success: true, actionsOnSuccess: ['REFRESH_SECTION_IN_JSON'], sectionCodes: ['DT', 'DO'] }

  }
  catch (error) {
    logError('dashboard / scheduleAllTodayTomorrow', error.message)
    return { success: false }
  }
}

//-----------------------------------------------------------------
/**
 * Function to schedule or move all open overdue tasks from their notes to today
 * Uses config setting 'rescheduleNotMove' to decide whether to reschedule or move.
 * Note: This uses an API call that doesn't include open checklist items
 * @param {MessageDataObject} data
 * @returns {TBridgeClickHandlerResult}
 */
export async function scheduleAllOverdueOpenToToday(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {
    let numberChanged = 0
    const config = await getSettings()
    // For these purposes override one config item:
    config.separateSectionForReferencedNotes = true
    const thisStartTime = new Date()
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)

    // Get paras for all overdue items in notes
    // Note: we need full TParagraphs, not ReducedParagraphs
    // Get list of open tasks/checklists from yesterday note
    const filenameDateStr = new moment().subtract(1, 'days').format('YYYYMMDD')
    const yesterdaysNote = DataStore.calendarNoteByDateString(filenameDateStr)
    if (!yesterdaysNote) {
      throw new Error(`Couldn't find yesterday's note, which shouldn't happen.`)
    }
    const [combinedSortedParas, sortedRefParas] = getOpenItemParasForCurrentTimePeriod("day", yesterdaysNote, config)
    const yesterdaysCombinedSortedParas = combinedSortedParas.concat(sortedRefParas)
    const overdueParas: Array<TParagraph> = await getRelevantOverdueTasks(config, yesterdaysCombinedSortedParas) // note: does not include open checklist items
    const totalOverdue = overdueParas.length
    if (totalOverdue === 0) {
      logWarn('scheduleAllYesterdayOpenToToday', `Can't find any overdue items, which was not expected.`)
      return { success: false }
    } else {
      logInfo('getDataForDashboard', `Found ${totalOverdue} overdue items to move to today (in ${timer(thisStartTime)})`)
    }

    const todayDateStr = getTodaysDateHyphenated()

    // If there are lots, then double check whether to proceed
    if (totalOverdue > checkThreshold) {
      const res = await showMessageYesNo(`Are you sure you want to ${config.rescheduleNotMove ? 'schedule' : 'nove'} ${totalOverdue} overdue items to today? This can be a slow operation, and can't easily be undone.`, ['Yes', 'No'], 'Move Overdue to Today', false)
      if (res !== 'Yes') {
        logDebug('scheduleAllOverdueOpenToToday', 'User cancelled operation.')
        return { success: false }
      }
    }

    let c = 0
    if (combinedSortedParas.length > 0) {
      // TODO: start a progress indicator
      reactWindowData.pluginData.refreshing = ['OVERDUE']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(['OVERDUE'])}`)

      if (config.rescheduleNotMove) {
        // Determine if we need to use 'today' or schedule to the specific date.
        logDebug('scheduleAllOverdueOpenToToday', `useTodayDate setting is ${config.useTodayDate}`)
        const newDateStr = config.useTodayDate ? 'today' : getTodaysDateHyphenated()
        // For each para append ' >today'
        for (const para of overdueParas) {
          c++
          const thisNote = para.note
          if (!thisNote) {
            logWarn('scheduleAllOverdueOpenToToday', `-> can't find note for overdue para {${para.content}}`)
            continue
          }
          // CommandBar.showLoading(true, `Scheduling item ${c} to ${newDateStr}`, c / totalOverdue)
          para.content = `${removeDateTagsAndToday(para.content)} >${newDateStr}`
          logDebug('scheduleAllOverdueOpenToToday', `- scheduling referenced para {${para.content}} from note ${para.filename ?? '?'}`)
          numberChanged++
          thisNote.updateParagraph(para)
          // TEST:  Update cache to allow it to be re-read on refresh
          DataStore.updateCache(thisNote)
        }
        logDebug('scheduleAllOverdueOpenToToday', `scheduled ${String(numberChanged)} overdue items to today's note (after ${timer(thisStartTime)})`)

      } else {
        // Determine if we need to use 'today' or schedule to the specific date.
        logDebug('scheduleAllOverdueOpenToToday', `useTodayDate setting is ${config.useTodayDate}`)
        const newDateStr = config.useTodayDate ? 'today' : getTodaysDateHyphenated()
        // For each para move to today's note
        for (const para of overdueParas) {
          logDebug('scheduleAllOverdueOpenToToday', `- moving {${para.content}} to ${newDateStr}`)
          c++
          // CommandBar.showLoading(true, `Moving item ${c} to ${newDateStr}`, c / totalOverdue)
          const thisNote = para.note
          if (!thisNote) {
            logWarn('scheduleAllOverdueOpenToToday', `-> can't find note for overdue para {${para.content}}`)
            continue
          }
          const thisNoteType = para.noteType
          if (thisNote && thisNoteType === 'Calendar') {
            const thisNoteDateStr = getDateStringFromCalendarFilename(thisNote.filename, true)
            const res = await moveItemBetweenCalendarNotes(thisNoteDateStr, todayDateStr, para.content, config.newTaskSectionHeading ?? '')
            if (res) {
              logDebug('scheduleAllOverdueOpenToToday', `-> appeared to move item succesfully`)
              numberChanged++
            } else {
              logWarn('scheduleAllOverdueOpenToToday', `-> moveFromCalToCal from ${thisNoteDateStr} to ${todayDateStr} not successful`)
            }
          } else {
            // CommandBar.showLoading(true, `Scheduling item ${c} to ${newDateStr}`, c / totalOverdue)
            para.content = `${removeDateTagsAndToday(para.content)} >${newDateStr}`
            logDebug('scheduleAllOverdueOpenToToday', `- scheduling referenced para {${para.content}} from note ${para.note?.filename ?? '?'}`)
            numberChanged++
            thisNote.updateParagraph(para)
          }
          // TEST: Update cache to allow it to be re-read on refresh
          DataStore.updateCache(thisNote)
        }
        logDebug('scheduleAllOverdueOpenToToday', `moved ${String(numberChanged)} overdue items to today's note (in ${timer(thisStartTime)})`)
      }
    }

    // remove progress indicator
    reactWindowData.pluginData.refreshing = false
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `scheduleAllYesterdayOpenToToday finished `)

    return { success: true, actionsOnSuccess: ['REFRESH_SECTION_IN_JSON'], sectionCodes: ['OVERDUE'] }

  }
  catch (error) {
    logError('dashboard / scheduleAllOverdueOpenToToday', error.message)
    return { success: false }
  }
}
