// @flow
//-----------------------------------------------------------------------------
// Search helpers
// Jonathan Clark
//-----------------------------------------------------------------------------

// import { trimString } from '@helpers/dataManipulation'
import { clo, logDebug, logError } from '@helpers/dev'
import { RE_SYNC_MARKER } from '@helpers/regex'

/**
 * Case insensitive array.includes() match
 * @author @jgclark
 * @param {string} searchTerm
 * @param {Array<string>} arrayToSearch
 * @returns {boolean}
 * TODO: @tests available in jest file
 */
export function caseInsensitiveIncludes(searchTerm: string, arrayToSearch: Array<string>): boolean {
  try {
    const matches = arrayToSearch.filter((h) => {
      return h.toLowerCase() === searchTerm.toLowerCase()
    })
    return matches.length > 0
  }
  catch (error) {
    logError('search/caseInsensitiveIncludes', `Error matching '${searchTerm}' to array '${String(arrayToSearch)}': ${error.message}`)
    return false
  }
}

/**
 * Perform string exact match, ignoring case
 * @author @jgclark
 * @param {string} searchTerm
 * @param {string} textToSearch
 * @returns {boolean}
 * @tests available in jest file
 */
export function caseInsensitiveMatch(searchTerm: string, textToSearch: string): boolean {
  try {
    const re = new RegExp(`^${searchTerm}$`, "i") // = case insensitive match
    return re.test(textToSearch)
  }
  catch (error) {
    logError('search/caseInsensitiveMatch', `Error matching '${searchTerm}' to '${textToSearch}': ${error.message}`)
    return false
  }
}

/**
 * Perform substring match, ignoring case
 * @author @jgclark
 * @param {string} searchTerm
 * @param {string} textToSearch
 * @returns {boolean}
 * @tests available in jest file
 */
export function caseInsensitiveSubstringMatch(searchTerm: string, textToSearch: string): boolean {
  try {
    const re = new RegExp(`${searchTerm}`, "i") // = case insensitive match
    return re.test(textToSearch)
  }
  catch (error) {
    logError('search/caseInsensitiveSubstringMatch', `Error matching '${searchTerm}' to '${textToSearch}': ${error.message}`)
    return false
  }
}

/**
 * Returns true if A is a strict subset of B, starting from the beginning.
 * i.e. won't match if A===B
 * @author @jgclark
 * @param {string} searchTerm
 * @param {string} textToSearch
 * @returns {boolean}
 * @tests available in jest file
 */
export function caseInsensitiveStartsWith(searchTerm: string, textToSearch: string): boolean {
  try {
  const re = new RegExp(`^${searchTerm}.+`, "i") // = case insensitive 'starts with' regex
    return re.test(textToSearch)
  }
  catch (error) {
    logError('search/caseInsensitiveStartsWith', `Error matching '${searchTerm}' to '${textToSearch}': ${error.message}`)
    return false
  }

}

/**
 * Check if 'searchTerm' is or isn't a member of wanted or excluded arrays. The check is done ignoring case
 * @author @jgclark
 * @param {string} hashtagToTest
 * @param {$ReadOnlyArray<string>} wantedHashtags
 * @param {$ReadOnlyArray<string>} excludedHashtags
 * @returns {boolean}
 * @tests available in jest file
 */
export function isHashtagWanted(hashtagToTest: string,
  wantedHashtags: $ReadOnlyArray<string>,
  excludedHashtags: $ReadOnlyArray<string>
): boolean {
  if (wantedHashtags.length > 0) {
    const hashtagsMatchingIncludeList = wantedHashtags.filter((a) => caseInsensitiveMatch(a, hashtagToTest))
    return hashtagsMatchingIncludeList.length > 0
  }
  else if (excludedHashtags.length > 0) {
    const hashtagsMatchingExcludeList = excludedHashtags.filter((a) => caseInsensitiveMatch(a, hashtagToTest))
    return hashtagsMatchingExcludeList.length === 0
  }
  else {
    return true
  }
}

/**
 * Check if 'searchTerm' is or isn't a member of wanted or excluded arrays. The check is done ignoring case
 * @author @jgclark
 * @param {string} mentionToTest
 * @param {$ReadOnlyArray<string>} wantedMentions
 * @param {$ReadOnlyArray<string>} excludedMentions
 * @returns {boolean}
 * @tests available in jest file
 */
