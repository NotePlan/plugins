/* eslint-disable max-len */
// @flow
// Note-level Functions
//-------------------------------------------------------------------------------
import moment from 'moment/min/moment-with-locales'
import {
  hyphenatedDate,
  hyphenatedDateString,
  // toLocaleDateString,
  isDailyNote,
  isWeeklyNote,
  isMonthlyNote,
  isQuarterlyNote,
  isYearlyNote,
  RE_DAILY_NOTE_FILENAME,
  RE_PLUS_DATE_G,
  RE_WEEKLY_NOTE_FILENAME,
  RE_MONTHLY_NOTE_FILENAME,
  RE_QUARTERLY_NOTE_FILENAME,
  RE_YEARLY_NOTE_FILENAME,
  isValidCalendarNoteFilename,
  isValidCalendarNoteTitleStr,
} from '@helpers/dateTime'
import { clo, clof, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getFolderListMinusExclusions, getFolderFromFilename, getRegularNotesFromFilteredFolders } from '@helpers/folders'
import { displayTitle, type headingLevelType } from '@helpers/general'
import { toNPLocaleDateString } from '@helpers/NPdateTime'
import { noteHasFrontMatter, getFrontmatterAttributes, updateFrontMatterVars } from '@helpers/NPFrontMatter'
import { findEndOfActivePartOfNote, findStartOfActivePartOfNote } from '@helpers/paragraph'
import { formRegExForUsersOpenTasks, TEAMSPACE_INDICATOR } from '@helpers/regex'
import { sortListBy } from '@helpers/sorting'
import { isOpen } from '@helpers/utils'

/*
 * Set the title of a note whether it's a frontmatter note or a regular note
 * @param {CoreNoteFields} note - the note to set the title of
 * @param {string} title - the new title
 */
export function setTitle(note: CoreNoteFields, title: string): void {
  logDebug('note/setTitle', `Trying to set title to "${title}" for note "${note.title || ''}"`)
  const isFrontmatterNote = noteHasFrontMatter(note)
  logDebug('note/setTitle', `Setting title to ${title} for note ${note.filename} isFrontmatter=${String(isFrontmatterNote)}`)
  let titleIsChanged = false
  if (isFrontmatterNote) {
    const fmFields = getFrontmatterAttributes(note)
    if (fmFields) {
      if (fmFields.hasOwnProperty('title')) {
        const newFmFields = { ...fmFields }
        newFmFields.title = title
        // $FlowIgnore(incompatible-call)
        updateFrontMatterVars(note, newFmFields, true)
        titleIsChanged = true
      } else {
        logError('note/setTitle', `Note has frontmatter but no title field in fm in note: "${note.title || note.filename}"`)
      }
    } else {
      logError('note/setTitle', `can't find frontmatter attributes in note ${note.filename}`)
    }
  }
  if (!titleIsChanged) {
    // we need to change the title in the note
    const oldTitlePara = note.paragraphs.find((p) => p.type === 'title' && p.headingLevel === 1)
    if (oldTitlePara) {
      oldTitlePara.content = title
      note.updateParagraph(oldTitlePara)
    } else {
      logError('note/setTitle', `can't find title paragraph in note ${note.filename}`)
      const startIndex = findStartOfActivePartOfNote(note)
      note.insertParagraph(title, startIndex || 0, 'title')
    }
  }
}

/**
 * Return simply 'Calendar' or 'Notes' from note's filename.
 * Note: getNoteType() is more detailed.
 * Note: But use note.type when you have note object available.
 * @param {string} filename
 * @returns {NoteType}
 */
export function noteType(filename: string): NoteType {
  return filename.match(RE_DAILY_NOTE_FILENAME) ||
    filename.match(RE_WEEKLY_NOTE_FILENAME) ||
    filename.match(RE_MONTHLY_NOTE_FILENAME) ||
    filename.match(RE_QUARTERLY_NOTE_FILENAME) ||
    filename.match(RE_YEARLY_NOTE_FILENAME)
    ? 'Calendar'
    : 'Notes'
}

