// @flow
//-----------------------------------------------------------------------------
// Paragraph and block-level helpers functions
//-----------------------------------------------------------------------------

import { hyphenatedDateString } from './dateTime'
import { log, logError, logWarn } from './dev'

//-----------------------------------------------------------------------------
// Paragraph-level Constants

/**
 * Test if this is a Horizontal Line line
 * based on my best understanding of the [Commonmark spec](https://spec.commonmark.org/0.30/#thematic-break)
 * NB: this won't be needed from v3.4.1 as there will then be paragraph type 'separator'. TODO(jgclark):
 * @author @jgclark
 */
export const RE_HORIZONTAL_LINE = `^ {0,3}((\\_\\h*){3,}|(\\*\\h*){3,}|(\\-\\h*){3,})$`

//-----------------------------------------------------------------------------
// Paragraph-level Functions

/**
 * Check to see if search term is present within a URL or file path
 * @author @jgclark

 * @param {string} term - term to check
 * @param {string} string - string to check in
 * @return {boolean} true if found
 */
export function termInURL(term: string, searchString: string): boolean {
  // create tailored Regex to test for presence of the term in the file/URL
  const testTermInURI = `(?:https?://|file:/)[^\\s]*?${term}.*?[\\s\\.$]`
  return !!searchString.match(testTermInURI)
}

/**
 * Pretty print range information
 * NB: This is a copy of what's in general.js to avoid circular dependency.
 * @author @EduardMe
 */
export function rangeToString(r: Range): string {
  if (r == null) {
    return 'Range is undefined!'
  }
  return `range: ${r.start}-${r.end}`
}

/**
 * Return title of note useful for display, even for calendar notes (the YYYYMMDD)
 * NB: this fn is a local copy of the one in helpers/general.js to avoid circular dependency
 * @author @jgclark
 *
 * @param {TNote} n - note
 * @return {string} - title to use
 */
function displayTitle(n: TNote): string {
  if (n.type === 'Calendar' && n.date != null) {
    return hyphenatedDateString(n.date)
  } else {
    return n.title ?? ''
  }
}

/**
 * Convert paragraph(s) to single raw text string
 * @author @jgclark
 *
 * @param {[TParagraph]} paras - array of paragraphs
 * @return {string} - string representation of those paragraphs, without trailling newline
 */
export function parasToText(paras: Array<TParagraph>): string {
  // console.log('parasToText: starting with ' + paras.length + ' paragraphs')
  let text = ''
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i]
    text += `${p.rawContent}\n` // NB: rawContent needed here
  }
  const parasAsText = text.trimEnd() // remove extra newline not wanted after last line
  return parasAsText
}

/**
 * Print out all data for a paragraph as JSON-style string
 * @author @EduardMe
 *
 * @param {TParagraph} p - paragraph to print
 */
export function printParagraph(p: TParagraph) {
  if (p === null) {
    logError('paragraph/printParagraph', `paragraph is undefined`)
    return
  }

  const { content, type, prefix, contentRange, lineIndex, date, heading, headingRange, headingLevel, isRecurring, indents, filename, noteType, linkedNoteTitles, referencedBlocks, blockId } = p

  const logObject = {
    content,
    type,
    prefix,
    contentRange,
    lineIndex,
    date,
    heading,
    headingRange,
    headingLevel,
    isRecurring,
    indents,
    filename,
    noteType,
    linkedNoteTitles,
    referencedBlocks,
    blockId
  }

  console.log(JSON.stringify(logObject, null, 2))
}

/**
 * Works out which line to insert at top of file. Rather than just after title line,
 * go after any YAML frontmatter or a metadata line (= starts with a hashtag).
 * @author @jgclark
 *
 * @param {TNote} note - the note of interest
 * @return {number} line - the calculated line to insert/prepend at
 */
