// @flow
//-------------------------------------------------------------------------------
// Note-level Functions that require NP API calls
//-------------------------------------------------------------------------------

// import moment from 'moment/min/moment-with-locales'
import moment from 'moment/min/moment-with-locales'
import { getBlockUnderHeading } from './NPParagraph'
import * as dt from '@helpers/dateTime'
import {
  calcOffsetDateStrUsingCalendarType,
  getTodaysDateHyphenated,
  // isScheduled, // Note: name clash. Where used this will be dt.isScheduled
  isValidCalendarNoteFilename,
  isValidCalendarNoteFilenameWithoutExtension,
  RE_ISO_DATE,
  RE_OFFSET_DATE,
  RE_OFFSET_DATE_CAPTURE,
  unhyphenateString,
}
  from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { ensureFrontmatter } from '@helpers/NPFrontMatter'
import { findStartOfActivePartOfNote, findEndOfActivePartOfNote } from '@helpers/paragraph'
import { noteType } from '@helpers/note'
import { caseInsensitiveIncludes, getCorrectedHashtagsFromNote } from '@helpers/search'
import { isOpen, isClosed, isDone, isScheduled } from '@helpers/utils'

const pluginJson = 'NPnote.js'

//-------------------------------------------------------------------------------

/**
 * Print summary of note details to log.
 * @author @eduardmet
 * @param {?TNote} noteIn
 * @param {boolean?} alsoShowParagraphs? (default: false)
 */
export function printNote(noteIn: ?TNote, alsoShowParagraphs: boolean = false): void {
  try {
    let note
    if (noteIn == null) {
      logDebug('note/printNote()', 'No Note passed. Will try Editor note.')
      note = Editor?.note
    } else {
      note = noteIn
    }
    if (!note) {
      logWarn('note/printNote()', `No valid note found. Stopping.`)
      return
    }

    if (note.type === 'Notes') {
      const endOfActive = findEndOfActivePartOfNote(note)
      logInfo(
        'note/printNote',
        `title: ${note.title ?? ''}\n- filename: ${note.filename ?? ''}\n- created: ${String(note.createdDate) ?? ''}\n- changed: ${String(note.changedDate) ?? ''}\n- paragraphs: ${note.paragraphs.length
        } (endOfActive: ${String(endOfActive)})\n- hashtags: ${note.hashtags?.join(', ') ?? ''}\n- mentions: ${note.mentions?.join(', ') ?? ''}`,
      )
    } else {
      logInfo(
        'note/printNote',
        `filename: ${note.filename ?? ''}\n- created: ${String(note.createdDate) ?? ''}\n- changed: ${String(note.changedDate) ?? ''}\n- paragraphs: ${note.paragraphs.length
        }\n- hashtags: ${note.hashtags?.join(', ') ?? ''}\n- mentions: ${note.mentions?.join(', ') ?? ''}`,
      )
    }
    if (note.paragraphs.length > 0) {
      const open = note.paragraphs.filter((p) => isOpen(p)).length
      const done = note.paragraphs.filter((p) => isDone(p)).length
      const closed = note.paragraphs.filter((p) => isClosed(p)).length
      const scheduled = note.paragraphs.filter((p) => isScheduled(p)).length
      console.log(
        `- open: ${String(open)}\n- done: ${String(done)}\n- closed: ${String(closed)}\n- scheduled: ${String(scheduled)}`
      )
      if (alsoShowParagraphs) {
        note.paragraphs.map((p) => console.log(`- ${p.lineIndex}: ${p.type} ${p.rawContent}`))
      }
    }
    // Now show .backlinks
    if (note.backlinks.length > 0) {
      console.log(`- ${String(note.backlinks.length)} backlinked notes`)
      const flatBacklinkParas = getFlatListOfBacklinks(note) // Note: this requires DataStore
      console.log(`- ${String(flatBacklinkParas.length)} backlink paras:`)
      for (let i = 0; i < flatBacklinkParas.length; i++) {
        const p = flatBacklinkParas[i]
        console.log(`  - ${p.lineIndex} [${p.type}, ${p.indents}]: ${p.content}`)
      }
    }
  } catch (e) {
    logError('note/printNote', `Error printing note: ${e.message}`)
  }
}

/**
 * Get a note from (in order):
 * - its title (for a project note)
 * - its relative date description ('today', 'yesterday', 'tomorrow', 'this week', 'last week', 'next week')
 * - an ISO date (i.e. YYYY-MM-DD)
 * - for date intervals '{[+-]N[dwmqy]}' calculate the date string relative to today
 * - for calendar notes, from it's NP date string (e.g. YYYYMMDD, YYYY-Wnn etc.)
 * @param {string} noteIdentifier: project note title, or date interval (e.g.'-1d'), or NotePlan's (internal) calendar date string
 * @returns {TNote?} note if found, or null
 */
