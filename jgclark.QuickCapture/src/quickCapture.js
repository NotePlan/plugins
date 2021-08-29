// @flow
// --------------------------------------------------------------------------------------------------------------------
// QuickCapture plugin for NotePlan
// Jonathan Clark
// v0.5.0, 14.8.2021
// --------------------------------------------------------------------------------------------------------------------

import {
  getOrMakeConfigurationSection,
} from '../../nmn.Templates/src/configuration'
  
import {
  displayTitle,
  chooseFolder,
  smartPrependPara,
} from '../../helperFunctions'

import {
  unhyphenateString,
  todaysDateISOString,
} from '../../helperFunctions/dateFunctions'

import {
  showMessage,
  askForFutureISODate,
  chooseHeading,
} from '../../helperFunctions/userInput'

import {
  calendarNotesSortedByChanged,
  projectNotesSortedByChanged,
} from '../../helperFunctions/noteFunctions'

// ------------------------------------------------------------------

const DEFAULT_INBOX_CONFIG = `
  inbox: {
    inboxTitle: "📥 Inbox", // name of your inbox note, or leave empty ("") to use the daily note instead. (If the setting is missing, or doesn't match a note, then the plugin will try to create it, from default settings if necessary.)
    addInboxPosition: "prepend", // or "append"
  },
`

/** /qpt
 * Prepend a task to a note the user picks
 * @author @jgclark
 */
export async function prependTaskToNote(): Promise<void>  {
  const taskName = await CommandBar.showInput(
    'Type the task name',
    "Prepend '%@'...",
  )
  const notes = projectNotesSortedByChanged()

  const re = await CommandBar.showOptions(
    notes.map((n) => n.title).filter(Boolean),
    'Select note to prepend',
  )
  smartPrependPara(notes[re.index], taskName, 'open')
}

/** /qat
 * Append a task to a note the user picks
 * @author @jgclark
 */
export async function appendTaskToNote(): Promise<void> {
  const taskName = await CommandBar.showInput(
    'Type the task name',
    "Append '%@'...",
  )
  const notes = projectNotesSortedByChanged()

  const re = await CommandBar.showOptions(
    notes.map((n) => n.title).filter(Boolean),
    'Select note to append',
  )
  notes[re.index].appendTodo(taskName)
}

/** /qath
 * Add a task to a heading the user picks.
 * NB: note that duplicate headings not properly handled.
 * @author @jgclark
 */
