/* eslint-disable max-len */
// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions to move items from one day to another
// Last updated 2025-12-07 for v2.4.0.b by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { WEBVIEW_WINDOW_ID } from './constants'
import { getOpenItemParasForTimePeriod, getDashboardSettings, makeDashboardParas } from './dashboardHelpers'
import { getRelevantOverdueTasks } from './dataGenerationOverdue'
import type { TParagraphForDashboard, MessageDataObject, TBridgeClickHandlerResult, TDashboardSettings } from './types'
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
// Helper functions

/**
 * Filter dashboard paras by priority
 * @param {Array<TParagraphForDashboard>} calendarNoteParas - calendar note paras to filter
 * @param {Array<TParagraphForDashboard>} refParas - referenced paras to filter
 * @param {boolean} moveOnlyShown - whether to filter by priority
 * @param {any} reactWindowData - react window data containing currentMaxPriorityFromAllVisibleSections
 * @param {string} functionName - name of calling function for logging
 * @returns {[Array<TParagraphForDashboard>, Array<TParagraphForDashboard>]} filtered arrays
 */
function filterParasByPriority(
  calendarNoteParas: Array<TParagraphForDashboard>,
  refParas: Array<TParagraphForDashboard>,
  currentMaxPriority: number,
  functionName: string,
): [Array<TParagraphForDashboard>, Array<TParagraphForDashboard>] {
  logDebug(functionName, `currentMaxPriorityFromAllVisibleSections = ${currentMaxPriority}`)
  let calendarNoteParasToMove = [...calendarNoteParas]
  let refParasToMove = [...refParas]

  if (currentMaxPriority >= 0) {
    calendarNoteParasToMove = calendarNoteParas.filter((dp) => {
      const priority = dp.priority ?? 0
      return priority >= currentMaxPriority
    })
    refParasToMove = refParas.filter((dp) => {
      const priority = dp.priority ?? 0
      return priority >= currentMaxPriority
    })
    logDebug(functionName, `Filtering to only shown items: ${calendarNoteParasToMove.length} direct items and ${refParasToMove.length} referenced items (priority >= ${currentMaxPriority}) out of ${calendarNoteParas.length + refParas.length} total`)
  }

  return [calendarNoteParasToMove, refParasToMove]
}

/**
 * Remove child items from arrays of dashboard paras.
 * @param {Array<TParagraphForDashboard>} paras - paras to filter
 * @returns {Array<TParagraphForDashboard>} paras without children
 */
function removeChildItems(paras: Array<TParagraphForDashboard>): Array<TParagraphForDashboard> {
  return paras.filter((dp) => !dp.isAChild)
}

/**
 * Ask user for confirmation if there are many items to process.
 * @param {number} totalToMove - total number of items to move
 * @param {boolean} rescheduleNotMove - whether rescheduling (true) or moving (false)
 * @param {string} destination - destination description (e.g., 'today', 'tomorrow')
 * @param {string} title - dialog title
 * @param {string} functionName - name of calling function for logging
 * @returns {Promise<boolean>} true if user confirmed, false if cancelled
 */
async function confirmLargeBatch(
  totalToMove: number,
  rescheduleNotMove: boolean,
  destination: string,
  title: string,
  functionName: string,
): Promise<boolean> {
  if (NotePlan.environment.platform === 'macOS' && totalToMove > checkThreshold) {
    const action = rescheduleNotMove ? 'schedule' : 'move'
    const message = totalToMove > 50
      ? `Are you sure you want to ${action} ${totalToMove} items to ${destination}? This can be a slow operation, and can't easily be undone.`
      : `Are you sure you want to ${action} ${totalToMove} items to ${destination}?`
    const res = await showMessageYesNo(message, ['Yes', 'No'], title, false)
    if (res !== 'Yes') {
      logDebug(functionName, 'User cancelled operation.')
      return false
    }
  }
  return true
}

//-----------------------------------------------------------------

/**
 * Function to schedule or move all open items from yesterday to today
 * Uses config setting 'rescheduleNotMove' to decide whether to reschedule or move.
 * @param {MessageDataObject} data
 * @param {boolean} moveOnlyShown - if true, only move items currently shown in the section
 * @returns {TBridgeClickHandlerResult}
 */
