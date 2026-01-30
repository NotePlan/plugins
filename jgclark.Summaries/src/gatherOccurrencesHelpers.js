// @flow
//-----------------------------------------------------------------------------
// Helper functions for gatherOccurrences
// Last updated 2026-01-30 for v1.0.3 by @jgclark
//-----------------------------------------------------------------------------

import { TMOccurrences } from './TMOccurrences'
import { getISODateStringFromYYYYMMDD, getDateStringFromCalendarFilename } from '@helpers/dateTime'
import { logDebug, logTimer } from '@helpers/dev'
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
 * Processes hashtags from calendar notes and adds matching occurrences to TMOccurrences object.
 * Matches are either exact, or can match a shorter subset of a multi-part hashtag, starting from the beginning.
 * Note: Uses a helper function to get the corrected hashtags from the note, to cope with a API bug.
 * @param {TMOccurrences} thisOcc - The TMOccurrences object to add to
 * @param {Array<TNote>} calendarNotesInPeriod - Calendar notes to process
 * @param {string} wantedTerm - The hashtag to match (without #)
 */
export function processHashtagsForTerm(
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
export function processMentionsForTerm(
  thisOcc: TMOccurrences,
  calendarNotesInPeriod: Array<TNote>,
  wantedTerm: string
): void {
  for (const n of calendarNotesInPeriod) {
    const thisDateStr = getISODateStringFromYYYYMMDD(getDateStringFromCalendarFilename(n.filename))
    const seenMentions = getCorrectedMentionsFromNote(n)
    
    for (const mention of seenMentions) {
      // Check if this mention matches what we're looking for
      if (caseInsensitiveTagMatch(wantedTerm, mention)) {
        thisOcc.addOccurrence(mention, thisDateStr)
      }
    }
  }
}

/**
 * Processes terms (hashtags or mentions) and creates TMOccurrences objects.
 * 
 * Iterates through combined terms and processes each one using the appropriate
 * helper function (processHashtagsForTerm or processMentionsForTerm).
 * 
 * @param {Array<[string, string]>} combinedTerms - Array of [name, type] tuples
 * @param {Array<TNote>} calendarNotesInPeriod - Calendar notes to process
 * @param {string} fromDateStr - Start date in YYYY-MM-DD format
 * @param {string} toDateStr - End date in YYYY-MM-DD format
 * @param {boolean} isHashtag - True if processing hashtags, false for mentions
 * @returns {Array<TMOccurrences>} Array of TMOccurrences objects, one per term
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
      processHashtagsForTerm(thisOcc, calendarNotesInPeriod, thisName)
    } else {
      processMentionsForTerm(thisOcc, calendarNotesInPeriod, thisName)
    }
    
    tmOccurrencesArr.push(thisOcc)
  }
  
  return tmOccurrencesArr
}