/**
 * All day, month, quarter, yearly notes are type "Calendar" notes, so we when we need
 * to know the type of calendar note, we can use this function.
 * We allow note.type to not exist so we can look up the note based just on the filename
 * @author @dwertheimer
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

/**
 * Get a link to a note, formatted for display in search results etc.
 * @param {string} filename
 * @param {string} dateStyle
 * @returns {string}
 */
export function getNoteLinkForDisplay(filename: string, dateStyle: string): string {
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
        ` (${toNPLocaleDateString(note.date)})`
      : dateStyle === 'at'
      ? // $FlowIgnore(incompatible-call)
        ` @${hyphenatedDate(note.date)} `
      : '?'
  } else {
    return `[[${note.title ?? ''}]]`
  }
}

/**
 * General purpose note-getter to find a note using whatever method works (open by title, filename, etc.), optionally restricting results to a top-level path string (e.g. "@Templates")
 * Typically, the 2nd parameter can be blank or null and the type will be inferred from the name/filename
 * For name, you can pass:
 * - a filename (with extension) of a regular or calendar note (full path required)
 * - a title of a regular or calendar note (just the title, not the path -- will return the first match)
 * - a title with a path (e.g. "myFolder/myNote")
 * - an ISO date (YYYY-MM-DD or YYYYMMDD) of a calendar note
 * @author @dwertheimer
 * @param {string|Date} name - The note identifier, can be:
 *   - An empty string, in which case the current note in the Editorwill be returned
 *   - A filename with extension (e.g., "myNote.md" or "20240101.md")
 *   - A title without extension (e.g., "My Note" or "January 1, 2024")
 *   - A date (to get calendar date)
 *   - A path and title (e.g., "folder/My Note")
 *   - An ISO date string (e.g., "2024-01-01") which will be converted to "20240101" for lookup
 * @param {boolean} [onlyLookInRegularNotes=false] - If true, will use projectNoteByFilename instead of noteByFilename (which will look at Calendar notes as well). This is useful if you have project notes that have titles that look like calendar notes (e.g. "2024-01-01"). If you leave this false, blank, or null, the type will be inferred from the name/filename.
 * @param {string} [filePathStartsWith=''] - If provided, ensures that the filename of any found note starts with this path
 *   - Use to restrict results to notes within a specific folder structure (e.g., "@Templates")
 *   - Works with both filenames with extensions and note titles
 *   - Example: getNote("foo", false, "@Templates") will find notes with title "foo" in @Templates folder
 *   - Example: getNote("Snippets/Import Item", false, "@Templates") will find notes with title "Import Item" in "@Templates/Snippets/" folder
 * @returns {Promise<?TNote>} - The note that was found, or null if no matching note exists
 * @example
 * // Get a note by title, ensuring it's in the @Templates folder
 * const note = await getNote('My Note', false, '@Templates');
 *
 * @example
 * // Get a calendar note using ISO date format (will convert to NotePlan format)
 * const note = await getNote('2024-01-01');
 *
 * @example
 * // Get a note with a specific path and title, ensuring it's in a specific folder
 * const note = await getNote('Snippets/Import Item', false, '@Templates');
 */
