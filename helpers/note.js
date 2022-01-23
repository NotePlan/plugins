// @flow
//-------------------------------------------------------------------------------
// Note-level Functions

import { getFolderFromFilename } from './general'

/**
 * Print summary of note details to log
 * @author @eduardmet
 * @param {TNote} note
 */
export function printNote(note: TNote): void {
  if (note == null) {
    console.log('Note not found!')
    return
  }

  if (note.type === 'Notes') {
    console.log(
      `title: ${note.title ?? ''}\n\tfilename: ${note.filename ?? ''}\n\tcreated: ${
        String(note.createdDate) ?? ''
      }\n\tchanged: ${String(note.changedDate) ?? ''}\n\thashtags: ${note.hashtags?.join(',') ?? ''}\n\tmentions: ${
        note.mentions?.join(',') ?? ''
      }`,
    )
  } else {
    console.log(
      `filename: ${note.filename ?? ''}\n\tcreated: ${String(note.createdDate) ?? ''}\n\tchanged: ${
        String(note.changedDate) ?? ''
      }\n\thashtags: ${note.hashtags?.join(',') ?? ''}\n\tmentions: ${note.mentions?.join(',') ?? ''}`,
    )
  }
}

/**
 * Open a note using whatever method works (open by title, filename, etc.)
 * Note: this function was used to debug/work-around API limitations. Probably not necessary anymore
 * Leaving it here for the moment in case any plugins are still using it
 * @author @dwertheimer
 * @param {string} fullPath
 * @param {string} desc
 * @param {boolean} useProjNoteByFilename (default: true)
 * @returns {any} - the note that was opened
 */
export async function noteOpener(
  fullPath: string,
  desc: string,
  useProjNoteByFilename: boolean = true,
): Promise<?TNote> {
  console.log(
    `\tAbout to open filename: "${fullPath}" (${desc}) using ${
      useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'
    }`,
  )
  const newNote = useProjNoteByFilename
    ? await DataStore.projectNoteByFilename(fullPath)
    : await DataStore.noteByFilename(fullPath, 'Notes')
  if (newNote != null) {
    console.log(`\t\tOpened ${fullPath} (${desc} version) `)
    return newNote
  } else {
    console.log(
      `\t\tDidn't work! ${
        useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'
      } returned ${(newNote: any)}`,
    )
  }
}

/**
 * Get all notes in a folder
 * @author @dwertheimer
 * @param {string} folder name (e.g. 'myFolderName')
 * @returns {Promise<$ReadOnlyArray<TNote>>} - array of notes in the folder
 */
export async function getProjectNotes(forFolder: string = ''): Promise<$ReadOnlyArray<TNote>> {
  const notes: $ReadOnlyArray<TNote> = await DataStore.projectNotes
  if (forFolder === '') {
    return notes
  } else {
    // if last character is a slash, remove it
    const folderWithSlash = forFolder.charAt(forFolder.length - 1) === '/' ? forFolder : `${forFolder}/`
    const filteredNotes = notes.filter((note) => note.filename.includes(folderWithSlash))
    console.log(`getProjectNotes() Found ${filteredNotes.length} notes in folder ${forFolder}`)
    return filteredNotes
  }
}

/**
 * Find a unique note title for the given text (e.g. "Title", "Title 01" (if Title exists, etc.))
 * Keep adding numbers to the end of a filename (if already taken) until it works
 * @author @dwertheimer
 * @param {string} title - the name of the file
 * @returns {string} the title (not filename) that was created
 */
export function getUniqueNoteTitle(title: string): string {
  let i = 0,
    res = [],
    newTitle = title
  while (++i === 1 || res.length > 0) {
    newTitle = i === 1 ? title : `${title} ${i}`
    res = DataStore.projectNoteByTitle(newTitle, true, false)
  }
  return newTitle
}

// Return list of all notes, sorted by changed date (newest to oldest)
export function allNotesSortedByChanged(): Array<TNote> {
  const projectNotes = DataStore.projectNotes.slice()
  const calendarNotes = DataStore.calendarNotes.slice()
  const allNotes = projectNotes.concat(calendarNotes)
  const allNotesSorted = allNotes.sort((first, second) => second.changedDate - first.changedDate) // most recent first
  return allNotesSorted
}

// Return list of calendar notes, sorted by changed date (newest to oldest)
export function calendarNotesSortedByChanged(): Array<TNote> {
  return DataStore.calendarNotes.slice().sort((first, second) => second.changedDate - first.changedDate)
}

// Return list of project notes, sorted by changed date (newest to oldest)
export function projectNotesSortedByChanged(): Array<TNote> {
  return DataStore.projectNotes.slice().sort((first, second) => second.changedDate - first.changedDate)
}

// Return list of project notes, sorted by title (ascending)
export function projectNotesSortedByTitle(): Array<TNote> {
  const projectNotes = DataStore.projectNotes.slice()
  const notesSorted = projectNotes.sort(function (first, second) {
    const a = first.title?.toUpperCase() ?? '' // ignore upper and lowercase
    const b = second.title?.toUpperCase() ?? '' // ignore upper and lowercase
    if (a < b) {
      return -1 //a comes first
    }
    if (a > b) {
      return 1 // b comes first
    }
    return 0 // names must be equal
  })
  return notesSorted
}

// Return list of notes in a folder with a particular hashtag
export function notesInFolderSortedByName(folder: string): Array<TNote> {
  let notesInFolder: Array<TNote>
  // If folder given (not empty) then filter using it
  if (folder !== '') {
    notesInFolder = DataStore.projectNotes.slice().filter((n) => getFolderFromFilename(n.filename) === folder)
  } else {
    notesInFolder = DataStore.projectNotes.slice()
  }
  // Sort alphabetically on note's title
  const notesSortedByName = notesInFolder.sort((first, second) => (first.title ?? '').localeCompare(second.title ?? ''))
  return notesSortedByName
}