export function getNoteFromIdentifier(noteIdentifierIn: string): TNote | null {
  try {
    let thisFilename = ''
    // TODO: Ideally move this to a function, for i18n. Can Moment or Chrono libraries help?
    const noteIdentifier =
      noteIdentifierIn === 'today'
        ? '{0d}'
        : noteIdentifierIn === 'yesterday'
        ? '{-1d}'
        : noteIdentifierIn === 'tomorrow'
        ? '{+1d}'
        : noteIdentifierIn === 'this week'
        ? '{0w}'
        : noteIdentifierIn === 'last week'
        ? '{-1w}'
        : noteIdentifierIn === 'next week'
        ? '{+1w}'
        : noteIdentifierIn
    const possibleProjectNotes = DataStore.projectNoteByTitle(noteIdentifier) ?? []
    if (possibleProjectNotes.length > 0) {
      thisFilename = possibleProjectNotes[0].filename
      logDebug('NPnote/getNoteFilenameFromTitle', `-> found project note with filename '${thisFilename}'`)
      return possibleProjectNotes[0]
    }
    // Not a project note, so look at calendar notes
    let possDateString = noteIdentifier
    if (new RegExp(RE_OFFSET_DATE).test(possDateString)) {
      // this is a date interval, so -> date string relative to today
      // $FlowIgnore[incompatible-use]
      const thisOffset = possDateString.match(new RegExp(RE_OFFSET_DATE_CAPTURE))[1]
      possDateString = calcOffsetDateStrUsingCalendarType(thisOffset)
      logDebug('NPnote/getNoteFilenameFromTitle', `found offset date ${thisOffset} -> '${possDateString}'`)
    }
    // If its YYYY-MM-DD then have to turn it into YYYYMMDD
    if (new RegExp(RE_ISO_DATE).test(possDateString)) {
      possDateString = unhyphenateString(possDateString)
    }
    // If this matches a calendar note by filename (YYYYMMDD or YYYY-Wnn etc.)
    if (isValidCalendarNoteFilenameWithoutExtension(possDateString)) {
      const thisNote = DataStore.calendarNoteByDateString(possDateString)
      if (thisNote) {
        thisFilename = thisNote.filename
        logDebug('NPnote/getNoteFilenameFromTitle', `-> found calendar note with filename '${thisFilename}' from ${possDateString}`)
        return thisNote
      } else {
        logError('NPnote/getNoteFilenameFromTitle', `${possDateString} doesn't seem to have a calendar note?`)
      }
    } else {
      logError('NPnote/getNoteFilenameFromTitle', `${possDateString} is not a valid date string`)
    }
    logError('NPnote/getNoteFilenameFromTitle', `-> no note found for '${noteIdentifierIn}'`)
    return null
  } catch (err) {
    logError(pluginJson, err.message)
    return null
  }
}

/**
 * Get a note's filename from (in order):
 * - its title (for a project note)
 * - an ISO date (i.e. YYYY-MM-DD)
 * - for date intervals '[+-]N[dwmqy]' calculate the date string relative to today
 * - for calendar notes, from it's NP date string (e.g. YYYYMMDD, YYYY-Wnn etc.)
 * @param {string} inputStr: project note title, or date interval (e.g.'-1d'), or NotePlan's (internal) calendar date string
 * @returns {string} filename of note if found, or null
 */
export function getNoteFilenameFromTitle(inputStr: string): string | null {
  let thisFilename = ''
  const possibleProjectNotes = DataStore.projectNoteByTitle(inputStr) ?? []
  if (possibleProjectNotes.length > 0) {
    thisFilename = possibleProjectNotes[0].filename
    logDebug('NPnote/getNoteFilenameFromTitle', `-> found project note '${thisFilename}'`)
    return thisFilename
  }
  // Not a project note, so look at calendar notes
  let possDateString = inputStr
  if (new RegExp(RE_OFFSET_DATE).test(possDateString)) {
    // this is a date interval, so -> date string relative to today
    // $FlowIgnore[incompatible-use]
    const thisOffset = possDateString.match(new RegExp(RE_OFFSET_DATE_CAPTURE))[1]
    possDateString = calcOffsetDateStrUsingCalendarType(thisOffset)
    logDebug('NPnote/getNoteFilenameFromTitle', `found offset date ${thisOffset} -> '${possDateString}'`)
  }
  // If its YYYY-MM-DD then have to turn it into YYYYMMDD
  if (new RegExp(RE_ISO_DATE).test(possDateString)) {
    possDateString = unhyphenateString(possDateString)
  }
  // If this matches a calendar note by filename (YYYYMMDD or YYYY-Wnn etc.)
  if (isValidCalendarNoteFilenameWithoutExtension(possDateString)) {
    const thisNote = DataStore.calendarNoteByDateString(possDateString)
    if (thisNote) {
      thisFilename = thisNote.filename
      logDebug('NPnote/getNoteFilenameFromTitle', `-> found calendar note '${thisFilename}' from ${possDateString}`)
      return thisFilename
    } else {
      logError('NPnote/getNoteFilenameFromTitle', `${possDateString} doesn't seem to have a calendar note?`)
    }
  } else {
    logError('NPnote/getNoteFilenameFromTitle', `${possDateString} is not a valid date string`)
  }
  logError('NPnote/getNoteFilenameFromTitle', `-> no note found for '${inputStr}'`)
  return null
}

