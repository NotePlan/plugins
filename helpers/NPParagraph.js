// @flow

import moment from 'moment/min/moment-with-locales'
import { TASK_TYPES } from './sorting'
import { trimString } from '@helpers/dataManipulation'
import {
  getAPIDateStrFromDisplayDateStr,
  getNPWeekStr,
  getTodaysDateHyphenated,
  getTodaysDateUnhyphenated,
  hyphenatedDate,
  hyphenatedDateString,
  isScheduled,
  nowShortDateTimeISOString,
  replaceArrowDatesInString,
  RE_SCHEDULED_ISO_DATE,
  SCHEDULED_WEEK_NOTE_LINK,
  SCHEDULED_QUARTERLY_NOTE_LINK,
  SCHEDULED_MONTH_NOTE_LINK,
  SCHEDULED_YEARLY_NOTE_LINK,
  WEEK_NOTE_LINK,
} from '@helpers/dateTime'
import { displayTitle } from '@helpers/general'
import { getNPWeekData, getMonthData, getYearData, getQuarterData, toLocaleDateTimeString } from '@helpers/NPdateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { getNoteType } from '@helpers/note'
import { findStartOfActivePartOfNote, isTermInMarkdownPath, isTermInURL, smartPrependPara } from '@helpers/paragraph'
import { RE_FIRST_SCHEDULED_DATE_CAPTURE } from '@helpers/regex'
import { getLineMainContentPos } from '@helpers/search'
import { hasScheduledDate, isOpen } from '@helpers/utils'

const pluginJson = 'NPParagraph'

/**
 * Remove all headings (type=='title') from a note matching the given text
 * @author @dwertheimer
 * @param {CoreNoteFields} note
 * @param {string} headingStr - the heading text to look for
 * @param {boolean} search rawText (headingStr above includes the #'s etc) default=false
 * @returns {void}
 */
export function removeHeadingFromNote(note: CoreNoteFields, headingStr: string, rawTextSearch: boolean = false) {
  const prevExists = note.paragraphs.filter((p) => (p.type === 'title' && rawTextSearch ? p.rawContent === headingStr : p.content === headingStr))
  if (prevExists.length) {
    note.removeParagraphs(prevExists)
  }
}

/**
 * Given a paragraph object, delete all the content of the block containing this paragraph.
 * See getParagraphBlock below for definition of what constitutes a block an definition of includeFromStartOfSection.
 * Optionally leave the title in place.
 * @author @dwertheimer
 * @param {CoreNoteFields} note
 * @param {TParagraph} para
 * @param {boolean} includeFromStartOfSection (default: false)
 * @param {boolean} keepHeading (default: true)
 */
export function deleteEntireBlock(note: CoreNoteFields, para: TParagraph, includeFromStartOfSection: boolean = false, keepHeading: boolean = true): void {
  const paraBlock: Array<TParagraph> = getParagraphBlock(note, para.lineIndex, includeFromStartOfSection)
  logDebug(`NPParagraph/deleteEntireBlock`, `Removing ${paraBlock.length} items under ${para.content}`)
  keepHeading ? paraBlock.shift() : null
  if (paraBlock.length > 0) {
    note.removeParagraphs(paraBlock) //seems to not work only if it's a note, not Editor
    logDebug(`NPParagraph/deleteEntireBlock`, `Removed ${paraBlock.length} items under ${para.content} (from line ${para.lineIndex})`)
    // note.updateParagraphs(paraBlock)
  } else {
    logDebug(`NPParagraph/deleteEntireBlock`, `No paragraphs to remove under ${para.content} (line # ${para.lineIndex})`)
  }
}

/**
 * Given a heading (string), delete all the content of the block under this heading (optionally and the heading also)
 * See getParagraphBlock below for definition of what constitutes a block an definition of includeFromStartOfSection
 * (Note: if the heading occurs more than once, acts on the first one only)
 * @author @mikeerickson
 * @param {CoreNoteFields} note
 * @param {string} heading
 * @param {boolean} includeFromStartOfSection (default: false)
 * @param {boolean} keepHeading - keep the heading after deleting contents (default: true)
 */
export function removeContentUnderHeading(note: CoreNoteFields, heading: string, includeFromStartOfSection: boolean = false, keepHeading: boolean = true) {
  // logDebug(`NPParagraph/removeContentUnderHeading`, `In '${note.title ?? ''}' remove items under title: "${heading}"`)
  const paras = note.paragraphs.find((p) => p.type === 'title' && p.content.includes(heading))
  if (paras && paras.lineIndex != null) {
    deleteEntireBlock(note, paras, includeFromStartOfSection, keepHeading)
    logDebug(`NPParagraph/removeContentUnderHeading`, `Note now has ${note.paragraphs.length} lines`)
    // for (const p of note.paragraphs) {
    //   logDebug('NPParagraph / removeContentUnderHeading', `- ${p.lineIndex}: ${p.rawContent}`)
    // }
  } else {
    logWarn(`NPParagraph/removeContentUnderHeading`, `Did not find heading: "${heading}", so nothing removed.`)
  }
}

/**
 * Insert text content under a given section heading.
 * If section heading is not found, then insert that section heading first at the start of the note.
 * The 'headingToFind' uses a startsWith not exact match, to allow datestamps or number of results etc. to be used in headings
 * @author @mikeerickson
 * @param {CoreNoteFields} destNote
 * @param {string} headingToFind - without leading #
 * @param {string} parasAsText - text to insert (multiple lines, separated by newlines)
 * @param {number} headingLevel of the heading to insert where necessary (1-5, default 2)
 */
export function insertContentUnderHeading(destNote: CoreNoteFields, headingToFind: string, parasAsText: string, headingLevel: number = 2) {
  logDebug(`NPParagraph/insertContentUnderHeading`, `Called for '${headingToFind}' with ${parasAsText.split('\n').length} paras)`)
  const headingMarker = '#'.repeat(headingLevel)
  const startOfNote = findStartOfActivePartOfNote(destNote)
  let insertionIndex = startOfNote // top of note by default
  for (let i = 0; i < destNote.paragraphs.length; i++) {
    const p = destNote.paragraphs[i]
    if (p.content.trim().startsWith(headingToFind) && p.type === 'title') {
      insertionIndex = i + 1
      break
    }
  }
  logDebug(`NPParagraph/insertContentUnderHeading`, `insertionIndex = ${insertionIndex} (startOfNote = ${startOfNote})`)
  // If we didn't find the heading, insert at the top of the note
  const paraText = insertionIndex === startOfNote && headingToFind !== '' ? `${headingMarker} ${headingToFind}\n${parasAsText}\n` : parasAsText
  destNote.insertParagraph(paraText, insertionIndex, 'text')
}

/**
 * Replace content under a given heading.
 * See getParagraphBlock below for definition of what constitutes a block an definition of includeFromStartOfSection.
 * @param {CoreNoteFields} note
 * @param {string} heading
 * @param {string} newContentText - text to insert (multiple lines, separated by newlines)
 * @param {boolean} includeFromStartOfSection
 * @param {number} headingLevel of the heading to insert where necessary (1-5, default 2)
 */
export async function replaceContentUnderHeading(
  note: CoreNoteFields,
  heading: string,
  newContentText: string,
  includeFromStartOfSection: boolean = false,
  headingLevel: number = 2,
) {
  logDebug(`NPParagraph / replaceContentUnderHeading`, `In '${note.title ?? 'Untitled Note'}' replace items under heading: "${heading}"`)
  removeContentUnderHeading(note, heading, includeFromStartOfSection)
  await insertContentUnderHeading(note, heading, newContentText, headingLevel)
}

/**
 * Get the set of paragraphs that make up this block based on the current paragraph.
 * This is how we identify the block:
 * - current line, plus any children (indented paragraphs) that directly follow it
 * - if this line is a heading, then the current line and its following section
 * - if 'useTightBlockDefinition' is false (the default), then section finishes at the next same-level heading
 * - if 'useTightBlockDefinition' is true, then section finishes at the next empty line, same-level heading or horizontal line.
 *
 * If 'includeFromStartOfSection' is true (and it is by default false), then it can include more lines, working as if the cursor is on the preceding heading line, and then using the same rules as above.
 * - Note: the title line of a note is not included in 'includeFromStartOfSection', as it makes no sense to move the title of a note.
 * @author @jgclark
 * @tests available in jest file
 *
 * @param {Array<TParagraph>} allParas - all selectedParas in the note
 * @param {number} selectedParaIndex - the index of the current Paragraph
 * @param {boolean} includeFromStartOfSection
 * @param {boolean} useTightBlockDefinition
 * @returns {Array<TParagraph>} the set of selectedParagraphs in the block
 */
