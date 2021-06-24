// @flow
// --------------------------------------------------------------------------------------------------------------------
// QuickCapture plugin for NotePlan (was: TaskHelpers)
// Jonathan Clark
// v0.4.0, 15.6.2021
// --------------------------------------------------------------------------------------------------------------------

import { getDefaultConfiguration } from '../../nmn.Templates/src/configuration'
import { showMessage } from '../../nmn.sweep/src/userInput'

function displayTitle(note: TNote): string {
  return note.title ?? 'untitled note'
}

// Settings from NotePlan
// var defaultFileExtension = (DataStore.defaultFileExtension != undefined) ? DataStore.defaultFileExtension : "md"
// let defaultTodoMarker = (DataStore.preference('defaultTodoCharacter') !== undefined) ? DataStore.preference('defaultTodoCharacter') : '*'

// ------------------------------------------------------------------
// Helper function, not called by a command
// eslint-disable-next-line no-unused-vars
function printNote(note: ?TNote) {
  if (note == null) {
    console.log('Note not found!')
    return
  }

  if (note.type === 'Notes') {
    const { title, filename, hashtags, mentions, createdDate, changedDate } =
      note
    const objToLog = {
      title,
      filename,
      hashtags,
      mentions,
      createdDate,
      changedDate,
    }
    // Using `null, 2` as the second and third arguments to JSON.stringify
    // pretty-prints the object.
    console.log(JSON.stringify(objToLog, null, 2))
  } else {
    const { date, filename, hashtags, mentions } = note
    const objToLog = { date, filename, hashtags, mentions }
    console.log(JSON.stringify(objToLog, null, 2))
  }
}

// ------------------------------------------------------------------
// Prepends a task to a chosen note
export async function prependTaskToNote() {
  const taskName = await CommandBar.showInput(
    'Type the task name',
    "Prepend '%@'...",
  )
  const notes = projectNotesSortedByChanged()

  const re = await CommandBar.showOptions(
    notes.map((n) => n.title).filter(Boolean),
    'Select note to prepend',
  )
  notes[re.index].prependTodo(taskName)
}