export async function getNote(name?: string, onlyLookInRegularNotes?: boolean | null, filePathStartsWith?: string): Promise<?TNote> {
  if (!name) {
    logDebug(`getNote: no name provided. Will open Editor by default.`)
    return Editor.note
  }
  // formerly noteOpener
  // Convert ISO date format (YYYY-MM-DD) to NotePlan format (YYYYMMDD) if needed
  const noteName = name
  // const convertedName = convertISOToYYYYMMDD(noteName) // convert ISO 8601 date to NotePlan format if needed/otherwise returns original string
  // if (convertedName !== noteName) {
  //   logDebug('note/getNote', `  Converting ISO date ${noteName} to NotePlan format ${convertedName}`)
  //   noteName = convertedName
  // }

  const hasExtension = noteName ? noteName.endsWith('.md') || noteName.endsWith('.txt') : false
  const hasFolder = noteName.includes('/')
  const isCalendarNote = isValidCalendarNoteFilename(noteName) || isValidCalendarNoteTitleStr(noteName)
  logDebug(
    'note/getNote',
    `  isCalendarNote=${String(isCalendarNote)} isValidCalendarNoteFilename=${String(isValidCalendarNoteFilename(noteName))} isValidCalendarNoteTitleStr=${String(
      isValidCalendarNoteTitleStr(noteName),
    )}`,
  )
  logDebug(
    'note/getNote',
    `  Will try to open: "${name}${noteName !== name ? `(${noteName})` : ''}" using ${onlyLookInRegularNotes ? 'projectNoteByFilename' : 'noteByFilename'} ${
      hasExtension ? '' : ' (no extension)'
    } ${hasFolder ? '' : ' (no folder)'} ${isCalendarNote ? ' (calendar note)' : ''}`,
  )
  if (!noteName) {
    logError('note/getNote', `  Empty name`)
    return null
  }
  let theNote: TNote | null | void = null
  if (hasExtension) {
    theNote = onlyLookInRegularNotes ? await DataStore.projectNoteByFilename(noteName) : await DataStore.noteByFilename(noteName, isCalendarNote ? 'Calendar' : 'Notes')
    if (theNote && filePathStartsWith) {
      // Only apply the filePathStartsWith filter if the parameter was provided
      theNote = theNote.filename.startsWith(filePathStartsWith) ? theNote : null
    }
  } else {
    // not a filename, so try to find a note by title
    logDebug('note/getNote', `  Trying to find note by title "${noteName}" ${isCalendarNote ? ' (calendar note)' : ''}`)
    if (isCalendarNote) {
      logDebug('note/getNote', `  Trying to find calendar note by title "${noteName}"`)
      if (onlyLookInRegularNotes) {
        logDebug('note/getNote', `  Trying to find calendar note by title ${name}`)
        // deal with the edge case of someone who has a project note with a title that could be a calendar note
        const potentialNotes = DataStore.projectNoteByTitle(name)
        if (potentialNotes && potentialNotes.length > 0) {
          theNote = potentialNotes.find((n) => n.filename.startsWith(filePathStartsWith || ''))
        }
      } else {
        logDebug('note/getNote', `  Trying to find calendar note by date string ${noteName}`)
        theNote = await DataStore.calendarNoteByDateString(noteName)
        if (!theNote) {
          logDebug('note/getNote', `  Trying to find calendar note by date string ${name}`)
          theNote = await DataStore.calendarNoteByDateString(name)
        }
      }
    } else {
      const pathParts = noteName.split('/')
      const titleWithoutPath = pathParts.pop() || ''
      const pathWithoutTitle = pathParts.join('/') || ''
      const potentialNotes = DataStore.projectNoteByTitle(titleWithoutPath)
      logDebug('note/getNote', `  Found ${potentialNotes?.length || '0'} notes by title "${noteName}"`)
      if (potentialNotes && potentialNotes.length > 0) {
        // Apply both path filters differently depending on the use case
        let filteredNotes = potentialNotes

        // If a path exists in the noteName
        if (pathWithoutTitle) {
          filteredNotes = filteredNotes.filter((n) => n.filename.includes(`${pathWithoutTitle}/`))
        }

        // If filePathStartsWith is provided, apply that filter separately
        if (filePathStartsWith) {
          filteredNotes = filteredNotes.filter((n) => n.filename.startsWith(filePathStartsWith))
        }

        theNote = filteredNotes.length > 0 ? filteredNotes[0] : null

        logDebug(
          ` >> getNote Found ${potentialNotes.length} notes by title "${noteName}"; ${filteredNotes.length} matched path "${pathWithoutTitle}" and filePathStartsWith "${
            filePathStartsWith || ''
          }" (${theNote?.filename || ''}); ${potentialNotes.length > 1 ? `others were: [${potentialNotes.map((n) => n.filename).join(', ')}]` : ''}`,
        )
      }
    }
  }
  if (theNote != null) {
    logDebug('note/getNote', `    Opened ${noteName}`)
    return theNote
  } else {
    logDebug(
      'note/getNote',
      `Didn't work! for "${noteName}" ${onlyLookInRegularNotes ? 'projectNoteByFilename' : 'noteByFilename'} returned ${(theNote: any)}. hasFolder=${String(
        hasFolder,
      )} hasExtension=${String(hasExtension)} isCalendarNote=${String(isCalendarNote)}. Check for typos or missing folder path.`,
    )
    return null
  }
}

