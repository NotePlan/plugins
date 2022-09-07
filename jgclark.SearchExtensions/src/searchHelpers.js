// @flow
//-----------------------------------------------------------------------------
// Search Extensions helpers
// Jonathan Clark
// Last updated 5.8.2022 for v0.5.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { formatNoteDate, nowLocaleDateTime, toISOShortDateTimeString } from '@helpers/dateTime'
import { clo, logDebug, logError, logWarn, timer } from '@helpers/dev'
import { displayTitle, type headingLevelType, titleAsLink } from '@helpers/general'
import { getNoteContextAsSuffix, getNoteTitleFromFilename, getOrMakeNote, getProjectNotesInFolder } from '@helpers/note'
import { isTermInMarkdownPath, isTermInURL } from '@helpers/paragraph'
import { trimAndHighlightTermInLine } from '@helpers/search'
import { sortListBy } from '@helpers/sorting'
import { showMessage } from '@helpers/userInput'

export type noteAndLine = {
  noteFilename: string,
  line: string
}

// export type noteAndLines = {
//   noteFilename: string,
//   lines: Array<string>
// }

// export type resultObjectType = {
//   searchTerm: string,
//   resultLines: noteAndLines,
//   resultCount: number,
// }

export type typedSearchTerm = {
  term: string, // (e.g. 'fixed')
  type: 'must' | 'may' | 'not-line' | 'not-note',  // (e.g. 'not-line')
  termRep: string // short for termRepresentation (e.g. '-fixed')
}

// export type resultObjectTypeV2 = {
//   searchTerm: typedSearchTerm,
//   resultNoteAndLinesArr: Array<noteAndLines>,
//   resultCount: number,
// }

export type resultObjectTypeV3 = {
  searchTerm: typedSearchTerm,
  resultNoteAndLineArr: Array<noteAndLine>,
  resultCount: number,
}

// export type resultOutputType = {
//   searchTermsRep: string,
//   resultNoteAndLinesArr: Array<noteAndLines>,
//   resultCount: number,
// }

// export type resultOutputTypeV2 = {
//   searchTermsRepArr: Array<string>,
//   resultNoteAndLinesArr: Array<noteAndLines>,
//   resultCount: number,
// }

