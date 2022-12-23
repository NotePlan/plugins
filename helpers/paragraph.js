// @flow
//-----------------------------------------------------------------------------
// Paragraph and block-level helpers functions
//-----------------------------------------------------------------------------

import { logDebug, logError, logWarn } from './dev'

//-----------------------------------------------------------------------------
// Paragraph-level Functions

export const RE_URI = '(\\w+:\\/\\/[\\w\\.\\/\\?\\#\\&\\d\\-\\=%*,]+)'
export const RE_MARKDOWN_PATH = '\\[.+?\\]\\(([^\\s]*?)\\)'
export const RE_SYNC_MARKER = '\\^[A-Za-z0-9]{6}'

/**
 * Perform substring match, ignoring case
 * Note: COPY TO AVOID CIRCULAR DEPENDENCY
 */
function caseInsensitiveSubstringMatch(searchTerm: string, textToSearch: string): boolean {
  const re = new RegExp(`${searchTerm}`, "i") // = case insensitive match
  return re.test(textToSearch)
}


/**
 * Check to see if search term is present within a URL or file path, using case insensitive searching.
 * Now updated to _not match_ if the search term is present in the rest of the line.
 * @author @jgclark
 *
 * @tests available in jest file
 * @param {string} term - term to check
 * @param {string} string - string to check in
 * @return {boolean} true if found
 */
export function isTermInURL(term: string, searchString: string): boolean {
  // create version of searchString that doesn't include the URL and test that first
  const URIMatches = searchString.match(RE_URI) ?? []
  const thisURI = URIMatches[1] ?? ''
  if (thisURI !== '') {
    const restOfLine = searchString.replace(thisURI, '')
    if (caseInsensitiveSubstringMatch(term, restOfLine)) {
      return false
    } else {
      return caseInsensitiveSubstringMatch(term, thisURI)
    }
  } else {
    // logDebug('paragraph/isTermInURL', `- No URI -> false`)
    return false
  }
}

/**
 * Check to see if search term is present within the path of a [...](path), using case insensitive searching.
 * Now updated to _not match_ if the search term is present in the rest of the line.
 * @author @jgclark
 *
 * @tests available in jest file
 * @param {string} term - term to check
 * @param {string} string - string to check in
 * @return {boolean} true if found
 */
export function isTermInMarkdownPath(term: string, searchString: string): boolean {
  // create version of searchString that doesn't include the URL and test that first
  const MDPathMatches = searchString.match(RE_MARKDOWN_PATH) ?? []
  const thisMDPath = MDPathMatches[1] ?? ''
  if (thisMDPath !== '') {
    const restOfLine = searchString.replace(thisMDPath, '')
    if (caseInsensitiveSubstringMatch(term, restOfLine)) {
      return false
    } else {
      return caseInsensitiveSubstringMatch(term, thisMDPath)
      // earlier: create tailored Regex to test for presence of the term
      // const testTermInMDPath = `\[.+?\]\([^\\s]*?${term}[^\\s]*?\)`
    }
  } else {
    // logDebug('paragraph/isTermInMarkdownPath', `No MD path -> false`)
    return false
  }
}

/**
 * Pretty print range information
 * Note: This is a copy of what's in general.js to avoid circular dependency.
 * @author @EduardMe
 */
