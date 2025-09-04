// @flow
//-----------------------------------------------------------------------------
// Paragraph and block-level helpers functions
//-----------------------------------------------------------------------------

import { getDateStringFromCalendarFilename } from './dateTime'
import { clo, logDebug, logError, logInfo, logWarn } from './dev'
import { getElementsFromTask } from './sorting'
import { endOfFrontmatterLineIndex } from '@helpers/NPFrontMatter'
import {
  RE_DONE_MENTION,
  RE_EVENT_LINK,
  RE_MARKDOWN_LINK_PATH_CAPTURE,
  RE_MARKDOWN_LINK_PATH_CAPTURE_G,
  RE_NOTELINK_G,
  RE_SIMPLE_URI_MATCH,
  RE_SIMPLE_URI_MATCH_G,
} from '@helpers/regex'
import { getLineMainContentPos } from '@helpers/search'
import { stripLinksFromString } from '@helpers/stringTransforms'

//-----------------------------------------------------------------------------

/**
 * Perform substring match, ignoring case
 * Note: COPY TO AVOID CIRCULAR DEPENDENCY from search.js
 */
function caseInsensitiveSubstringMatch(searchTerm: string, textToSearch: string): boolean {
  try {
    // First need to escape any special characters in the search term
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`${escapedSearchTerm}`, 'i') // = case insensitive match
    logDebug('caseInsensitiveSubstringMatch', `re: ${re.toString()} / textToSearch: ${textToSearch} / ${String(re.test(textToSearch))}`)
    return re.test(textToSearch)
  } catch (error) {
    logError('paragraph/caseInsensitiveSubstringMatch', `Error matching '${searchTerm}' to '${textToSearch}': ${error.message}`)
    return false
  }
}

/**
 * Return a version of 'input' that removes the path of any markdown links, and any URLs, and the contents of any note links.
 * Also trims off whitespace from the result.
 * @author @jgclark
 *
 * @param {string} input
 * @returns {string}
 */
export function stripAllURIsAndNoteLinks(input: string): string {
  let output = input
  output = output.replace(RE_SIMPLE_URI_MATCH_G, '')
  output = output.replace(RE_NOTELINK_G, '')
  // Remove the path of any markdown links
  const matches = Array.from(output.matchAll(RE_MARKDOWN_LINK_PATH_CAPTURE_G))
  // logDebug('stripAllURIsAndNoteLinks', `matches: ${String(matches)}`)
  if (matches) {
    for (const match of matches) {
      // replace the whole markdown link match with just the title
      output = output.replace(match[0], match[1])
    }
  }
  output = output.trim()
  return output
}

/**
 * Remove (first) @done(YYYY-MM-DD HH:MM[AM|PM]) mention from a string
 * @author @jgclark
 *
 * @tests available in jest file
 * @param {string} input
 * @returns {string}
 */
export function stripDoneDateTimeMentions(input: string): string {
  logDebug('stripDoneMentions', `input: ${input} / ${String(RE_DONE_MENTION)}`)
  return input.replace(RE_DONE_MENTION, '')
}

/**
 * Check to see if search term is present within a string potentially containing aURL or file path, using case insensitive searching.
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
  const success = caseInsensitiveSubstringMatch(term, searchStringWithoutURL) ? false : RE_SIMPLE_URI_MATCH.test(searchString)

  // logDebug('isTermInURL', `looking for ${term} in ${searchString} ${String(caseInsensitiveSubstringMatch(term, searchStringWithoutURL))} / ${searchStringWithoutURL} ${String(RE_SIMPLE_URI_MATCH.test(searchStringWithoutURL))} -> ${String(success)}`)
  return success
}

/**
 * Is 'term' (typically a #tag) found in a string potentially containing a URL [[...]] or a URL in a string which may contain 0 or more notelinks and URLs?
 *
 * @tests available in jest file
 * @param {string} term - term to check for
 * @param {string} input - string to search in
 * @returns {boolean} true if found
 */
