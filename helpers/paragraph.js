// @flow
//-----------------------------------------------------------------------------
// Paragraph and block-level helpers functions
//-----------------------------------------------------------------------------

import { getDateStringFromCalendarFilename } from './dateTime'
import { clo, logDebug, logError, logWarn } from './dev'
import {
  RE_MARKDOWN_LINK_PATH_CAPTURE,
  RE_NOTELINK_G,
  RE_SIMPLE_URI_MATCH,
} from '@helpers/regex'
import { stripLinksFromString } from '@helpers/stringTransforms'

//-----------------------------------------------------------------------------
/**
 * Perform substring match, ignoring case
 * Note: COPY TO AVOID CIRCULAR DEPENDENCY
 */
function caseInsensitiveSubstringMatch(searchTerm: string, textToSearch: string): boolean {
  const re = new RegExp(`${searchTerm}`, 'i') // = case insensitive match
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
  const searchStringWithoutURL = stripLinksFromString(searchString)
  const success = caseInsensitiveSubstringMatch(term, searchStringWithoutURL)
    ? false
    : RE_SIMPLE_URI_MATCH.test(searchString)

  // logDebug('isTermInURL', `looking for ${term} in ${searchString} ${String(caseInsensitiveSubstringMatch(term, searchStringWithoutURL))} / ${searchStringWithoutURL} ${String(RE_SIMPLE_URI_MATCH.test(searchStringWithoutURL))} -> ${String(success)}`)
  return success
}

/**
 * Is 'term' (typically a #tag) found in [[...]] or a URL in a string which may contain 0 or more notelinks and URLs?
 * @tests are in a commented-out function in jest file
 * @param {string} input
 * @param {string} term
 * @returns {boolean} true if found
 */
