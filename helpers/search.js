// @flow
//-----------------------------------------------------------------------------
// Search helpers
// @jgclark
//-----------------------------------------------------------------------------

// import { trimString } from '@helpers/dataManipulation'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { RE_SYNC_MARKER } from '@helpers/regex'

/**
 * Case insensitive array.includes() match
 * @author @jgclark
 * @param {string} searchTerm
 * @param {Array<string>} arrayToSearch
 * @returns {boolean}
 * @tests available in jest file
 */
export function caseInsensitiveIncludes(searchTerm: string, arrayToSearch: Array<string>): boolean {
  try {
    if (searchTerm === '') return false
    const matches = arrayToSearch.filter((h) => {
      return h !== '' && (h.toLowerCase() === searchTerm.toLowerCase())
    })
    return matches.length > 0
  }
  catch (error) {
    logError('search/caseInsensitiveIncludes', `Error matching '${searchTerm}' to array '${String(arrayToSearch)}': ${error.message}`)
    return false
  }
}

/**
 * Case insensitive array.includes() that does partial/substring match of arrayOfTerms terms into 'stringToCheck'
 * @author @jgclark
 * @param {string} stringToCheck
 * @param {Array<string>} arrayOfTerms
 * @returns {boolean}
 * @tests available in jest file
 */
export function caseInsensitiveSubstringIncludes(stringToCheck: string, arrayOfTerms: Array<string>): boolean {
  try {
    if (stringToCheck === '') return false
    const matches = arrayOfTerms.filter((term) => {
      return term !== '' && ((stringToCheck.toLowerCase()).includes(term.toLowerCase()))
    })
    return matches.length > 0
  }
  catch (error) {
    logError('search/caseInsensitiveIncludes', `Error matching '${stringToCheck}' to array '${String(arrayOfTerms)}': ${error.message}`)
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
    // First need to escape any special characters in the search term
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`^${escapedSearchTerm}$`, "i") // = case insensitive match
    return re.test(textToSearch)
  }
  catch (error) {
    logError('search/caseInsensitiveMatch', `Error matching '${searchTerm}' to '${textToSearch}': ${error.message}`)
    return false
  }
}

/**
 * Perform substring match, ignoring case.
 * This version uses regex, though TODO: look at changing to a variant of "new Intl.Collator("de", { caseFirst: "upper" }).compare"
 * @author @jgclark
 * @param {string} searchTerm
 * @param {string} textToSearch
 * @returns {boolean}
 * @tests available in jest file
 */
export function caseInsensitiveSubstringMatch(searchTerm: string, textToSearch: string): boolean {
  try {
    // First need to escape any special characters in the search term
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`${escapedSearchTerm}`, "i") // = case insensitive match
    return re.test(textToSearch)
  }
  catch (error) {
    logError('search/caseInsensitiveSubstringMatch', `Error matching '${searchTerm}' to '${textToSearch}': ${error.message}`)
    return false
  }
}

/**
 * Perform substring match, case-sensitively. Returns true if any of the needles is found in the haystack.
 * Uses the Intl.Collator API to match the search term to the text to search, using the user's locale.
 * Note: variant characters of the same case and be matched. E.g. a ≠ b, a = á, a ≠ A.
 * @author @jgclark with help from ChatGPT
 * @tests available in jest file
 * 
 * @param {Array<string>} needles one or more search terms
 * @param {string} haystack the text content to search
 * @param {string} userLocale? (default: "en-US")
 * @returns {boolean}
 */