/**
 * WARNING: Deprecated: use similar function in NPNote.js which is teamspace-aware.
 * Get a note using filename (will try by Notes first, then Calendar)
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
    logWarn('note/getNoteByFilename', `-> couldn't find a note for '${filename}' in either Notes or Calendar`)
    return null
  }
}

// Note: getNoteByFilename has moved to NPnote.js. Import from '@helpers/NPnote' instead.

// Note: getOrMakeRegularNoteInFolder has moved to NPnote.js. Import from '@helpers/NPnote' instead.

/**
 * Find a unique note title for the given text (e.g. "Title", "Title 01" (if "Title" exists, etc.))
 * Keep adding numbers to the end of a filename (if already taken) until it works
 * @author @dwertheimer
 * @param {string} title - the name of the file
 * @returns {string} the title (not filename) that was created
 */
export function getUniqueNoteTitle(title: string): string {
  try {
    let i = 0
    let res: $ReadOnlyArray<TNote> = []
    let newTitle = title
    while (++i === 1 || res.length > 0) {
      newTitle = i === 1 ? title : `${title} ${i}`
      // $FlowFixMe(incompatible-type)
      res = DataStore.projectNoteByTitle(newTitle, true, false)
    }
    return newTitle
  } catch (err) {
    logError('note/notesInFolderSortedByTitle', err.message)
    return ''
  }
}

/**
 * Return list of all notes, sorted by changed date (newest to oldest)
 * @author @jgclark
 * @param {Array<string>} foldersToExclude? (default: [])
 * @return {Array<TNote>} array of notes
 */
export function allNotesSortedByChanged(foldersToIgnore: Array<string> = []): Array<TNote> {
  const projectNotes = getRegularNotesFromFilteredFolders(foldersToIgnore, true)
  const calendarNotes = DataStore.calendarNotes.slice()
  const allNotes = projectNotes.concat(calendarNotes)
  // $FlowIgnore(unsafe-arithmetic)
  const allNotesSorted = allNotes.sort((first, second) => second.changedDate - first.changedDate) // most recent first
  return allNotesSorted
}

/**
 * Return list of all regular notes, apart from those in special '@...' folders, sorted by changed date (newest to oldest)
 * @author @jgclark
 * @param {Array<string>} foldersToExclude? (default: [])
 * @return {Array<TNote>} array of notes
 */
export function allRegularNotesSortedByChanged(foldersToIgnore: Array<string> = []): Array<TNote> {
  const regularNotes = getRegularNotesFromFilteredFolders(foldersToIgnore, true)
  // $FlowIgnore(unsafe-arithmetic)
  const regularNotesSorted = regularNotes.sort((first, second) => second.changedDate - first.changedDate) // most recent first
  return regularNotesSorted
}

/**
 * Return list of all notes, first Project notes (sorted by title) then Calendar notes (sorted by increasing date ~ title)
 * @author @jgclark
 * @param {Array<string>} foldersToExclude? (default: [])
 * @param {boolean} excludeSpecialFolders? (optional: default = true)
 * @return {Array<TNote>} array of notes
 */
