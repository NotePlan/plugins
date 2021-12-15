// --------------------------------------------------------------------------------------------------------------------
// QuickCapture plugin for NotePlan (was: TaskHelpers)
// Jonathan Clark
// v0.8.3, 15.12.2021
// --------------------------------------------------------------------------------------------------------------------

// Settings from NotePlan
// var defaultFileExtension = (DataStore.defaultFileExtension != undefined) ? DataStore.defaultFileExtension : "md"
// let defaultTodoMarker = (DataStore.preference('defaultTodoCharacter') !== undefined) ? DataStore.preference('defaultTodoCharacter') : '*'

// Items that will come from the Preference framework in time:
const pref_inboxFilename = '' // leave blank for daily note, or give relative filename (e.g. "Folder/Inbox.md")
const pref_inboxTitle = '📥 Inbox'
const pref_addInboxPosition = 'append' // or "append"

// ------------------------------------------------------------------
// Helper function, not called by a command
function printNote(note) {
  if (note === undefined) {
    console.log('Note not found!')
    return
  }

  if (note.type === 'Notes') {
    console.log(
      `title: ${note.title}\n
      \tfilename: ${note.filename}\n
      \thashtags: ${note.hashtags}\n
      \tmentions: ${note.mentions}\n
      \tcreated: ${note.createdDate}\n
      \tchanged: ${note.changedDate}`
    )
  } else {
    console.log(
      `date: ${note.date}\n
      \tfilename: ${note.filename}\n
      \thashtags: ${note.hashtags}\n
      \tmentions: ${note.mentions}`
    )
  }
}

globalThis.printNote = printNote

// ------------------------------------------------------------------
// Prepends a task to a chosen note
async function prependTaskToNote() {
  const taskName = await CommandBar.showInput(
    'Type the task name',
    'Prepend \'%@\'...',
  )
  const notes = projectNotesSortedByChanged()

  const re = await CommandBar.showOptions(
    notes.map((n) => n.title),
    'Select note to prepend',
  )
  notes[re.index].prependTodo(taskName)
}

globalThis.prependTaskToNote = prependTaskToNote

// ------------------------------------------------------------------
// Appends a task to a chosen note
async function appendTaskToNote() {
  const taskName = await CommandBar.showInput(
    'Type the task name',
    `Append '%@'...`,
  )
  const notes = projectNotesSortedByChanged()

  const re = await CommandBar.showOptions(
    notes.map((n) => n.title),
    'Select note to append',
  )
  notes[re.index].appendTodo(taskName)
}

globalThis.appendTaskToNote = appendTaskToNote

// ------------------------------------------------------------------
// This adds a task to a selected heading, based on EM's 'example25'.
// Problem here is that duplicate headings are not respected.
async function addTaskToNoteHeading() {
  // Ask for the todo title
  const todoTitle = await CommandBar.showInput(
    'Type the task',
    `Add task '%@'`,
  )

  // Then ask for the note we want to add the todo
  const notes = projectNotesSortedByChanged()
  // CommandBar.showOptions only takes [string] as input
  const re = await CommandBar.showOptions(
    notes.map((n) => n.title),
    'Select note for new todo',
  )
  const note = notes[re.index]

  // Finally, ask to which heading to add the todo
  const headings = note.paragraphs.filter((p) => p.type === 'title')
  const re2 = await CommandBar.showOptions(
    headings.map((p) => p.prefix + p.content), `Choose a heading from note '${note.title}'`)
  const heading = headings[re2.index]
  // console.log("Selected heading: " + heading.content)
  console.log(`Adding todo: ${todoTitle} to ${note.title} in heading: ${heading.content}`)

  // Add todo to the heading in the note (and add the heading if it doesn't exist)
  note.addTodoBelowHeadingTitle(todoTitle, heading.content, false, true)
}

globalThis.addTaskToNoteHeading = addTaskToNoteHeading

// ------------------------------------------------------------------
// This adds a note to a selected note's heading.
// Problem here is that duplicate headings are not respected.
async function addTextToNoteHeading() {
  // Ask for the note text
  const text = await CommandBar.showInput(
    'Type the text to add',
    `Add text '%@'`,
  )

  // Then ask for the note we want to add the text
  const notes = projectNotesSortedByChanged()
  // CommandBar.showOptions only takes [string] as input
  const re = await CommandBar.showOptions(
    notes.map((n) => n.title),
    'Select note for new text',
  )
  const note = notes[re.index]

  // Finally, ask to which heading to add the text
  const headings = note.paragraphs.filter((p) => p.type === 'title')
  const re2 = await CommandBar.showOptions(
    headings.map((p) => p.prefix + p.content), `Choose a heading from note '${note.title}'`)
  const heading = headings[re2.index]
  // console.log("Selected heading: " + heading.content)
  console.log(
    'Adding text: ' +
    text +
    ' to ' +
    note.title +
    ' in heading: ' +
    heading.content,
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

globalThis.addTextToNoteHeading = addTextToNoteHeading

// ------------------------------------------------------------------
// This adds a task to a special 'inbox' note. Possible configuration:
// - append or prepend to the inbox note (default: append)
// - add to today's daily note (default) or to a particular named note
async function addTaskToInbox() {
  // PREVIOUS CODE
  // let todoTitle = await CommandBar.showInput('Type the task to add to your Inbox note', "Add task '%@'")
  // let inboxNote
  // // Get the relevant note from the Datastore
  // if (pref_inboxFilename != "") {
  //   inboxNote = DataStore.projectNoteByFilename(pref_inboxFilename)
  // } else {
  //   let todaysDate = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  //   inboxNote = DataStore.calendarNoteByDateString(todaysDate) // Add this todo to today's daily note
  // }

  let newFilename = null
  let inboxNote = null

  if (pref_inboxTitle !== '') {
    inboxNote = DataStore.projectNoteByTitle(pref_inboxTitle)[0]

    // Create the inbox note if not existing, ask the user which folder
    if (inboxNote == null) {
      const folders = DataStore.folders
      const folder = await CommandBar.showOptions(
        folders,
        'Inbox not found, choose a folder or cancel [ESC]',
      )
      newFilename = DataStore.newNote(pref_inboxTitle, folder.value)
    }
  }

  // Ask for the todo title
  const todoTitle = await CommandBar.showInput(
    'Type the task to add to your Inbox note',
    'Add task \'%@\'',
  )

  // Re-fetch the note if we created it previously. We need to wait a bit so it's cached, that's why we query it after the task input.
  if (newFilename != null) {
    inboxNote = DataStore.projectNoteByFilename(newFilename)
    console.log(`inbox note: ${inboxNote}`)
  } else {
    console.log('newFilename is still null')
  }

  // Get the relevant note from the Datastore
  if (inboxNote != null) {
    if (pref_addInboxPosition === 'append') {
      inboxNote.appendTodo(todoTitle)
    } else {
      inboxNote.prependTodo(todoTitle)
    }
    console.log(`Added todo to Inbox note '${inboxNote.filename}'`)
  } else {
    console.log(`ERROR: Couldn't find Inbox note '${pref_inboxFilename}'`)
  }
}

globalThis.addTaskToInbox = addTaskToInbox

function projectNotesSortedByChanged() {
  return DataStore.projectNotes.sort(
    (first, second) => first.changedDate < second.changedDate,
  )
}
