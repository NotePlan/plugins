// @flow
//---------------------------------------------------------------
// Add Templates to Periodic notes at start and end of period
// Jonathan Clark
// last update 2025-11-01 for v1.15.2 by @jgclark
//---------------------------------------------------------------

import { type JournalConfigType, getJournalSettings } from './journalHelpers'
import { isDailyNote, isMonthlyNote, isWeeklyNote } from '@helpers/dateTime'
import { logDebug, logError, logInfo } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getAttributes } from '@helpers/NPFrontMatter'
import { showMessage } from '@helpers/userInput'
import NPTemplating from 'NPTemplating'

//---------------------------------------------------------------

// Configuration mapping for different note types
const NOTE_TYPE_CONFIG = {
  day: {
    noteType: 'day',
    isNoteType: isDailyNote,
    startTemplateKey: 'startDailyTemplateTitle',
    endTemplateKey: 'endDailyTemplateTitle',
    startCommandName: 'dayStart',
    endCommandName: 'dayEnd'
  },
  week: {
    noteType: 'week',
    isNoteType: isWeeklyNote,
    startTemplateKey: 'startWeeklyTemplateTitle', 
    endTemplateKey: 'endWeeklyTemplateTitle', 
    startCommandName: 'weekStart',
    endCommandName: 'weekEnd'
  },
  month: {
    noteType: 'month', 
    isNoteType: isMonthlyNote,
    startTemplateKey: 'startMonthlyTemplateTitle',
    endTemplateKey: 'endMonthlyTemplateTitle',
    startCommandName: 'monthStart',
    endCommandName: 'monthEnd'
  }
}

//---------------------------------------------------------------

/**
 * Ensure the correct note type is open for template application
 * @param {Function} isNoteType - Function to check if current note is correct type
 * @param {string} noteType - Type of note ('day', 'week', 'month')
 * @param {boolean} workToday - Whether to force opening today's note
 */
async function ensureCorrectNoteOpen(isNoteType: Function, noteType: string, workToday: boolean): Promise<void> {
  if (Editor.note && isNoteType(Editor.note) && !workToday) {
    // $FlowIgnore(invalid-computed-property-type) .note is a superset of CoreNoteFields
    logDebug('ensureCorrectNoteOpen', `Will work on the open ${noteType} note '${displayTitle(Editor.note)}'`)
  } else {
    logInfo('ensureCorrectNoteOpen', `Started without a ${noteType} note open, so will open and work in this ${noteType}'s note.`)
    await Editor.openNoteByDate(new Date(), false, 0, 0, false, noteType)
    // $FlowIgnore(invalid-computed-property-type) .note is a superset of CoreNoteFields
    logDebug('ensureCorrectNoteOpen', `- for '${displayTitle(Editor.note)}'`)
  }
}

/**
 * Render template and insert it into the current note
 * @param {string} templateData - Raw template data
 * @param {string} templateTitle - Name of the template
 * @param {string} commandName - Name of the command for logging
 */
async function renderAndInsertTemplate(
  templateData: string,
  templateTitle: string,
  commandName: string,
): Promise<void> {
  // Render the template, using recommended decoupled method of invoking a different plugin
  const result = await DataStore.invokePluginCommandByName('renderTemplate', 'np.Templating', [templateTitle])
  // TEST: turning off error message for now, as it fires on Templates that only do background work.
  // if (result == null || result === '') {
  //   throw new Error(`No result from running Template '${templateTitle}'. Stopping.`)
  // }
  
  // Work out where to insert it in the note, by reading the template, and checking
  // the frontmatter attributes for a 'location' field (append/insert/cursor)
  const attrs = getAttributes(templateData, true)
  const requestedTemplateLocation = attrs.location ?? 'insert'
  let pos = 0
  switch (requestedTemplateLocation) {
    case 'insert': {
      logDebug(commandName, `- Will insert to start of Editor`)
      Editor.insertTextAtCharacterIndex(result, 0)
      break
    }
    case 'append': {
      pos = Editor.content?.length ?? 0 // end
      logDebug(commandName, `- Will insert to end of Editor (pos ${pos})`)
      Editor.insertTextAtCharacterIndex(result, pos)
      break
    }
    // Note: unsure if this works.
    case 'cursor': {
      logDebug(commandName, `- Will insert to Editor at cursor position`)
      Editor.insertTextAtCursor(result)
      break
    }
  }
}