export function allNotesSortedByTitle(foldersToIgnore: Array<string> = [], excludeSpecialFolders: boolean = true): Array<TNote> {
  const projectNotes = projectNotesSortedByTitle(foldersToIgnore, excludeSpecialFolders)
  const calendarNotes = calendarNotesSortedByDate()
  const allNotes = projectNotes.concat(calendarNotes)
  return allNotes
}

/**
 * Return list of calendar notes, sorted by changed date (newest to oldest)
 * @author @jgclark
 * @return {Array<TNote>} array of notes
 */
export function calendarNotesSortedByChanged(): Array<TNote> {
  // $FlowIgnore(unsafe-arithmetic)
  return DataStore.calendarNotes.slice().sort((first, second) => second.changedDate - first.changedDate)
}

/**
 * Return list of calendar notes, sorted by date (oldest to newest, based on their filename)
 * Will include future calendar notes if includeFutureCalendarNotes is true.
 * WARNING: Not tested with Teamspace notes, and will likely fail, as it relies on filenames.
 * @author @jgclark
 * @param {boolean} includeFutureCalendarNotes? (optional: default = false)
 * @param {boolean} includeTeamspaceNotes? (optional: default = false)
 * @return {Array<TNote>} array of notes
 */
export function calendarNotesSortedByDate(includeFutureCalendarNotes: boolean = false, includeTeamspaceNotes: boolean = false): Array<TNote> {
  let notes = (includeFutureCalendarNotes)
    ? DataStore.calendarNotes.slice()
    : pastCalendarNotes()

  // Remove Teamspace calendar notes if requested
  if (!includeTeamspaceNotes) {
    notes = notes.filter((note) => !note.filename.startsWith(TEAMSPACE_INDICATOR))
  }

  return notes.sort(function (first, second) {
    const a = first.filename
    const b = second.filename
    if (a < b) {
      return -1 //a comes first
    }
    if (a > b) {
      return 1 // b comes first
    }
    return 0 // names must be equal
  })
}

/**
 * Return list of past calendar notes, of any duration.
 * Note: the date that's checked is the *start* of the period. I.e. test on 30th June will match 2nd Quarter as being in the past.
 * Note: A version of this function exists in helpers/NPdateTime.js::getEarliestCalendarNoteDate(), but it's not imported because it would create a circular dependency.

 * @author @jgclark
 * @return {Array<TNote>} array of notes
 */
export function pastCalendarNotes(): Array<TNote> {
  try {
    const startOfTodayDate = moment().startOf('day').toDate()
    return DataStore.calendarNotes.slice().filter((note) => {
      return note.date < startOfTodayDate
    })
  } catch (err) {
    logError('note/pastCalendarNotes', err.message)
    return []
  }
}

/**
 * Return list of weekly notes, sorted by changed date (newest to oldest)
 * @author @jgclark
 * @return {Array<TNote>} array of notes
 */
export function weeklyNotesSortedByChanged(): Array<TNote> {
  const weeklyNotes = DataStore.calendarNotes.slice().filter((f) => f.filename.match(RE_WEEKLY_NOTE_FILENAME))
  // $FlowIgnore(unsafe-arithmetic)
  return weeklyNotes.sort((first, second) => second.changedDate - first.changedDate)
}

/**
 * Return list of project notes, sorted by changed date (newest to oldest)
 * @author @jgclark
 * @return {Array<TNote>} array of notes
 */
export function projectNotesSortedByChanged(): Array<TNote> {
  // $FlowIgnore(unsafe-arithmetic)
  return DataStore.projectNotes.slice().sort((first, second) => second.changedDate - first.changedDate)
}

/**
 * Return list of project notes, sorted by title (ascending), optionally first excluding specific folders.
 * @author @jgclark
 * @param {Array<string>} foldersToExclude (optional)
 * @param {boolean} excludeSpecialFolders? (optional: default = true)
 * @return {Array<TNote>} array of notes
 */