export function rangeToString(r: TRange): string {
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
export function displayTitle(n: ?CoreNoteFields): string {
  return !n
    ? 'error'
    : n.type === 'Calendar' && ((n: $FlowFixMe): TNote).date != null
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
  // logDebug('paragraph/parasToText', `starting with ${paras.length} paragraphs`)
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

  const { content, type, prefix, contentRange, lineIndex, date, heading, headingRange, headingLevel, isRecurring, indents, filename, noteType, linkedNoteTitles } = p

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
  logDebug('paragraph/printParagraph', JSON.stringify(logObject, null, 2))
}

/**
 * Works out which line to insert at top of file. Rather than just after title line,
 * go after any YAML frontmatter or a metadata line (= starts with a hashtag).
 * @author @jgclark
 * @tests in jest file
 *
 * @param {TNote} note - the note of interest
 * @return {number} line - the calculated line to insert/prepend at
 */
export function calcSmartPrependPoint(note: TNote): number {
  const lines = note.paragraphs.map((s) => s.content)
  logDebug('paragraph/calcSmartPrependPoint', `Starting with ${lines.length} lines`)

  // By default we prepend at line 1, i.e. right after the Title line for regulat notes
  let insertionLine = note.type === 'Calendar' ? 0 : 1
  // If we have any content, check for these special cases
  if (lines.length > 0) {
    if (lines[0] === '---') {
      logDebug('paragraph/calcSmartPrependPoint', `- YAML start found. Will check ${lines.length} lines`)
      // We (probably) have a YAML block
      // Find end of YAML/frontmatter
      for (let i = 1; i < lines.length; i++) {
        if (lines[i] === '---' || lines[i] === '...') {
          // logDebug('???', `YAML end at ${i}`)
          insertionLine = i + 1
          break
        }
      }
      if (insertionLine === 1) {
        // If we get here we haven't found an end to the YAML block.
        logWarn('paragraph/calcSmartPrependPoint', `- Couldn't find end of YAML frontmatter in note ${displayTitle(note)}`)
        // It's not clear what to do at this point, so will leave insertion point as is
      }
    } else if (lines.length >= 2 && lines[1].match(/^#[A-z]/)) {
      // We have a hashtag at the start of the line, making this a metadata line
      // Move insertion point to after the next blank line, or before the next
      // heading line, whichever is sooner.
      logDebug('paragraph/calcSmartPrependPoint', `- Metadata line found`)
      for (let i = 2; i < lines.length; i++) {
        // logDebug('???', `${i}: ${lines[i]}`)
        if (lines[i].match(/^#{1,5}\s/)) {
          logDebug('paragraph/calcSmartPrependPoint', `  - Heading at ${i}`)
          insertionLine = i + 1
          break
        } else if (lines[i] === '') {
          logDebug('paragraph/calcSmartPrependPoint', `  - Blank line at ${i}`)
          insertionLine = i + 1
          break
        }
      }
    } else {
      logDebug('paragraph/calcSmartPrependPoint', `  - neither frontmatter nor metadata line found -> line ${insertionLine}`)
    }
  }
  // Return the smarter insertionLine number
  return insertionLine
}

/**
 * Prepends text to a chosen note, but more smartly than usual.
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
 * Works out where the first ## Done or ## Cancelled section starts, if present, and returns the paragraph before that.
 * Works with folded Done or Cancelled sections.
 * If the result is a separator, use the line before that instead
 * If neither Done or Cancelled present, return the last non-empty lineIndex.
 * @author @jgclark
 * @tests in jest file
 *
 * @param {TNote} note - the note to assess
 * @returns {number} - the index number (counting from zero)
 */
export function findEndOfActivePartOfNote(note: CoreNoteFields): number {
  const paras = note.paragraphs
  let lineCount = paras.length

  // If no lines, return 0
  if (lineCount === 0) {
    return 0
  } else {
    // If last line is empty, ignore it.
    if (paras[paras.length - 1].type === 'empty') {
      // logDebug('paragraph/findEndOfActivePartOfNote', `last para is empty so ignoring it`)
      lineCount--
    }

    // Find first example of ## Done
    const doneHeaderLines = paras.filter((p) => p.headingLevel === 2 && p.content.startsWith('Done')) ?? []
    let doneHeaderLine = doneHeaderLines.length > 0 ? doneHeaderLines[0].lineIndex : 0
    // Now check to see if previous line was a separator; if so use that line instead
    if (doneHeaderLine > 2 && paras[doneHeaderLine - 1].type === 'separator') {
      doneHeaderLine -= 1
    }
    // Find first example of ## Cancelled
    const cancelledHeaderLines = paras.filter((p) => p.headingLevel === 2 && p.content.startsWith('Cancelled')) ?? []
    let cancelledHeaderLine = cancelledHeaderLines.length > 0 ? cancelledHeaderLines[0].lineIndex : 0
    // Now check to see if previous line was a separator; if so use that line instead
    if (cancelledHeaderLine > 2 && paras[cancelledHeaderLine - 1].type === 'separator') {
      cancelledHeaderLine -= 1
    }

    const endOfActive = doneHeaderLine > 1 ? doneHeaderLine - 1 : cancelledHeaderLine > 1 ? cancelledHeaderLine - 1 : lineCount > 1 ? lineCount - 1 : 0
    // logDebug('paragraph/findEndOfActivePartOfNote', `doneHeaderLine = ${doneHeaderLine}, cancelledHeaderLine = ${cancelledHeaderLine} endOfActive = ${endOfActive}`)
    return endOfActive
  }
}

/**
 * Works out which is the last line of the frontmatter (or 0 if not present).
 * @author @jgclark
 *
 * @param {TNote} note - the note to assess
 * @return {number} - the line index number
 */
export function endOfFrontmatterLineIndex(note: CoreNoteFields): number {
  const paras = note.paragraphs
  const lineCount = paras.length
  logDebug(`paragraph/endOfFrontmatterLineIndex`, `total paragraphs in note (lineCount) = ${lineCount}`)
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
 * Note: for a calendar note, the start is always lineIndex 0
 * @author @jgclark
 *
 * @param {TNote} note - the note to assess
 * @return {number} - the line index number
 */
export function findStartOfActivePartOfNote(note: CoreNoteFields): number {
  try {
    let paras = note.paragraphs
    // First check there's actually anything at all! If note, add a first empty paragraph
    if (paras.length === 0) {
      logDebug(`paragraph/findStartOfActivePartOfNote`, `Note was empty; adding a blank line to make writing to the note work`)
      note.appendParagraph('', 'empty')
      return 0
    }
    if (note.type === 'Calendar') {
      // Calendar notes are simple -> line index 0
      return 0
    } else {
      // Looking at project/regular notes
      // set line to start looking at: after H1 or frontmatter (if present)
      const endOfTitleOrFMIndex = endOfFrontmatterLineIndex(note)
      let startOfActive = endOfTitleOrFMIndex + 1
      if (paras.length === startOfActive) {
        // NB: length = line index + 1
        // There is no line after title or FM, so add a blank line to use
        logDebug('paragraph/findStartOfActivePartOfNote', `Added a blank line after title/frontmatter of '${displayTitle(note)}'`)
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
 * @param {CoreNoteFields} note
 * @param {string} contentToFind
 * @return {TParagraph | void} pargraph object with that content, or null if not found
 */
export function getParaFromContent(note: CoreNoteFields, contentToFind: string): TParagraph | void {
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
 * Find a note's heading/title that matches the string given
 * Note: There's a copy in helpers/NPParagaph.js to avoid a circular dependency
 * @author @dwertheimer
 *
 * @param {CoreNoteFields} note
 * @param {string} headingToFind to find (exact match if includesString is set to false)
 * @param {boolean} includesString - search for a paragraph which simply includes the string vs. exact match (default: false - require strict match)
 * @returns {TParagraph | null} - returns the actual paragraph or null if not found
 * @tests in jest file
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
 * Find a note's heading/title whose start matches the given string (ignoring case).
 * Example: given 'JOURNAL' matches heading 'Journal for 3.4.22' or the other way around
 * @author @jgclark
 *
 * @param {CoreNoteFields} note
 * @param {string} headingToFind
 * @returns {string} - returns the matching (probably shorter) title/heading or empty if not found
 * @tests in jest file
 */
export function findHeadingStartsWith(note: CoreNoteFields, headingToFind: string): string {
  if (headingToFind) {
    const headingToFindLC = headingToFind.toLowerCase()
    const paragraphs = note.paragraphs
    const para = paragraphs.find(
      (paragraph) =>
        paragraph.type === 'title' &&
        (paragraph.content.toLowerCase().startsWith(headingToFindLC) ||
          headingToFindLC === paragraph.content.toLowerCase() ||
          headingToFindLC.startsWith(paragraph.content.toLowerCase())),
    )

    if (para) return para.content
  }
  return ''
}

/**
 * Remove duplicate synced lines (same content, same blockID, different files), and return only one copy of each
 * @param {Array<TParagraph>} paras
 * @returns {Array<TParagraph>} unduplicated paragraphs
 * @author @dwertheimer
 */
export function removeDuplicateSyncedLines(paras: $ReadOnlyArray<TParagraph>): $ReadOnlyArray<TParagraph> {
  const notSyncedArr = [],
    syncedMap = new Map()
  paras.forEach(function (p) {
    if (p.blockId) {
      syncedMap.set(p.blockId, p)
    } else {
      notSyncedArr.push(p)
    }
  })
  return [...syncedMap.values(), ...notSyncedArr]
}