export function getParagraphBlock(
  note: CoreNoteFields,
  selectedParaIndex: number,
  includeFromStartOfSection: boolean = false,
  useTightBlockDefinition: boolean = false,
): Array<TParagraph> {
  const parasInBlock: Array<TParagraph> = [] // to hold set of paragraphs in block to return
  const startActiveLineIndex = findStartOfActivePartOfNote(note)
  const allParas = note.paragraphs
  const lastLineIndex = allParas.length - 1
  let startLine = selectedParaIndex
  let selectedPara = allParas[startLine]
  logDebug(
    `NPParagraph / getParagraphBlock`,
    `Starting at lineIndex ${selectedParaIndex} with start active/last line = ${startActiveLineIndex}/${lastLineIndex} with ${String(includeFromStartOfSection)}/${String(
      useTightBlockDefinition,
    )}: '${trimString(selectedPara.content, 50)}'`,
  )

  if (includeFromStartOfSection) {
    // First look earlier to find earlier lines up to a blank line or horizontal rule;
    // include line unless we hit a new heading, an empty line, or a less-indented line.
    for (let i = selectedParaIndex; i >= startActiveLineIndex; i--) {
      const p = allParas[i]
      // logDebug(`NPParagraph / getParagraphBlock`, `  ${i} / ${p.type} / ${trimString(p.content, 50)}`)
      if (p.type === 'separator') {
        // logDebug(`NPParagraph / getParagraphBlock`, `   - ${i}: Found separator line`)
        startLine = i + 1
        break
      } else if (p.content === '') {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found blank line`)
        startLine = i + 1
        break
      } else if (p.type === 'title' && p.headingLevel === 1) {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found title`)
        startLine = i + 1
        break
      } else if (p.type === 'title' && p.headingLevel > 1) {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found other heading`)
        startLine = i
        break
      }
      // If it's the last iteration and we get here, then we had a continuous block, so make that
      if (i === startActiveLineIndex) {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found start of active part of note`)
        startLine = i
      }
    }
    // logDebug(`NPParagraph / getParagraphBlock`, `For includeFromStartOfSection worked back and will now start at line ${startLine}`)
  }
  selectedPara = allParas[startLine]

  // if the first line is a heading, find the rest of its section
  if (selectedPara.type === 'title') {
    // includes all heading levels
    const thisHeadingLevel = selectedPara.headingLevel
    // logDebug(`NPParagraph / getParagraphBlock`, `- Block starts line ${startLine} at heading '${selectedPara.content}' level ${thisHeadingLevel}`)
    parasInBlock.push(selectedPara) // make this the first line to move
    // Work out how far this section extends. (NB: headingRange doesn't help us here.)
    // logDebug(`NPParagraph / getParagraphBlock`, `- Scanning forward through rest of note ...`)
    for (let i = startLine + 1; i <= lastLineIndex; i++) {
      const p = allParas[i]
      if (p.type === 'title' && p.headingLevel <= thisHeadingLevel) {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found new heading of same or higher level: "${p.content}" -> stopping`)
        break
      } else if (useTightBlockDefinition && p.type === 'separator') {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found HR: "${p.content}" -> stopping`)
        break
      } else if (useTightBlockDefinition && p.content === '') {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found blank line -> stopping`)
        break
      }
      // logDebug(`NPParagraph / getParagraphBlock`, `  - Adding to results: line[${i}]: ${p.type}: "${trimString(p.content, 50)}"`)
      parasInBlock.push(p)
    }
    // logDebug(`NPParagraph / getParagraphBlock`, `- Found ${parasInBlock.length} heading section lines`)
  } else {
    // This isn't a heading
    const startingIndentLevel = selectedPara.indents
    // logDebug(`NPParagraph / getParagraphBlock`, `Found single line with indent level ${startingIndentLevel}. Now scanning forward through rest of note ...`)
    parasInBlock.push(selectedPara)

    // See if there are following indented lines to move as well
    for (let i = startLine + 1; i <= lastLineIndex; i++) {
      const p = allParas[i]
      // logDebug(`NPParagraph / getParagraphBlock`, `  ${i} / indent ${p.indents} / ${trimString(p.content, 50)}`)
      if (useTightBlockDefinition && p.type === 'separator') {
        // stop if horizontal line
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found HR -> stopping`)
        break
      } else if (useTightBlockDefinition && p.content === '') {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found blank line -> stopping`)
        break
      } else if (p.type === 'title') {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found heading -> stopping`)
        break
      } else if (p.indents < startingIndentLevel && !includeFromStartOfSection) {
        // if we aren't using the Tight Block Definition, then
        // stop as this selectedPara is less indented than the starting line
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found same or lower indent -> stopping`)
        break
      }
      parasInBlock.push(p) // add onto end of array
    }
  }

  logDebug(`NPParagraph / getParagraphBlock`, `  - Found ${parasInBlock.length} paras in block starting with: "${parasInBlock[0].content}"`)
  // for (const pib of parasInBlock) {
  //   // logDebug(`NPParagraph / getParagraphBlock`, `  ${pib.content}`)
  // }
  return parasInBlock
}

/**
 * Get the paragraphs beneath a title/heading in a note (optionally return the contents without the heading)
 * It uses getParagraphBlock() which won't return the title of a note in the first block.
 * TODO(@jgclark): this really needs a global setting for the two getParagraphBlock() settings that are currently fixed below.
 * Note: Moved from helpers/paragraph.js to avoid circular depdency problem with getParagraphBlock()
 * @author @dwertheimer
 * @tests available in jest file
 * @param {TNote} note
 * @param {TParagraph | string} heading
 * @param {boolean} returnHeading - whether to return the heading or not with the results (default: true)
 * @returns {TParagraph | null} - returns
 */
export function getBlockUnderHeading(note: CoreNoteFields, heading: TParagraph | string, returnHeading: boolean = true): Array<TParagraph> {
  let headingPara = null
  if (typeof heading === 'string') {
    headingPara = findHeading(note, heading)
  } else {
    headingPara = heading
  }
  let paras: Array<TParagraph> = []
  if (headingPara?.lineIndex != null) {
    // TODO(@jgclark): should use global settings here, not fixed as
    paras = getParagraphBlock(note, headingPara.lineIndex, true, true)
    // logDebug('getBlockUnderHeading', `= ${paras.length},${paras[0].type},${paras[0].headingLevel}`)
  }
  if (paras.length && paras[0].type === 'title' && !returnHeading) {
    paras.shift() //remove the heading paragraph
  }
  return paras
}

/**
 * Return list of lines matching the specified string in the specified project or daily notes.
 * NB: If starting now, I would try to use a different return type, probably tuples not 2 distinct arrays.
 * @author @jgclark
 *
 * @param {array} notes - array of Notes to look over
 * @param {string} stringToLookFor - string to look for
 * @param {boolean} highlightResults - whether to enclose found string in ==highlight marks==
 * @param {string} dateStyle - where the context for an occurrence is a date, does it get appended as a 'date' using your locale, or as a NP date 'link' (`> date`) or 'none'
 * @param {boolean} matchCase - whether to search case insensitively (default: false)
 * @returns [Array<string>, Array<string>] - tuple of array of lines with matching term, and array of contexts for those lines (dates for daily notes; title for project notes).
 */
export async function gatherMatchingLines(
  notes: Array<TNote>,
  stringToLookFor: string,
  highlightResults: boolean = true,
  dateStyle: string = 'link',
  matchCase: boolean = false,
  matchOnWordBoundaries: boolean = true,
): Promise<[Array<string>, Array<string>]> {
  logDebug('NPParagraph/gatherMatchingLines', `Looking for '${stringToLookFor}' in ${notes.length} notes`)

  CommandBar.showLoading(true, `Searching in ${notes.length} notes ...`)
  await CommandBar.onAsyncThread()

  const matches: Array<string> = []
  const noteContexts: Array<string> = []
  let i = 0
  const startDT = new Date()
  for (const n of notes) {
    i += 1
    const noteContext =
      n.date == null
        ? `[[${n.title ?? ''}]]`
        : dateStyle.startsWith('link') // to deal with earlier typo where default was set to 'links'
        ? // $FlowIgnore(incompatible-call)
          ` > ${hyphenatedDate(n.date)} `
        : dateStyle === 'date'
        ? // $FlowIgnore(incompatible-call)
          ` (${toLocaleDateTimeString(n.date)})`
        : dateStyle === 'at'
        ? // $FlowIgnore(incompatible-call)
          ` @${hyphenatedDate(n.date)} `
        : ''

    // set up regex for searching, now with word boundaries on either side
    // find any matches
    const stringToLookForWithDelimiters = matchOnWordBoundaries ? `[\\b\\s\\^]${stringToLookFor}[\\b\\s\\$]` : stringToLookFor
    const re = matchCase ? new RegExp(stringToLookForWithDelimiters) : new RegExp(stringToLookForWithDelimiters, 'i')
    const matchingParas = n.paragraphs.filter((q) => re.test(q.content))
    for (const p of matchingParas) {
      let matchLine = p.content
      // If the test is within a URL or the path of a [!][link](path) skip this result
      if (isTermInURL(stringToLookFor, matchLine)) {
        logDebug('NPParagraph/gatherMatchingLines', `- Info: Match '${stringToLookFor}' ignored in '${matchLine} because it's in a URL`)
        continue
      }
      if (isTermInMarkdownPath(stringToLookFor, matchLine)) {
        logDebug('NPParagraph/gatherMatchingLines', `- Info: Match '${stringToLookFor}' ignored in '${matchLine} because it's in a [...](path)`)
        continue
      }
      // If the stringToLookFor is in the form of an 'attribute::' and found at the start of a line,
      // then remove it from the output line
      if (stringToLookFor.endsWith('::') && matchLine.startsWith(stringToLookFor)) {
        matchLine = matchLine.replace(stringToLookFor, '') // NB: only removes first instance
      }
      // Highlight matches if requested ... but we need to be smart about this:
      // don't do so if we're in the middle of a URL or the path of a [!][link](path)
      if (highlightResults && !isTermInURL(stringToLookFor, matchLine) && !isTermInMarkdownPath(stringToLookFor, matchLine)) {
        matchLine = matchLine.replace(stringToLookFor, `==${stringToLookFor}== `)
      }
      matches.push(matchLine.trim())
      // logDebug('NPParagraph/gatherMatchingLines', `${n.title ?? ''}: ${matchLine}`)
      noteContexts.push(noteContext)
    }
    if (i % 50 === 0) {
      CommandBar.showLoading(true, `Searching in ${notes.length} notes ...`, i / notes.length)
    }
  }
  logDebug('NPParagraph/gatherMatchingLines', `... in ${timer(startDT)}`)
  await CommandBar.onMainThread()
  CommandBar.showLoading(false)

  return [matches, noteContexts]
}

/**
 * Get the paragraph index of the start of the current selection, or 0 if no selection is active.
 * @author @jgclark
 * @returns {number}
 */
export function getSelectedParaIndex(): number {
  const { paragraphs, selection } = Editor
  // Get current selection, and its range
  if (selection == null) {
    logWarn('NPParagraph/getSelectedParaIndex', `No selection found, so returning 0.`)
    return 0
  }
  const range = Editor.paragraphRangeAtCharacterIndex(selection.start)
  // logDebug('NPParagraph/getSelectedParaIndex', `  Cursor/Selection.start: ${rangeToString(range)}`)

  // Work out what selectedPara number(index) this selected selectedPara is
  let firstSelParaIndex = 0
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    if (p.contentRange?.start === range.start) {
      firstSelParaIndex = i
      break
    }
  }
  // logDebug('NPParagraph/getSelectedParaIndex', `  firstSelParaIndex = ${firstSelParaIndex}`)
  return firstSelParaIndex
}

/**
 * Get paragraph numbers of the start and end of a given note's range
 * @author @jgclark
 *
 * @param {TRange} selection - the current selection rnage object
 * @returns {[number, number]} the line index number of start and end of selection
 */
export function selectedLinesIndex(selection: TRange, paragraphs: $ReadOnlyArray<TParagraph>): [number, number] {
  let firstSelParaIndex = 0
  let lastSelParaIndex = 0
  const startParaRange: TRange = Editor.paragraphRangeAtCharacterIndex(selection.start)
  let endParaRange: TRange = Editor.paragraphRangeAtCharacterIndex(selection.end)
  // Deal with the edge case of highlighting a full line and Editor.paragraphRangeAtCharacterIndex(selection.end) incorrectly returns the next line
  if (endParaRange.start === endParaRange.end) {
    endParaRange = Editor.paragraphRangeAtCharacterIndex(selection.end - 1)
  }
  // clo(startParaRange, `selectedLinesIndex: startParaRange`)
  // clo(endParaRange, `selectedLinesIndex: endParaRange`)

  // Get the set of selected paragraphs (which can be different from selection),
  // and work out what selectedPara number(index) this selected selectedPara is
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    if (startParaRange.start === p.contentRange?.start) {
      firstSelParaIndex = i
      break
    }
  }
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const p = paragraphs[i]
    if (endParaRange.end >= (p.contentRange?.end ?? 0)) {
      lastSelParaIndex = i
      break
    }
  }
  if (lastSelParaIndex === 0) {
    lastSelParaIndex = firstSelParaIndex
  }
  // logDebug('selectedLinesIndex', `\t-> paraIndexes ${firstSelParaIndex}-${lastSelParaIndex}`)
  return [firstSelParaIndex, lastSelParaIndex]
}

/**
 * Check the block under a heading to see if it contains only synced copies
 * @param {CoreNoteFields} note
 * @param {boolean} runSilently
 * @returns
 */
export async function blockContainsOnlySyncedCopies(note: CoreNoteFields, showErrorToUser: boolean = false): Promise<boolean> {
  const heading = DataStore.settings.syncedCopiesTitle
  const block = getBlockUnderHeading(note, heading, false)
  // test every line of block and ensure every line contains a blockId
  if (block?.length) {
    for (const line of block) {
      if (line.blockId || line.type === 'empty') {
        continue
      } else {
        if (showErrorToUser) {
          await showMessage(
            `Non-synced items found in ${
              note.title || ''
            } under heading "${heading}". This function should only be run when the block under the heading contains only synced copies. Change your preference/settings so that the Synced Copies heading is distinct`,
            'OK',
            'Block under Heading Contains Non Synced Copies',
          )
        }
        logDebug(pluginJson, `Non-synced items found in ${note.title || ''} under heading "${heading}"!`)
        return false
      }
    }
  }
  return true
}

/**
 * Remove all previously written blocks under a given heading in all notes (e.g. for deleting previous "TimeBlocks" or "SyncedCopies")
 * WARNING: This is DANGEROUS. Could delete a lot of content. You have been warned!
 * @author @dwertheimer
 * @param {Array<string>} noteTypes - the types of notes to look in -- e.g. ['calendar','notes']
 * @param {string} heading - the heading too look for in the notes (without the #)
 * @param {boolean} keepHeading - whether to leave the heading in place afer all the content underneath is
 * @param {boolean} runSilently - whether to show CommandBar popups confirming how many notes will be affected - you should set it to 'yes' when running from a template
 */
export async function removeContentUnderHeadingInAllNotes(
  noteTypes: Array<string>,
  heading: string,
  keepHeading: boolean = false,
  runSilently: string = 'no',
  syncedOnly?: boolean,
): Promise<void> {
  try {
    logDebug(`NPParagraph`, `removeContentUnderHeadingInAllNotes "${heading}" in ${noteTypes.join(', ')}`)
    // For speed, let's first multi-core search the notes to find the notes that contain this string
    let prevCopies = await DataStore.search(heading, noteTypes) // returns all the potential matches, but some may not be headings
    prevCopies = prevCopies.filter((n) => n.type === 'title' && n.content === heading)
    if (prevCopies.length) {
      let res = 'Yes'
      if (!/yes/i.test(runSilently)) {
        res = await showMessageYesNo(`Remove "${heading}"+content in ${prevCopies.length} notes?`)
      }
      if (res === 'Yes') {
        prevCopies.forEach(async (paragraph) => {
          if (syncedOnly) {
            //FIXME: I am here need to call the check and bail -- something like the following line:
            if (!(await blockContainsOnlySyncedCopies(paragraph.note || Editor, true))) return
            clo(prevCopies, `removeContentUnderHeadingInAllNotes: prevCopies`)
          }
          if (paragraph.note != null) {
            await removeContentUnderHeading(paragraph.note, heading, false, keepHeading)
          }
        })
      }
    } else {
      if (!(runSilently === 'yes')) await showMessage(`Found no previous notes with "${heading}"`)
    }
    logDebug(`NPParagraph`, `removeContentUnderHeadingInAllNotes found ${prevCopies.length} previous ${String(noteTypes)} notes with heading: "${heading}"`)
  } catch (error) {
    logError(`NPParagraph`, `removeContentUnderHeadingInAllNotes error: ${JSP(error)}`)
  }
}

/**
 * COPY FROM helpers/paragaph.js to avoid a circular dependency
 */
export function findHeading(note: CoreNoteFields, heading: string, includesString: boolean = false): TParagraph | null {
  if (heading && heading !== '') {
    const paragraphs = note.paragraphs
    const para = paragraphs.find((paragraph) => paragraph.type === 'title' && (includesString ? paragraph.content.includes(heading) : paragraph.content.trim() === heading.trim()))

    if (para) return para
  }
  return null
}

/**
 * COPY FROM helpers/userInput.js to avoid a circular dependency
 */
async function showMessage(message: string, confirmButton: string = 'OK', dialogTitle: string = ''): Promise<void> {
  if (typeof CommandBar.prompt === 'function') {
    // i.e. do we have .textPrompt available?
    await CommandBar.prompt(dialogTitle, message, [confirmButton])
  } else {
    await CommandBar.showOptions([confirmButton], message)
  }
}

/**
 * COPY FROM helpers/userInput.js to avoid a circular dependency
 */
async function showMessageYesNo(message: string, choicesArray: Array<string> = ['Yes', 'No'], dialogTitle: string = ''): Promise<string> {
  let answer: number
  if (typeof CommandBar.prompt === 'function') {
    // i.e. do we have .textPrompt available?
    answer = await CommandBar.prompt(dialogTitle, message, choicesArray)
  } else {
    const answerObj = await CommandBar.showOptions(choicesArray, `${message}`)
    answer = answerObj.index
  }
  return choicesArray[answer]
}

/**
 * Search through the note for a paragraph containing a specific cursor position
 * @param {TNote} note - the note to look in
 * @param {number} position - the position to look for
 * @author @dwertheimer
 * @returns {TParagraph} the paragraph containing the position in question or null if not found
 */
export function getParagraphContainingPosition(note: CoreNoteFields, position: number): TParagraph | null {
  let foundParagraph = null
  const pluginJson = 'NPParagraph:getParagraphContainingPosition'
  note.paragraphs.forEach((p, i) => {
    if (typeof p.contentRange?.start === 'number' && typeof p.contentRange.end == 'number') {
      if (p.contentRange.start >= 0 && p.contentRange.end >= 0) {
        const { start, end } = p.contentRange || {}
        // logDebug(pluginJson, `NPParagraph::getParagraphContaining start:${start} end:${end}`)
        if (start <= position && end >= position) {
          foundParagraph = p
          // if (i > 0) {
          //   logDebug(
          //     pluginJson,
          //     `getParagraphContainingPosition: paragraph before: ${i - 1} (${String(note.paragraphs[i - 1].contentRange?.start)}-${String(
          //       note.paragraphs[i - 1]?.contentRange?.end || 'n/a',
          //     )}) - "${note.paragraphs[i - 1].content}"`,
          //   )
          // }
          logDebug(pluginJson, `getParagraphContainingPosition: found position ${position} in paragraph ${i} (${start}-${end}) -- "${p.content}"`)
        }
      }
    }
  })
  if (!foundParagraph) {
    if (position === 0 && note.paragraphs.length === 0) {
      note.prependParagraph('\n', 'empty') //can't add a line without a return
      if (Editor === note) {
        Editor.select(0, 0) //put the cursor before the return we just added
      }
      return note.paragraphs[0]
    }
    logDebug(pluginJson, `getParagraphContainingPosition: *** Looking for cursor position ${position}`)
    // note.paragraphs.forEach((p, i) => {
    //   const { start, end } = p.contentRange || {}
    //   // logDebug(pluginJson, `getParagraphContainingPosition: paragraph ${i} (${start}-${end}) "${p.content}"`)
    // })
    logDebug(pluginJson, `getParagraphContainingPosition: *** position ${position} not found`)
  }
  return foundParagraph
}

