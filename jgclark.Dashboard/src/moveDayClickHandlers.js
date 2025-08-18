// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions to move items from one day to another
// Last updated 2025-07-18 for v2.3.0.b6 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { WEBVIEW_WINDOW_ID } from './constants'
import { getOpenItemParasForTimePeriod, getDashboardSettings, makeDashboardParas } from './dashboardHelpers'
import { getRelevantOverdueTasks } from './dataGenerationOverdue'
import { type MessageDataObject, type TBridgeClickHandlerResult } from './types'
import { clo, JSP, logDebug, logError, logInfo, logWarn, logTimer } from '@helpers/dev'
import {
  getDateStringFromCalendarFilename,
  getTodaysDateHyphenated,
  getTodaysDateUnhyphenated,
  replaceArrowDatesInString,
} from '@helpers/dateTime'
import { getGlobalSharedData, sendToHTMLWindow } from '@helpers/HTMLView'
import { moveItemBetweenCalendarNotes } from '@helpers/NPMoveItems'
import { getParagraphFromStaticObject } from '@helpers/NPParagraph'
import { showMessageYesNo } from '@helpers/userInput'

//-----------------------------------------------------------------
// constants

const checkThreshold = 20 // number beyond which to check with user whether to proceed

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
    const config: any = await getDashboardSettings()
    const thisStartTime = new Date()
    const reactWindowData: any = await getGlobalSharedData(WEBVIEW_WINDOW_ID)

    // If called with modifierKey 'meta', then toggle from usual config.rescheduleNotMove behaviour to the opposite
    const rescheduleNotMove = data.modifierKey === 'meta' ? !config.rescheduleNotMove : config.rescheduleNotMove
    if (config.rescheduleNotMove !== config.rescheduleNotMove) logDebug('scheduleAllYesterdayOpenToToday', `Starting with rescheduleNotMove setting overridden toggled to ${rescheduleNotMove}`)

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
    // First, override one config item so we can work on separate dated vs scheduled items
    config.separateSectionForReferencedNotes = true
    const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForTimePeriod(yesterdaysNote.filename, 'day', config)
    const initialTotalToMove = combinedSortedParas.length + sortedRefParas.length

    // Remove child items from the two lists of paras
    const combinedSortedParasWithoutChildren = combinedSortedParas.filter((dp) => !dp.isAChild)
    const sortedRefParasWithoutChildren = sortedRefParas.filter((dp) => !dp.isAChild)
    const totalToMove = combinedSortedParasWithoutChildren.length + sortedRefParasWithoutChildren.length
    if (totalToMove !== initialTotalToMove) {
      logDebug('scheduleAllYesterdayOpenToToday', `- Excluding children reduced total to move from ${initialTotalToMove} to ${totalToMove}`)
    }

    // If there are lots, then double check whether to proceed.
    // Note: platform limitation: can't run CommandBar from HTMLView on iOS/iPadOS, so don't try.
    if (NotePlan.environment.platform === 'macOS' && totalToMove > checkThreshold) {
      const res = await showMessageYesNo(
        `Are you sure you want to ${rescheduleNotMove ? 'schedule' : 'move'} ${totalToMove} items to today?`,
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
    if (combinedSortedParasWithoutChildren.length > 0) {
      reactWindowData.pluginData.refreshing = ['DT', 'DY']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(['DT', 'DY'])}`)

      if (rescheduleNotMove) {
        // Determine if we need to use 'today' or schedule to the specific date.
        const newDateStr = config.useTodayDate ? 'today' : getTodaysDateHyphenated()
        // For each para append ' >today'
        for (const dashboardPara of combinedSortedParasWithoutChildren) {
          c++
          CommandBar.showLoading(true, `Scheduling item ${c} to ${newDateStr}`, c / totalToMove)
          logDebug('scheduleAllYesterdayOpenToToday', `- Scheduling item ${c}/${totalToMove} "${dashboardPara.content}" to tomorrow`)
          // Convert each reduced para back to the full one to update
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p && p.note) {
            p.content = replaceArrowDatesInString(p.content, `>${newDateStr}`)
            // $FlowIgnore[incompatible-use]
            p.note.updateParagraph(p)
            // $FlowIgnore[incompatible-call]
            DataStore.updateCache(p.note, false)
            numberScheduled++
          } else {
            logWarn('scheduleAllYesterdayOpenToToday', `Couldn't find calendar note para matching this dashboardPara to reschedule:`)
            clo(dashboardPara, 'dashboardPara')
          }
        }
        logTimer('scheduleAllYesterdayOpenToToday', thisStartTime, `scheduled ${String(numberScheduled)} open items from yesterday's note to today's`)
      } else {
        // For each para move to today's note
        for (const para of combinedSortedParasWithoutChildren) {
          c++
          CommandBar.showLoading(true, `Moving item ${c} to today`, c / totalToMove)
          logDebug('scheduleAllYesterdayOpenToToday', `Moving item ${c}/${totalToMove} "${para.content}" to today`)
          const res = await moveItemBetweenCalendarNotes(yesterdayDateStr, todayDateStr, para.rawContent, config.newTaskSectionHeading, config.newTaskSectionHeadingLevel)
          if (res) {
            // logDebug('scheduleAllYesterdayOpenToToday', `-> appeared to move item succesfully`)
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
    if (sortedRefParasWithoutChildren.length > 0) {
      // Show working indicator
      reactWindowData.pluginData.refreshing = ['DT', 'DY']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(['DT', 'DY'])}`)

      // Determine if we need to use 'today' or schedule to the specific date.
      logDebug('scheduleAllYesterdayOpenToToday', `useTodayDate setting is ${config.useTodayDate}`)
      const newDateStr = config.useTodayDate ? 'today' : getTodaysDateHyphenated()
      // For each para append the date to move to
      for (const dashboardPara of sortedRefParasWithoutChildren) {
        c++
        CommandBar.showLoading(true, `Scheduling item ${c} to ${newDateStr}`, c / totalToMove)
        const thisNote = DataStore.noteByFilename(dashboardPara.filename, dashboardPara.noteType)
        if (!thisNote) {
          logWarn('scheduleAllYesterdayOpenToToday', `Oddly I can't find the note for "${dashboardPara.content}", so can't process this item`)
        } else {
          // Convert each reduced para back to the full one to update.
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p) {
            p.content = replaceArrowDatesInString(p.content, `>${newDateStr}`)
            logDebug('scheduleAllYesterdayOpenToToday', `- Scheduling referenced para ${c}/${totalToMove} from note ${thisNote.filename} with new content "${p.content}"`)
            thisNote.updateParagraph(p)
            numberScheduled++
            // Update cache to allow it to be re-read on refresh
            DataStore.updateCache(thisNote, false)
          } else {
            logWarn('scheduleAllYesterdayOpenToToday', `Couldn't find ref para matching this dashboardPara to reschedule:`)
            clo(dashboardPara, 'dashboardPara')
          }
        }
      }
      logTimer('scheduleAllYesterdayOpenToToday', thisStartTime, `scheduled ${String(numberScheduled)} open items from yesterday in project notes to today`)
    } else {
      // logDebug('scheduleAllYesterdayOpenToToday', `- No ref paras for yesterday found`)
    }
    // remove progress indicators
    CommandBar.showLoading(false)
    reactWindowData.pluginData.refreshing = false
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `scheduleAllYesterdayOpenToToday finished `)

    // Update display of these 2 sections
    return { success: true, actionsOnSuccess: ['REFRESH_SECTION_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], sectionCodes: ['DY', 'DT', 'OVERDUE'] }
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
export async function scheduleAllTodayTomorrow(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {
    let numberScheduled = 0
    const config = await getDashboardSettings()
    // Override one config item so we can work on separate dated vs scheduled items
    config.separateSectionForReferencedNotes = true
    const thisStartTime = new Date()
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)

    // If called with modifierKey 'meta', then toggle from usual config.rescheduleNotMove behaviour to the opposite
    const rescheduleNotMove = data.modifierKey === 'meta' ? !config.rescheduleNotMove : config.rescheduleNotMove
    if (config.rescheduleNotMove !== config.rescheduleNotMove) logDebug('scheduleAllTodayTomorrow', `Starting with rescheduleNotMove setting overridden toggled to ${String(rescheduleNotMove)}`)

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
      logDebug('scheduleAllTodayTomorrow', `Starting with today's note (${todayDateStr})`)
    }

    // Get list of open tasks/checklists from this calendar note
    // First, override one config item so we can work on separate dated vs scheduled items
    config.separateSectionForReferencedNotes = true
    const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForTimePeriod(todaysNote.filename, 'day', config)
    const initialTotalToMove = combinedSortedParas.length + sortedRefParas.length

    // Remove child items from the two lists of paras
    const combinedSortedParasWithoutChildren = combinedSortedParas.filter((dp) => !dp.isAChild)
    const sortedRefParasWithoutChildren = sortedRefParas.filter((dp) => !dp.isAChild)
    const totalToMove = combinedSortedParasWithoutChildren.length + sortedRefParasWithoutChildren.length
    if (totalToMove !== initialTotalToMove) {
      logDebug('scheduleAllTodayTomorrow', `- Excluding children reduced total to move from ${initialTotalToMove} to ${totalToMove}`)
    }

    // If there are lots, then double check whether to proceed.
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
    if (combinedSortedParasWithoutChildren.length > 0) {
      reactWindowData.pluginData.refreshing = ['DT', 'DO']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(['DT', 'DO'])}`)

      if (config.rescheduleNotMove) {
        // For each para append ' >' and tomorrow's ISO date
        for (const dashboardPara of combinedSortedParasWithoutChildren) {
          c++
          CommandBar.showLoading(true, `Scheduling item ${c} to tomorrow`, c / totalToMove)
          logDebug('scheduleAllTodayTomorrow', `- Scheduling item ${c}/${totalToMove} "${dashboardPara.content}" to tomorrow`)
          // Convert each reduced para back to the full one to update
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p && p.note) {
            p.content = replaceArrowDatesInString(p.content, `>${tomorrowISODateStr}`)
            // $FlowIgnore[incompatible-use]
            p.note.updateParagraph(p)
            // $FlowIgnore[incompatible-call]
            DataStore.updateCache(p.note, false)
            numberScheduled++
          } else {
            logWarn('scheduleAllTodayTomorrow', `Couldn't find calendar note para matching this dashboardPara to reschedule:`)
            clo(dashboardPara, 'dashboardPara')
          }
        }
        logDebug('scheduleAllTodayTomorrow', `scheduled ${String(numberScheduled)} open items from today's note`)
      } else {
        // For each para move to tomorrow's note
        for (const para of combinedSortedParasWithoutChildren) {
          c++
          CommandBar.showLoading(true, `Moving item ${c} to tomorrow`, c / totalToMove)
          logDebug('scheduleAllTodayTomorrow', `Moving item ${c}/${totalToMove} "${para.content}" to tomorrow`)
          const res = await moveItemBetweenCalendarNotes(todayDateStr, tomorrowDateStr, para.rawContent, config.newTaskSectionHeading, config.newTaskSectionHeadingLevel)
          if (res) {
            // logDebug('scheduleAllTodayTomorrow', `-> appeared to move item succesfully`)
            numberScheduled++
          } else {
            logWarn('scheduleAllTodayTomorrow', `-> moveFromCalToCal from ${todayDateStr} to ${tomorrowDateStr} not successful`)
          }
        }
        logTimer('scheduleAllTodayTomorrow', thisStartTime, `moved ${String(numberScheduled)} open items from today to tomorrow's note`)
        // Update cache to allow it to be re-read on refresh
        DataStore.updateCache(todaysNote, false)
      }
    }

    // Now do the same for items scheduled to today from other notes
    if (sortedRefParasWithoutChildren.length > 0) {
    // Show working indicator
      reactWindowData.pluginData.refreshing = ['DT', 'DO']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(['DT', 'DO'])}`)

      // For each para append ' >tomorrow' (the actual ISO date not literal string 'tomorrow')
      for (const dashboardPara of sortedRefParasWithoutChildren) {
        c++
        CommandBar.showLoading(true, `Scheduling item ${c} to tomorrow`, c / totalToMove)
        const thisNote = DataStore.noteByFilename(dashboardPara.filename, dashboardPara.noteType)
        if (!thisNote) {
          logWarn('scheduleAllTodayTomorrow', `Oddly I can't find the note for "${dashboardPara.content}", so can't process this item`)
        } else {
          // Convert each reduced para back to the full one to update.
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p && p.note) {
            p.content = replaceArrowDatesInString(p.content, `>${tomorrowISODateStr}`)
            logDebug('scheduleAllTodayTomorrow', `- Scheduling referenced para ${c}/${totalToMove} from note ${thisNote.filename} with new content "${p.content}"`)
            thisNote.updateParagraph(p)
            numberScheduled++
          } else {
            logWarn('scheduleAllTodayTomorrow', `Couldn't find ref para matching this dashboardPara to reschedule:`)
            clo(dashboardPara, 'dashboardPara')
          }
          // Update cache to allow it to be re-read on refresh
          DataStore.updateCache(thisNote, false)
        }
      }
      logTimer('scheduleAllTodayTomorrow', thisStartTime, `scheduled ${String(numberScheduled)} open items from today in project notes to tomorrow`)
    } else {
      // logDebug('scheduleAllTodayTomorrow', `- No ref paras for today found`)
    }

    // remove progress indicators
    CommandBar.showLoading(false)
    reactWindowData.pluginData.refreshing = false
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `scheduleAllTodayTomorrow finished `)

    // Update display of these 2 sections
    return { success: true, actionsOnSuccess: ['REFRESH_SECTION_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], sectionCodes: ['DT', 'DO', 'OVERDUE'] }
  } catch (error) {
    logError('scheduleAllTodayTomorrow', error.message)
    return { success: false }
  }
}

