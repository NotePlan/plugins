// @flow
// --------------------------------------------------------------------------------------------------------------------
// QuickCapture plugin for NotePlan
// Jonathan Clark
// last update v0.8.3, 15.12.2021
// --------------------------------------------------------------------------------------------------------------------

import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'
import { clo } from '../../helpers/dev'
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
 * Get or make config settings from _configuration, with no minimum required config
 * Updated for #ConfigV2
 * @author @jgclark
 */
async function getInboxSettings(): Promise<inboxConfigType> {
  console.log(`getInboxSettings():`)

  // Wish the following was possible:
  // if (NotePlan.environment.version >= "3.4") {
  
  const tempConfig: inboxConfigType = DataStore.settings // TODO: understand how to get a different config set, as [configKey] and .inbox don't work.
  
  if ((tempConfig != null) && Object.keys(tempConfig).length > 0) {
    const config: inboxConfigType = tempConfig
    // $FlowFixMe
    clo(config, `\t${configKey} settings from V2:`)
    return config

  } else {
    // Read settings from _configuration, or if missing set a default
    // Don't mind if no config section is found
    const v1Config = await getOrMakeConfigurationSection(configKey)
    // $FlowIgnore
    // console.log(`found config: ${JSON.stringify(v1Config)}`)
    const config: inboxConfigType = {
      // legitimate than inboxTitle can be '' (the empty string)
      inboxTitle: (v1Config?.inboxTitle != null)
        ? String(v1Config?.inboxTitle) : `📥 Inbox`,
      addInboxPosition: (v1Config?.addInboxPosition != null && v1Config?.addInboxPosition !== '')
        ? String(v1Config?.addInboxPosition) : 'prepend',
      textToAppendToTasks: (v1Config?.textToAppendToTasks != null)
        ? String(v1Config?.textToAppendToTasks) : ''
    }
    // $FlowFixMe
    clo(config, `\t${configKey} settings from V1:`)
    return config
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
  // console.log(`Adding todo: ${taskTitle} ${config.textToAppendToTasks} to ${note.title ?? ''} in heading: ${heading}`)

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

  // console.log(`Prepending task: ${taskTitle} to ${displayTitle(note)}`)
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
  console.log(`\tadding to date ${dateStr}`)
  const note = DataStore.calendarNoteByDateString(unhyphenateString(dateStr))

  if (note != null) {
    // console.log(`Appending task: ${taskTitle} ${config.textToAppendToTasks} to ${displayTitle(note)}`)
    note.appendTodo(`${taskTitle} ${config.textToAppendToTasks}`)
  } else {
    console.log(`\tError: cannot get calendar note for ${dateStr}`)
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
    console.log(`\tadding to ${displayTitle(note)}`)
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
    console.log(`\tusing inbox title: ${config.inboxTitle}`)
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
        console.log(`\tmade new inbox note, filename = ${newFilename}`)
        inboxNote = DataStore.projectNoteByFilename(newFilename)
      }
    }
  } else {
    console.log(`\tusing today's daily note`)
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
    console.log(`\tERROR: Despite everything I couldn't find or make the Inbox note.`)
  }
}