/**
 * Convert the note to using frontmatter Syntax
 * If optional default text is given, this is added to the frontmatter.
 * @author @jgclark
 * @param {TNote} note to convert
 * @param {string?} defaultFMText to add to frontmatter if supplied
 * @returns {boolean} success?
 */
export function convertNoteToFrontmatter(note: TNote, defaultFMText: string = ''): void {
  try {
    if (!note) {
      throw new Error("note/convertNoteToFrontmatter: No note supplied, and can't find Editor either.")
    }
    const success = ensureFrontmatter(note)
    if (success) {
      logDebug('note/convertNoteToFrontmatter', `ensureFrontmatter() worked for note ${note.filename}`)
      if (defaultFMText !== '') {
        const endOfFMLineIndex = findStartOfActivePartOfNote(note) - 1 // closing separator line
        note.insertParagraph(defaultFMText, endOfFMLineIndex, 'text') // inserts before closing separator line
      }
    } else {
      logWarn('note/convertNoteToFrontmatter', `ensureFrontmatter() failed for note ${note.filename}`)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Select the first non-title line in Editor
 * NotePlan will always show you the ## before a title if your cursor is on a title line, but
 * this is ugly. And so in this function we find and select the first non-title line
 * @author @dwertheimer
 * @returns
 */
export function selectFirstNonTitleLineInEditor(): void {
  if (Editor && Editor.content) {
    for (let i = findStartOfActivePartOfNote(Editor); i < Editor.paragraphs.length; i++) {
      const line = Editor.paragraphs[i]
      if (line.type !== 'title' && line?.contentRange && line.contentRange.start >= 0) {
        Editor.select(line.contentRange.start, 0)
        return
      }
    }
  }
}

/**
 * Find paragraphs in note which are open and (maybe) tagged for today (either >today or hyphenated date)
 * If includeAllTodos is true, then all open todos are returned except for ones scheduled for a different day
 * @author @dwertheimer
 * @param {TNote} note
 * @param {boolean} includeAllTodos - whether to include all open todos, or just those tagged for today
 * @returns {Array<TParagraph>} of paragraphs which are open or open+tagged for today
 */
export function findOpenTodosInNote(note: TNote, includeAllTodos: boolean = false): Array<TParagraph> {
  const hyphDate = getTodaysDateHyphenated()
  // const toDate = getDateObjFromDateTimeString(hyphDate)
  const isTodayItem = (text: string) => [`>${hyphDate}`, '>today'].filter((a) => text.indexOf(a) > -1).length > 0
  // const todos:Array<TParagraph>  = []
  if (note.paragraphs) {
    return note.paragraphs.filter((p) => isOpen(p) && (isTodayItem(p.content) || (includeAllTodos && !dt.isScheduled(p.content))))
  }
  logDebug(`findOpenTodosInNote could not find note.paragraphs. returning empty array`)
  return []
}

/**
 * note.backlinks is an array of Paragraphs, but its subItems can be nested. The nesting can be multiple levels deep.
 * This function returns an array of TParagraphs, one for each backlink, undoing the nesting.
 */
// $FlowFixMe[incompatible-return]
export function getFlatListOfBacklinks(note: TNote): Array<TParagraph> {
  // Iterate over all backlinks, recursing where necessary to visit all subItems, returning a flat list of lineIndex
  function flattenSubItems(subItems: Array<TBacklinkFields>): Array<TBacklinkFields> {
    const items: Array<TBacklinkFields> = []
    subItems.forEach((item) => {
      if (item.subItems) {
        items.push(item)
        // logDebug('note/getFlatListOfBacklinks', `+ ${item.lineIndex}: ${item.content} [has ${items.length} saved indexes`)
        // Recursively process any subItems of the current item
        items.push(...flattenSubItems(item.subItems))
      }
    })
    return items
  }

  try {
    const noteBacklinks = note.backlinks
    if (noteBacklinks.length === 0) {
      return []
    }
    // logDebug('note/getFlatListOfBacklinks', `Starting for note ${displayTitle(note)}`)
    const flatBacklinkParas: Array<TParagraph> = []
    for (const noteBacklink of noteBacklinks) {
      // Get the note that this backlink points to
      const thisBacklinkNote = DataStore.noteByFilename(noteBacklink.filename, noteBacklink.noteType)
      const thisBacklinkNoteParas = thisBacklinkNote?.paragraphs
      if (!thisBacklinkNoteParas) {
        logError('note/getFlatListOfBacklinks', `Error getting paragraphs for ${noteBacklink.filename}`)
      }
      // logDebug('note/getFlatListOfBacklinks', `in ${thisBacklinkNote?.filename ?? '(error)'}`)
      let thisNoteItems: Array<TBacklinkFields> = []
      // thisNoteLineIndexes.push(noteBacklink.lineIndex) // noteBacklink.lineIndex

      if (noteBacklink.subItems && noteBacklink.subItems.length > 0) {
        // logDebug('note/getFlatListOfBacklinks', `- has ${noteBacklink.subItems.length} top-levelsubItems`)
        thisNoteItems = flattenSubItems(noteBacklink.subItems)
      }
      // logDebug('note/getFlatListOfBacklinks', `  => ${thisNoteItems.length} items`)

      // Now find paragraphs from those lineIndexes
      for (const item of thisNoteItems) {
        // logDebug('note/getFlatListOfBacklinks', `+ ${item.lineIndex}`)
        // $FlowIgnore[incompatible-use]
        flatBacklinkParas.push(thisBacklinkNoteParas[item.lineIndex])
      }
      // logDebug('note/getFlatListOfBacklinks', `  fBLP now has ${String(flatBacklinkParas.length)} paragraphs`)
    }

    return flatBacklinkParas
  } catch (e) {
    logError('note/printNote', `Error printing note: ${e.message}`)
  }
}

/**
 * Get the paragraphs in 'note' which are scheduled for date of the 'calendar' note.
 * @author @dwertheimer extended by @jgclark
 * @param {CoreNoteFields} calendar note to look for links to (the note or Editor)
 * @param {CoreNoteFields} includeHeadings? (default to true for backwards compatibility)
 * @returns {Array<TParagraph>} - paragraphs which reference today in some way
 */
export function getReferencedParagraphs(calNote: Note, includeHeadings: boolean = true): Array<TParagraph> {
  const thisDateStr = calNote.title || '' // will be  2022-10-10 or 2022-10 or 2022-Q3 etc depending on the note type
  const wantedParas = []

  // Use .backlinks, which is described as "Get all backlinks pointing to the current note as Paragraph objects. In this array, the toplevel items are all notes linking to the current note and the 'subItems' attributes (of the paragraph objects) contain the paragraphs with a link to the current note. The headings of the linked paragraphs are also listed here, although they don't have to contain a link."
  // Note: @jgclark reckons that the subItem.headingLevel data returned by this might be wrong.
  const backlinkParas: Array<TParagraph> = getFlatListOfBacklinks(calNote) // an array of notes which link to this note
  // logDebug(`getReferencedParagraphs`, `found ${String(backlinkParas.length)} backlinked paras for ${displayTitle(calNote)}:`)

  backlinkParas.forEach((para) => {
  // If we want to filter out the headings, then check the subItem content actually includes the date of the note of interest.
    if (includeHeadings) {
      // logDebug(`getReferencedParagraphs`, `- adding  "${para.content}" as we want headings`)
    }
    else if (para.content.includes(`>${thisDateStr}`) || para.content.includes(`>today`)) {
      // logDebug(`getReferencedParagraphs`, `- adding "${para.content}" as it includes >${thisDateStr} or >today`)
      wantedParas.push(para)
    } else {
      // logDebug(`getReferencedParagraphs`, `- skipping "${para.content}" as it doesn't include >${thisDateStr}`)
    }
  })

  // logDebug(`getReferencedParagraphs`, `"${calNote.title || ''}" has ${wantedParas.length} wantedParas`)
  return wantedParas
}

/**
 * Get linked items from the references section (.backlinks)
 * @param { note | null} pNote
 * @returns {Array<TParagraph>} - paragraphs which reference today in some way
 * Backlinks format: {"type":"note","content":"_Testing scheduled sweeping","rawContent":"_Testing scheduled sweeping","prefix":"","lineIndex":0,"heading":"","headingLevel":0,"isRecurring":0,"indents":0,"filename":"zDELETEME/Test scheduled.md","noteType":"Notes","linkedNoteTitles":[],"subItems":[{},{},{},{}]}
 * backlinks[0].subItems[0] =JSLog: {"type":"open","content":"scheduled for 10/4 using app >today","rawContent":"* scheduled for 10/4 using app
 * ","prefix":"* ","contentRange":{},"lineIndex":2,"date":"2021-11-07T07:00:00.000Z","heading":"_Testing scheduled sweeping","headingRange":{},"headingLevel":1,"isRecurring":0,"indents":0,"filename":"zDELETEME/Test scheduled.md","noteType":"Notes","linkedNoteTitles":[],"subItems":[]}
 */
export function getTodaysReferences(pNote: TNote | null = null): $ReadOnlyArray<TParagraph> {
  // logDebug(pluginJson, `getTodaysReferences starting`)
  const note = pNote || Editor.note
  if (note == null) {
    logDebug(pluginJson, `timeblocking could not open Note`)
    return []
  }
  return getReferencedParagraphs(note)
}

export type OpenNoteOptions = Partial<{
  newWindow?: boolean,
  splitView?: boolean,
  highlightStart?: number,
  highlightEnd?: number,
  createIfNeeded?: boolean,
  content?: string,
}>

/**
 * Convenience Method for Editor.openNoteByFilename, include only the options you care about (requires NP v3.7.2+)
 * Tries to work around NP bug where opening a note that doesn't exist doesn't work
 * If you send the options.content field to force content setting,   it should have a value or undefined (not null)
 * @param {string} filename - Filename of the note file (can be without extension), but has to include the relative folder such as `folder/filename.txt`
 * @param {OpenNoteOptions} options - options for opening the note (all optional -- see fields in type)
 * @returns {Promise<TNote|void>} - the note that was opened
 * @author @dwertheimer
 */
export async function openNoteByFilename(filename: string, options: OpenNoteOptions = {}): Promise<TNote | void> {
  const isCalendarNote = isValidCalendarNoteFilename(filename)
  let note = await Editor.openNoteByFilename(
    filename,
    options.newWindow || false,
    options.highlightStart || 0,
    options.highlightEnd || 0,
    options.splitView || false,
    options.createIfNeeded || false,
    options.content || undefined /* important for this to be undefined or NP creates a note with "null" */,
  )
  if (!note) {
    logDebug(pluginJson, `openNoteByFilename could not open note with filename: "${filename}" (probably didn't exist)`)
    // note may not exist yet, so try to create it (if it's a calendar note)
    const dataStoreNote = isCalendarNote ? await DataStore.noteByFilename(filename, 'Calendar') : null
    if (dataStoreNote) {
      dataStoreNote.content = ''
      // $FlowIgnore[incompatible-call]
      note = await Editor.openNoteByFilename(
        filename,
        options.newWindow || false,
        options.highlightStart || 0,
        options.highlightEnd || 0,
        options.splitView || false,
        options.createIfNeeded || false,
        options.content || undefined,
      )
    }
  }
  if (!note) {
    logError(
      pluginJson,
      `openNoteByFilename could not open ${isCalendarNote ? 'Calendar ' : 'Project'} note with filename: "${filename}" ${
        isCalendarNote ? '' : '. You may need to set "createIfNeeded" to true for this to work'
      }`,
    )
  }
  return note
}

/**
 * Highlight/scroll to a paragraph (a single line) in the editor matching a string (in the Editor, open document)
 * Most likely used to scroll a page to a specific heading (though it can be used for any single line/paragraph)
 * Note: the line will be selected, so a user keystroke following hightlight would delete the block
 * IF you want to just scroll to the content but not leave it selected, use the function scrollToParagraphWithContent()
 * @param {string} content - the content of the paragraph to highlight
 * @returns {boolean} - true if the paragraph was found and highlighted, false if not
 */
export function highlightParagraphWithContent(content: string): boolean {
  const para = Editor.paragraphs.find((p) => p.content === content)
  if (para) {
    Editor.highlight(para)
    return true
  }
  logError(`highlightParagraphWithContent could not find paragraph with content: "${content}" in the Editor`)
  return false
}

/**
 * Scroll to and Highlight an entire block under a heading matching a string (in the Editor, open document)
 * Note: the block will be the cursor selection, so a user keystroke following hightlight would delete the block
 * IF you want to just scroll to the content but not leave it selected, use the function scrollToParagraphWithContent()
 * @param {string} content - the content of the paragraph to highlight
 * @returns {boolean} - true if the paragraph was found and highlighted, false if not
 */
export function highlightBlockWithHeading(content: string): boolean {
  const blockParas = getBlockUnderHeading(Editor, content, true)
  if (blockParas && blockParas.length > 0) {
    // $FlowFixMe[incompatible-call] but still TODO(@dwertheimer): why is 'Range' undefined?
    const contentRange = Range.create(blockParas[0].contentRange?.start, blockParas[blockParas.length - 1].contentRange?.end)
    Editor.highlightByRange(contentRange) // highlight the entire block
    return true
  }
  logError(`highlightBlockWithHeading could not find paragraph with content: "${content}" in the Editor`)
  return false
}

/**
 * Scroll to a paragraph (a single line) in the editor matching a string (in the Editor, open document)
 * Most likely used to scroll a page to a specific heading (though it can be used for any single line/paragraph)
 * Note: the line will be selected, so a user keystroke following hightlight would delete the block
 * IF you want to just scroll to the content but not leave it selected, use the function
 * @param {string} content - the content of the paragraph to highlight
 * @returns {boolean} - true if the paragraph was found and highlighted, false if not
 */
export function scrollToParagraphWithContent(content: string): boolean {
  const para = Editor.paragraphs.find((p) => p.content === content)
  if (para && para.contentRange?.end) {
    Editor.highlightByIndex(para.contentRange.end, 0)
    return true
  }
  logError(`scrollToParagraphWithContent could not find paragraph with content: "${content}" in the Editor`)
  return false
}

/**
 * Return list of all notes of type ['Notes'] or ['Calendar'] or both (default).
 * @author @jgclark
 * @param {Array<string>} noteTypesToInclude
 * @returns {Array<TNote>}
 */
export function getAllNotesOfType(noteTypesToInclude: Array<string> = ['Calendar', 'Notes']): Array<TNote> {
  try {
    let allNotesToCheck: Array<TNote> = []
    if (noteTypesToInclude.includes('Calendar')) {
      allNotesToCheck = DataStore.calendarNotes.slice()
    }
    if (noteTypesToInclude.includes('Notes')) {
      allNotesToCheck = allNotesToCheck.concat(DataStore.projectNotes.slice())
    }
    return allNotesToCheck
  } catch (err) {
    logError('getAllNotesOfType', `${err.name}: ${err.message}`)
    return [] // for completeness
  }
}

/**
 * Return list of all notes changed in the last 'numDays'.
 * Set 'noteTypesToInclude' to just ['Notes'] or ['Calendar'] to include just those note types.
 * Note: if numDays === 0 then it will only return notes changed in the current day, not the last 24 hours.
 * @author @jgclark
 * @param {number} numDays
 * @param {Array<string>} noteTypesToInclude
 * @returns {Array<TNote>}
 */
export function getNotesChangedInInterval(numDays: number, noteTypesToInclude: Array<string> = ['Calendar', 'Notes']): Array<TNote> {
  try {
    let allNotesToCheck: Array<TNote> = []
    if (noteTypesToInclude.includes('Calendar')) {
      allNotesToCheck = DataStore.calendarNotes.slice()
    }
    if (noteTypesToInclude.includes('Notes')) {
      allNotesToCheck = allNotesToCheck.concat(DataStore.projectNotes.slice())
    }
    let matchingNotes: Array<TNote> = []
    const todayStart = new moment().startOf('day') // use moment instead of `new Date` to ensure we get a date in the local timezone
    const momentToStartLooking = todayStart.subtract(numDays, 'days')
    const jsdateToStartLooking = momentToStartLooking.toDate()

    matchingNotes = allNotesToCheck.filter((f) => f.changedDate >= jsdateToStartLooking)
    logDebug(
      'getNotesChangedInInterval',
      `from ${allNotesToCheck.length} notes of type ${String(noteTypesToInclude)} found ${matchingNotes.length} changed after ${String(momentToStartLooking)}`,
    )
    return matchingNotes
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return [] // for completeness
  }
}

/**
 * Return array of notes changed in the last 'numDays' from provided array of 'notesToCheck'
 * @author @jgclark
 * @param {Array<TNote>} notesToCheck
 * @param {number} numDays
 * @returns {Array<TNote>}
 */
export function getNotesChangedInIntervalFromList(notesToCheck: $ReadOnlyArray<TNote>, numDays: number): Array<TNote> {
  try {
    const todayStart = new moment().startOf('day') // use moment instead of `new Date` to ensure we get a date in the local timezone
    const momentToStartLooking = todayStart.subtract(numDays, 'days')
    const jsdateToStartLooking = momentToStartLooking.toDate()

    const matchingNotes: Array<TNote> = notesToCheck.filter((f) => f.changedDate >= jsdateToStartLooking)
    // logDebug('getNotesChangedInInterval', `from ${notesToCheck.length} notes found ${matchingNotes.length} changed after ${String(momentToStartLooking)}`)
    return matchingNotes
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return [] // for completeness
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
 * Return array of notes with a particular #hashtag or @mention, with further optional parameters about which (sub)folders to look in
 * @author @jgclark
 * @param {string} tag - tag/mention name to look for
 * @param {boolean?} alsoSearchCalendarNotes - (optional, defaults to false)
 * @param {string?} folder - optional folder to limit to
 * @param {boolean?} includeSubfolders? - if folder given, whether to look in subfolders of this folder or not (optional, defaults to false)
 * @param {Array<string>?} tagsToExclude - optional list of tags that if found in the note, excludes the note
 * @param {boolean?} caseInsensitiveMatch? - whether to ignore case when matching (optional, defaults to true)
 * @param {Array<TNote>?} notesToSearchIn - optional array of notes to search in
 * @returns {Array<TNote>}
 */
export function findNotesMatchingHashtagOrMention(
  tag: string,
  alsoSearchCalendarNotes: boolean = false,
  folder: string = '',
  includeSubfolders: boolean = false,
  tagsToExclude: Array<string> = [],
  caseInsensitiveMatch: boolean = true,
  notesToSearchIn?: Array<TNote>,
): Array<TNote> {
  // logDebug(
  //   `NPNote/findNotesMatchingHashtagOrMention`,
  //   `tag:${tag} folder:${folder ?? '(none)'} includeSubfolders:${String(includeSubfolders)} tagsToExclude:${String(tagsToExclude)} caseInsensitiveMatch:${String(caseInsensitiveMatch)}`,
  // )
  return findNotesMatchingHashtag(tag, folder, includeSubfolders, tagsToExclude, caseInsensitiveMatch, notesToSearchIn, true, alsoSearchCalendarNotes)
}

/**
 * Return list of notes with a given #hashtag or @mention (singular), with further optional parameters about which (sub)folders to look in, and a term to defeat on.
 * Originally only looked in Project Notes, but 'alsoSearchCalendarNotes' allows it to look further.
 * @author @jgclark
 * @param {string} tag - tag/mention name to look for
 * @param {string?} folder - optional folder to limit to
 * @param {boolean?} includeSubfolders? - if folder given, whether to look in subfolders of this folder or not (optional, defaults to false)
 * @param {Array<string>?} tagsToExclude - optional list of tags that if found in the note, excludes the note
 * @param {boolean?} caseInsensitiveMatch - whether to ignore case when matching (optional, defaults to true)
 * @param {Array<TNote>?} notesToSearchIn - optional array of notes to search in
 * @param {boolean?} alsoSearchMentions - whether to search @mentions as well (optional, defaults to false)
 * @param {boolean?} alsoSearchCalendarNotes - (optional, defaults to false)
 * @return {Array<TNote>}
 */
export function findNotesMatchingHashtag(
  tag: string,
  folder: ?string,
  includeSubfolders: boolean = false,
  tagsToExclude: Array<string> = [],
  caseInsensitiveMatch: boolean = true,
  notesToSearchIn?: Array<TNote>,
  alsoSearchMentions: boolean = false,
  alsoSearchCalendarNotes: boolean = false,
): Array<TNote> {
  try {
    // Check for special conditions first
    if (tag === '') {
      logError('NPnote/findNotesMatchingHashtag', `No hashtag given. Stopping`)
      return [] // for completeness
    }
    let notesToSearch = notesToSearchIn ?? DataStore.projectNotes
    if (alsoSearchCalendarNotes) {
      notesToSearch = notesToSearch.concat(DataStore.calendarNotes)
    }
    // logDebug('NPnote/findNotesMatchingHashtag', `starting with ${notesToSearch.length} notes (${notesToSearchIn ? 'from the notesToSearchIn param' : 'from DataStore.projectNotes'} ${alsoSearchCalendarNotes ? '+ calendar notes)' : ')'}`)

    // const startTime = new Date()
    let projectNotesInFolder: Array<TNote>
    // If folder given (not empty) then filter using it
    if (folder && folder !== '') {
      if (includeSubfolders) {
        // use startsWith as filter to include subfolders
        projectNotesInFolder = notesToSearch.slice().filter((n) => n.filename.startsWith(`${folder}/`))
      } else {
        // use match as filter to exclude subfolders
        projectNotesInFolder = notesToSearch.slice().filter((n) => getFolderFromFilename(n.filename) === folder)
      }
    } else {
      // no folder specified, so grab all notes from DataStore
      projectNotesInFolder = notesToSearch.slice()
    }
    // logDebug(`NPnote/findNotesMatchingHashtag`,`tag:${tag} folder:${String(folder)} includeSubfolders:${String(includeSubfolders)} tagsToExclude:${String(tagsToExclude)} for ${String(projectNotesInFolder.length)} notes`)

    // Filter by tag (and now mentions as well, if requested)
    // Note: now using the cut-down list of hashtags as the API returns partial duplicates
    let projectNotesWithTag: Array<TNote>
    if (caseInsensitiveMatch) {
      projectNotesWithTag = projectNotesInFolder.filter((n) => {
        const correctedHashtags = getCorrectedHashtagsFromNote(n)
        // if (correctedHashtags.length > 0) logDebug('NPnote/findNotesMatchingHashtag', `- ${n.filename}: has hashtags [${String(correctedHashtags)}]`)
        if (alsoSearchMentions) {
          // $FlowIgnore[incompatible-call] only about $ReadOnlyArray
          return caseInsensitiveIncludes(tag, correctedHashtags) || caseInsensitiveIncludes(tag, n.mentions)
        } else {
          return caseInsensitiveIncludes(tag, correctedHashtags)
        }
      })
    } else {
      projectNotesWithTag = projectNotesInFolder.filter((n) => {
        const correctedHashtags = getCorrectedHashtagsFromNote(n)
        // if (correctedHashtags.length > 0) logDebug('NPnote/findNotesMatchingHashtag', `- ${n.filename}: has hashtags [${String(correctedHashtags)}]`)
        if (alsoSearchMentions) {
          return n.mentions.includes(tag) || correctedHashtags.includes(tag)
        } else {
          return correctedHashtags.includes(tag)
        }
      })
    }
    if (projectNotesWithTag.length > 0) {
      logDebug(
        'NPnote/findNotesMatchingHashtag',
        `In folder '${folder ?? '<all>'}' found ${projectNotesWithTag.length} notes matching '${tag}': [${String(projectNotesWithTag.map((a) => a.title ?? a.filename ?? '?'))}]`,
      )
    }

    // If we care about the excluded tag, then further filter out notes where it is found
    if (tagsToExclude.length > 0) {
      const doesNotMatchTagsToExclude = (e: string) => !tagsToExclude.includes(e)
      const projectNotesWithTagWithoutExclusion = projectNotesWithTag.filter((n) => n.hashtags.some(doesNotMatchTagsToExclude))
      const removedItems = projectNotesWithTag.length - projectNotesWithTagWithoutExclusion.length
      if (removedItems > 0) {
        // logDebug('NPnote/findNotesMatchingHashtag', `- but removed ${removedItems} excluded notes:`)
        // logDebug('NPnote/findNotesMatchingHashtag', `= ${String(projectNotesWithTag.filter((n) => n.hashtags.includes(tagToExclude)).map((m) => m.title))}`)
      }
      return projectNotesWithTagWithoutExclusion
    } else {
      return projectNotesWithTag
    }
  } catch (err) {
    logError('NPnote/findNotesMatchingHashtag', err.message)
    return []
  }
}

/**
 * Return array of array of notes with particular hashtags (plural), optionally from the given folder.
 * Note: Currently unused!
 * @author @jgclark
 *
 * @param {Array<string>} tags - tags to look for
 * @param {?string} folder - optional folder to limit to
 * @param {?boolean} includeSubfolders - if folder given, whether to look in subfolders of this folder or not (optional, defaults to false)
 * @return {Array<Array<TNote>>} array of list of notes
 */
export function findNotesMatchingHashtags(tags: Array<string>, folder: ?string, includeSubfolders: ?boolean = false): Array<Array<TNote>> {
  if (tags.length === 0) {
    logError('NPnote/findNotesMatchingHashtags', `No hashtags supplied. Stopping`)
    return []
  }

  let projectNotesInFolder: Array<TNote>
  // If folder given (not empty) then filter using it
  if (folder != null) {
    if (includeSubfolders) {
      // use startsWith as filter to include subfolders
      // TEST: does this need same update for root-level notes as findNotesMatchingHashtag() above?
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
  const projectNotesWithTags: Array<Array<TNote>> = [[]]
  for (const tag of tags) {
    // FIXME: need to change this to the hashtag-aware-includes
    const projectNotesWithTag = projectNotesInFolder.filter((n) => n.hashtags.includes(tag))
    // logDebug('NPnote/findNotesMatchingHashtags', `In folder '${folder ?? '<all>'}' found ${projectNotesWithTag.length} notes matching '${tag}'`)
    projectNotesWithTags.push(projectNotesWithTag)
  }
  return projectNotesWithTags
}
/**
 * Get list of headings from a note, optionally including markdown markers
 * @author @dwertheimer (adapted from @jgclark)
 *
 * @param {TNote} note - note to get headings from
 * @param {boolean} includeMarkdown - whether to include markdown markers in the headings
 * @param {boolean} optionAddATopAndtBottom - whether to add 'top of note' and 'bottom of note' options. Default: true.
 * @param {boolean} optionCreateNewHeading - whether to offer to create a new heading at top or bottom of note. Default: false.
 * @param {boolean} includeArchive - whether to include headings in the Archive section of the note (i.e. after 'Done'). Default: false.
 * @return {Array<string>}
 */
export function getHeadingsFromNote(
  note: TNote,
  includeMarkdown: boolean = false,
  optionAddATopAndtBottom: boolean = true,
  optionCreateNewHeading: boolean = false,
  includeArchive: boolean = false,
): Array<string> {
  let headingStrings = []
  const spacer = '#'
  let headingParas: Array<TParagraph> = []
  const indexEndOfActive = findEndOfActivePartOfNote(note)
  if (includeArchive) {
    headingParas = note.paragraphs.filter((p) => p.type === 'title' && p.lineIndex < indexEndOfActive)
  } else {
    headingParas = note.paragraphs.filter((p) => p.type === 'title')
  }
  if (headingParas.length > 0) {
    if (headingParas[0].content === note.title) {
      headingParas = headingParas.slice(1)
    }
  }
  if (headingParas.length > 0) {
    headingStrings = headingParas.map((p) => {
      let prefix = ''
      for (let i = 0; i < p.headingLevel; i++) {
        prefix += spacer
      }
      return `${prefix} ${p.content}`
    })
  }
  if (optionCreateNewHeading) {
    if (note.type === 'Calendar') {
      headingStrings.unshift('➕#️⃣ (first insert new heading at the start of the note)')
    } else {
      headingStrings.unshift(`➕#️⃣ (first insert new heading under the title)`)
    }
    headingStrings.push(`➕#️⃣ (first insert new heading at the end of the note)`)
  }
  if (optionAddATopAndtBottom) {
    headingStrings.unshift('⏫ (top of note)')
    headingStrings.push('⏬ (bottom of note)')
  }
  if (headingStrings.length === 0) {
    return ['']
  }
  if (!includeMarkdown) {
    headingStrings = headingStrings.map((h) => h.replace(/^#{1,5}\s*/, '')) // remove any markdown heading markers
  }
  return headingStrings
}
