// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions that need to refresh Dashboard
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
// import pluginJson from '../plugin.json'
import { WEBVIEW_WINDOW_ID } from './constants'
import { getOpenItemParasForCurrentTimePeriod, getRelevantOverdueTasks, getDashboardSettings, moveItemBetweenCalendarNotes, handlerResult } from './dashboardHelpers'
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
 * Move an item from one calendar note to a different one.
 * The date to move to is indicated by controlStr, which is a relative date.
 * TODO: Extend to move sub-items as well, if wanted.
 * Note: is similar but different to dashboardHelpers::moveItemBetweenCalendarNotes().
 * @param {MessageDataObject} data for the item
 * @returns {TBridgeClickHandlerResult} how to handle this result
 */
export async function doMoveFromCalToCal(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
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
}

/**
 * Function to schedule or move all open items from yesterday to today
 * Uses config setting 'rescheduleNotMove' to decide whether to reschedule or move.
 * @param {MessageDataObject} data
 * @returns {TBridgeClickHandlerResult}
 */
export async function scheduleAllYesterdayOpenToToday(_data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {
    let numberScheduled = 0
    const config: any = await getDashboardSettings()
    // Override one config item so we can work on separate dated vs scheduled items
    config.separateSectionForReferencedNotes = true
    const thisStartTime = new Date()
    const reactWindowData: any = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
    // clo(reactWindowData)

    // Get paras for all open items in yesterday's note
    // Note: this could be taken from pluginData's DY section data, but it's very quick to generate, and guarantees that we're using fresh data
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
    const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForCurrentTimePeriod('day', yesterdaysNote, config)
    const totalToMove = combinedSortedParas.length + sortedRefParas.length
    // if (totalToMove !== prevTotalToMove) {
    //   logDebug('scheduleAllTodayTomorrow', `- Excluding children reduced total to move from ${prevTotalToMove} to ${totalToMove}`)
    // }

    // If there are lots, then double check whether to proceed
    // TODO: get this from newer settings instead
    // Note: platform limitation: can't run CommandBar from HTMLView on iOS/iPadOS
    if (NotePlan.environment.platform === 'macOS' && totalToMove > checkThreshold) {
      const res = await showMessageYesNo(
        `Are you sure you want to ${config.rescheduleNotMove ? 'schedule' : 'move'} ${totalToMove} items to today?`,
        ['Yes', 'No'],
        'Move Yesterday to Today',
        false,
      )
      if (res !== 'Yes') {
        logDebug('scheduleAllYesterdayOpenToToday', 'User cancelled operation.')
        return { success: false }
      }
    }

    let c = 0
    if (combinedSortedParas.length > 0) {
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
          logDebug('scheduleAllYesterdayOpenToToday', `- scheduling "${dashboardPara.content}" to ${newDateStr}`)
          // Convert each reduced para back to the full one to update
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p) {
            p.content = replaceArrowDatesInString(p.content, `>${newDateStr}`)
            p.note?.updateParagraph(p)
            DataStore.updateCache(p.note, false)
            numberScheduled++
          } else {
            logError('scheduleAllYesterdayOpenToToday', `Couldn't find para matching "${dashboardPara.content}"`)
          }
        }

        logDebug('scheduleAllYesterdayOpenToToday', `scheduled ${String(numberScheduled)} open items from yesterday's note to today's`)
      } else {
        // For each para move to today's note
        for (const para of combinedSortedParas) {
          logDebug('scheduleAllYesterdayOpenToToday', `- moving "${para.content}" to today`)
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
        // Update cache to allow it to be re-read on refresh
        DataStore.updateCache(yesterdaysNote, false)
      }
    }

    // Now do the same for items scheduled to yesterday from other notes
    if (sortedRefParas.length > 0) {
      // Show working indicator
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
          logWarn('scheduleAllYesterdayOpenToToday', `Oddly I can't find the note for "${dashboardPara.content}", so can't process this item`)
        } else {
          // Convert each reduced para back to the full one to update.
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p) {
            p.content = replaceArrowDatesInString(p.content, `>${newDateStr}`)
            logDebug('scheduleAllYesterdayOpenToToday', `- scheduling referenced para from note ${thisNote.filename} with new content "${p.content}" `)
            thisNote.updateParagraph(p)
            numberScheduled++
          } else {
            logWarn('scheduleAllYesterdayOpenToToday', `Couldn't find para matching "${dashboardPara.content}"`)
          }
          // Update cache to allow it to be re-read on refresh
          DataStore.updateCache(thisNote, false)
        }
      }
      logTimer('scheduleAllYesterdayOpenToToday', thisStartTime, `-> scheduled ${String(numberScheduled)} open items from yesterday in project notes to today`)
    } else {
      logDebug('scheduleAllYesterdayOpenToToday', `- No ref paras for yesterday found`)
    }
    // remove progress indicator
    reactWindowData.pluginData.refreshing = false
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `scheduleAllYesterdayOpenToToday finished `)

    // Update display of these 2 sections
    return { success: true, actionsOnSuccess: ['REFRESH_SECTION_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], sectionCodes: ['DY', 'DT'] }
  } catch (error) {
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
export async function scheduleAllTodayTomorrow(_data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {
    let numberScheduled = 0
    const config = await getDashboardSettings()
    // Override one config item so we can work on separate dated vs scheduled items
    config.separateSectionForReferencedNotes = true
    const thisStartTime = new Date()
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)

    // Get paras for all open items in today's note
    // Note: this could be taken from pluginData's DT section data, but it's very quick to generate, and guarantees that we're using fresh data
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
    const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForCurrentTimePeriod('day', todaysNote, config)
    const totalToMove = combinedSortedParas.length + sortedRefParas.length
    // if (totalToMove !== prevTotalToMove) {
    //   logDebug('scheduleAllTodayTomorrow', `- Excluding children reduced total to move from ${prevTotalToMove} to ${totalToMove}`)
    // }

    // TODO: get this from newer settings instead
    // Note: platform limitation: can't run CommandBar from HTMLView on iOS/iPadOS
    if (NotePlan.environment.platform === 'macOS' && totalToMove > checkThreshold) {
      const res = await showMessageYesNo(
        `Are you sure you want to ${config.rescheduleNotMove ? 'schedule' : 'move'} ${totalToMove} items to tomorrow?`,
        ['Yes', 'No'],
        'Move Today to Tomorrow',
        false,
      )
      if (res !== 'Yes') {
        logDebug('scheduleAllTodayTomorrow', 'User cancelled operation.')
        return { success: false }
      }
    }

    let c = 0
    if (combinedSortedParas.length > 0) {
      reactWindowData.pluginData.refreshing = ['DT', 'DO']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(['DT', 'DO'])}`)

      if (config.rescheduleNotMove) {
        // For each para append ' >' and tomorrow's ISO date
        for (const dashboardPara of combinedSortedParas) {
          c++
          // CommandBar.showLoading(true, `Scheduling item ${c} to tomorrow`, c / totalToMove)
          logDebug('scheduleAllTodayTomorrow', `- scheduling "${dashboardPara.content}" to tomorrow`)
          // Convert each reduced para back to the full one to update
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p) {
            p.content = replaceArrowDatesInString(p.content, `>${tomorrowISODateStr}`)
            p.note?.updateParagraph(p)
            DataStore.updateCache(p.note, false)
            numberScheduled++
          }
        }
        logDebug('scheduleAllTodayTomorrow', `scheduled ${String(numberScheduled)} open items from today's note`)
      } else {
        // For each para move to tomorrow's note
        for (const para of combinedSortedParas) {
          logDebug('scheduleAllTodayTomorrow', `- moving "${para.content}" to tomorrow`)
          c++
          // CommandBar.showLoading(true, `Moving item ${c} to tomorrow`, c / totalToMove)
          const res = await moveItemBetweenCalendarNotes(todayDateStr, tomorrowDateStr, para.content, config.newTaskSectionHeading ?? '')
          if (res) {
            logDebug('scheduleAllTodayTomorrow', `-> appeared to move item succesfully`)
            numberScheduled++
          } else {
            logWarn('scheduleAllTodayTomorrow', `-> moveFromCalToCal from {todayDateStr} to ${tomorrowDateStr} not successful`)
          }
        }
        logTimer('scheduleAllTodayTomorrow', thisStartTime, `moved ${String(numberScheduled)} open items from today to tomorrow's note`)
        // Update cache to allow it to be re-read on refresh
        DataStore.updateCache(todaysNote, false)
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
          logWarn('scheduleAllTodayTomorrow', `Oddly I can't find the note for "${dashboardPara.content}", so can't process this item`)
        } else {
          // Convert each reduced para back to the full one to update.
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p) {
            p.content = replaceArrowDatesInString(p.content, `>${tomorrowISODateStr}`)
            logDebug('scheduleAllTodayTomorrow', `- scheduling referenced para "${p.content}" from note ${thisNote.filename}`)
            thisNote.updateParagraph(p)
          } else {
            logWarn('scheduleAllYesterdayOpenToToday', `Couldn't find para matching "${dashboardPara.content}"`)
          }

          numberScheduled++
          // Update cache to allow it to be re-read on refresh
          DataStore.updateCache(thisNote, false)
        }
      }
      logDebug('scheduleAllTodayTomorrow', `-> scheduled ${String(numberScheduled)} open items from today to tomorrow`)
    }

    // remove progress indicator
    reactWindowData.pluginData.refreshing = false
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `scheduleAllYesterdayOpenToToday finished `)

    // Update display of these 2 sections
    logDebug('scheduleAllTodayTomorrow', `returning {true, REFRESH_SECTION_IN_JSON, [DT,DO]}`)
    return { success: true, actionsOnSuccess: ['REFRESH_SECTION_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], sectionCodes: ['DT', 'DO'] }
  } catch (error) {
    logError('dashboard / scheduleAllTodayTomorrow', error.message)
    return { success: false }
  }
}

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
    logDebug('scheduleAllThisWeekNextWeek', `Starting with this week's note ${thisWeekDateStr} -> ${nextWeekDateStr}`)

    if (!thisWeekNote) {
      logWarn('scheduleAllThisWeekNextWeek', `Oddly I can't find a weekly note for today (${thisWeekDateStr})`)
      return { success: false }
    } else {
      logDebug('scheduleAllThisWeekNextWeek', `Starting with this week's note${thisWeekDateStr}`)
    }

    // Get list of open tasks/checklists from this calendar note
    const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForCurrentTimePeriod('week', thisWeekNote, config)
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
          // CommandBar.showLoading(true, `Scheduling item ${c} to next week`, c / totalToMove)
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
          // CommandBar.showLoading(true, `Moving item ${c} to next week`, c / totalToMove)
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
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `scheduleAllYesterdayOpenToThis week finished `)

    // Update display of these 2 sections
    logDebug('scheduleAllThisWeekNextWeek', `returning {true, REFRESH_SECTION_IN_JSON, [W]}`)
    return { success: true, actionsOnSuccess: ['REFRESH_SECTION_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], sectionCodes: ['W'] }
  } catch (error) {
    logError('dashboard / scheduleAllThisWeekNextWeek', error.message)
    return { success: false }
  }
}

