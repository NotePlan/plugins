// @flow
//-----------------------------------------------------------------------------
// Search Extensions helpers
// Jonathan Clark
// Last updated 26.12.2023 for v1.3.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  formatNoteDate,
  getDateStrForStartofPeriodFromCalendarFilename,
  toISOShortDateTimeString,
  withinDateRange,
} from '@helpers/dateTime'
import {
  nowLocaleShortDateTime,
} from '@helpers/NPdateTime'
import { eliminateDuplicateSyncedParagraphs } from '@helpers/syncedCopies'
import { clo, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { getFilteredFolderList } from '@helpers/folders'
import { displayTitle, type headingLevelType, titleAsLink } from '@helpers/general'
import { getNoteByFilename, getNoteContextAsSuffix, getOrMakeNote, getProjectNotesInFolder, replaceSection } from '@helpers/note'
import { getNoteTitleFromFilename } from '@helpers/NPnote'
import { isTermInMarkdownPath, isTermInURL } from '@helpers/paragraph'
import { trimAndHighlightTermInLine } from '@helpers/search'
import { sortListBy } from '@helpers/sorting'
import { showMessage, showMessageYesNo } from '@helpers/userInput'
import { isOpen } from '@helpers/utils'

//------------------------------------------------------------------------------
// Data types

// Minimal data type needed to pass right through to result display
// Note: named before needing to add the 'type' item
export type noteAndLine = {
  noteFilename: string,
  line: string,  // contents of the paragraph
  index: number, // index number of the paragraph, to do any necessary further lookups
}

export type typedSearchTerm = {
  term: string, // (e.g. 'fixed')
  termRep: string, // short for termRepresentation (e.g. '-fixed')
  type: 'must' | 'may' | 'not-line' | 'not-note',
}

export type resultObjectTypeV3 = {
  searchTerm: typedSearchTerm,
  resultNoteAndLineArr: Array<noteAndLine>,
  resultCount: number,
}

export type resultOutputTypeV3 = {
  searchTermsRepArr: Array<string>,
  resultNoteAndLineArr: Array<noteAndLine>,
  resultCount: number,
  resultNoteCount: number,
  fullResultCount: number,
}

// Reduced set of paragraph.* fields
export type reducedFieldSet = {
  filename: string,
  changedDate?: Date,
  createdDate?: Date,
  title: string,
  type: ParagraphType,
  content: string,
  rawContent: string,
  lineIndex: number,
}

//-------------------------------------------------------------------------------

export const OPEN_PARA_TYPES = ['open', 'scheduled', 'checklist', 'checklistScheduled']
export const SYNCABLE_PARA_TYPES = ['open', 'scheduled', 'checklist', 'checklistScheduled']

//------------------------------------------------------------------------------
// Settings

export type SearchConfig = {
  autoSave: boolean,
  folderToStore: string,
  includeSpecialFolders: boolean,
  foldersToExclude: Array<string>,
  headingLevel: headingLevelType,
  defaultSearchTerms: Array<string>,
  searchHeading: string,
  groupResultsByNote: boolean,
  sortOrder: string,
  resultStyle: string,
  resultPrefix: string,
  resultQuoteLength: number,
  highlightResults: boolean,
  dateStyle: string,
  resultLimit: number,
}

/**
 * Get config settings using Config V2 system.
 *
 * @return {SearchConfig} object with configuration
 */
export async function getSearchSettings(): Promise<any> {
  const pluginID = 'jgclark.SearchExtensions'
  // logDebug(pluginJson, `Start of getSearchSettings()`)
  try {
    // Get settings using ConfigV2
    const v2Config: SearchConfig = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    // clo(v2Config, `${pluginID} settings:`)
    if (v2Config == null || Object.keys(v2Config).length === 0) {
      throw new Error(`Cannot find settings for '${pluginID}' plugin`)
    }
    return v2Config
  } catch (err) {
    logError(pluginJson, `getSearchSettings(): ${err.name}: ${err.message}`)
    return null // for completeness
  }
}

//------------------------------------------------------------------------------

/**
* Take a simple string as search input and process it to turn into an array of strings ready to validate and type.
* V3: Quoted multi-word search terms (e.g. ["Bob Smith"]) are now left alone (but without the double quotes). The extra parameter 'modifyQuotedTermsToAndedTerms' has now been removed.
* V2: Quoted multi-word search terms (e.g. ["Bob Smith"]) are by default treated as [+Bob +Smith] as I now discover the API doesn't support quoted multi-word search phrases.
* @author @jgclark
* @tests in jest file
* @param {string | Array<string>} searchArg string containing search term(s) or array of search terms
* @returns {Array<string>} normalised search term(s)
*/
export function normaliseSearchTerms(searchArg: string): Array<string> {
  // logDebug('normaliseSearchTerms', `starting for [${searchArg}]`)
  let outputArray = []

  // First deal with edge case of empty searchArg, which is now allowed
  if (searchArg === '') {
    logWarn('normaliseSearchTerms', `Returning special case of single empty search term`)
    return ['']
  }

  // this has free-floating +/- operators -> error (but single ! is allowed)
  if (searchArg.match(/\s[\+\-]\s/)) {
    logWarn('normaliseSearchTerms', `Search string not valid: unattached search operators found in [${searchArg}]`)
    return []
  }

  // Change older search syntax into newer one
  // change simple form [x,y,z] style -> array of x,y,z
  if (searchArg.match(/\w+\s*,\s*\w+/)) {
    outputArray = searchArg.split(/\s*,\s*/)
  }

  // change simple form [x AND y ...] (but not OR) style -> array of +x,+y,+z
  else if (searchArg.match(/\sAND\s/) && !searchArg.match(/\sOR\s/)) {
    outputArray = searchArg.split(/\sAND\s/).map((s) => `+${s}`)
  }

  // change simple form [x OR y ...] (but not AND) style -> array of x,y,z
  else if (searchArg.match(/\sOR\s/) && !searchArg.match(/\sAND\s/)) {
    outputArray = searchArg.split(/\sOR\s/)
  }

  // else treat as [x y z], with or without quoted phrases.
  else {
    // const searchArgPadded = ' ' + searchArg + ' '
    // This Regex attempts to split words:
    // - but keeping text in double quotes as one term
    // - and #hashtag/child and @mention(5) possibilities
    // - a word now may include any of .!+#-*?'
    // NB: Allows full unicode letter characters (\p{L}) and numbers (\p{N}) rather than ASCII (\w): (info from Dash.)
    // NB: To make the regex easier, add a space to start and end, and switch the order of any [-+!]['"]
    const RE_WOW = new RegExp(/(([\p{L}\p{N}\s\-\/@\(\)#*?.+!']*)(?="\s)|([\p{L}\p{N}\-@\/\(\)#.+!'\*\?]*))/gu)
    let searchArgPadded = ' ' + searchArg + ' '
    searchArgPadded = searchArgPadded
      .replace(/\s-"/, ' "-').replace(/\s\+"/, ' "+').replace(/\s!"/, ' "!')
    const reResults = searchArgPadded.match(RE_WOW)
    if (reResults) {
      logDebug('validateAndTypeSearchTerms', `-> [${String(reResults)}] from [${searchArgPadded}]`)
      let carryForward = ''
      for (const rr of reResults) {
        let r = rr.trim()
        // Add term as long as it doesn't start with a * or ? or is empty
        if (r !== '') {
          // logDebug('r', `[${r}]`)
          outputArray.push(r)
        }
      }
    } else {
      logWarn('normaliseSearchTerms', `Failed to find valid search terms found in [${searchArg}] despite regex magic`)
    }
  }
  if (outputArray.length === 0) logWarn('normaliseSearchTerms', `No valid search terms found in [${searchArg}]`)

  return outputArray
}

/**
* Validate and categorise search terms, returning searchTermObject(s).
* @author @jgclark
* @param {string} searchArg string containing search term(s) or array of search terms
* @param {boolean} allowEmptyOrOnlyNegative search terms?
* @returns {Array<typedSearchTerm>}
* @tests in jest file
*/
export function validateAndTypeSearchTerms(searchArg: string, allowEmptyOrOnlyNegative: boolean = false): Array<typedSearchTerm> {
  const normalisedTerms = normaliseSearchTerms(searchArg)
  logDebug('validateAndTypeSearchTerms', `starting with ${String(normalisedTerms.length)} normalised terms: [${String(normalisedTerms)}]`)

  // Don't allow 0 terms, apart from
  // Special case for @JPR1972: allow negative or empty only
  if (normalisedTerms.length === 0 && !allowEmptyOrOnlyNegative) {
    logError(pluginJson, `No search terms submitted. Stopping.`)
    return []
  }

  // Now type the supplied search terms
  const validatedTerms: Array<typedSearchTerm> = []
  for (const u of normalisedTerms) {
    let t = u.trim()
    // Only proceed if this doesn't have a wildcard at the start
    if (/^[^\*\?]/.test(t)) {
      let thisType = ''
      const thisRep = t
      if (t[0] === '+') {
        thisType = 'must'
        t = t.slice(1)
      } else if (t[0] === '-') {
        thisType = 'not-line'
        t = t.slice(1)
      } else if (t[0] === '!') {
        thisType = 'not-note'
        t = t.slice(1)
      } else {
        thisType = 'may'
      }
      validatedTerms.push({ term: t, type: thisType, termRep: thisRep })
    } else {
      logDebug('normaliseSearchTerms', `- ignoring invalid search term: [${t}]`)
    }
  }

  // Stop if we have a silly number of search terms
  if (validatedTerms.length > 9) {
    logWarn(pluginJson, `Too many search terms given (${validatedTerms.length}); stopping as this might be an error.`)
    return []
  }

  // Now check we have a valid set of terms. (If they're not valid, return an empty array.)
  // Invalid if we don't have any must-have or may-have search terms
  if (validatedTerms.filter((t) => (t.type === 'may' || t.type === 'must')).length === 0) {
    if (allowEmptyOrOnlyNegative) {
      // Special case: requires adding an empty 'must' term
      logDebug(pluginJson, 'No positive match search terms given, so adding an empty one under the hood.')
      validatedTerms.push({ term: '', type: 'must', termRep: '<empty>' })
    } else {
      logWarn(pluginJson, 'No positive match search terms given; stopping.')
      return []
    }
  }

  let validTermsStr = `[${validatedTerms.map((t) => t.termRep).join(', ')}]`
  logDebug('search/validateAndTypeSearchTerms', `Validated ${String(validatedTerms.length)} terms -> ${validTermsStr}`)
  return validatedTerms
}

/**
* Optimise the order to tackle search terms. Assumes these have been normalised and validated already.
* @author @jgclark
* @param {Array<typedSearchTerm>} inputTerms
* @returns {Array<typedSearchTerm>} output
* TODO: @tests in jest file
*/
export function optimiseOrderOfSearchTerms(inputTerms: Array<typedSearchTerm>): Array<typedSearchTerm> {
  try {
    logDebug('optimiseOrderOfSearchTerms', `starting with ${String(inputTerms.length)} terms`)
    // Expand the typedSearchTerm object to include length of terms
    const expandedInputTerms = inputTerms.map((i) => {
      return {
        typeOrder: (i.type === 'must') ? 'aaa' : i.type, // 'must' needs to come first, so make it to 'aaa' in a separate variable in the item
        type: i.type,
        term: i.term,
        termRep: i.termRep,
        longestWordLength: i.term.length
      }
    })
    clo(expandedInputTerms, 'expandedInputTerms = ')
    const sortKeys = ['typeOrder', 'longestWordLength']
    logDebug('optimiseOrderOfSearchTerms', `- Will use sortKeys: [${String(sortKeys)}]`)
    const sortedTerms: Array<typedSearchTerm> = sortListBy(expandedInputTerms, sortKeys)
    clo(sortedTerms, 'optimiseOrderOfSearchTerms -> ')
    return sortedTerms
  } catch (err) {
    return []
  }
}

/**
 * Compute difference of two arrays, by a given property value
 * from https://stackoverflow.com/a/63745126/3238281
 * translated into Flow syntax with Generics by @nmn:
 * - PropertyName is no longer just a string type. It's now a Generic type itself called P. But we constrain P such that it must be string. How is this different from just a string? Instead of being any string, P can be a specific string literal. eg. id
 * - T is also constrained. T can no longer be any arbitrary type. It must be an object type that contains a key of the type P that we just defined. It may still have other keys indicated by the ...
 * @param {<Array<T>} arr The initial array
 * @param {<Array<T>} exclude The array to remove
 * @param {string} propertyName the key of the object to match on
 * @return {Array<T>}
 * @tests in jest file
 */
export function differenceByPropVal<P: string, T: { +[P]: mixed, ... }> (
  arr: $ReadOnlyArray < T >,
    exclude: $ReadOnlyArray < T >,
      propertyName: P
): Array < T > {
  return arr.filter(
    (a: T) => !exclude.find((b: T) => b[propertyName] === a[propertyName])
  )
}

/**
 * Simple Object equality test, working for ONE-LEVEL only objects.
 * from https://stackoverflow.com/a/5859028/3238281
 * @param {Object} o1
 * @param {Object} o2
 * @returns {boolean} does o1 = o2?
 * @test in jest file
 */
export function compareObjects(o1: Object, o2: Object): boolean {
  for (let p in o1) {
    if (o1.hasOwnProperty(p)) {
      if (o1[p] !== o2[p]) {
        return false
      }
    }
  }
  for (let p in o2) {
    if (o2.hasOwnProperty(p)) {
      if (o1[p] !== o2[p]) {
        return false
      }
    }
  }
  return true
}

/**
 * Remove the 'exclude' array terms from given 'arr' array.
 * Assumes both arrays are of the same Object type, and that we will only remove
 * when all properties are equal.
 * @param {Array<Object>} arr - array to remove from
 * @param {Array<Object>} exclucde - array to remove
 * @returns {Array<Object>} arr minus exclude
 * @tests in jest file
 */
export function differenceByObjectEquality<P: string, T: { +[P]: mixed, ... }> (
  arr: $ReadOnlyArray < T >,
    exclude: $ReadOnlyArray < T >
): Array < T > {
  return arr.filter(
    (a: T) => !exclude.find((b: T) => compareObjects(b, a))
  )
}

/**
 * Returns array of intersection of arrA + arrB (only for noteAndLine types)
 * TODO: Make a more generic version of this, possibly using help from
 * https://stackoverflow.com/questions/1885557/simplest-code-for-array-intersection-in-javascript
 * @author @jgclark
 *
 * @param {Array<noteAndLine>} arrA
 * @param {Array<noteAndLine>} arrB
 * @returns {Array<noteAndLine>} array of intersection of arrA + arrB
 */
export function noteAndLineIntersection(arrA: Array<noteAndLine>, arrB: Array<noteAndLine>):
  Array<noteAndLine> {
  const modA = arrA.map((m) => m.noteFilename + ':::' + String(m.index) + ':::' + m.line)
  const modB = arrB.map((m) => m.noteFilename + ':::' + String(m.index) + ':::' + m.line)
  const intersectionModArr = modA.filter(f => modB.includes(f))
  const intersectionArr: Array<noteAndLine> = intersectionModArr.map((m) => {
    let parts = m.split(':::')
    return { noteFilename: parts[0], index: Number(parts[1]), line: parts[2] }
  })
  return intersectionArr
}

/**
 * Get string representation of multiple search terms, complete with surrounding sqaure brackets (following Google's style)
 * @param {typedSearchTerm[]} searchTerms
 * @returns {string}
 */
export function getSearchTermsRep(typedSearchTerms: Array<typedSearchTerm>): string {
  return `[${typedSearchTerms.map((t) => t.termRep).join(', ')}]`
}

/**
 * This is where the search logic is applied, using the must/may/not terms.
 * Returns the subset of results, and can optionally limit the number of results returned to the first 'resultLimit' items.
 * If fromDateStr and toDateStr are given, then it will filter out results from Project Notes or the Calendar notes from outside that date range (measured at the first date of the Calendar note's period).
 * Note: assumes the order of searchTerms has been optimised before now
 *
 * Called by runSearchesV2
 * @param {Array<resultObjectTypeV3>}
 * @param {number} resultLimit (optional; defaults to 500)
 * @param {string?} fromDateStr optional start date limit
 * @param {string?} toDateStr optional end date limit
 * @returns {resultOutputTypeV3}
 * @tests in jest file
 */
export function applySearchOperators(
  termsResults: Array<resultObjectTypeV3>,
  resultLimit: number = 500,
  fromDateStr?: string,
  toDateStr?: string,
): resultOutputTypeV3 {
  const mustResultObjects: Array<resultObjectTypeV3> = termsResults.filter((t) => t.searchTerm.type === 'must')
  const mayResultObjects: Array<resultObjectTypeV3> = termsResults.filter((t) => t.searchTerm.type === 'may')
  const notResultObjects: Array<resultObjectTypeV3> = termsResults.filter((t) => t.searchTerm.type.startsWith('not'))
  logDebug('applySearchOperators', `Starting with ${getSearchTermsRep(termsResults.map(m => m.searchTerm))}: ${mustResultObjects.length} must terms; ${mayResultObjects.length} may terms; ${notResultObjects.length} not terms. Limiting to ${resultLimit} results. ${(fromDateStr && toDateStr) ? '- with dates from ' + fromDateStr + ' to ' + toDateStr : 'with no dates'}`)

  // clo(termsResults, 'resultObjectV3: ')

  let consolidatedNALs: Array<noteAndLine> = []
  let consolidatedNoteCount = 0
  let consolidatedLineCount = 0
  let uniquedFilenames: Array<string> = []

  // ------------------------------------------------------------
  // Write any *first* 'must' search results to consolidated set
  if (mustResultObjects.length > 0) {
    const r = mustResultObjects[0]
    for (const rnal of r.resultNoteAndLineArr) {
      // clo(rnal, 'must[${i}] / rnal: `)
      // logDebug('applySearchOperators', `- must: ${rnal.noteFilename} / '${rnal.line}'`)

      // Just add these 'must' results to the consolidated set
      consolidatedNALs.push(rnal)
    }
    consolidatedNoteCount = numberOfUniqueFilenames(consolidatedNALs)
    consolidatedLineCount = consolidatedNALs.length
    logDebug('applySearchOperators', `- must: after term 1, ${consolidatedLineCount} results`)

    // If no results by now, there's no point finding anything further, so just form up an almost-empty return
    if (consolidatedLineCount === 0) {
      logInfo('applySearchOperators', `- must: no results found after must term [${r.searchTerm.termRep}] so stopping early.`)
      const consolidatedResultsObject: resultOutputTypeV3 = {
        searchTermsRepArr: termsResults.map((m) => m.searchTerm.termRep),
        resultNoteAndLineArr: [],
        resultCount: 0,
        resultNoteCount: 0,
        fullResultCount: 0
      }
      return consolidatedResultsObject
    }

    // Write any *subsequent* 'must' search results to consolidated set,
    // having computed the intersection with the consolidated set
    if (mustResultObjects.length > 1) {
      let addedAny = false
      let j = 0
      for (const r of mustResultObjects) {
        // ignore first item; we compute the intersection of the others
        if (j === 0) {
          j++
          continue
        }

        const intersectionNALArray = noteAndLineIntersection(consolidatedNALs, r.resultNoteAndLineArr)
        logDebug('applySearchOperators', `- must: intersection of ${r.searchTerm.termRep} -> ${intersectionNALArray.length} results`)
        consolidatedNALs = intersectionNALArray
        j++
      }

      // Now need to consolidate the NALs
      consolidatedNALs = reduceNoteAndLineArray(consolidatedNALs)
      consolidatedNoteCount = numberOfUniqueFilenames(consolidatedNALs)
      consolidatedLineCount = consolidatedNALs.length
      // clo(consolidatedNALs, '(after must) consolidatedNALs:')
      logDebug('applySearchOperators', `- must: after all ${mustResultObjects.length} terms, ${consolidatedLineCount} results`)

      // If no results by now, there's no point finding anything further, so just form up an almost-empty return
      if (consolidatedLineCount === 0) {
        logInfo('applySearchOperators', `- must: no results found after must term [${r.searchTerm.termRep}] so stopping early.`)
        const consolidatedResultsObject: resultOutputTypeV3 = {
          searchTermsRepArr: termsResults.map((m) => m.searchTerm.termRep),
          resultNoteAndLineArr: [],
          resultCount: 0,
          resultNoteCount: 0,
          fullResultCount: 0
        }
        return consolidatedResultsObject
      }
    }
    logDebug('applySearchOperators', `Must: at end, ${consolidatedLineCount} results`)
  } else {
    logDebug('applySearchOperators', `- must: No results found for must-find search terms`)
  }

  // ------------------------------------------------------------
  // Check if we can add the 'may' search results to consolidated set
  let addedAny = false
  for (const r of mayResultObjects) {
    const tempArr: Array<noteAndLine> = consolidatedNALs
    // Add this result if 0 must terms, or it matches 1+ must results
    if (mustResultObjects.length === 0) {
      logDebug('applySearchOperators', `- may: as 0 'must' terms, we can add all for ${r.searchTerm.term}`)
      for (const rnal of r.resultNoteAndLineArr) {
        // logDebug('applySearchOperators', `- may: + ${rnal.noteFilename} / '${rnal.line}'`)
        consolidatedNALs.push(rnal)
        addedAny = true
      }
    } else {
      logDebug('applySearchOperators', `- may: there are 'must' terms, so will check before adding 'may' results`)
      for (const rnal of r.resultNoteAndLineArr) {
        // If this noteFilename is amongst the 'must' results then add
        if (consolidatedNALs.filter((f) => f.noteFilename === rnal.noteFilename).length > 0) {
          logDebug('applySearchOperators', `- may: + ${rnal.noteFilename} / '${rnal.line}'`)
          consolidatedNALs.push(rnal)
          addedAny = true
        }
      }
    }
  }
  if (addedAny) {
    // Now need to consolidate the NALs
    consolidatedNALs = reduceNoteAndLineArray(consolidatedNALs)
    consolidatedNoteCount = numberOfUniqueFilenames(consolidatedNALs)
    consolidatedLineCount = consolidatedNALs.length
    // clo(consolidatedNALs, '(after may) consolidatedNALs:')
  } else {
    logDebug('applySearchOperators', `- may: No results found.`)
  }
  logDebug('applySearchOperators', `May: at end, ${consolidatedLineCount} results from ${consolidatedNoteCount} notes`)

  // ------------------------------------------------------------
  // Delete any results from the consolidated set that match 'not-...' terms
  let removedAny = false
  for (const r of notResultObjects) {
    let searchTermStr = r.searchTerm.termRep
    let tempArr: Array<noteAndLine> = consolidatedNALs
    // Get number of results kept so far
    let lastResultNotesCount = numberOfUniqueFilenames(tempArr)
    let lastResultLinesCount = tempArr.length
    logDebug('applySearchOperators', `Not: term [${searchTermStr}] ...`)

    // Remove 'not' results from the previously-kept results
    // clo(r.resultNoteAndLineArr, `  - not rNALs:`)
    let reducedArr: Array<noteAndLine> = []
    if (r.searchTerm.type === 'not-line') {
      // reducedArr = differenceByInnerArrayLine(tempArr, r.resultNoteAndLineArr)
      reducedArr = differenceByObjectEquality(tempArr, r.resultNoteAndLineArr)
      // clo(tempArr, 'inArr')
      // clo(r.resultNoteAndLineArr, 'toRemove')
      // clo(reducedArr, 'reduced output')
    }
    else if (r.searchTerm.type === 'not-note') {
      reducedArr = differenceByPropVal(tempArr, r.resultNoteAndLineArr, 'noteFilename')
    }
    removedAny = true
    // clo(reducedArr, 'reducedArr: ')
    let removedNotes = lastResultNotesCount - numberOfUniqueFilenames(reducedArr)
    let removedLines = lastResultLinesCount - reducedArr.length
    consolidatedLineCount -= removedLines
    logDebug('applySearchOperators', `  - not: removed ${String(removedLines)} results from ${String(removedNotes)} notes`)

    // ready for next iteration
    consolidatedNALs = reducedArr
    lastResultNotesCount = consolidatedNoteCount
    lastResultLinesCount = consolidatedLineCount
  }
  // Now need to consolidate the NALs
  if (removedAny) {
    consolidatedNALs = reduceNoteAndLineArray(consolidatedNALs)
    consolidatedLineCount = consolidatedNALs.length
    consolidatedNoteCount = numberOfUniqueFilenames(consolidatedNALs)
  }
  logDebug('applySearchOperators', `Not: at end, ${consolidatedLineCount} results from ${consolidatedNoteCount} notes`)

  // ------------------------------------------------------------
  // If we have date limits, now apply them
  if (fromDateStr && toDateStr) {
    logDebug('applySearchOperators', `- Will now filter out Calendar note results outside ${fromDateStr}-${toDateStr} from ${consolidatedLineCount} results`)
    // Keep results only from within the date range (measured at the first date of the Calendar note's period)
    // TODO: ideally change to cover whole of a calendar note's date range
    consolidatedNALs = consolidatedNALs.filter((f) => /** !f.noteFilename.match(/^\d{4}/) || */ withinDateRange(getDateStrForStartofPeriodFromCalendarFilename(f.noteFilename), fromDateStr, toDateStr))
    consolidatedLineCount = consolidatedNALs.length
    consolidatedNoteCount = numberOfUniqueFilenames(consolidatedNALs)
    logDebug('applySearchOperators', `- After filtering out by date: ${consolidatedLineCount} results`)
  }

  let fullResultCount = consolidatedLineCount

  // ------------------------------------------------------------
  // Now check to see if we have more than config.resultLimit: if so only use the first amount to return
  if (resultLimit > 0 && consolidatedLineCount > resultLimit) {
    // First make a note of the total (to display later)
    logWarn('applySearchOperators', `We have more than ${resultLimit} results, so will discard all the ones beyond that limit.`)
    consolidatedNALs = consolidatedNALs.slice(0, resultLimit)
    consolidatedLineCount = consolidatedNALs.length
    consolidatedNoteCount = numberOfUniqueFilenames(consolidatedNALs)
    logDebug('applySearchOperators', `-> now ${consolidatedLineCount} results from ${consolidatedNoteCount} notes`)
  }

  // Form the output data structure
  const consolidatedResultsObject: resultOutputTypeV3 = {
    searchTermsRepArr: termsResults.map((m) => m.searchTerm.termRep),
    resultNoteAndLineArr: consolidatedNALs,
    resultCount: consolidatedLineCount,
    resultNoteCount: consolidatedNoteCount,
    fullResultCount: fullResultCount
  }
  // clo(consolidatedResultsObject, 'End of applySearchOperators: consolidatedResultsObject output: ')
  return consolidatedResultsObject
}


/**
 * Take possibly duplicative array, and reduce to unique items, retaining order.
 * There's an almost-same solution at https://stackoverflow.com/questions/53452875/find-if-two-arrays-are-repeated-in-array-and-then-select-them/53453045#53453045
 * but I can't make it work, so I'm going to hack it by joining the two object parts together,
 * then deduping, and then splitting out again
 * @author @jgclark
 * @param {Array<noteAndLine>} inArray
 * @returns {Array<noteAndLine>} outArray
 * @tests in jest file
 */
export function reduceNoteAndLineArray(inArray: Array<noteAndLine>): Array<noteAndLine> {
  const simplifiedArray = inArray.map((m) => m.noteFilename + ':::' + String(m.index) + ':::' + m.line)
  // const sortedArray = simplifiedArray.sort()
  const reducedArray = [... new Set(simplifiedArray)]
  const outputArray: Array<noteAndLine> = reducedArray.map((m) => {
    let parts = m.split(':::')
    return { noteFilename: parts[0], index: Number(parts[1]), line: parts[2] }
  })
  // clo(outputArray, 'output')
  return outputArray
}

/**
 * Count unique filenames present in array
 * @param {Array<noteAndLine>} inArray
 * @returns {number} of unique filenames present
 * @test in jest file
 */
export function numberOfUniqueFilenames(inArray: Array<noteAndLine>): number {
  const uniquedFilenames = inArray.map(m => m.noteFilename).filter((val, ind, arr) => arr.indexOf(val) === ind)
  // logDebug(`- uniqued filenames: ${uniquedFilenames.length}`)
  return uniquedFilenames.length
}

/**
 * Run a search over all search terms in 'termsToMatchArr' over the set of notes determined by the parameters.
 * V3 of this function, which assumes the order of terms in termsToMatchArr has been optimised.
 * Has an optional 'paraTypesToInclude' parameter of paragraph type(s) to include (e.g. ['open'] to include only open tasks). If not given, then no paragraph types will be excluded.
 *
 * @param {Array<string>} termsToMatchArr
 * @param {Array<string>} noteTypesToInclude (['notes'] or ['calendar'] or both)
 * @param {Array<string>} foldersToInclude (can be empty list)
 * @param {Array<string>} foldersToExclude (can be empty list)
 * @param {SearchConfig} config object for various settings
 * @param {Array<ParagraphType>?} paraTypesToInclude optional list of paragraph types to include (e.g. 'open'). If not given, then no paragraph types will be excluded.
 * @param {string?} fromDateStr optional start date limit to pass to applySearchOperators
 * @param {string?} toDateStr optional end date limit to pass to applySearchOperators
 * @returns {resultOutputTypeV3} results optimised for output
 */
export async function runSearchesV2(
  termsToMatchArr: Array<typedSearchTerm>,
  noteTypesToInclude: Array<string>,
  foldersToInclude: Array<string>,
  foldersToExclude: Array<string>,
  config: SearchConfig,
  paraTypesToInclude?: Array<ParagraphType> = [],
  fromDateStr?: string,
  toDateStr?: string,
): Promise<resultOutputTypeV3> {
  try {
    const termsResults: Array<resultObjectTypeV3> = []
    let resultCount = 0
    let outerStartTime = new Date()
    logDebug('runSearchesV2', `Starting with ${termsToMatchArr.length} search term(s) and paraTypes '${String(paraTypesToInclude)}'. (With ${(fromDateStr && toDateStr) ? fromDateStr + '-' + toDateStr : 'no'} dates.)`)

    //------------------------------------------------------------------
    // Get results for each search term independently and save
    // let lastTermType = ''
    for (const typedSearchTerm of termsToMatchArr) {
      let thisTermType = typedSearchTerm.type
      logDebug('runSearchesV2', `  - searching for term [${typedSearchTerm.termRep}] type '${thisTermType}':`)
      const innerStartTime = new Date()

      // do search for this search term, using configured options
      const resultObject: resultObjectTypeV3 = await runSearchV2(typedSearchTerm, noteTypesToInclude, foldersToInclude, foldersToExclude, config, paraTypesToInclude)

      // Save this search term and results as a new object in results array
      termsResults.push(resultObject)
      resultCount += resultObject.resultCount
      logDebug('runSearchesV2', `  -> ${resultObject.resultCount} results for '${typedSearchTerm.termRep}' in ${timer(innerStartTime)}`)

      // If we have no results from previous 'must' term, then return early
      if (thisTermType === 'must' && resultCount === 0) {
        logInfo('runSearchesV2', `- no results from 'must' term [${typedSearchTerm.termRep}], so not doing further searches.`)
        break
      }
      // TODO: Can we extend the above to check with not as well?
      // lastTermType = typedSearchTerm.termType
    }

    logDebug('runSearchesV2', `- ${termsToMatchArr.length} searches completed in ${timer(outerStartTime)} -> ${resultCount} results`)

    //------------------------------------------------------------------
    // Work out what subset of results to return, taking into the must/may/not terms, and potentially dates too
    outerStartTime = new Date()
    const consolidatedResultSet: resultOutputTypeV3 = applySearchOperators(termsResults, config.resultLimit, fromDateStr, toDateStr)
    logDebug('runSearchesV2', `- Applied search logic in ${timer(outerStartTime)}`)

    // For open tasks, add line sync with blockIDs (if we're using 'NotePlan' display style)
    // clo(consolidatedResultSet, 'after applySearchOperators, consolidatedResultSet =')
    if (config.resultStyle === 'NotePlan') {
      const syncdConsolidatedResultSet = await makeAnySyncs(consolidatedResultSet)
      // clo(syncdConsolidatedResultSet, 'after makeAnySyncs, syncdConsolidatedResultSet =')
      return syncdConsolidatedResultSet
    } else {
      return consolidatedResultSet
    }
  }
  catch (err) {
    logError('runSearchesV2', err.message)
    return { searchTermsRepArr: [], resultNoteAndLineArr: [], resultCount: 0, resultNoteCount: 0, fullResultCount: 0 } // for completeness
  }
}


/**
 * Run a search for 'searchTerm' over the set of notes determined by the parameters.
 * Returns a special resultObjectTypeV3 data structure: {
 *   searchTerm: typedSearchTerm
 *   resultNoteAndLineArr: Array<noteAndLine>  -- note: array
 *   resultCount: number
 * }
 * Has an optional 'paraTypesToInclude' parameter of paragraph type(s) to include (e.g. ['open'] to include only open tasks). If not given, then no paragraph types will be excluded.
 * Now allows empty search term if looking for 'open' paragraph types -- i.e. find all open tasks.
 * @author @jgclark
 * @param {Array<string>} typedSearchTerm object containing term and type
 * @param {Array<string>} noteTypesToInclude (['notes'] or ['calendar'] or both)
 * @param {Array<string>} foldersToInclude (can be empty list)
 * @param {Array<string>} foldersToExclude (can be empty list)
 * @param {SearchConfig} config object for various settings
 * @param {Array<ParagraphType>?} paraTypesToInclude optional list of paragraph types to include (e.g. 'open'). If not given, then no paragraph types will be excluded.
 * @returns {resultOutputTypeV3} combined result set optimised for output
 */
export async function runSearchV2(
  typedSearchTerm: typedSearchTerm,
  noteTypesToInclude: Array<string>,
  foldersToInclude: Array<string>,
  foldersToExclude: Array<string>,
  config: SearchConfig,
  paraTypesToInclude?: Array<ParagraphType> = [],
): Promise<resultObjectTypeV3> {
  try {
    const headingMarker = '#'.repeat(config.headingLevel)
    const fullSearchTerm = typedSearchTerm.term
    let searchTerm = fullSearchTerm
    let resultParas: Array<TParagraph> = []
    let multiWordSearch = false
    let wildcardedSearch = false
    logDebug('runSearchV2', `Starting for [${searchTerm}]`)

    // V1: get list of matching paragraphs for this string by n.paragraphs.filter
    // ...
    // V2: get list of matching paragraphs for this string by ???
    // ...
    // V3: use DataStore.search() API call that's now available
    // ...
    // V4: to deal with multi-word search terms, when the API doesn't,
    // we will now just search for the first word in the search term
    if (searchTerm.includes(" ")) {
      multiWordSearch = true
      const words = searchTerm.split(' ')
      // use the longest word not just the first
      const longestWord = words.length > 0 ? words.sort((a, b) => b.length - a.length)[0] : ''
      searchTerm = longestWord
      logDebug('runSearchV2', `multi-word: will just use [${searchTerm}] for [${fullSearchTerm}], and then do fuller check on results`)
    }

    // if search term includes * or ? then we need to do further wildcard filtering
    // reduce search term to just the part before the wildcard
    let beforeWildcardSearchTerm = ''
    let wildcardOnwardsSearchTerm = ''
    if (searchTerm.includes("*") || searchTerm.includes("?")) {
      searchTerm = searchTerm.split(/[\*\?]/, 1)[0]
      wildcardOnwardsSearchTerm = fullSearchTerm.slice(searchTerm.length)
      wildcardedSearch = true
      logDebug('runSearchV2', `wildcard: will now use [${searchTerm}] for [${fullSearchTerm}]`)
    }

    //-------------------------------------------------------
    // Finally, the actual Search API Call!
    CommandBar.showLoading(true, `Running search for ${fullSearchTerm} ${fullSearchTerm !== searchTerm ? '(via ' + searchTerm + ') ' : ''}...`)

    const response = await DataStore.search(searchTerm, noteTypesToInclude, foldersToInclude, foldersToExclude, false)
    let tempResult: Array<TParagraph> = response.slice() // to convert from $ReadOnlyArray to $Array

    CommandBar.showLoading(false)
    //-------------------------------------------------------

    // if we have a multi-word search, then filter out the results to those that just contain the full search term
    if (multiWordSearch) {
      logDebug('runSearchV2', `multi-word: before filtering: ${String(tempResult.length)}`)
      tempResult = tempResult.filter(tr => tr.content.includes(fullSearchTerm))
      logDebug('runSearchV2', `multi-word: after filtering: ${String(tempResult.length)}`)
    }

    // if search term includes * or ? then we need to do further wildcard filtering, but using regex version:
    // - replace ? with .
    // - replace * with [^\s]*? (i.e. any anything within the same 'word')
    if (wildcardedSearch) {
      const regexSearchTerm = new RegExp('\\b' + fullSearchTerm.replace(/\?/g, '.').replace(/\*/g, '[^\\s]*?') + '\\b')
      logDebug('runSearchV2', `wildcard: before regex filtering with ${String(regexSearchTerm)}: ${String(tempResult.length)}`)
      tempResult = tempResult.filter(tr => regexSearchTerm.test(tr.content))
      logDebug('runSearchV2', `wildcard: after filtering: ${String(tempResult.length)}`)
    }

    if (paraTypesToInclude.length > 0) {
      CommandBar.showLoading(true, `Now filtering to para types '${String(paraTypesToInclude)}' ...`)
      // Check each result and add to the resultParas array only if it matches the given paraTypesToInclude
      for (const tr of tempResult) {
        if (paraTypesToInclude.includes(tr.type)) {
          resultParas.push(tr)
        }
      }
      logDebug('runSearchV2', `- found ${resultParas.length} open tasks to work from`)
    } else {
      resultParas = tempResult
    }

    const noteAndLineArr: Array<noteAndLine> = []

    // Dedupe identical synced lines (if wanted)
    logDebug('runSearchV2', `- Before dedupe, ${resultParas.length} results for '${searchTerm}'`)
    resultParas = eliminateDuplicateSyncedParagraphs(resultParas, 'most-recent')
    logDebug('runSearchV2', `- After dedupe, ${resultParas.length} results for '${searchTerm}'`)

    if (resultParas.length > 0) {
      logDebug('runSearchV2', `- Found ${resultParas.length} results for '${searchTerm}'`)

      // Try creating much smaller data sets, without full Note or Para. Use filename for disambig later.
      let resultFieldSets: Array<reducedFieldSet> = resultParas.map((p) => {
        const note = p.note
        const tempDate = note ? toISOShortDateTimeString(note.createdDate) : '?'
        const fieldSet = {
          filename: note?.filename ?? '<error>',
          changedDate: note?.changedDate,
          createdDate: note?.createdDate,
          title: displayTitle(note),
          type: p.type,
          content: p.content,
          // modify rawContent slightly by turning ## headings into **headings** to make output nicer
          rawContent: (p.type === 'title') ? `**${p.content}**` : p.rawContent,
          lineIndex: p.lineIndex,
        }
        return fieldSet
      })

      // Drop out search results with the wrong paragraph type (if any given)
      let filteredParas: Array<reducedFieldSet> = []
      logDebug('runSearchV2', `- before types filter (${paraTypesToInclude.length} = '${String(paraTypesToInclude)}')`)
      if (paraTypesToInclude && paraTypesToInclude.length > 0) {
        filteredParas = resultFieldSets.filter((p) => paraTypesToInclude.includes(p.type))
        logDebug('runSearchV2', `- after types filter (to ${String(paraTypesToInclude)}), ${filteredParas.length} results`)
      } else {
        filteredParas = resultFieldSets
        logDebug('runSearchV2', `- no type filtering requested`)
      }

      // Drop out search results found only in a URL or the path of a [!][link](path)
      resultFieldSets = filteredParas
        .filter((f) => !isTermInURL(searchTerm, f.content))
        .filter((f) => !isTermInMarkdownPath(searchTerm, f.content))
      if (resultFieldSets.length !== filteredParas.length) {
        logDebug('runSearchV2', `  - URL/path filtering removed ${String(filteredParas.length - resultFieldSets.length)} results`)
      }

      // Look-up table for sort details
      const sortMap = new Map([
        ['note title', ['title', 'lineIndex']],
        ['folder name then note title', ['filename', 'lineIndex']],
        ['updated (most recent note first)', ['-changedDate', 'lineIndex']],
        ['updated (least recent note first)', ['changedDate', 'lineIndex']],
        ['created (newest note first)', ['-createdDate', 'lineIndex']],
        ['created (oldest note first)', ['createdDate', 'lineIndex']],
      ])
      const sortKeys = sortMap.get(config.sortOrder) ?? 'title' // get value, falling back to 'title'
      logDebug('runSearchV2', `- Will use sortKeys: [${String(sortKeys)}] from ${config.sortOrder}`)
      const sortedFieldSets: Array<reducedFieldSet> = sortListBy(resultFieldSets, sortKeys)

      // Form the return object from sortedFieldSets
      for (let i = 0; i < sortedFieldSets.length; i++) {
        noteAndLineArr.push({
          noteFilename: sortedFieldSets[i].filename,
          index: sortedFieldSets[i].lineIndex,
          line: sortedFieldSets[i].rawContent,
        })
      }
    }
    let resultCount = noteAndLineArr.length
    logDebug('runSearchV2', `- end of runSearchV2 for [${searchTerm}]: ${resultCount} results from ${numberOfUniqueFilenames(noteAndLineArr)} notes`)

    const returnObject: resultObjectTypeV3 = {
      searchTerm: typedSearchTerm,
      resultNoteAndLineArr: noteAndLineArr,
      resultCount: resultCount,
    }
    return returnObject
  }
  catch (err) {
    logError('runSearchV2', err.message)
    const emptyResultObject = { searchTerm: '', resultsLines: [], resultCount: 0 }
    // $FlowFixMe[incompatible-return]
    return null // for completeness
  }
}

export function resultCounts(resultSet: resultOutputTypeV3): string {
  return (resultSet.resultCount < resultSet.fullResultCount)
    ? `(first ${resultSet.resultCount} from ${resultSet.fullResultCount} results from ${resultSet.resultNoteCount} notes)`
    : `(${resultSet.resultCount} results from ${resultSet.resultNoteCount} notes)`
}

/**
 * Write results set(s) out to a note, reusing it where it already exists.
 * The data is in the first parameter; the rest are various settings.
 * Note: It's now possible to give a 'heading' parameter: if it's given then just that section will be replaced, otherwise the whole contents will be deleted first.
 * @author @jgclark
 *
 * @param {resultOutputTypeV3} resultSet object
 * @param {string} requestedTitle requested note title to use/make
 * @param {string} titleToMatch partial title to match against existing note titles
 * @param {SearchConfig} config
 * @param {string?} xCallbackURL URL to cause a 'refresh' of this command
 * @param {boolean?} justReplaceSection if set, will just replace this justReplaceSection's section, not replace the whole note
 * @returns {string} filename of note we've written to
 */
export async function writeSearchResultsToNote(
  resultSet: resultOutputTypeV3,
  requestedTitle: string,
  titleToMatch: string,
  config: SearchConfig,
  xCallbackURL: string = '',
  justReplaceSection: boolean = false,
): Promise<string> {
  try {
    let outputNote: ?TNote
    let noteFilename = ''
    const headingMarker = '#'.repeat(config.headingLevel)
    const searchTermsRepStr = `'${resultSet.searchTermsRepArr.join(' ')}'`.trim() // Note: we normally enclose in [] but here need to use '' otherwise NP Editor renders the link wrongly
    logDebug('writeSearchResultsToNote', `Starting with ${resultSet.resultCount} results for [${searchTermsRepStr}] ...`)
    const xCallbackText = (xCallbackURL !== '') ? ` [🔄 Refresh results for ${searchTermsRepStr}](${xCallbackURL})` : ''
    const timestampAndRefreshLine = `at ${nowLocaleShortDateTime()}${xCallbackText}`

    // Add each result line to output array
    // let titleLines = `# ${requestedTitle}\n${timestampAndRefreshLine}`
    let titleLines = `# ${requestedTitle}`
    let headingLine = ''
    let resultsContent = ''
    // First check if we have any results
    if (resultSet.resultCount > 0) {
      resultsContent = '\n' + createFormattedResultLines(resultSet, config).join('\n')
      const resultCountsStr = resultCounts(resultSet)
      headingLine += `${searchTermsRepStr} ${resultCountsStr}`
    }
    else {
      // No results
      headingLine = `${searchTermsRepStr}`
      resultsContent = "(no matches)"
    }
    // Prepend the results part with the timestamp+refresh line
    resultsContent = `${timestampAndRefreshLine}${resultsContent}`
    // logDebug('writeSearchResultsToNote', `resultsContent is ${resultsContent.length} bytes`)

    // Get existing note by start-of-string match on titleToMatch, if that is supplied, or requestedTitle if not.
    outputNote = await getOrMakeNote(requestedTitle, config.folderToStore, titleToMatch)
    if (outputNote) {
      // If the relevant note has more than just a title line, decide whether to replace all contents, or just replace a given heading section
      if (justReplaceSection && outputNote.paragraphs.length > 1) {
        // Just replace the heading section, to allow for some text to be left between runs
        logDebug('writeSearchResultsToNote', `- just replacing section '${searchTermsRepStr}' in ${outputNote.filename}`)
        replaceSection(outputNote, searchTermsRepStr, headingLine, config.headingLevel, resultsContent)

        // Because of a change in where the timestamp is displayed, we potentially need to remove it from line 1 of the note
        const line1 = outputNote.paragraphs[1].content
        if (line1.startsWith('at ') && line1.includes('Refresh results for ')) {
          logDebug('writeSearchResultsToNote', `- removing timestamp from line 1 of ${outputNote.filename}. This should be one-time-only operation.`)
          outputNote.removeParagraphAtIndex(1)
        }
      }
      else {
        // Replace all note contents
        logDebug('writeSearchResultsToNote', `- replacing note content in ${outputNote.filename}`)
        const newContent = `${titleLines}\n${headingMarker} ${headingLine}\n${resultsContent}`
        // logDebug('', `${newContent} = ${newContent.length} bytes`)
        outputNote.content = newContent
      }
      noteFilename = outputNote.filename ?? '<error>'
      logDebug('writeSearchResultsToNote', `written resultSet for [${searchTermsRepStr}] to the note ${noteFilename} (${displayTitle(outputNote)})`)
      // logDebug('writeSearchResultsToNote', `-> ${String(outputNote.content?.length)} bytes`)
      return noteFilename
    }
    else {
      throw new Error(`Couldn't find or make note for ${requestedTitle}. Stopping.`)
    }
  }
  catch (err) {
    logError('writeSearchResultsToNote', err.message)
    return 'error' // for completeness
  }
}

/**
 * Create nicely-formatted Markdown lines to display 'resultSet', using settings from 'config'
 * @author @jgclark
 * @param {resultOutputTypeV2} resultSet
 * @param {SearchConfig} config
 * @returns {Array<string>} formatted search reuslts
 */
export function createFormattedResultLines(resultSet: resultOutputTypeV3, config: SearchConfig): Array<string> {
  try {
    const resultOutputLines: Array<string> = []
    const headingMarker = '#'.repeat(config.headingLevel + 1)
    const simplifyLine = (config.resultStyle === 'Simplified')

    // Get array of 'may' or 'must' search terms ready to display highlights
    const mayOrMustTermsRep = resultSet.searchTermsRepArr.filter((f) => f[0] !== '-')
    // Take off leading + or ! if necessary
    const mayOrMustTerms = mayOrMustTermsRep.map((f) => (f.match(/^[\+\!]/)) ? f.slice(1) : f)
    const notEmptyMayOrMustTerms = mayOrMustTerms.filter((f) => f !== '')
    // logDebug('createFormattedResultLines', `Starting with ${notEmptyMayOrMustTerms.length} notEmptyMayOrMustTerms (${String(notEmptyMayOrMustTerms)}) / simplifyLine? ${String(simplifyLine)} / groupResultsByNote? ${String(config.groupResultsByNote)} / config.resultQuoteLength = ${String(config.resultQuoteLength)}`)
    // Add each result line to output array
    let lastFilename: string
    let nc = 0
    for (const rnal of resultSet.resultNoteAndLineArr) {
      // clo(rnal, `resultNoteAndLineArr[${nc}]`)
      if (config.groupResultsByNote) {
        // Write each line without transformation, grouped by Note, with Note headings inserted accordingly
        let thisFilename = rnal.noteFilename
        if (thisFilename !== lastFilename && thisFilename !== '') {
          // though only insert heading if noteFilename isn't blank
          resultOutputLines.push(`${headingMarker} ${getNoteTitleFromFilename(rnal.noteFilename, true)}`)
        }
        const outputLine = trimAndHighlightTermInLine(rnal.line, notEmptyMayOrMustTerms, simplifyLine, config.highlightResults, config.resultPrefix, config.resultQuoteLength)
        resultOutputLines.push(outputLine)
        nc++
        lastFilename = thisFilename
      } else {
        // FIXME: suffixes causing sync line problems.
        // - do I need to remove this non-grouped option entirely?

        // Write the line, first transforming it to add context on the end, and make other changes according to what the user has configured
        const outputLine = trimAndHighlightTermInLine(rnal.line, notEmptyMayOrMustTerms, simplifyLine, config.highlightResults, config.resultPrefix, config.resultQuoteLength) + getNoteContextAsSuffix(rnal.noteFilename, config.dateStyle)
        resultOutputLines.push(outputLine)
        nc++
      }
    }
    logDebug('createFormattedResultLines', `added ${nc} output lines`)
    return resultOutputLines
  }
  catch (err) {
    logError('createFormattedResultLines', err.message)
    clo(resultSet)
    return [] // for completeness
  }
}

/**
 * Go through results, and if there are open task lines, then sync lines by adding a blockID (having checked there isn't one already).
 * @author @jgclark
 * @param {resultOutputTypeV3} input
 * @returns {resultOutputTypeV3}
 */
export async function makeAnySyncs(input: resultOutputTypeV3): Promise<resultOutputTypeV3> {
  try {
    // Go through each line looking for open tasks
    let linesToSync = []
    let rnalCount = 0
    for (let rnal of input.resultNoteAndLineArr) {
      // Get the line details (have to get from DataStore)
      const thisIndex = rnalCount
      const thisLine = rnal.line
      const thisNote = getNoteByFilename(rnal.noteFilename)
      const thisPara = thisNote?.paragraphs?.[rnal.index]
      const thisType = thisPara?.type ?? ''

      // If this line is an open-type task without existing blockID, then add to array to process
      if (thisNote && SYNCABLE_PARA_TYPES.includes(thisType) && thisPara && !thisPara?.blockId) {
        linesToSync.push([thisIndex, thisLine, thisNote, thisPara, thisType])
        logDebug('makeAnySyncs', `- lineToSync from rnal index ${thisIndex}`)
      }
      rnalCount++
    }

    // If >=20 open tasks, check user really wants to do this
    if (linesToSync.length >= 20) {
      const res = await showMessageYesNo(`I have found ${linesToSync.length} results with open tasks, which will be sync'd to this note. Do you wish to continue?`)
      if (res !== 'Yes') {
        return input
      }
    }

    let output = input
    if (linesToSync.length > 0) {
      for (const lineDetails of linesToSync) {
        let [thisIndex, thisLine, thisNote, thisPara, thisType] = lineDetails
        // Add blockID to source
        // logDebug('makeAnySyncs', `- will add blockId to source line '${thisLine}' index ${thisIndex}`)
        thisNote.addBlockID(thisPara)
        thisNote.updateParagraph(thisPara)
        const thisBlockID = thisPara.blockId ?? '<error>'
        // logDebug('makeAnySyncs', `- added blockId '${thisBlockID}' to source line`)
        // Now append to result
        const updatedLine = `${thisLine} ${thisBlockID}`
        output.resultNoteAndLineArr[thisIndex].line = updatedLine
        logDebug('makeAnySyncs', `- appended blockId to result ${thisIndex} -> '${updatedLine}'`)
      }
    } else {
      logDebug('makeAnySyncs', `No Synced lines in result set`)
    }
    return output
  }
  catch (err) {
    logError('makeAnySyncs', err.message)
    // $FlowFixMe[incompatible-return]
    return null
  }
}