export function projectNotesSortedByTitle(foldersToExclude: Array<string> = [], excludeSpecialFolders: boolean = true): Array<TNote> {
  try {
    const projectNotes = getRegularNotesFromFilteredFolders(foldersToExclude, excludeSpecialFolders)
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
  } catch (err) {
    logError('note/projectNotesSortedByTitle', err.message)
    return []
  }
}

/**
 * Filter out from the supplied list of notes any that are in specific excluded folders, or optionally in all special @folders.
 * @author @jgclark
 * @param {$ReadOnlyArray<TNote>} projectNotesIn
 * @param {Array<string>} foldersToExclude
 * @param {boolean} excludeSpecialFolders? (optional: default = true)
 * @return {Array<TNote>} array of notes
 */
export function filterOutProjectNotesFromExcludedFolders(
  projectNotesIn: $ReadOnlyArray<TNote>,
  foldersToExclude: Array<string>,
  excludeSpecialFolders: boolean = true,
): Array<TNote> {
  try {
    const excludedFolders = foldersToExclude
    if (excludeSpecialFolders) {
      excludedFolders.push('@Templates')
    }
    const outputList: Array<TNote> = []
    // logDebug('note/filterOutProjectNotesFromExcludedFolders', `Starting with ${String(projectNotesIn.length)} notes and excluding ${String(excludedFolders)}`)
    for (const n of projectNotesIn) {
      let include = true
      const thisFolder = getFolderFromFilename(n.filename)
      for (const ef of excludedFolders) {
        if (thisFolder.startsWith(ef)) {
          include = false
          logDebug('note/filterOutProjectNotesFromExcludedFolders', `- exclued note filename ${n.filename} as starts with an excludedFolder ${ef}`)
        }
      }
      if (include) outputList.push(n)
    }
    // logDebug('note/filterOutProjectNotesFromExcludedFolders', `-> ${String(outputList)}`)
    return outputList
  } catch (err) {
    logError('note/filterOutProjectNotesFromExcludedFolders', err.message)
    return []
  }
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
 * and the next heading of that same or higher level, or the end of the file if that's sooner.
 * @author @jgclark
 *
 * @param {TNote} note to use
 * @param {string} headingOfSectionToRemove
 * @return {number} lineIndex of the found headingOfSectionToRemove, or if not found the last line of the note
 */
export function removeSection(note: TNote, headingOfSectionToRemove: string): number {
  try {
    const paras = note.paragraphs ?? []
    const startOfActive = findStartOfActivePartOfNote(note)
    const endOfActive = findEndOfActivePartOfNote(note)

    if (paras.length === 0) {
      // We have no paragraphs, so need to return now
      logDebug('note / removeSection', `Note is empty, so there's nothing to do`)
      return 0
    }
    if (headingOfSectionToRemove === '') {
      logDebug('note / removeSection', `No heading to remove, so there's nothing to do. Will point to endOfActive (line ${endOfActive})`)
      return endOfActive
    }
    logDebug('note / removeSection', `Trying to remove '${headingOfSectionToRemove}' from note '${displayTitle(note)}' with ${paras.length} paras`)

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
 * Filter a list of notes against a list of folders to ignore and return the filtered list.
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
 * Filter a list of paras against a list of folders to ignore (and the @... special folders) and return the filtered list.
 * Obviously requires going via the notes array and not the paras array
 * @author @jgclark building on @dwertheimer's work
 *
 * @param {Array<TNote>} notes - array of notes to review
 * @param {Array<string>} excludedFolders - array of folder names to exclude/ignore (if a file is in one of these folders, it will be removed)
 * @param {boolean} includeCalendar? - whether to include Calendar notes (default: true)
 * @returns {Array<TParagraph>} - array of paragraphs that are not in excluded folders
 */
export function filterOutParasInExcludeFolders(paras: Array<TParagraph>, excludedFolders: Array<string>, includeCalendar: boolean = true): Array<TParagraph> {
  try {
    if (!excludedFolders) {
      logInfo('note/filterOutParasInExcludeFolders', `excludedFolders list is empty, so will return all paras`)
      return paras
    }
    const noteFilenameList: Array<string> = paras.map((p) => p.note?.filename ?? '(unknown)')
    const dedupedNoteFilenameList = [...new Set(noteFilenameList)]
    // logDebug('note/filterOutParasInExcludeFolders', `noteFilenameList ${noteFilenameList.length} long; dedupedNoteFilenameList ${dedupedNoteFilenameList.length} long`)

    if (dedupedNoteFilenameList.length > 0) {
      const wantedFolders = getFolderListMinusExclusions(excludedFolders, true, false, true)
      // filter out paras not in these notes
      const parasFiltered = paras.filter((p) => {
        const thisNoteFilename = p.note?.filename ?? 'error'
        const thisNoteFolder = getFolderFromFilename(thisNoteFilename)
        const isInWantedFolder = (includeCalendar && p.noteType === 'Calendar') || wantedFolders.includes(thisNoteFolder)
        // console.log(`${thisNoteFilename} isInWantedFolder = ${String(isInWantedFolder)}`)
        return isInWantedFolder
      })
      return parasFiltered
    } else {
      // logDebug('note/filterOutParasInExcludeFolders', `found no corresponding notes`)
      return []
    }
  } catch (err) {
    logError('note/filterOutParasInExcludeFolders', err)
    return []
  }
}

/**
 * Is the note from the given list of folders (or a Calendar allowed by allowAllCalendarNotes)?
 * @param {TNote} note
 * @param {Array<string>} allowedFolderList
 * @param {boolean} allowAllCalendarNotes (optional, defaults to true)
 * @returns {boolean}
 * @tests in jest file
 */
export function isNoteFromAllowedFolder(note: TNote, allowedFolderList: Array<string>, allowAllCalendarNotes: boolean = true): boolean {
  try {
    // Calendar note check
    if (note.type === 'Calendar') {
      // logDebug('isNoteFromAllowedFolder', `-> Calendar note ${allowAllCalendarNotes ? 'allowed' : 'NOT allowed'} as a result of allowAllCalendarNotes`)
      return allowAllCalendarNotes
    }

    // Is regular note's filename in allowedFolderList?
    const noteFolder = getFolderFromFilename(note.filename)
    // Test if allowedFolderList includes noteFolder
    const matchFound = allowedFolderList.includes(noteFolder)
    // logDebug('isNoteFromAllowedFolder', `- ${matchFound ? 'match' : 'NO match'} to '${note.filename}' folder '${noteFolder}' from ${String(allowedFolderList.length)} folders`)
    return matchFound
  } catch (err) {
    logError('note/isNoteFromAllowedFolder', err)
    return false
  }
}

/**
 * Return count of number of open tasks/checklists in the content.
 * @param {string} content
 * @returns {number}
 */
export function numberOfOpenItemsInString(content: string): number {
  const RE_USER_OPEN_TASK_OR_CHECKLIST_MARKER_MULTI_LINE = formRegExForUsersOpenTasks(true)
  logDebug('numberOfOpenItems', String(RE_USER_OPEN_TASK_OR_CHECKLIST_MARKER_MULTI_LINE))
  const res = Array.from(content.matchAll(RE_USER_OPEN_TASK_OR_CHECKLIST_MARKER_MULTI_LINE))
  return res ? res.length : 0
}

/**
 * Return count of number of open tasks/checklists in the content.
 * @param {CoreNoteFields} note
 * @returns {number}
 */
export function numberOfOpenItemsInNote(note: CoreNoteFields): number {
  const res = note.paragraphs.filter((p) => ['open', 'scheduled', 'checklist', 'checklistScheduled'].includes(p.type))
  return res ? res.length : 0
}
