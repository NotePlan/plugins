// @flow
//-------------------------------------------------------------------------------
// Note-level Functions

import { log, logError } from './dev'
import { getFolderFromFilename } from './folders'
import { showMessage } from './userInput'
import { removeSection } from './paragraph'
import {
  displayTitle,
  type headingLevelType
} from './general'

/**
 * Print summary of note details to log
 * @author @eduardmet
 * @param {TNote} note
 */
export function printNote(note: TNote): void {
  if (note == null) {
    console.log('No Note found!')
    return
  }

  if (note.type === 'Notes') {
    log('printNote()',
      `title: ${note.title ?? ''}\n\tfilename: ${note.filename ?? ''}\n\tcreated: ${String(note.createdDate) ?? ''}\n\tchanged: ${String(note.changedDate) ?? ''}\n\tparagraphs: ${note.paragraphs.length}\n\thashtags: ${
        note.hashtags?.join(',') ?? ''
      }\n\tmentions: ${note.mentions?.join(',') ?? ''}`,
    )
  } else {
    log('printNote()',
      `filename: ${note.filename ?? ''}\n\tcreated: ${String(note.createdDate) ?? ''}\n\tchanged: ${String(note.changedDate) ?? ''}\n\tparagraphs: ${note.paragraphs.length}\n\thashtags: ${
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
export async function noteOpener(fullPath: string,
  desc: string,
  useProjNoteByFilename: boolean = true
): Promise<?TNote> {
  log('noteOpener()', `  About to open filename: "${fullPath}" (${desc}) using ${useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'}`)
  const newNote = useProjNoteByFilename ? await DataStore.projectNoteByFilename(fullPath) : await DataStore.noteByFilename(fullPath, 'Notes')
  if (newNote != null) {
    log('noteOpener()', `    Opened ${fullPath} (${desc} version) `)
    return newNote
  } else {
    log('noteOpener()', `    Didn't work! ${useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'} returned ${(newNote: any)}`)
  }
}

/**
 * Get or create the relevant note in the given folder
 * @author @jgclark
 *
 * @param {string} noteTitle - title of summary note
 * @param {string} noteFolder - folder to look in (must be full path or "/")
 * @return {Promise<TNote>} - note object
 */
export async function getOrMakeNote(noteTitle: string, noteFolder: string): Promise<?TNote> {
  // first see if this note has already been created (ignoring Archive and Trash)
  const potentialNotes: $ReadOnlyArray<TNote> = DataStore.projectNoteByTitle(noteTitle, true, false) ?? []
  log('getOrMakeNote()', `  found ${potentialNotes.length} existing '${noteTitle}' note(s)`)
  const existingNotes = potentialNotes && noteFolder !== '/' ? potentialNotes.filter((n) => n.filename.startsWith(noteFolder)) : potentialNotes

  if (existingNotes.length > 0) {
    log('getOrMakeNote()', `  found ${existingNotes.length} notes. [0] = ${existingNotes[0].filename}`)
    return existingNotes[0] // return the only or first match (if more than one)
  } else {
    // no existing note, so need to make a new one
    const noteFilename = await DataStore.newNote(noteTitle, noteFolder)
    // NB: filename here = folder + filename
    if (noteFilename != null && noteFilename !== '') {
      log('getOrMakeNote()', `  newNote filename: ${String(noteFilename)}`)
      const note = await DataStore.projectNoteByFilename(noteFilename)
      if (note != null) {
        return note
      } else {
        showMessage(`Oops: I can't make new ${noteTitle} note`, 'OK')
        logError('getOrMakeNote()', `can't read new ${noteTitle} note`)
        return
      }
    } else {
      showMessage(`Oops: I can't make new ${noteTitle} note`, 'OK')
      logError('getOrMakeNote()', `empty filename of new ${noteTitle} note`)
      return
    }
  }
}

/**
 * Return list of notes with a particular hashtag, optionally in the given folder.
 * @author @jgclark
 *
 * @param {string} tag - tag name to look for (or blank, in which case no filtering by tag)
 * @param {?string} folder - optional folder to limit to
 * @param {?boolean} includeSubfolders - if folder given, whether to look in subfolders of this folder or not (optional, defaults to false)
 * @return {Array<TNote>}
 */
export function findNotesMatchingHashtags(tag: string,
  folder: ?string,
  includeSubfolders: ?boolean = false
): Array<TNote> {
  let projectNotesInFolder: Array<TNote>
  // If folder given (not empty) then filter using it
  if (folder != null) {
    if (includeSubfolders) {
      // use startsWith as filter to include subfolders
      // FIXME: not working for root-level notes
      projectNotesInFolder = DataStore.projectNotes.slice().filter((n) => n.filename.startsWith(`${folder}/`))
    } else {
      // use match as filter to exclude subfolders
      projectNotesInFolder = DataStore.projectNotes.slice().filter((n) => getFolderFromFilename(n.filename) === folder)
    }
  } else {
    // no folder specified, so grab all notes from DataStore
    projectNotesInFolder = DataStore.projectNotes.slice()
  }
  // Filter by tag (if one has been given)
  const projectNotesWithTag = tag !== '' ? projectNotesInFolder.filter((n) => n.hashtags.includes(tag)) : projectNotesInFolder
  log('findNotesMatchingHashtags', `In folder '${folder ?? '<all>'}' found ${projectNotesWithTag.length} notes matching '${tag}'`)
  return projectNotesWithTag
}

/**
 * Get all notes in a given folder (or all project notes if no folder given)
 * @author @dwertheimer

 * @param {string} forFolder name (e.g. 'myFolderName')
 * @returns {$ReadOnlyArray<TNote>} array of notes in the folder
 */
export function getProjectNotesInFolder(forFolder: string = ''): $ReadOnlyArray<TNote> {
  const notes: $ReadOnlyArray<TNote> = DataStore.projectNotes
  if (forFolder === '') {
    return notes
  } else {
    // if last character is a slash, remove it
    const folderWithSlash = forFolder.charAt(forFolder.length - 1) === '/' ? forFolder : `${forFolder}/`
    const filteredNotes = notes.filter((note) => note.filename.includes(folderWithSlash))
    log('getProjectNotesIFolder()', `Found ${filteredNotes.length} notes in folder ${forFolder}`)
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
    notesInFolder = DataStore.projectNotes.slice().filter((n) => getFolderFromFilename(n.filename) === folder)
  } else {
    notesInFolder = DataStore.projectNotes.slice()
  }
  // Sort alphabetically on note's title
  const notesSortedByTitle = notesInFolder.sort((first, second) => (first.title ?? '').localeCompare(second.title ?? ''))
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
  const allNotesSorted = allNotes.sort((first, second) => second.changedDate - first.changedDate) // most recent first
  return allNotesSorted
}

/**
 * Return list of calendar notes, sorted by changed date (newest to oldest)
 * @author @jgclark
 *
 * @return {Array<TNote>} - list of notes
 */
export function calendarNotesSortedByChanged(): Array<TNote> {
  return DataStore.calendarNotes.slice().sort((first, second) => second.changedDate - first.changedDate)
}

/**
 * Return list of weekly notes, sorted by changed date (newest to oldest)
 * @author @jgclark
 *
 * @return {Array<TNote>} - list of notes
 */
export const RE_WEEKLY_NOTE_FILENAME = "\\/?\\d{4}-W\\d{2}\\."
export function weeklyNotesSortedByChanged(): Array<TNote> {
  const weeklyNotes = DataStore.calendarNotes.slice().filter((f) => f.filename.match(RE_WEEKLY_NOTE_FILENAME))
  return weeklyNotes.sort((first, second) => second.changedDate - first.changedDate)
}

/**
 * Return list of project notes, sorted by changed date (newest to oldest)
 * @author @jgclark
 *
 * @return {Array<TNote>} - list of notes
 */
export function projectNotesSortedByChanged(): Array<TNote> {
  return DataStore.projectNotes.slice().sort((first, second) => second.changedDate - first.changedDate)
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
    const paras = note.type === 'Calendar' ? note.paragraphs : note.paragraphs.filter((para) => para.lineIndex !== 0)
    note.removeParagraphs(paras)
  }
}

export function replaceSection(note: TNote, sectionHeadingToRemove: string, newSectionHeading: string,
  sectionHeadingLevel: headingLevelType, sectionText: string): void {
  log('replaceSection', `in note '${displayTitle(note)}' for ${sectionHeadingToRemove} for ${sectionText.length} chars`)

  // First remove existing heading (the start will probably be right, but the end will probably need to be changed)
  const insertionLineIndex = removeSection(note, sectionHeadingToRemove)
  // Set place to insert either after the found section heading, or at end of note
  // write in reverse order to avoid having to calculate insertion point again
  note.insertHeading(
    newSectionHeading,
    insertionLineIndex,
    sectionHeadingLevel,
  )
  note.insertParagraph(
    sectionText,
    insertionLineIndex + 1,
    'text',
  )
}
