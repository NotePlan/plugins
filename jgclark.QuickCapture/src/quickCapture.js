// @flow
// --------------------------------------------------------------------------------------------------------------------
// QuickCapture plugin for NotePlan
// Jonathan Clark
// v0.4.7, 11.8.2021
// --------------------------------------------------------------------------------------------------------------------

import {
  // getStructuredConfiguration,
  getOrMakeConfigurationSection,
} from '../../nmn.Templates/src/configuration'
  
import {
  // printNote,
  showMessage,
  unhyphenateString,
  todaysDateISOString,
  displayTitle,
  chooseFolder,
  smartPrependPara,
  calendarNotesSortedByChanged,
  projectNotesSortedByChanged,
} from '../../helperFunctions'

import {
  askForFutureISODate,
} from '../../helperFunctions/userInput'

// ------------------------------------------------------------------

const DEFAULT_INBOX_CONFIG = `
  inbox: {
    inboxFilename: "📥 Inbox.md",
    inboxTitle: "📥 Inbox",
    addInboxPosition: "prepend",
  },
`

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
  smartPrependPara(notes[re.index], taskName, 'open')
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

// ------------------------------------------------------------------
// Quickly append a task to a daily note
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

// ------------------------------------------------------------------
// Quickly append text to today's journal
export async function appendTaskToDailyJournal() {
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

// ------------------------------------------------------------------
// This adds a task to a special 'inbox' note. Possible configuration:
// - append or prepend to the inbox note (default: append)
// - add to today's daily note (default) or to a particular named note

// FIXME:
// the / int inbox note plugin wants to create a new inbox note every time.
// [17:10] Eduard: I tried with the root folder and with a subfolder. 
// Somehow it can't find the note.
// [17:14] Eduard: I found out why. It automatically creates the inbox folder,
// but the filename in the configuration is different.
// [17: 15]Eduard: In my case it created an inbox.txt and I added it to a subfolder.
// The automatically created configuration is an inbox.md without a subfolder.
// So they conflict each other.

export async function addTaskToInbox() {
  console.log(`addTaskToInbox:`)
  // Get config settings from Template folder _configuration note
  const inboxConfig = await getOrMakeConfigurationSection('inbox', DEFAULT_INBOX_CONFIG)
  // inboxConfig = config?.inbox ?? null
  if (inboxConfig == null) {
    console.log(
      "\tWarning: Cannot find 'inbox' settings in Templates/_configuration note. Stopping.",
    )
    await showMessage(
      "Error: please check 'inbox' settings in '_configuration' note",
    )
    return
  }

  // Read settings from _configuration note,
  // with some pre-defined settings as a final fallback
  // console.log(inboxConfig.inboxFilename)
  const pref_inboxFilename = inboxConfig.inboxFilename ?? "📥 Inbox.md"
  // console.log(inboxConfig.inboxTitle)
  const pref_inboxTitle = inboxConfig.inboxTitle ?? "📥 Inbox"
  // console.log(inboxConfig.addInboxPosition)
  const pref_addInboxPosition = inboxConfig.addInboxPosition ?? "prepend"

  // Get or setup the inbox note from the Datastore
  let newFilename: ?string
  let inboxNote: ?TNote
  if (pref_inboxFilename !== '') {
    console.log(`\tAttempting to use inbox filename: ${String(pref_inboxFilename)}`)
    inboxNote = DataStore.projectNoteByFilename(String(pref_inboxFilename))
    // Create the inbox note if not existing, ask the user which folder
    if (inboxNote == null) {
      const folder = await chooseFolder(
        'Inbox note not found, choose a folder or cancel [ESC]',
      )
      // $FlowFixMe -- don't know how to deal with apparent mixed type here
      newFilename = DataStore.newNote(pref_inboxTitle, folder) ?? ''
      // NB: this returns a filename not of our choosing
      if (newFilename != null) {
        console.log(`\tmade new inbox note, filename = ${newFilename}`)
        // $FlowIgnore[incompatible-call]
        inboxNote = DataStore.projectNoteByFilename(newFilename)
        console.log('\tgot the new inbox note')
      }
    }
  } else {
    inboxNote = DataStore.calendarNoteByDateString(
      unhyphenateString(todaysDateISOString)
    )
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
    console.log(`\tAdded todo to Inbox note '${String(inboxNote?.filename)}'`)
  } else {
    // $FlowFixMe -- don't know how to deal with apparent mixed type here
    console.log(`\tERROR: Couldn't find Inbox note '${pref_inboxFilename}'`)
  }
}
