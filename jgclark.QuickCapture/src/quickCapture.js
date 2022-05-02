// @flow
// --------------------------------------------------------------------------------------------------------------------
// QuickCapture plugin for NotePlan
// by Jonathan Clark
// last update v0.8.6, 26.4.2022 by @jgclark
// --------------------------------------------------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'
import { clo, log, logError } from '../../helpers/dev'
import { displayTitle } from '../../helpers/general'
import { smartPrependPara } from '../../helpers/paragraph'
import { getTodaysDateUnhyphenated, unhyphenateString, } from '../../helpers/dateTime'
import { askForFutureISODate, chooseFolder, chooseHeading, showMessage, } from '../../helpers/userInput'
import { calendarNotesSortedByChanged, projectNotesSortedByChanged, } from '../../helpers/note'

// ------------------------------------------------------------------
// Get settings
// const DEFAULT_INBOX_CONFIG = `  inbox: {
//     inboxTitle: "📥 Inbox", // name of your inbox note, or leave empty ("") to use the daily note instead. (If the setting is missing, or doesn't match a note, then the plugin will try to create it, from default settings if necessary.)
//     addInboxPosition: "prepend", // "prepend" or "append"
//     textToAppendToTasks: "", // text to append to any tasks captured to the inbox through /int
//   },
// `

const configKey = "inbox"

type inboxConfigType = {
  inboxTitle: string,
  addInboxPosition: string,
  textToAppendToTasks: string
}

/**
 * Get config settings using Config V2 system. (Have now removed support for Config V1.)
 * Updated for #ConfigV2
 * @author @jgclark
 */