/**
 * Try to determine the paragraph that the cursor is in (in the Editor)
 * There are some NotePlan bugs that make this not work perfectly
 * @author @dwertheimer
 * @returns {TParagraph} the paragraph that the cursor is in or null if not found
 */
export async function getSelectedParagraph(): Promise<TParagraph | null> {
  // const thisParagraph = Editor.selectedParagraphs // recommended by @eduard but currently not reliable (Editor.selectedParagraphs is empty on a new line)
  let thisParagraph
  if (typeof Editor.selection?.start === 'number') {
    thisParagraph = getParagraphContainingPosition(Editor, Editor.selection.start)
  }
  if (!thisParagraph || !Editor.selection?.start) {
    logWarn(`NPParagraph`, `getSelectedParagraph: no paragraph found for cursor position Editor.selection?.start=${String(Editor.selection?.start)}`)
    await showMessage(`No paragraph found selection.start: ${String(Editor.selection?.start)} Editor.selectedParagraphs.length = ${Editor.selectedParagraphs?.length}`)
  }
  return thisParagraph || null
}

/**
 * Get the lineIndex of the selected paragraph (looks at start of selection only)
 * @returns {Promise<number>} the lineIndex or -1 if can't be found
 */
export async function getSelectedParagraphLineIndex(): Promise<number> {
  const para = await getSelectedParagraph()
  return para?.lineIndex && para.lineIndex > -1 ? para?.lineIndex : -1
}

/**
 * Convenience function to insert a paragraph into a note and ensure it's placed after the frontmatter
 * @param {CoreNotefields} note - the note to insert into
 * @param {string} content - the content to insert
 * @param {number} index - the index to insert at, or blank/null to use smart prepend (top of note, after frontmatter)
 * @param {ParagraphType} type - the type of paragraph to insert (default 'text')
 * @author @dwertheimer
 */
export function insertParagraph(note: TNote, content: string, index: number | null = null, type: ParagraphType = 'text'): void {
  const insertionIndex = index ?? findStartOfActivePartOfNote(note)
  logDebug(pluginJson, `insertParagraph -> top of note "${note.title || ''}", line ${insertionIndex}`)
  note.insertParagraph(content, insertionIndex, type)
}

/**
 * Check a note to confirm a line of text exists (exact .content match)
 * @param {CoreNoteFields} note
 * @param {string} content string to search for
 * @returns {boolean} whether it exists or not
 * alias containsContent containsParagraph paragraphExists paragraphContains
 * @author @dwertheimer
 */
export function noteHasContent(note: CoreNoteFields, content: string): boolean {
  return note.paragraphs.some((p) => p.content === content)
}

/**
 * Move the tasks to the specified note
 * @param {TParagraph} para - the paragraph to move
 * @param {TNote} destinationNote - the note to move to
 * @returns {boolean} whether it worked or not
 * @author @dwertheimer based on @jgclark code lifted from fileItems.js
 * Note: Originally, if you were using Editor.* commands, this would not delete the original paragraph (need to use Editor.note.* or note.*)
 * Hoping that adding DataStore.updateCache() will fix that
 * TODO: add user preference for where to move tasks in note - see @jgclark's code fileItems.js
 */
