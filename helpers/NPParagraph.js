// @flow

import { hyphenatedDate } from './dateTime'
import { toLocaleDateTimeString } from './NPDateTime'
import { JSP, log, logError, logWarn } from './dev'
import { findStartOfActivePartOfNote, findEndOfActivePartOfNote, isTermInMarkdownPath, isTermInURL } from './paragraph'

/**
 * Remove all headings (type=='title') from a note matching the given text
 * @param {TNote|TEditor} note
 * @param {string} headingStr - the heading text to look for
 * @param {boolean} search rawText (headingStr above includes the #'s etc) default=false
 * @returns {void}
 */
export function removeHeadingFromNote(note: TNote | TEditor, headingStr: string, rawTextSearch: boolean = false) {
  const prevExists = note.paragraphs.filter((p) => (p.type === 'title' && rawTextSearch ? p.rawContent === headingStr : p.content === headingStr))
  if (prevExists.length) {
    note.removeParagraphs(prevExists)
  }
}

/**
 * Given a paragraph object, delete all the content of the block containing this paragraph
 * See getParagraphBlock below for definition of what constitutes a block an definition of useExtendedBlockDefinition
 * Optionally leave the title in place
 * @author @dwertheimer
 * @param {TNote|TEditor} note
 * @param {TParagraph} para
 * @param {boolean} useExtendedBlockDefinition (default: false) // TODO(@dwertheimer): flow shows this isn't used
 * @param {boolean} keepHeading (default: true)
 */
export function deleteEntireBlock(note: CoreNoteFields, para: TParagraph, _useExtendedBlockDefinition: boolean = false, keepHeading: boolean = true): void {
  const paraBlock: Array<TParagraph> = getParagraphBlock(note, para.lineIndex, _useExtendedBlockDefinition)
  log(`NPParagraph/deleteEntireBlock`, `Removing ${paraBlock.length} items under ${para.content}`)
  keepHeading ? paraBlock.shift() : null
  if (paraBlock.length > 0) {
    note.removeParagraphs(paraBlock) //seems to not work only if it's a note, not Editor
    // note.updateParagraphs(paraBlock)
  }
}

/**
 * Given a heading (string), delete all the content of the block under this heading (optionally and the heading also)
 * See getParagraphBlock below for definition of what constitutes a block an definition of useExtendedBlockDefinition
 * (Note: if the heading occurs more than once, acts on the first one only)
 * @param {TNote|TEditor} note
 * @param {string} heading
 * @param {boolean} useExtendedBlockDefinition (default: false)
 * @param {boolean} keepHeading - keep the heading after deleting contents (default: true)
 */
export function removeContentUnderHeading(note: CoreNoteFields, heading: string, useExtendedBlockDefinition: boolean = false, keepHeading: boolean = true) {
  // log(`NPParagraph/removeContentUnderHeading`, `In '${note.title ?? ''}' remove items under title: "${heading}"`)
  const para = note.paragraphs.find((p) => p.type === 'title' && p.content.includes(heading))
  if (para && para.lineIndex != null) {
    deleteEntireBlock(note, para, useExtendedBlockDefinition, keepHeading)
  } else {
    log(`NPParagraph/removeContentUnderHeading`, `did not find heading: "${heading}"`)
  }
}

/**
 * Insert text content under a given title (string)
 * @param {TNote|TEditor} destNote
 * @param {string} headingToFind - without the #
 * @param {string} parasAsText - text to insert (multiple lines, separated by newlines)
 * @param {number} headingLevel of the heading to insert where necessary (1-5, default 2)
 */