//-----------------------------------------------------------------
/**
 * Function to schedule or move all open overdue tasks from their notes to today
 * Uses config setting 'rescheduleNotMove' to decide whether to reschedule or move.
 * Note: This uses an API call that doesn't include open checklist items.
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
    // const [yesterdaysCombinedSortedDashboardParas, _sortedRefParas] = getOpenItemParasForTimePeriod(yesterdaysNote.filename, "day", config, false)

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
    // $FlowIgnore[prop-missing]
    // eslint-disable-next-line no-unused-vars
    const { filteredOverdueParas, preLimitOverdueCount } = await getRelevantOverdueTasks(config, []) // Note: does not include open checklist items. Note: turned off dedupe with yesterday's items
    const overdueParas = filteredOverdueParas
    const initialTotalOverdue = filteredOverdueParas.length
    if (initialTotalOverdue === 0) {
      logInfo('scheduleAllOverdueOpenToToday', `Can't find any overdue items; this can happen if all were from yesterday, and have been de-duped. Stopping.`)
      return { success: false }
    }
    // Remove child items from the list of paras
    const dashboardParas = makeDashboardParas(overdueParas)
    const overdueParasWithoutChildren = dashboardParas.filter((dp) => !dp.isAChild)
    const totalToMove = overdueParasWithoutChildren.length
    if (totalToMove !== initialTotalOverdue) {
      logDebug('scheduleAllOverdueOpenToToday', `- Excluding children reduced total to move from ${initialTotalOverdue} to ${totalToMove}`)
    }

    logTimer('scheduleAllOverdueOpenToToday', thisStartTime, `Found ${totalToMove} overdue items to ${config.rescheduleNotMove ? 'rescheduleItem' : 'move'} to today`)

    const todayDateStr = getTodaysDateHyphenated()

    // If there are lots, then double check whether to proceed
    // Note: platform limitation: can't run CommandBar from HTMLView on iOS/iPadOS
    if (NotePlan.environment.platform === 'macOS' && totalToMove > checkThreshold) {
      const res = await showMessageYesNo(
        `Are you sure you want to ${
          config.rescheduleNotMove ? 'rescheduleItem' : 'move'
        } ${totalToMove} overdue items to today? This can be a slow operation, and can't easily be undone.`,
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
    if (overdueParasWithoutChildren.length > 0) {
      // start a progress indicator
      reactWindowData.pluginData.refreshing = ['OVERDUE']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(['OVERDUE'])}`)

      if (config.rescheduleNotMove) {
        // Determine if we need to use 'today' or schedule to the specific date.
        const newDateStr = config.useTodayDate ? 'today' : getTodaysDateHyphenated()
        // For each para append ' >today'
        for (const dashboardPara of overdueParasWithoutChildren) {
          c++
          CommandBar.showLoading(true, `Rescheduling item ${c} to today`, c / totalToMove)
          logDebug('scheduleAllOverdueOpenToToday', `Rescheduling item ${c} to today`)
          // Convert each reduced para back to the full one to update
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p && p.note) {
            p.content = replaceArrowDatesInString(p.content, `>${newDateStr}`)
            // $FlowIgnore[incompatible-use]
            p.note.updateParagraph(p)
            // $FlowIgnore[incompatible-call]
            DataStore.updateCache(p.note, false)
            numberChanged++
          } else {
            logWarn('scheduleAllOverdueOpenToToday', `Couldn't find calendar note para matching this dashboardPara to reschedule:`)
            clo(dashboardPara, 'dashboardPara')
          }
        }
        logTimer('scheduleAllOverdueOpenToToday', thisStartTime, `rescheduled ${String(numberChanged)} overdue items to today's note`)
      } else {
        // Determine if we need to use 'today' or schedule to the specific date.
        const newDateStr = config.useTodayDate ? 'today' : getTodaysDateHyphenated()
        logDebug('scheduleAllOverdueOpenToToday', `useTodayDate=${String(config.useTodayDate)}, so newDateStr=${newDateStr}`)
        // For each para move to today's note
        for (const dashboardPara of overdueParasWithoutChildren) {
          c++
          CommandBar.showLoading(true, `Moving item ${c} to today`, c / totalToMove)
          logDebug('scheduleAllOverdueOpenToToday', `Moving item #${c} to today`)
          // Convert each reduced para back to the full one to update
          const p = getParagraphFromStaticObject(dashboardPara)
          if (!(p && p.note)) {
            logWarn('scheduleAllOverdueOpenToToday', `-> can't find note for overdue para ${dashboardPara.content}}`)
            continue
          }
          const thisNote = p.note
          if (thisNote && p.noteType === 'Calendar') {
            const thisNoteDateStr = getDateStringFromCalendarFilename(thisNote.filename, true)
            const res = await moveItemBetweenCalendarNotes(thisNoteDateStr, todayDateStr, dashboardPara.rawContent, config.newTaskSectionHeading, config.newTaskSectionHeadingLevel)
            if (res) {
              logDebug('scheduleAllOverdueOpenToToday', `-> success on moveFromCalToCal ${thisNoteDateStr} -> ${todayDateStr}`)
              numberChanged++
            } else {
              logWarn('scheduleAllOverdueOpenToToday', `-> failed to moveFromCalToCal ${thisNoteDateStr} -> ${todayDateStr}`)
            }
          } else {
            dashboardPara.content = replaceArrowDatesInString(dashboardPara.content, `>${newDateStr}`)
            logDebug('scheduleAllOverdueOpenToToday', `- in note '${dashboardPara.filename ?? '?'}', so changing para to "${dashboardPara.content}"`)
            numberChanged++
            thisNote.updateParagraph(p)
          }
          // Update cache to allow it to be re-read on refresh
          DataStore.updateCache(thisNote, false)
        }
        logTimer('scheduleAllOverdueOpenToToday', thisStartTime, `moved ${String(numberChanged)} overdue items to today's note`)
      }
    } else {
      throw new Error(`after finding ${String(initialTotalOverdue)} overdue items to move/reschedule a little earlier, I now don't have any!`)
    }

    // remove progress indicators
    CommandBar.showLoading(false)
    reactWindowData.pluginData.refreshing = false
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `scheduleAllOverdueOpenToToday finished `)

    // Update display of this section (and Today)
    logDebug('scheduleAllOverdueOpenToToday', `✅ completed`)
    return { success: true, actionsOnSuccess: ['REFRESH_SECTION_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], sectionCodes: ['DT', 'OVERDUE'] }
  } catch (error) {
    logError('scheduleAllOverdueOpenToToday', error.message)
    return { success: false }
  }
}
