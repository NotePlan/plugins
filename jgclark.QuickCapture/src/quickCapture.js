// @flow
// --------------------------------------------------------------------------------------------------------------------
// QuickCapture plugin for NotePlan
// Jonathan Clark
// last update v0.8.1, 20.11.2021
// --------------------------------------------------------------------------------------------------------------------

import {
  getOrMakeConfigurationSection,
} from '../../nmn.Templates/src/configuration'
import { displayTitle } from '../../helpers/general'
import { smartPrependPara } from '../../helpers/paragraph'
import {
  getTodaysDateUnhyphenated,
  unhyphenateString,
} from '../../helpers/dateTime'
import {
  showMessage,
  chooseFolder,
  chooseHeading,
  askForFutureISODate,
} from '../../helpers/userInput'
import {
  calendarNotesSortedByChanged,
  projectNotesSortedByChanged,
} from '../../helpers/note'

// ------------------------------------------------------------------
// settings
const DEFAULT_INBOX_CONFIG = `  inbox: {
    inboxTitle: "📥 Inbox", // name of your inbox note, or leave empty ("") to use the daily note instead. (If the setting is missing, or doesn't match a note, then the plugin will try to create it, from default settings if necessary.)
    addInboxPosition: "prepend", // "prepend" or "append"
    textToAppendToTasks: "", // text to append to any tasks captured to the inbox through /int
  },
`
let pref_inboxTitle: string
let pref_addInboxPosition: string
let pref_textToAppendToTasks: string

/**
 * Get or make config settings from _configuration, with no minimum required config
 * @author @jgclark
 */
async function getInboxSettings(createIfMissing: boolean): Promise<void> {
  // Only give default configuration if we want to offer to have this config section created if its missing
  if (createIfMissing) {
    const inboxConfig = await getOrMakeConfigurationSection('inbox', DEFAULT_INBOX_CONFIG)
    // console.log(`found config: ${JSON.stringify(inboxConfig)}`)
    if (inboxConfig == null || Object.keys(inboxConfig).length === 0) { // check for empty object
      console.log(
        "\tWarning: Cannot find 'inbox' settings in Templates/_configuration note. Stopping.",
      )
      await showMessage("Error: please check 'inbox' settings in '_configuration' note")
    } else {
      // Read settings from _configuration, or if missing set a default
      pref_inboxTitle = (inboxConfig?.inboxTitle != null) // legitimate than inboxTitle can be '' (the empty string)
        ? String(inboxConfig?.inboxTitle)
        : "📥 Inbox"
      pref_addInboxPosition = (inboxConfig?.addInboxPosition != null && inboxConfig?.addInboxPosition !== '')
        ? String(inboxConfig?.addInboxPosition)
        : "prepend"
      pref_textToAppendToTasks = (inboxConfig?.textToAppendToTasks != null)
        ? String(inboxConfig?.textToAppendToTasks)
        : ""
    }
  } else {
    // Read settings from _configuration, or if missing set a default
    // Don't mind if no config section is found
    const inboxConfig = await getOrMakeConfigurationSection('inbox')
    // console.log(`found config: ${JSON.stringify(inboxConfig)}`)
    pref_inboxTitle = (inboxConfig?.inboxTitle != null) // legitimate than inboxTitle can be '' (the empty string)
      ? String(inboxConfig?.inboxTitle)
      : "📥 Inbox"
    pref_addInboxPosition = (inboxConfig?.addInboxPosition != null && inboxConfig?.addInboxPosition !== '')
      ? String(inboxConfig?.addInboxPosition)
      : "prepend"
    pref_textToAppendToTasks = (inboxConfig?.textToAppendToTasks != null)
      ? String(inboxConfig?.textToAppendToTasks)
      : ""
  }
  // console.log(`Inbox settings (3 lines):`)
  // console.log(pref_inboxTitle)
  // console.log(pref_addInboxPosition)
  // console.log(pref_textToAppendToTasks)
}

/** /qpt
 * Prepend a task to a note the user picks
 * @author @jgclark
 */
export async function prependTaskToNote(): Promise<void> {
  await getInboxSettings(false)
  const taskTitle = await CommandBar.showInput(
    `Type the task`,
    `Prepend '%@' ${pref_textToAppendToTasks}`,
  )
  const notes = projectNotesSortedByChanged()

  const re = await CommandBar.showOptions(
    notes.map((n) => n.title).filter(Boolean),
    'Select note to prepend',
  )
  smartPrependPara(notes[re.index], `${taskTitle} ${pref_textToAppendToTasks}`, 'open')
}

/** /qat
 * Append a task to a note the user picks
 * @author @jgclark
 */
