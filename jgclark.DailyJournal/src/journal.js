// @flow
//---------------------------------------------------------------
// Journalling plugin for NotePlan
// Jonathan Clark
// last update 23.11.2022 for v0.15.0 by @jgclark
//---------------------------------------------------------------

import strftime from 'strftime'
import pluginJson from '../plugin.json'
import { getJournalSettings, type JournalConfigType, processJournalQuestions, returnAnsweredQuestion } from './journalHelpers'
import { getWeek, isDailyNote, isWeeklyNote, isMonthlyNote, isQuarterlyNote, isYearlyNote } from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
// import { findHeadingStartsWith } from '@helpers/paragraph'
import NPTemplating from 'NPTemplating'
import { getAttributes } from '@helpers/NPFrontMatter'
import { getInputTrimmed, isInt, showMessage, showMessageYesNoCancel } from '@helpers/userInput'

//---------------------------------------------------------------

// Start the currently open monthly note with the user's Monthly Note Template
export async function monthStart(): Promise<void> {
  try {
    const config: JournalConfigType = await getJournalSettings()

    // First check we can get the Template
    let templateData = ''
    if (config.monthlyTemplateTitle === '') {
      throw new Error(`There is no monthly template specified in the plugin settings, so can't continue.`)
    } else {
      templateData = await NPTemplating.getTemplate(config.monthlyTemplateTitle)
      if (templateData == null || templateData === '') {
        throw new Error(`Cannot find Template '${config.monthlyTemplateTitle}' so can't continue.`)
      }
    }

    if (Editor.note && isMonthlyNote(Editor.note)) {
      // apply monthly template in the currently-open monthly note
      logDebug('monthStart', `Will work on the open monthly note '${displayTitle(Editor.note)}'`)
    } else {
      // apply monthly template in the current monthly note
      logInfo('monthStart', `Started without a monthly note open, so will open and work in this month's note.`)
      // open today's date in the main window, and read content
      await Editor.openNoteByDate(new Date(), false, 0, 0, false, 'month') // open the 'monthly' note for today
      logDebug('monthStart', `- for '${displayTitle(Editor.note)}'`)
    }

    // Then render the template, using recommended decoupled method of invoking a different plugin
    const result = await DataStore.invokePluginCommandByName('renderTemplate', 'np.Templating', [config.monthlyTemplateTitle])
    if (result == null || result === '') {
      throw new Error(`No result from running Template '${config.monthlyTemplateTitle}'. Stopping.`)
    }
    // Work out where to insert it in the note, by reading the template, and checking
    // the frontmatter attributes for a 'location' field (append/insert/cursor)
    const attrs = getAttributes(templateData, true)
    const requestedTemplateLocation = attrs.location ?? 'insert'
    let pos = 0
    switch (requestedTemplateLocation) {
      case 'insert': {
        logDebug('monthStart', `- Will insert to start of Editor`)
        Editor.insertTextAtCharacterIndex(result, 0)
        break
      }
      case 'append': {
        pos = Editor.content?.length ?? 0 // end
        logDebug('monthStart', `- Will insert to end of Editor (pos ${pos})`)
        Editor.insertTextAtCharacterIndex(result, pos)
        break
      }
      case 'cursor': {
        logDebug('monthStart', `- Will insert to Editor at cursor position`)
        Editor.insertTextAtCursor(result)
        break
      }
    }
  } catch (error) {
    logError('monthStart', error.message)
    await showMessage(`/monthStart command: ${error.message}`)
    return
  }
}

//---------------------------------------------------------------

