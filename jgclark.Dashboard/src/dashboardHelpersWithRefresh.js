// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions that need to refresh Dashboard
// Last updated 22.3.2024 for v1.0.0 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import {
  getOpenItemParasForCurrentTimePeriod,
  getSettings
} from './dashboardHelpers'
import { showDashboard } from './HTMLGeneratorGrid'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import {
  getDateStringFromCalendarFilename,
  getTodaysDateHyphenated,
  removeDateTagsAndToday,
} from '@helpers/dateTime'
import { moveItemBetweenCalendarNotes } from '@helpers/NPParagraph'
import { showMessageYesNo } from '@helpers/userInput'

//-----------------------------------------------------------------
// constants

const checkThreshold = 20 // number beyond which to check with user whether to proceed

//-----------------------------------------------------------------
/**
 * Function to schedule or move all open items from yesterday to today
 * Uses config setting 'rescheduleNotMove' to decide whether to reschedule or move.
 * @param {boolean?} refreshDashboard?
 * @returns 
 */
export async function scheduleAllYesterdayOpenToToday(refreshDashboard: boolean = true): Promise<number> {
  try {

    let numberScheduled = 0
    const config = await getSettings()
    // For these purposes override one config item:
    config.separateSectionForReferencedNotes = true

    // Get paras for all open items in yesterday's note
    const yesterdayDateStr = new moment().subtract(1, 'days').format('YYYYMMDD')
    const todayDateStr = getTodaysDateHyphenated()
    const yesterdaysNote = DataStore.calendarNoteByDateString(yesterdayDateStr)
    if (!yesterdaysNote) {
      logWarn('scheduleAllYesterdayOpenToToday', `Can't find a daily note for yesterday`)
      return 0
    } else {
      logDebug('scheduleAllYesterdayOpenToToday', `Starting, with refreshDashboard = ${String(refreshDashboard)}`)
    }

    // Get list of open tasks/checklists from this calendar note
    const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForCurrentTimePeriod("day", yesterdaysNote, config)
    const totalToMove = combinedSortedParas.length + sortedRefParas.length

    // If there are lots, then double check whether to proceed
    if (totalToMove > checkThreshold) {
      const res = await showMessageYesNo(`Are you sure you want to ${config.rescheduleNotMove ? 'schedule' : 'nove'} ${totalToMove} items to today?`, ['Yes', 'No'], 'Move Yesterday to Today', false)
      if (res !== 'Yes') {
        logDebug('scheduleAllYesterdayOpenToToday', 'User cancelled operation.')
        return 0
      }
    }

    let c = 0
    await CommandBar.onAsyncThread() // Note: this is needed for showLoading to work, though I don't know why
    if (combinedSortedParas.length > 0) {
      if (config.rescheduleNotMove) {
        // For each para append ' >today'
        for (const para of combinedSortedParas) {
          c++
          CommandBar.showLoading(true, `Scheduling item ${c} to today`, c / totalToMove)
          para.content = `${para.content} >today`
          logDebug('scheduleAllYesterdayOpenToToday', `- scheduling {${para.content}} to today`)
          numberScheduled++
        }
        yesterdaysNote.updateParagraphs(combinedSortedParas)
        logDebug('scheduleAllYesterdayOpenToToday', `scheduled ${String(numberScheduled)} open items from yesterday's note`)
      } else {
        // For each para move to today's note
        for (const para of combinedSortedParas) {
          logDebug('scheduleAllYesterdayOpenToToday', `- moving {${para.content}} to today`)
          c++
          CommandBar.showLoading(true, `Moving item ${c} to today`, c / totalToMove)
          const res = moveItemBetweenCalendarNotes(yesterdayDateStr, todayDateStr, para.content, config.newTaskSectionHeading ?? '')
          if (res) {
            logDebug('scheduleAllYesterdayOpenToToday', `-> appeared to move item succesfully`)
            numberScheduled++
          } else {
            logWarn('scheduleAllYesterdayOpenToToday', `-> moveFromCalToCal from {yesterdayDateStr} to ${todayDateStr} not successful`)
          }
        }
        logDebug('scheduleAllYesterdayOpenToToday', `moved ${String(numberScheduled)} open items from yesterday to today's note`)
        // Update cache to allow it to be re-read on refresh
        // FIXME: this bit still not working ... is this the wrong logic?
        DataStore.updateCache(yesterdaysNote)
      }
    }

    // Now do the same for items scheduled to yesterday from other notes
    if (sortedRefParas.length > 0) {
      // For each para append ' >today'
      for (const para of sortedRefParas) {
        c++
        CommandBar.showLoading(true, `Scheduling item ${c} to today`, c / totalToMove)
        para.content = `${removeDateTagsAndToday(para.content)} >today`
        logDebug('scheduleAllYesterdayOpenToToday', `- scheduling referenced para {${para.content}} from note ${para.note?.filename ?? '?'}`)
        numberScheduled++
        para.note?.updateParagraph(para)
      }
      logDebug('scheduleAllYesterdayOpenToToday', `-> scheduled ${String(numberScheduled)} open items from yesterday to today`)
    }
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    if (refreshDashboard && numberScheduled > 0) {
      logInfo('scheduleAllYesterdayOpenToToday', `moved/scheduled ${String(numberScheduled)} open items from yesterday to today`)
      logDebug('scheduleAllYesterdayOpenToToday', `-------- Refresh -------------------`)
      await showDashboard('refresh')
    }
    return numberScheduled
  }
  catch (error) {
    logError('dashboard / scheduleAllYesterdayOpenToToday', error.message)
    return 0
  }
}