export function moveParagraphToNote(para: TParagraph, destinationNote: TNote): boolean {
  // for now, insert at the top of the note
  if (!para || !para.note || !destinationNote) return false
  const oldNote = para.note
  insertParagraph(destinationNote, para.rawContent)
  // dbw note: because I am nervous about people losing data, I am going to check that the paragraph has been inserted before deleting the original
  if (noteHasContent(destinationNote, para.content)) {
    para?.note?.removeParagraph(para) // this may not work if you are using Editor.* commands rather than Editor.note.* commands
    // $FlowFixMe - not in the type defs yet
    DataStore.updateCache(oldNote) // try to force Editor and Editor.note to be in synce after the move
    return true
  } else {
    logDebug(
      pluginJson,
      `moveParagraphToNote Could not find ${para.content} in ${destinationNote.title || 'no title'} so could not move it to ${destinationNote.title || 'no title'}`,
    )
  }
  return false
}

// returns a date object if it exists, and null if there is no forward date
const hasTypedDate = (t: TParagraph) => (/>\d{4}-\d{2}-\d{2}/g.test(t.content) ? t.date : null)

// DO NOT USE THIS FUNCTION - leaving it here for historical context, but functions below are more complete
// Note: nmn.sweep limits how far back you look with: && hyphenatedDateString(p.date) >= afterHyphenatedDate,
// For now, we are assuming that sweep was already done, and we're just looking at this one note
export const isOverdue = (t: TParagraph): boolean => {
  let theDate = null
  if (t.type === 'scheduled') theDate = t.date
  if (t.type === 'open') theDate = hasTypedDate(t)
  return theDate == null ? false : hyphenatedDateString(theDate) < hyphenatedDateString(new Date())
}
// export const getOverdueTasks = (paras: Array<TParagraph>): Array<TParagraph> => paras.filter((p) => isOverdue(p))

/**
 * Take in an array of paragraphs and return the subset that are open and overdue (scheduled or on dated notes in the past)
 * @param {Array<TParagraph>} paras - the paragraphs to check
 * @param {string} asOfDayString - the date to check against, in YYYY-MM-DD format
 * @returns {Array<TParagraph>} - the overdue paragraphs
 */
export const getOverdueParagraphs = (paras: $ReadOnlyArray<TParagraph>, asOfDayString?: string = ''): Array<TParagraph> => {
  const openTasks = paras?.filter(isOpen) || []
  const effectivelyOverdues = openTasks.filter(paragraphIsEffectivelyOverdue)
  const datedOverdues = openTasks.filter((p) => hasOverdueTag(p, false, asOfDayString))
  return [...datedOverdues, ...effectivelyOverdues].filter((t) => t.content !== '')
}

/**
 * Determines whether a line for a week is overdue or not. A line with multiple dates is only overdue if all dates are overdue.
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

/*
 * @param paragraphs array
 * @return filtered list of overdue tasks
 */

export type OverdueDetails = {
  isOverdue: boolean,
  linkType?: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly',
  overdueLinks?: Array<string>,
  notOverdueLinks?: Array<string>,
}

/**
 * This is a helper function not to be called directly for finding the overdue status of a paragraph
 * @param {TParagraph} para - incoming paragraph
 * @param {boolean} returnDetails whether to return the details of the overdue status or just true/false, if true, ALWAYS returns an object with details about the overdue status
 * @param {string} regexString string to use to match the note links
 * @param {string} todayRelevantFilename (e.g. today's filename, weekly note filename, etc)
 * @returns {boolean | OverdueDetails} - true/false in base case, or an object with details about the overdue status if requested in returnDetails
 * @author @dwertheimer
 */
export function testForOverdue(
  para: TParagraph,
  regexString: string,
  todayRelevantFilename: string,
  returnDetails: boolean = false,
  type: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Quarterly',
): boolean | OverdueDetails {
  const reMATCHLINK = new RegExp(regexString, 'g')
  let links = para.content.match(reMATCHLINK) || []
  const todayString = todayRelevantFilename // .replace(`.${DataStore.defaultFileExtension}`, '')
  let overdueLinks: Array<string> = [],
    notOverdueLinks: Array<string> = []
  if (links && links?.length > 0) {
    links = links.map((link) => link.trim())
    overdueLinks = links.filter((link) => link.slice(1) < todayString)
    notOverdueLinks = links.filter((link) => link.slice(1) >= todayString)
  }
  // if there are no links, then it's not overdue
  if (overdueLinks.length === 0 && returnDetails === false) {
    return false
  }
  // if there are week note links, then check if any of them are for this week
  else {
    const details: OverdueDetails = {
      isOverdue: links.length > 0 && links.length === overdueLinks?.length,
      overdueLinks: overdueLinks,
      notOverdueLinks: notOverdueLinks,
      linkType: type,
    }
    return returnDetails ? details : details.isOverdue
  }
}

/**
 * Test whether a paragraph has an date link (>YYYY-MM-DD) that is overdue
 * @param {TParagraph} para - input paragraph
 * @param {boolean} returnDetails - whether to return the details of the overdue status or just true/false
 * @param {string} asOfDayString? - the date to use for testing (e.g. for future dates), if not provided, will use today's date
 * see OverdueDetails type for details
 * @returns
 */
export function hasOverdueDayTag(para: TParagraph, returnDetails: boolean = false, asOfDayString?: string = ''): boolean | OverdueDetails {
  const today = asOfDayString?.length ? asOfDayString : getTodaysDateHyphenated()
  if (today) {
    return testForOverdue(para, RE_SCHEDULED_ISO_DATE, today, returnDetails, 'Daily')
  } else {
    return false
  }
}

/**
 * Test whether a paragraph has an overdue week note link (>YYYY-WW) that is overdue
 * @param {TParagraph} para - input paragraph
 * @param {boolean} returnDetails - whether to return the details of the overdue status or just true/false
 * @param {string} asOfDayString? - the date to use for testing (e.g. for future dates), if not provided, will use today's date
 * @returns {boolean | OverdueDetails}
 * @returns
 */
export function hasOverdueWeekTag(para: TParagraph, returnDetails: boolean = false, asOfDayString?: string = ''): boolean | OverdueDetails {
  const thisWeek = getNPWeekData(moment(asOfDayString?.length ? asOfDayString : undefined).toDate())?.weekString
  if (thisWeek) {
    return testForOverdue(para, SCHEDULED_WEEK_NOTE_LINK, thisWeek, returnDetails, 'Weekly')
  } else {
    return false
  }
}

/**
 * Test whether a paragraph has an overdue month note link (>YYYY-MM) that is overdue
 * @param {TParagraph} para - input paragraph
 * @param {boolean} returnDetails - whether to return the details of the overdue status or just true/false
 * @param {string} asOfDayString? - the date to use for testing (e.g. for future dates), if not provided, will use today's date
 * @returns {boolean | OverdueDetails}
 */
export function hasOverdueMonthTag(para: TParagraph, returnDetails: boolean = false, asOfDayString?: string = ''): boolean | OverdueDetails {
  const thieMonth = (asOfDayString?.length ? asOfDayString : getTodaysDateHyphenated()).slice(0, 7)
  if (thieMonth) {
    return testForOverdue(para, SCHEDULED_MONTH_NOTE_LINK, thieMonth, returnDetails, 'Monthly')
  } else {
    return false
  }
}

/**
 * Test whether a paragraph has an overdue quarter note link (>YYYY-QQ) that is overdue
 * @param {TParagraph} para - input paragraph
 * @param {boolean} returnDetails - whether to return the details of the overdue status or just true/false
 * @param {string} asOfDayString? - the date to use for testing (e.g. for future dates), if not provided, will use today's date
 * @returns {boolean | OverdueDetails}
 */
export function hasOverdueQuarterTag(para: TParagraph, returnDetails: boolean = false, asOfDayString?: string = ''): boolean | OverdueDetails {
  const thisQuarter = moment(asOfDayString?.length ? asOfDayString : undefined).format('YYYY-[Q]Q')
  if (thisQuarter) {
    return testForOverdue(para, SCHEDULED_QUARTERLY_NOTE_LINK, thisQuarter, returnDetails, 'Quarterly')
  } else {
    return false
  }
}

/**
 * Test whether a paragraph has an overdue year note link (>YYYY) that is overdue
 * @param {TParagraph} para - input paragraph
 * @param {boolean} returnDetails - whether to return the details of the overdue status or just true/false
 * @param {string} asOfDayString? - the date to use for testing (e.g. for future dates), if not provided, will use today's date
 * @returns {boolean | OverdueDetails}
 */
export function hasOverdueYearTag(para: TParagraph, returnDetails: boolean = false, asOfDayString?: string = ''): boolean | OverdueDetails {
  const thisYear = moment(asOfDayString?.length ? asOfDayString : undefined).format('YYYY')
  if (thisYear) {
    return testForOverdue(para, SCHEDULED_YEARLY_NOTE_LINK, thisYear, returnDetails, 'Yearly')
  } else {
    return false
  }
}

/**
 * Get the details of the first date tag found in a paragraph's content, or false if there is no date
 * Precedence: is Daily, Weekly, Monthly, Quarterly, Yearly
 * Someday maybe this will be able to classify multiple date tags in a paragraph
 * @param {TParagraph} para - the paragraph to test
 * @param {*} asOfDayString? - the date to use for testing (e.g. for future dates), if not provided, will use today's date
 * @returns {OverdueDetails | false} - the details of the first date tag found, or false if none found
 */
export function getTagDetails(para: TParagraph, asOfDayString?: string = ''): OverdueDetails | false {
  const typeNames = ['Daily', `Weekly`, `Monthly`, `Quarterly`, `Yearly`]
  const typeFuncs = [hasOverdueDayTag, hasOverdueWeekTag, hasOverdueMonthTag, hasOverdueQuarterTag, hasOverdueYearTag]
  for (let i = 0; i < typeNames.length; i++) {
    // const type = typeNames[i]
    const result = typeFuncs[i](para, true, asOfDayString)
    // $FlowIgnore - flow doesn't know that result is an OverdueDetails object
    if ((result && result.overdue) || result.overdueLinks.length || result.notOverdueLinks.length) {
      // $FlowIgnore - flow doesn't know that result is an OverdueDetails object
      return result
    }
  }
  return false
}

/**
 * Single function to test whether a paragraph has any overdue tags (Day, Week, Month, Quarter, Year)
 * (e.g. a task marked with yesterday's daily note date (e.g. >2022-12-31 would now be "overdue")
 * @param {TParagraph} para - the paragraph to test
 * @param {boolean} returnDetails (default:false) - whether to return the details of the overdue status or just true/false
 * @param {string} asOfDayString? - the date to use for testing (e.g. for future dates), if not provided, will use today's date
 * @returns {boolean|OverdueDetails} - true if any of the tags are overdue. if returnDetails is true, returns an object with details about the overdue status
 * Note that if returnDetails is true, the return type is OverdueDetails, not boolean
 * Precedence is Daily, Weekly, Monthly, Quarterly, Yearly
 * see OverdueDetails type for details
 */