export async function insertContentUnderHeading(destNote: CoreNoteFields, headingToFind: string, parasAsText: string, headingLevel: number = 2) {
  log(`NPParagraph/insertContentUnderHeading`, `Called for '${headingToFind}' with ${parasAsText.split('\n').length} paras)`)
  const headingMarker = '#'.repeat(headingLevel)
  const startOfNote = findStartOfActivePartOfNote(destNote)
  let insertionIndex = startOfNote // top of note by default
  log(`NPParagraph/insertContentUnderHeading`, `insertionIndex = ${insertionIndex}`)
  for (let i = 0; i < destNote.paragraphs.length; i++) {
    const p = destNote.paragraphs[i]
    if (p.content.trim().includes(headingToFind) && p.type === 'title') {
      insertionIndex = i + 1
      break
    }
  }
  log(`NPParagraph/insertContentUnderHeading`, `insertionIndex = ${insertionIndex}`)
  // If we didn't find the heading, insert at the top of the note
  const paraText = insertionIndex === startOfNote && headingToFind !== '' ? `${headingMarker} ${headingToFind}\n${parasAsText}\n` : parasAsText
  await destNote.insertParagraph(paraText, insertionIndex, 'text')
}

/**
 * Replace content under a given heading (string)
 * See getParagraphBlock below for definition of what constitutes a block an definition of useExtendedBlockDefinition
 * @param {TNote|TEditor} note
 * @param {string} heading
 * @param {string} newContentText - text to insert (multiple lines, separated by newlines)
 * @param {boolean} useExtendedBlockDefinition
 * @param {number} headingLevel of the heading to insert where necessary (1-5, default 2)
 */
export async function replaceContentUnderHeading(
  note: TNote | TEditor,
  heading: string,
  newContentText: string,
  useExtendedBlockDefinition: boolean = false,
  headingLevel: number = 2,
) {
  log(`NPParagraph / replaceContentUnderHeading`, `In '${note.title ?? 'Untitled Note'}' replace items under heading: "${heading}"`)
  removeContentUnderHeading(note, heading, useExtendedBlockDefinition)
  await insertContentUnderHeading(note, heading, newContentText, headingLevel)
}

/**
 * Get the set of paragraphs that make up this block based on the current paragraph.
 * This is how we identify the block:
 * - current line, plus any children (indented paragraphs) that directly follow it
 * - if this line is a heading, then the current line and its following section
 *   (up until the next empty line, same-level heading or horizontal line).
 *
 * If setting 'useExtendedBlockDefinition' is true, then it can include more lines:
 * - it will work as if the cursor is on the preceding heading line,
 *   and take all its lines up until the next empty line, same-level heading,
 *   or horizontal line
 * NB: setting 'useExtendedBlockDefinition' defaults off (false)
 * @author @jgclark
 *
 * @param {[TParagraph]} allParas - all selectedParas in the note
 * @param {number} selectedParaIndex - the index of the current Paragraph
 * @param {boolean} useExtendedBlockDefinition
 * @return {[TParagraph]} the set of selectedParagraphs in the block
 */
