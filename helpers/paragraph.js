// @flow
//-----------------------------------------------------------------------------
// Paragraph and block-level helpers functions
//-----------------------------------------------------------------------------

import { log, logError, logWarn } from './dev'

//-----------------------------------------------------------------------------
// Paragraph-level Functions

export const RE_URI = '(\\w+:\\/\\/[\\w\\.\\/\\?\\#\\&\\d\\-\\=%*,]+)'
export const RE_MARKDOWN_PATH = '\\[.+?\\]\\(([^\\s]*?)\\)'

/**
 * Check to see if search term is present within a URL or file path, using case sensitive searching.
 * Now updated to _not match_ if the search term is present in the rest of the line.
 * @author @jgclark
 * 
 * @tests available in jest file
 * @param {string} term - term to check
 * @param {string} string - string to check in
 * @return {boolean} true if found
 */
export function termInURL(term: string, searchString: string): boolean {
  // create version of searchString that doesn't include the URL and test that first
  const URIMatches = searchString.match(RE_URI) ?? []
  const thisURI = URIMatches[1] ?? ''
  if (thisURI !== '') {
    const restOfLine = searchString.replace(thisURI, '')
    if (restOfLine.match(term)) {
      return false
    } else {
      // create tailored Regex to test for presence of the term
      // const testTermInURI = `(\\w+:\\/\\/)[^\\s]*?${term}.*?[\\s\\.$]`
      return !!thisURI.match(term)
    }
  } else {
    // console.log(`  No URI -> false`)
    return false
  }
}

/**
 * Check to see if search term is present within the path of a [...](path), using case sensitive searching.
 * Now updated to _not match_ if the search term is present in the rest of the line.
 * @author @jgclark
 * 
 * @tests available in jest file
 * @param {string} term - term to check
 * @param {string} string - string to check in
 * @return {boolean} true if found
 */
export function termInMarkdownPath(term: string, searchString: string): boolean {
  // create version of searchString that doesn't include the URL and test that first
  const MDPathMatches = searchString.match(RE_MARKDOWN_PATH) ?? []
  const thisMDPath = MDPathMatches[1] ?? ''
  if (thisMDPath !== '') {
    const restOfLine = searchString.replace(thisMDPath, '')
    if (restOfLine.match(term)) {
      return false
    } else {
      // create tailored Regex to test for presence of the term
      // const testTermInMDPath = `\[.+?\]\([^\\s]*?${term}[^\\s]*?\)`
      return !!thisMDPath.match(term)
    }
  } else {
    // console.log(`  No MD path -> false`)
    return false
  }
}

/**
 * Pretty print range information
 * Note: This is a copy of what's in general.js to avoid circular dependency.
 * @author @EduardMe
 */
export function rangeToString(r: Range): string {
  if (r == null) {
    return 'Range is undefined!'
  }
  return `range: ${r.start}-${r.end}`
}

/**
 * Return title of note useful for display, including for
 * - daily calendar notes (the YYYYMMDD)
 * - weekly notes (the YYYY-Wnn)
 * Note: this is a local copy of the main helpers/general.js to avoid a circular dependency
 * @author @jgclark
 *
 * @param {?TNote} n - note to get title for
 * @return {string}
 */
export function displayTitle(n: ?TNote): string {
  return !n
    ? 'error'
    : n.type === 'Calendar' && n.date != null
    ? n.filename.split('.')[0] // without file extension
    : n.title ?? ''
}

/**
 * Convert paragraph(s) to single raw text string
 * @author @jgclark
 *
 * @param {[TParagraph]} paras - array of paragraphs
 * @return {string} - string representation of those paragraphs, without trailling newline
 */
export function parasToText(paras: Array<TParagraph>): string {
  // log('paragraph/parasToText', `starting with ${paras.length} paragraphs`)
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
        logWarn(
          'paragraph/calcSmartPrependPoint',
          `Couldn't find end of YAML frontmatter in note ${displayTitle(note)}`,
        )
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
  // log('paragraph/findEndOfActivePartOfNote', `  dHL = ${doneHeaderLine}, cHL = ${cancelledHeaderLine} endOfActive = ${endOfActive}`)
  return endOfActive
}

/**
 * Works out which is the last line of the frontmatter (or 0 if not present).
 * @author @jgclark
 *
 * @param {TNote} note - the note to assess
 * @return {number} - the line index number
 */
export function endOfFrontmatterLineIndex(note: TNote): number {
  const paras = note.paragraphs
  const lineCount = paras.length
  console.log(`starting with lineCount = ${lineCount}`)
  let inFrontMatter: boolean = false
  let lineIndex = 0
  while (lineIndex < lineCount) {
    const p = paras[lineIndex]
    if (p.type === 'separator') {
      if (!inFrontMatter) {
        inFrontMatter = true
      } else {
        inFrontMatter = false
        return lineIndex
      }
    }
    lineIndex++
  }
  return 0
}

/**
 * Works out where the first 'active' line of the note is, following the first paragraph of type 'title', or frontmatter (if present).
 * Additionally, it skips past any front-matter like section in a project note, as used by the Reviews plugin before frontmatter was supported.
 * This is indicated by a #hashtag starting the next line. If there is, run on to next heading or blank line.
 * Note: given this is a precursor to writing to a note, it first checks if the note is completely empty (0 lines). If so, a first 'empty' line is added, to avoid edge cases in calling code.
 * @author @jgclark
 *
 * @param {TNote} note - the note to assess
 * @return {number} - the line index number
 */