export function hasOverdueTag(para: TParagraph, returnDetails: boolean = false, asOfDayString?: string = ''): boolean | OverdueDetails {
  if (returnDetails) {
    const details = getTagDetails(para, asOfDayString)
    if (details) {
      return details
    }
    return false
  } else {
    return Boolean(
      hasOverdueDayTag(para, false, asOfDayString) ||
        hasOverdueWeekTag(para, false, asOfDayString) ||
        hasOverdueMonthTag(para, false, asOfDayString) ||
        hasOverdueQuarterTag(para, false, asOfDayString) ||
        hasOverdueYearTag(para, false, asOfDayString),
    )
  }
}

/**
 * Get all strings from the paragraph that are overdue and return them as an array of strings
 * (e.g. for replacing)
 * Note: returns an empty array if there are no overdue tags
 * If overdue tags are found, they are returned in the following order: Day, Week, Month, Quarter, Year
 * @author @dwertheimer
 * @param {TParagraph} para - the paragraph to test
 * @param {string} asOfDayString? - the date to use for testing (e.g. for future dates), if not provided, will use today's date
 * @returns {Array<string>} - array of strings that are overdue (e.g. [">2022-12-31"]) or an empty array
 */
export function getOverdueTags(para: TParagraph, asOfDayString?: string = ''): string[] {
  const funcs = [hasOverdueDayTag, hasOverdueWeekTag, hasOverdueMonthTag, hasOverdueQuarterTag, hasOverdueYearTag]
  return funcs.reduce((acc, func) => {
    // $FlowIgnore - flow doesn't know what the signature of the functions is
    const tagList = func(para, true, asOfDayString)?.overdueLinks || []
    // $FlowIgnore - see above
    return [...acc, ...tagList]
  }, [])
}

/**
 * Find if a paragraph is scheduled (i.e. has a >date tag - day, week, month, year, quarter, etc.)
 * Does not test whether the date is overdue, for that use hasOverdueTag
 * @param {TParagraph} para
 * @returns {boolean} - true if the paragraph has any type of scheduled tag
 */
const paragraphIsScheduled = (para: TParagraph): boolean => isScheduled(para.content)

/**
 * Test whether a paragraph in a calendar note is "effectively overdue" (a.k.a. "forgotten tasks")
 * (i.e. the task is open, does not include a >scheduling date of any kind, and this type of note's date is in the past)
 * Immediately returns false if the note is not a calendar note
 * e.g. a task on yesterday's daily note would now be "overdue"
 * an open task on last week's weekly note would now be "overdue"
 * @author @dwertheimer
 * @param {TParagraph} paragraph
 * @returns {boolean} - true if the task is open
 */
export function paragraphIsEffectivelyOverdue(paragraph: TParagraph): boolean {
  /* forgotten task */
  // if the paragraph is not open, or is scheduled but not overdue, then it's not overdue
  if (paragraph?.note?.type === 'Notes' || paragraph.type !== 'open' || paragraphIsScheduled(paragraph)) return false
  const noteType = paragraph?.note?.type ? getNoteType(paragraph.note) : null
  const thisNoteTitle = paragraph.note?.title || null // e.g. 2021-12-31
  if (!noteType || !thisNoteTitle) {
    clo(paragraph, 'paragraphIsEffectivelyOverdue: Could not get note type or title for this paragraph')
    throw new Error(`Thrown Error: Could not get note type ${noteType || ''} or title ${thisNoteTitle || ''}. Stopping execution.`)
  }
  let isOverdue = false
  switch (noteType) {
    case 'Daily':
      if (thisNoteTitle < getTodaysDateHyphenated()) isOverdue = true
      break
    case 'Weekly': {
      const weekData = getNPWeekData()
      if (weekData && thisNoteTitle < weekData?.weekString) isOverdue = true
      break
    }
    case 'Monthly': {
      const thisMonth = getTodaysDateHyphenated().slice(0, 7)
      if (thisNoteTitle < thisMonth) isOverdue = true
      break
    }
    case 'Quarterly': {
      const thisQuarter = moment().format('YYYY-[Q]Q')
      if (thisNoteTitle < thisQuarter) isOverdue = true
      break
    }
    case 'Yearly': {
      const thisYear = moment().format('YYYY')
      if (thisNoteTitle < thisYear) isOverdue = true
      break
    }
    case 'Project': {
      // should never get here, but just in case
      isOverdue = false
      break
    }
    default:
      clo(paragraph, `paragraphIsEffectivelyOverdue noteType${noteType} did not match known types`)
      throw new Error(`Thrown Error: noteType ${paragraph?.note?.type || ''} did not match known types. Stopping execution.`)
  }
  return isOverdue
}

/**
 * Calculate the number of days until due (or overdue) for a paragraph to today
 * Assumes the paragraph has a >date tag; use helpers/NPdateTime.js/getDaysToCalendarNote for paragraphs that don't have a >date tag
 * The tricky part is that we have to start counting with the end of the period (e.g. the end of the week, month, etc.)
 * @author @dwertheimer
 * @param {TParagraph} paragraph
 * @param {string} toISODate - the date to calculate overdue to. Defaults to today
 * @returns {number} - the number of days overdue
 * @tests in jest file
 */
export function getDaysTilDue(paragraph: TParagraph, toISODate: string = getTodaysDateHyphenated()): number {
  const paraDateTagDetails: OverdueDetails | false = getTagDetails(paragraph, toISODate)
  // clo(paragraph, 'getDaysTilDue: calculating days til due for paragraph')
  // clo(paraDateTagDetails, 'getDaysTilDue: paraDateTagDetails')
  if (paraDateTagDetails && paraDateTagDetails.linkType && paragraph.date) {
    const endDate = endOfPeriod(paraDateTagDetails.linkType, paragraph.date)
    if (endDate) {
      // logDebug(`getDaysTilDue: endDate:${endDate.toString()} toISODate:${toISODate}`)
      const daysTilDue = calculateDaysOverdue(endDate, toISODate)
      return daysTilDue
    } else {
      logError(`getDaysTilDue: could not get end of period for ${endDate || ''}`)
      return NaN
    }
  } else {
    const daysSinceNote = getDaysToCalendarNote(paragraph, toISODate)
    return daysSinceNote || NaN
  }
}

/**
 * Get end date for a given date based on the link type
 * @param {'Daily'|'Weekly'|'Monthly'|'Quarterly'|Yearly} periodType - the type of period (e.g. Daily, Weekly, Monthly, etc.) as returned by getTagDetails()
 * @param {Date} paraDate - the date of the paragraph in question (to find the relevant end of period)
 * @returns {Date | null} - the end of the period for the given date
 */
function endOfPeriod(periodType: string, paraDate: Date): Date | null {
  if (!periodType || !paraDate) {
    return null
  }
  switch (periodType) {
    case 'Daily':
      return new moment(paraDate).endOf('day').toDate()
    case 'Weekly':
      return getNPWeekData(paraDate)?.endDate || null
    case 'Monthly':
      return getMonthData(paraDate)?.endDate || null
    case 'Quarterly':
      return getQuarterData(paraDate)?.endDate || null
    case 'Yearly':
      return getYearData(paraDate)?.endDate || null
    default:
      return null
  }
}

/**
 *  Calculate the number of days until due for a given date (negative if overdue)
 * TODO: tests!
 * @author @dwertheimer
 * @param {string|Date} fromDate (in YYYY-MM-DD format if string)
 * @param {string|Date} toDate (in YYYY-MM-DD format if string)
 * @returns {number}
 */
export function calculateDaysOverdue(fromDate: string | Date, toDate: string | Date): number {
  if (!fromDate || !toDate) {
    return 0
  }

  const fromDateMom = moment(fromDate, 'YYYY-MM-DD')
  const toDateMom = moment(toDate, 'YYYY-MM-DD')
  const diffDays = fromDateMom.diff(toDateMom, 'days', true) // negative for overdue

  const floor = Math.floor(diffDays)
  // const ceil = Math.ceil(diffDays)

  // overdue
  if (diffDays < 0) {
    return Object.is(floor, -0) ? -1 : floor
  }
  // not overdue
  return Object.is(floor, -0) ? 0 : floor
}

/**
 * Create a simple object version of a Paragraph object
 * NotePlan objects do not JSON.stringify() well, because most/all of the properties are on the prototype chain
 * after they come across the bridge from JS. If we want to send object data somewhere (e.g. to HTML/React window)
 * we need to convert them to a static object first.
 * @param {any} obj - the NotePlan object to convert
 * @param {Array<string>} fields - list of fields to copy from the object to the static object -- all fields are typical
 * Paragraph fields except for 'daysOverdue', which is calculated
 * @param {any} additionalFieldObj - any additional fields you want to add to the new object (as an object) e.g. {myField: 'myValue'}
 * @param {string} untilDate - the ISO-8601 date (e.g. 2022-01-01) to calculate overdue to. Defaults to today
 * @returns {any} - the static object
 * @author @dwertheimer
 */
export function createStaticObject(obj: any, fields: Array<string>, additionalFieldObj: any = {}, untilDate?: string = getTodaysDateHyphenated()): any {
  if (!obj) throw 'createStaticObject: input obj is null; cannot convert it'
  if (!fields?.length) throw 'createStaticObject: no fieldlist provided; cannot create static object'
  if (typeof obj !== 'object') throw 'createStaticObject: input obj is not an object; cannot convert it'
  const staticObj: any = {}
  for (const field of fields) {
    if (field === 'daysOverdue') {
      staticObj.daysOverdue = getDaysTilDue(obj, untilDate)
    } else if (field === 'title' && !obj.title) {
      staticObj.title = obj.note.title || ''
    } else {
      staticObj[field] = obj[field] || null
    }
  }
  return { ...staticObj, ...additionalFieldObj }
}

/**
 * Convert an array of NotePlan (obscured) paragraph objects to static objects (designed for paragraphs, but would work for any type of NP object though)
 * This is object-type agnostic (works for Notes, Paragraphs, etc.) just supply the fields you want to copy
 * See createStaticObject for more details
 * @param {Array<any>} arrayOfObjects
 * @param {Array<string>} fields you want copied to the new object
 * @param {any} defaultObj - any additional default fields you want to add to the new object
 * @returns {any} - the array of static objects
 * @author @dwertheimer
 */
export function createStaticParagraphsArray(arrayOfObjects: Array<any>, fields: Array<string>, defaultObj: any = {}): Array<any> {
  if (!arrayOfObjects) throw 'createStaticArray: input array is null; cannot convert it'
  if (!fields?.length) throw 'createStaticArray: no fieldlist provided; cannot create static object'
  if (!Array.isArray(arrayOfObjects)) throw 'createStaticArray: input array is not an array; cannot convert it'
  const staticArray = []
  for (const item of arrayOfObjects) {
    staticArray.push({ ...createStaticObject(item, fields), ...defaultObj })
  }
  return staticArray
}

