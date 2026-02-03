// @flow
//-----------------------------------------------------------------------------
// Helper functions for gatherOccurrences
// Last updated 2026-01-30 for v1.0.3+ by @jgclark
//-----------------------------------------------------------------------------

import { TMOccurrences } from './TMOccurrences'
import { getISODateStringFromYYYYMMDD, getDateStringFromCalendarFilename } from '@helpers/dateTime'
import { logDebug, logInfo, logTimer } from '@helpers/dev'
import { caseInsensitiveTagMatch, getCorrectedHashtagsFromNote, getCorrectedMentionsFromNote } from '@helpers/search'

/**
 * Combines count, average, and total arrays into a single sorted array with types
 * @param {Array<string>} countArr - Items to count
 * @param {Array<string>} averageArr - Items to average
 * @param {Array<string>} totalArr - Items to total
 * @returns {Array<[string, string]>} Array of [name, type] tuples, sorted
 */
export function combineTermArrays(
  countArr: Array<string>,
  averageArr: Array<string>,
  totalArr: Array<string>
): Array<[string, string]> {
  const combined: Array<[string, string]> = []
  countArr.forEach((m) => { combined.push([m, 'count']) })
  averageArr.forEach((m) => { combined.push([m, 'average']) })
  totalArr.forEach((m) => { combined.push([m, 'total']) })
  combined.sort()
  return combined
}

/**
 * Merges duplicate terms that appear as both 'average' and 'total' into 'all'
 * Modifies the array in place
 * @param {Array<[string, string]>} combinedTerms - Array of [name, type] tuples
 */
export function mergeAverageAndTotalDuplicates(combinedTerms: Array<[string, string]>): void {
  for (let i = 1; i < combinedTerms.length; i++) {
    if (combinedTerms[i - 1][0] === combinedTerms[i][0] && 
        combinedTerms[i - 1][1] === 'average' && 
        combinedTerms[i][1] === 'total') {
      combinedTerms[i - 1][1] = 'all'
      combinedTerms.splice(i, 1)
      i-- // Decrement to check current position again after splice
    }
  }
}

/**
 * Processes progress terms (hashtags or mentions) over a date range and builds summary objects.
 * 
 * For each `[name, type]` tuple in `combinedTerms` this:
 * - creates a `TMOccurrences` instance initialised for the supplied ISO date range
 * - scans all `calendarNotesInPeriod` and, for that term, records one occurrence per matching
 *   hashtag or mention on each day using `addHashtagsToOccurenceFromNotes` / `addMentionsToOccurenceFromNotes`
 * - lets `TMOccurrences.addOccurrence()` interpret any numeric suffix (e.g. `#run/5.3` or
 *   `@weight(72.4)`) so that counts, totals, and averages are accumulated correctly
 * 
 * The result is one `TMOccurrences` object per term which contains a per-day values map plus
 * overall count/total statistics ready for charting or summary output.
 * 
 * @param {Array<[string, string]>} combinedTerms - Array of `[term, type]` tuples to track
 * @param {Array<TNote>} calendarNotesInPeriod - Calendar notes whose hashtags/mentions are scanned
 * @param {string} fromDateStr - Start of the reporting period in YYYY-MM-DD form
 * @param {string} toDateStr - End of the reporting period in YYYY-MM-DD form (inclusive)
 * @param {boolean} isHashtag - If `true` treat terms as hashtags, otherwise as mentions
 * @returns {Array<TMOccurrences>} One populated `TMOccurrences` instance per input term
 */
export function processTerms(
  combinedTerms: Array<[string, string]>,
  calendarNotesInPeriod: Array<TNote>,
  fromDateStr: string,
  toDateStr: string,
  isHashtag: boolean
): Array<TMOccurrences> {
  const tmOccurrencesArr: Array<TMOccurrences> = []
  
  for (const termTuple of combinedTerms) {
    const [thisName, thisType] = termTuple
    const thisOcc = new TMOccurrences(thisName, thisType, fromDateStr, toDateStr)
    
    if (isHashtag) {
      addHashtagsToOccurenceFromNotes(thisOcc, calendarNotesInPeriod, thisName)
    } else {
      addMentionsToOccurenceFromNotes(thisOcc, calendarNotesInPeriod, thisName)
    }
    
    tmOccurrencesArr.push(thisOcc)
  }
  
  return tmOccurrencesArr
}

/**
 * Processes hashtags from calendar notes and adds matching occurrences to TMOccurrences object.
 * Matches are either exact, or can match a shorter subset of a multi-part hashtag, starting from the beginning.
 * Note: Uses a helper function to get the corrected hashtags from the note, to cope with a API bug.
 * @param {TMOccurrences} thisOcc - The TMOccurrences object to add to
 * @param {Array<TNote>} calendarNotesInPeriod - Calendar notes to process
 * @param {string} wantedTerm - The hashtag to match (without #)
 */
function addHashtagsToOccurenceFromNotes(
  thisOcc: TMOccurrences,
  calendarNotesInPeriod: Array<TNote>,
  wantedTerm: string
): void {
  const RE_HASHTAG_CAPTURE_TERMINAL_SLASH_AND_FLOAT = /\/(-?\d+(\.\d+)?)$/
  
  for (const n of calendarNotesInPeriod) {
    const thisDateStr = getISODateStringFromYYYYMMDD(getDateStringFromCalendarFilename(n.filename))
    const seenTags = getCorrectedHashtagsFromNote(n)
    
    for (const tag of seenTags) {
      // Remove numeric suffix for matching (e.g., #run/5.3 -> #run)
      const tagWithoutClosingNumber = tag.replace(RE_HASHTAG_CAPTURE_TERMINAL_SLASH_AND_FLOAT, '')
      
      // Check if this tag matches what we're looking for
      if (caseInsensitiveTagMatch(wantedTerm, tagWithoutClosingNumber)) {
        thisOcc.addOccurrence(wantedTerm, thisDateStr)
      }
    }
  }
}

/**
 * Processes mentions from calendar notes and adds occurrences to TMOccurrences object.
 * Note: Uses a helper function to get the corrected mentions from the note, to cope with a API bug.
 * @param {TMOccurrences} thisOcc - The TMOccurrences object to add to
 * @param {Array<TNote>} calendarNotesInPeriod - Calendar notes to process
 * @param {string} wantedTerm - The mention to match (without @)
 */
function addMentionsToOccurenceFromNotes(
  thisOcc: TMOccurrences,
  calendarNotesInPeriod: Array<TNote>,
  wantedTerm: string
): void {
  for (const n of calendarNotesInPeriod) {
    const thisDateStr = getISODateStringFromYYYYMMDD(getDateStringFromCalendarFilename(n.filename))
    const seenMentions = getCorrectedMentionsFromNote(n)
    if (seenMentions.length ===0) {
      logDebug('addMentionsToOccurenceFromNotes', `- found no '${wantedTerm}' mentions in ${thisDateStr}`)
    }
    
    for (const mention of seenMentions) {
      // Check if this mention matches what we're looking for
      if (caseInsensitiveTagMatch(wantedTerm, mention)) {
        thisOcc.addOccurrence(mention, thisDateStr)
      }
    }
  }
}
