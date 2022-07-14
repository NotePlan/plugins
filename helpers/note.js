// @flow
//-------------------------------------------------------------------------------
// Note-level Functions

import { log, logError } from './dev'
import { getFolderFromFilename } from './folders'
import { findEndOfActivePartOfNote } from './paragraph'
import { showMessage } from './userInput'
import { displayTitle, type headingLevelType } from './general'
import { hyphenatedDateString } from '@helpers/dateTime'

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
    log(
      'printNote()',
      `title: ${note.title ?? ''}\n\tfilename: ${note.filename ?? ''}\n\tcreated: ${
        String(note.createdDate) ?? ''
      }\n\tchanged: ${String(note.changedDate) ?? ''}\n\tparagraphs: ${note.paragraphs.length}\n\thashtags: ${
        note.hashtags?.join(',') ?? ''
      }\n\tmentions: ${note.mentions?.join(',') ?? ''}`,
    )
  } else {
    log(
      'printNote()',
      `filename: ${note.filename ?? ''}\n\tcreated: ${String(note.createdDate) ?? ''}\n\tchanged: ${
        String(note.changedDate) ?? ''
      }\n\tparagraphs: ${note.paragraphs.length}\n\thashtags: ${note.hashtags?.join(',') ?? ''}\n\tmentions: ${
        note.mentions?.join(',') ?? ''
      }`,
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
  log(
    'noteOpener()',
    `  About to open filename: "${fullPath}" (${desc}) using ${
      useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'
    }`,
  )
  const newNote = useProjNoteByFilename
    ? await DataStore.projectNoteByFilename(fullPath)
    : await DataStore.noteByFilename(fullPath, 'Notes')
  if (newNote != null) {
    log('noteOpener()', `    Opened ${fullPath} (${desc} version) `)
    return newNote
  } else {
    log(
      'noteOpener()',
      `    Didn't work! ${
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
 * @param {string} noteFolder - folder to look in (must be full path or "/")
 * @return {Promise<TNote>} - note object
 */
export async function getOrMakeNote(noteTitle: string, noteFolder: string): Promise<?TNote> {
  // first see if this note has already been created (ignoring Archive and Trash)
  const potentialNotes: $ReadOnlyArray<TNote> = DataStore.projectNoteByTitle(noteTitle, true, false) ?? []
  log('getOrMakeNote()', `  found ${potentialNotes.length} existing '${noteTitle}' note(s)`)
  const existingNotes =
    potentialNotes && noteFolder !== '/'
      ? potentialNotes.filter((n) => n.filename.startsWith(noteFolder))
      : potentialNotes

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
 * Return list of notes with a particular hashtag (singular), optionally in the given folder.
 * @author @jgclark
 *
 * @param {string} tag - tag name to look for
 * @param {?string} folder - optional folder to limit to
 * @param {?boolean} includeSubfolders - if folder given, whether to look in subfolders of this folder or not (optional, defaults to false)
 * @return {Array<TNote>}
 */
export function findNotesMatchingHashtag(
  tag: string,
  folder: ?string,
  includeSubfolders: ?boolean = false,
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

  // Filter by tag
  if (tag !== '') {
    const projectNotesWithTag = projectNotesInFolder.filter((n) => n.hashtags.includes(tag))
    // log(
    //   'findNotesMatchingHashtag',
    //   `In folder '${folder ?? '<all>'}' found ${projectNotesWithTag.length} notes matching '${tag}'`,
    // )
    return projectNotesWithTag
  } else {
    logError('findNotesMatchingHashtag', `No hashtag given. Stopping`)
    return [] // for completeness
  }
}

/**
 * Return array of array of notes with particular hashtags (plural), optionally from the given folder.
 * @author @jgclark
 *
 * @param {Array<string>} tag - tags to look for
 * @param {?string} folder - optional folder to limit to
 * @param {?boolean} includeSubfolders - if folder given, whether to look in subfolders of this folder or not (optional, defaults to false)
 * @return {Array<Array<TNote>>} array of list of notes
 */
export function findNotesMatchingHashtags(
  tags: Array<string>,
  folder: ?string,
  includeSubfolders: ?boolean = false,
): Array<Array<TNote>> {
  if (tags.length === 0) {
    logError('findNotesMatchingHashtags', `No hashtags supplied. Stopping`)
    return []
  }

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

  // Filter by tags
  const projectNotesWithTags = [[]]
  for (const tag of tags) {
    const projectNotesWithTag = projectNotesInFolder.filter((n) => n.hashtags.includes(tag))
    log(
      'findNotesMatchingHashtags',
      `In folder '${folder ?? '<all>'}' found ${projectNotesWithTag.length} notes matching '${tag}'`,
    )
    projectNotesWithTags.push(projectNotesWithTag)
  }
  return projectNotesWithTags
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
export const RE_WEEKLY_NOTE_FILENAME = '\\/?\\d{4}-W\\d{2}\\.'
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

/**
 * Replace all paragraphs in the section of a note with new supplied content.
 * A section is defined (here at least) as all the lines between the heading,
 * and the next heading of that same or higher level, or the end of the file
 * if that's sooner.
 * @author @jgclark
 *
 * @param {TNote} note to use
 * @param {string} headingOfSectionToReplace
 * @param {string} newSectionHeading
 * @param {number} newSectionHeadingLevel
 * @param {string} newSectionContent
 */
export function replaceSection(
  note: TNote,
  headingOfSectionToReplace: string,
  newSectionHeading: string,
  sectionHeadingLevel: headingLevelType,
  newSectionContent: string,
): void {
  log(
    'note/replaceSection',
    `in note '${displayTitle(
      note,
    )}' will remove '${headingOfSectionToReplace}' -> '${newSectionHeading}' level ${sectionHeadingLevel}`,
  )
  // First remove existing heading (the start of the heading text will probably be right, but the end will probably need to be changed)
  const insertionLineIndex = removeSection(note, headingOfSectionToReplace)
  // log('note/replaceSection', `  insertionLineIndex = ${insertionLineIndex}`)

  // Set place to insert either after the found section heading, or at end of note
  // write in reverse order to avoid having to calculate insertion point again
  note.insertHeading(newSectionHeading, insertionLineIndex, sectionHeadingLevel)
  note.insertParagraph(newSectionContent, insertionLineIndex + 1, 'text')
}