/**
 * Check a paragraph object against a plain object of fields to see if they match
 * @param {TParagraph} paragraph object to check
 * @param {any} fieldsObject object with some fields
 * @param {Array<string>} fields list of field names to check in fieldsObject
 * @returns {boolean} true if all fields match, false if any do not
 * @author @dwertheimer
 */
export function paragraphMatches(paragraph: TParagraph, fieldsObject: any, fields: Array<string>): boolean {
  let match = true
  const rawWasEdited = fields.indexOf('rawContent') > -1 && fieldsObject.originalRawContent && fieldsObject.rawContent !== fieldsObject.originalRawContent
  fields.forEach((field) => {
    if (field === 'rawContent' && rawWasEdited) {
      // $FlowFixMe - Cannot get `paragraph[field]` because an index signature declaring the expected key / value type is missing in  `Paragraph` [1].
      if (paragraph[field] !== fieldsObject['originalRawContent']) {
        // $FlowFixMe - Cannot get `paragraph[field]` because an index signature declaring the expected key / value type is missing in  `Paragraph` [1].
        // logDebug(pluginJson, `${field} paragraphMatches failed: ${paragraph[field]} !== ${fieldsObject[field]}`)
        match = false
      }
    } else {
      // $FlowFixMe - Cannot get `paragraph[field]` because an index signature declaring the expected key / value type is missing in  `Paragraph` [1].
      if (typeof paragraph[field] === 'undefined') {
        throw `paragraphMatches: paragraph.${field} is undefined. you must pass in the correct fields to match. 'fields' is set to ${JSP(fields)} but paragraph=${JSP(
          paragraph,
        )}, which does not have all the fields`
      }
      if (paragraph[field] !== fieldsObject[field]) {
        // $FlowFixMe - Cannot get `paragraph[field]` because an index signature declaring the expected key / value type is missing in  `Paragraph` [1].
        // logDebug(pluginJson, `${field} -- paragraphMatches failed: ${paragraph[field]} !== ${fieldsObject[field]}`)
        match = false
      }
    }
  })
  return match
}

/**
 * Find the paragraph in the note, from its content
 * @author @dwertheimer + @jgclark
 * @param {Array<TParagraph>} parasToLookIn - NP paragraph list to search
 * @param {any} paragraphDataToFind - object with the static data fields to match (e.g. filename, rawContent, type)
 * @param {Array<string>} fieldsToMatch - (optional) array of fields to match (e.g. filename, lineIndex). default = ['filename', 'rawContent']
 * @param {boolean} ifMultipleReturnFirst? - (optional) if there are multiple matches, return the first one (default: false)
 * @returns {TParagraph | null } - the matching paragraph, or null if not found
 * @author @dwertheimer updated by @jgclark
 * @tests exist
 */
export function findParagraph(
  parasToLookIn: $ReadOnlyArray<TParagraph>,
  paragraphDataToFind: any,
  fieldsToMatch: Array<string> = ['filename', 'rawContent'],
  ifMultipleReturnFirst: boolean = false,
): TParagraph | null {
  // clo(parasToLookIn, `findParagraph: parasToLookIn.length=${parasToLookIn.length}`)
  const potentials = parasToLookIn.filter((p) => paragraphMatches(p, paragraphDataToFind, fieldsToMatch))
  if (potentials?.length === 1) {
    // clo(potentials[0], `findParagraph potential matches=${potentials.length}, here's the one:`)
    logDebug('findParagraph', `1 potential match: rawContent:"${potentials[0].rawContent}"`)
    return potentials[0]
  } else if (potentials.length > 1) {
    // clo(potentials[0], `findParagraph potential matches=${potentials.length}, here's the first:`)
    logDebug('findParagraph', `first potential match: rawContent: <${potentials[0].rawContent}>`)
    if (ifMultipleReturnFirst) {
      // If we want to always return the first match, do so.
      return potentials[0]
    } else {
      // Otherwise check to see if lineIndex matches as well, and only then return the first match
      const matchIndexes = potentials.find((p) => p.lineIndex === paragraphDataToFind.lineIndex)
      if (matchIndexes) {
        return matchIndexes
      }
      logDebug(
        pluginJson,
        `findParagraph: found more than one paragraph in note "${paragraphDataToFind.filename}" that matches ${JSON.stringify(
          paragraphDataToFind,
        )}. Could not determine which one to use.`,
      )
      return null
    }
  } else {
    // no matches
    // const p = paragraphDataToFind
    logDebug(pluginJson, `findParagraph: found no paragraphs in note "${paragraphDataToFind.filename}" that matches ${JSON.stringify(paragraphDataToFind.rawContent)}`)
    // logDebug(`\n**** Looking for "${p[fieldsToMatch[0]]}" "${p[fieldsToMatch[1]]}" in the following list`)
    //$FlowIgnore
    // parasToLookIn.forEach((p) => logDebug(pluginJson, `\t findParagraph: ${p[fieldsToMatch[0]]} ${p[fieldsToMatch[1]]}`))
  }
  return null
}

/**
 * Take a static object with a subset of Paragraph fields from HTML or wherever and return the actual paragraph in the note
 * @param {*} staticObject - the static object from the HTML must have fields:
 *    filename, lineIndex, noteType
 * @param {Array<string>} fieldsToMatch - (optional) array of fields to match (e.g. filename, lineIndex) -- these two fields are required. default is ['filename', 'rawContent']
 * @returns {TParagraph|null} - the paragraph or null if not found
 * @author @dwertheimer
 */
export function getParagraphFromStaticObject(staticObject: any, fieldsToMatch: Array<string> = ['filename', 'rawContent']): TParagraph | null {
  const { filename } = staticObject
  let { noteType } = staticObject
  if (!noteType) {
    // logDebug(pluginJson, `getParagraphFromStaticObject getNoteType(filename)  ${getNoteType(filename)}`)
    noteType = getNoteType(staticObject) === 'Project' ? 'Notes' : 'Calendar'
  }
  let note = DataStore.noteByFilename(filename, noteType)
  if (!note && noteType === 'Notes') note = DataStore.noteByFilename(filename, 'Calendar') // added this because getNotetype works great in Jest but sometimes doesn't short circuit properly when run in NP
  if (note) {
    logDebug(pluginJson, `getParagraphFromStaticObject found note ${note.title || ''}`)
    const paras = note.paragraphs
    // logDebug(pluginJson, `getParagraphFromStaticObject cleaned paragraphs. count= ${paras.length}`)
    const para = findParagraph(paras, staticObject, fieldsToMatch)
    if (para) {
      const cleanParas = note.paragraphs
      return cleanParas[para.lineIndex] // make sure we are returning the original, non-cleansed version
    }
  } else {
    clo(staticObject, `getParagraphFromStaticObject could not open note "${filename}" of type "${noteType}"`)
  }
  return null
}

/**
 * Highlight the given Paragraph details in the open editor.
 * The static object that's passed in must have at least the following TParagraph-type fields populated: filename and rawContent (or content, though this is naturally less exact).
 * If 'thenStopHighlight' is true, the cursor will be moved to the start of the paragraph after briefly flashing the whole line. This is to prevent starting to type and inadvertdently removing the whole line.
 * @author @jgclark
 * @param {any} objectToTest
 * @param {boolean} thenStopHighlight?
 * @results {boolean} success?
 */
export function highlightParagraphInEditor(objectToTest: any, thenStopHighlight: boolean = false): boolean {
  try {
    logDebug('highlightParagraphInEditor', `Looking for <${objectToTest.rawContent ?? objectToTest.content}>`)

    const { paragraphs } = Editor
    const resultPara: TParagraph | null = objectToTest.rawContent
      ? findParagraph(paragraphs, objectToTest, ['filename', 'rawContent'])
      : findParagraph(paragraphs, objectToTest, ['filename', 'content'])
    if (resultPara) {
      const lineIndex = resultPara.lineIndex
      Editor.highlight(resultPara)
      logDebug('highlightParagraphInEditor', `Found para to highlight at lineIndex ${String(lineIndex)}`)
      const paraRange = resultPara.contentRange
      if (thenStopHighlight && paraRange) {
        logDebug('highlightParagraphInEditor', `Now moving cursor to highlight at charIndex ${String(paraRange.start)}`)
        Editor.highlightByIndex(paraRange.start, 0)
      }
      return true
    } else {
      logWarn('highlightParagraphInEditor', `Sorry, couldn't find paragraph with rawContent <${objectToTest.rawContent}> to highlight in open note`)
      return false
    }
  } catch (error) {
    logError('highlightParagraphInEditor', `highlightParagraphInEditor: ${error.message}`)
    return false
  }
}

/**
 * Return a TParagraph object by an exact match to 'content' in file 'filenameIn'. If it fails to find a match, it returns false.
 * Designed to be called when you're not in an Editor (e.g. an HTML Window).
 * @author @jgclark
 * @param {string} filenameIn to look in
 * @param {string} content to find
 * @returns {TParagraph | boolean} TParagraph if succesful, false if unsuccesful
 */
export function findParaFromStringAndFilename(filenameIn: string, content: string): TParagraph | boolean {
  try {
    // logDebug('NPP/findParaFromStringAndFilename', `starting with filename: ${filenameIn}, content: {${content}}`)
    let filename = filenameIn
    if (filenameIn === 'today') {
      filename = getTodaysDateUnhyphenated()
    } else if (filenameIn === 'thisweek') {
      filename = getNPWeekStr(new Date())
    }
    // Long-winded way to get note title, as we don't have TNote, but do have note's filename
    // $FlowIgnore[incompatible-type]
    const thisNote: TNote = DataStore.projectNoteByFilename(filename) ?? DataStore.calendarNoteByDateString(filename)

    if (thisNote) {
      if (thisNote.paragraphs.length > 0) {
        let c = 0
        for (const para of thisNote.paragraphs) {
          if (para.content === content) {
            logDebug('NPP/findParaFromStringAndFilename', `found matching para #${c} of type ${para.type}: {${content}}`)
            return para
          }
          c++
        }
        logWarn('NPP/findParaFromStringAndFilename', `Couldn't find paragraph {${content}} to complete`)
        return false
      } else {
        logInfo('NPP/findParaFromStringAndFilename', `Note '${filename}' appears to be empty?`)
        return false
      }
    } else {
      logWarn('NPP/findParaFromStringAndFilename', `Can't find note '${filename}'`)
      return false
    }
  } catch (error) {
    logError(pluginJson, `NPP/findParaFromStringAndFilename: ${error.message} for note '${filenameIn}'`)
    return false
  }
}

/**
 * Appends a '@done(...)' date to the given paragraph if the user has turned on the setting 'add completion date'.
 * TODO: Cope with non-daily scheduled dates.
 * @author @jgclark
 * @param {TParagraph} para
 * @param {boolean} useScheduledDateAsCompletionDate?
 * @returns {boolean} success?
 */
