// @flow
//-----------------------------------------------------------------------------
// Search Extensions helpers
// Jonathan Clark
// Last updated 2.12.2022 for v1.1.0-beta, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { formatNoteDate, nowLocaleDateTime, toISOShortDateTimeString } from '@helpers/dateTime'
import { clo, logDebug, logError, logWarn, timer } from '@helpers/dev'
import { getFilteredFolderList } from '@helpers/folders'
import { displayTitle, type headingLevelType, titleAsLink } from '@helpers/general'
import { getNoteByFilename, getNoteContextAsSuffix, getNoteTitleFromFilename, getOrMakeNote, getProjectNotesInFolder, replaceSection } from '@helpers/note'
import { isTermInMarkdownPath, isTermInURL } from '@helpers/paragraph'
import { trimAndHighlightTermInLine } from '@helpers/search'
import { sortListBy } from '@helpers/sorting'
import { showMessage, showMessageYesNo } from '@helpers/userInput'

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

//------------------------------------------------------------------------------
// Settings

export type SearchConfig = {
  autoSave: boolean,
  folderToStore: string,
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
    clo(v2Config, `${pluginID} settings:`)
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
* Quoted multi-word search terms (e.g. ["Bob Smith"]) are by default treated as [+Bob +Smith] as I now discover the API doesn't support quoted multi-word search phrases.
* @author @jgclark
* @param {string | Array<string>} searchArg string containing search term(s) or array of search terms
* @param {boolean?} modifyQuotedTermsToAndedTerms 
* @returns {Array<string>} normalised search term(s)
* @tests in jest file
*/
export function normaliseSearchTerms(
  searchArg: string,
  modifyQuotedTermsToAndedTerms?: boolean = true
): Array<string> {
  logDebug("normaliseSearchTerms()", `starting for [${searchArg}]`)
  let outputArray = []
  // Take a simple string and process it to turn into an array of string, according to one of several schemes:
  if (!searchArg.match(/\w{2,}/)) {
    // this has no words (at least 2 long) -> empty
    logWarn(pluginJson, `No valid words found in [${searchArg}]`)
    return []
  }
  if (searchArg.match(/\s[\+\-\!]\s/)) {
    // this has free-floating operators -> error
    logWarn(pluginJson, `Search string not valid: unattached search operators found in [${searchArg}]`)
    return []
  }

  // change simple form [x,y,z] style -> array of x,y,z
  if (searchArg.match(/\w{3,}\s*,\s*\w{3,}/)) {
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

  // // As we want to modify quoted phrases to +words, Go through terms to find multi-word ones, and change to individual + terms
  // else if (modifyQuotedTermsToAndedTerms) {
  //   const reResults = searchArg.match(/(?:[^!+-])(?:([\"'])(.+?)\1)/g)
  //   if (reResults) {
  //     for (const r of reResults) {
  //       // the match groups are
  //       // 0/total matches [ "word1 word2"]
  //       // 1 first of matching pair of quotes
  //       // 2 phrase in quotes
  //       // modify searchArg to make +words instead
  //       const innerTerms = r[2].split(' ')
  //       for (const t of innerTerms) {
  //         outputArray.push(`+${t}`)
  //       }
  //     }
  //   }
  //   // Now need to add terms not in quotes
  //   // ???
  // }

  // else treat as [x y z], with or without quoted phrases.
  else {
    // This Regex attempts to split words:
    // - but keeping text in double or single quotes together
    // - and prefixed search operators !/+/-
    // - and #hashtag/child and @mention(5) possibilities
    // - a word now may include a period, hash or dash
    // To make it more manageable we need to add space to front and end
    const RE_WOW = new RegExp(/\s([\-\+\!]?)([\-\+\!]?)(?:([\'"])(.+?)\3)|([\-\+\!]?[\w\.\-#@\/\(\)]+)/g)
    const searchArgPadded = ' ' + searchArg + ' '
    const reResults = searchArgPadded.matchAll(RE_WOW)
    if (reResults) {
      for (const r of reResults) {
        // this concats match groups:
        // 1 (optional operator prefix)
        // 4 (phrase inside quotes) or
        // 5 (word not in quotes)

        if (r[4] && r[4].includes(' ') && modifyQuotedTermsToAndedTerms) {
          // if we want to modify quoted phrases to +words, and we have some quoted phrases,
          // go through terms to find multi-word ones, and change to individual + terms.
          // But if we have a simple quoted ["word"] then strip quotes but don't add +
          // TODO: deal with [-"word1 word2"] case -> '-word1', '-word2' I guess.
          // TODO: deal with mid-word apostrophe [can't term] case
          const innerTerms = r[4].split(' ')
          for (const t of innerTerms) {
            outputArray.push(`+${t}`)
          }
        }
        else {
          // add whichever bit of the term matches
          outputArray.push(`${r[1] ?? ''}${r[4] ?? ''}${r[5] ?? ''}`)
        }
      }
    } else {
      logWarn(pluginJson, `Failed to find valid search terms found in [${searchArg}] despite regex magic`)
    }
  }
  if (outputArray.length === 0) logWarn(pluginJson, `No valid search terms found in [${searchArg}]`)

  return outputArray
}

 /**
 * Validate and categorise search terms, returning searchTermObject(s).
 * @author @jgclark
 * @param {string} searchArg string containing search term(s) or array of search terms
 * @returns Array<typedSearchTerm>
 * @tests in jest file
 */
export function validateAndTypeSearchTerms(searchArg: string, allowEmptyOrOnlyNegative: boolean = false): Array<typedSearchTerm> {

  const normalisedTerms = normaliseSearchTerms(searchArg)

  // Don't allow 0 terms, apart from 
  // Special case for @JPR1972: allow negative or empty only
  if (normalisedTerms.length === 0) {
    if (!allowEmptyOrOnlyNegative) {
      logError(pluginJson, `No search terms submitted. Stopping.`)
      return []
    }
  }

  // Now validate the terms, and typing the rest.
  // Note: now allowing short search terms, as we have a later resultLimit
  const validatedTerms: Array<typedSearchTerm> = []
  for (const u of normalisedTerms) {
    let t = u.trim()
    // if (t.length >= 2) {
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
    // } else {
    //   logWarn(pluginJson, `Note: search term '${t}' was removed because it is less than 3 characters long`)
    // }
  }

  // Now check we have a valid set of terms. (If they're not valid, return an empty array.)
  // Invalid if we don't have any must-have or may-have search terms
  if (validatedTerms.filter((t) => (t.type === 'may' || t.type === 'must')).length === 0) {
    if (!allowEmptyOrOnlyNegative) {
      // Special case: requires adding an empty 'must' term
      logWarn(pluginJson, 'no positive match search terms given; stopping.')
      return []
    } else {
      validatedTerms.push({ term: '', type: 'must', termRep: '' })
    }
  }
  // Stop if we have a silly number of search terms
  if (validatedTerms.length > 7) {
    logWarn(pluginJson, `too many search terms given (${validatedTerms.length}); stopping as this might be an error.`)
    return []
  }

  let validTermsStr = `[${validatedTerms.map((t) => t.termRep).join(', ')}]`
  logDebug('search/validateAndTypeSearchTerms', `Validated terms: ${validTermsStr}`)
  return validatedTerms
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
 * Get string representation of multiple search terms
 * @param {typedSearchTerm[]} searchTerms
 * @returns {string}
 */
function getSearchTermsRep(typedSearchTerms: Array<typedSearchTerm>): string {
  return `[${typedSearchTerms.map((t) => t.termRep).join(' ')}]`
}

/**
 * This is where the search logic is applied, using the must/may/not terms.
 * Returns the subset of results, and can optionally limit the number of results returned to the first 'resultLimit' items
 * Called by runSearchesV2
 * @param {Array<resultObjectTypeV3>}
 * @param {number} resultLimit (optional; defaults to 500)
 * @returns {resultOutputTypeV3}
 * @tests in jest file
 */
export function applySearchOperators(
  termsResults: Array<resultObjectTypeV3>,
  resultLimit: number = 500
): resultOutputTypeV3 {
  const mustResultObjects: Array<resultObjectTypeV3> = termsResults.filter((t) => t.searchTerm.type === 'must')
  const mayResultObjects: Array<resultObjectTypeV3> = termsResults.filter((t) => t.searchTerm.type === 'may')
  const notResultObjects: Array<resultObjectTypeV3> = termsResults.filter((t) => t.searchTerm.type.startsWith('not'))
  logDebug('applySearchOperators', `Starting with ${getSearchTermsRep(termsResults.map(m => m.searchTerm))}: ${mustResultObjects.length} must terms; ${mayResultObjects.length} may terms; ${notResultObjects.length} not terms.`)

  // clo(termsResults, 'resultObjectV3: ')

  let consolidatedNALs: Array<noteAndLine> = []
  let consolidatedNoteCount = 0
  let consolidatedLineCount = 0
  let uniquedFilenames = []

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
        // clo(consolidatedNALs, `consolidatedNALs after must[${j}] intersection`)
        j++
      }

      // Now need to consolidate the NALs
      consolidatedNALs = reduceNoteAndLineArray(consolidatedNALs)
      consolidatedNoteCount = numberOfUniqueFilenames(consolidatedNALs)
      consolidatedLineCount = consolidatedNALs.length
      // clo(consolidatedNALs, '(after must) consolidatedNALs:')
    }
    logDebug('applySearchOperators', `Must: at end, ${consolidatedLineCount} results`)
  } else {
    logDebug('applySearchOperators', `- must: No results found for must-find search terms.`)
  }

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
  logDebug('applySearchOperators', `May: at end, ${consolidatedLineCount} results from ${consolidatedNoteCount} notes:`)

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
  let fullResultCount = consolidatedLineCount

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
 * V2 of this function
 * Has an optional 'paraTypesToInclude' parameter of paragraph type(s) to include (e.g. ['open'] to include only open tasks). If not given, then no paragraph types will be excluded.
 * 
 * @param {Array<string>} termsToMatchArr
 * @param {Array<string>} noteTypesToInclude (['notes'] or ['calendar'] or both)
 * @param {Array<string>} foldersToInclude (can be empty list)
 * @param {Array<string>} foldersToExclude (can be empty list)
 * @param {SearchConfig} config object for various settings
 * @param {Array<ParagraphType>?} paraTypesToInclude optional list of paragraph types to include (e.g. 'open'). If not given, then no paragraph types will be excluded.
 * @returns {resultOutputTypeV3} results optimised for output
 */
export async function runSearchesV2(
  termsToMatchArr: Array<typedSearchTerm>,
  noteTypesToInclude: Array<string>,
  foldersToInclude: Array<string>,
  foldersToExclude: Array<string>,
  config: SearchConfig,
  paraTypesToInclude?: Array<ParagraphType> = [],
): Promise<resultOutputTypeV3> {
  try {
    const termsResults: Array<resultObjectTypeV3> = []
    let resultCount = 0
    let outerStartTime = new Date()
    logDebug('runSearchesV2', `Starting with ${termsToMatchArr.length} search terms (and paraTypes '${String(paraTypesToInclude)}')`)

    //------------------------------------------------------------------
    // Get results for each search term independently and save
    for (const typedSearchTerm of termsToMatchArr) {
      logDebug('runSearchesV2', `- searching for term [${typedSearchTerm.termRep}] ...`)
      const innerStartTime = new Date()

      // do search for this search term, using configured options
      const resultObject: resultObjectTypeV3 = await runSearchV2(typedSearchTerm, noteTypesToInclude, foldersToInclude, foldersToExclude, config, paraTypesToInclude)

      // Save this search term and results as a new object in results array
      termsResults.push(resultObject)
      resultCount += resultObject.resultCount
      logDebug('runSearchesV2', `- search (API): ${timer(innerStartTime)} for '${typedSearchTerm.termRep}' -> ${resultObject.resultCount} results`)
    }

    logDebug('runSearchesV2', `= Search time: ${timer(outerStartTime)}s for ${termsToMatchArr.length} searches -> ${resultCount} results`)

    //------------------------------------------------------------------
    // Work out what subset of results to return, taking into the must/may/not terms
    outerStartTime = new Date()
    const consolidatedResultSet: resultOutputTypeV3 = applySearchOperators(termsResults, config.resultLimit)
    logDebug('runSearchesV2', `= Applying search logic: ${timer(outerStartTime)}s`)

    // For open tasks, add line sync with blockIDs (if we're using 'NotePlan' display style)
    if (config.resultStyle === 'NotePlan') {
      // clo(consolidatedResultSet, 'after applySearchOperators, consolidatedResultSet =')
      const syncdConsolidatedResultSet = await makeAnySyncs(consolidatedResultSet)
      // clo(syncdConsolidatedResultSet, 'after makeAnySyncs, syncdConsolidatedResultSet =')
      return syncdConsolidatedResultSet
    } else {
      // clo(consolidatedResultSet, 'after applySearchOperators, consolidatedResultSet =')
      return consolidatedResultSet
    }
  }
  catch (err) {
    logError('runSearchesV2', err.message)
    // $FlowFixMe[incompatible-return]
    return null // for completeness
  }
}

/**
 * Go through results, and if there are open task linea, then sync lines by adding a blockID (having checked there isn't one already).
 * @author @jgclark
 * @param {resultOutputTypeV3} input
 * @returns {resultOutputTypeV3}
 */
async function makeAnySyncs(results: resultOutputTypeV3): Promise<resultOutputTypeV3> {
  try {
    // Go through each line looking for open tasks
    let linesToSync = []
    for (let rnal of results.resultNoteAndLineArr) {
      // Get the line details (have to get from DataStore)
      const thisLine = rnal.line
      const thisNote = getNoteByFilename(rnal.noteFilename)
      const thisPara = thisNote?.paragraphs?.[rnal.index]
      const thisType = thisPara?.type ?? ''

      if (thisNote && thisPara && thisType === 'open') {
        linesToSync.push([thisLine, thisNote, thisPara, thisType])
      }
    }

    // If >=20 results, check user really wants to do this
    if (linesToSync.length >= 20) {
      const res = await showMessageYesNo(`I have found ${linesToSync.length} results with open tasks, which will be sync'd to this note. Do you wish to continue?`)
      if (res !== 'Yes') {
        // $FlowFixMe[incompatible-return]
        return null
      }
    }

    if (linesToSync.length > 0) {
      for (const lineDetails of linesToSync) {
        let [thisLine, thisNote, thisPara, thisType] = lineDetails
        if (thisPara.blockId) {
          // Don't do anything as it has a blockID already
          const thisBlockID = thisPara.blockId
          logDebug('makeAnySyncs', `- existing blockId ${thisBlockID} in line '${thisLine}', so not adding again`)
        } else {
          // Add blockID to source, and append to result
          logDebug('makeAnySyncs', `- will add blockId to source line '${thisLine}'`)
          thisNote.addBlockID(thisPara)
          thisNote.updateParagraph(thisPara)
          const thisBlockID = thisPara.blockId ?? '<error>'
          logDebug('makeAnySyncs', `- added blockId '${thisBlockID}' to source line`)
          thisLine += ` ${thisBlockID}`
          logDebug('makeAnySyncs', `- appended blockId to result -> '${thisLine}'`)
        }
      }
    } else {
      // logDebug('makeAnySyncs', `- not an 'open' type: ${thisType}: '${thisLine}'`)
    }
    return results
  }
  catch (err) {
    logError('makeAnySyncs', err.message)
    // $FlowFixMe[incompatible-return]
    return null
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
    const searchTerm = typedSearchTerm.term
    let resultParas: Array<TParagraph> = []
    logDebug('runSearchV2', `Starting for [${searchTerm}]`)

    // get list of matching paragraphs for this string
    if (searchTerm !== '') {
      CommandBar.showLoading(true, `Running search for ${typedSearchTerm.termRep} ...`)
      const tempResult = await DataStore.search(searchTerm, noteTypesToInclude, foldersToInclude, foldersToExclude) // avoids $ReadOnlyArray mismatch problem
      resultParas = tempResult.slice()
      CommandBar.showLoading(false)
    } else if (paraTypesToInclude.includes('open')) {
      CommandBar.showLoading(true, `Finding all tasks without initial search term, but restricting to types '${String(paraTypesToInclude)}' ...`)
      const folderList = getFilteredFolderList(foldersToExclude, true)

      for (const f of folderList) {
        const noteList = getProjectNotesInFolder(f) // does not include sub-folders
        // logDebug('runSearchV2', `- checking ${noteList.length} notes in folder '${f}'`)
        for (const n of noteList) {
          const theseResults = n.paragraphs?.filter((p) => p.type === 'open') ?? []
          // if (theseResults.length > 0) { logDebug('runSearchV2', `   ->  ${theseResults.length}`) }
          resultParas.push(...theseResults)
        }
      }
      CommandBar.showLoading(false)
      logDebug('runSearchV2', `- found ${resultParas.length} open tasks to work from`)
    } else {
      // Shouldn't get here, so raise an error
      throw new Error("Empty search term: stopping.")
    }

    const noteAndLineArr: Array<noteAndLine> = []

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
      resultFieldSets = filteredParas.filter((f) => !isTermInURL(searchTerm, f.content)).filter((f) => !isTermInMarkdownPath(searchTerm, f.content))
      logDebug('runSearchV2', `  - after URL filter, ${resultFieldSets.length} results`)

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
    logDebug('writeSearchResultsToNote', `Starting ...`)
    let outputNote: ?TNote
    let noteFilename = ''
    const headingMarker = '#'.repeat(config.headingLevel)
    const searchTermsRepStr = `"${resultSet.searchTermsRepArr.join(' ')}"`
    const xCallbackLine = (xCallbackURL !== '') ? ` [🔄 Refresh results for '${searchTermsRepStr}'](${xCallbackURL})` : ''

    // Get array of 'may' or 'must' search terms
    const mayOrMustTerms = resultSet.searchTermsRepArr.filter((f) => f[0] !== '-')

    // Add each result line to output array
    let titleLines = `# ${requestedTitle}\nat ${nowLocaleDateTime}${xCallbackLine}`
    let headingLine = ''
    let resultsContent = ''
    // First check if we have any results
    if (resultSet.resultCount > 0) {
      // resultsContent += `\n${headingMarker} ${searchTermsRepStr} ${resultCountsStr}\n${resultOutputLines.join('\n')}`
      resultsContent = createFormattedResultLines(resultSet, config).join('\n')
      const resultCountsStr = resultCounts(resultSet)
      headingLine += `${searchTermsRepStr} ${resultCountsStr}`
    }
    else {
      // No results
      // resultsContent += `\n${headingMarker} ${searchTermsRepStr}\n(no matches)`
      headingLine = `${searchTermsRepStr}`
      resultsContent = `(no matches)`
    }
    // logDebug('writeSearchResultsToNote', resultsContent)

    // Get existing note by start-of-string match on titleToMatch, if that is supplied, or requestedTitle if not.
    outputNote = await getOrMakeNote(requestedTitle, config.folderToStore, titleToMatch)
    if (outputNote) {
      // If the relevant note has more than just a title line, decide whether to replace all contents, or just replace a given heading section
      if (justReplaceSection && outputNote.paragraphs.length > 1) {
        // Just replace the heading section, to allow for some text to be left between runs
        logDebug('writeSearchResultsToNote', `- just replacing section '${searchTermsRepStr}' in ${outputNote.filename}`)
        replaceSection(outputNote, searchTermsRepStr, headingLine, config.headingLevel, resultsContent)
      }
      else {
        // Replace all note contents
        logDebug('writeSearchResultsToNote', `- replacing note content in ${outputNote.filename}`)
        outputNote.content = `${titleLines}\n${headingMarker} ${headingLine}\n${resultsContent}`
      }
      noteFilename = outputNote.filename ?? '<error>'
      logDebug('writeSearchResultsToNote', `written resultSet for '${searchTermsRepStr}' to the note ${noteFilename} (${displayTitle(outputNote)})`)
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
 * Create nicely-formatted lines to display 'resultSet', using settings from 'config'
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
    // Add each result line to output array
    let lastFilename: string
    let nc = 0
    for (const rnal of resultSet.resultNoteAndLineArr) {
      if (config.groupResultsByNote) {
        // Write each line without transformation, grouped by Note, with Note headings inserted accordingly
        let thisFilename = rnal.noteFilename
        if (thisFilename !== lastFilename && thisFilename !== '') {
          // though only insert heading if noteFilename isn't blank
          resultOutputLines.push(`${headingMarker} ${getNoteTitleFromFilename(rnal.noteFilename, true)}`)
          nc++
        }
        const outputLine = trimAndHighlightTermInLine(rnal.line, mayOrMustTerms, simplifyLine, config.highlightResults, config.resultPrefix, config.resultQuoteLength)
        resultOutputLines.push(outputLine)
        lastFilename = thisFilename
      } else {
        // FIXME: suffixes causing sync line problems.
        // - do I need to remove this non-grouped option entirely?

        // Write the line, first transforming it to add context on the end, and make other changes according to what the user has configured
        const outputLine = trimAndHighlightTermInLine(rnal.line, mayOrMustTerms, simplifyLine, config.highlightResults, config.resultPrefix, config.resultQuoteLength) + getNoteContextAsSuffix(rnal.noteFilename, config.dateStyle)
        resultOutputLines.push(outputLine)
      }
    }
    return resultOutputLines
  }
  catch (err) {
    logError('createFormattedResultLines', err.message)
    clo(resultSet)
    return [] // for completeness
  }
}
