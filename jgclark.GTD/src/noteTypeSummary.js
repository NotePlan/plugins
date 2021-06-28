// @flow

//-----------------------------------------------------------------------------
// User settings: TODO: move to proper preferences system, when available in NP
const pref_noteTypeTags = '#project' //,#area,#archive'
const pref_groupedByFolder = true
const pref_folderToStore = 'Summaries'

//-----------------------------------------------------------------------------
// Helper functions
import {
  // chooseOption,
  // monthsAbbrev,
  // todaysDateISOString,
  // unhyphenateDateString,
  // hyphenatedDateString,
  // filenameDateString,
  nowShortDateTime,
} from '../../helperFunctions.js'

// Return list of notes in a folder with a particular hashtag
function findMatchingNotesSortedByName(
  tag: string,
  folder: string,
): Array<TNote> {
  let projectNotesInFolder: Array<TNote>
  // If folder given (not empty) then filter using it
  if (folder !== '') {
    projectNotesInFolder = DataStore.projectNotes
      .slice()
      .filter((n) => n.filename.startsWith(`${folder}/`))
  } else {
    projectNotesInFolder = DataStore.projectNotes.slice()
  }
  // Filter by tag
  const projectNotesWithTag = projectNotesInFolder.filter((n) =>
    n.hashtags.includes(tag),
  )
  // Sort alphabetically on note's title
  const projectNotesSortedByName = projectNotesWithTag.sort((first, second) =>
    (first.title ?? '').localeCompare(second.title ?? ''),
  )
  return projectNotesSortedByName
}

// Return line summarising a project note's status:
// - title
// TODO:
// - # open tasks
// - time until due
// - time until next review
function noteStatus(note: TNote): string {
  const titleAsLink = note.title !== undefined ? `[[${note.title}]]` : '(error)'
  return `- ${titleAsLink}` // due ... last reviewed ...
}

//-------------------------------------------------------------------------------
// Define 'Project' class to use in GTD.
// Holds title, last reviewed date, due date, review interval, completion date,
// number of closed, open & waiting for tasks
// NOTE: class syntax is likely not supported in Safari 11.
class Project {
  // Types for the class properties
  note: TNote
  title: ?string
  dueDate: ?Date
  reviewedDate: ?Date
  // reviewInterval
  completedDate: ?Date
  openTasks: number
  completedTasks: number
  waitingTasks: number

  constructor(note: TNote) {
    this.note = note
    this.title = note.title
    this.dueDate = undefined // TODO
    this.reviewedDate = undefined // TODO
    // this.reviewInterval = ''
    this.completedDate = undefined
    this.openTasks = 0
    this.completedTasks = 0
    this.waitingTasks = 0
  }

  timeUntilDue(): string {
    return 'temp' // this.dueDate TODO
  }

  timeUntilReview(): string {
    return '3w' // TODO
  }

  basicSummaryLine(): string {
    const titleAsLink =
      this.title !== undefined ? `[[${this.title ?? ''}]]` : '(error)'
    return `- ${titleAsLink}`
  }

  detailedSummaryLine(): string {
    // Class properties must always be used with `this.`
    const titleAsLink =
      this.note.title !== undefined ? `[[${this.note.title ?? ''}]]` : '(error)'
    return `- ${titleAsLink}\t${this.timeUntilDue()}\t${this.timeUntilReview()}` // etc.
  }
}

//-------------------------------------------------------------------------------
// Main function to create a summary note for each tag of interest
export async function noteTypeSummaries() {
  console.log(`\ntesting class Project`)
  const note = Editor.note
  if (!note) {
    return
  }

  const p1 = new Project(note)
  console.log(p1.detailedSummaryLine())

  console.log(`\nnoteTypeSummaries`)
  const destination = 'note' // or 'note' or 'show'
  const tags = pref_noteTypeTags.split(',')

  for (const tag of tags) {
    // Do the main work
    const outputArray = makeNoteTypeSummary(tag)
    const tagName = tag.slice(1)
    const noteTitle = `'${tagName}' notes summary`
    outputArray.unshift(`# ${noteTitle}`) // add note title to start

    // Save or show the results
    switch (destination) {
      case 'note': {
        let note: ?TNote
        // first see if this note has already been created
        // (look only in active notes, not Archive or Trash)
        const existingNotes: $ReadOnlyArray<TNote> =
          DataStore.projectNoteByTitle(noteTitle, true, false) ?? []
        console.log(
          `\tfound ${existingNotes.length} existing summary notes for this period`,
        )

        if (existingNotes.length > 0) {
          note = existingNotes[0] // pick the first if more than one
          console.log(`\tfilename of first matching note: ${note.filename}`)
        } else {
          // make a new note for this
          let noteFilename = await DataStore.newNote(
            noteTitle,
            pref_folderToStore,
          )
          console.log(`\tnewNote filename: ${String(noteFilename)}`)
          noteFilename =
            `${pref_folderToStore}/${String(noteFilename)}` ?? '(error)'
          // NB: filename here = folder + filename
          note = await DataStore.projectNoteByFilename(noteFilename)
          console.log(`\twriting results to the new note '${noteFilename}'`)
        }

        if (note != null) {
          // This is a bug in flow. Creating a temporary const is a workaround.
          const n = note
          n.content = outputArray.join('\n')
        } else {
          console.log(
            "makeNoteTypeSummary: error: shouldn't get here -- no valid note to write to",
          )
          return
        }

        console.log(`\twritten results to note '${noteTitle}'`)
        break
      }

      case 'log': {
        console.log(outputArray.join('\n'))
        break
      }

      default: {
        const re = await CommandBar.showOptions(
          outputArray,
          // you had noteTag here. But that variable is not defined
          `Summary for ${String(tag)} notes.  (Select anything to copy)`,
        )
        if (re !== null) {
          Clipboard.string = outputArray.join('\n')
        }
        break
      }
    }
  }
}

//-------------------------------------------------------------------------------
// Return summary of notes that contain a particular tag, for all
// relevant folders
export function makeNoteTypeSummary(noteTag: string): Array<string> {
  console.log(`\nmakeNoteTypeSummary for ${noteTag}`)

  let noteCount = 0
  const outputArray: Array<string> = []

  // if we want a summary broken down by folder, create list of folders
  // otherwise use a single folder
  const folderList = pref_groupedByFolder ? DataStore.folders : ['/']
  console.log(`${folderList.length} folders`)
  // Iterate over the folders
  let notesLength = 0
  // A for-of loop is cleaner and less error prone than a regular for-loop
  for (const folder of folderList) {
    const notes = findMatchingNotesSortedByName(noteTag, folder)
    // console.log(notes.length)
    if (notes.length > 0) {
      if (pref_groupedByFolder) {
        outputArray.push(`### ${folder} (${notes.length} notes)`)
      }
      // iterate over this folder's notes
      for (const note of notes) {
        outputArray.push(noteStatus(note))
      }
      noteCount += notes.length
    }
    notesLength = notes.length
  }
  // Add a summary/ies onto the start
  if (!pref_groupedByFolder) {
    // NOTE: notes wasn't defined here
    // Do you want the last value of `notes` from within the for loop?
    // That's what I made it use for now.
    outputArray.unshift(`### All folders (${notesLength} notes)`)
  }
  outputArray.unshift(
    `Total: ${noteCount} notes. (Last updated: ${nowShortDateTime})`,
  )
  return outputArray
}