export function markComplete(para: TParagraph, useScheduledDateAsCompletionDate: boolean = false): boolean {
  if (para) {
    // Default to using current date/time
    let dateString = nowShortDateTimeISOString
    if (useScheduledDateAsCompletionDate) {
      // But use scheduled date instead if found
      if (hasScheduledDate(para.content)) {
        const captureArr = para.content.match(RE_FIRST_SCHEDULED_DATE_CAPTURE) ?? []
        clo(captureArr)
        dateString = captureArr[1]
        logDebug('markComplete', `will use scheduled date ${dateString} as completion date`)
      } else {
        // Use date of the note if it has one. (What does para.note.date return for non-daily calendar notes?)
        if (para.note?.type === 'Calendar' && para.note.date) {
          dateString = hyphenatedDate(para.note.date)
          logDebug('markComplete', `will use date of note ${dateString} as completion date`)
        }
      }
    } else {
      dateString = nowShortDateTimeISOString
    }
    const doneString = DataStore.preference('isAppendCompletionLinks') ? ` @done(${dateString})` : ''

    if (para.type === 'open') {
      para.type = 'done'
      para.content += doneString
      para.note?.updateParagraph(para)
      logDebug('markComplete', `updated para <${para.content}>`)
      return true
    } else if (para.type === 'checklist') {
      para.type = 'checklistDone'
      para.note?.updateParagraph(para)
      logDebug('markComplete', `updated para <${para.content}>`)
      return true
    } else {
      logWarn('markComplete', `unexpected para type ${para.type}, so won't continue`)
      return false
    }
  } else {
    logError(pluginJson, `markComplete: para is null`)
    return false
  }
}

/**
 * Change para type of the given paragraph to cancelled (for both tasks/checklists)
 * @param {TParagraph} para
 * @returns {boolean} success?
 */
export function markCancelled(para: TParagraph): boolean {
  if (para) {
    if (para.type === 'open') {
      para.type = 'cancelled'
      para.note?.updateParagraph(para)
      logDebug('markCancelled', `updated para <${para.content}>`)
      return true
    } else if (para.type === 'checklist') {
      para.type = 'checklistCancelled'
      para.note?.updateParagraph(para)
      logDebug('markCancelled', `updated para <${para.content}>`)
      return true
    } else if (para.type === 'cancelled' || para.type === 'checklistCancelled') {
      logInfo('markCancelled', `para <${para.content}> is already cancelled: is this a duplicate line?`)
      return false
    } else {
      logWarn('markCancelled', `unexpected para type ${para.type}, so won't continue`)
      return false
    }
  } else {
    logError(pluginJson, `markCancelled: para is null`)
    return false
  }
}

/**
 * Complete a task/checklist item (given by 'content') in note (given by 'filenameIn').
 * Designed to be called when you're not in an Editor (e.g. an HTML Window).
 * Appends a '@done(...)' date to the line if the user has selected to 'add completion date'.
 * @author @jgclark
 * @param {string} filenameIn to look in
 * @param {string} content to find
 * @returns {boolean} success?
 */
export function completeItem(filenameIn: string, content: string): boolean {
  try {
    logDebug('NPP/completeItem', `starting with filename: ${filenameIn}, content: <${content}>`)
    const possiblePara = findParaFromStringAndFilename(filenameIn, content)
    if (typeof possiblePara === 'boolean') {
      return false
    }
    return markComplete(possiblePara, false)
  } catch (error) {
    logError(pluginJson, `NPP/completeItem: ${error.message} for note '${filenameIn}'`)
    return false
  }
}

/**
 * Complete a task/checklist item (given by 'content') in note (given by 'filenameIn').
 * Designed to be called when you're not in an Editor (e.g. an HTML Window).
 * Appends a '@done(...)' date to the line if the user has selected to 'add completion date' - but uses completion date of the day it was scheduled to be done.
 * @author @jgclark
 * @param {string} filenameIn to look in
 * @param {string} content to find
 * @returns {boolean} true if succesful, false if unsuccesful
 */
export function completeItemEarlier(filenameIn: string, content: string): boolean {
  try {
    logDebug('NPP/completeItemEarlier', `starting with filename: ${filenameIn}, content: <${content}>`)
    const possiblePara = findParaFromStringAndFilename(filenameIn, content)
    if (typeof possiblePara === 'boolean') {
      return false
    }
    return markComplete(possiblePara, true)
  } catch (error) {
    logError(pluginJson, `NPP/completeItemEarlier: ${error.message} for note '${filenameIn}'`)
    return false
  }
}

/**
 * Cancel a task/checklist item (given by 'content') in note (given by 'filenameIn').
 * Designed to be called when you're not in an Editor (e.g. an HTML Window).
 * @author @jgclark
 * @param {string} filenameIn to look in
 * @param {string} content to find
 * @returns {boolean} true if succesful, false if unsuccesful
 */
export function cancelItem(filenameIn: string, content: string): boolean {
  try {
    logDebug('NPP/cancelItem', `starting with filename: ${filenameIn}, content: ${content}`)
    const possiblePara = findParaFromStringAndFilename(filenameIn, content)
    if (typeof possiblePara === 'boolean') {
      return false
    }
    return markCancelled(possiblePara)
  } catch (error) {
    logError(pluginJson, `NPP/cancelItem: ${error.message} for note '${filenameIn}'`)
    return false
  }
}

/**
 * Prepend a todo (task or checklist) to a calendar note
 * @author @jgclark
 * @param {"task" | "checklist"} todoTypeName 'English' name of type of todo
 * @param {string} NPDateStr the usual calendar titles, plus YYYYMMDD
 * @param {string} todoTextArg text to prepend. If empty or missing, then will ask user for it
 */
export async function prependTodoToCalendarNote(todoTypeName: 'task' | 'checklist', NPDateStr: string, todoTextArg: string = ''): Promise<void> {
  // logDebug('NPP/prependTodoToCalendarNote', `Starting with NPDateStr: ${NPDateStr}, todoTypeName: ${todoTypeName}, todoTextArg: ${todoTextArg}`)
  try {
    const todoType = todoTypeName === 'task' ? 'open' : 'checklist'
    // Get calendar note to use
    const note = DataStore.calendarNoteByDateString(NPDateStr)
    if (note != null) {
      // Get input either from passed argument or ask user
      const todoText =
        todoTextArg != null && todoTextArg !== '' ? todoTextArg : await CommandBar.showInput(`Type the ${todoTypeName} text to add`, `Add ${todoTypeName} '%@' to ${NPDateStr}`)
      logDebug('NPP/prependTodoToCalendarNote', `- Prepending type ${todoType} '${todoText}' to '${displayTitle(note)}'`)
      smartPrependPara(note, todoText, todoType)

      // Ask for cache refresh for this note
      DataStore.updateCache(note, false)
    } else {
      logError('NPP/prependTodoToCalendarNote', `- Can't get calendar note for ${NPDateStr}`)
    }
  } catch (err) {
    logError('NPP/prependTodoToCalendarNote', `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/**
 * Move a task or checklist from one calendar note to another.
 * It's designed to be used when the para itself is not available; the para will try to be identified from its filename and content, and it will throw an error if it fails.
 * The para will be *prepended* to the destination note in a smart way, to avoid frontmatter.
 * @author @jgclark
 * @param {"task" | "checklist"} todoTypeName 'English' name of type of todo
 * @param {string} NPFromDateStr from date (the usual NP calendar date strings, plus YYYYMMDD)
 * @param {string} NPToDateStr to date (the usual NP calendar date strings, plus YYYYMMDD)
 * @param {string} paraContent content of the para to move.
 */
export function moveItemBetweenCalendarNotes(NPFromDateStr: string, NPToDateStr: string, paraContent: string): boolean {
  logDebug(pluginJson, `starting moveItemBetweenCalendarNotes for ${NPFromDateStr} to ${NPToDateStr}`)
  try {
    // Get calendar note to use
    const fromNote = DataStore.calendarNoteByDateString(getAPIDateStrFromDisplayDateStr(NPFromDateStr))
    const toNote = DataStore.calendarNoteByDateString(getAPIDateStrFromDisplayDateStr(NPToDateStr))
    // Don't proceed unless we have valid from/to notes
    if (!fromNote || !toNote) {
      logError('moveItemBetweenCalendarNotes', `- Can't get calendar note for ${NPFromDateStr} and/or ${NPToDateStr}`)
      return false
    }

    // find para in the fromNote
    const possiblePara: TParagraph | boolean = findParaFromStringAndFilename(fromNote.filename, paraContent)
    if (typeof possiblePara === 'boolean') {
      throw new Error('moveItemBetweenCalendarNotes: no para found')
    }
    const itemType = possiblePara?.type

    // add to toNote
    logDebug('moveItemBetweenCalendarNotes', `- Prepending type ${itemType} '${paraContent}' to '${displayTitle(toNote)}'`)
    smartPrependPara(toNote, paraContent, itemType)

    // Assuming that's not thrown an error, now remove from fromNote
    logDebug('moveItemBetweenCalendarNotes', `- Removing line from '${displayTitle(fromNote)}'`)
    fromNote.removeParagraph(possiblePara)

    // Ask for cache refresh for these notes
    DataStore.updateCache(fromNote, false)
    DataStore.updateCache(toNote, false)

    return true
  } catch (err) {
    logError('moveItemBetweenCalendarNotes', `${err.name}: ${err.message}`)
    return false
  }
}

type TBasicPara = {
  type: ParagraphType,
  content: string,
  rawContent: string,
  lineIndex: number,
}

/**
 * Take a (multi-line) raw content block, typically from the editor, and turn it into an array of TParagraph-like objects
 * Designed to be used with Editor.content that is available in a trigger, before Editor.note.paragraphs is updated.
 * Only writes "type", "content", "rawContent", "lineIndex" fields.
 * @author @jgclark
 * @param {string} content to parse
 * @returns {Array<any>} array of TParagraph-like objects
 * @tests in jest file
 */