export function findStartOfActivePartOfNote(note: TNote): number {
  try {
    let paras = note.paragraphs
    // First check there's actually anything at all! If note, add a first empty paragraph
    if (paras.length === 0) {
      log(
        `paragraph/findStartOfActivePartOfNote`,
        `Note was empty; adding a blank line to make writing to the note work`,
      )
      note.appendParagraph('', 'empty')
      return 0
    }
    if (note.type === 'Calendar') {
      // Calendar notes are simple -> line index 0
      // But first check there's actually anything at all! If so -> NaN
      return 0
    } else {
      // Looking at project/regular notes
      // set line to start looking at: after H1 or frontmatter (if present)
      const endOfTitleOrFMIndex = endOfFrontmatterLineIndex(note)
      let startOfActive = endOfTitleOrFMIndex + 1
      if (paras.length === startOfActive) {
        // NB: length = line index + 1
        // There is no line after title or FM, so add a blank line to use
        log(
          'paragraph/findStartOfActivePartOfNote',
          `Added a blank line after title/frontmatter of '${displayTitle(note)}'`,
        )
        note.appendParagraph('', 'empty')
        paras = note.paragraphs
      }

      // additionally, we're going to skip past any front-matter like section in a project note,
      // indicated by a #hashtag starting the next line.
      // If there is, run on to next heading or blank line.
      if (paras[startOfActive].content.match(/^#\w/)) {
        for (let i = startOfActive; i < paras.length; i++) {
          const p = paras[i]
          if (p.type === 'title' || p.type === 'empty') {
            startOfActive = i + 1
            break
          }
        }
      }
      return startOfActive
    }
  } catch (err) {
    logError('paragraph/findStartOfActivePartOfNote', err.message)
    return NaN // for completeness
  }
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
  for (const p of paragraphs) {
    if (p.content === contentToFind) {
      return p
    }
  }
  logWarn('helper/getParaFromContent', `warning couldn't find '${contentToFind}`)
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
    if (
      lines[i].match(/^project:/i) ||
      lines[i].match(/^metadata:/i) ||
      lines[i].match(/^#[\w]/) ||
      lines[i].match(/(@review|@reviewed)\(.+\)/)
    ) {
      lineNumber = i
      break
    }
  }
  if (Number.isNaN(lineNumber)) {
    // If no metadataPara found, then insert one straight after the title
    console.log(`Warning: Can't find an existing metadata line, so will insert a new second line for it`)
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
  const ps = note.paragraphs ?? []
  let existingHeadingIndex // undefined
  // log('paragraph/removeSection', `remove '${heading}' from note '${displayTitle(note)}' with ${ps.length} paras`)
  let sectionHeadingLevel = 2

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
    // log('paragraph/removeSection', `-> removed ${psToRemove.length} paragraphs`)
    return existingHeadingIndex
  } else {
    return ps.length - 1 // end of the file (zero-based line index)
  }
}

/**
 * Find a heading/title that matches the string given
 * Note: There's a copy in helpers/NPParagaph.js to avoid a circular dependency
 * @author @dwertheimer
 * 
 * @param {TNote} note
 * @param {string} heading
 * @returns {TParagraph | null} - returns the actual paragraph or null if not found
 * @tests exist
 */
export function findHeading(note: TNote, heading: string): TParagraph | null {
  if (heading) {
    const paragraphs = note.paragraphs
    const para = paragraphs.find(
      (paragraph) => paragraph.type === 'title' && paragraph.content.trim() === heading.trim(),
    )

    if (para) return para
  }
  return null
}

/**
 * Takes a line of text, and shortens it to maxChars characters around the 
 * first matching 'term', at word boundaries (thanks to the power of regex!).
 * Adds ==highlight== if wanted.
 * @author @jgclark
 * 
 * @param {string} input string
 * @param {String} term to find/highlight
 * @param {boolean} addHighlight 
 * @param {number} maxChars to return around first matching term
 * @returns {string}
 */
export function trimAndHighlightSearchResult(
  input: string,
  term: string,
  addHighlight: boolean,
  maxChars: number = 80
): string {
  let output = input
  if (input.length > maxChars) {
    const LRSplit = Math.round(maxChars * 0.55)
    const re = new RegExp(`(?:^|\\b)(.{0,${String(LRSplit)}}${term}.{0,${String(maxChars - LRSplit)}})\\b\\w+`, "gi")
    const matches = input.match(re) ?? [] // multiple matches
    if (matches.length > 0) {
      output = matches.join(' ...')
      if (output.match(/^\W/)) { // i.e. starts with a non-word character (an approximation)
        output = `...${output}`
      }
      if (output.length < input.length) { // TODO: an approximation
        output = `${output} ...`
      }
      //
    } else {
      // For some reason we didn't find the matching term, so return first part of line
      return (output.length >= maxChars) ? output.slice(0, maxChars) : output
    }
  } else {
    // just pass input through to output
  }
  // Add highlighting if wanted (using defined Regex si can use 'g' flag)
  // (A simple .replace() command doesn't work as it won't keep capitalisation)
  if (addHighlight) {
    const re = new RegExp(term, "gi")
    const termMatches = output.matchAll(re)
    let offset = 0
    for (const tm of termMatches) {
      const leftPos = tm.index + offset // last adds previous ==...== additions
      const rightPos = leftPos + term.length
      const highlitOutput = `${output.slice(0, leftPos)}==${output.slice(leftPos, rightPos)}==${output.slice(rightPos,)}`
      output = highlitOutput
      offset += 4
    }
  }
  return output
}
