// @flow
//-----------------------------------------------------------------------------
// Search helpers
// Jonathan Clark
//-----------------------------------------------------------------------------

// import pluginJson from '../plugins.config'
// import { log, logWarn } from '@helpers/dev'

/**
 * Perform string match, ignoring case
 * @author @jgclark
 * @param {string} searchTerm 
 * @param {string} textToSearch 
 * @returns {boolean}
 * @tests available in jest file
 */
export function caseInsensitiveMatch(searchTerm: string, textToSearch: string): boolean {
  const re = new RegExp(`^${searchTerm}$`, "i") // = case insensitive match
  return re.test(textToSearch)
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
  const re = new RegExp(`^${searchTerm}.+`, "i") // = case insensitive 'starts with' regex
  return re.test(textToSearch)
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
 * Takes a line of text and prepares it for display:
 * - shortens it to maxChars characters around the first matching term (if maxChars > 0)
 * - tries to shorten at word boundaries (thanks to the power of regex!).
 * - adds ==highlight== to matching terms if wanted.
 * @author @jgclark
 * 
 * @param {string} input string
 * @param {String} term to find/highlight
 * @param {boolean} addHighlight 
 * @param {number} maxChars to return around first matching term. If zero, or missing, then treat as being no limit.
 * @returns {string}
 */
export function trimAndHighlightTermInLine(
  input: string,
  term: string,
  addHighlight: boolean,
  maxChars: number = 0
): string {
  let output = input
  if (maxChars > 0 && input.length > maxChars) {
    const LRSplit = Math.round(maxChars * 0.55)
    const re = new RegExp(`(?:^|\\b)(.{0,${String(LRSplit)}}${term}.{0,${String(maxChars - LRSplit)}})\\b\\w+`, "gi")
    const matches = input.match(re) ?? [] // multiple matches
    if (matches.length > 0) {
      // If we have more than 1 match in the line, join the results together with '...'
      output = matches.join(' ...')
      // If starts with a non-word character, then (it's approximately right that) we have landed in the middle of sentence, so prepend '...'
      if (output.match(/^\W/)) {
        output = `...${output}`
      }
      // If we now have a shortened string, then (it's approximately right that) we have trimmed off the end, so append '...'
      if (output.length < input.length) {
        output = `${output} ...`
      }
      //
    } else {
      // For some reason we didn't find the matching term, so return the first part of line
      return (output.length >= maxChars) ? output.slice(0, maxChars) : output
    }
  } else {
    // just pass input through to output
  }
  // Add highlighting if wanted (using defined Regex so can use 'g' flag)
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
