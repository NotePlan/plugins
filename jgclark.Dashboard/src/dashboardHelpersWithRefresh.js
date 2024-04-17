// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions that need to refresh Dashboard
// Last updated 4.4.2024 for v1.1.2 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import {
  getOpenItemParasForCurrentTimePeriod,
  getRelevantOverdueTasks,
  getSettings,
  moveItemBetweenCalendarNotes,
} from './dashboardHelpers'
import { showDashboard } from './HTMLGeneratorGrid'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import {
  getDateStringFromCalendarFilename,
  getTodaysDateHyphenated,
  removeDateTagsAndToday,
} from '@helpers/dateTime'
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
      logWarn('scheduleAllYesterdayOpenToToday', `Oddly I can't find a daily note for yesterday`)
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
    if (combinedSortedParas.length > 0) {
      await CommandBar.onAsyncThread() // Note: this is needed for showLoading to work, though I don't know why
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
          const res = await moveItemBetweenCalendarNotes(yesterdayDateStr, todayDateStr, para.content, config.newTaskSectionHeading ?? '')
          if (res) {
            // logDebug('scheduleAllYesterdayOpenToToday', `-> appeared to move item succesfully`)
            numberScheduled++
          } else {
            logWarn('scheduleAllYesterdayOpenToToday', `-> moveFromCalToCal from {yesterdayDateStr} to ${todayDateStr} not successful`)
          }
        }
        logDebug('scheduleAllYesterdayOpenToToday', `moved ${String(numberScheduled)} open items from yesterday to today's note`)
        // Update cache to allow it to be re-read on refresh
        DataStore.updateCache(yesterdaysNote)
      }
    }

    // Now do the same for items scheduled to yesterday from other notes
    if (sortedRefParas.length > 0) {
      // For each para append ' >today'
      for (const para of sortedRefParas) {
        c++
        CommandBar.showLoading(true, `Scheduling item ${c} to today`, c / totalToMove)
        const thisNote = para.note
        if (!thisNote) {
          logWarn('scheduleAllYesterdayOpenToToday', `Oddly I can't find the note for {${para.content}}, so can't process this item`)
        } else {
          para.content = `${removeDateTagsAndToday(para.content)} >today`
          logDebug('scheduleAllYesterdayOpenToToday', `- scheduling referenced para from note ${thisNote.filename} with new content {${para.content}} `)
          // FIXME: This fails, and I can't see why
          thisNote.updateParagraph(para)
          numberScheduled++
          // Note: Whether this is used seems not to make any difference
          DataStore.updateCache(thisNote)
        }
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

/**
 * Function to schedule or move all open items from today to tomorrow
 * Uses config setting 'rescheduleNotMove' to decide whether to reschedule or move.
 * @param {boolean?} refreshDashboard?
 * @returns 
 */
export async function scheduleAllTodayTomorrow(refreshDashboard: boolean = true): Promise<number> {
  try {

    let numberScheduled = 0
    const config = await getSettings()
    // For these purposes override one config item:
    config.separateSectionForReferencedNotes = true

    // Get paras for all open items in yesterday's note
    const todayDateStr = getTodaysDateHyphenated()
    const tomorrowDateStr = new moment().add(1, 'days').format('YYYYMMDD')
    const tomorrowISODateStr = new moment().add(1, 'days').format('YYYY-MM-DD')
    const todaysNote = DataStore.calendarNoteByDateString(todayDateStr)
    if (!todaysNote) {
      logWarn('scheduleAllTodayTomorrow', `Oddly I can't find a daily note for today`)
      return 0
    } else {
      logDebug('scheduleAllTodayTomorrow', `Starting, with refreshDashboard = ${String(refreshDashboard)}`)
    }

    // Get list of open tasks/checklists from this calendar note
    const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForCurrentTimePeriod("day", todaysNote, config)
    const totalToMove = combinedSortedParas.length + sortedRefParas.length

    // If there are lots, then double check whether to proceed
    if (totalToMove > checkThreshold) {
      const res = await showMessageYesNo(`Are you sure you want to ${config.rescheduleNotMove ? 'schedule' : 'nove'} ${totalToMove} items to tomorrow?`, ['Yes', 'No'], 'Move Yesterday to Today', false)
      if (res !== 'Yes') {
        logDebug('scheduleAllTodayTomorrow', 'User cancelled operation.')
        return 0
      }
    }

    let c = 0
    if (combinedSortedParas.length > 0) {
      await CommandBar.onAsyncThread() // Note: this is needed for showLoading to work, though I don't know why
      if (config.rescheduleNotMove) {
        // For each para append ' >' and tomorrow's ISO date
        for (const para of combinedSortedParas) {
          c++
          CommandBar.showLoading(true, `Scheduling item ${c} to tomorrow`, c / totalToMove)
          para.content = `${para.content} >${tomorrowISODateStr}`
          logDebug('scheduleAllTodayTomorrow', `- scheduling {${para.content}} to tomorrow`)
          numberScheduled++
        }
        todaysNote.updateParagraphs(combinedSortedParas)
        logDebug('scheduleAllTodayTomorrow', `scheduled ${String(numberScheduled)} open items from today's note`)
      } else {
        // For each para move to tomorrow's note
        for (const para of combinedSortedParas) {
          logDebug('scheduleAllTodayTomorrow', `- moving {${para.content}} to tomorrow`)
          c++
          CommandBar.showLoading(true, `Moving item ${c} to tomorrow`, c / totalToMove)
          const res = await moveItemBetweenCalendarNotes(todayDateStr, tomorrowDateStr, para.content, config.newTaskSectionHeading ?? '')
          if (res) {
            // logDebug('scheduleAllTodayTomorrow', `-> appeared to move item succesfully`)
            numberScheduled++
          } else {
            logWarn('scheduleAllTodayTomorrow', `-> moveFromCalToCal from {todayDateStr} to ${tomorrowDateStr} not successful`)
          }
        }
        logDebug('scheduleAllTodayTomorrow', `moved ${String(numberScheduled)} open items from today to tomorrow's note`)
        // Update cache to allow it to be re-read on refresh
        DataStore.updateCache(todaysNote)
      }
    }

    // Now do the same for items scheduled to today from other notes
    if (sortedRefParas.length > 0) {
      // For each para append ' >tomorrow'
      for (const para of sortedRefParas) {
        c++
        CommandBar.showLoading(true, `Scheduling item ${c} to tomorrow`, c / totalToMove)
        const thisNote = para.note
        if (!thisNote) {
          logWarn('scheduleAllTodayTomorrow', `Oddly I can't find the note for {${para.content}}, so can't process this item`)
        } else {
          para.content = `${removeDateTagsAndToday(para.content)} >${tomorrowISODateStr}`
          logDebug('scheduleAllTodayTomorrow', `- scheduling referenced para {${para.content}} from note ${para.note?.filename ?? '?'}`)
          thisNote.updateParagraph(para)
          numberScheduled++
          DataStore.updateCache(thisNote)
        }
      }
      logDebug('scheduleAllTodayTomorrow', `-> scheduled ${String(numberScheduled)} open items from today to tomorrow`)
    }
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    if (refreshDashboard && numberScheduled > 0) {
      logInfo('scheduleAllTodayTomorrow', `moved/scheduled ${String(numberScheduled)} open items from today to tomorrow`)
      logDebug('scheduleAllTodayTomorrow', `-------- Refresh -------------------`)
      await showDashboard('refresh')
    }
    return numberScheduled
  }
  catch (error) {
    logError('dashboard / scheduleAllTodayTomorrow', error.message)
    return 0
  }
}

//-----------------------------------------------------------------
/**
 * Function to schedule or move all open overdue tasks from their notes to today
 * Uses config setting 'rescheduleNotMove' to decide whether to reschedule or move.
 * Note: This uses an API call that doesn't include open checklist items
 * @param {boolean?} refreshDashboard?
 * @returns 
 */
export async function scheduleAllOverdueOpenToToday(refreshDashboard: boolean = true): Promise<number> {
  try {
    let numberChanged = 0
    const config = await getSettings()
    // For these purposes override one config item:
    config.separateSectionForReferencedNotes = true

    // FIXME: need to start a spinner here

    // Get paras for all overdue items in notes
    // Note: we need full TParagraphs, not ReducedParagraphs
    const thisStartTime = new Date()
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
      return 0
    } else {
      logInfo('getDataForDashboard', `Found ${totalOverdue} overdue items to move to today (in ${timer(thisStartTime)})`)
    }

    const todayDateStr = getTodaysDateHyphenated()

    // If there are lots, then double check whether to proceed
    if (totalOverdue > checkThreshold) {
      const res = await showMessageYesNo(`Are you sure you want to ${config.rescheduleNotMove ? 'schedule' : 'nove'} ${totalOverdue} overdue items to today? This can be a slow operation, and can't easily be undone.`, ['Yes', 'No'], 'Move Overdue to Today', false)
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
        logDebug('scheduleAllOverdueOpenToToday', `- scheduling referenced para {${para.content}} from note ${para.filename ?? '?'}`)
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
          const res = await moveItemBetweenCalendarNotes(thisNoteDateStr, todayDateStr, para.content, config.newTaskSectionHeading ?? '')
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
