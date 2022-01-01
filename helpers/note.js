// @flow
//-------------------------------------------------------------------------------
// Note-level Functions

import { getFolderFromFilename } from './folders'
import { showMessage } from './userInput'

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
      `title: ${note.title ?? ''}\n\tfilename: ${
        note.filename ?? ''
      }\n\tcreated: ${String(note.createdDate) ?? ''}\n\tchanged: ${
        String(note.changedDate) ?? ''
      }\n\thashtags: ${note.hashtags?.join(',') ?? ''}\n\tmentions: ${
        note.mentions?.join(',') ?? ''
      }`,
    )
  } else {
    console.log(
      `filename: ${note.filename ?? ''}\n\tcreated: ${
        String(note.createdDate) ?? ''
      }\n\tchanged: ${String(note.changedDate) ?? ''}\n\thashtags: ${
        note.hashtags?.join(',') ?? ''
      }\n\tmentions: ${note.mentions?.join(',') ?? ''}`,
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
 * Get or create the relevant note in the given folder
 * @author @jgclark
 * 
 * @param {string} noteTitle - title of summary note
 * @param {string} noteFolder - folder to look in
 * @return {Promise<TNote>} - note object
 */
export async function getOrMakeNote(
  noteTitle: string,
  noteFolder: string
): Promise<?TNote> {
  // first see if this note has already been created (ignoring Archive and Trash)
  const existingNotes: $ReadOnlyArray<TNote> =
    DataStore.projectNoteByTitle(noteTitle, true, false) ?? []
  console.log(
    `\tfound ${existingNotes.length} existing '${noteTitle}' note(s)`,
  )

  if (existingNotes.length > 0) {
    // console.log(`\t${existingNotes[0].filename}`)
    return existingNotes[0] // return the only or first match (if more than one)
  } else {
    // no existing note, so need to make a new one
    const noteFilename = await DataStore.newNote(noteTitle, noteFolder)
    // NB: filename here = folder + filename
    if (noteFilename != null && noteFilename !== '') {
      console.log(`\tnewNote filename: ${String(noteFilename)}`)
      const note = await DataStore.projectNoteByFilename(noteFilename)
      if (note != null) {
        return note
      } else {
        showMessage(`Oops: I can't make new ${noteTitle} note`, 'OK')
        console.log(`getOrMakeNote: error: can't read new ${noteTitle} note`)
        return
      }
    } else {
      showMessage(`Oops: I can't make new ${noteTitle} note`, 'OK')
      console.log(`getOrMakeNote: error: empty filename of new ${noteTitle} note`)
      return
    }
  }
}

/**
 * Get all notes in a given folder (or all project notes if no folder given)
 * TODO(@dwertheimer): I don't think the 'await DataStore.projectNotes' should be async.
 * @author @dwertheimer

 * @param {string} forFolder name (e.g. 'myFolderName')
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
 * Get all notes in a given folder (or all project notes if no folder given),
 * sorted by note title
 * @author @jgclark
 * 
 * @param {string} folder - folder to scan
 * @return {Array<TNote>} - list of notes
 */
export function notesInFolderSortedByTitle(folder: string): Array<TNote> {
  let notesInFolder: Array<TNote>
  // If folder given (not empty) then filter using it
  if (folder !== '') {
    notesInFolder = DataStore.projectNotes
      .slice()
      .filter((n) => getFolderFromFilename(n.filename) === folder)
  } else {
    notesInFolder = DataStore.projectNotes.slice()
  }
  // Sort alphabetically on note's title
  const notesSortedByTitle = notesInFolder.sort((first, second) =>
    (first.title ?? '').localeCompare(second.title ?? ''),
  )
  return notesSortedByTitle
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

/** 
 * Return list of all notes, sorted by changed date (newest to oldest)
 * @author @jgclark
 * 
 * @return {Array<TNote>} - list of notes
 */
export function allNotesSortedByChanged(): Array<TNote> {
  const projectNotes = DataStore.projectNotes.slice()
  const calendarNotes = DataStore.calendarNotes.slice()
  const allNotes = projectNotes.concat(calendarNotes)
  const allNotesSorted = allNotes.sort(
    (first, second) => second.changedDate - first.changedDate,
  ) // most recent first
  return allNotesSorted
}

/** 
 * Return list of calendar notes, sorted by changed date (newest to oldest)
 * @author @jgclark
 * 
 * @return {Array<TNote>} - list of notes
 */
export function calendarNotesSortedByChanged(): Array<TNote> {
  return DataStore.calendarNotes
    .slice()
    .sort((first, second) => second.changedDate - first.changedDate)
}

/** 
 * Return list of project notes, sorted by changed date (newest to oldest)
 * @author @jgclark
 * 
 * @return {Array<TNote>} - list of notes
 */
export function projectNotesSortedByChanged(): Array<TNote> {
  return DataStore.projectNotes
    .slice()
    .sort((first, second) => second.changedDate - first.changedDate)
}

/** 
 * Return list of project notes, sorted by title (ascending)
 * @author @jgclark
 * 
 * @return {Array<TNote>} - list of notes
 */
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

/**
 * Clears the complete note (but leaves the title in project note)
 * @author @m1well
 *
 * @param {TNote} note input note to clear
 */
export const clearNote = (note: TNote) => {
  if (note.type === 'Calendar' || (note.type === 'Notes' && note.paragraphs.length > 1)) {
    const paras = note.type === 'Calendar' ? note.paragraphs : note.paragraphs.filter(para => para.lineIndex !== 0)
    note.removeParagraphs(paras)
  }
}
