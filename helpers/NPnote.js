// @flow
//-------------------------------------------------------------------------------
// Note-level Functions that require NP API calls

import moment from 'moment'
import { getTodaysDateHyphenated, WEEK_NOTE_LINK } from '@helpers/dateTime'
import { getNPWeekData } from '@helpers/NPdateTime'
import { log, logError, logDebug, timer, clo } from '@helpers/dev'
import { getFilteredFolderList, getFolderFromFilename } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { findStartOfActivePartOfNote } from '@helpers/paragraph'
import { showMessage } from '@helpers/userInput'
import { getBlockUnderHeading } from './NPParagraph'

const pluginJson = 'NPnote.js'

//-------------------------------------------------------------------------------
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
 * @param {string} defaultText (optional) to add after title in the frontmatter
 */
export async function convertNoteToFrontmatter(note: TNote, defaultText?: string = ''): Promise<void> {
  if (note == null) {
    logError('note/convertToFrontmatter', `No note found. Stopping conversion.`)
    await showMessage(`No note found to convert.`)
    return
  }
  if (note.paragraphs.length < 1) {
    logError('note/convertToFrontmatter', `'${displayTitle(note)}' is empty. Stopping conversion.`)
    await showMessage(`Cannot convert '${displayTitle(note)}' note as it is empty.`)
    return
  }

  // Get title
  const firstLine = note.paragraphs[0]
  if (firstLine.content === '---') {
    logError('note/convertToFrontmatter', `'${displayTitle(note)}' appears to already use frontmatter. Stopping conversion.`)
    await showMessage(`Cannot convert '${displayTitle(note)}' as it already appears to use frontmatter.`)
    return
  }
  const title = firstLine.content ?? '(error)' // gets heading without markdown

  // Working backwards through the frontmatter (to make index addressing easier)
  // Change the current first line to be ---
  firstLine.content = '---'
  firstLine.type = 'separator'
  note.updateParagraph(firstLine)
  if (defaultText) {
    note.insertParagraph(defaultText, 0, 'text')
  }
  note.insertParagraph(`title: ${title}`, 0, 'text')
  note.insertParagraph('---', 0, 'separator')
  logDebug('note/convertToFrontmatter', `Note '${displayTitle(note)}' converted to use frontmatter.`)
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
 * @param {TNote} note
 * @param {boolean} includeAllTodos - whether to include all open todos, or just those tagged for today
 * @returns {Array<TParagraph>} of paragraphs which are open or open+tagged for today
 */
export function findOpenTodosInNote(note: TNote, includeAllTodos: boolean = false): Array<TParagraph> {
  const hyphDate = getTodaysDateHyphenated()
  // const toDate = getDateObjFromDateTimeString(hyphDate)
  const isTodayItem = (text) => [`>${hyphDate}`, '>today'].filter((a) => text.indexOf(a) > -1).length > 0
  // const todos:Array<TParagraph>  = []
  if (note.paragraphs) {
    return note.paragraphs.filter((p) => p.type === 'open' && (includeAllTodos || isTodayItem(p.content)))
  }
  logDebug(`findOpenTodosInNote could not find note.paragraphs. returning empty array`)
  return []
}

/**
 * Get the paragraphs in the note which are tagged for today (or this week) that may not actually be in the current note
 * @param {CoreNoteFields} note (the note or Editor)
 * @returns {Array<TParagraph>} - paragraphs which reference today in some way
 */
export function getReferencedParagraphs(note: CoreNoteFields): Array<TParagraph> {
  // getReferencedParagraphs: aliases: backlinks, references
  // $FlowIgnore Flow(prop-missing) -- backlinks is not in Flow defs but is real
  const backlinks: Array<TParagraph> = [...note.backlinks] // an array of notes which link to this note
  logDebug(pluginJson, `${note.filename}: backlinks.length:${backlinks.length}`)
  // clo(backlinks, `getTodaysReferences backlinks:${backlinks.length}=`)
  const todayParas = []
  backlinks.forEach((link) => {
    // $FlowIgnore Flow(prop-missing) -- subItems is not in Flow defs but is real
    const subItems = link.subItems
    subItems.forEach((subItem) => {
      // subItem.title = link.content.replace('.md', '').replace('.txt', '') // changing the shape of the Paragraph object will cause ObjC errors // cannot do this
      todayParas.push(subItem)
    })
  })
  return todayParas
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

/**
 * Determines whether a line is overdue or not. A line with multiple dates is only overdue if all dates are overdue.
 * Finds >weekDates in a string and returns an array of the dates found if all dates are overdue (or an empty array)
 * NOTE: this function calls getNPWeekData which requires a Calendar mock to Jest test it
 * @author @dwertheimer
 * @param {string} line
 * @returns foundDates - array of dates found TODO(@dwertheimer): can you please be more explicit about type of dates found -- they're strings but what format strings?
 * @testsExist yes
 */
export function findOverdueWeeksInString(line: string): Array<string> {
  const weekData = getNPWeekData(moment().toDate())
  const dates = line.match(new RegExp(WEEK_NOTE_LINK, 'g'))
  if (dates && weekData) {
    const overdue = dates.filter((d) => d.slice(1) < weekData.weekString)
    return overdue.length === dates.length ? overdue.sort() : [] // if all dates are overdue, return them sorted
  }
  return []
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
  const block = getBlockUnderHeading(Editor, content, true)
  if (block?.length) {
    const contentRange = Range.create(block[0].contentRange?.start, block[block.length - 1].contentRange?.end)
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