export function caseSensitiveSubstringLocaleMatch(
  needles: string[],
  haystack: string,
  userLocale: string = "en-US"
): boolean {
  try {
    if (!Array.isArray(needles) || needles.length === 0 || !haystack) {
      return false
    }
    const collator = new Intl.Collator(userLocale, { sensitivity: "case", usage: "search" })
    const H = haystack.normalize('NFC') // Normalize the haystack string to Unicode NFC form to ensure consistent character representation
    const hay = Array.from(H)
    const hayLen = hay.length

    for (const needle of needles) {
      if (!needle) continue
      const N = needle.normalize('NFC')
      const NLen = Array.from(N).length

      for (let i = 0; i + NLen <= hayLen; i++) {
        const segment = hay.slice(i, i + NLen).join('')
        if (collator.compare(segment, N) === 0) return true
      }
    }
    return false
  } catch (error) {
    logError(
      'search/caseSensitiveSubstringLocaleMatch',
      `Error matching '${needles}' to '${haystack}': ${error.message}`
    )
    return false
  }
}
//   needle: string,
//   haystack: string,
//   userLocale: string = "en-US"
// ): boolean {
//   try {
//     if (!needle || !haystack) {
//       return false
//     }
//     const collator = new Intl.Collator(userLocale, { sensitivity: "case", usage: "search" })
//     // NFC avoids splitting equivalent composed/decomposed forms
//     const H = haystack.normalize('NFC')
//     const N = needle.normalize('NFC')

//     const hay = Array.from(H) // iterate by Unicode code points (no surrogate halves)
//     const hayLen = hay.length
//     const ned = Array.from(N)
//     const nLen = ned.length

//     for (let i = 0; i + nLen <= hayLen; i++) {
//       const segment = hay.slice(i, i + nLen).join('')
//       if (collator.compare(segment, N) === 0) return true
//     }
//     return false
//   } catch (error) {
//     logError(
//       'search/caseSensitiveSubstringLocaleMatch',
//       `Error matching '${needle}' to '${haystack}': ${error.message}`
//     )
//     return false
//   }
// }

/**
 * Returns true if A is a subset of B, starting from the beginning.
 * If strictSubset is true it won't match if A===B
 * @author @jgclark
 * @param {string} searchTerm
 * @param {string} textToSearch
 * @param {boolean} strictSubset? (default: true)
 * @returns {boolean} matches?
 * @tests available in jest file
 */
export function caseInsensitiveStartsWith(searchTerm: string, textToSearch: string, strictSubset: boolean = true): boolean {
  try {
    // First need to escape any special characters in the search term
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = strictSubset
      ? new RegExp(`^${escapedSearchTerm}.+`, "i") // = case insensitive 'starts with' regex
      : new RegExp(`^${escapedSearchTerm}`, "i") // = case insensitive 'starts with' regex
    return re.test(textToSearch)
  }
  catch (error) {
    logError('search/caseInsensitiveStartsWith', `Error matching '${searchTerm}' to '${textToSearch}': ${error.message}`)
    return false
  }
}

/**
 * Returns true if A is a strict subset of B, starting from the end.
 * If strictSubset is true it won't match if A===B
 * @author @jgclark
 * @param {string} searchTerm
 * @param {string} textToSearch
 * @param {boolean} strictSubset? (default: true)
 * @returns {boolean} matches?
 */
export function caseInsensitiveEndsWith(searchTerm: string, textToSearch: string, strictSubset: boolean = true): boolean {
  try {
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = strictSubset
      ? new RegExp(`${escapedSearchTerm}.+$`, "i") // = case insensitive 'ends with' Regex
      : new RegExp(`${escapedSearchTerm}$`, "i") // = case insensitive 'ends with' Regex
    return re.test(textToSearch)
  }
  catch (error) {
    logError('search/caseInsensitiveEndsWith', `Error matching '${searchTerm}' to '${textToSearch}': ${error.message}`)
    return false
  }
}

/**
 * Returns true if A is a found in B, but not a subset of any words in B
 * i.e. will match 'hell' in 'heaven and hell' 
 * i.e. will match 'hell' in 'heaven and Hell' (depending if caseSensitive is set)
 * i.e. will not match 'hell' in 'we say hello' or '"hello"'
 * @author @jgclark
 * @param {string} searchTerm
 * @param {string} textToSearch
 * @param {boolean} caseSensitive? (default: false)
 * @returns {boolean} matches?
 * @tests available in jest file
 */