// ------------------------------------------------------------------
// Appends a task to a chosen note
export async function appendTaskToNote() {
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

// ------------------------------------------------------------------
// This adds a task to a selected heading, based on EM's 'example25'.
// Problem here is that duplicate headings are not respected.
export async function addTaskToNoteHeading() {
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
  const headings = note.paragraphs.filter((p) => p.type === 'title')
  const re2 = await CommandBar.showOptions(
    headings.map((p) => p.prefix + p.content),
    `Select a heading from note '${note.title ?? ''}'`,
  )
  const heading = headings[re2.index]
  // console.log("Selected heading: " + heading.content)
  console.log(
    `Adding todo: ${todoTitle} to ${note.title ?? ''} in heading: ${
      heading.content
    }`,
  )

  // Add todo to the heading in the note (and add the heading if it doesn't exist)
  note.addTodoBelowHeadingTitle(todoTitle, heading.content, false, true)
}

// ------------------------------------------------------------------
// This adds general text to a selected note's heading.
// Problem here is that duplicate headings are not respected.
export async function addTextToNoteHeading() {
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
  const headings = note.paragraphs.filter((p) => p.type === 'title')
  const re2 = await CommandBar.showOptions(
    headings.map((p) => p.prefix + p.content),
    `Select a heading from note '${note.title ?? ''}'`,
  )
  const heading = headings[re2.index]
  // console.log("Selected heading: " + heading.content)
  console.log(
    `Adding text: ${text} to ${note.title ?? ''} in heading: ${
      heading.content
    }`,
  )

  // Add text to the heading in the note (and add the heading if it doesn't exist)
  note.addParagraphBelowHeadingTitle(
    text,
    'empty',
    heading.content,
    false,
    true,
  )
}

// ------------------------------------------------------------------
// Quickly prepend a task to a daily note
export async function prependTaskToDailyNote() {
  // Ask for the task title
  const todoTitle = await CommandBar.showInput('Type the task', "Add task '%@'")

  // Then ask for the daily ote we want to add the todo
  const notes = calendarNotesSortedByChanged()
  const res = await CommandBar.showOptions(
    notes.map((n) => displayTitle(n)).filter(Boolean),
    'Select daily note for new todo',
  )
  const note = notes[res.index]

  console.log(`Prepending task: ${todoTitle} to ${displayTitle(note)}`)
  note.prependTodo(todoTitle)
}

// ------------------------------------------------------------------
// Quickly append a task to a daily note
export async function appendTaskToDailyNote() {
  // Ask for the task title
  const todoTitle = await CommandBar.showInput('Type the task', "Add task '%@'")

  // Then ask for the daily ote we want to add the todo
  const notes = calendarNotesSortedByChanged()
  const res = await CommandBar.showOptions(
    notes.map((n) => displayTitle(n)).filter(Boolean),
    'Select daily note for new todo',
  )
  const note = notes[res.index]

  console.log(`Appending task: ${todoTitle} to ${displayTitle(note)}`)
  note.appendTodo(todoTitle)
}

// ------------------------------------------------------------------
// This adds a task to a special 'inbox' note. Possible configuration:
// - append or prepend to the inbox note (default: append)
// - add to today's daily note (default) or to a particular named note
export async function addTaskToInbox() {
  // Get config settings from Template folder _configuration note
  const config = await getDefaultConfiguration()
  const inboxConfig = config?.inbox ?? null
  if (inboxConfig == null) {
    console.log(
      "\tWarning: Cannot find 'inbox' settings in Templates/_configuration note. Stopping.",
    )
    await showMessage(
      "Cannot find 'inbox' settings in Templates/_configuration note",
    )
    return
  }

  // Typecasting
  const inboxConfigObj: { [string]: string } = (inboxConfig: any)

  // Read settings from _configuration note
  const pref_inboxFilename = inboxConfigObj.inboxFilename ?? ''
  const pref_inboxTitle = inboxConfigObj.inboxTitle ?? '📥 Inbox'
  const pref_addInboxPosition = inboxConfigObj.addInboxPosition ?? 'append'

  // Get or setup the inbox note
  let newFilename: ?string
  let inboxNote: ?TNote
  if (pref_inboxFilename !== '') {
    console.log(`addTaskToInbox: ${String(pref_inboxFilename)}`)
    inboxNote = DataStore.projectNoteByFilename(String(pref_inboxFilename))
    // Create the inbox note if not existing, ask the user which folder
    if (inboxNote == null) {
      const folders = DataStore.folders
      const folder = await CommandBar.showOptions(
        folders,
        'Inbox not found, choose a folder or cancel [ESC]',
      )
      newFilename = DataStore.newNote(pref_inboxTitle, folder.value) ?? ''
      // NB: this returns a filename not of our choosing
      console.log(`made new inbox note, filename = ${newFilename}`)
    }
  }

  // Ask for the task title
  const todoTitle = await CommandBar.showInput(
    'Type the task to add to your Inbox note',
    "Add task '%@'",
  )

  // Re-fetch the note if we created it previously. We need to wait a bit so it's cached, that's why we query it after the task input.
  if (newFilename != null) {
    inboxNote = DataStore.projectNoteByFilename(newFilename)
    console.log('\tgot new inbox note')
  }

  // Get the relevant note from the Datastore
  if (inboxNote != null) {
    if (pref_addInboxPosition === 'append') {
      inboxNote.appendTodo(todoTitle)
    } else {
      inboxNote.prependTodo(todoTitle)
    }
    console.log(`\tAdded todo to Inbox note '${String(inboxNote?.filename)}'`)
  } else {
    console.log(`\tERROR: Couldn't find Inbox note '${pref_inboxFilename}'`)
  }
}

function calendarNotesSortedByChanged(): Array<TNote> {
  return DataStore.calendarNotes
    .slice()
    .sort((first, second) => second.changedDate - first.changedDate)
}

function projectNotesSortedByChanged(): Array<TNote> {
  return DataStore.projectNotes
    .slice()
    .sort((first, second) => second.changedDate - first.changedDate)
}