export async function scheduleYesterdayOpenToToday(
  data: MessageDataObject,
  moveOnlyShown: boolean = false,
): Promise<TBridgeClickHandlerResult> {
  try {
    let numberScheduled = 0
    const config: TDashboardSettings = await getDashboardSettings()
    const thisStartTime = new Date()
    const reactWindowData: any = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
    const currentMaxPriority = reactWindowData?.pluginData?.currentMaxPriorityFromAllVisibleSections ?? NaN

    // If called with modifierKey 'meta', then toggle from usual config.rescheduleNotMove behaviour to the opposite
    const rescheduleNotMove = data.modifierKey === 'meta' ? !config.rescheduleNotMove : config.rescheduleNotMove
    if (data.modifierKey === 'meta' && rescheduleNotMove !== config.rescheduleNotMove) {
      logDebug('scheduleYesterdayOpenToToday', `Starting with rescheduleNotMove setting overridden toggled to ${String(rescheduleNotMove)}`)
    }
    logDebug('scheduleYesterdayOpenToToday', `starting with moveOnlyShown ${String(moveOnlyShown)}`)

    // Get list of paras with open tasks/checklists from this calendar note
    // Note: this could be taken from pluginData's DY section data, but it's very quick to generate, and guarantees that we're using fresh data
    const yesterdayDateStr = new moment().subtract(1, 'days').format('YYYYMMDD')
    const todayDateStr = getTodaysDateHyphenated()
    const yesterdaysNote = DataStore.calendarNoteByDateString(yesterdayDateStr)
    if (!yesterdaysNote) {
      logWarn('scheduleYesterdayOpenToToday', `Oddly I can't find a daily note for yesterday ${yesterdayDateStr}`)
      return { success: false }
    } else {
      logDebug('scheduleYesterdayOpenToToday', `Starting with yesterday's note: ${yesterdayDateStr}`)
    }
    // override one config item so we can work on separate dated vs scheduled items
    config.separateSectionForReferencedNotes = true
    // Get all paras for yesterday's note
    const [calendarNoteParas, refParas] = await getOpenItemParasForTimePeriod(yesterdaysNote.filename, 'day', config)
    let calendarNoteParasToMove = [...calendarNoteParas]
    let refParasToMove = [...refParas]
    if (moveOnlyShown && (!isNaN(currentMaxPriority))) {
      [calendarNoteParasToMove, refParasToMove] = filterParasByPriority(
      calendarNoteParas,
      refParas,
      currentMaxPriority,
      'scheduleYesterdayOpenToToday')
   } else {
      logDebug('scheduleYesterdayOpenToToday', `Not filtering to only shown items because moveOnlyShown is false or currentMaxPriorityFromAllVisibleSections is undefined`)
}

    const initialTotalToMove = calendarNoteParasToMove.length + refParasToMove.length

    // Remove child items from the lists
    const calendarNoteParasWithoutChildren = removeChildItems(calendarNoteParasToMove)
    const refParasWithoutChildren = removeChildItems(refParasToMove)
    const totalToMove = calendarNoteParasWithoutChildren.length + refParasWithoutChildren.length
    if (totalToMove !== initialTotalToMove) {
      logDebug('scheduleYesterdayOpenToToday', `- Excluding children reduced total to move from ${initialTotalToMove} to ${totalToMove}`)
    }

    // If there are lots, then double check whether to proceed.
    // Note: platform limitation: can't run CommandBar from HTMLView on iOS/iPadOS, so don't try.
    const confirmed = await confirmLargeBatch(totalToMove, rescheduleNotMove, 'today', 'Move Yesterday to Today', 'scheduleYesterdayOpenToToday')
    if (!confirmed) {
      return { success: false }
    }

    // First process the items in the calendar note(s)
    let c = 0
    if (calendarNoteParasWithoutChildren.length > 0) {
      reactWindowData.pluginData.refreshing = ['DT', 'DY']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(['DT', 'DY'])}`)
      // TEST: log the paragraphs
      // logDebug('scheduleYesterdayOpenToToday', `calendarNoteParasWithoutChildren: ${String(calendarNoteParasWithoutChildren.map(p => '{' + p.rawContent + '} (' + p.filename + ')').join('\n'))}`)

      if (rescheduleNotMove) {
        // Determine if we need to use 'today' or schedule to the specific date.
        const newDateStr = config.useTodayDate ? 'today' : getTodaysDateHyphenated()
        // For each para append ' >today'
        for (const dashboardPara of calendarNoteParasWithoutChildren) {
          c++
          CommandBar.showLoading(true, `Scheduling item ${c} to ${newDateStr}`, c / totalToMove)
          logDebug('scheduleYesterdayOpenToToday', `- Scheduling calendar note item ${c}/${totalToMove} "${dashboardPara.content}" to today`)
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
            logWarn('scheduleYesterdayOpenToToday', `Couldn't find calendar note para matching this dashboardPara to reschedule:`)
            clo(dashboardPara, 'dashboardPara')
          }
        }
        logTimer('scheduleYesterdayOpenToToday', thisStartTime, `scheduled ${String(numberScheduled)} open items from yesterday's note to today's`)
      }
      else {
        // For each para move to today's note
        for (const dashboardPara of calendarNoteParasWithoutChildren) {
          c++
          CommandBar.showLoading(true, `Moving item ${c} to today`, c / totalToMove)
          logDebug('scheduleYesterdayOpenToToday', `Moving calendar note item ${c}/${totalToMove} "${dashboardPara.content}" to today`)
          const res = await moveItemBetweenCalendarNotes(dashboardPara.filename, todayDateStr, dashboardPara.rawContent, config.newTaskSectionHeading, config.newTaskSectionHeadingLevel)
          if (res) {
            // logDebug('scheduleYesterdayOpenToToday', `-> appeared to move item succesfully`)
            numberScheduled++
          } else {
            logWarn('scheduleYesterdayOpenToToday', `-> moveFromCalToCal from {yesterdayDateStr} to ${todayDateStr} not successful`)
          }
        }
        logDebug('scheduleYesterdayOpenToToday', `moved ${String(numberScheduled)} open items from yesterday's note to today's`)
        // Update cache to allow it to be re-read on refresh
        DataStore.updateCache(yesterdaysNote, false)
      }
    }

    // Now do the same for items scheduled to yesterday from other notes
    if (refParasWithoutChildren.length > 0) {
      // TEST: log the paragraphs
      // logDebug('scheduleYesterdayOpenToToday', `refParasWithoutChildren: ${String(refParasWithoutChildren.map(p => '{' + p.rawContent + '} (' + p.filename + ')').join('\n'))}`)

      // Show working indicator
      reactWindowData.pluginData.refreshing = ['DT', 'DY']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(['DT', 'DY'])}`)

      // Determine if we need to use 'today' or schedule to the specific date.
      logDebug('scheduleYesterdayOpenToToday', `useTodayDate setting is ${String(config.useTodayDate)}`)
      const newDateStr = config.useTodayDate ? 'today' : getTodaysDateHyphenated()
      // For each para append the date to move to
      for (const dashboardPara of refParasWithoutChildren) {
        c++
        CommandBar.showLoading(true, `Scheduling item ${c} to ${newDateStr}`, c / totalToMove)
        const thisNote = DataStore.noteByFilename(dashboardPara.filename, dashboardPara.noteType)
        if (!thisNote) {
          logWarn('scheduleYesterdayOpenToToday', `Oddly I can't find the note for "${dashboardPara.content}", so can't process this item`)
        } else {
          // Convert each reduced para back to the full one to update.
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p) {
            p.content = replaceArrowDatesInString(p.content, `>${newDateStr}`)
            logDebug('scheduleYesterdayOpenToToday', `- Scheduling referenced para ${c}/${totalToMove} from note ${thisNote.filename} with new content "${p.content}"`)
            thisNote.updateParagraph(p)
            numberScheduled++
            // Update cache to allow it to be re-read on refresh
            DataStore.updateCache(thisNote, false)
          } else {
            logWarn('scheduleYesterdayOpenToToday', `Couldn't find ref para matching this dashboardPara to reschedule:`)
            clo(dashboardPara, 'dashboardPara')
          }
        }
      }
      logTimer('scheduleYesterdayOpenToToday', thisStartTime, `scheduled ${String(numberScheduled)} open items from yesterday in project notes to today`)
    } else {
      // logDebug('scheduleYesterdayOpenToToday', `- No ref paras for yesterday found`)
    }
    // remove progress indicators
    CommandBar.showLoading(false)
    reactWindowData.pluginData.refreshing = false
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `scheduleYesterdayOpenToToday finished `)

    // Update display of these 2 sections
    return { success: true, actionsOnSuccess: ['REFRESH_SECTION_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], sectionCodes: ['DY', 'DT', 'OVERDUE'] }
  } catch (error) {
    logError('scheduleYesterdayOpenToToday', error.message)
    return { success: false }
  }
}