export function getParagraphBlock(note: CoreNoteFields, selectedParaIndex: number, useExtendedBlockDefinition: boolean = false): Array<TParagraph> {
  const parasInBlock: Array<TParagraph> = [] // to hold set of paragraphs in block to return
  const endOfActiveSection = findEndOfActivePartOfNote(note)
  const startOfActiveSection = findStartOfActivePartOfNote(note)
  const allParas = note.paragraphs
  let startLine = selectedParaIndex
  let selectedPara = allParas[startLine]
  // log(
  //   `NPParagraph / getParagraphBlock`,
  //   `  getParaBlock: starting line ${selectedParaIndex}: '${selectedPara.content}'`,
  // )

  if (useExtendedBlockDefinition) {
    // First look earlier to find earlier lines up to a blank line or horizontal rule;
    // include line unless we hit a new heading, an empty line, or a less-indented line.
    for (let i = selectedParaIndex - 1; i >= startOfActiveSection - 1; i--) {
      const p = allParas[i]
      // log(`NPParagraph / getParagraphBlock`, `  ${ i } / ${p.type} / ${ p.content }`)
      if (p.type === 'separator') {
        // log(`NPParagraph / getParagraphBlock`, `      ${i}: Found separator line`)
        startLine = i + 1
        break
      } else if (p.content === '') {
        // log(`NPParagraph / getParagraphBlock`, `      ${i}: Found blank line`)
        startLine = i + 1
        break
      } else if (p.type === 'title') {
        // log(`NPParagraph / getParagraphBlock`, `      ${i}: Found heading`)
        startLine = i
        break
      }
    }
    log(`NPParagraph / getParagraphBlock`, `For extended block worked back and will now start at line ${startLine}`)
  }
  selectedPara = allParas[startLine]

  // if the first line is a heading, find the rest of its section
  if (selectedPara.type === 'title') {
    // includes all heading levels
    const thisHeadingLevel = selectedPara.headingLevel
    // log(`NPParagraph / getParagraphBlock`, `    Found heading level ${thisHeadingLevel}`)
    parasInBlock.push(selectedPara) // make this the first line to move
    // Work out how far this section extends. (NB: headingRange doesn't help us here.)
    for (let i = startLine + 1; i < endOfActiveSection; i++) {
      const p = allParas[i]
      if (p.type === 'title' && p.headingLevel <= thisHeadingLevel) {
        // log(`NPParagraph / getParagraphBlock`, `      ${i}: ${i}: Found new heading of same or higher level`)
        break
      } else if (p.type === 'separator') {
        // log(`NPParagraph / getParagraphBlock`, `      ${i}: Found HR`)
        break
      } else if (p.content === '') {
        // log(`NPParagraph / getParagraphBlock`, `      ${i}: Found blank line`)
        break
      }
      parasInBlock.push(p)
    }
    // log(`NPParagraph / getParagraphBlock`, `  Found ${ parasInBlock.length } heading section lines`)
  } else {
    // This isn't a heading
    const startingIndentLevel = selectedPara.indents
    log(`NPParagraph / getParagraphBlock`, `  Found single line with indent level ${startingIndentLevel}`)
    parasInBlock.push(selectedPara)

    // See if there are following indented lines to move as well
    for (let i = startLine + 1; i < endOfActiveSection; i++) {
      const p = allParas[i]
      // log(`NPParagraph / getParagraphBlock`, `  ${i} / indent ${p.indents} / ${p.content}`)
      // stop if horizontal line
      if (p.type === 'separator') {
        // log(`NPParagraph / getParagraphBlock`, `      ${i}: Found HR`)
        break
      } else if (p.type === 'title') {
        // log(`NPParagraph / getParagraphBlock`, `      ${i}: Found heading`)
        break
      } else if (p.content === '') {
        // log(`NPParagraph / getParagraphBlock`, `      ${i}: Found blank line`)
        break
      } else if (p.indents <= startingIndentLevel && !useExtendedBlockDefinition) {
        // if we aren't using the Extended Block Definition, then
        // stop as this selectedPara is same or less indented than the starting line
        // log(`NPParagraph / getParagraphBlock`, `      ${i}: Stopping as found same or lower indent`)
        break
      }
      parasInBlock.push(p) // add onto end of array
    }
  }

  log(`NPParagraph / getParagraphBlock`, `  Found ${parasInBlock.length} paras in block starting with: "${allParas[selectedParaIndex].content}"`)
  // for (const pib of parasInBlock) {
  //   log(`NPParagraph / getParagraphBlock`, `    ${ pib.content }`)
  // }
  return parasInBlock
}

/**
 * Get the paragraphs beneath a title/heading in a note (optionally return the contents without the heading)
 * Note: Moved from helpers/paragraph.js to avoid circular depdency problem with getParagraphBlock()
 * @author @dwertheimer
 * @tests available in jest file
 * @param {TNote} note
 * @param {TParagraph | string} heading
 * @param {boolean} returnHeading - whether to return the heading or not with the results (default: true)
 * @returns {TParagraph | null} - returns
 */