// Start the currently open weekly note with the user's Weekly Note Template
export async function weekStart(): Promise<void> {
  try {
    const config: JournalConfigType = await getJournalSettings()

    // First check we can get the Template
    let templateData = ''
    if (config.weeklyTemplateTitle === '') {
      throw new Error(`There is no weekly template specified in the plugin settings, so can't continue.`)
    } else {
      templateData = await NPTemplating.getTemplate(config.weeklyTemplateTitle)
      if (templateData == null || templateData === '') {
        throw new Error(`Cannot find Template '${config.weeklyTemplateTitle}' so can't continue.`)
      }
    }

    if (Editor.note && isWeeklyNote(Editor.note)) {
      // apply weekly template in the currently-open weekly note
      logDebug('weekStart', `Will work on the open weekly note '${displayTitle(Editor.note)}'`)
    } else {
      // apply weekly template in the current weekly note
      logInfo('weekStart', `Started without a weekly note open, so will open and work in this week's note.`)
      // open today's date in the main window, and read content
      await Editor.openNoteByDate(new Date(), false, 0, 0, false, 'week') // open the 'weekly' note for today
      logDebug('weekStart', `- for '${displayTitle(Editor.note)}'`)
    }

    // Then render the template, using recommended decoupled method of invoking a different plugin
    const result = await DataStore.invokePluginCommandByName('renderTemplate', 'np.Templating', [config.weeklyTemplateTitle])
    if (result == null || result === '') {
      throw new Error(`No result from running Template '${config.weeklyTemplateTitle}'. Stopping.`)
    }
    // Work out where to insert it in the note, by reading the template, and checking
    // the frontmatter attributes for a 'location' field (append/insert/cursor)
    const attrs = getAttributes(templateData, true)
    const requestedTemplateLocation = attrs.location ?? 'insert'
    let pos = 0
    switch (requestedTemplateLocation) {
      case 'insert': {
        logDebug('weekStart', `- Will insert to start of Editor`)
        Editor.insertTextAtCharacterIndex(result, 0)
        break
      }
      case 'append': {
        pos = Editor.content?.length ?? 0 // end
        logDebug('weekStart', `- Will insert to end of Editor (pos ${pos})`)
        Editor.insertTextAtCharacterIndex(result, pos)
        break
      }
      case 'cursor': {
        logDebug('weekStart', `- Will insert to Editor at cursor position`)
        Editor.insertTextAtCursor(result)
        break
      }
    }
  } catch (error) {
    logError('weekStart', error.message)
    await showMessage(`/weekStart command: ${error.message}`)
    return
  }
}

//---------------------------------------------------------------

// Start today's daily note with the user's Daily Note Template
export async function todayStart(): Promise<void> {
  try {
    await dayStart(true)
  } catch (error) {
    await showMessage(error)
  }
}

// Start the currently open daily note with the user's Daily Note Template
export async function dayStart(workToday: boolean = false): Promise<void> {
  try {
    const config: JournalConfigType = await getJournalSettings()
    if (Editor.note && isDailyNote(Editor.note) && !workToday) {
      // apply daily template in the currently-open daily note
      logDebug('dayStart', `Will work on the open daily note '${displayTitle(Editor.note)}'`)
    } else {
      // apply daily template in today's daily note
      logInfo('dayStart', `Started without a daily note open, so will open and work in this day's note.`)
      // open today's date in the main window, and read content
      await Editor.openNoteByDate(new Date(), false, 0, 0, false, 'day') // open the 'daily' note for today
      logDebug('dayStart', `for '${displayTitle(Editor.note)}'`)
    }

    // First check we can get the Template
    const templateData = await NPTemplating.getTemplate(config.templateTitle)
    if (templateData == null || templateData === '') {
      throw new Error(`Cannot find Template '${config.templateTitle}'. Stopping.`)
    }

    // render the template, using recommended decoupled method of invoking a different plugin
    const result = await DataStore.invokePluginCommandByName('renderTemplate', 'np.Templating', [config.templateTitle])
    if (result == null || result === '') {
      throw new Error(`No result from running Template '${config.templateTitle}'. Stopping.`)
    }
    // Work out where to insert it in the note, by reading the template, and checking
    // the frontmatter attributes for a 'location' field (append/insert/cursor)
    const attrs = getAttributes(templateData, true)
    const requestedTemplateLocation = attrs.location ?? 'insert'
    let pos = 0
    switch (requestedTemplateLocation) {
      case 'insert': {
        logDebug(pluginJson, `- Will insert to start of Editor`)
        Editor.insertTextAtCharacterIndex(result, 0)
        break
      }
      case 'append': {
        pos = Editor.content?.length ?? 0 // end
        logDebug(pluginJson, `- Will insert to end of Editor (pos ${pos})`)
        Editor.insertTextAtCharacterIndex(result, pos)
        break
      }
      // TODO: change this (if needed), to suit @DW changes 25.2.2023 to 'cursor: <current>'?
      case 'cursor': {
        logDebug(pluginJson, `- Will insert to Editor at cursor position`)
        Editor.insertTextAtCursor(result)
        break
      }
    }
  } catch (error) {
    logError(pluginJson, `(to)dayStart(): ${error.message}`)
    await showMessage(`/(to)dayStart command: ${error.message}`)
  }
}

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
