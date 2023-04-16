// @flow
//-------------------------------------------------------------------------------
// Note-level Functions
import moment from 'moment/min/moment-with-locales'
import {
  RE_PLUS_DATE_G,
  hyphenatedDate,
  hyphenatedDateString,
  toLocaleDateString,
  RE_DAILY_NOTE_FILENAME,
  RE_WEEKLY_NOTE_FILENAME,
  RE_MONTHLY_NOTE_FILENAME,
  RE_QUARTERLY_NOTE_FILENAME,
  RE_YEARLY_NOTE_FILENAME,
  isDailyNote,
  isWeeklyNote,
  isMonthlyNote,
  isQuarterlyNote,
  isYearlyNote,
} from './dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from './dev'
import { getFolderFromFilename } from './folders'
import { displayTitle, type headingLevelType } from './general'
import { findEndOfActivePartOfNote, findStartOfActivePartOfNote } from './paragraph'
import { sortListBy } from './sorting'
import { showMessage } from './userInput'
import { isOpen } from '@helpers/utils'

// const pluginJson = 'helpers/note.js'

export function noteType(filename: string): NoteType {
  return filename.match(RE_DAILY_NOTE_FILENAME) ||
    filename.match(RE_WEEKLY_NOTE_FILENAME) ||
    filename.match(RE_MONTHLY_NOTE_FILENAME) ||
    filename.match(RE_QUARTERLY_NOTE_FILENAME) ||
    filename.match(RE_YEARLY_NOTE_FILENAME)
    ? 'Calendar'
    : 'Notes'
}

export function getNoteContextAsSuffix(filename: string, dateStyle: string): string {
  const note = DataStore.noteByFilename(filename, noteType(filename))
  if (!note) {
    return '<error>'
  }
  if (note.date != null) {
    return dateStyle.startsWith('link') // to deal with earlier typo where default was set to 'links'
      ? ` ([[${displayTitle(note)}]])`
      : dateStyle === 'scheduled'
      ? // $FlowIgnore(incompatible-call)
        ` >${hyphenatedDate(note.date)} `
      : dateStyle === 'date'
      ? // $FlowIgnore(incompatible-call)
        ` (${toLocaleDateString(note.date)})`
      : dateStyle === 'at'
      ? // $FlowIgnore(incompatible-call)
        ` @${hyphenatedDate(note.date)} `
      : '?'
  } else {
    return ` ([[${note.title ?? ''}]])`
  }
}

/**
 * Print summary of note details to log
 * @author @eduardmet
 * @param {TNote} note
 */