export function getBlockUnderHeading(note: TNote, heading: TParagraph | string, returnHeading: boolean = true): Array<TParagraph> | [] {
  let headingPara = null
  if (typeof heading === 'string') {
    headingPara = findHeading(note, heading)
  } else {
    headingPara = heading
  }
  let paras: Array<TParagraph> = []
  if (headingPara?.lineIndex !== null) {
    // $FlowFixMe(incompataible-use)
    paras = getParagraphBlock(note, headingPara.lineIndex)
  }
  if (paras.length && !returnHeading) {
    paras.shift() //remove the header paragraph
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
 * @return [Array, Array] - array of lines with matching term, and array of contexts for those lines (dates for daily notes; title for project notes).
 */
export async function gatherMatchingLines(
  notes: Array<TNote>,
  stringToLookFor: string,
  highlightResults: boolean = true,
  dateStyle: string = 'link',
  matchCase: boolean = false,
): Promise<[Array<string>, Array<string>]> {
  log('NPParagraph/gatherMatchingLines', `Looking for '${stringToLookFor}' in ${notes.length} notes`)

  CommandBar.showLoading(true, `Searching in ${notes.length} notes ...`)
  await CommandBar.onAsyncThread()

  const matches: Array<string> = []
  const noteContexts: Array<string> = []
  let i = 0
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
    const stringToLookForWithDelimiters = `[\\b\\s\\^]${stringToLookFor}[\\b\\s\\$]`
    const re = matchCase ? new RegExp(stringToLookForWithDelimiters) : new RegExp(stringToLookForWithDelimiters, 'i')
    const matchingParas = n.paragraphs.filter((q) => re.test(q.content))
    for (const p of matchingParas) {
      let matchLine = p.content
      // If the test is within a URL or the path of a [!][link](path) skip this result
      if (isTermInURL(stringToLookFor, matchLine)) {
        log('NPParagraph/gatherMatchingLines', `- Info: Match '${stringToLookFor}' ignored in '${matchLine} because it's in a URL`)
        continue
      }
      if (isTermInMarkdownPath(stringToLookFor, matchLine)) {
        log('NPParagraph/gatherMatchingLines', `- Info: Match '${stringToLookFor}' ignored in '${matchLine} because it's in a [...](path)`)
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
      // log('NPParagraph/gatherMatchingLines', `${n.title ?? ''}: ${matchLine}`)
      noteContexts.push(noteContext)
    }
    if (i % 50 === 0) {
      CommandBar.showLoading(true, `Searching in ${notes.length} notes ...`, i / notes.length)
    }
  }
  await CommandBar.onMainThread()
  CommandBar.showLoading(false)
  return [matches, noteContexts]
}

/**
 * Get the paragraph index of the start of the current selection, or 0 if no selection is active.
 * Note: Not currently used, I think.  See selectedLinesIndex instead (below).
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
  // log('NPParagraph/getSelectedParaIndex', `  Cursor/Selection.start: ${rangeToString(range)}`)

  // Work out what selectedPara number(index) this selected selectedPara is
  let firstSelParaIndex = 0
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    if (p.contentRange?.start === range.start) {
      firstSelParaIndex = i
      break
    }
  }
  // log('NPParagraph/getSelectedParaIndex', `  firstSelParaIndex = ${firstSelParaIndex}`)
  return firstSelParaIndex
}

/**
 * Get paragraph numbers of the start and end of the current selection in the Editor.
 * @author @jgclark
 *
 * @param {TRange} selection - the current selection rnage object
 * @return {[number, number]} the line index number of start and end of selection
 */
export function selectedLinesIndex(selection: Range, paragraphs: $ReadOnlyArray<TParagraph>): [number, number] {
  let firstSelParaIndex = 0
  let lastSelParaIndex = 0
  const startParaRange: Range = Editor.paragraphRangeAtCharacterIndex(selection.start)
  const endParaRange: Range = Editor.paragraphRangeAtCharacterIndex(selection.end)

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
  // console.log(`\t-> paraIndexes ${firstSelParaIndex}-${lastSelParaIndex}`)
  return [firstSelParaIndex, lastSelParaIndex]
}

/**
 * Remove all previously written blocks under a given heading in all notes (e.g. for deleting previous "TimeBlocks" or "SyncedCopoes")
 * This is DANGEROUS. Could delete a lot of content. You have been warned!
 * @param {Array<string>} noteTypes - the types of notes to look in -- e.g. ['calendar','notes']
 * @param {string} heading - the heading too look for in the notes
 * @param {boolean} keepHeading - whether to leave the heading in place afer all the content underneath is
 * @param {boolean} runSilently - whether to show CommandBar popups confirming how many notes will be affected - you should set it to 'yes' when running from a template
 */
export async function removeContentUnderHeadingInAllNotes(noteTypes: Array<string>, heading: string, keepHeading: boolean = false, runSilently: string = 'no'): Promise<void> {
  try {
    log(`NPParagraph`, `removeContentUnderHeadingInAllNotes running`)
    // For speed, let's first multi-core search the notes to find the notes that contain this string
    const prevCopies = await DataStore.search(heading, noteTypes)
    if (prevCopies.length) {
      let res = 'Yes'
      if (!(runSilently === 'yes')) {
        res = await showMessageYesNo(`Remove "${heading}"+content in ${prevCopies.length} notes?`)
      }
      if (res === 'Yes') {
        prevCopies.forEach(async (paragraph) => {
          if (paragraph.note != null) {
            await removeContentUnderHeading(paragraph.note, heading, false, keepHeading)
          }
        })
      }
    } else {
      if (!(runSilently === 'yes')) await showMessage(`Found no previous notes with "${heading}"`)
    }
    log(`NPParagraph`, `removeContentUnderHeadingInAllNotes found ${prevCopies.length} previous ${String(noteTypes)} notes with heading: "${heading}"`)
  } catch (error) {
    logError(`NPParagraph`, `removeContentUnderHeadingInAllNotes error: ${JSP(error)}`)
  }
}

/**
 * COPY FROM helpers/NPParagaph.js to avoid a circular dependency
 */
export function findHeading(note: TNote, heading: string): TParagraph | null {
  if (heading) {
    const paragraphs = note.paragraphs
    const para = paragraphs.find((paragraph) => paragraph.type === 'title' && paragraph.content.trim() === heading.trim())

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
      if (p.contentRange.start && p.contentRange.end) {
        const { start, end } = p.contentRange || {}
        if (start <= position && end >= position) {
          foundParagraph = p
          if (i > 0) {
            log(
              pluginJson,
              `getParagraphContainingPosition: paragraph before: ${i - 1} (${String(note.paragraphs[i - 1].contentRange?.start)}-${String(
                note.paragraphs[i - 1]?.contentRange?.end || 'n/a',
              )}) - "${note.paragraphs[i - 1].content}"`,
            )
          }
          log(pluginJson, `getParagraphContainingPosition: found position ${position} in paragraph ${i} (${start}-${end}) -- "${p.content}"`)
        }
      }
    }
  })
  if (!foundParagraph) {
    log(pluginJson, `getParagraphContainingPosition: *** Looking for cursor position ${position}`)
    note.paragraphs.forEach((p, i) => {
      const { start, end } = p.contentRange || {}
      log(pluginJson, `getParagraphContainingPosition: paragraph ${i} (${start}-${end}) "${p.content}"`)
    })
    log(pluginJson, `getParagraphContainingPosition: *** position ${position} not found`)
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
  //   const thisParagraph = Editor.selectedParagraphs // recommended by @eduard but currently not reliable (Editor.selectedParagraphs is empty on a new line)
  let thisParagraph
  if (typeof Editor.selection?.start === 'number') {
    thisParagraph = getParagraphContainingPosition(Editor, Editor.selection.start)
  }
  if (!thisParagraph || !Editor.selection?.start) {
    log(`NPParagraph`, `getSelectedParagraph: no paragraph found for cursor position Editor.selection?.start=${String(Editor.selection?.start)}`)
    await showMessage(`No paragraph found selection.start: ${String(Editor.selection?.start)} Editor.selectedParagraphs.length = ${Editor.selectedParagraphs?.length}`)
  }
  return thisParagraph || null
}