export function isTermInNotelinkOrURI(term: string, input: string): boolean {
  try {
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
      // logDebug(`isTermInNotelinkOrURI`, `term ${term} not found in '${input}'`)
      return false
    }
    // Find any [[...]] ranges
    const matches = input.matchAll(RE_NOTELINK_G)
    if (matches) {
      for (const match of matches) {
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
  } catch (error) {
    logError(`isTermInNotelinkOrURI`, error.message)
    return false
  }
}

/**
 * Is 'term' (typically a #tag) found in hidden parts of an NP Event Link `![📅](...)`?  I.e. Returns true only if it matches within UUID or Color-code part.
 *
 * @tests available in jest file
 * @param {string} term - term to check for
 * @param {string} input - string to search in
 * @returns {boolean} true if found
 */
export function isTermInEventLinkHiddenPart(term: string, input: string): boolean {
  try {
    if (term === '') {
      logWarn(`isTermInEventLinkHiddenPart`, `empty search term`)
      return false
    }
    if (input === '') {
      logWarn(`isTermInEventLinkHiddenPart`, `empty input string to search`)
      return false
    }
    // Where is the term in the input?
    const index = input.indexOf(term)
    if (index < 0) {
      // logDebug(`isTermInEventLinkHiddenPart`, `term ${term} not found in '${input}'`)
      return false
    }
    // Find the (first) event link
    const matches = input.match(RE_EVENT_LINK)
    // logDebug(`isTermInEventLinkHiddenPart`, `matches: ${String(matches)}`)
    if (matches) {
      const eventUUID = matches[0].split(':::')[1]
      const eventColorCode = matches[2]
      logDebug(`isTermInEventLinkHiddenPart`, `Match in {${matches[0]}} / eventUUID: ${eventUUID} eventColorCode: ${eventColorCode} index: ${index}`)
      if (eventUUID.includes(term) || eventColorCode.includes(term)) {
        return true
      }
    }
    return false
  } catch (error) {
    logError(`isTermInEventLinkHiddenPart`, error.message)
    return false
  }
}

/**
 * Check to see if search term is present in 'path' part of a string potentially containing a markdown link [...](path), using case insensitive searching.
 * Now updated to _not match_ if the search term is present in the rest of the line.
 * FIXME: errors in tests now, and termNotInURL.
 * @author @jgclark
 *
 * @tests available in jest file
 * @param {string} term - term to check
 * @param {string} string - string to check in
 * @return {boolean} true if found
 */
export function isTermInMarkdownPath(term: string, searchString: string): boolean {
  try {
    // create version of searchString that doesn't include the URL and test that first
    const MDPathMatches = searchString.match(RE_MARKDOWN_LINK_PATH_CAPTURE) ?? []
    const thisMDPath = MDPathMatches[1] ?? ''
    if (thisMDPath !== '') {
      const restOfLine = searchString.replace(thisMDPath, '')
      // logDebug('isTermInMarkdownPath', `MDPathMatches: ${String(MDPathMatches)} / thisMDPath: ${thisMDPath} / restOfLine: ${restOfLine}`)
      if (caseInsensitiveSubstringMatch(term, restOfLine)) {
        // logDebug('isTermInMarkdownPath', `Found in rest of line -> false`)
        return false
      } else {
        return caseInsensitiveSubstringMatch(term, thisMDPath)
        // earlier: create tailored Regex to test for presence of the term
        // const testTermInMDPath = `\[.+?\]\([^\\s]*?${term}[^\\s]*?\)`
      }
    } else {
      // logDebug('isTermInMarkdownPath', `No MD path -> false`)
      return false
    }
  } catch (error) {
    logError(`isTermInMarkdownPath`, error.message)
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
 * Convert paragraph(s) to single raw text string that can be used to add multiple lines in a single API call,
 * without losing indents.
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
 * Note: see smartPrependParas that works on multiple lines
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
 * Appends multiple lines of text to a chosen note, as separate paragraphs, but more smartly than usual.
 * I.e. adds before any ## Done or ## Completed archive section.
 * Note: does work on a single line too
 * @author @jgclark
 * @test in jgclark.QuickCapture/index.js
 *
 * @param {TNote} note - the note to append to
 * @param {Array<string>} paraTextArr - an array of text to append
 * @param {Array<ParagraphType>} paragraphTypeArr - a matching array of the type of the paragraphs to append
 */
export function smartAppendParas(note: TNote, paraTextArr: Array<string>, paraTypeArr: Array<ParagraphType>): void {
  // Get the smarter insertion point
  const firstInsertionLine = findEndOfActivePartOfNote(note) + 1
  logDebug('paragraph/smartAppendParas', `inserting ${String(paraTextArr.length)} paras; firstInsertionLine = ${firstInsertionLine}`)
  // Insert the text as paragraphs from this point
  for (let i = 0; i < paraTextArr.length; i++) {
    logDebug('paragraph/smartAppendParas', `- ${String(i)}: "${paraTextArr[i]}" type ${paraTypeArr[i]}`)
    note.insertParagraph(paraTextArr[i], firstInsertionLine + i, paraTypeArr[i])
  }
}

/**
 * Prepends multiple lines of text to a chosen note, as separate paragraphs, but more smartly than usual.
 * I.e. if the note starts with YAML frontmatter
 * or a metadata line (= starts with a hashtag), then add after that.
 * Note: does work on a single line too
 * @author @jgclark
 * @test in jgclark.QuickCapture/index.js
 *
 * @param {TNote} note - the note to prepend to
 * @param {Array<string>} paraTextArr - an array of text to prepend
 * @param {Array<ParagraphType>} paragraphTypeArr - a matching array of the type of the paragraphs to prepend
 */
export function smartPrependParas(note: TNote, paraTextArr: Array<string>, paraTypeArr: Array<ParagraphType>): void {
  // Get the smarter insertion point
  const firstInsertionLine = findStartOfActivePartOfNote(note)
  logDebug('paragraph/smartPrependParas', `inserting ${String(paraTextArr.length)} paras; firstInsertionLine = ${firstInsertionLine}`)
  // Insert the text as paragraphs from this point
  for (let i = 0; i < paraTextArr.length; i++) {
    logDebug('paragraph/smartPrependParas', `- ${String(i)}: "${paraTextArr[i]}" type ${paraTypeArr[i]}`)
    note.insertParagraph(paraTextArr[i], firstInsertionLine + i, paraTypeArr[i])
  }
}

/**
 * Add a new paragraph and preceding heading(s) to a note. If the headings already exist, then don't add them again, but insert the paragraph after the existing headings.
 * @test in jgclark.QuickCapture/index.js
 *
 * @param {TNote} destNote
 * @param {string} paraText
 * @param {ParagraphType} paragraphType
 * @param {Array<string>} headingArray - the headings from H1 (or H2) downwards
 * @param {number} firstHeadingLevel - the level of the first heading given (1, 2, 3, etc.)
 * @param {boolean} shouldAppend - whether to append the paragraph after the headings or not.
 */
export function smartCreateSectionsAndPara(
  destNote: TNote,
  paraText: string,
  paragraphType: ParagraphType,
  headingArray: Array<string>,
  firstHeadingLevel: number,
  shouldAppend: boolean = false,
): void {
  try {
    // Work out which of the given headings already exist.
    // Form a parallel array of existing headings, with empty strings for any that don't exist.
    const existingHeadingParas = []
    let notExistingHeadings = 0
    for (const h of headingArray) {
      const existingHeading = findHeading(destNote, h)
      if (existingHeading) {
        existingHeadingParas.push(existingHeading)
      } else {
        // Heading doesn't exist, so add an empty string to the array
        existingHeadingParas.push('')
        notExistingHeadings++
      }
    }

    logDebug('paragraph/smartCreateSectionsAndPara', `existingHeadingParas: [${String(existingHeadingParas.map((p) => p.content || ''))}]`)
    let latestInsertionLineIndex = findStartOfActivePartOfNote(destNote)

    // Now use insertHeading() to add any headings that don't already exist
    if (notExistingHeadings > 0) {
      // Get start of active part of note
      // Add the headings
      for (let i = 0; i < existingHeadingParas.length; i++) {
        if (existingHeadingParas[i] !== '') {
          const thisHeadingPara = existingHeadingParas[i]
          latestInsertionLineIndex = thisHeadingPara.lineIndex + 1
          logDebug(
            'paragraph/smartCreateSectionsAndPara',
            `noting existing heading "${thisHeadingPara.content}" at line ${String(latestInsertionLineIndex - 1)} level ${String(thisHeadingPara.headingLevel)}`,
          )
        } else {
          // Heading doesn't exist, so add it
          let insertionIndex = 0
          if (shouldAppend) {
            insertionIndex = findEndOfActivePartOfNote(destNote) + 1
          } else {
            insertionIndex = latestInsertionLineIndex
          }
          // $FlowFixMe[incompatible-call] headingLevel is a number, but the API expects an enumeration
          destNote.insertHeading(headingArray[i], insertionIndex, firstHeadingLevel + i) // add the heading
          logDebug('paragraph/smartCreateSectionsAndPara', `added heading "${headingArray[i]}" at line ${String(insertionIndex)} level ${String(firstHeadingLevel + i)}`)
          latestInsertionLineIndex = insertionIndex + 1
        }
      }
    } else {
      logDebug('paragraph/smartCreateSectionsAndPara', `all existingHeadingParas found, so only need to add the paragraph`)
    }

    // Finally add the paragraph after the last heading in headingArray
    destNote.addParagraphBelowHeadingTitle(paraText, paragraphType, headingArray[headingArray.length - 1], false, false)
    logDebug('paragraph/smartCreateSectionsAndPara', `inserting para after heading "${headingArray[headingArray.length - 1]}" (i.e. line ${String(latestInsertionLineIndex + 1)})`)
  } catch (err) {
    logError('paragraph/smartCreateSectionsAndPara', err.message)
  }
}

/**
 * Insert multiple lines of text to a chosen note, as separate paragraphs
 * Note: does work on a single line too.
 * @author @jgclark
 * @test in jgclark.QuickCapture/index.js
 *
 * @param {TNote} note - the note to prepend to
 * @param {number} insertionIndex - the line to insert the text at
 * @param {Array<string>} paraTextArr - an array of text to prepend
 * @param {Array<ParagraphType>} paragraphTypeArr - a matching array of the type of the paragraphs to prepend
 */
export function insertParas(note: TNote, insertionIndex: number, paraTextArr: Array<string>, paraTypeArr: Array<ParagraphType>): void {
  if (!note) {
    logError('paragraph/insertParas', `note is undefined`)
    return
  }
  if (insertionIndex < 0) {
    logError('paragraph/insertParas', `insertionIndex is negative: ${insertionIndex}. Stopping.`)
    return
  }
  if (insertionIndex > note.paragraphs.length) {
    logError('paragraph/insertParas', `insertionIndex (${insertionIndex}) is greater than the number of paragraphs in the note (${note.paragraphs.length}). Stopping.`)
    return
  }
  logDebug('paragraph/insertParas', `inserting ${String(paraTextArr.length)} paras; starting at line = ${insertionIndex}`)
  // Insert the text as paragraphs from this point
  for (let i = 0; i < paraTextArr.length; i++) {
    logDebug('paragraph/insertParas', `- ${String(i)}: "${paraTextArr[i]}" type ${paraTypeArr[i]}`)
    note.insertParagraph(paraTextArr[i], insertionIndex + i, paraTypeArr[i])
  }
}

/**
 * Works out where the first 'active' line of the note is, following the first paragraph of type 'title', or frontmatter (if present).
 * Additionally, it skips past any front-matter-like section in a project note, as used by the Reviews plugin before frontmatter was supported.
 * This is indicated by a #hashtag starting the next line. If there is, run on to next heading or blank line.
 * A task/checklist item marks the end of the frontmatter-like section.
 * Note: given this is a precursor to writing to a note, it first checks if the note is completely empty (0 lines). If so, a first 'empty' line is added, to avoid edge cases in calling code.
 * Note: now also copes with a frontmatter section but with a `# title` line that comes after it.
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
      logInfo(`paragraph/findStartOfActivePartOfNote`, `Note was empty; adding a blank line to make writing to the note work`)
      note.appendParagraph('', 'empty')
      return 0
    }

    const endOfFMIndex: number = endOfFrontmatterLineIndex(note) || 0
    logDebug(`paragraph/findStartOfActivePartOfNote`, `endOfFMIndex: ${String(endOfFMIndex)}`)
    if (endOfFMIndex === 0) {
      // No frontmatter found
      if (paras[0].type === 'title' && paras[0].headingLevel === 1) {
        logDebug(`paragraph/findStartOfActivePartOfNote`, `No frontmatter, but H1 title found -> next line`)
        startOfActive = 1
      } else {
        logDebug(`paragraph/findStartOfActivePartOfNote`, `No frontmatter or H1 title found -> first line`)
        startOfActive = 0
      }
    } else {
      logDebug(`paragraph/findStartOfActivePartOfNote`, `Frontmatter found, finishing at line ${String(endOfFMIndex)}, so looking at line after it`)
      startOfActive = endOfFMIndex + 1
      // But if that line is a `# title` line, then skip it
      if (paras[startOfActive].type === 'title' && paras[startOfActive].headingLevel === 1) {
        startOfActive += 1
      }
    }
    // If there is no line after title or FM, add a blank line to use (NB: length = line index + 1)
    if (paras.length === startOfActive) {
      logDebug(
        'paragraph/findStartOfActivePartOfNote',
        `Added a blank line after title/frontmatter of '${displayTitle(note)}' because paras.length=${paras.length} === startOfActive=${startOfActive}`,
      )
      note.appendParagraph('', 'empty')
      paras = note.paragraphs
      startOfActive = paras.length - 1
    }

    logDebug(
      'paragraph/findStartOfActivePartOfNote',
      `- startOfActive so far = ${String(startOfActive)}. allowPreamble: ${allowPreamble ? 'true' : 'false'} paras.length=${paras.length}`,
    )
    // Additionally, skip past any front-matter-like section in a project note,
    // if either there's a #hashtag starting the next line,
    // or 'allowPreamble' is true.
    // If there is, run on to next heading or blank line (if found) otherwise, just the next line. Finding a separator or any YouTutype of task or checklist also stops the search.
    if (allowPreamble || (paras[startOfActive] && paras[startOfActive].type === 'text' && paras[startOfActive].content.match(/^#\w/))) {
      // logDebug('paragraph/findStartOfActivePartOfNote', `- We want to allow preamble, or found a metadata line.`)
      // startOfActive += 1
      for (let i = startOfActive; i < paras.length; i++) {
        const p = paras[i]
        if (['open', 'done', 'scheduled', 'cancelled', 'checklist', 'checklistDone', 'checklistScheduled', 'checklistCancelled', 'title', 'code'].includes(p.type)) {
          // logDebug('paragraph/findStartOfActivePartOfNote', `  - Found task/checklist/title/code line -> this line.`)
          startOfActive = i
          break
        } else if (p.type === 'separator' || p.type === 'empty') {
          // logDebug('paragraph/findStartOfActivePartOfNote', `  - Found separator/blank -> next line.`)
          startOfActive = i + 1
          break
        }
      }
      logDebug('paragraph/findStartOfActivePartOfNote', `-> ${String(startOfActive)}  (after finding preamble or metadata line)`)
    }
    return startOfActive
  } catch (err) {
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
  } catch (err) {
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
 * Find a note's heading/title that matches the string given.
 * Note: There's a copy in helpers/NPParagaph.js to avoid a circular dependency
 * @author @dwertheimer
 *
 * @param {CoreNoteFields} note
 * @param {string} headingToFind to find (exact match if includesString is set to false)
 * @param {boolean} includesString - search for a paragraph which simply includes the string vs. exact match (default: false - require strict match)
 * @returns {TParagraph | null} - returns the actual paragraph or null if not found
 * @tests in jest file
 */
export function findHeading(note: CoreNoteFields, headingToFind: string, includesString: boolean = false): TParagraph | null {
  if (headingToFind && headingToFind !== '') {
    const paragraphs = note.paragraphs
    const para = paragraphs.find(
      (paragraph) => paragraph.type === 'title' && (includesString ? paragraph.content.includes(headingToFind) : paragraph.content.trim() === headingToFind.trim()),
    )

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
  const notSyncedArr = []
  const syncedMap: Map<string, TParagraph> = new Map()
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
 * From 3.9.4 there are also `>>` working-on markers at the start of 'content', which are treated as priority 4.
 * @param {string} content
 * @returns {string} number of !, or 4 if line is flagged as 'working-on', or -1
 */
export function getTaskPriority(content: string): number {
  let numExclamations = 0
  if (content.match(/\B\!+\B(?!\[)/)) {
    // not in middle of word, or starting an image tag
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
 * Remove task Priority Indicators (!, !!, !!!, >>) from start of content (was: any where in line except starting an image tag, or at start/end of a word).
 * @param {string} content
 * @returns {string} content minus any priority indicators
 */
export function removeTaskPriorityIndicators(content: string): string {
  // let output = content.replace(/\B\!+\B(?!\[)/g, '') // not in middle of word, or starting an image tag
  let output = content.replace(/^!{1,3}\s/, '') // start of line only
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
 * Cycle the priority level of a task up: none -> ! -> !! -> !!! -> >> -> none
 * Written originally to suit a single UI window in the Dashboard.
 * @author @jgclark
 * @param {TParagraph} input - the task/pagraph to be processed
 * @returns {string} the resulting updated paragraph's content
 */
export function cyclePriorityStateUp(input: TParagraph): string {
  const currentPriorityLevel = getTaskPriority(input.content)
  const newPriorityLevel = (currentPriorityLevel + 1) % 5
  return changePriority(input, PRIORITY_LEVELS[newPriorityLevel], true)
}

/**
 * Cycle the priority level of a task down: none -> >> -> !!! -> !! -> ! -> none
 * Written for the Dashboard.
 * @author @jgclark
 * @param {TParagraph} input - the task/pagraph to be processed
 * @returns {string} the resulting updated paragraph's content
 */
export function cyclePriorityStateDown(input: TParagraph): string {
  const currentPriorityLevel = getTaskPriority(input.content)
  const newPriorityLevel = (currentPriorityLevel - 1) % 5
  return changePriority(input, PRIORITY_LEVELS[newPriorityLevel], true)
}

export type TagsList = { hashtags: Array<string>, mentions: Array<string> } //include the @ and # characters

// These Regexes are different from the ones in taskHelpers because they include the # or @
export const HASHTAGS: RegExp = /\B(#[a-zA-Z0-9\/]+\b)/g
export const MENTIONS: RegExp = /\B(@[a-zA-Z0-9\/]+\b)/g

/**
 * Takes in a string and returns an object with arrays of #hashtags and @mentions (including the @ and # characters)
 * @param {string} content : ;
 * @param {boolean} includeSymbol : if true, includes the @ and # characters in the returned values, if false, it does not [default: true];
 * @returns {TagsList} {hashtags: [], mentions: []}
 */

export function getTagsFromString(content: string, includeSymbol: boolean = true): TagsList {
  const hashtags = getElementsFromTask(content, HASHTAGS).map((tag) => (includeSymbol ? tag : tag.slice(1)))
  const mentions = getElementsFromTask(content, MENTIONS).map((tag) => (includeSymbol ? tag : tag.slice(1)))
  return { hashtags, mentions }
}

/**
 * Take a line and simplify by removing blockIDs, start-of-line markers, and trim start/end.
 * Note: different from simplifyParaContent() which doesn't do as much.
 * @author @jgclark
 * @param {string} rawContentIn
 * @returns {string} simplified output
 */
export function simplifyRawContent(rawContentIn: string): string {
  try {
    // Remove start-of-line markers
    let output = rawContentIn.slice(getLineMainContentPos(rawContentIn))
    // Remove blockIDs (which otherwise can mess up the other sync'd copies)
    output = output.replace(/\^[A-z0-9]{6}([^A-z0-9]|$)/g, '')
    // Trim whitespace at start/end
    output = output.trim()
    return output
  } catch (error) {
    logError('simplifyRawContent', error.message)
    return '<error>' // for completeness
  }
}

/**
 * Take a line and simplify by removing start-of-line markers, and trim start.
 * Note: different from simplifyRawContent().
 * @author @jgclark
 * @param {string} rawContentIn
 * @returns {string}
 */
export function convertRawContentToContent(rawContentIn: string): string {
  try {
    // Remove start-of-line markers
    let output = rawContentIn.slice(getLineMainContentPos(rawContentIn))
    // Trim whitespace at start/end
    output = output.trim()
    return output
  } catch (error) {
    logError('convertRawContentToContent', error.message)
    return '<error>' // for completeness
  }
}

/**
 * Function to write paragraphs either to top of note, bottom of note, or after a heading.
 * Note: there is no API function to insert multiple paragraphs in one go, so we have to insert a raw text string version of the paragraphs that includes multiple lines.
 * Note: now can't simply use note.addParagraphBelowHeadingTitle() as we have more options than it supports.
 * @author @jgclark
 *
 * @param {TNote} destinationNote
 * @param {Array<TParagraph>} paragraphs
 * @param {string} headingToFind if empty, means 'end of note'. Can also be the special string '<<top of note>>' or '<<bottom of note>>'
 * @param {string} whereToAddInSection to add after a heading: 'start' or 'end'
 * @param {boolean} allowNotePreambleBeforeHeading?
 */
export function addParagraphsToNote(
  destinationNote: TNote,
  paragraphs: Array<TParagraph>,
  headingToFind: string,
  whereToAddInSection: string,
  allowNotePreambleBeforeHeading: boolean
): void {
  try {
    if (paragraphs.length === 0) {
      throw new Error('No paragraphs to add!')
    }
    // Turn the paragraphs into a (multi-line) text string
    const selectedParasAsText = parasToText(paragraphs)

    const destinationNoteParas = destinationNote.paragraphs
    let insertionIndex: number
    // Now add the text to the destination note
    if (headingToFind === destinationNote.title || headingToFind === '<<top of note>>') {
      // i.e. the first line in project or calendar note
      insertionIndex = findStartOfActivePartOfNote(destinationNote, allowNotePreambleBeforeHeading)
      logDebug('paragraph/addParagraphsToNote', `-> top of note, line ${insertionIndex}`)
      destinationNote.insertParagraph(selectedParasAsText, insertionIndex, 'text')

    } else if (headingToFind === '<<bottom of note>>' || headingToFind === '') {
      // blank return from chooseHeading has special meaning of 'end of note'
      insertionIndex = destinationNoteParas.length + 1 || 0
      logDebug('paragraph/addParagraphsToNote', `-> bottom of note, line ${insertionIndex}`)
      destinationNote.insertParagraph(selectedParasAsText, insertionIndex, 'text')

    } else if (whereToAddInSection === 'start') {
      logDebug('paragraph/addParagraphsToNote', `-> Inserting at start of section '${headingToFind}'`)
      destinationNote.addParagraphBelowHeadingTitle(selectedParasAsText, 'text', headingToFind, false, false)

    } else if (whereToAddInSection === 'end') {
      logDebug('paragraph/addParagraphsToNote', `-> Inserting at end of section '${headingToFind}'`)
      destinationNote.addParagraphBelowHeadingTitle(selectedParasAsText, 'text', headingToFind, true, false)

    } else {
      // Shouldn't get here
      throw new Error(`Can't find heading '${headingToFind}'. Stopping.`)
    }
  } catch (err) {
    logError('paragraph/addParagraphsToNote', err.message)
  }
}
