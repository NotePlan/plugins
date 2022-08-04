// @flow
//-----------------------------------------------------------------------------
// Search Extensions helpers
// Jonathan Clark
// Last updated 2.8.2022 for v0.5.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { formatNoteDate, nowLocaleDateTime, toISOShortDateTimeString } from '@helpers/dateTime'
import { clo, logDebug, logError, logWarn, timer } from '@helpers/dev'
import { displayTitle, type headingLevelType, titleAsLink } from '@helpers/general'
import { getNoteContextAsSuffix, getNoteTitleFromFilename } from '@helpers/note'
import { isTermInMarkdownPath, isTermInURL } from '@helpers/paragraph'
import { trimAndHighlightTermInLine } from '@helpers/search'
import { sortListBy } from '@helpers/sorting'
import { showMessage } from '@helpers/userInput'

export type noteAndLines = {
  noteFilename: string,
  lines: Array<string>
}

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

export type resultObjectTypeV2 = {
  searchTerm: typedSearchTerm,
  resultNoteAndLinesArr: Array<noteAndLines>,
  resultCount: number,
}

// export type resultOutputType = {
//   searchTermsRep: string,
//   resultNoteAndLinesArr: Array<noteAndLines>,
//   resultCount: number,
// }

export type resultOutputTypeV2 = {
  searchTermsRepArr: Array<string>,
  resultNoteAndLinesArr: Array<noteAndLines>,
  resultCount: number,
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
  showEmptyResults: boolean,
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
* @author @jgclark
* @param {string | Array<string>} searchArg string containing search term(s) or array of search terms
* @returns {Array<string>} normalised search term(s)
* @tests in jest file
*/
export function normaliseSearchTerms(searchArg: string): Array<string> {
  logDebug("normaliseSearchTerms()", `starting for [${searchArg}]`)
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

  if (searchArg.match(/\w{3,}\s*,\s*\w{3,}/)) {
    // this is of form 'x,y,z'
    outputArray = searchArg.split(/\s*,\s*/)
  }

  else if (searchArg.match(/\sAND\s/) && !searchArg.match(/\sOR\s/)) {
    // this is of form 'x AND y ...' (but not OR)
    outputArray = searchArg.split(/\sAND\s/).map((s) => `+${s}`)
  }

  else if (searchArg.match(/\sOR\s/) && !searchArg.match(/\sAND\s/)) {
    // this is of form 'x OR y ...' (but not AND)
    outputArray = searchArg.split(/\sOR\s/)
  }

  else {
    // else treat as 'x y z', with or without quoted phrases.
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
        outputArray.push(`${r[1] ?? ''}${r[4] ?? ''}${r[5] ?? ''}`)
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
    // TODO: tell user
    logError(pluginJson, `No search terms submitted. Stopping.`)
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

  // Now check we have a valid set of terms.
  // If they're not valid, return an empty array.
  if (validatedTerms.length < normalisedTerms.length) {
    logWarn(pluginJson, 'Some search terms were removed as they were less than 3 characters long.')
  }
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

export function differenceByInnerArrayLine(arr: $ReadOnlyArray<noteAndLines>, exclude: $ReadOnlyArray<noteAndLines>): Array<noteAndLines> {
  // return arr.filter((o1) => !exclude.some((o2) => o1[propertyName] === o2[propertyName]))
  if (exclude.length === 0) {
    return arr.slice() // null transform if no exclude terms
  }
  if (arr.length === 0) {
    return [] // empty return if no arr input terms
  }

  // turn arr into a simpler data structure, so I can more easily think about it!
  const flatterArr: Array<string> = []
  for (const a of arr) {
    for (const b of a.lines) {
      flatterArr.push(`${a.noteFilename}:::${b}`)
    }
  }
  // turn arr into a simpler data structure, so I can more easily think about it!
  const flatterExclude: Array<string> = []
  for (const a of exclude) {
    for (const b of a.lines) {
      flatterExclude.push(`${a.noteFilename}:::${b}`)
    }
  }

  // Now find non-matches
  const flatDifference: Array<string> = flatterArr.filter((a) => !flatterExclude.includes(a))
  // clo(flatDifference, 'flatDifference: ')

  // Now un-flatten again
  const diff: Array<noteAndLines> = []
  let linesAccumulator: Array<string> = []
  let lastFilename = ''
  let thisFilename = ''
  let thisLine = ''
  for (const d of flatDifference) {
    const parts = d.split(':::')
    thisFilename = parts[0]
    thisLine = parts[1]
    // console.log(`${thisFilename} / ${thisLine}`)
    if (lastFilename === '' || thisFilename === lastFilename) {
      linesAccumulator.push(thisLine)
    } else {
      diff.push({ noteFilename: lastFilename, lines: linesAccumulator })
      // console.log(`- pushed { noteFilename: '${lastFilename}', lines: ${String(linesAccumulator)} }`)
      linesAccumulator = []
      linesAccumulator.push(thisLine)
    }
    lastFilename = thisFilename
  }
  diff.push({ noteFilename: lastFilename, lines: linesAccumulator }) // make sure we add the last items
  return diff
}

/**
 * Work out what subset of results to return, using the must/may/not terms
 * @param {Array<resultObjectTypeV2>}
 * @param {boolean}
 * @return {resultOutputTypeV2}
 * @tests in jest file
 */
export function applySearchOperators(termsResults: Array<resultObjectTypeV2>): resultOutputTypeV2 {
  // const searchTermsRep = getSearchTermsRep(termsResults.map((t) => t.searchTerm))
  const mustResultObjects: Array<resultObjectTypeV2> = termsResults.filter((t) => t.searchTerm.type === 'must')
  const mayResultObjects: Array<resultObjectTypeV2> = termsResults.filter((t) => t.searchTerm.type === 'may')
  const notResultObjects: Array<resultObjectTypeV2> = termsResults.filter((t) => t.searchTerm.type.startsWith('not'))
  logDebug('applySearchOperators', `Starting with ${mustResultObjects.length} must terms; ${mayResultObjects.length} may terms; ${notResultObjects.length} not terms.`)

  // clo(termsResults, 'resultObjectV2: ')
  let consolidatedNotesAndLines: Array<noteAndLines> = []

  // Write any 'must' search results to consolidated set
  let consolidatedNoteCount = 0
  let consolidatedLinesCount = 0
  let i = 0
  for (const r of mustResultObjects) {
    let j = 0
    const tempArr: Array<noteAndLines> = consolidatedNotesAndLines

    for (const rnal of r.resultNoteAndLinesArr) {  // flow complains on forEach version as well
      // clo(rnal, 'must[${i}] / rnal: `)
      logDebug('applySearchOperators', `- must: '${rnal.noteFilename}' with ${rnal.lines.length} matching paras`)

      // Just add these 'must' results to the consolidated set
      tempArr.push(rnal)
      j++
      consolidatedLinesCount += rnal.lines.length
      consolidatedNoteCount++
    }
    if (j === 0) {
      logDebug('applySearchOperators', `- must: No results found for must-find search terms.`)
    } else {
      consolidatedNotesAndLines.concat(tempArr)
    }
    i++
  }
  logDebug('applySearchOperators', `Must: at end, ${consolidatedLinesCount} results from ${consolidatedNoteCount} notes`)

  // Check if we can add the 'may' search results to consolidated set
  i = 0
  for (const r of mayResultObjects) {
    const tempArr: Array<noteAndLines> = consolidatedNotesAndLines
    let j = 0
    // Add this result if 0 must terms, or it matches 1+ must results
    if (mustResultObjects.length === 0) {
      logDebug('applySearchOperators', `- may: as 0 must terms, we can add all for ${r.searchTerm.term}`)
      for (const rnal of r.resultNoteAndLinesArr) {
        logDebug('applySearchOperators', `- may: + '${rnal.noteFilename}' with ${rnal.lines.length} matching paras`)
        tempArr.push(rnal)
        j++
        consolidatedLinesCount += rnal.lines.length
        consolidatedNoteCount++
      }
    } else {
      logDebug('applySearchOperators', `- may: there are 'must' terms, so will check before adding 'may' results`)
      // $FlowFixMe[prop-missing]
      for (const rnal of r.resultNoteAndLinesArr) {
        if (true) { // TODO: work out logic here
          logDebug('applySearchOperators', `- may: + '${rnal.noteFilename}' with ${rnal.lines.length} matching paras`)
          tempArr.push(rnal)
          j++
          consolidatedLinesCount += rnal.lines.length
          consolidatedNoteCount++
        }
      }
    }
    if (j === 0) {
      logDebug('applySearchOperators', `- may: No results found.`)
    } else {
      consolidatedNotesAndLines.concat(tempArr)
    }
    i++
  }
  logDebug('applySearchOperators', `May: at end, ${consolidatedLinesCount} results from ${consolidatedNoteCount} notes`)

  // Delete any results from the consolidated set that match 'not-...' terms
  i = 0
  let c = 0
  for (const r of notResultObjects) {
    let searchTermStr = r.searchTerm.termRep
    let tempArr: Array<noteAndLines> = consolidatedNotesAndLines
    // Get number of results kept so far
    let lastResultNotesCount = tempArr.length
    let lastResultLinesCount = tempArr.map((t) => t.lines.length).reduce((prev, next) => prev + next)
    logDebug('applySearchOperators', `- for not term [${searchTermStr}], lastResultLinesCount = ${lastResultLinesCount}`)

    // Remove 'not' results from the previously-kept results
    // clo(r.resultNoteAndLinesArr, '- not r.resultNoteAndLinesArr: ')
    let reducedArr: Array<noteAndLines> = []
    if (r.searchTerm.type === 'not-line') {
      reducedArr = differenceByInnerArrayLine(tempArr, r.resultNoteAndLinesArr)
    }
    else if (r.searchTerm.type === 'not-note') {
      reducedArr = differenceByPropVal(tempArr, r.resultNoteAndLinesArr, 'noteFilename')
    }
    let removedNotes = lastResultNotesCount - reducedArr.length
    let removedLines = lastResultLinesCount - reducedArr.map((t) => t.lines.length).reduce((prev, next) => prev + next)
    consolidatedNoteCount -= removedNotes
    consolidatedLinesCount -= removedLines
    logDebug('applySearchOperators', `- not: removed ${String(removedNotes)} result notes and ${String(removedLines)} result lines that match 'not' term #${i} (${searchTermStr})`)
    // clo(reducedArr, 'reducedArr: ')

    // ready for next iteration
    consolidatedNotesAndLines = reducedArr
    lastResultNotesCount = consolidatedNoteCount
    lastResultLinesCount = consolidatedLinesCount
    i++
  }
  logDebug('applySearchOperators', `Not: at end, ${consolidatedLinesCount} from ${consolidatedNoteCount} notes`)

  // reduce consolidatedNotesAndLines to just the lines
  // let justTheLines: Array<string> = []
  // for (let c of consolidatedNotesAndLines) {
  //   justTheLines = justTheLines.concat(c.lines)
  // }
  const consolidatedResultsObject: resultOutputTypeV2 = {
    // searchTermsRep: searchTermsRep,
    searchTermsRepArr: termsResults.map((t) => t.searchTerm.termRep),
    // resultLines: justTheLines,
    resultNoteAndLinesArr: consolidatedNotesAndLines,
    resultCount: consolidatedNotesAndLines.length,
  }
  clo(consolidatedResultsObject, 'at end of applySearchOperators: consolidatedResultsObject output: ')
  return consolidatedResultsObject
}


/**
 * Run a search over all search terms in 'termsToMatchArr' over the set of notes determined by the parameters.
 * V2 of this function
 * Has an optional 'typesToInclude' parameter of paragraph type(s) to include (e.g. ['open'] to include only open tasks). If not given, then no paragraph types will be excluded.
 * 
 * @param {Array<string>} termsToMatchArr
 * @param {Array<string>} noteTypesToInclude (['notes'] or ['calendar'] or both)
 * @param {Array<string>} foldersToInclude (can be empty list)
 * @param {Array<string>} foldersToExclude (can be empty list)
 * @param {SearchConfig} config object for various settings
 * @param {Array<ParagraphType>?} typesToInclude optional list of paragraph types to include (e.g. 'open'). If not given, then no paragraph types will be excluded.
 * @returns {resultOutputTypeV2} results optimised for output
 */
export async function runSearchesV2(
  termsToMatchArr: Array<typedSearchTerm>,
  noteTypesToInclude: Array<string>,
  foldersToInclude: Array<string>,
  foldersToExclude: Array<string>,
  config: SearchConfig,
  typesToInclude?: Array<ParagraphType> = [],
): Promise<resultOutputTypeV2> {
  try {
    const termsResults: Array<resultObjectTypeV2> = []
    let resultCount = 0
    const outerStartTime = new Date()
    logDebug('runSearchesV2', `Starting with ${termsToMatchArr.length} search terms`)

    //------------------------------------------------------------------
    // Get results for each search term independently and save
    for (const typedSearchTerm of termsToMatchArr) {
      logDebug('runSearchesV2', `- searching for term [${typedSearchTerm.termRep}] ...`)
      const innerStartTime = new Date()

      // do search for this search term, using configured options
      const resultObject: resultObjectTypeV2 = await runSearchV2(typedSearchTerm, noteTypesToInclude, foldersToInclude, foldersToExclude, config, typesToInclude)

      // Save this search term and results as a new object in results array
      termsResults.push(resultObject)
      resultCount += resultObject.resultCount
      logDebug('runSearchesV2', `- search (API): ${timer(innerStartTime)} for '${typedSearchTerm.termRep}' -> ${resultObject.resultCount} results`)
    }

    logDebug('runSearchesV2', `= Total Search (API): ${timer(outerStartTime)} for ${termsToMatchArr.length} searches -> ${resultCount} results`)

    //------------------------------------------------------------------
    // Work out what subset of results to return, taking into the must/may/not terms
    // clo(termsResults, 'before applySearchOperators, termsResults =')
    const consolidatedResultSet: resultOutputTypeV2 = applySearchOperators(termsResults)
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
 * Has an optional 'typesToInclude' parameter of paragraph type(s) to include (e.g. ['open'] to include only open tasks). If not given, then no paragraph types will be excluded.
 * @author @jgclark
 * @param {Array<string>} typedSearchTerm object containing term and type
 * @param {Array<string>} noteTypesToInclude (['notes'] or ['calendar'] or both)
 * @param {Array<string>} foldersToInclude (can be empty list)
 * @param {Array<string>} foldersToExclude (can be empty list)
 * @param {SearchConfig} config object for various settings
 * @param {Array<ParagraphType>} typesToInclude optional list of paragraph types to include (e.g. 'open'). If not given, then no paragraph types will be excluded.
 * @returns {resultOutputType} combined result set optimised for output
 */
export async function runSearchV2(
  typedSearchTerm: typedSearchTerm,
  noteTypesToInclude: Array<string>,
  foldersToInclude: Array<string>,
  foldersToExclude: Array<string>,
  config: SearchConfig,
  typesToInclude?: Array<ParagraphType> = [],
): Promise<resultObjectTypeV2> {
  try {
    const headingMarker = '#'.repeat(config.headingLevel)
    const searchTerm = typedSearchTerm.term
    logDebug('runSearchV2', `runSearchV2() starting for [${searchTerm}]`)

    // get list of matching paragraphs for this string
    CommandBar.showLoading(true, `Running search for ${typedSearchTerm.termRep} ...`)
    const resultParas = await DataStore.search(searchTerm, noteTypesToInclude, foldersToInclude, foldersToExclude)
    CommandBar.showLoading(false)

    const noteAndLinesArr = []
    let resultCount = 0

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
      if (typesToInclude.length > 0) {
        filteredParas = resultFieldSets.filter((p) => typesToInclude.includes(p.type))
        logDebug('runSearchV2', `  - after types filter (to ${String(typesToInclude)}), ${filteredParas.length} results`)
      } else {
        filteredParas = resultFieldSets
        logDebug('runSearchV2', `  - no type filtering requested`)
      }

      // Drop out search results found in a URL or the path of a [!][link](path)
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
      // logDebug('runSearchV2', `- ${String(sortedFieldSets.length)} sortedFieldSets after sort`)

      // Form the return object from sortedFieldSets
      let previousMatchFilename = sortedFieldSets[0].filename
      let tempLineArr = []
      // FIXME: something wrong here?
      for (let i = 0; i < sortedFieldSets.length; i++) {
        const thisObj = sortedFieldSets[i]
        let thisMatchFilename = thisObj.filename
        let thisMatchLine = thisObj.rawContent

        // If this is a new note, then write the previous note's details to output array
        if (thisMatchFilename !== previousMatchFilename) {
          noteAndLinesArr.push({
            noteFilename: previousMatchFilename,
            lines: tempLineArr
          })
          tempLineArr = [] // reset this for next time
        }
        // Add to the output data structure
        tempLineArr.push(thisMatchLine)

        previousMatchFilename = thisMatchFilename
        resultCount += 1
      }
      // deal with edge case of all results from single file, which won't have got written out
      if (noteAndLinesArr.length === 0) {
        noteAndLinesArr.push({
          noteFilename: previousMatchFilename,
          lines: tempLineArr
        })
      }
    } else if (config.showEmptyResults) {
      // If there's nothing to report, make that clear
      noteAndLinesArr.push({ noteFilename: '', lines: ['(no matches)'] })
    }
    logDebug('runSearchV2', `- end of runSearchV2 for [${searchTerm}]: ${resultCount} results from ${noteAndLinesArr.length.toString()} notes`)

    const returnObject: resultObjectTypeV2 = {
      searchTerm: typedSearchTerm,
      resultNoteAndLinesArr: noteAndLinesArr,
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
 * @param {resultOutputTypeV2} resultSet object
 * @param {string} requestedTitle
 * @param {string} folderToStore
 * @param {number} headingLevel
 * @param {boolean} groupResultsByNote
 * @param {boolean} calledIndirectly
 * @param {string?} xCallbackURL
 * @returns {string} filename of note we've written to
 */
export async function writeSearchResultsToNote(
  resultSet: resultOutputTypeV2,
  requestedTitle: string,
  config: SearchConfig,
  xCallbackURL: string = '',
): Promise<string> {
  try {
    logDebug('writeSearchResultsToNote', `Starting ...`)
    let outputNote: ?TNote
    let noteFilename = ''
    const headingMarker = '#'.repeat(config.headingLevel)
    // FIXME: sometimes undefined
    const searchTermsRepStr = resultSet.searchTermsRepArr.join(' ')
    const xCallbackLine = (xCallbackURL !== '') ? ` [🔄 Click to refresh results for '${searchTermsRepStr}'](${xCallbackURL})` : ''

    // Get array of 'may' or 'must' search terms
    const mayOrMustTerms = resultSet.searchTermsRepArr.filter((f) => f[0] !== '-')

    // Add each result line to output array
    const resultOutputLines: Array<string> = createFormattedResultLines(resultSet, config)
    let fullNoteContent = `# ${requestedTitle}\nat ${nowLocaleDateTime}${xCallbackLine}`

    // TODO: get count of lines too
    fullNoteContent += `\n${headingMarker} ${searchTermsRepStr} (results from ${resultSet.resultCount} notes)\n${resultOutputLines.join('\n')}`

    // See if this note has already been created
    // (look only in active notes, not Archive or Trash)
    const existingNotes: $ReadOnlyArray<TNote> = DataStore.projectNoteByTitle(requestedTitle, true, false) ?? []
    logDebug('writeSearchResultsToNote', `- found ${existingNotes.length} existing search result note(s) titled ${requestedTitle}`)

    if (existingNotes.length > 0) {
      // write to the existing note (the first matching if more than one)
      outputNote = existingNotes[0]
      outputNote.content = fullNoteContent
      noteFilename = outputNote.filename
    } else {
      // make a new note for this. NB: filename here = folder + filename
      noteFilename = DataStore.newNoteWithContent(fullNoteContent, config.folderToStore, requestedTitle)
      if (!noteFilename) {
        logError('writeSearchResultsToNote', `Error creating new search note with requestedTitle '${requestedTitle}'`)
        await showMessage('There was an error creating the new search note')
        return '' // for completeness
      }
      outputNote = DataStore.projectNoteByFilename(noteFilename)
      logDebug('writeSearchResultsToNote', `Created new search note with filename: ${noteFilename}`)
    }
    logDebug('writeSearchResultsToNote', `written resultSet for '${searchTermsRepStr}' to the new note '${displayTitle(outputNote)}'`)
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
export function createFormattedResultLines(resultSet: resultOutputTypeV2, config: SearchConfig): Array<string> {
  const resultOutputLines: Array<string> = []
  const headingMarker = '#'.repeat(config.headingLevel)
  const simplifyLine = (config.resultStyle === 'Simplified')

  // Get array of 'may' or 'must' search terms ready to display highlights
  const mayOrMustTerms = resultSet.searchTermsRepArr.filter((f) => f[0] !== '-')
  // Add each result line to output array
  for (const rnal of resultSet.resultNoteAndLinesArr) {
    if (config.groupResultsByNote) {
      // Write each line without transformation, grouped by Note, with Note headings inserted accordingly
      if (rnal.noteFilename !== '') {
        // though only insert heading if noteFilename isn't blank
        resultOutputLines.push(`${headingMarker} ${getNoteTitleFromFilename(rnal.noteFilename, true)}`)
      }
      for (const origLine of rnal.lines) {
        const outputLine = trimAndHighlightTermInLine(origLine, mayOrMustTerms, simplifyLine, config.highlightResults, config.resultPrefix, config.resultQuoteLength)
        resultOutputLines.push(outputLine)
      }
    } else {
      // Write each line, first transforming it to add context on the end, and make other changes according to what the user has configured
      for (const origLine of rnal.lines) {
        const outputLine = trimAndHighlightTermInLine(origLine, mayOrMustTerms, simplifyLine, config.highlightResults, config.resultPrefix, config.resultQuoteLength) + getNoteContextAsSuffix(rnal.noteFilename, config.dateStyle)
        resultOutputLines.push(outputLine)
      }
    }
  }
  return resultOutputLines
}
