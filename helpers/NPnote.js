// @flow
//-------------------------------------------------------------------------------
// Note-level Functions that require NP API calls
//-------------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { getBlockUnderHeading } from './NPParagraph'
import { isOpen } from '@helpers/utils'
import { getTodaysDateHyphenated } from '@helpers/dateTime'
// import { getNPWeekData } from '@helpers/NPdateTime'
import { clo, JSP, logDebug, logError, logWarn, timer } from '@helpers/dev'
import { getFilteredFolderList, getFolderFromFilename } from '@helpers/folders'
import { ensureFrontmatter } from '@helpers/NPFrontMatter'
// import { displayTitle } from '@helpers/general'
import { findStartOfActivePartOfNote } from '@helpers/paragraph'
import { showMessage } from '@helpers/userInput'
import { setFrontMatterVars } from './NPFrontMatter'
import { isScheduled } from './dateTime'

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
 * @param {TNote} note to convert
 * @param {string?} defaultFMText to add to frontmatter if supplied
 * @returns {boolean} success?
 */
export async function convertNoteToFrontmatter(note: TNote, defaultFMText: string = ''): Promise<void> {
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
    await showMessage(error.message)
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
    return note.paragraphs.filter((p) => isOpen(p) && (isTodayItem(p.content) || (includeAllTodos && !isScheduled(p.content))))
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

/**
 * Return list of all notes changed in the last 'numDays'.
 * Set 'noteTypesToInclude' to just ['Notes'] or ['Calendar'] to include just those note types
 * Edge case: if numDays === 0 return all Calendar and Project notes
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
    if (numDays > 0) {
      const todayStart = new moment().startOf('day') // use moment instead of `new Date` to ensure we get a date in the local timezone
      const momentToStartLooking = todayStart.subtract(numDays, 'days')
      const jsdateToStartLooking = momentToStartLooking.toDate()

      matchingNotes = allNotesToCheck.filter((f) => f.changedDate >= jsdateToStartLooking)
      logDebug(
        'getNotesChangedInInterval',
        `from ${allNotesToCheck.length} notes of type ${String(noteTypesToInclude)} found ${matchingNotes.length} changed after ${String(momentToStartLooking)}`,
      )
    } else {
      matchingNotes = allNotesToCheck
      logDebug('getNotesChangedInInterval', `returning all ${allNotesToCheck.length} notes`)
    }
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

    let matchingNotes: Array<TNote> = notesToCheck.filter((f) => f.changedDate >= jsdateToStartLooking)
    // logDebug('getNotesChangedInInterval', `from ${notesToCheck.length} notes found ${matchingNotes.length} changed after ${String(momentToStartLooking)}`)
    return matchingNotes
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return [] // for completeness
  }
}