export type resultOutputTypeV3 = {
  searchTermsRepArr: Array<string>,
  resultNoteAndLineArr: Array<noteAndLine>,
  resultCount: number,
  resultNoteCount: number,
}

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
* Quoted multi-word search terms (e.g. ["Bob Smith"]) are by default treated as [+Bob +Smith] as I now discover the API doesn't support quoted multi-word search phrases (from beta7).
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
  logDebug("normaliseSearchTerms()", `starting for [${searchArg}] with modifyQuotedTermsToAndedTerms ${String(modifyQuotedTermsToAndedTerms)}`)
  let outputArray = []
  // Take a simple string and process it to turn into an array of string, according to one of several schemes:
  if (!searchArg.match(/\w{3,}/)) {
    // this has no words (at least 3 long) -> empty
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
    // Features of this regex:
    // - Deal with double or single - quoted phrases plus words not in quotes
    // - and prefixed search operators !/+/-
    // - and #hashtag/child and @mention(5) possibilities
    const RE_WOW = new RegExp(/\s([\-\+\!]?)([\-\+\!]?)(?:([\'"])(.+?)\3)|([\-\+\!]?[\w\-#@\/\(\)]+)/g)
    // add space to front and end to make the regex more manageable
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
export function validateAndTypeSearchTerms(searchArg: string): Array<typedSearchTerm> {

  const normalisedTerms = normaliseSearchTerms(searchArg)
  if (normalisedTerms.length === 0) {
    logError(pluginJson, `No search terms submitted. Stopping.`)
    return []
  }

  // Now validate the terms, weeding out short ones, and typing the rest
  const validatedTerms: Array<typedSearchTerm> = []
  for (const u of normalisedTerms) {
    let t = u.trim()
    if (t.length >= 3) {
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
      logWarn(pluginJson, `Note: search term '${t}' was removed because it is less than 3 characters long`)
    }
  }

  // Now check we have a valid set of terms. (If they're not valid, return an empty array.)
  // Invalid if we don't have any must-have or may-have search terms
  if (validatedTerms.filter((t) => (t.type === 'may' || t.type === 'must')).length === 0) {
    logWarn(pluginJson, 'no positive match search terms given; stopping.')
    return []
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
  const modA = arrA.map((m) => m.noteFilename + ':::' + m.line)
  const modB = arrB.map((m) => m.noteFilename + ':::' + m.line)
  const intersectionModArr = modA.filter(f => modB.includes(f))
  const intersectionArr: Array<noteAndLine> = intersectionModArr.map((m) => {
    let firstPart = (m.split(':::', 1))[0]
    return { noteFilename: firstPart, line: m.slice(firstPart.length + 3) }
  })
  return intersectionArr
}

/**
 * Compute difference of two arrays, by a given property value
 * from https://stackoverflow.com/a/68151533/3238281 example 2
 * @param {Array<noteAndLines>} arr The initial array
 * @param {Array<noteAndLines>} exclude The array to remove
 * @param {string} propertyName the key of the object to match on
 * @return {Array<noteAndLines>}
 * @tests in jest file
 */
// export function excludeFromArr(arr: $ReadOnlyArray<noteAndLines>, exclude: $ReadOnlyArray<noteAndLines>, propertyName: string): Array<noteAndLines> {
//   return arr.filter((o1) => !exclude.some((o2) => o1[propertyName] === o2[propertyName]))
// }

// export function differenceByInnerArrayLine(arr: $ReadOnlyArray<noteAndLines>, exclude: $ReadOnlyArray<noteAndLines>): Array<noteAndLines> {
//   // return arr.filter((o1) => !exclude.some((o2) => o1[propertyName] === o2[propertyName]))
//   if (exclude.length === 0) {
//     return arr.slice() // null transform if no exclude terms
//   }
//   if (arr.length === 0) {
//     return [] // empty return if no arr input terms
//   }

//   // turn arrays into simpler data structures, so I can more easily think about them!
//   // (using the hack of concatenating with ':::' separator)
//   const flatterArr: Array<string> = []
//   for (const a of arr) {
//     for (const b of a.lines) {
//       flatterArr.push(`${a.noteFilename}:::${b}`)
//     }
//   }
//   const flatterExclude: Array<string> = []
//   for (const a of exclude) {
//     for (const b of a.lines) {
//       flatterExclude.push(`${a.noteFilename}:::${b}`)
//     }
//   }

//   // Now find non-matches
//   const flatDifference: Array<string> = flatterArr.filter((a) => !flatterExclude.includes(a))
//   // clo(flatDifference, 'flatDifference: ')

//   // Now un-flatten again
//   const diff: Array<noteAndLines> = []
//   let linesAccumulator: Array<string> = []
//   let lastFilename = ''
//   let thisFilename = ''
//   let thisLine = ''
//   for (const d of flatDifference) {
//     const parts = d.split(':::')
//     thisFilename = parts[0]
//     thisLine = parts[1]
//     // console.log(`${thisFilename} / ${thisLine}`)
//     if (lastFilename === '' || thisFilename === lastFilename) {
//       linesAccumulator.push(thisLine)
//     } else {
//       diff.push({ noteFilename: lastFilename, lines: linesAccumulator })
//       // console.log(`- pushed { noteFilename: '${lastFilename}', lines: ${String(linesAccumulator)} }`)
//       linesAccumulator = []
//       linesAccumulator.push(thisLine)
//     }
//     lastFilename = thisFilename
//   }
//   diff.push({ noteFilename: lastFilename, lines: linesAccumulator }) // make sure we add the last items
//   return diff
// }

/**
 * Work out what subset of results to return, using the must/may/not terms
 * @param {Array<resultObjectTypeV3>}
 * @returns {resultOutputTypeV3}
 * @tests in jest file
 */
export function applySearchOperators(termsResults: Array<resultObjectTypeV3>): resultOutputTypeV3 {
  // const searchTermsRep = getSearchTermsRep(termsResults.map((t) => t.searchTerm))
  const mustResultObjects: Array<resultObjectTypeV3> = termsResults.filter((t) => t.searchTerm.type === 'must')
  const mayResultObjects: Array<resultObjectTypeV3> = termsResults.filter((t) => t.searchTerm.type === 'may')
  const notResultObjects: Array<resultObjectTypeV3> = termsResults.filter((t) => t.searchTerm.type.startsWith('not'))
  logDebug('applySearchOperators', `Starting with [${getSearchTermsRep(termsResults.map(m => m.searchTerm))}]: ${mustResultObjects.length} must terms; ${mayResultObjects.length} may terms; ${notResultObjects.length} not terms.`)

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

  // Form the output data structure
  const consolidatedResultsObject: resultOutputTypeV3 = {
    searchTermsRepArr: termsResults.map((m) => m.searchTerm.termRep),
    resultNoteAndLineArr: consolidatedNALs,
    resultCount: consolidatedLineCount,
    resultNoteCount: consolidatedNoteCount,
  }
  clo(consolidatedResultsObject, 'End of applySearchOperators: consolidatedResultsObject output: ')
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
  const simplifiedArray = inArray.map((m) => m.noteFilename + ':::' + m.line)
  // const sortedArray = simplifiedArray.sort()
  const reducedArray = [... new Set(simplifiedArray)]
  const outputArray: Array<noteAndLine> = reducedArray.map((m) => {
    let parts = m.split(':::')
    return { noteFilename: parts[0], line: parts[1] }
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
 * @param {Array<string>?} paraTypesToInclude optional list of paragraph types to include (e.g. 'open'). If not given, then no paragraph types will be excluded.
 * @returns {resultOutputTypeV2} results optimised for output
 */
export async function runSearchesV2(
  termsToMatchArr: Array<typedSearchTerm>,
  noteTypesToInclude: Array<string>,
  foldersToInclude: Array<string>,
  foldersToExclude: Array<string>,
  config: SearchConfig,
  paraTypesToInclude?: Array<string> = [], // TODO: ideally Array<ParagraphType> instead
): Promise<resultOutputTypeV3> {
  try {
    const termsResults: Array<resultObjectTypeV3> = []
    let resultCount = 0
    const outerStartTime = new Date()
    logDebug('runSearchesV2', `Starting with ${termsToMatchArr.length} search terms (and ${paraTypesToInclude.length} paraTypes)`)

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

    logDebug('runSearchesV2', `= Total Search (API): ${timer(outerStartTime)} for ${termsToMatchArr.length} searches -> ${resultCount} results`)

    //------------------------------------------------------------------
    // Work out what subset of results to return, taking into the must/may/not terms
    // clo(termsResults, 'before applySearchOperators, termsResults =')
    const consolidatedResultSet: resultOutputTypeV3 = applySearchOperators(termsResults)
    // clo(consolidatedResultSet, 'after applySearchOperators, consolidatedResultSet =')
    return consolidatedResultSet
  }
  catch (err) {
    logError('runSearchesV2', err.message)
    // $FlowFixMe[incompatible-return]
    return [] // for completeness
  }
}

/**
 * Run a search for 'searchTerm' over the set of notes determined by the parameters.
 * Returns a special resultObjectTypeV2 data structure: {
 *   searchTerm: typedSearchTerm
 *   resultNotesAndLines: Array<noteAndLines>  -- note: array
 *   resultCount: number
 * }
 * Has an optional 'paraTypesToInclude' parameter of paragraph type(s) to include (e.g. ['open'] to include only open tasks). If not given, then no paragraph types will be excluded.
 * @author @jgclark
 * @param {Array<string>} typedSearchTerm object containing term and type
 * @param {Array<string>} noteTypesToInclude (['notes'] or ['calendar'] or both)
 * @param {Array<string>} foldersToInclude (can be empty list)
 * @param {Array<string>} foldersToExclude (can be empty list)
 * @param {SearchConfig} config object for various settings
 * @param {Array<string>?} paraTypesToInclude optional list of paragraph types to include (e.g. 'open'). If not given, then no paragraph types will be excluded.
 * @returns {resultOutputType} combined result set optimised for output
 */
export async function runSearchV2(
  typedSearchTerm: typedSearchTerm,
  noteTypesToInclude: Array<string>,
  foldersToInclude: Array<string>,
  foldersToExclude: Array<string>,
  config: SearchConfig,
  paraTypesToInclude?: Array<string> = [], // TODO: ideally Array<ParagraphType> instead
): Promise<resultObjectTypeV3> {
  try {
    const headingMarker = '#'.repeat(config.headingLevel)
    const searchTerm = typedSearchTerm.term
    logDebug('runSearchV2', `Starting for [${searchTerm}]`)

    // get list of matching paragraphs for this string
    CommandBar.showLoading(true, `Running search for ${typedSearchTerm.termRep} ...`)
    const resultParas = await DataStore.search(searchTerm, noteTypesToInclude, foldersToInclude, foldersToExclude)
    CommandBar.showLoading(false)

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
      if (paraTypesToInclude.length > 0) {
        filteredParas = resultFieldSets.filter((p) => paraTypesToInclude.includes(p.type))
        logDebug('runSearchV2', `  - after types filter (to ${String(paraTypesToInclude)}), ${filteredParas.length} results`)
      } else {
        filteredParas = resultFieldSets
        logDebug('runSearchV2', `  - no type filtering requested`)
      }

      // Drop out search results found only in a URL or the path of a [!][link](path)
      resultFieldSets = filteredParas.filter((f) => !isTermInURL(searchTerm, f.content)).filter((f) => !isTermInMarkdownPath(searchTerm, f.content))
      logDebug('runSearchV2', `  - after URL filter, ${resultFieldSets.length} results`)
      // TODO: this is failing to drop [callback] in a noteplan://x-callback-url/... in my note 2022-07-20, but I can't see why.

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
          line: sortedFieldSets[i].rawContent
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

/**
 * Get string representation of multiple search terms
 * @param {typedSearchTerm[]} searchTerms 
 * @returns {string}
 */
function getSearchTermsRep(typedSearchTerms: Array<typedSearchTerm>): string {
  return typedSearchTerms.map((t) => t.termRep).join(' ')
}

/**
 * Write results set(s) out to a note, reusing note (but not the contents) where it already exists.
 * The data is in the first parameter; the rest are various settings.
 * @author @jgclark
 * 
 * @param {resultOutputTypeV3} resultSet object
 * @param {string} requestedTitle requested note title to use/make
 * @param {string} titleToMatch partial title to match against existing note titles
 * @param {SearchConfig} config
 * @param {string?} xCallbackURL
 * @returns {string} filename of note we've written to
 */
export async function writeSearchResultsToNote(
  resultSet: resultOutputTypeV3,
  requestedTitle: string,
  titleToMatch: string,
  config: SearchConfig,
  xCallbackURL: string = '',
): Promise<string> {
  try {
    logDebug('writeSearchResultsToNote', `Starting ...`)
    let outputNote: ?TNote
    let noteFilename = ''
    const headingMarker = '#'.repeat(config.headingLevel)
    const searchTermsRepStr = resultSet.searchTermsRepArr.join(' ')
    const xCallbackLine = (xCallbackURL !== '') ? ` [🔄 Click to refresh results for '${searchTermsRepStr}'](${xCallbackURL})` : ''

    // Get array of 'may' or 'must' search terms
    const mayOrMustTerms = resultSet.searchTermsRepArr.filter((f) => f[0] !== '-')

    // Add each result line to output array
    let fullNoteContent = `# ${requestedTitle}\nat ${nowLocaleDateTime}${xCallbackLine}`
    // First check if we have any results
    if (resultSet.resultCount > 0) {
      const resultOutputLines: Array<string> = createFormattedResultLines(resultSet, config)
      fullNoteContent += `\n${headingMarker} ${searchTermsRepStr} (${resultSet.resultCount} results from ${resultSet.resultNoteCount} notes)\n${resultOutputLines.join('\n')}`
    } else {
      fullNoteContent += `\n${headingMarker} ${searchTermsRepStr}\n(no matches)`
    }

    // Newer method, doing a partial title match, if that is supplied, or requestedTitle if not.
    outputNote = await getOrMakeNote(requestedTitle, config.folderToStore, titleToMatch)
    if (outputNote) {
      // write to the existing note (the first matching if more than one)
      outputNote.content = fullNoteContent
      noteFilename = outputNote.filename
    }
    else {
      throw new Error(`Couldn't find or make note for ${requestedTitle}. Stopping.`)
    }
    logDebug('writeSearchResultsToNote', `written resultSet for '${searchTermsRepStr}' to the note '${displayTitle(outputNote)}'`)
    return noteFilename
  }
  catch (err) {
    logError('writeSearchResultsToNote', err.message)
    return 'error' // for completeness
  }
}

/**
 * Create nicely-formatted lines to display resultSet
 * There's a special case; if no results are found, then the resultSet will have an empty filename. If so, don't try to display the filename
 * @param {resultOutputTypeV2} resultSet 
 * @param {SearchConfig} config 
 * @returns {Array<string>} formatted search reuslts
 */
export function createFormattedResultLines(resultSet: resultOutputTypeV3, config: SearchConfig): Array<string> {
  try {
    const resultOutputLines: Array<string> = []
    const headingMarker = '#'.repeat(config.headingLevel)
    const simplifyLine = (config.resultStyle === 'Simplified')

    // Get array of 'may' or 'must' search terms ready to display highlights
    const mayOrMustTermsRep = resultSet.searchTermsRepArr.filter((f) => f[0] !== '-')
    // Take off leading + or ! if necessary
    const mayOrMustTerms = mayOrMustTermsRep.map((f) => (f.match(/^[\+\!]/)) ? f.slice(1) : f)
    // Add each result line to output array
    let lastFilename = undefined
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
        // Write the line, first transforming it to add context on the end, and make other changes according to what the user has configured
        const outputLine = trimAndHighlightTermInLine(rnal.line, mayOrMustTerms, simplifyLine, config.highlightResults, config.resultPrefix, config.resultQuoteLength) + getNoteContextAsSuffix(rnal.noteFilename, config.dateStyle)
        resultOutputLines.push(outputLine)
      }
    }
    return resultOutputLines
  }
  catch (err) {
    logError('createFormattedResultLines', err.message)
    return [] // for completeness
  }
}