//-----------------------------------------------------------------
/**
 * Function to schedule or move all open overdue tasks from their notes to today
 * Uses config setting 'rescheduleNotMove' to decide whether to reschedule or move.
 * Note: This uses an API call that doesn't include open checklist items.
 * FIXME: This doesn't honour the useDemoData setting yet.
 * @param {MessageDataObject} data
 * @returns {TBridgeClickHandlerResult}
 */
export async function scheduleAllOverdueOpenToToday(_data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {
    let numberChanged = 0
    const config = await getDashboardSettings()
    const thisStartTime = new Date()
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)

    // Get list of open tasks/checklists from yesterday note
    // Note: we need full TParagraphs, not ReducedParagraphs
    // const filenameDateStr = new moment().subtract(1, 'days').format('YYYYMMDD')
    // const yesterdaysNote = DataStore.calendarNoteByDateString(filenameDateStr)
    // if (!yesterdaysNote) {
    //   throw new Error(`Couldn't find yesterday's note, which shouldn't happen.`)
    // }
    // // Override one setting so we can work on combined items
    // config.separateSectionForReferencedNotes = false
    // const [yesterdaysCombinedSortedDashboardParas, _sortedRefParas] = getOpenItemParasForCurrentTimePeriod("day", yesterdaysNote, config, false)

    // Now dedupe with Yesterday data
    // Now convert these back to full TParagraph
    // const yesterdaysCombinedSortedParas: Array<TParagraph> = []
    // for (const yCSDP of yesterdaysCombinedSortedDashboardParas) {
    //   const p: TParagraph | null = getParagraphFromStaticObject(yCSDP)
    //   if (p) {
    //     yesterdaysCombinedSortedDashboardParas.push(p)
    //   } else {
    //     logWarn('scheduleAllOverdueOpenToToday', `Couldn't find para matching "${yCSDP.content}"`)
    //   }
    // }

    // Get paras for all overdue items in notes
    // Note: we need full TParagraphs, not ReducedParagraphs
    // const overdueParas: Array<TParagraph> = await getRelevantOverdueTasks(config, yesterdaysCombinedSortedParas) // note: does not include open checklist items
    const overdueParas: Array<TParagraph> = await getRelevantOverdueTasks(config, []) // Note: does not include open checklist items. Note: turned off dedupe with yesterday's items
    const totalOverdue = overdueParas.length
    if (totalOverdue === 0) {
      logInfo('scheduleAllOverdueOpenToToday', `Can't find any overdue items; this can happen if all were from yesterday, and have been de-duped. Stopping.`)
      return { success: false }
    }
    logTimer('scheduleAllOverdueOpenToToday', thisStartTime, `Found ${totalOverdue} overdue items to ${config.rescheduleNotMove ? 'rescheduleItem' : 'move'} to today`)

    const todayDateStr = getTodaysDateHyphenated()

    // If there are lots, then double check whether to proceed
    // TODO: get this from newer settings instead
    // Note: platform limitation: can't run CommandBar from HTMLView on iOS/iPadOS
    if (NotePlan.environment.platform === 'macOS' && totalOverdue > checkThreshold) {
      const res = await showMessageYesNo(
        `Are you sure you want to ${
          config.rescheduleNotMove ? 'rescheduleItem' : 'move'
        } ${totalOverdue} overdue items to today? This can be a slow operation, and can't easily be undone.`,
        ['Yes', 'No'],
        'Move Overdue to Today',
        false,
      )
      if (res !== 'Yes') {
        logDebug('scheduleAllOverdueOpenToToday', 'User cancelled operation.')
        return { success: false }
      }
    }

    let c = 0
    if (overdueParas.length > 0) {
      // start a progress indicator
      reactWindowData.pluginData.refreshing = ['OVERDUE']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(['OVERDUE'])}`)

      if (config.rescheduleNotMove) {
        // Determine if we need to use 'today' or schedule to the specific date.
        logDebug('scheduleAllOverdueOpenToToday', `useTodayDate:${String(config.useTodayDate)}`)
        const newDateStr = config.useTodayDate ? 'today' : getTodaysDateHyphenated()
        // For each para append ' >today'
        for (const para of overdueParas) {
          c++
          const thisNote = para.note
          if (!thisNote) {
            logWarn('scheduleAllOverdueOpenToToday', `-> can't find note for overdue para "${para.content}"`)
            continue
          }
          logDebug('scheduleAllOverdueOpenToToday', `Scheduling item ${c} to ${newDateStr}`)
          para.content = replaceArrowDatesInString(para.content, `>${newDateStr}`)
          logDebug('scheduleAllOverdueOpenToToday', `- scheduling referenced para "${para.content}" from note ${para.filename ?? '?'}`)
          numberChanged++
          thisNote.updateParagraph(para)
          // Update cache to allow it to be re-read on refresh
          DataStore.updateCache(thisNote, false)
        }
        logTimer('scheduleAllOverdueOpenToToday', thisStartTime, `rescheduled ${String(numberChanged)} overdue items to today's note`)
      } else {
        // Determine if we need to use 'today' or schedule to the specific date.
        const newDateStr = config.useTodayDate ? 'today' : getTodaysDateHyphenated()
        logDebug('scheduleAllOverdueOpenToToday', `useTodayDate=${String(config.useTodayDate)}, so newDateStr=${newDateStr}`)
        // For each para move to today's note
        for (const para of overdueParas) {
          c++
          logDebug('scheduleAllOverdueOpenToToday', `Moving item #${c} to ${newDateStr}`)
          const thisNote = para.note
          if (!thisNote) {
            logWarn('scheduleAllOverdueOpenToToday', `-> can't find note for overdue para "${para.content}"`)
            continue
          }
          const thisNoteType = para.noteType
          if (thisNote && thisNoteType === 'Calendar') {
            const thisNoteDateStr = getDateStringFromCalendarFilename(thisNote.filename, true)
            const res = await moveItemBetweenCalendarNotes(thisNoteDateStr, todayDateStr, para.content, config.newTaskSectionHeading ?? '')
            if (res) {
              logDebug('scheduleAllOverdueOpenToToday', `-> success on moveFromCalToCal ${thisNoteDateStr} → ${todayDateStr}`)
              numberChanged++
            } else {
              logWarn('scheduleAllOverdueOpenToToday', `-> failed to moveFromCalToCal ${thisNoteDateStr} → ${todayDateStr}`)
            }
          } else {
            para.content = replaceArrowDatesInString(para.content, `>${newDateStr}`)
            logDebug('scheduleAllOverdueOpenToToday', `- in note '${para.note?.filename ?? '?'}', so changing para to "${para.content}"`)
            numberChanged++
            thisNote.updateParagraph(para)
          }
          // Update cache to allow it to be re-read on refresh
          DataStore.updateCache(thisNote, false)
        }
        logTimer('scheduleAllOverdueOpenToToday', thisStartTime, `moved ${String(numberChanged)} overdue items to today's note`)
      }
    } else {
      throw new Error(`after finding ${String(totalOverdue)} overdue items to move/reschedule a little earlier, I now don't have any!`)
    }

    // remove progress indicator
    reactWindowData.pluginData.refreshing = false
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `scheduleAllYesterdayOpenToToday finished `)

    // Update display of this section (and Today)
    logDebug('scheduleAllOverdueOpenToToday', `✅ completed`)
    return { success: true, actionsOnSuccess: ['REFRESH_SECTION_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], sectionCodes: ['DT', 'OVERDUE'] }
  } catch (error) {
    logError('dashboard scheduleAllOverdueOpenToToday', error.message)
    return { success: false }
  }
}
