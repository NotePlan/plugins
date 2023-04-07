// @flow
//-------------------------------------------------------------------------------
// Note-level Functions that require NP API calls

// import moment from 'moment/min/moment-with-locales'
import {
  calcOffsetDateStrUsingCalendarType,
  getTodaysDateHyphenated,
  isValidCalendarNoteDateStr,
  RE_OFFSET_DATE,
  RE_OFFSET_DATE_CAPTURE,
} from '@helpers/dateTime'
import { JSP, log, logError, logDebug, timer, clo } from '@helpers/dev'
import { getFilteredFolderList, getFolderFromFilename } from '@helpers/folders'
import { ensureFrontmatter } from '@helpers/NPFrontMatter'
import { findStartOfActivePartOfNote } from '@helpers/paragraph'
import { getBlockUnderHeading } from '@helpers/NPParagraph'
import { showMessage } from '@helpers/userInput'

const pluginJson = 'NPnote.js'

//-------------------------------------------------------------------------------

/**
 * Get a note's filename from (in order):
 * - its title (for a project note)
 * - for date intervals '{+/-N[dwmqy}' calculate the date string relative to today
 * - for calendar notes, from it's date string
 * @param {string} title of project note, or NotePlan's (internal) calendar date string
 * @returns {string} filename of note if found, or null
 */
export function getNoteFilenameFromTitle(titleIn: string): string | null {
  let thisFilename = ''
  const possibleProjectNotes = DataStore.projectNoteByTitle(titleIn) ?? []
  if (possibleProjectNotes.length > 0) {
    thisFilename = possibleProjectNotes[0].filename
    logDebug('NPnote/getNoteFilenameFromTitle', `-> found project note '${thisFilename}'`)
    return thisFilename
  }
  // Not a project note, so look at calendar notes
  let dateString = titleIn
  if (new RegExp(RE_OFFSET_DATE).test(dateString)) {
    // this is a date interval, so -> date string relative to today
    const thisOffset = dateString.match(new RegExp(RE_OFFSET_DATE_CAPTURE))[1]
    dateString = calcOffsetDateStrUsingCalendarType(thisOffset)
    logDebug('NPnote/getNoteFilenameFromTitle', `found offset date ${thisOffset} -> '${dateString}'`)
  }
  if (isValidCalendarNoteDateStr(dateString)) {
    const thisNote = DataStore.calendarNoteByDateString(dateString)
    if (thisNote) {
      thisFilename = thisNote.filename
      logDebug('NPnote/getNoteFilenameFromTitle', `-> found calendar note '${thisFilename}' from ${dateString}`)
      return thisFilename
    } else {
      logError('NPnote/getNoteFilenameFromTitle', `${dateString} doesn't seem to have a calendar note?`)
    }
  } else {
    logError('NPnote/getNoteFilenameFromTitle', `${dateString} is not a valid date string`)
  }
  logError('NPnote/getNoteFilenameFromTitle', `-> no note found for '${titleIn}'`)
  return null
}

/**
 * Return array of all project notes, excluding those in list of folders to exclude, and (if requested) from special '@...' folders
 * @author @jgclark
 * @param {Array<string>} foldersToExclude
 * @param {boolean} excludeSpecialFolders
 * @returns {Array<TNote>} wanted notes
 */
export function projectNotesFromFilteredFolders(foldersToExclude: Array<string>, excludeSpecialFolders: boolean): Array<TNote> {
  // Get list of wanted folders
  const filteredFolders = getFilteredFolderList(foldersToExclude, excludeSpecialFolders)

  // Iterate over all project notes and keep the notes in the wanted folders ...
  const allProjectNotes = DataStore.projectNotes
  const projectNotesToInclude = []
  for (const pn of allProjectNotes) {
    const thisFolder = getFolderFromFilename(pn.filename)
    if (filteredFolders.includes(thisFolder)) {
      projectNotesToInclude.push(pn)
    } else {
      // logDebug(pluginJson, `  excluded note '${pn.filename}'`)
    }
  }
  return projectNotesToInclude
}

/**
 * Convert the note to using frontmatter Syntax
 * If optional default text is given, this is added to the frontmatter.
 * @author @jgclark
 * @param {TNote} note
 */