export async function appendTaskToNote(): Promise<void> {
  await getInboxSettings(false)
  const taskTitle = await CommandBar.showInput(
    `Type the task`,
    `Append '%@' ${pref_textToAppendToTasks}`,
  )
  const notes = projectNotesSortedByChanged()

  const re = await CommandBar.showOptions(
    notes.map((n) => n.title).filter(Boolean),
    'Select note to append',
  )
  notes[re.index].appendTodo(`${taskTitle} ${pref_textToAppendToTasks}`)
}

/** /qath
 * Add a task to a heading the user picks.
 * NB: note that duplicate headings not properly handled.
 * @author @jgclark
 */
export async function addTaskToNoteHeading(): Promise<void> {
  await getInboxSettings(false)
  const taskTitle = await CommandBar.showInput(
    `Type the task to add`,
    `Add task '%@' ${pref_textToAppendToTasks}`
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
  // console.log(`Adding todo: ${taskTitle} ${pref_textToAppendToTasks} to ${note.title ?? ''} in heading: ${heading}`)

  // Add todo to the heading in the note (and add the heading if it doesn't exist)
  note.addTodoBelowHeadingTitle(
    `${taskTitle} ${pref_textToAppendToTasks}`,
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
  await getInboxSettings(false)
  // Ask for the note text
  const text = await CommandBar.showInput(
    'Type the text to add',
    "Add text '%@'",
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
    `${text} ${pref_textToAppendToTasks}`,
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
  await getInboxSettings(false)
  const taskTitle = await CommandBar.showInput(
    `Type the task to add`,
    `Add task '%@' ${pref_textToAppendToTasks}`
  )

  // Then ask for the daily note we want to add the todo
  const notes = calendarNotesSortedByChanged()
  const res = await CommandBar.showOptions(
    notes.map((n) => displayTitle(n)).filter(Boolean),
    'Select daily note for new todo',
  )
  const note = notes[res.index]

  // console.log(`Prepending task: ${taskTitle} to ${displayTitle(note)}`)
  note.prependTodo(`${taskTitle} ${pref_textToAppendToTasks}`)
}

/** /qad
 * Quickly append a task to a daily note
 * @author @jgclark
 */
export async function appendTaskToDailyNote(): Promise<void> {
  await getInboxSettings(false)
  const taskTitle = await CommandBar.showInput(
    `Type the task to add`,
    `Add task '%@' ${pref_textToAppendToTasks}`
  )

  // Then ask for the daily note we want to add the todo
  const dateStr = await askForFutureISODate('Select daily note for new todo')
  console.log(`\nappendTaskToDailyNote: adding to date ${dateStr}`)
  const note = DataStore.calendarNoteByDateString(unhyphenateString(dateStr))
  
  if (note != null) {
    // console.log(`Appending task: ${taskTitle} ${pref_textToAppendToTasks} to ${displayTitle(note)}`)
    note.appendTodo(`${taskTitle} ${pref_textToAppendToTasks}`)
  } else {
    console.log(`appendTaskToDailyNote: error: cannot get calendar note for ${dateStr}`)
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
    console.log(`\nappendTextToDailyJournal: adding to ${displayTitle(note)}`)
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
  console.log(`\naddTaskToInbox:`)
  await getInboxSettings(true)

  // Get or setup the inbox note from the Datastore
  let newFilename: ?string
  let inboxNote: ?TNote
  if (pref_inboxTitle === '') {
    // use today's daily note
    console.log(`\tWill use daily note`)
    inboxNote = DataStore.calendarNoteByDateString(
      getTodaysDateUnhyphenated())
  } else {
    console.log(`\tAttempting to use inbox title: ${pref_inboxTitle}`)
    const matchingNotes =
      DataStore.projectNoteByTitleCaseInsensitive(pref_inboxTitle) ?? []
    inboxNote = matchingNotes[0] ?? null
    // Create the inbox note if not existing, ask the user which folder
    if (inboxNote == null) {
      const folder = await chooseFolder(
        'Choose a folder for your inbox note (or cancel [ESC])',
      )
      newFilename = DataStore.newNote(pref_inboxTitle, folder) ?? ''
      // NB: this returns a filename not of our choosing
      if (newFilename != null) {
        console.log(`\tmade new inbox note, filename = ${newFilename}`)
        // $FlowIgnore[incompatible-call]
        inboxNote = DataStore.projectNoteByFilename(newFilename)
      }
    }
  }

  // Ask for the task title
  let taskTitle = await CommandBar.showInput(
    `Type the task to add to your Inbox note`,
    `Add task '%@' ${pref_textToAppendToTasks}`,
  )
  taskTitle += ` ${pref_textToAppendToTasks}`

  if (inboxNote != null) {
    if (pref_addInboxPosition === 'append') {
      inboxNote.appendTodo(taskTitle)
    } else {
      inboxNote.prependTodo(taskTitle)
    }
    // $FlowIgnore[incompatible-call]
    // console.log(`\tAdded todo to Inbox note '${displayTitle(inboxNote)}'`)
  } else {
    console.log(`\tERROR: Despite everything I couldn't find or make the Inbox note.`)
  }
}