/**
 * Generic template application function for different note types
 * @param {string} noteType - Type of note ('day', 'week', 'month')
 * @param {boolean} workToday - Whether to force opening today's note
 * @param {boolean} isEnd - Whether to apply the end template
 */
async function applyTemplateToNote(
  noteType: string, workToday: boolean = false, isEnd: boolean = false
): Promise<void> {
  try {
    let config
    switch (noteType) {
      case 'day':
        config = NOTE_TYPE_CONFIG.day
        break
      case 'week':
        config = NOTE_TYPE_CONFIG.week
        break
      case 'month':
        config = NOTE_TYPE_CONFIG.month
        break
      default:
        throw new Error(`Unsupported note type: ${noteType}`)
    }

    const journalConfig: JournalConfigType = await getJournalSettings()
    
    // First check we can get the Template
    let templateTitle = ''
    if (isEnd) {
      switch (noteType) {
        case 'day':
          templateTitle = journalConfig.endDailyTemplateTitle
          break
        case 'week':
          templateTitle = journalConfig.endWeeklyTemplateTitle
          break
        case 'month':
          templateTitle = journalConfig.endMonthlyTemplateTitle
          break
      }
    } else {
      switch (noteType) {
        case 'day':
          templateTitle = journalConfig.startDailyTemplateTitle
          break
        case 'week':
          templateTitle = journalConfig.startWeeklyTemplateTitle
          break
        case 'month':
          templateTitle = journalConfig.startMonthlyTemplateTitle
          break
      }
    }
    if (!templateTitle || templateTitle === '') {
      throw new Error(`There is no ${noteType} template specified in the plugin settings, so can't continue.`)
    }
    
    const templateData = await NPTemplating.getTemplateContent(templateTitle)
    if (templateData == null || templateData === '') {
      throw new Error(`Cannot find Template '${templateTitle}' so can't continue.`)
    }

    // Handle note opening
    await ensureCorrectNoteOpen(config.isNoteType, config.noteType, workToday)
    
    // Render and insert template
    const commandName = isEnd ? config.endCommandName : config.startCommandName
    await renderAndInsertTemplate(templateData, templateTitle, commandName)
    
  } catch (error) {
    logError('applyTemplateToNote', error.message)
    await showMessage(`Error: ${error.message}`)
  }
}

//---------------------------------------------------------------

// Apply user's (start) Daily Note Template open daily note
export async function dayStart(workToday: boolean = false): Promise<void> {
  await applyTemplateToNote('day', workToday, false)
}

// Apply user's (start) Daily Note Template to today's daily note
export async function todayStart(): Promise<void> {
  await dayStart(true)
}

// Apply user's (start) Weekly Note Template to the open weekly note 
export async function weekStart(): Promise<void> {
  await applyTemplateToNote('week', false, false)
}

// Apply user's (start) Monthly Note Template to the open monthly note 
export async function monthStart(): Promise<void> {
  await applyTemplateToNote('month', false, false)
}

// Apply user's (end) Daily Note Template to the currently open daily note 
export async function dayEnd(workToday: boolean = false): Promise<void> {
  await applyTemplateToNote('day', workToday, true)
}

// Apply user's (end) Daily Note Template to today's daily note
export async function todayEnd(): Promise<void> {
  await dayEnd(true)
}

// Apply user's (end) Weekly Note Template to the currently open weekly note 
export async function weekEnd(): Promise<void> {
  await applyTemplateToNote('week', false, true)
}

// Apply user's (end) Monthly Note Template to the currently open monthly note 
export async function monthEnd(): Promise<void> {
  await applyTemplateToNote('month', false, true)
}