export function makeBasicParasFromContent(content: string): Array<any> {
  try {
    const allLines = content.split('\n')
    logDebug('makeBasicParasFromEditorContent', `Starting with ${String(allLines.length)} lines of editorContent}`)
    // read the user's prefs for what counts as a todo
    const ASTERISK_TODO = DataStore.preference('isAsteriskTodo') ? '*' : ''
    const DASH_TODO = DataStore.preference('isDashTodo') ? '-' : ''
    const NUMBER_TODO = DataStore.preference('isNumbersTodo') ? '|\\d+\\.' : ''
    // previously used /^\s*([\*\-]\s[^\[]|[\*\-]\s\[\s\])/
    const RE_OPEN_TASK = new RegExp(`^\\s*(([${DASH_TODO}${ASTERISK_TODO}]${NUMBER_TODO})\\s(?!\\[[x\\-\\]])(\\[[\\s>]\\])?)`)
    // logDebug('makeBasicParas...', `RE_OPEN_TASK: ${String(RE_OPEN_TASK)}`)
    const ASTERISK_BULLET = DataStore.preference('isAsteriskTodo') ? '' : '\\*'
    const DASH_BULLET = DataStore.preference('isDashTodo') ? '' : '\\-'
    const RE_BULLET_LIST = new RegExp(`^\\s*([${DASH_BULLET}${ASTERISK_BULLET}])\\s+`)
    // logDebug('makeBasicParas...', `RE_BULLET_LIST: ${String(RE_BULLET_LIST)}`)

    const basicParas: Array<TBasicPara> = []
    let c = 0
    for (const thisLine of allLines) {
      const thisBasicPara: TBasicPara = {
        type: 'text',
        lineIndex: c,
        rawContent: thisLine,
        content: thisLine.slice(getLineMainContentPos(thisLine)),
      }
      if (/^#{1,5}\s+/.test(thisLine)) {
        thisBasicPara.type = 'title'
      } else if (RE_OPEN_TASK.test(thisLine)) {
        thisBasicPara.type = 'open'
      } else if (/^\s*(\+\s[^\[]|\+\s\[ \])/.test(thisLine)) {
        thisBasicPara.type = 'checklist'
      } else if (/^\s*([\*\-]\s\[>\])/.test(thisLine)) {
        thisBasicPara.type = 'scheduled'
      } else if (/^\s*(\+\s\[>\])/.test(thisLine)) {
        thisBasicPara.type = 'checklistScheduled'
      } else if (/^\s*([\*\-]\s\[x\])/.test(thisLine)) {
        thisBasicPara.type = 'done'
      } else if (/^\s*([\*\-]\s\[\-\])/.test(thisLine)) {
        thisBasicPara.type = 'cancelled'
      } else if (/^\s*(\+\s\[x\])/.test(thisLine)) {
        thisBasicPara.type = 'checklistDone'
      } else if (/^\s*(\+\s\[\-\])/.test(thisLine)) {
        thisBasicPara.type = 'checklistCancelled'
      } else if (RE_BULLET_LIST.test(thisLine)) {
        thisBasicPara.type = 'list'
      } else if (/^\s*>\s/.test(thisLine)) {
        thisBasicPara.type = 'quote'
      } else if (thisLine === '---') {
        thisBasicPara.type = 'separator'
      } else if (thisLine === '') {
        thisBasicPara.type = 'empty'
      } else {
        thisBasicPara.type = 'text'
      }
      basicParas.push(thisBasicPara)
      // logDebug('makeBasicParas...', `${c}: ${thisBasicPara.type}: ${thisLine}`)
      c++
    }
    return basicParas
  } catch (error) {
    logError('makeBasicParasFromEditorContent', `${error.message} for input '${content}'`)
    return []
  }
}

/**
 * Get the number of days to/from the date of a paragraph's contaier -- calendar note -- to another date (defaults to today's date)
 * @param {TParagraph} para - the paragraph
 * @param {string|undefined} asOfDayString - the date to compare to
 * @returns {number} the number of days between the two dates (negative for in past, positive for in future), or null if there is no date
 */
export function getDaysToCalendarNote(para: TParagraph, asOfDayString?: string = ''): number | null {
  if (para.noteType !== 'Calendar') return null
  if (!para.note) return null
  const noteDate = para.note.title || ''
  const date = asOfDayString?.length ? asOfDayString : getTodaysDateHyphenated()
  return calculateDaysOverdue(noteDate, date)
}

/**
 * Toggle type between (open) Task and Checklist for a given line in note identified by filename
 * @author @jgclark
 * @param {string} filename of note
 * @param {string} content line to identify and change
 * @returns {ParagraphType} new type
 */
export function toggleTaskChecklistParaType(filename: string, content: string): string {
  try {
    // find para
    const possiblePara: TParagraph | boolean = findParaFromStringAndFilename(filename, content)
    if (typeof possiblePara === 'boolean') {
      throw new Error('toggleTaskChecklistParaType: no para found')
    }
    // Get the paragraph to change
    const thisPara = possiblePara
    const thisNote = thisPara.note
    const existingType = thisPara.type
    logDebug('toggleTaskChecklistParaType', `toggling in filename: ${filename}`)
    if (existingType === 'checklist') {
      thisPara.type = 'open'
      // $FlowIgnore(incompatible-use)
      thisNote.updateParagraph(thisPara)
      return 'open'
    } else {
      thisPara.type = 'checklist'
      // $FlowIgnore(incompatible-use)
      thisNote.updateParagraph(thisPara)
      return 'checklist'
    }
  } catch (error) {
    logError('toggleTaskChecklistParaType', error.message)
    return '(error)'
  }
}

/**
 * Remove any scheduled date (e.g. >YYYY-MM-DD or >YYYY-Www) from given line in note identified by filename
 * @author @jgclark
 * @param {string} filename of note
 * @param {string} content line to identify and change
 * @returns {boolean} success?
 */
export function unscheduleItem(filename: string, content: string): boolean {
  try {
    // find para
    const possiblePara: TParagraph | boolean = findParaFromStringAndFilename(filename, content)
    if (typeof possiblePara === 'boolean') {
      throw new Error('unscheduleItem: no para found')
    }
    // Get the paragraph to change
    const thisPara = possiblePara
    const thisNote = thisPara.note
    // Find and then remove any scheduled dates
    const thisLine = possiblePara.content
    logDebug('unscheduleItem', `unscheduleItem('${thisLine}'`)
    thisPara.content = replaceArrowDatesInString(thisLine, '')
    logDebug('unscheduleItem', `unscheduleItem('${thisPara.content}'`)
    // $FlowIgnore(incompatible-use)
    thisNote.updateParagraph(thisPara)
    return true
  } catch (error) {
    logError('unscheduleItem', error.message)
    return false
  }
}

export type ParentParagraphs = {
  parent: TParagraph,
  children: Array<TParagraph>,
}

/**
 * By definition, a paragraph's .children() method API returns an array of TParagraphs indented underneath it
 * a grandparent will have its children and grandchildren listed in its .children() method and the child will have the grandchildren also
 * This function returns only the children of the paragraph, not any descendants, eliminating duplicates
 * Every paragraph sent into this function will be listed as a parent in the resulting array of ParentParagraphs
 * Use removeParentsWhoAreChildren() afterwards to remove any children from the array of ParentParagraphs
 * (if you only want a paragraph to be listed in one place in the resulting array of ParentParagraphs)
 * @param {Array<TParagraph>} paragraphs - array of paragraphs
 * @returns {Array<ParentParagraphs>} - array of parent paragraphs with their children
 */
export function getParagraphParentsOnly(paragraphs: Array<TParagraph>): Array<ParentParagraphs> /* tag: children */ {
  const parentsOnly = []
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]
    logDebug('getParagraphParentsOnly', `para: "${para.content}"`)
    const childParas = getChildParas(para, paragraphs)
    parentsOnly.push({ parent: para, children: childParas })
  }
  return parentsOnly
}

/**
 * Remove any children from being listed as parents in the array of ParentParagraphs
 * This function should be called after getParagraphParentsOnly()
 * If a paragraph is listed as a child, it will not be listed as a parent
 * The paragraphs need to be in lineIndex order for this to work
 * @param {Array<ParentParagraphs>} everyParaIsAParent - array of parent paragraphs with their children
 * @returns {Array<ParentParagraphs>} - array of parent paragraphs with their children
 */
export function removeParentsWhoAreChildren(everyParaIsAParent: Array<ParentParagraphs>): Array<ParentParagraphs> {
  const childrenSeen: Array<TParagraph> = []
  const parentsOnlyAtTop: Array<ParentParagraphs> = []
  for (let i = 0; i < everyParaIsAParent.length; i++) {
    const p = everyParaIsAParent[i]
    if (childrenSeen.includes(p.parent)) {
      p.children.length ? childrenSeen.push(...p.children) : null
      continue // do not list this as a parent, because another para has it as a child
    }
    // concat all p.children to the childrenSeen array (we know they are unique, so no need to check)
    p.children.length ? childrenSeen.push(...p.children) : null
    parentsOnlyAtTop.push(p)
  }
  return parentsOnlyAtTop
}
/**
 * Get the direct children paragraphs of a given paragraph (ignore [great]grandchildren)
 * NOTE: the passed "paragraphs" array can be mutated if removeChildrenFromTopLevel is true
 * @param {TParagraph} para - the parent paragraph
 * @param {Array<TParagraph>} paragraphs - array of all paragraphs
 * @returns {Array<TParagraph>} - array of children paragraphs (NOTE: the passed "paragraphs" array can be mutated if removeChildrenFromTopLevel is true)
 */
export function getChildParas(para: TParagraph, paragraphs: Array<TParagraph>): Array<TParagraph> {
  const childParas = []
  const allChildren = para.children()
  const indentedChildren = getIndentedNonTaskLinesUnderPara(para, paragraphs)
  // concatenate the two arrays, but remove any duplicates that have the same lineIndex
  const allChildrenWithDupes = allChildren.concat(indentedChildren)
  const allChildrenNoDupes = allChildrenWithDupes.filter((p, index) => allChildrenWithDupes.findIndex((p2) => p2.lineIndex === p.lineIndex) === index)

  if (!allChildrenNoDupes.length) {
    return []
  }

  // someone could accidentally indent twice
  const minIndentLevel = Math.min(...allChildrenNoDupes.map((p) => p.indents))

  for (const child of allChildrenNoDupes) {
    const childIndentLevel = child.indents

    if (childIndentLevel === minIndentLevel) {
      childParas.push(child)
    }
  }

  clo(childParas, `getChildParas of para:"${para.content}", children.length=${allChildrenNoDupes.length}. reduced to:${childParas.length}`)

  return childParas
}

/**
 * Get any indented text paragraphs underneath a given paragraph, excluding tasks
 * Doing this to pick up any text para types that may have been missed by the .children() method, which only gets task paras
 * @param {TParagraph} para - The parent paragraph
 * @param {Array<TParagraph>} paragraphs - Array of all paragraphs
 * @returns {Array<TParagraph>} - Array of indented paragraphs underneath the given paragraph
 */
export function getIndentedNonTaskLinesUnderPara(para: TParagraph, paragraphs: Array<TParagraph>): Array<TParagraph> {
  const indentedParas = []

  const thisIndentLevel = para.indents
  let lastLineUsed = para.lineIndex

  for (const p of paragraphs) {
    // only get indented lines that are not tasks
    if (p.lineIndex > para.lineIndex && p.indents > thisIndentLevel && lastLineUsed === p.lineIndex - 1) {
      if (TASK_TYPES.includes(p.type)) break // stop looking if we hit a task
      indentedParas.push(p)
      lastLineUsed = p.lineIndex
    }
  }

  return indentedParas
}