/**
 * Function to schedule or move all open items from today to tomorrow
 * Uses config setting 'rescheduleNotMove' to decide whether to reschedule or move.
 * @param {MessageDataObject} data
 * @param {boolean} moveOnlyShown - if true, only move items currently shown in the section
 * @returns {TBridgeClickHandlerResult}
 */
export async function scheduleTodayToTomorrow(
  data: MessageDataObject,
  moveOnlyShown: boolean = false,
): Promise<TBridgeClickHandlerResult> {
  try {
    let numberScheduled = 0
    const config: TDashboardSettings = await getDashboardSettings()
    // Override one config item so we can work on separate dated vs scheduled items
    config.separateSectionForReferencedNotes = true
    const thisStartTime = new Date()
    const reactWindowData: any = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
    const currentMaxPriority = reactWindowData?.pluginData?.currentMaxPriorityFromAllVisibleSections ?? NaN

    // If called with modifierKey 'meta', then toggle from usual config.rescheduleNotMove behaviour to the opposite
    const rescheduleNotMove = data.modifierKey === 'meta' ? !config.rescheduleNotMove : config.rescheduleNotMove
    if (data.modifierKey === 'meta' && rescheduleNotMove !== config.rescheduleNotMove) {
      logDebug('scheduleTodayToTomorrow', `Starting with rescheduleNotMove setting overridden toggled to ${String(rescheduleNotMove)}`)
    }
    logDebug('scheduleTodayToTomorrow', `starting with moveOnlyShown ${String(moveOnlyShown)}`)

    // Get paras for all open items in today's note
    // Note: this could be taken from pluginData's DT section data, but it's very quick to generate, and guarantees that we're using fresh data
    const todayDateStr = getTodaysDateUnhyphenated()
    const tomorrowDateStr = new moment().add(1, 'days').format('YYYYMMDD')
    const tomorrowISODateStr = new moment().add(1, 'days').format('YYYY-MM-DD')
    const todaysNote = DataStore.calendarNoteByDateString(todayDateStr)
    if (!todaysNote) {
      logWarn('scheduleTodayToTomorrow', `Oddly I can't find a daily note for today (${todayDateStr})`)
      return { success: false }
    } else {
      logDebug('scheduleTodayToTomorrow', `Starting with today's note (${todayDateStr})`)
    }

    // Get list of open tasks/checklists from this calendar note
    // First, override one config item so we can work on separate dated vs scheduled items
    config.separateSectionForReferencedNotes = true
    const [calendarNoteParas, refParas] = await getOpenItemParasForTimePeriod(todaysNote.filename, 'day', config)

    // If moveOnlyShown is true, filter to only items with priority >= currentMaxPriorityFromAllVisibleSections
    let calendarNoteParasToMove = [...calendarNoteParas]
    let refParasToMove = [...refParas]
    if (moveOnlyShown && (!isNaN(currentMaxPriority))) {
      [calendarNoteParasToMove, refParasToMove] = filterParasByPriority(
      calendarNoteParas,
      refParas,
      currentMaxPriority,
      'scheduleTodayToTomorrow',
    )
  } else {
    logDebug('scheduleTodayToTomorrow', `Not filtering to only shown items because moveOnlyShown is false or currentMaxPriorityFromAllVisibleSections is undefined`)
  }

    const initialTotalToMove = calendarNoteParasToMove.length + refParasToMove.length

    // Remove child items from the lists
    const calendarNoteParasWithoutChildren = removeChildItems(calendarNoteParasToMove)
    const refParasWithoutChildren = removeChildItems(refParasToMove)
    const totalToMove = calendarNoteParasWithoutChildren.length + refParasWithoutChildren.length
    if (totalToMove !== initialTotalToMove) {
      logDebug('scheduleTodayToTomorrow', `- Excluding children reduced total to move from ${initialTotalToMove} to ${totalToMove}`)
    }

    // If there are lots, then double check whether to proceed.
    // Note: platform limitation: can't run CommandBar from HTMLView on iOS/iPadOS
    const confirmed = await confirmLargeBatch(totalToMove, rescheduleNotMove, 'tomorrow', 'Move Today to Tomorrow', 'scheduleTodayToTomorrow')
    if (!confirmed) {
      return { success: false }
    }

    // First process the items in the calendar note(s)
    let c = 0
    if (calendarNoteParasWithoutChildren.length > 0) {
      reactWindowData.pluginData.refreshing = ['DT', 'DO']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(['DT', 'DO'])}`)
      // TEST: log the paragraphs
      logDebug('scheduleTodayToTomorrow', `calendarNoteParasWithoutChildren: ${String(calendarNoteParasWithoutChildren.map(p => '{' + p.rawContent + '} (' + p.filename + ')').join('\n'))}`)


      if (rescheduleNotMove) {
        // For each para append ' >' and tomorrow's ISO date
        for (const dashboardPara of calendarNoteParasWithoutChildren) {
          c++
          CommandBar.showLoading(true, `Scheduling item ${c} to tomorrow`, c / totalToMove)
          logDebug('scheduleTodayToTomorrow', `- Scheduling item ${c}/${totalToMove} "${dashboardPara.content}" to tomorrow`)
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
            logWarn('scheduleTodayToTomorrow', `Couldn't find calendar note para matching this dashboardPara to reschedule:`)
            clo(dashboardPara, 'dashboardPara')
          }
        }
        logDebug('scheduleTodayToTomorrow', `scheduled ${String(numberScheduled)} open items from today's note`)
      }
      else {
        // For each para move to tomorrow's note
        for (const dashboardPara of calendarNoteParasWithoutChildren) {
          c++
          CommandBar.showLoading(true, `Moving item ${c} to tomorrow`, c / totalToMove)
          logDebug('scheduleTodayToTomorrow', `Moving item ${c}/${totalToMove} "${dashboardPara.content}" to tomorrow`)
          // TEST: Make work for Teamspace notes as well.
          const res = await moveItemBetweenCalendarNotes(dashboardPara.filename, tomorrowISODateStr, dashboardPara.rawContent, config.newTaskSectionHeading, config.newTaskSectionHeadingLevel)
          if (res) {
            // logDebug('scheduleTodayToTomorrow', `-> appeared to move item succesfully`)
            numberScheduled++
          } else {
            logWarn('scheduleTodayToTomorrow', `-> moveFromCalToCal from ${todayDateStr} to ${tomorrowDateStr} not successful`)
          }
        }
        logTimer('scheduleTodayToTomorrow', thisStartTime, `moved ${String(numberScheduled)} open items from today to tomorrow's note`)
        // Update cache to allow it to be re-read on refresh
        DataStore.updateCache(todaysNote, false)
      }
    }

    // Now do the same for items scheduled to today from other notes
    if (refParasWithoutChildren.length > 0) {
    // Show working indicator
      reactWindowData.pluginData.refreshing = ['DT', 'DO']
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(['DT', 'DO'])}`)

      // For each para append ' >tomorrow' (the actual ISO date not literal string 'tomorrow')
      for (const dashboardPara of refParasWithoutChildren) {
        c++
        CommandBar.showLoading(true, `Scheduling item ${c} to tomorrow`, c / totalToMove)
        const thisNote = DataStore.noteByFilename(dashboardPara.filename, dashboardPara.noteType)
        if (!thisNote) {
          logWarn('scheduleTodayToTomorrow', `Oddly I can't find the note for "${dashboardPara.content}", so can't process this item`)
        } else {
          // Convert each reduced para back to the full one to update.
          const p = getParagraphFromStaticObject(dashboardPara)
          if (p && p.note) {
            p.content = replaceArrowDatesInString(p.content, `>${tomorrowISODateStr}`)
            logDebug('scheduleTodayToTomorrow', `- Scheduling referenced para ${c}/${totalToMove} from note ${thisNote.filename} with new content "${p.content}"`)
            thisNote.updateParagraph(p)
            numberScheduled++
          } else {
            logWarn('scheduleTodayToTomorrow', `Couldn't find ref para matching this dashboardPara to reschedule:`)
            clo(dashboardPara, 'dashboardPara')
          }
          // Update cache to allow it to be re-read on refresh
          DataStore.updateCache(thisNote, false)
        }
      }
      logTimer('scheduleTodayToTomorrow', thisStartTime, `scheduled ${String(numberScheduled)} open items from today in project notes to tomorrow`)
    } else {
      // logDebug('scheduleTodayToTomorrow', `- No ref paras for today found`)
    }

    // remove progress indicators
    CommandBar.showLoading(false)
    reactWindowData.pluginData.refreshing = false
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `scheduleTodayToTomorrow finished `)

    // Update display of these 2 sections
    return { success: true, actionsOnSuccess: ['REFRESH_SECTION_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], sectionCodes: ['DT', 'DO', 'OVERDUE'] }
  } catch (error) {
    logError('scheduleTodayToTomorrow', error.message)
    return { success: false }
  }
}