export function printNote(note: TNote): void {
  if (note == null) {
    logDebug('note/printNote()', 'No Note found!')
    return
  }

  if (note.type === 'Notes') {
    logInfo(
      'note/printNote',
      `title: ${note.title ?? ''}\n\tfilename: ${note.filename ?? ''}\n\tcreated: ${String(note.createdDate) ?? ''}\n\tchanged: ${String(note.changedDate) ?? ''}\n\tparagraphs: ${
        note.paragraphs.length
      }\n\thashtags: ${note.hashtags?.join(',') ?? ''}\n\tmentions: ${note.mentions?.join(',') ?? ''}`,
    )
  } else {
    logInfo(
      'note/printNote',
      `filename: ${note.filename ?? ''}\n\tcreated: ${String(note.createdDate) ?? ''}\n\tchanged: ${String(note.changedDate) ?? ''}\n\tparagraphs: ${
        note.paragraphs.length
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
export async function noteOpener(fullPath: string, desc: string, useProjNoteByFilename: boolean = true): Promise<?TNote> {
  logDebug('note/noteOpener', `  About to open filename: "${fullPath}" (${desc}) using ${useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'}`)
  const newNote = useProjNoteByFilename ? await DataStore.projectNoteByFilename(fullPath) : await DataStore.noteByFilename(fullPath, 'Notes')
  if (newNote != null) {
    logDebug('note/noteOpener', `    Opened ${fullPath} (${desc} version) `)
    return newNote
  } else {
    logDebug('note/noteOpener', `    Didn't work! ${useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'} returned ${(newNote: any)}`)
  }
}

/**
 * Open a note using whatever method works (open by title, filename, etc.)
 * Note: this function was used to debug/work-around API limitations. Probably not necessary anymore
 * Leaving it here for the moment in case any plugins are still using it
 * @author @jgclark, building on @dwertheimer
 * @param {string} filename of either Calendar or Notes type
 * @returns {?TNote} - the note that was opened
 */
export function getNoteByFilename(filename: string): ?TNote {
  // logDebug('note/getNoteByFilename', `Started for '${filename}'`)
  const newNote = DataStore.noteByFilename(filename, 'Notes') ?? DataStore.noteByFilename(filename, 'Calendar')
  if (newNote != null) {
    // logDebug('note/getNoteByFilename', `-> note '${displayTitle(newNote)}`)
    return newNote
  } else {
    logWarn('note/getNoteByFilename', `-> couldn't find a note in either Notes or Calendar`)
    return null
  }
}

/**
 * Get or create the relevant regular note in the given folder (not calendar notes)
 * Now extended to cope with titles with # characters: these are stripped out first, as they are stripped out by NP when reporting a note.title
 * If it makes a new note, it will add the title first.
 * @author @jgclark
 *
 * @param {string} noteTitle - title of note to look for
 * @param {string} noteFolder - folder to look in (must be full path or "/")
 * @param {boolean?} partialTitleToMatch - optional partial note title to use with a starts-with not exact match
 * @return {Promise<TNote>} - note object
 */
export async function getOrMakeNote(noteTitle: string, noteFolder: string, partialTitleToMatch: string = ''): Promise<?TNote> {
  logDebug('note / getOrMakeNote', `starting with noteTitle '${noteTitle}' / folder '${noteFolder}' / partialTitleToMatch ${partialTitleToMatch}`)
  let existingNotes: $ReadOnlyArray<TNote> = []

  // If we want to do a partial match, see if matching note(s) have already been created (ignoring @Archive and @Trash)
  if (partialTitleToMatch) {
    const partialTestString = partialTitleToMatch.split('#').join('')
    const allNotesInFolder = getProjectNotesInFolder(noteFolder)
    existingNotes = allNotesInFolder.filter((f) => f.title?.startsWith(partialTestString))
    logDebug('note / getOrMakeNote', `- found ${existingNotes.length} existing partial '${partialTestString}' note matches`)
  } else {
    // Otherwise do an exact match on noteTitle
    const potentialNotes = DataStore.projectNoteByTitle(noteTitle, true, false) ?? []
    // now filter out wrong folders
    existingNotes = potentialNotes && noteFolder !== '/' ? potentialNotes.filter((n) => n.filename.startsWith(noteFolder)) : potentialNotes
    logDebug('note / getOrMakeNote', `- found ${existingNotes.length} existing '${noteTitle}' note(s)`)
  }

  if (existingNotes.length > 0) {
    logDebug('note / getOrMakeNote', `- first matching note filename = '${existingNotes[0].filename}'`)
    return existingNotes[0] // return the only or first match (if more than one)
  } else {
    logDebug('note / getOrMakeNote', `- found no existing notes, so will try to make one`)
    // no existing note, so need to make a new one
    const noteFilename = await DataStore.newNote(noteTitle, noteFolder)
    // NB: filename here = folder + filename
    if (noteFilename != null && noteFilename !== '') {
      logDebug('note / getOrMakeNote', `- newNote filename: ${String(noteFilename)}`)
      const note = await DataStore.projectNoteByFilename(noteFilename)
      if (note != null) {
        return note
      } else {
        showMessage(`Oops: I can't make new ${noteTitle} note`, 'OK')
        logError('note / getOrMakeNote', `can't read new ${noteTitle} note`)
        return
      }
    } else {
      showMessage(`Oops: I can't make new ${noteTitle} note`, 'OK')
      logError('note / getOrMakeNote', `empty filename of new ${noteTitle} note`)
      return
    }
  }
}

/**
 * Get a note's display title from its filename.
 * Handles both Notes and Calendar, matching the latter by regex matches. (Not foolproof though.)
 * @author @jgclark
 * @param {string} filename
 * @returns {string} title of note
 */
export function getNoteTitleFromFilename(filename: string, makeLink?: boolean = false): string {
  const thisNoteType: NoteType = noteType(filename)
  const note = DataStore.noteByFilename(filename, thisNoteType)
  if (note) {
    return makeLink ? `[[${displayTitle(note) ?? ''}]]` : displayTitle(note)
  } else {
    logError('note/getNoteTitleFromFilename', `Couldn't get valid title for note filename '${filename}'`)
    return '(error)'
  }
}

/**
 * Return list of notes with a particular hashtag (singular), with further optional parameters about which (sub)folders to look in, and a term to defeat on.
 * @author @jgclark
 *
 * @param {string} tag - tag name to look for
 * @param {string?} folder - optional folder to limit to
 * @param {boolean?} includeSubfolders - if folder given, whether to look in subfolders of this folder or not (optional, defaults to false)
 * @param {string?} tagToExclude - optional tag that if found in the note, excludes the note
 * @return {Array<TNote>}
 */
export function findNotesMatchingHashtag(tag: string, folder: ?string, includeSubfolders: ?boolean = false, tagToExclude: string = ''): Array<TNote> {
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

  // Check for special conditions first
  if (tag === '') {
    logError('notes / findNotesMatchingHashtag', `No hashtag given. Stopping`)
    return [] // for completeness
  }
  // Filter by tag
  const projectNotesWithTag = projectNotesInFolder.filter((n) => n.hashtags.includes(tag))
  // logDebug('notes / findNotesMatchingHashtag', `In folder '${folder ?? '<all>'}' found ${projectNotesWithTag.length} notes matching '${tag}'`)

  // If we care about the excluded tag, then further filter out notes where it is found
  if (tagToExclude !== '') {
    const projectNotesWithTagWithoutExclusion = projectNotesWithTag.filter((n) => !n.hashtags.includes(tagToExclude))
    const removedItems = projectNotesWithTag.length - projectNotesWithTagWithoutExclusion.length
    if (removedItems > 0) {
      // logDebug('notes / findNotesMatchingHashtag', `- but removed ${removedItems} excluded notes:`)
      // logDebug('notes / findNotesMatchingHashtag', `= ${String(projectNotesWithTag.filter((n) => n.hashtags.includes(tagToExclude)).map((m) => m.title))}`)
    }
    return projectNotesWithTagWithoutExclusion
  } else {
    return projectNotesWithTag
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
export function findNotesMatchingHashtags(tags: Array<string>, folder: ?string, includeSubfolders: ?boolean = false): Array<Array<TNote>> {
  if (tags.length === 0) {
    logError('note/findNotesMatchingHashtags', `No hashtags supplied. Stopping`)
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
    logDebug('note/findNotesMatchingHashtags', `In folder '${folder ?? '<all>'}' found ${projectNotesWithTag.length} notes matching '${tag}'`)
    projectNotesWithTags.push(projectNotesWithTag)
  }
  return projectNotesWithTags
}

/**
 * Get all notes in a given folder:
 * - matching all folders that include the 'forFolder' parameter
 * - or just those in the root folder (if forFolder === '/')
 * - or all project notes if no folder given
 * Note: ignores any sub-folders
 * Now also caters for searches just in root folder.
 * @author @dwertheimer + @jgclark

 * @param {string} forFolder optional folder name (e.g. 'myFolderName'), matching all folders that include this string
 * @returns {$ReadOnlyArray<TNote>} array of notes in the folder
 */
export function getProjectNotesInFolder(forFolder: string = ''): $ReadOnlyArray<TNote> {
  const notes: $ReadOnlyArray<TNote> = DataStore.projectNotes
  let filteredNotes: Array<TNote> = []
  if (forFolder === '') {
    filteredNotes = notes.slice() // slice() avoids $ReadOnlyArray mismatch problem
  } else if (forFolder === '/') {
    // root folder ('/') has to be treated as a special case
    filteredNotes = notes.filter((note) => !note.filename.includes('/'))
  } else {
    // if last character is a slash, remove it
    const folderWithoutSlash = forFolder.charAt(forFolder.length - 1) === '/' ? forFolder.slice(0, forFolder.length) : forFolder
    filteredNotes = notes.filter((note) => getFolderFromFilename(note.filename) === folderWithoutSlash)
  }
  logDebug('note/getProjectNotesInFolder', `Found ${filteredNotes.length} notes in folder '${forFolder}'`)
  return filteredNotes
}

/**
 * Get all notes in a given folder (or all project notes if no folder given), sorted by note title.
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
    // return all project notes
    notesInFolder = DataStore.projectNotes.slice()
  }
  // Sort alphabetically on note's title
  const notesSortedByTitle = notesInFolder.sort((first, second) => (first.title ?? '').localeCompare(second.title ?? ''))
  return notesSortedByTitle
}

/**
 * Find a unique note title for the given text (e.g. "Title", "Title 01" (if "Title" exists, etc.))
 * Keep adding numbers to the end of a filename (if already taken) until it works
 * @author @dwertheimer
 * @param {string} title - the name of the file
 * @returns {string} the title (not filename) that was created
 */
export function getUniqueNoteTitle(title: string): string {
  let i = 0
  let res: $ReadOnlyArray<TNote> = []
  let newTitle = title
  while (++i === 1 || res.length > 0) {
    newTitle = i === 1 ? title : `${title} ${i}`
    // $FlowFixMe(incompatible-type)
    res = DataStore.projectNoteByTitle(newTitle, true, false)
  }
  return newTitle
}

/**
 * Return list of all notes, sorted by changed date (newest to oldest)
 * @author @jgclark
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
 * @return {Array<TNote>} - list of notes
 */
export function calendarNotesSortedByChanged(): Array<TNote> {
  return DataStore.calendarNotes.slice().sort((first, second) => second.changedDate - first.changedDate)
}

/**
 * Return list of past calendar notes, of any duration
 * TODO: check whether the .date is start or end of period
 * FIXME: not returning 2023-W09, but is 202303
 * @author @jgclark
 * @return {Array<TNote>} - list of notes
 */
export function pastCalendarNotes(): Array<TNote> {
  const startOfTodayDate = moment().startOf('day').toDate()
  return DataStore.calendarNotes.slice().filter((note) => {
    return note.date < startOfTodayDate
  })
}

/**
 * Return list of weekly notes, sorted by changed date (newest to oldest)
 * @author @jgclark
 * @return {Array<TNote>} - list of notes
 */
export function weeklyNotesSortedByChanged(): Array<TNote> {
  const weeklyNotes = DataStore.calendarNotes.slice().filter((f) => f.filename.match(RE_WEEKLY_NOTE_FILENAME))
  return weeklyNotes.sort((first, second) => second.changedDate - first.changedDate)
}

/**
 * Return list of project notes, sorted by changed date (newest to oldest)
 * @author @jgclark
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
 * If no existing section is found, then append.
 * @author @jgclark
 *
 * @param {TNote} note to use
 * @param {string} headingOfSectionToReplace
 * @param {string} newSectionHeading
 * @param {number} newSectionHeadingLevel
 * @param {string} newSectionContent Note: without Heading text!
 */
export function replaceSection(
  note: TNote,
  headingOfSectionToReplace: string,
  newSectionHeading: string,
  newSectionHeadingLevel: headingLevelType,
  newSectionContent: string,
): void {
  try {
    logDebug(
      'note / replaceSection',
      `Starting for note '${displayTitle(note)}'. Will remove '${headingOfSectionToReplace}' -> '${newSectionHeading}' level ${newSectionHeadingLevel}`,
    )
    // First remove existing heading (the start of the heading text will probably be right, but the end will probably need to be changed)
    const insertionLineIndex = removeSection(note, headingOfSectionToReplace)
    // logDebug('note / replaceSection', `- insertionLineIndex = ${insertionLineIndex}`)

    // Set place to insert either after the found section heading, or at end of note
    logDebug('note / replaceSection', `- before insertHeading() call there are ${note.paragraphs.length} paras`)
    note.insertHeading(newSectionHeading, insertionLineIndex, newSectionHeadingLevel)
    logDebug('note / replaceSection', `- after insertHeading() call there are ${note.paragraphs.length} paras`)
    note.insertParagraph(newSectionContent, insertionLineIndex + 1, 'text')
    logDebug('note / replaceSection', `- after insertParagraph() call there are ${note.paragraphs.length} paras`)
  } catch (error) {
    logError('note / replaceSection', error.message)
  }
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
  try {
    const paras = note.paragraphs ?? []

    if (paras.length === 0) {
      // We have no paragraphs, so need to return now
      logDebug('note / removeSection', `Note is empty, so there's nothing to do`)
      return 0
    }
    logDebug('note / removeSection', `Trying to remove '${headingOfSectionToRemove}' from note '${displayTitle(note)}' with ${paras.length} paras`)

    const startOfActive = findStartOfActivePartOfNote(note)
    const endOfActive = findEndOfActivePartOfNote(note)
    let matchedHeadingIndex: number // undefined
    let sectionHeadingLevel = 2
    // Find the title/headingOfSectionToRemove whose start matches 'heading', and is in the active part of the note
    // But start after title or frontmatter.
    for (let i = startOfActive; i <= endOfActive; i++) {
      const p = paras[i]
      if (p.type === 'title' && p.content.startsWith(headingOfSectionToRemove) && p.lineIndex <= endOfActive) {
        matchedHeadingIndex = p.lineIndex
        sectionHeadingLevel = p.headingLevel
        break
      }
    }

    if (matchedHeadingIndex !== undefined && matchedHeadingIndex <= endOfActive) {
      logDebug('note / removeSection', `  - headingIndex ${String(matchedHeadingIndex)} level ${String(sectionHeadingLevel)} endOfActive ${String(endOfActive)}`)
      // Work out the set of paragraphs to remove
      const parasToRemove = []
      // Start by removing the heading line itself
      parasToRemove.push(paras[matchedHeadingIndex])
      // logDebug('note / removeSection', `  - removing para ${matchedHeadingIndex}: '${paras[matchedHeadingIndex].content}'`)
      for (let i = matchedHeadingIndex + 1; i <= endOfActive; i++) {
        // stop removing when we reach heading of same or higher level (or end of active part of note)
        if (paras[i].type === 'title' && paras[i].headingLevel <= sectionHeadingLevel) {
          break
        }
        parasToRemove.push(paras[i])
        // logDebug('note / removeSection', `  - removing para ${i}: '${paras[i].content}'`)
      }

      // Delete the saved set of paragraphs
      note.removeParagraphs(parasToRemove)
      logDebug('note / removeSection', `-> removed section '${headingOfSectionToRemove}': total  ${parasToRemove.length} paragraphs. Returning line ${matchedHeadingIndex}`)

      // Return line index of found headingOfSectionToRemove
      return matchedHeadingIndex
    } else {
      // return the line after the end of the active part of the file (zero-based line index)
      logDebug('note / removeSection', `-> heading not found; will go after end of active part of file instead (line ${endOfActive + 1}).`)
      return endOfActive + 1
    }
  } catch (error) {
    logError('note / removeSection', error.message)
    return NaN // for completeness
  }
}

/**
 * Scan a Note looking for items which are overdue and/or have >date+ tags and return the list of updated paragraphs that are today or later
 * Typically called and followed by a call which calls updateParagraphs() to update those paragraphs
 * NOTE: this function finds and does the replacement but not the actual updates (returns paras to be updated outside)
 * @author @dwertheimer
 * @param {TNote} note
 * @param {boolean} openOnly - restrict function to only open tasks
 * @param {boolean} plusOnlyTypes - limit function to only >date+ tags (do not include normal overdue dates)
 * @param {boolean} replaceDate - replace the due date with a >today (otherwise leave the date for posterity)
 * @returns {Array<TParagraph>} list of paragraphs with updated content
 */
export function updateDatePlusTags(note: TNote, options: { openOnly: boolean, plusOnlyTypes: boolean, replaceDate: boolean }): Array<TParagraph> {
  const { openOnly, plusOnlyTypes, replaceDate } = options
  const todayHyphenated = hyphenatedDateString(new Date())
  const updatedParas = []
  const datedOpenTodos = openOnly ? note?.datedTodos?.filter(isOpen) || [] : note?.datedTodos || []
  datedOpenTodos.forEach((todo) => {
    if (!/>today/i.test(todo.content)) {
      const datePlusAll = [...todo?.content?.matchAll(RE_PLUS_DATE_G)] //there could be multiple dates on a line
      const sorted = sortListBy(datePlusAll, '-1') // put the latest date at the top
      let madeChange = false
      sorted.forEach((datePlus, i) => {
        if (datePlus?.length === 3) {
          const [fullDate, isoDate, operator] = datePlus
          // Date+ should be converted starting today, but overdue should start tomorrow
          const pastDue = (operator && todayHyphenated >= isoDate) || todayHyphenated > isoDate
          // logDebug(`note/updateDatePlusTags`, `fullDate: ${fullDate} isoDate: ${isoDate} todayHyph: ${todayHyphenated} operator: ${operator}`)
          if (pastDue && (plusOnlyTypes === false || (plusOnlyTypes === true && operator === '+'))) {
            // logDebug(`note/updateDatePlusTags`, `type: ${todo.type} fullDate: ${fullDate} isoDate: ${isoDate} operator: ${operator}`)
            if (operator || (pastDue && i === 0)) {
              const replacement = madeChange ? '' : ` >today` //if there are multiple dates and we already have one >today, eliminate the rest
              if (operator) {
                todo.content = replaceDate ? todo.content.replace(` ${fullDate}`, replacement) : todo.content.replace(` ${fullDate}`, ` >${isoDate}${replacement}`)
              } else {
                todo.content = replaceDate ? todo.content.replace(` ${fullDate}`, replacement) : `${todo.content}${replacement}`
              }
              // logDebug(`note/updateDatePlusTags`, `plus date found: ${fullDate} | New content: ${todo.content}`)
              if (madeChange === false) updatedParas.push(todo)
              madeChange = true
            }
          }
        }
      })
    } else {
      // do not return a task already marked with a >todo
    }
  })
  return updatedParas
}

/**
 * Filter a list of notes against a list of folders to ignore and return the filtered list
 * @param {Array<TNote>} notes - array of notes to review
 * @param {Array<string>} excludedFolders - array of folder names to exclude/ignore (if a file is in one of these folders, it will be removed)
 * @param {boolean} excludeNonMarkdownFiles - if true, exclude non-markdown files (must have .txt or .md to get through)
 * @returns {Array<TNote>} - array of notes that are not in excluded folders
 * @author @dwertheimer
 */
export function filterNotesAgainstExcludeFolders(notes: Array<TNote>, excludedFolders: Array<string>, excludeNonMarkdownFiles: boolean = false): Array<TNote> {
  // const ignoreThisFolder = excludedFolders.length && !!ignoreFolders.filter((folder) => note.filename.includes(`${folder}/`)).length
  let noteListFiltered = notes
  if (excludedFolders.length) {
    noteListFiltered = notes.filter((note) => {
      // filter out notes that are in folders to ignore
      let isInIgnoredFolder = false
      excludedFolders.forEach((folder) => {
        if (note.filename.includes(`${folder.trim()}/`)) {
          // logDebug('note/filterNotesAgainstExcludeFolders', `ignoring folder="${folder}" note.filename="${note.filename}}"`)
          isInIgnoredFolder = true
        }
      })
      isInIgnoredFolder = isInIgnoredFolder || (excludeNonMarkdownFiles && !/(\.md|\.txt)$/i.test(note.filename)) //do not include non-markdown files
      return !isInIgnoredFolder
    })
  }
  return noteListFiltered
}

/**
 * Filter a list of paras against a list of folders to ignore and return the filtered list
 * Obviously requires going via the notes array and not the paras array
 * @author @jgclark building on @dwertheimer's work
 * @param {Array<TNote>} notes - array of notes to review
 * @param {Array<string>} excludedFolders - array of folder names to exclude/ignore (if a file is in one of these folders, it will be removed)
 * @param {boolean} excludeNonMarkdownFiles - if true, exclude non-markdown files (must have .txt or .md to get through)
 * @returns {Array<TNote>} - array of notes that are not in excluded folders
 */
export function filterParasAgainstExcludeFolders(paras: Array<TParagraph>, excludedFolders: Array<string>, excludeNonMarkdownFiles: boolean = false): Array<TParagraph> {
  // const ignoreThisFolder = excludedFolders.length && !!ignoreFolders.filter((folder) => note.filename.includes(`${folder}/`)).length

  if (!excludedFolders) {
    logDebug('note/filterParasAgainstExcludeFolders', `excludedFolders list is empty, so will return all paras`)
    return paras
  }
  // $FlowIgnore(incompatible-type)
  const noteList: Array<CoreNoteFields> = paras.map((p) => p.note)
  if (noteList.length > 0) {
    const noteListFiltered = filterNotesAgainstExcludeFolders(noteList, excludedFolders, excludeNonMarkdownFiles)

    if (!noteListFiltered) {
      logInfo('note/filterParasAgainstExcludeFolders', `all notes have been excluded`)
      return []
    }

    // filter out paras not in these notes
    const parasFiltered = paras.filter((p) => {
      const thisNote = p.note
      const isInIgnoredFolder = noteListFiltered.includes(thisNote)
      return !isInIgnoredFolder
    })
    return parasFiltered
  } else {
    logWarn('note/filterParasAgainstExcludeFolders', `ffound no corresponding notes`)
    return []
  }
}

/**
 * Determines whether a line is overdue or not. A line with multiple dates is only overdue if all dates are overdue.
 * Finds ISO8601 dates in a string and returns an array of the dates found if all dates are overdue (or an empty array)
 * @param {string} line
 * @returns foundDates - array of dates found
 */
export function findOverdueDatesInString(line: string): Array<string> {
  const todayHyphenated = hyphenatedDateString(moment().toDate())
  const dates = line.match(RE_PLUS_DATE_G)
  if (dates) {
    const overdue = dates.filter((d) => d.slice(1) < todayHyphenated)
    return overdue.length === dates.length ? overdue.sort() : [] // if all dates are overdue, return them sorted
  }
  return []
}

/**
 * All day, month, quarter, yearly notes are type "Calendar" notes, so we when we need
 * to know the type of calendar note, we can use this function
 * we allow note.type to not exist so we can look up the note based just on the filename
 * @param {TNote} note - the note to look at
 * @returns false | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' | 'Project'
 */
export function getNoteType(note: TNote): false | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' | 'Project' {
  if (note.type === 'Calendar' || typeof note.type === 'undefined') {
    return (
      (isDailyNote(note) && 'Daily') ||
      (isWeeklyNote(note) && 'Weekly') ||
      (isMonthlyNote(note) && 'Monthly') ||
      (isQuarterlyNote(note) && 'Quarterly') ||
      (isYearlyNote(note) && 'Yearly') ||
      (typeof note.type === 'undefined' && 'Project')
    )
  } else {
    return 'Project'
  }
}