/**
 * Remove all paragraphs in the section of a note, given:
 * - Note to use
 * - Section heading line to look for (needs to match from start of line but not necessarily the end)
 * A section is defined (here at least) as all the lines between the heading,
 * and the next heading of that same or higher level, or the end of the file
 * if that's sooner.
 * @author @jgclark
 *
 * @param {TNote} note to use
 * @param {string} headingOfSectionToRemove
 * @return {number} lineIndex of the found headingOfSectionToRemove, or if not found the last line of the note
 */
export function removeSection(note: TNote, headingOfSectionToRemove: string): number {
  const paras = note.paragraphs ?? []
  log(
    'note/removeSection',
    `Trying to remove '${headingOfSectionToRemove}' from note '${displayTitle(note)}' with ${paras.length} paras`,
  )

  const endOfActive = findEndOfActivePartOfNote(note)
  let matchedHeadingIndex // undefined
  let sectionHeadingLevel = 2
  // Find the title/headingOfSectionToRemove whose start matches 'heading'
  for (const p of paras) {
    if (p.type === 'title' && p.content.startsWith(headingOfSectionToRemove)) {
      matchedHeadingIndex = p.lineIndex
      sectionHeadingLevel = p.headingLevel
      break
    }
  }
  // log('note/removeSection', `  mHI ${matchedHeadingIndex} sHL ${sectionHeadingLevel} eOA ${endOfActive}`)

  if (matchedHeadingIndex !== undefined && matchedHeadingIndex < endOfActive) {
    note.removeParagraph(paras[matchedHeadingIndex])
    // Work out the set of paragraphs to remove
    const parasToRemove = []
    for (let i = matchedHeadingIndex + 1; i < endOfActive; i++) {
      // stop removing when we reach heading of same or higher level (or end of active part of note)
      if (paras[i].type === 'title' && paras[i].headingLevel <= sectionHeadingLevel) {
        break
      }
      parasToRemove.push(paras[i])
    }

    // Delete the saved set of paragraphs
    note.removeParagraphs(parasToRemove)
    log(
      'note/removeSection',
      `-> removed section '${headingOfSectionToRemove}': total  ${parasToRemove.length} paragraphs. Returning line ${matchedHeadingIndex}`,
    )

    // Return line index of found headingOfSectionToRemove
    return matchedHeadingIndex
  } else {
    log('note/removeSection', `-> heading not found; setting end of active part of file instead (line ${endOfActive}).`)
    return endOfActive // end of the active part of the file (zero-based line index)
  }
}

/**
 * Scan a Note looking for items which have >date+ tags and return the list of updated paragraphs that are today or later
 * Typically called and followed by a call which calls updateParagraphs() to update those paragraphs
 * @author @dwertheimer
 * @param {TNote} note
 * @returns {Array<TParagraph>} list of paragraphs with updated content
 */
export function checkNoteForPlusDates(note: TNote, openOnly: boolean = true): Array<TParagraph> {
  const RE_PLUS_DATE = />(\d{4}-\d{2}-\d{2})(\+)+/
  const todayHyphenated = hyphenatedDateString(new Date())
  const updatedParas = []
  const datedOpenTodos = openOnly ? note?.datedTodos?.filter((t) => t.type === 'open') || [] : note?.datedTodos || []
  datedOpenTodos.forEach((todo) => {
    const datePlus = todo?.content?.match(RE_PLUS_DATE)
    if (datePlus?.length === 3) {
      const [fullDate, isoDate, operator] = datePlus
      // log(`note.js::checkNoteForPlusDates`, `fullDate: ${fullDate} isoDate: ${isoDate} todayHyph: ${todayHyphenated} operator: ${operator}`)
      if (todayHyphenated >= isoDate && operator === '+') {
        log(
          `note.js::checkNoteForPlusDates`,
          `type: ${todo.type} fullDate: ${fullDate} isoDate: ${isoDate} operator: ${operator}`,
        )
        todo.content = todo.content.replace(fullDate, `>today`)
        // log(`note.js::checkNoteForPlusDates`, `plus date found: ${fullDate} | New content: ${todo.content}`)
        updatedParas.push(todo)
      }
    }
  })
  return updatedParas
}