export function fullWordMatch(searchTerm: string, textToSearch: string, caseSensitive: boolean = true): boolean {
  try {
    // write a regex that will test whether 'searchTerm' is a whole word in 'textToSearch' but treating '#' and '@' as word characters
    const isWholeWord = (searchTerm: string, textToSearch: string): boolean => {
      const regex = new RegExp(`(^|[^\\w#@])${searchTerm}([^\\w#@]|$)`, 'g')
      return regex.test(textToSearch)
    }

    // First try special case for hashtags and mentions
    if (searchTerm.startsWith('#') || searchTerm.startsWith('@')) {
      return isWholeWord(searchTerm, textToSearch)
    }
    // First need to escape any special characters in the search term
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = caseSensitive
      ? new RegExp(`\\b${escapedSearchTerm}\\b`) // = case sensitive 'whole word' regex
      : new RegExp(`\\b${escapedSearchTerm}\\b`, "i") // = case insensitive version
    return re.test(textToSearch)
  }
  catch (error) {
    logError('search/fullWordMatch', `Error matching '${searchTerm}' to '${textToSearch}': ${error.message}`)
    return false
  }
}

/**
 * Dedupe the shorter versions of longer hashtags, to cope with API bug.
 * @example ["#project", "#project/management", "#project/management/theory"] => ["#project/management/theory"]
 * @tests available in jest file
 * @param {Array<string>} hashtagsFromAPI 
 * @returns {Array<string>}
 */
export function getDedupedHashtagsFromList(hashtagsIn: Array<string>): Array<string> {
  const dedupedHashtags: Array<string> = []
  const hashtagsToUse = [...hashtagsIn, ''] // add an empty string to the end to avoid index errors
  // Dedupe the shorter versions of longer hashtags
  // Walk through array and remove earlier ones which are a strict subset of the next one
  for (let i = 0; i < hashtagsToUse.length - 1; i++) {
    const lenThisTag = hashtagsToUse[i].length
    const lenNextTag = hashtagsToUse[i + 1].length ?? 0
    if (!(caseInsensitiveStartsWith(hashtagsToUse[i], hashtagsToUse[i + 1], true) && lenNextTag > lenThisTag && hashtagsToUse[i + 1][lenThisTag] === '/')) {
      dedupedHashtags.push(hashtagsToUse[i])
    }
  }
  return dedupedHashtags
}

/**
 * Version of note.hashtags to use. Deals with the API bug 
 * where #one/two/three gets reported as '#one', '#one/two', and '#one/two/three'. Instead this reports just as '#one/two/three'.
 * @param {TNote} note
 * @returns {Array<string>}
 */
export function getCorrectedHashtagsFromNote(note: TNote): Array<string> {
  // First get the hashtags from the note (using the API)
  // $FlowFixMe[incompatible-type] note.hashtags is read-only
  const reportedHashtags: Array<string> = note.hashtags ?? []
  // Then dedupe the shorter versions of longer ones
  const dedupedHashtags = getDedupedHashtagsFromList(reportedHashtags)
  return dedupedHashtags
}

/**
 * Returns the matching hashtag(s) from the ones present in the given note.
 * Note: case sensitive.
 * @param {string} hashtag including leading #
 * @param {Array<string>} list 
 * @returns {string} matching hashtag(s) if any
 */
export function hashtagAwareIncludes(tagToFind: string, note: TNote): string {
  // First remove shorter parts of a multi-level hashtag, leaving the longest match
  const hashtags = getCorrectedHashtagsFromNote(note)
  logDebug('search/hashtagAwareIncludes', `tagToFind: ${tagToFind} from hashtags [${String(hashtags)}] in note '${note.title ?? note.filename ?? 'unknown'}'`)
  // Then match this set to the list
  return hashtags.filter(item => item.includes(tagToFind)).sort((a, b) => b.length - a.length)[0]
}