export async function convertNoteToFrontmatter(note: TNote): Promise<void> {
  try {
    let thisNote: TNote
    if (note == null) {
      if (Editor == null) {
        logError('note/convertNoteToFrontmatter', `No Editor found, so nothing to convert.`)
        await showMessage(`No note open to convert.`)
        return
      } else {
        // $FlowFixMe[incompatible-type]
        thisNote = Editor.note
      }
    } else {
      thisNote = note
    }
    if (!thisNote) {
      logDebug('note/convertNoteToFrontmatter', `No note supplied, and can't find Editor either.`)
      await showMessage(`No note supplied, and can't find Editor either.`)
      return
    }
    const res = ensureFrontmatter(thisNote)
    logDebug('note/convertNoteToFrontmatter', `ensureFrontmatter() returned ${String(res)}.`)
  }
  catch (error) {
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
  if (Editor.content && Editor.note) {
    // $FlowFixMe[incompatible-call]
    for (let i = findStartOfActivePartOfNote(Editor.note); i < Editor.paragraphs.length; i++) {
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
    return note.paragraphs.filter((p) => p.type === 'open' && (includeAllTodos || isTodayItem(p.content)))
  }
  logDebug(`findOpenTodosInNote could not find note.paragraphs. returning empty array`)
  return []
}

/**
 * Get the paragraphs in the note which are tagged for today (or this week) that may not actually be in the current note.
 * @author @dwertheimer extended by @jgclark
 * @param {CoreNoteFields} calendar note to look for links to (the note or Editor)
 * @param {CoreNoteFields} includeHeadings? (default to true for backwards compatibility)
 * @returns {Array<TParagraph>} - paragraphs which reference today in some way
 */
export function getReferencedParagraphs(note: Note, includeHeadings: boolean = true): Array<TParagraph> {
  const thisDateStr = note.title || '' // will be  2022-10-10 or 2022-10 or 2022-Q3 etc depending on the note type
  const wantedParas = []

  // Use .backlinks, which is described as "Get all backlinks pointing to the current note as Paragraph objects. In this array, the toplevel items are all notes linking to the current note and the 'subItems' attributes (of the paragraph objects) contain the paragraphs with a link to the current note. The headings of the linked paragraphs are also listed here, although they don't have to contain a link."
  // Note: @jgclark reckons that the subItem.headingLevel data returned by this might be wrong.
  const backlinks: $ReadOnlyArray<TParagraph> = [...note.backlinks] // an array of notes which link to this note
  // clo(backlinks, `getReferencedParagraphs backlinks (${backlinks.length}) =`)

  backlinks.forEach((link) => {
    // $FlowIgnore[prop-missing] -- subItems is not in Flow defs but is real
    const subItems = link.subItems
    subItems.forEach((subItem) => {
      // subItem.title = link.content.replace('.md', '').replace('.txt', '') // changing the shape of the Paragraph object will cause ObjC errors // cannot do this

      // If we want to filter out the headings, then check the subItem content actually includes the date of the note of interest.
      if (includeHeadings || subItem.content.includes(`>${thisDateStr}`) || subItem.content.includes(`>today`)) {
        // logDebug(`getReferencedParagraphs`, `- adding "${subItem.content}" as it includes >${thisDateStr} or >today`)
        wantedParas.push(subItem)
      } else {
        // logDebug(`getReferencedParagraphs`, `- skipping "${subItem.content}" as it doesn't include >${thisDateStr}`)
      }
    })
  })
  logDebug(`getReferencedParagraphs`, `"${note.title || ''}" has backlinks.length:${backlinks.length} & wantedParas.length:${wantedParas.length}`)
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

export type OpenNoteOptions = $Shape<{
  newWindow?: boolean,
  splitView?: boolean,
  highlightStart?: number,
  highlightEnd?: number,
  createIfNeeded?: boolean,
  content?: string,
}>

/**
 * Convenience Method for Editor.openNoteByFilename, include only the options you care about (requires NP v3.7.2+)
 * @param {string} filename - Filename of the note file (can be without extension), but has to include the relative folder such as `folder/filename.txt`
 * @param {OpenNoteOptions} options - options for opening the note (all optional -- see fields in type)
 * @returns {Promise<TNote|void>} - the note that was opened
 */
export async function openNoteByFilename(filename: string, options: OpenNoteOptions = {}): Promise<TNote | void> {
  // $FlowFixMe[incompatible-call]
  return await Editor.openNoteByFilename(
    filename,
    options.newWindow || false,
    options.highlightStart || 0,
    options.highlightEnd || 0,
    options.splitView || false,
    options.createIfNeeded || false,
    options.content || null,
  )
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
