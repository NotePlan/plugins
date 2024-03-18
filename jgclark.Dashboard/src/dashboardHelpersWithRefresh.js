// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions that need to refresh Dashboard
// Last updated 15.3.2024 for v1.0.0 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import {
  getOpenItemParasForCurrentTimePeriod,
  getSettings
} from './dashboardHelpers'
import { showDashboard } from './HTMLGeneratorGrid'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import {
  getTodaysDateHyphenated,
  removeDateTagsAndToday,
} from '@helpers/dateTime'
import { moveItemBetweenCalendarNotes } from '@helpers/NPParagraph'

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

    if (combinedSortedParas.length > 0) {
      if (config.rescheduleNotMove) {
        // For each para append ' >today'
        for (const para of combinedSortedParas) {
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
          const res = moveItemBetweenCalendarNotes(yesterdayDateStr, todayDateStr, para.content, config.newTaskSectionHeading ?? '')
          if (res) {
            logDebug('bridgeClickDashboardItem', `-> appeared to move item succesfully`)
            numberScheduled++
          } else {
            logWarn('bridgeClickDashboardItem', `-> moveFromCalToCal to ${todayDateStr} not successful`)
          }
        }
        logDebug('scheduleAllYesterdayOpenToToday', `moved ${String(numberScheduled)} open items from yesterday to today's note`)
      }
    }

    // Now do the same for items scheduled to yesterday from other notes
    if (sortedRefParas.length > 0) {
      // For each para append ' >today'
      for (const para of sortedRefParas) {
        para.content = `${removeDateTagsAndToday(para.content)} >today`
        logDebug('scheduleAllYesterdayOpenToToday', `- scheduling referenced para {${para.content}} from note ${para.note?.filename ?? '?'}`)
        numberScheduled++
        para.note?.updateParagraph(para)
      }
      logDebug('scheduleAllYesterdayOpenToToday', `-> scheduled ${String(numberScheduled)} open items from yesterday to today`)
    }

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