//-----------------------------------------------------------------
/**
 * Function to schedule or move all open overdue items from their notes to today
 * Uses config setting 'rescheduleNotMove' to decide whether to reschedule or move.
 * @param {boolean?} refreshDashboard?
 * @returns 
 */
export async function scheduleAllOverdueOpenToToday(refreshDashboard: boolean = true): Promise<number> {
  try {

    let numberChanged = 0
    const config = await getSettings()
    // For these purposes override one config item:
    config.separateSectionForReferencedNotes = true

    // Get paras for all overdue items in notes
    const thisStartTime = new Date()
    // $FlowFixMe(incompatible-call) returns $ReadOnlyArray type
    const overdueParas: Array<TParagraph> = await DataStore.listOverdueTasks() // note: does not include open checklist items
    const totalOverdue = overdueParas.length
    if (totalOverdue === 0) {
      logWarn('scheduleAllYesterdayOpenToToday', `Can't find any overdue items, which was not expected.`)
      return 0
    } else {
      logInfo('getDataForDashboard', `Found ${totalOverdue} overdue items to move to today (in ${timer(thisStartTime)})`)
    }

    const todayDateStr = getTodaysDateHyphenated()

    // If there are lots, then double check whether to proceed
    if (totalOverdue > checkThreshold) {
      const res = await showMessageYesNo(`Are you sure you want to ${config.rescheduleNotMove ? 'schedule' : 'nove'} ${totalOverdue} overdue items to today? This can be a slow operation.`, ['Yes', 'No'], 'Move Overdue to Today', false)
      if (res !== 'Yes') {
        logDebug('scheduleAllOverdueOpenToToday', 'User cancelled operation.')
        return 0
      }
    }

    let c = 0
    await CommandBar.onAsyncThread() // Note: this seems to be needed for showLoading to work, though I don't know why
    if (config.rescheduleNotMove) {
      // For each para append ' >today'
      for (const para of overdueParas) {
        c++
        const thisNote = para.note
        if (!thisNote) {
          logWarn('scheduleAllOverdueOpenToToday', `-> can't find note for overdue para {${para.content}}`)
          continue
        }
        CommandBar.showLoading(true, `Scheduling item ${c} to today`, c / totalOverdue)
        para.content = `${removeDateTagsAndToday(para.content)} >today`
        logDebug('scheduleAllOverdueOpenToToday', `- scheduling referenced para {${para.content}} from note ${para.note?.filename ?? '?'}`)
        numberChanged++
        thisNote.updateParagraph(para)
        // Update cache to allow it to be re-read on refresh
        DataStore.updateCache(thisNote)
      }
      logDebug('scheduleAllOverdueOpenToToday', `scheduled ${String(numberChanged)} overdue items to today's note (after ${timer(thisStartTime)})`)

    } else {
      // For each para move to today's note
      for (const para of overdueParas) {
        logDebug('scheduleAllOverdueOpenToToday', `- moving {${para.content}} to today`)
        c++
        CommandBar.showLoading(true, `Moving item ${c} to today`, c / totalOverdue)
        const thisNote = para.note
        if (!thisNote) {
          logWarn('scheduleAllOverdueOpenToToday', `-> can't find note for overdue para {${para.content}}`)
          continue
        }
        const thisNoteType = para.noteType
        if (thisNote && thisNoteType === 'Calendar') {
          const thisNoteDateStr = getDateStringFromCalendarFilename(thisNote.filename, true)
          const res = moveItemBetweenCalendarNotes(thisNoteDateStr, todayDateStr, para.content, config.newTaskSectionHeading ?? '')
          if (res) {
            logDebug('scheduleAllOverdueOpenToToday', `-> appeared to move item succesfully`)
            numberChanged++
          } else {
            logWarn('scheduleAllOverdueOpenToToday', `-> moveFromCalToCal from ${thisNoteDateStr} to ${todayDateStr} not successful`)
          }
        } else {
          CommandBar.showLoading(true, `Scheduling item ${c} to today`, c / totalOverdue)
          para.content = `${removeDateTagsAndToday(para.content)} >today`
          logDebug('scheduleAllOverdueOpenToToday', `- scheduling referenced para {${para.content}} from note ${para.note?.filename ?? '?'}`)
          numberChanged++
          thisNote.updateParagraph(para)
        }
        // Update cache to allow it to be re-read on refresh
        DataStore.updateCache(thisNote)
      }
      logDebug('scheduleAllOverdueOpenToToday', `moved ${String(numberChanged)} overdue items to today's note (after ${timer(thisStartTime)})`)
    }

    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    if (refreshDashboard && numberChanged > 0) {
      logInfo('scheduleAllOverdueOpenToToday', `moved/scheduled ${String(numberChanged)} overdue items to today. Now will ...`)
      logDebug('scheduleAllOverdueOpenToToday', `-------- Refresh -------------------`)
      await showDashboard('refresh')
    }
    return numberChanged
  }
  catch (error) {
    logError('dashboard / scheduleAllOverdueOpenToToday', error.message)
    return 0
  }
}