export async function addTaskToNoteHeading(): Promise<void> {
  // Ask for the task title
  const todoTitle = await CommandBar.showInput('Type the task', "Add task '%@'")

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

  // Add todo to the heading in the note (and add the heading if it doesn't exist)
  note.addTodoBelowHeadingTitle(todoTitle,
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
    text,
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
  // Ask for the task title
  const todoTitle = await CommandBar.showInput('Type the task', "Add task '%@'")

  // Then ask for the daily note we want to add the todo
  const notes = calendarNotesSortedByChanged()
  const res = await CommandBar.showOptions(
    notes.map((n) => displayTitle(n)).filter(Boolean),
    'Select daily note for new todo',
  )
  const note = notes[res.index]

  console.log(`Prepending task: ${todoTitle} to ${displayTitle(note)}`)
  note.prependTodo(todoTitle)
}

/** /qad
 * Quickly append a task to a daily note
 * @author @jgclark
 */
export async function appendTaskToDailyNote(): Promise<void> {
  // Ask for the task title
  const todoTitle = await CommandBar.showInput('Type the task', "Add task '%@'")

  // Then ask for the daily note we want to add the todo
  const dateStr = await askForFutureISODate('Select daily note for new todo')
  console.log(`got date ${dateStr}`)
  const note = DataStore.calendarNoteByDateString(unhyphenateString(dateStr))
  
  // OLDER METHOD
  // const notes = calendarNotesSortedByChanged()
  // const res = await CommandBar.showOptions(
  //   notes.map((n) => displayTitle(n)).filter(Boolean),
  //   'Select daily note for new todo',
  // )
  // const note = notes[res.index]

  if (note != null) {
    console.log(`Appending task: ${todoTitle} to ${displayTitle(note)}`)
    note.appendTodo(todoTitle)
  } else {
    console.log(`appendTaskToDailyNote: error: cannot get calendar note for ${dateStr}`)
  }
}

/** /qaj
 * Quickly append text to today's journal
 * @author @jgclark
 */
export async function appendTaskToDailyJournal(): Promise<void> {
  const todaysDateStr = unhyphenateString(todaysDateISOString)
  // Ask for the text
  const text = await CommandBar.showInput('Type the text', `Add text '%@' to ${todaysDateStr}`)

  const note = DataStore.calendarNoteByDateString(todaysDateStr)
  if (note != null) {
    console.log(`\nAppending text to Journal section of ${displayTitle(note)}`)
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
 * @author @jgclark
 */
export async function addTaskToInbox(): Promise<void> {
  console.log(`addTaskToInbox:`)
  // Get config settings from Template folder _configuration note
  const inboxConfig = await getOrMakeConfigurationSection('inbox', DEFAULT_INBOX_CONFIG)
  // console.log(JSON.stringify(inboxConfig))
  if (inboxConfig == null) {
    console.log(
      "\tWarning: Cannot find 'inbox' settings in Templates/_configuration note. Stopping.",
    )
    await showMessage("Error: please check 'inbox' settings in '_configuration' note")
    return
  }

  // Read settings from _configuration note,
  // with some pre-defined settings as a final fallback
  const pref_inboxTitle: string = String(inboxConfig.inboxTitle) ?? "📥 Inbox"
  console.log(inboxConfig.inboxTitle)
  const pref_addInboxPosition: string = String(inboxConfig.addInboxPosition) ?? "prepend"
  console.log(inboxConfig.addInboxPosition)

  // Get or setup the inbox note from the Datastore
  let newFilename: ?string
  let inboxNote: ?TNote
  if (pref_inboxTitle === '') {
    // use today's daily note
    console.log(`\tWill use daily note`)
    inboxNote = DataStore.calendarNoteByDateString(
      unhyphenateString(todaysDateISOString))
  } else {
    console.log(`\tAttempting to use inbox title: ${pref_inboxTitle}`)
    const matchingNotes =
      DataStore.projectNoteByTitleCaseInsensitive(pref_inboxTitle) ?? []
    inboxNote = matchingNotes[0] ?? null
    // Create the inbox note if not existing, ask the user which folder
    if (inboxNote == null) {
      const folder = await chooseFolder(
        'Inbox note not found, choose a folder or cancel [ESC]',
      )
      // $FlowFixMe -- don't know how to deal with apparent mixed type here
      newFilename = DataStore.newNote(pref_inboxTitle, folder) ?? ''
      // NB: this returns a filename not of our choosing
      if (newFilename != null) {
        // console.log(`\tmade new inbox note, filename = ${newFilename}`)
        // $FlowIgnore[incompatible-call]
        inboxNote = DataStore.projectNoteByFilename(newFilename)
        // console.log('\tgot the new inbox note')
      }
    }
  }

  // Ask for the task title
  const todoTitle = await CommandBar.showInput(
    'Type the task to add to your Inbox note',
    "Add task '%@'",
  )

  if (inboxNote != null) {
    if (pref_addInboxPosition === 'append') {
      inboxNote.appendTodo(todoTitle)
    } else {
      inboxNote.prependTodo(todoTitle)
    }
    // $FlowIgnore[incompatible-call]
    console.log(`\tAdded todo to Inbox note '${displayTitle(inboxNote)}'`)
  } else {
    console.log(`\tERROR: Despite everything I couldn't find or make the Inbox note.`)
  }
}