export function calcSmartPrependPoint(note: TNote): number {
  const lines = note.content?.split('\n') ?? ['']

  // By default we prepend at line 1, i.e. right after the Title line
  let insertionLine = note.type === 'Calendar' ? 0 : 1
  // If we have any content, check for these special cases
  if (lines.length > 0) {
    if (lines[0] === '---') {
      // console.log(`YAML start found. Will check ${lines.length} lines`)
      // We (probably) have a YAML block
      // Find end of YAML/frontmatter
      for (let i = 1; i < lines.length; i++) {
        if (lines[i] === '---' || lines[i] === '...') {
          // console.log(`YAML end at ${i}`)
          insertionLine = i + 1
          break
        }
      }
      if (insertionLine === 1) {
        // If we get here we haven't found an end to the YAML block.
        console.log(`Warning: couldn't find end of YAML frontmatter in note ${displayTitle(note)}`)
        // It's not clear what to do at this point, so will leave insertion point as is
      }
    } else if (lines[1].match(/^#[A-z]/)) {
      // We have a hashtag at the start of the line, making this a metadata line
      // Move insertion point to after the next blank line, or before the next
      // heading line, whichever is sooner.
      // console.log(`Metadata line found`)
      for (let i = 2; i < lines.length; i++) {
        // console.log(`${i}: ${lines[i]}`)
        if (lines[i].match(/^#{1,5}\s/)) {
          // console.log(`  Heading at ${i}`)
          insertionLine = i + 1
          break
        } else if (lines[i] === '') {
          // console.log(`  Blank line at ${i}`)
          insertionLine = i + 1
          break
        }
      }
    }
  }
  // Return the smarter insertionLine number
  return insertionLine
}

/**
 * Prepends a task to a chosen note, but more smartly than usual.
 * I.e. if the note starts with YAML frontmatter (e.g. https://docs.zettlr.com/en/core/yaml-frontmatter/)
 * or a metadata line (= starts with a hashtag), then add after that.
 * @author @jgclark
 *
 * @param {TNote} note - the note to prepend to
 * @param {string} paraText - the text to prepend
 * @param {ParagraphType} paragraphType - the usual paragraph type to prepend
 */
export function smartPrependPara(note: TNote, paraText: string, paragraphType: ParagraphType): void {
  // Insert the text at the smarter insertionLine line
  note.insertParagraph(paraText, calcSmartPrependPoint(note), paragraphType)
}

/**
 * Works out where the first ## Done or ## Cancelled section starts, if present.
 * Works with folded Done or Cancelled sections.
 * If not, return the last paragraph index.
 * @author @jgclark
 *
 * @param {TNote} note - the note to assess
 * @return {number} - the index number
 */
export function findEndOfActivePartOfNote(note: TNote): number {
  const paras = note.paragraphs
  const lineCount = paras.length
  let doneHeaderLine = 0
  let cancelledHeaderLine = 0
  for (let i = 0; i < lineCount; i++) {
    const p = paras[i]
    if (p.headingLevel === 2 && p.content.startsWith('Done')) {
      doneHeaderLine = i
    }
    if (p.headingLevel === 2 && p.content.startsWith('Cancelled')) {
      cancelledHeaderLine = i
    }
  }
  const endOfActive = doneHeaderLine > 0 ? doneHeaderLine : cancelledHeaderLine > 0 ? cancelledHeaderLine : lineCount
  // console.log(`  dHL = ${doneHeaderLine}, cHL = ${cancelledHeaderLine} endOfActive = ${endOfActive}`)
  return endOfActive
}

/**
 * Works out where the first line of the note is, following the first paragraph
 * of type 'title'. If it doesn't find one it defaults to the first non-blank line
 * after any frontmatter (if present)
 * @author @jgclark
 *
 * @param {TNote} note - the note to assess
 * @return {number} - the line index number
 */
export function findStartOfActivePartOfNote(note: TNote): number {
  const paras = note.paragraphs
  const lineCount = paras.length
  let startOfActive: number = 0 // default to line 0, the H1 line
  let inFrontMatter: boolean = false
  let i = 0
  while (i < lineCount) {
    const p = paras[i]
    if (p.type === 'title') {
      startOfActive = i + 1
      break
    }
    if (p.type === 'separator') {
      if (!inFrontMatter) {
        inFrontMatter = true
      } else {
        inFrontMatter = false
        startOfActive = i + 1
        break
      }
    }
    if (p.type !== 'empty') {
      startOfActive = i
    }
    i++
  }
  return startOfActive
}

/**
 * Get paragraph numbers of the start and end of the current selection in the Editor
 * @author @jgclark
 *
 * @param {TRange} selection - the current selection rnage object
 * @return {[number, number]} the line index number of start and end of selection
 */
export function selectedLinesIndex(selection: Range, paragraphs: $ReadOnlyArray<TParagraph>): [number, number] {
  let firstSelParaIndex = 0
  let lastSelParaIndex = 0
  // console.log(`\tSelection: ${rangeToString(selection)}`)
  const startParaRange = Editor.paragraphRangeAtCharacterIndex(selection.start)
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
  // Now get the first paragraph, and as many following ones as are in that block
  // console.log(`\t-> paraIndexes ${firstSelParaIndex}-${lastSelParaIndex}`)
  return [firstSelParaIndex, lastSelParaIndex]
}

/**
 * Get paragraph index of the start of the current selection in the Editor.
 * Note: this is a simpler version of the selectedLinesIndex() function above.
 * @author @jgclark
 *
 * @return {number} the line index number of start of selection
 */
export function getSelectedParaIndex(): number {
  const { paragraphs, selection } = Editor
  // Get current selection, and its range
  if (selection == null) {
    logWarn('paragraph/getSelectedParaIndex', `No selection found, so stopping.`)
    return 0
  }
  const range = Editor.paragraphRangeAtCharacterIndex(selection.start)
  // log('paragraph/getSelectedParaIndex', `Cursor/Selection.start: ${rangeToString(range)}`)

  // Work out what selectedPara number (index) this selected selectedPara is
  let firstSelParaIndex = 0
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    if (p.contentRange?.start === range.start) {
      firstSelParaIndex = i
      break
    }
  }
  // log('paragraph/getSelectedParaIndex', `  firstSelParaIndex = ${firstSelParaIndex}`)
  return firstSelParaIndex
}

/**
 * Get the paragraph from the passed content (using exact match)
 * @author @jgclark
 *
 * @param {string} contentToFind
 * @return {TParagraph | void} pargraph object with that content, or null if not found
 */
export function getParaFromContent(note: TNote, contentToFind: string): TParagraph | void {
  const { paragraphs } = note
  let result = 0 // default result
  for (let p of paragraphs) {
    if (p.content === contentToFind) {
      return p
    }
  }
  logWarn('paragraph/getParaFromContent', `couldn't find '${contentToFind}`)
  return
}

/**
 * Works out which line (if any) of the current note is a metadata line, defined as
 * - line starting 'project:' or 'medadata:'
 * - first line containing a @review() mention
 * - first line starting with a hashtag
 * If these can't be found, then create a new line for this after the title line.
 * @author @jgclark
 *
 * @param {TNote} note to use
 * @return {number} the line number for the metadata line
 */
export function getOrMakeMetadataLine(note: TNote): number {
  let lineNumber: number = NaN
  const lines = note.content?.split('\n') ?? ['']
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].match(/^project:/i) || lines[i].match(/^metadata:/i) || lines[i].match(/^#[\w]/) || lines[i].match(/(@review|@reviewed)\(.+\)/)) {
      lineNumber = i
      break
    }
  }
  if (lineNumber === NaN) {
    // If no metadataPara found, then insert one straight after the title
    logWarn('paragraph/getOrMakeMetadataLine', `Can't find an existing metadata line, so will insert a new second line for it`)
    Editor.insertParagraph('', 1, 'empty')
    lineNumber = 1
  }
  // console.log(`Metadata line = ${lineNumber}`)
  return lineNumber
}