/**
 * Check if 'hashtagToTest' is or isn't a member of wanted or excluded arrays. The check is done ignoring case
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
 * Check if 'mentionToTest' is or isn't a member of wanted or excluded arrays. The check is done ignoring case
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
    // logDebug('trimAndHighlight', `starting with [${String(terms)}] terms ${nonEmptyTerms ? '' : '(i.e. empty)'}; mainPart = <${mainPart}>`)
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
        const RE_FIND_TEXT_AROUND_THE_TERMS = new RegExp(`(?:^|\\b)(.{0,${String(LRSplit)}}(${termsForRE}).{0,${String(maxChars - LRSplit)}})\\b(?:\\w+|$)`, "gi")
        // logDebug('trimAndHighlight', `- RE: ${String(RE_FIND_TEXT_AROUND_THE_TERMS)}`)
        const textAroundTerms = mainPart.match(RE_FIND_TEXT_AROUND_THE_TERMS) ?? [] // multiple matches
        logDebug('trimAndHighlight', `- textAroundTerms = ${String(textAroundTerms)}`)
        if (textAroundTerms.length > 0) {
          // If we have more than 1 match in the line, join the results together with '...'
          output = textAroundTerms.join(' ...')
          // If the output doesn't start with the mainPart, then we have chopped the start of a sentence, so prepend '...'
          if (!caseInsensitiveStartsWith(output, mainPart, false)) {
            // logDebug('trimAndHighlight', `- have shortened start of line`)
            output = `... ${output}`
          }
          // If we now have a shortened string, then append '...' unless search term is at the end of the line
          if (!caseInsensitiveEndsWith(output, mainPart, false)) {
            logDebug('trimAndHighlight', `- have shortened end of line`)
            output = `${output} ...`
          }
          //
        } else {
          // For some reason we didn't find the matching term, so return the first part of line
          // logDebug('trimAndHighlight', `- could not find a match in the line, so using the first part of the line`)
          output = (output.length >= maxChars) ? output.slice(0, maxChars) : output
        }
        // Replace multiple spaces with a single space
        output = output.replace(/\s{2,}/g, ' ')
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
      // logDebug('trimAndHighlight', `- /${String(RE_HIGHLIGHT_MATCH)}/`)
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

/**
 * Return true if the string is a search operator. These are the ones that are a string without a space that contains a non-escaped colon, and ignore search operators preceded by a backslash.
 * Also includes values that are wrapped in double quotes (e.g. heading:"Project A"), but if so, the value is returned without the double quotes.
 * Note: does not check validity of the search operators, just the form of the a:b string.
 * @param {string} term to test
 * @returns {boolean}
 */
export function isSearchOperator(term: string): boolean {
  if (!term || term.startsWith('\\')) return false
  // Match key:value where key has no spaces and value is either a quoted string (may include spaces)
  // or an unquoted token with no spaces. Examples: date:2025-09-01, is:not-task, heading:"Project A"
  const re = /^\w+:("[^"]+"|[^"\s]+)$/
  return re.test(term)
}

/**
 * Get array of search operators (e.g. date:2025-09-28 or is:open or heading:"Project A") from a search terms string. 
 * Note: does not check validity of the search operators, just the form of the a:b string.
 * Suitable for use with extended search API from v3.18.1.
 * @author @jgclark
 * @tests in jest file
 * @param {string} searchTermsStr string of search terms
 * @returns {Array<string>} array of search operators
 */
