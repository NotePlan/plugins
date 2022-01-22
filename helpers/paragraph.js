// @flow
//-----------------------------------------------------------------------------
// Paragraph and block-level helpers functions
//-----------------------------------------------------------------------------

import { hyphenatedDateString } from './dateTime'

//-----------------------------------------------------------------------------
// Paragraph-level Constants

/**
 * Test if this is a Horizontal Line line
 * based on my best understanding of the [Commonmark spec](https://spec.commonmark.org/0.30/#thematic-break)
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
    console.log('ERROR: paragraph is undefined')
    return
  }

  const {
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
  } = p

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
export function smartPrependPara(
  note: TNote,
  paraText: string,
  paragraphType: ParagraphType,
): void {
  // Insert the text at the smarter insertionLine line
  note.insertParagraph(paraText, calcSmartPrependPoint(note), paragraphType)
}

//
/**
 * Works out where the first ## Done or ## Cancelled section starts, if present.
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
    if (p.headingLevel === 2 && p.content === 'Done') {
      doneHeaderLine = i
    }
    if (p.headingLevel === 2 && p.content === 'Cancelled') {
      cancelledHeaderLine = i
    }
  }
  const endOfActive =
    doneHeaderLine > 0
      ? doneHeaderLine
      : cancelledHeaderLine > 0
        ? cancelledHeaderLine
        : lineCount
  // console.log(`  dHL = ${doneHeaderLine}, cHL = ${cancelledHeaderLine} endOfActive = ${endOfActive}`)
  return endOfActive
}

/**
 * Get paragraph number of the start of the current selection in the Editor
 * @author @jgclark
 * 
 * @param {TRange} selection - the current selection rnage object
 * @return {number} the index number
 */
export function selectedLinesIndex(
  selection: Range,
  paragraphs: $ReadOnlyArray<TParagraph>
): number {
  let firstSelParaIndex = 0
  console.log(`\tSelection: ${rangeToString(selection)}`)
  const range = Editor.paragraphRangeAtCharacterIndex(selection.start)

  // Get the set of selected paragraphs (which can be different from selection),
  // and work out what selectedPara number(index) this selected selectedPara is
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    if (p.contentRange?.start === range.start) {
      firstSelParaIndex = i
      break
    }
  }
  // Now get the first paragraph, and as many following ones as are in that block
  console.log(`\t-> firstSelParaIndex = ${firstSelParaIndex}`)
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
  console.log(`gPFC: warning couldn't find '${contentToFind}`)
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
 * @return {number} the line number for the metadata line
 */
export function getOrMakeMetadataLine(): number {
  let lineNumber
  const lines = Editor?.content?.split('\n') ?? ['']
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].match(/^project:/i)
      || lines[i].match(/^metadata:/i)
      || lines[i].match(/^#[\w]/)
      || lines[i].match(/(@review|@reviewed)\(.+\)/))
    {
      lineNumber = i
      break
    }
  }
  if (lineNumber === undefined) {
    // If no metadataPara found, then insert one straight after the title
    console.log(
    `Warning: Can't find an existing metadata line, so will insert a new second line for it`,
    )
    Editor.insertParagraph('', 1, 'empty')
    lineNumber = 1
  }
  // console.log(`Metadata line = ${lineNumber}`)
  return lineNumber
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
  console.log(
    `\tremoveSection: '${heading}' from note '${note.title ?? ''}' with ${ps.length} paras:`,
  )

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
    console.log(`\t  -> removed ${psToRemove.length} paragraphs`)
    return existingHeadingIndex
  } else {
    return ps.length
  }
}