/**
 * Get the set of paragraphs that make up this block based on the current paragraph.
 * This is how we identify the block:
 * - current line, plus any children (indented paragraphs) that directly follow it
 * - if this line is a heading, then the current line and its following section
 *   (up until the next empty line, same-level heading or horizontal line).
 * 
 * If parameter 'useExtendedBlockDefinition' is true, then it can include more lines:
 * - it will work as if the cursor is on the preceding heading line,
 *   and take all its lines up until the next empty line, same-level heading,
 *   or horizontal line
 * @author @jgclark
 * 
 * @param {[TParagraph]} allParas - all selectedParas in the note
 * @param {number} selectedParaIndex - the index of the current Paragraph
 * @param {boolean} useExtendedBlockDefinition
 * @return {[TParagraph]} the set of selectedParagraphs in the block
 */
export function getParagraphBlock(
  note: TNote,
  selectedParaIndex: number,
  useExtendedBlockDefinition: boolean = false
): Array<TParagraph> {
  const parasInBlock: Array<TParagraph> = [] // to hold set of paragraphs in block to return
  const endOfActiveSection = findEndOfActivePartOfNote(note)
  const startOfActiveSection = findStartOfActivePartOfNote(note)
  const allParas = note.paragraphs
  let startLine = selectedParaIndex
  let selectedPara = allParas[startLine]
  log('paragraph/getParaBlock', `  getParaBlock: starting line ${selectedParaIndex}: '${selectedPara.content}'`)

  if (useExtendedBlockDefinition) {
    // First look earlier to find earlier lines up to a blank line or horizontal rule;
    // include line unless we hit a new heading, an empty line, or a less-indented line.
    for (let i = selectedParaIndex - 1; i >= (startOfActiveSection - 1); i--) {
      const p = allParas[i]
      // log(pluginJson, `  ${i} / ${p.type} / ${p.content}`)
      if (p.type === 'separator') {
        log('paragraph/getParaBlock', `      ${i}: Found separator line`)
        startLine = i + 1
        break
      } else if (p.content === '') {
        log('paragraph/getParaBlock', `      ${i}: Found blank line`)
        startLine = i + 1
        break
      } else if (p.type === 'title') {
        log('paragraph/getParaBlock', `      ${i}: Found heading`)
        startLine = i
        break
      }
    }
    log('paragraph/getParaBlock', `For extended block worked back and will now start at line ${startLine}`)
  }
  selectedPara = allParas[startLine]

  // if the first line is a heading, find the rest of its section
  if (selectedPara.type === 'title') {
    // includes all heading levels
    const thisHeadingLevel = selectedPara.headingLevel
    log('paragraph/getParaBlock', `    Found heading level ${thisHeadingLevel}`)
    parasInBlock.push(selectedPara) // make this the first line to move
    // Work out how far this section extends. (NB: headingRange doesn't help us here.)
    for (let i = startLine + 1; i < endOfActiveSection; i++) {
      const p = allParas[i]
      if (p.type === 'title' && p.headingLevel <= thisHeadingLevel) {
        log('paragraph/getParaBlock', `      ${i}: ${i}: Found new heading of same or higher level`)
        break
      } else if (p.type === 'separator') {
        log('paragraph/getParaBlock', `      ${i}: Found HR`)
        break
      } else if (p.content === '') {
        log('paragraph/getParaBlock', `      ${i}: Found blank line`)
        break
      }
      parasInBlock.push(p)
    }
    // log('paragraph/getParaBlock', `  Found ${parasInBlock.length} heading section lines`)
  } else {
    // This isn't a heading
    const startingIndentLevel = selectedPara.indents
    log('paragraph/getParaBlock', `  Found single line with indent level ${startingIndentLevel}`)
    parasInBlock.push(selectedPara)

    // See if there are following indented lines to move as well
    for (let i = startLine + 1; i < endOfActiveSection; i++) {
      const p = allParas[i]
      log('paragraph/getParaBlock', `  ${i} / indent ${p.indents} / ${p.content}`)
      // stop if horizontal line
      if (p.type === 'separator') {
        log('paragraph/getParaBlock', `      ${i}: Found HR`)
        break
      } else if (p.type === 'title') {
        log('paragraph/getParaBlock', `      ${i}: Found heading`)
        break
      } else if (p.content === '') {
        log('paragraph/getParaBlock', `      ${i}: Found blank line`)
        break
      } else if (p.indents <= startingIndentLevel && !useExtendedBlockDefinition) {
        // if we aren't using the Extended Block Definition, then
        // stop as this selectedPara is same or less indented than the starting line
        log('paragraph/getParaBlock', `      ${i}: Stopping as found same or lower indent`)
        break
      }
      parasInBlock.push(p) // add onto end of array
    }
  }

  log('paragraph/getParaBlock', `  Found ${parasInBlock.length} paras in block:`)
  // for (const pib of parasInBlock) {
  //   log('paragraph/getParaBlock', `    ${pib.content}`)
  // }
  return parasInBlock
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
 * @param {string} heading to remove
 * @return {number} lineIndex of the found heading, or if not found the last line of the note
 */
export function removeSection(note: TNote, heading: string): number {
  const ps = note.paragraphs
  let existingHeadingIndex = ps.length // start at end of file
  let sectionHeadingLevel = 2
  // log('paragraph/removeSection', `'${heading}' from note '${note.title ?? ''}' with ${ps.length} paras:`)

  for (const p of ps) {
    if (p.type === 'title' && p.content.startsWith(heading)) {
      existingHeadingIndex = p.lineIndex
      sectionHeadingLevel = p.headingLevel
    }
  }

  if (existingHeadingIndex !== undefined && existingHeadingIndex < ps.length) {
    // Work out the set of paragraphs to remove
    const psToRemove = []
    note.removeParagraph(ps[existingHeadingIndex])
    for (let i = existingHeadingIndex + 1; i < ps.length; i++) {
      // stop removing when we reach heading of same or higher level
      if (ps[i].type === 'title' && ps[i].headingLevel <= sectionHeadingLevel) {
        break
      }
      psToRemove.push(ps[i])
    }

    // Delete the saved set of paragraphs
    note.removeParagraphs(psToRemove)
    log('paragraph/removeSection', `  -> removed ${psToRemove.length} paragraphs`)
    return existingHeadingIndex
  } else {
    return ps.length
  }
}