export function getSearchOperators(searchTermsStr: string): Array<string> {
  // Split on spaces that are not inside double quotes
  const searchTerms = searchTermsStr.match(/(?:[^\s"]+|"[^"]*")+/g) || []
  const searchOperators = searchTerms.filter(isSearchOperator)
  // Also return the values of the search operators without the quotes
  const searchOperatorsWithUnquotedValues = searchOperators.map((op) => {
    const key = op.split(':')[0]
    const value = op.split(':')[1]
    return (value.startsWith('"') && value.endsWith('"')) ? `${key}:${value.slice(1, -1)}` : op
  })
  return searchOperatorsWithUnquotedValues
}

/**
 * Remove all search operators (e.g. date:2025-09-28 or is:open) from the start of a search terms string.
 * Leaves search operators preceded by a backslash.
 * Note: does not check validity of the search operators or remaining search terms, just the form of the a:b string.
 * Suitable for use with extended search API from v3.18.1.
 * @author @jgclark
 * @tests in jest file
 * @param {string} searchTermsStr string of search terms
 * @returns {string} result
 */
export function removeSearchOperators(searchTermsStr: string): string {
  const searchTerms = searchTermsStr.split(' ')
  // Iterate over the searchTerms noting which are search operators. Remove all up until the first searchTerms that isn't a search operator.
  let firstNonOperatorIndex = 0
  for (const term of searchTerms) {
    if (isSearchOperator(term)) {
      // logDebug('removeSearchOperators', `- removed search operator: ${term}`)
      firstNonOperatorIndex++
    } else {
      break
    }
  }
  const result = searchTerms.slice(firstNonOperatorIndex).join(' ')
  logDebug('removeSearchOperators', `-> search terms without operators: ${result}`)
  return result
}

/**
 * Return a searchString with each term surrounded by double-quotes.
 * Treat -, ( and ) as punctuation not part of the terms.
 * Leaves alone:
 * - terms already surrounded by double-quotes
 * - search operators
 * Suitable for use with extended search API from v3.18.1.
 * @author @Cursor guided by @jgclark
 * @tests in jest file
 * @param {string} searchString 
 * @returns {string} searchString with terms surrounded by quotes
 */
export function quoteTermsInSearchString(searchString: string): string {
  if (!searchString || searchString.trim() === '') return ''
  
  // Handle the case where the entire string is already quoted
  if (searchString.startsWith('"') && searchString.endsWith('"')) {
    return searchString
  }
  
  let result = ''
  let i = 0
  
  while (i < searchString.length) {
    const char = searchString[i]
    
    if (char === '"') {
      // Handle already quoted terms - find the closing quote
      const start = i
      i++ // skip opening quote
      while (i < searchString.length && searchString[i] !== '"') {
        i++
      }
      if (i < searchString.length) {
        i++ // skip closing quote
        result += searchString.slice(start, i)
      } else {
        // Unclosed quote, treat as regular text
        result += searchString.slice(start)
      }
    } else if (char === '(') {
      // Handle opening parenthesis
      result += '('
      i++
      
      // Process content inside parentheses
      let parenContent = ''
      let parenDepth = 1
      while (i < searchString.length && parenDepth > 0) {
        const nextChar = searchString[i]
        if (nextChar === '(') {
          parenDepth++
        } else if (nextChar === ')') {
          parenDepth--
        }
        if (parenDepth > 0) {
          parenContent += nextChar
        }
        i++
      }
      
      // Recursively quote the content inside parentheses
      const quotedParenContent = quoteTermsInSearchString(parenContent)
      result += quotedParenContent
      result += ')'
    } else if (char === '-') {
      // Handle negation - check if it's followed by a parenthesis
      if (i + 1 < searchString.length && searchString[i + 1] === '(') {
        // Negated parentheses: -(content)
        result += '-('
        i += 2 // skip -(
        
        // Process content inside parentheses
        let parenContent = ''
        let parenDepth = 1
        while (i < searchString.length && parenDepth > 0) {
          const nextChar = searchString[i]
          if (nextChar === '(') {
            parenDepth++
          } else if (nextChar === ')') {
            parenDepth--
          }
          if (parenDepth > 0) {
            parenContent += nextChar
          }
          i++
        }
        
        // Recursively quote the content inside parentheses
        const quotedParenContent = quoteTermsInSearchString(parenContent)
        result += quotedParenContent
        result += ')'
      } else {
        // Regular negation - find the term and quote it with the minus
        let term = '-'
        i++
        while (i < searchString.length && searchString[i] !== ' ' && searchString[i] !== '(' && searchString[i] !== ')') {
          term += searchString[i]
          i++
        }
        result += `"${term}"`
      }
    } else if (char === ' ') {
      result += ' '
      i++
    } else {
      // Regular term - collect until space, parenthesis, or quote
      let term = ''
      while (i < searchString.length && searchString[i] !== ' ' && searchString[i] !== '(' && searchString[i] !== ')' && searchString[i] !== '"') {
        term += searchString[i]
        i++
      }
      
      if (term === 'OR') {
        result += 'OR'
      } else {
        result += `"${term}"`
      }
    }
  }
  
  return result
}