export function isTermInNotelinkOrURI(input: string, term: string): boolean {
  if (term === '') {
    logWarn(`isTermInNotelinkOrURI`, `empty search term`)
    return false
  }
  if (input === '') {
    logWarn(`isTermInNotelinkOrURI`, `empty input string to search`)
    return false
  }
  // Where is the term in the input?
  const index = input.indexOf(term)
  if (index < 0) {
    // logDebug(`isTermInNotelinkOrURI`, `term ${term} not found in'${input}'`)
    return false
  }
  // Find any [[...]] ranges
  const matches = input.matchAll(RE_NOTELINK_G)
  if (matches) {
    for (const match of matches) {
      clo(match)
      const rangeStart = match.index
      const rangeEnd = match.index + match[0].length
      // logDebug(`isTermInNotelinkOrURI`, `[[...]] range: ${String(rangeStart)}-${String(rangeEnd)}`)
      if (index >= rangeStart && index <= rangeEnd) {
        return true
      }
    }
  }
  // Check for URL ranges. Following isn't perfect, but close enough for URLs on their own or in a [markdown](link).
  return isTermInURL(term, input)
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
  const MDPathMatches = searchString.match(RE_MARKDOWN_LINK_PATH_CAPTURE) ?? []
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
 * Pretty print range information
 * Note: This is a copy of what's in general.js to avoid circular dependency.
 * @author @EduardMe
 */
export function contentRangeToString(content: string, r: TRange): string {
  if (r == null) {
    return 'Range is undefined!'
  }
  return `${content.slice(r.start, r.end + 1)} [${r.start}-${r.end}]`
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
    ? '(error)'
    : n.type === 'Calendar'
      ? getDateStringFromCalendarFilename(n.filename) ?? '' // earlier: return n.filename.split('.')[0] // without file extension
      : n.title ?? '(error)'
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
 * Appends text to a chosen note, but more smartly than usual.
 * I.e. adds before any ## Done or ## Completed archive section.
 * @author @jgclark
 *
 * @param {TNote} note - the note to append to
 * @param {string} paraText - the text to append
 * @param {ParagraphType} paragraphType - the usual paragraph type to append
 */
export function smartAppendPara(note: TNote, paraText: string, paragraphType: ParagraphType): void {
  // Insert the text at the smarter point (+ 1 as the API call inserts before the line in question)
  note.insertParagraph(paraText, findEndOfActivePartOfNote(note) + 1, paragraphType)
}

/**
 * Prepends text to a chosen note, but more smartly than usual.
 * I.e. if the note starts with YAML frontmatter
 * or a metadata line (= starts with a hashtag), then add after that.
 * @author @jgclark
 *
 * @param {TNote} note - the note to prepend to
 * @param {string} paraText - the text to prepend
 * @param {ParagraphType} paragraphType - the usual paragraph type to prepend
 */
export function smartPrependPara(note: TNote, paraText: string, paragraphType: ParagraphType): void {
  // Insert the text at the smarter point
  note.insertParagraph(paraText, findStartOfActivePartOfNote(note), paragraphType)
}

/**
 * Works out where the first 'active' line of the note is, following the first paragraph of type 'title', or frontmatter (if present).
 * Additionally, it skips past any front-matter like section in a project note, as used by the Reviews plugin before frontmatter was supported.
 * This is indicated by a #hashtag starting the next line. If there is, run on to next heading or blank line.
 * A task/checklist item marks the end of the frontmatter-like section.
 * Note: given this is a precursor to writing to a note, it first checks if the note is completely empty (0 lines). If so, a first 'empty' line is added, to avoid edge cases in calling code.
 * Note: Really should live in helpers/NPParagraph.js, but that introduces a circular dependency, so leaving here.
 * @author @jgclark
 * @tests in jest file
 * @param {TNote} note - the note to assess
 * @param {boolean} allowPreamble?
 * @returns {number} - the line index number
 */
export function findStartOfActivePartOfNote(note: CoreNoteFields, allowPreamble?: boolean = false): number {
  try {
    let startOfActive = NaN
    let paras = note.paragraphs
    // First check there's actually anything at all! If note, add a first empty paragraph
    if (paras.length === 0) {
      // logDebug(`paragraph/findStartOfActivePartOfNote`, `Note was empty; adding a blank line to make writing to the note work`)
      note.appendParagraph('', 'empty')
      return 0
    }

    const endOfFMIndex = endOfFrontmatterLineIndex(note)
    if (endOfFMIndex === 0) {
      // No frontmatter found
      if (paras[0].type === 'title' && paras[0].headingLevel === 1) {
        // logDebug(`paragraph/findStartOfActivePartOfNote`, `No frontmatter, but H1 title found -> next line`)
        startOfActive = 1
      } else {
        // logDebug(`paragraph/findStartOfActivePartOfNote`, `No frontmatter or H1 title found -> first line`)
        startOfActive = 0
      }
    } else {
      // logDebug(`paragraph/findStartOfActivePartOfNote`, `Frontmatter found, finishing at line ${String(endOfFMIndex)}, so looking at line after it`)
      startOfActive = endOfFMIndex + 1
    }
    // If there is no line after title or FM, add a blank line to use (NB: length = line index + 1)
    if (paras.length === startOfActive) {
      // logDebug('paragraph/findStartOfActivePartOfNote', `Added a blank line after title/frontmatter of '${displayTitle(note)}'`)
      note.appendParagraph('', 'empty')
      paras = note.paragraphs
      startOfActive = paras.length
    }

    logDebug('paragraph/findStartOfActivePartOfNote', `- startOfActive so far = ${String(startOfActive)}. allowPreamble: ${allowPreamble ? 'true' : 'false'}`)
    // Additionally, skip past any front-matter-like section in a project note,
    // if either there's a #hashtag starting the next line,
    // or 'allowPreamble' is true.
    // If there is, run on to next heading or blank line (if found) otherwise, just the next line. Finding a separator or any YouTutype of task or checklist also stops the search.
    if (allowPreamble || paras[startOfActive].type === 'text' && paras[startOfActive].content.match(/^#\w/)) {
      logDebug('paragraph/findStartOfActivePartOfNote', `- We want to allow preamble, or found a metadata line.`)
    // startOfActive += 1
      for (let i = startOfActive; i < paras.length; i++) {
        const p = paras[i]
        if (['open', 'done', 'scheduled', 'cancelled', 'checklist', 'checklistDone', 'checklistScheduled', 'checklistCancelled', 'title', 'code'].includes(p.type)) {
          logDebug('paragraph/findStartOfActivePartOfNote', `  - Found task/checklist/title/code line -> this line.`)
          startOfActive = i
          break
        }
        else if (p.type === 'separator' || p.type === 'empty') {
          logDebug('paragraph/findStartOfActivePartOfNote', `  - Found separator/blank -> next line.`)
          startOfActive = i + 1
          break
        }
      }
      logDebug('paragraph/findStartOfActivePartOfNote', `-> ${String(startOfActive)}  (after finding preamble or metadata line)`)
    }
    return startOfActive
  }
  catch (err) {
    logError('paragraph/findStartOfActivePartOfNote', err.message)
    return NaN // for completeness
  }
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
  try {
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
  catch (err) {
    logError('paragraph/findEndOfActivePartOfNote', err.message)
    return NaN // for completeness
  }
}

/**
 * Works out which is the last line of the frontmatter, returning the line index number of the closing separator, or 0 if no frontmatter found.
 * TODO: Move to NPFrontMatter.js ?
 * @author @jgclark
 * @param {TNote} note - the note to assess
 * @returns {number} - the line index number of the closing separator, or 0 if no frontmatter found
 */
export function endOfFrontmatterLineIndex(note: CoreNoteFields): number {
  try {
  const paras = note.paragraphs
  const lineCount = paras.length
  // logDebug(`paragraph/endOfFrontmatterLineIndex`, `total paragraphs in note (lineCount) = ${lineCount}`)
  if (paras.filter((p) => p.type === 'separator').length < 2) {
    // can't have frontmatter as less than 2 separators
    return 0
  }
  let inFrontMatter: boolean = false
  let lineIndex = 0
    while (lineIndex < lineCount) {
      const p = paras[lineIndex]
      if (p.type === 'separator') {
        // logDebug(`paragraph/endOfFrontmatterLineIndex`, `  - ${String(lineIndex)}: ${String(inFrontMatter)}: ${p.type}`)
        if (!inFrontMatter) {
          inFrontMatter = true
        } else {
          inFrontMatter = false
          // logDebug(`paragraph/endOfFrontmatterLineIndex`, `-> ${String(lineIndex)}`)
          return lineIndex
        }
      }
      lineIndex++
    }
    return 0
  }
  catch (err) {
    logError('paragraph/findEndOfActivePartOfNote', err.message)
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

/**
 * Get number of consecutive '!' in 'content' that aren't at the start/end of a word, or preceding a '['
 * From 3.9.4 there are also `>>` working-on markers at the start of 'content', which are treated as priority 5.
 * @param {string} content
 * @returns {string} number of !, or 5 if line is flagged as 'working-on', or -1
 */
export function getTaskPriority(content: string): number {
  let numExclamations = 0
  if (content.match(/\B\!+\B(?!\[)/)) { // not in middle of word, or starting an image tag
    // $FlowIgnore[incompatible-use]
    numExclamations = content.match(/\B\!+\B/)[0].length
    return numExclamations
  }
  if (content.match(/^>>/)) {
    return 4
  }
  return 0
}

/**
 * Remove task Priority Indicators (!, !!, !!!, >>) from content, though not starting an image tag, or at start/end of a word
 * @param {string} content
 * @returns {string} content minus any priority indicators
 */
export function removeTaskPriorityIndicators(content: string): string {
  let output = content.replace(/\B\!+\B(?!\[)/g, '') // not in middle of word, or starting an image tag
  output = output.replace(/^>>\s?/, '') // start of line only
  return output
}

/**
 * Change the priority in a task to '!', '!!', '!!!', '>>' (or remove priority)
 * @author @dwertheimer updated by @jgclark
 * @param {TParagraph} input - the task/pagraph to be processed
 * @param {string} priorityString - the new priority (!,!!,!!! or '' for none)
 * @param {boolean} - commit the change after the change is made (default false)
 * @returns {string} the resulting updated paragraph's content
 * Note: If the third param is missing or false, THE CHANGE HAS NOT BEEN COMMITTED YET. You should use note.updateParagraph(s) to commit the change you receive back.
 * Note: Ideally lives in NPParagraph.js, but putting it here avoids a circular dependency
 */
export function changePriority(inputPara: TParagraph, prioStr: string, commitChange?: boolean = false): string {
  const outputPara = inputPara
  outputPara.content = outputPara.content.replace(/!\s*/g, '').replace(/\s+!/g, '').replace(/^>>\s/, '')
  outputPara.content = `${prioStr ? `${prioStr} ` : ''}${outputPara.content}`.trim()
  commitChange && outputPara.note ? outputPara.note.updateParagraph(outputPara) : null
  return outputPara.content
}

const PRIORITY_LEVELS = ['', '!', '!!', '!!!', '>>']

/**
 * Cycle the priority level of a task: none -> ! -> !! -> !!! -> >> -> none
 * Written to suit a single UI window in the Dashboard.
 * @author @jgclark
 * @param {TParagraph} input - the task/pagraph to be processed
 * @returns {string} the resulting updated paragraph's content
 */
export function cyclePriorityState(input: TParagraph): string {
  const currentPriorityLevel = getTaskPriority(input.content)
  const newPriorityLevel = (currentPriorityLevel + 1) % 5
  return changePriority(input, PRIORITY_LEVELS[newPriorityLevel], true)
}
