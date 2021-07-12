// @flow
// --------------------------------------------------------------------------------------------------------------------
// QuickCapture plugin for NotePlan
// Jonathan Clark
// v0.4.5, 12.7.2021
// --------------------------------------------------------------------------------------------------------------------

import {
  // getDefaultConfiguration,
  getOrMakeConfigurationSection,
} from '../../nmn.Templates/src/configuration'
  
import {
  // printNote,
  showMessage,
  unhyphenateDateString,
  todaysDateISOString,
  displayTitle,
  chooseFolder,
} from '../../helperFunctions'

// ------------------------------------------------------------------
// Prepends a task to a chosen note, but more smartly that usual. 
// I.e. if the note starts with YAML frontmatter (e.g. https://docs.zettlr.com/en/core/yaml-frontmatter/)
// or a metadata line (= starts with a hashtag), then add after that.
export function smartPrependPara(note: TNote,
  paraText: string,
  paragraphType: ParagraphType): void {
  
  const lines = note.content?.split('\n') ?? ['']

  // By default we prepend at line 1, i.e. right after the Title line
  let insertionLine = 1
  // If we have any content, check for these special cases
  if (lines.length > 0) {
    if (lines[0] === '---') {
      // console.log(`YAML start found. Will check ${lines.length} lines`)
      // We (probably) have a YAML block
      // Find end of YAML/frontmatter
      // TODO: check my ruby code to see what I did here
      for (let i = 1; i < lines.length; i++) {
        if (lines[i] === '---' || lines[i] === '...') {
          // console.log(`YAML end at ${i}`)
          insertionLine = i + 1
          break
        }
      }
      if (insertionLine === 1) {
        // If we get here we haven't found an end to the YAML block.
        console.log(`Warning: couldn't find end of YAML frontmatter in note ${displayTitle(note)}`)
        // It's not clear what to do at this point, so will leave insertion point as is
      }
    } else if (lines[1].match(/^#[A-z]/)) {
      // We have a hashtag at the start of the line, making this a metadata line
      // Move insertion point to after the next blank line, or before the next 
      // heading line, whichever is sooner.
      // console.log(`Metadata line found`)
      for (let i = 2; i < 13 /*lines.length*/; i++) {
        // console.log(`${i}: ${lines[i]}`)
        if (lines[i].match(/^#{1,5}\s/)) {
            // console.log(`  Heading at ${i}`)
            insertionLine = i + 1
            break
          } else if (lines[i] === '') {
            // console.log(`  Blank line at ${i}`)
            insertionLine = i + 1
            break
          }
      }
    }
  }
  // Insert the text at the insertionLine line
  note.insertParagraph(paraText, insertionLine, paragraphType)
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
  // Old way
  // notes[re.index].prependTodo(taskName)
  // Newer way
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
export async function appendTaskToDailyNote() {
  // Ask for the task title
  const todoTitle = await CommandBar.showInput('Type the task', "Add task '%@'")

  // Then ask for the daily note we want to add the todo
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
// Quickly append text to today's journal
export async function appendTaskToDailyJournal() {
  const todaysDateStr = unhyphenateDateString(todaysDateISOString)
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
export async function addTaskToInbox() {
  console.log(`addTaskToInbox:`)
  // Get config settings from Template folder _configuration note
  let inboxConfig = await getOrMakeConfigurationSection('inbox', DEFAULT_INBOX_CONFIG)
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
        'Inbox not found, choose a folder or cancel [ESC]',
      )
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
      unhyphenateDateString(todaysDateISOString)
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
    console.log(`\tERROR: Couldn't find Inbox note '${pref_inboxFilename}'`)
  }
}

const DEFAULT_INBOX_CONFIG = `
  inbox: {
    inboxFilename: "📥 Inbox.md",
    inboxTitle: "📥 Inbox",
    addInboxPosition: "prepend",
  },
`

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
