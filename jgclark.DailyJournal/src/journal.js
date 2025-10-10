// @flow
//---------------------------------------------------------------
// Journalling commands
// Jonathan Clark
// last update 2025-10-10 for v1.0.0 by @jgclark
//---------------------------------------------------------------

import strftime from 'strftime'
import pluginJson from '../plugin.json'
import { processJournalQuestions } from './journalHelpers'
import { getWeek, isDailyNote, isWeeklyNote, isMonthlyNote, isQuarterlyNote, isYearlyNote } from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { showMessageYesNoCancel } from '@helpers/userInput'

//---------------------------------------------------------------
/**
 * Gather answers to daily journal questions, and inserts at the cursor.
 * First checks to see if we're in a daily note; if not, offer to open current daily note first.
 */
export async function dailyJournalQuestions(): Promise<void> {
  try {
    const thisPeriodStr = strftime(`%Y-%m-%d`)
    logDebug(pluginJson, `Starting for day ${thisPeriodStr}`)

    // Open current daily note if wanted
    const { note } = Editor
    if (!note || !isDailyNote(note)) {
      const res = await showMessageYesNoCancel(
        `You don't currently have a daily note open. Would you like me to open the current daily note first?`,
        ['Yes', 'No', 'Cancel'],
        'Daily Journal',
      )
      switch (res) {
        case 'Yes': {
          Editor.openNoteByDate(new Date(), false, 0, 0, true, 'day')
          break
        }
        case 'No': {
          break
        }
        case 'Cancel': {
          return
        }
      }
    }
    await processJournalQuestions('day')
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

/**
 * Gather answers to weekly journal questions, and inserts at the cursor.
 * First checks to see if we're in a weekly note; if not, offer to open current weekly note first.
 */
export async function weeklyJournalQuestions(): Promise<void> {
  try {
    const currentWeekNum = getWeek(new Date())
    const thisPeriodStr = `${strftime(`%Y`)}-W${currentWeekNum}`
    logDebug(pluginJson, `Starting for week ${thisPeriodStr}`)

    // Open current weekly note if wanted
    const { note } = Editor
    if (!note || !isWeeklyNote(note)) {
      const res = await showMessageYesNoCancel(
        `You don't currently have a weekly note open. Would you like me to open the current weekly note first?`,
        ['Yes', 'No', 'Cancel'],
        'Weekly Journal',
      )
      switch (res) {
        case 'Yes': {
          Editor.openNoteByDate(new Date(), false, 0, 0, true, 'week')
          break
        }
        case 'No': {
          break
        }
        case 'Cancel': {
          return
        }
      }
    }
    await processJournalQuestions('week')
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

/**
 * Gather answers to monthly journal questions, and inserts at the cursor.
 * First checks to see if we're in a monthly note; if not, offer to open current monthly note first.
 */
export async function monthlyJournalQuestions(): Promise<void> {
  try {
    const thisPeriodStr = strftime(`%Y-%m`)
    logDebug(pluginJson, `Starting for month ${thisPeriodStr}`)

    // Open current monthly note if wanted
    const { note } = Editor
    if (!note || !isMonthlyNote(note)) {
      const res = await showMessageYesNoCancel(
        `You don't currently have a monthly note open. Would you like me to open the current monthly note first?`,
        ['Yes', 'No', 'Cancel'],
        'Monthly Journal',
      )
      switch (res) {
        case 'Yes': {
          Editor.openNoteByDate(new Date(), false, 0, 0, true, 'month')
          break
        }
        case 'No': {
          break
        }
        case 'Cancel': {
          return
        }
      }
    }
    await processJournalQuestions('month')
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

/**
 * Gather answers to quarterly journal questions, and inserts at the cursor.
 * First checks to see if we're in a quarterly note; if not, offer to open the current one first.
 */
export async function quarterlyJournalQuestions(): Promise<void> {
  try {
    const todaysDate = new Date()
    const y = todaysDate.getFullYear()
    const m = todaysDate.getMonth() // counting from 0
    const thisQ = Math.floor(m / 3) + 1
    const thisPeriodStr = `${strftime(`%Y`)}Q${String(thisQ)}`
    logDebug(pluginJson, `Starting for quarter ${thisPeriodStr}`)

    // Open current quarter note if wanted
    const { note } = Editor
    if (!note || !isQuarterlyNote(note)) {
      const res = await showMessageYesNoCancel(
        `You don't currently have a quarterly note open. Would you like me to open the current quarterly note first?`,
        ['Yes', 'No', 'Cancel'],
        'Quarterly Journal',
      )
      switch (res) {
        case 'Yes': {
          Editor.openNoteByDate(new Date(), false, 0, 0, true, 'quarter')
          break
        }
        case 'No': {
          break
        }
        case 'Cancel': {
          return
        }
      }
    }
    await processJournalQuestions('quarter')
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

/**
 * Gather answers to yearly journal questions, and inserts at the cursor.
 * First checks to see if we're in a yearly note; if not, offer to open the current one first.
 */
export async function yearlyJournalQuestions(): Promise<void> {
  try {
    const todaysDate = new Date()
    const y = todaysDate.getFullYear()
    const thisPeriodStr = strftime(`%Y`)
    logDebug(pluginJson, `Starting for year ${thisPeriodStr}`)

    // Open current yearly note if wanted
    const { note } = Editor
    if (!note || !isYearlyNote(note)) {
      const res = await showMessageYesNoCancel(
        `You don't currently have a yearly note open. Would you like me to open the current yearly note first?`,
        ['Yes', 'No', 'Cancel'],
        'Yearly Journal',
      )
      switch (res) {
        case 'Yes': {
          Editor.openNoteByDate(new Date(), false, 0, 0, true, 'year')
          break
        }
        case 'No': {
          break
        }
        case 'Cancel': {
          return
        }
      }
    }
    await processJournalQuestions('year')
  } catch (error) {
    logError(pluginJson, error.message)
  }
}