async function getInboxSettings(): Promise<any> {
  log(pluginJson, `Start of getInboxSettings()`)
  try {
    // Get settings using ConfigV2
    const v2Config: inboxConfigType = await DataStore.loadJSON("../jgclark.QuickCapture/settings.json")

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      await showMessage(`Cannot find settings for the 'QuickCapture' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
      return
    }  else {
      // $FlowFixMe
      // clo(v2Config, `${configKey} settings from V2:`)
      return v2Config
    }
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/** /qpt
 * Prepend a task to a note the user picks
 * @author @jgclark
 */
export async function prependTaskToNote(): Promise<void> {
  const config: inboxConfigType = await getInboxSettings()
  const taskTitle = await CommandBar.showInput(
    `Type the task`,
    `Prepend '%@' ${config.textToAppendToTasks}`,
  )
  const notes = projectNotesSortedByChanged()

  const re = await CommandBar.showOptions(
    notes.map((n) => n.title).filter(Boolean),
    'Select note to prepend',
  )
  smartPrependPara(notes[re.index], `${taskTitle} ${config.textToAppendToTasks}`, 'open')
}

/** /qat
 * Append a task to a note the user picks
 * @author @jgclark
 */
export async function appendTaskToNote(): Promise<void> {
  const config = await getInboxSettings()
  const taskTitle = await CommandBar.showInput(
    `Type the task`,
    `Append '%@' ${config.textToAppendToTasks}`,
  )
  const notes = projectNotesSortedByChanged()

  const re = await CommandBar.showOptions(
    notes.map((n) => n.title).filter(Boolean),
    'Select note to append',
  )
  notes[re.index].appendTodo(`${taskTitle} ${config.textToAppendToTasks}`)
}

/** /qath
 * Add a task to a heading the user picks.
 * NB: note that duplicate headings not properly handled.
 * @author @jgclark
 */
export async function addTaskToNoteHeading(): Promise<void> {
  const config = await getInboxSettings()
  const taskTitle = await CommandBar.showInput(
    `Type the task to add`,
    `Add task '%@' ${config.textToAppendToTasks}`
  )

  // Then ask for the note we want to add the task
  const notes = projectNotesSortedByChanged()
  // CommandBar.showOptions only takes [string] as input
  const re = await CommandBar.showOptions(
    notes.map((n) => n.title).filter(Boolean),
    'Select note for new todo',
  )
  const note = notes[re.index]

  // Finally, ask to which heading to add the task
  // (use function that allows us to add a new heading at start/end of note first)
  const heading = await chooseHeading(note, false, true)
  // log(pluginJson, `Adding todo: ${taskTitle} ${config.textToAppendToTasks} to ${note.title ?? ''} in heading: ${heading}`)

  // Add todo to the heading in the note (and add the heading if it doesn't exist)
  note.addTodoBelowHeadingTitle(
    `${taskTitle} ${config.textToAppendToTasks}`,
    heading, //.content,
    false,
    true)
}

/** /qalh
 * Add general text to a note's heading the user picks.
 * NB: duplicate headings are not properly handled.
 * @author @jgclark
 */
export async function addTextToNoteHeading(): Promise<void> {
  const config = await getInboxSettings()
  // Ask for the note text
  const text = await CommandBar.showInput(
    'Type the text to add',
    `Add text '%@'`,
  )

  // Then ask for the note we want to add the text
  const notes = projectNotesSortedByChanged()
  // CommandBar.showOptions only takes [string] as input
  const re = await CommandBar.showOptions(
    notes.map((n) => n.title).filter(Boolean),
    'Select note for new text',
  )
  const note = notes[re.index]

  // Finally, ask to which heading to add the text
  // use function that allows us to add a new heading at start/end of note first
  const heading = await chooseHeading(note, false, true)

  // Add text to the heading in the note (and add the heading if it doesn't exist)
  note.addParagraphBelowHeadingTitle(
    `${text} ${config.textToAppendToTasks}`,
    'empty',
    heading, //.content,
    false,
    true,
  )
}

/** /qpd
 * Quickly prepend a task to a daily note
 * @author @jgclark
 */
export async function prependTaskToDailyNote(): Promise<void> {
  const config = await getInboxSettings()
  const taskTitle = await CommandBar.showInput(
    `Type the task to add`,
    `Add task '%@' ${config.textToAppendToTasks}`
  )

  // Then ask for the daily note we want to add the todo
  const notes = calendarNotesSortedByChanged()
  const res = await CommandBar.showOptions(
    notes.map((n) => displayTitle(n)).filter(Boolean),
    'Select daily note for new todo',
  )
  const note = notes[res.index]

  // log(pluginJson, `Prepending task: ${taskTitle} to ${displayTitle(note)}`)
  note.prependTodo(`${taskTitle} ${config.textToAppendToTasks}`)
}

/** /qad
 * Quickly append a task to a daily note
 * @author @jgclark
 */
export async function appendTaskToDailyNote(): Promise<void> {
  const config = await getInboxSettings()
  const taskTitle = await CommandBar.showInput(
    `Type the task to add`,
    `Add task '%@' ${config.textToAppendToTasks}`
  )

  // Then ask for the daily note we want to add the todo
  const dateStr = await askForFutureISODate('Select daily note for new todo')
  log(pluginJson, `\tadding to date ${dateStr}`)
  const note = DataStore.calendarNoteByDateString(unhyphenateString(dateStr))

  if (note != null) {
    // log(pluginJson, `Appending task: ${taskTitle} ${config.textToAppendToTasks} to ${displayTitle(note)}`)
    note.appendTodo(`${taskTitle} ${config.textToAppendToTasks}`)
  } else {
    logError(pluginJson, `Can't get calendar note for ${dateStr}`)
  }
}

/** /qaj
 * Quickly append text to today's journal
 * @author @jgclark
 */
export async function appendTextToDailyJournal(): Promise<void> {
  const todaysDateStr = getTodaysDateUnhyphenated()
  const text = await CommandBar.showInput(
    'Type the text to add',
    `Add text '%@' to ${todaysDateStr}`
  )

  const note = DataStore.calendarNoteByDateString(todaysDateStr)
  if (note != null) {
    log(pluginJson, `  adding to ${displayTitle(note)}`)
    // Add text to the heading in the note (and add the heading if it doesn't exist)
    note.addParagraphBelowHeadingTitle(
      text,
      'empty',
      'Journal',
      true,
      true,
    )
  }
}

/** /int
 * This adds a task to a special 'inbox' note. Possible configuration:
 * - append or prepend to the inbox note (default: append)
 * - add to the particular named note, or if empty, to today's daily note
 * - if config section is missing, offer to add it
 * @author @jgclark
 */
export async function addTaskToInbox(): Promise<void> {
  const config = await getInboxSettings()

  // Get or setup the inbox note from the Datastore
  let newFilename: string
  let inboxNote: ?TNote
  if (config.inboxTitle !== '') {
    log(pluginJson, `  using inbox title: ${config.inboxTitle}`)
    const matchingNotes = DataStore.projectNoteByTitleCaseInsensitive(config.inboxTitle) ?? []
    inboxNote = matchingNotes[0] ?? null
    // Create the inbox note if not existing, ask the user which folder
    if (inboxNote == null) {
      const folder = await chooseFolder(
        'Choose a folder for your inbox note (or cancel [ESC])',
      )
      newFilename = DataStore.newNote(config.inboxTitle, folder) ?? ''
      // NB: this returns a filename not of our choosing
      if (newFilename != null && newFilename !== '') {
        log(pluginJson, `  made new inbox note, filename = ${newFilename}`)
        inboxNote = DataStore.projectNoteByFilename(newFilename)
      }
    }
  } else {
    log(pluginJson, `  using today's daily note`)
    inboxNote = DataStore.calendarNoteByDateString(getTodaysDateUnhyphenated())
  }

  if (inboxNote != null) {
    // Ask for the task title
    let taskTitle = await CommandBar.showInput(
      `Type the task to add to ${displayTitle(inboxNote)}`,
      `Add task '%@' ${config.textToAppendToTasks}`,
    )
    taskTitle += ` ${config.textToAppendToTasks}`

    if (config.addInboxPosition === 'append') {
      // $FlowFixMe
      inboxNote.appendTodo(taskTitle)
    } else {
      // $FlowFixMe
      inboxNote.prependTodo(taskTitle)
    }
  } else {
    logError(pluginJson, `Despite everything I couldn't find or make the Inbox note.`)
  }
}
