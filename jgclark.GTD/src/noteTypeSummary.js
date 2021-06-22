// @flow

//-----------------------------------------------------------------------------
// User settings: TODO: move to proper preferences system, when available in NP
const pref_noteTypeTags = '#project'//,#area,#archive'
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
function findMatchingNotesSortedByName(tag: string, folder: string): Array<TNote> {
  let projectNotesInFolder: Array<TNote>
  // If folder given (not empty) then filter using it
  if (folder !== '') {
    projectNotesInFolder = DataStore.projectNotes.slice().filter((n) =>
      n.filename.startsWith(`${folder}/`))
  } else {
    projectNotesInFolder = DataStore.projectNotes.slice()
  }
  // Filter by tag
  const projectNotesWithTag = projectNotesInFolder.filter((n) =>
    n.hashtags.includes(tag))
  // Sort alphabetically on note's title
  const projectNotesSortedByName = projectNotesWithTag.sort(
    (first, second) => second.title - first.title)
  return projectNotesSortedByName
}

// Return line summarising a project note's status:
// - title
// TODO:
// - # open tasks
// - time until due
// - time until next review
function noteStatus(note: TNote): string {
  const titleAsLink = (note.title !== undefined) ? `[[${note.title}]]` : '(error)'
  return `- ${titleAsLink}` // due ... last reviewed ...
}

//-------------------------------------------------------------------------------
// Define 'Project' class to use in GTD.
// Holds title, last reviewed date, due date, review interval, completion date,
// number of closed, open & waiting for tasks
class Project {
  constructor(note) {
    this.note = note
    this.title = note.title
    this.dueDate = undefined // TODO
    this.reviewedDate = undefined // TODO
    this.reviewInterval = ''
    this.completedDate = undefined
    this.openTasks = 0
    this.completedTasks = 0
    this.waitingTasks = 0
  }

  timeUntilDue():string {
    return 'temp' // this.dueDate TODO
  }

  timeUntilReview():string {
    return '3w' // TODO
  }

  basicSummaryLine(): string {
    titleAsLink = (this.title !== undefined) ? `[[${this.title}]]` : '(error)'
    return `- ${titleAsLink}`
  }

  detailedSummaryLine():string {
    const titleAsLink = (note.title !== undefined) ? `[[${note.title}]]` : '(error)'
    return `- ${titleAsLink}\t${timeUntilDue()}\t${timeUntilReview()}` // etc.
  }
}

//-------------------------------------------------------------------------------
// Main function to create a summary note for each tag of interest
export async function noteTypeSummaries() {
  console.log(`\ntesting class Project`)
  let p1 = new Project(Editor.note)
  console.log(p1.detailedSummaryLine())

  console.log(`\nnoteTypeSummaries`)
  const destination = 'note' // or 'note' or 'show'
  const tags = pref_noteTypeTags.split(',')

  for (let i = 0; i < tags.length; i++) {
    // Do the main work
    const outputArray = makeNoteTypeSummary(tags[i])
    const tagName = tags[i].slice(1)
    const noteTitle = `'${tagName}' notes summary`
    outputArray.unshift(`# ${noteTitle}`) // add note title to start

    // Save or show the results
    switch (destination) {
      case 'note': {
        let note: ?TNote
        // first see if this note has already been created
        // (look only in active notes, not Archive or Trash)
        const existingNotes: $ReadOnlyArray<TNote> =
          DataStore.projectNoteByTitle(noteTitle, true, false)
        console.log(`\tfound ${existingNotes.length} existing summary notes for this period`)

        if (existingNotes.length > 0) {
          note = existingNotes[0] // pick the first if more than one
          console.log(`\tfilename of first matching note: ${note.filename}`)
        } else {
          // make a new note for this
          let noteFilename = await DataStore.newNote(noteTitle, pref_folderToStore)
          console.log(`\tnewNote filename: ${noteFilename}`)
          noteFilename = `${pref_folderToStore}/${noteFilename}` ?? '(error)'
          // NB: filename here = folder + filename
          note = await DataStore.projectNoteByFilename(noteFilename)
          console.log(`\twriting results to the new note '${noteFilename}'`)
        }

        if (note != null) {
          note.content = outputArray.join("\n")
        } else {
          console.log("makeNoteTypeSummary: error: shouldn't get here -- no valid note to write to")
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
        const re = await CommandBar.showOptions(outputArray, `Summary for ${noteTag} notes.  (Select anything to copy)`)
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
  const folderList = (pref_groupedByFolder) ? DataStore.folders : ['/']
  console.log(`${folderList.length} folders`)
  // Iterate over the folders
  for (let f = 0; f < folderList.length; f++) {
    const notes = findMatchingNotesSortedByName(noteTag, folderList[f])
    // console.log(notes.length)
    if (notes.length > 0) {
      if (pref_groupedByFolder) {
        outputArray.push(`### ${folderList[f]} (${notes.length} notes)`)
      }
      // iterate over this folder's notes
      for (let n = 0; n < notes.length; n++) {
        outputArray.push(noteStatus(notes[n]))
      }
      noteCount += notes.length
    }
  }
  // Add a summary/ies onto the start
  if (!pref_groupedByFolder) {
    outputArray.unshift(`### All folders (${notes.length} notes)`)
  }
  outputArray.unshift(`Total: ${noteCount} notes. (Last updated: ${nowShortDateTime})`)
  return outputArray
}