export function isMentionWanted(mentionToTest: string,
  wantedMentions: $ReadOnlyArray<string>,
  excludedMentions: $ReadOnlyArray<string>
): boolean {
  if (wantedMentions.length > 0) {
    const mentionsMatchingIncludeList = wantedMentions.filter((a) => caseInsensitiveMatch(a, mentionToTest))
    return mentionsMatchingIncludeList.length > 0
  }
  else if (excludedMentions.length > 0) {
    const mentionsMatchingExcludeList = excludedMentions.filter((a) => caseInsensitiveMatch(a, mentionToTest))
    return mentionsMatchingExcludeList.length === 0
  }
  else {
    return true
  }
}

/**
 * Take a line's .rawContent and return the first position in the string
 * after any starting metadata markers for open/closed/cancelled/sched tasks,
 * quotes, lists, headings.
 * Note: this is not quite the same as .content
 * @author @jgclark
 * @param {string} input
 * @returns {number} first main position
 * @tests in jest file
 */
export function getLineMainContentPos(input: string): number {
  try {
    if (input && input !== '') {
      const res = input.match(/^(\s*(?:\#{1,5}\s+|(?:[*+-]\s(?:\[[ >x-]\])?|>))\s*)/) // regex which doesn't need input left trimming first
      if (res) {
        return res[0].length
      } else {
        return 0
      }
    } else {
      // logDebug('getLineMainContentPos', `input is null or empty`)
      return 0
    }
  } catch (error) {
    logError('getLineMainContentPos', error.message)
    return 0 // for completeness
  }
}

/**
 * Take a line and simplify by removing blockIDs, and trim start/end.
 * Note: a different function deals with start-of-line Markdown markers (for open/closed/cancelled/sched tasks, quotes, lists, headings).
 * @author @jgclark
 * @param {string} input
 * @returns {string} simplified output
 * @tests in jest file
 */
export function simplifyRawContent(input: string): string {
  try {
    let output = input
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
 * Takes a line of text and prepares it for display, in 'Simplified' or 'NotePlan' style.
 * - if its NotePlan and an 'open' task we need to make it a sync results using blockIDs
 * - shortens it to maxChars characters around the first matching term (if maxChars > 0 and Simplified style). This uses some very powerful regex magic.
 *   - TODO: Ideally doesn't chop in the middle of a URI
 * - adds ==highlight== to matching terms if wanted (and if not already highlighted, and using 'Simplified' style)
 * @author @jgclark
 *
 * @param {string} input this result content
 * @param {Array<string>} terms to find/highlight (without search operator prefixes)
 * @param {boolean} simplifyLine trim off leading markdown markers?
 * @param {boolean} addHighlight add highlighting to the matched terms?
 * @param {string} resultPrefix string to use if line is simplified
 * @param {number} maxChars to return around first matching term. If zero, or missing, then use the full line
 * @returns {string}
 * @tests in jest file
 */
export function trimAndHighlightTermInLine(
  input: string,
  terms: Array<string>,
  simplifyLine: boolean,
  addHighlight: boolean,
  resultPrefix: string = '- ',
  maxChars: number = 0,
): string {
  try {
    // Take off starting markdown markers, and right trim
    const startOfMainLineContentPos = getLineMainContentPos(input)
    const startOfLineMarker = input.slice(0, startOfMainLineContentPos)
    let mainPart = input.slice(startOfMainLineContentPos)

    // If we have a single blank 'terms' then set a flag, so we can disable highlighting and simplify the regex
    const nonEmptyTerms = !(terms.length === 0 || (terms.length === 1 && terms[0] === ''))
    logDebug('trimAndHighlight', `starting with [${String(terms)}] terms ${nonEmptyTerms ? '' : '(i.e. empty)'}; mainPart = <${mainPart}>`)
    let output = ''
    // As terms can include wildcards * or ?, we need to modify them slightly for the following regexes:
    // - replace ? with .
    // - replace * with [^\s]*? (i.e. any anything within the same 'word')
    const termsForRE = terms.join('|').replace(/\?/g, '.').replace(/\*/g, '[^\\s]*?') // Note: the replaces need to be in this order!

    // Simplify line display (if using Simplified style)
    if (simplifyLine) {
      // Trimming and remove any block IDs
      mainPart = simplifyRawContent(mainPart)
      // logDebug('trimAndHighlight', `- after simplifyRawContent, mainPart = <${mainPart}>`)

      // Now trim the line content if necessary
      if (maxChars > 0 && mainPart.length > maxChars && nonEmptyTerms) {
        // this split point ensures we put the term with a little more context before it than after it
        const LRSplit = Math.round(maxChars * 0.55)
        // logDebug('trimAndHighlight', `- maxChars = ${String(maxChars)}, LRSplit = ${String(LRSplit)}, mainPart.length = ${String(mainPart.length)}`)

        // regex: find occurrences of search terms and the text around them
        const RE_FIND_TEXT_AROUND_THE_TERMS = new RegExp(`(?:^|\\b)(.{0,${String(LRSplit)}}(${termsForRE}).{0,${String(maxChars - LRSplit)}})\\b\\w+`, "gi")
        // logDebug('trimAndHighlight', `- RE: ${RE_FIND_TEXT_AROUND_THE_TERMS}`)
        const matches = mainPart.match(RE_FIND_TEXT_AROUND_THE_TERMS) ?? [] // multiple matches
        if (matches.length > 0) {
          // If we have more than 1 match in the line, join the results together with '...'
          output = matches.join(' ...')
          // If starts with a non-word character, then (it's approximately right that) we have landed in the middle of sentence, so prepend '...'
          if (output.match(/^\W/)) {
            output = `...${output}`
          }
          // If we now have a shortened string, then (it's approximately right that) we have trimmed off the end, so append '...'
          if (output.length < mainPart.length) {
            // logDebug('trimAndHighlight', `- have shortened line`)
            output = `${output} ...`
          }
          //
        } else {
          // For some reason we didn't find the matching term, so return the first part of line
          // logDebug('trimAndHighlight', `- could not find a match in the line, so using the first part of the line`)
          output = (output.length >= maxChars) ? output.slice(0, maxChars) : output
        }
      } else {
        output = mainPart
      }
      // logDebug('trimAndHighlight', `- resultPrefix=<${resultPrefix}> / simplified line=<${output}>`)
      // Now add on the appropriate prefix
      output = resultPrefix + output
    }
    // If using NotePlan style, then ...
    else {
      // - don't do any shortening, as that would mess up any sync'd lines
      // - just reconstruct the way the line looks
      output = startOfLineMarker + mainPart
    }

    // Add highlighting if wanted (using defined Regex so can use 'g' flag)
    // (A simple .replace() command doesn't work as it won't keep capitalisation)
    // Now allow highlighting again if this isn't a sync'd line
    const this_RE = new RegExp(RE_SYNC_MARKER)
    if (addHighlight && nonEmptyTerms && terms.length > 0 && (simplifyLine || !this_RE.test(output))) {
      // regex: find any of the match terms in all the text
      const RE_HIGHLIGHT_MATCH = new RegExp(`(?:[^=](${termsForRE})(?=$|[^=]))`, "gi")
      // logDebug('trimAndHighlight', `- /${RE_HIGHLIGHT_MATCH}/`)
      const termMatches = output.matchAll(RE_HIGHLIGHT_MATCH)
      let offset = 0
      for (const tm of termMatches) {
        // logDebug('trimAndHighlight', `${tm[0]}, ${tm[0].length}, ${tm.index}, ${offset}`)
        const leftPos = tm.index + offset + 1 // last adds previous ==...== additions
        const rightPos = leftPos + tm[1].length // as terms change have to get feedback from this match
        const highlitOutput = `${output.slice(0, leftPos)}==${output.slice(leftPos, rightPos)}==${output.slice(rightPos,)}`
        output = highlitOutput
        // logDebug('trimAndHighlight', `highlight ${highlitOutput}`)
        offset += 4
      }
    }
    return output
  }
  catch (error) {
    logError('trimAndHighlight...', error.message)
    return 'error' // for completeness
  }
}