//-----------------------------------------------------------------
/**
 * Function to schedule or move all open overdue tasks from their notes to today
 * Uses config setting 'rescheduleNotMove' to decide whether to reschedule or move.
 * Note: This uses an API call that doesn't include open checklist items.
 * TODO: use 'moveOnlyShown' to filter to only items currently shown in the section
 * @param {MessageDataObject} data
 * @param {boolean} moveOnlyShown - if true, only move items currently shown in the section
 * @returns {TBridgeClickHandlerResult}
 */
export async function scheduleAllOverdueOpenToToday(
  data: MessageDataObject,
  moveOnlyShown: boolean = false,
): Promise<TBridgeClickHandlerResult> {
  try {
    let numberChanged = 0
    const config: TDashboardSettings = await getDashboardSettings()
    const thisStartTime = new Date()
    const reactWindowData: any = await getGlobalSharedData(WEBVIEW_WINDOW_ID)

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
    // const calendarNoteParas: Array<TParagraph> = []
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

    // TODO: Apply the filtering here as well


    // Remove child items from the list of paras
    const dashboardParas = makeDashboardParas(overdueParas)
    const overdueParasWithoutChildren = removeChildItems(dashboardParas)
    const totalToMove = overdueParasWithoutChildren.length
    if (totalToMove !== initialTotalOverdue) {
      logDebug('scheduleAllOverdueOpenToToday', `- Excluding children reduced total to move from ${initialTotalOverdue} to ${totalToMove}`)
    }

    logTimer('scheduleAllOverdueOpenToToday', thisStartTime, `Found ${totalToMove} overdue items to ${config.rescheduleNotMove ? 'rescheduleItem' : 'move'} to today`)

    const todayDateStr = getTodaysDateHyphenated()

    // If there are lots, then double check whether to proceed
    // Note: platform limitation: can't run CommandBar from HTMLView on iOS/iPadOS
    const confirmed = await confirmLargeBatch(totalToMove, config.rescheduleNotMove, 'today', 'Move Overdue to Today', 'scheduleAllOverdueOpenToToday')
    if (!confirmed) {
      return { success: false }
    }

    let c = 0
    if (overdueParasWithoutChildren.length > 0) {
      // start a progress indicator
      if (reactWindowData?.pluginData) {
        reactWindowData.pluginData.refreshing = ['OVERDUE']
        await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(['OVERDUE'])}`)
      }

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
            const res = await moveItemBetweenCalendarNotes(
              thisNote.filename,
              todayDateStr,
              dashboardPara.rawContent,
              config.newTaskSectionHeading,
              config.newTaskSectionHeadingLevel,
            )
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
