/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Helpers for NotePlan advanced (native) search (NP 3.18.1+)
// Jonathan Clark
// Last updated 2026-08-09 for v3.0.0, @jgclark
//-----------------------------------------------------------------------------

// import pluginJson from '../plugin.json'
import type { noteAndLine, TSearchResultSet, reducedFieldSet, SearchConfig, TSearchOptions } from './searchHelpers'
import { makeAnySyncs, numberOfUniqueFilenames, SORT_MAP } from './searchHelpers'
import { clo, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getLocale } from '@helpers/NPConfiguration'
import { isTermInMarkdownPath, isTermInURL } from '@helpers/paragraph'
import { caseSensitiveSubstringLocaleMatch, getSearchOperators, quoteTermsInSearchString, removeSearchOperators } from '@helpers/search'
import { sortListBy } from '@helpers/sorting'
import { eliminateDuplicateParagraphs } from '@helpers/syncedCopies'

//------------------------------------------------------------------------------
// Notes
//
// Use the whole searchString in one go (NP boolean/group syntax).
// Leading operators: date:, path:, source:, is:, heading:, sort:, show|/hide:
// Full-word: quote terms. Case-sensitive: post-filter after the API search.
// Pipeline stages below keep runNativeSearch as orchestration only.
//

//------------------------------------------------------------------------------
// Pipeline stages (mostly pure; unit-test friendly)

/**
 * @typedef {Object} TPreparedNativeSearch
 * @property {string} searchString - string passed to DataStore.search
 * @property {Array<string>} searchOperators
 * @property {Array<string>} searchTerms - non-operator tokens (for result metadata)
 * @property {Array<string>} searchTermsToHighlight
 */

/**
 * Parse operators/terms and apply full-word quoting when configured.
 * @param {string} searchStringIn
 * @param {boolean} fullWordSearching
 * @returns {TPreparedNativeSearch}
 */
export function prepareNativeSearchString(searchStringIn: string, fullWordSearching: boolean): TPreparedNativeSearch {
  let searchString = searchStringIn
  const searchOperators = getSearchOperators(searchString)
  const searchTerms = searchString.split(' ').filter((f) => !searchOperators.includes(f))
  const searchTermsToHighlight = getHighlightTermsFromNativeSearch(searchString)

  if (fullWordSearching) {
    searchString = (searchOperators.join(' ') + ' ' + quoteTermsInSearchString(searchTerms.join(' '))).trim()
    logInfo('prepareNativeSearchString', `fullWordSearching: updated searchString to [${searchString}]`)
  }

  return { searchString, searchOperators, searchTerms, searchTermsToHighlight }
}

/**
 * Map full TParagraph results to the reduced field set used for filtering/sorting.
 * @param {Array<TParagraph>} paragraphs
 * @returns {Array<reducedFieldSet>}
 */
export function mapParagraphsToReducedFieldSets(paragraphs: Array<TParagraph>): Array<reducedFieldSet> {
  // $FlowIgnore[prop-missing]
  return paragraphs.map((p) => {
    const note = p.note
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
      // Work around possible API ignoring source:/note type filter - remove when API fixed
      noteType: note?.type,
    }
    return fieldSet
  })
}

/**
 * Post-API filters: confirmatory note type, para type, URL/path, case-sensitive.
 * @param {Array<reducedFieldSet>} resultsIn
 * @param {{ noteTypesToInclude: Array<string>, paraTypesToInclude: Array<ParagraphType>, caseSensitive: boolean, searchStringIn: string, searchStringForUrlFilter: string, searchTermsToHighlight: Array<string>, userLocale: string }} opts
 * @returns {Array<reducedFieldSet>}
 */
export function filterReducedSearchResults(
  resultsIn: Array<reducedFieldSet>,
  opts: {
    noteTypesToInclude: Array<string>,
    // $FlowFixMe[value-as-type]
    paraTypesToInclude: Array<ParagraphType>,
    caseSensitive: boolean,
    searchStringIn: string,
    searchStringForUrlFilter: string,
    searchTermsToHighlight: Array<string>,
    userLocale: string,
  },
): Array<reducedFieldSet> {
  let resultReducedParas = resultsIn
  const { noteTypesToInclude, paraTypesToInclude, caseSensitive, searchStringIn, searchStringForUrlFilter, searchTermsToHighlight, userLocale } = opts

  // Confirmatory note-type filter if API ignores source: / noteTypesToInclude (see Discord thread on source:calendar API)
  // TODO(later): remove after NP search API fix
  if (noteTypesToInclude && noteTypesToInclude.length === 1) {
    const preFilterCount = resultReducedParas.length
    // $FlowFixMe[prop-missing]
    resultReducedParas = resultReducedParas.filter((p) => noteTypesToInclude.includes(p.noteType?.toLowerCase() ?? ''))
    if (resultReducedParas.length !== preFilterCount) {
      logWarn('filterReducedSearchResults', `- confirmatory noteType filter shows ${String(preFilterCount - resultReducedParas.length)} results not matching noteType [${String(noteTypesToInclude)}] (${String(preFilterCount)} / ${String(resultReducedParas.length)})`)
    }
  }

  if (paraTypesToInclude && paraTypesToInclude.length > 0) {
    const preFilterCount = resultReducedParas.length
    logDebug('filterReducedSearchResults', `- before para types filter (${paraTypesToInclude.length} = '${String(paraTypesToInclude)}'), ${resultReducedParas.length} results`)
    resultReducedParas = resultReducedParas.filter((p) => paraTypesToInclude.includes(p.type))
    logDebug('filterReducedSearchResults', `  - after para types filter = ${resultReducedParas.length} results`)

    if (resultReducedParas.length !== preFilterCount) {
      logWarn('filterReducedSearchResults', `- confirmatory para type filter shows ${String(preFilterCount - resultReducedParas.length)} results not matching para type [${String(paraTypesToInclude)}] (${String(preFilterCount)} / ${String(resultReducedParas.length)})`)
    }
  }

  // Drop results found only in a URL or the path of a [!][link](path)
  const preURLPathFilteringResultCount = resultReducedParas.length
  resultReducedParas = resultReducedParas
    .filter((f) => !isTermInURL(searchStringForUrlFilter, f.content))
    .filter((f) => !isTermInMarkdownPath(searchStringForUrlFilter, f.content))
  if (preURLPathFilteringResultCount !== resultReducedParas.length) {
    logDebug('filterReducedSearchResults', `  - URL/path filtering removed ${String(preURLPathFilteringResultCount - resultReducedParas.length)} results`)
  }

  if (caseSensitive) {
    logDebug('filterReducedSearchResults', `case-sensitive: before filtering for [${searchStringIn}]: ${String(resultReducedParas.length)}`)
    // FIXME: this fails when it comes in as a double-quoted string
    resultReducedParas = resultReducedParas.filter(p => caseSensitiveSubstringLocaleMatch(searchTermsToHighlight, p.content, userLocale))
  }

  return resultReducedParas
}

/**
 * Dedupe synced lines, apply resultLimit, then optional plugin sort.
 * @param {Array<reducedFieldSet>} resultsIn
 * @param {{ resultLimit: number, useNativeSortOrder: boolean, sortOrder: string }} opts
 * @returns {{ results: Array<reducedFieldSet>, fullResultCount: number }}
 */
export function dedupeLimitAndSortReducedResults(
  resultsIn: Array<reducedFieldSet>,
  opts: { resultLimit: number, useNativeSortOrder: boolean, sortOrder: string },
): { results: Array<reducedFieldSet>, fullResultCount: number } {
  let resultReducedParas = resultsIn
  const { resultLimit, useNativeSortOrder, sortOrder } = opts

  logDebug('dedupeLimitAndSortReducedResults', `- before dedupe = ${resultReducedParas.length} results`)
  // $FlowFixMe[prop-missing]
  // $FlowFixMe[incompatible-exact]
  resultReducedParas = eliminateDuplicateParagraphs(resultReducedParas, 'most-recent', true)
  logDebug('dedupeLimitAndSortReducedResults', `  - after dedupe = ${resultReducedParas.length} results`)
  const fullResultCount = resultReducedParas.length

  if (resultLimit > 0 && fullResultCount > resultLimit) {
    logWarn('dedupeLimitAndSortReducedResults', `We have more than ${resultLimit} results, so will discard all the ones beyond that limit.`)
    // $FlowFixMe[prop-missing]
    // $FlowFixMe[incompatible-exact]
    resultReducedParas = resultReducedParas.slice(0, resultLimit)
    logDebug('dedupeLimitAndSortReducedResults', `-> now ${resultReducedParas.length} results`)
  }

  // Sort unless useNativeSortOrder (e.g. when sort: operator present)
  if (!useNativeSortOrder) {
    const sortKeys = SORT_MAP.get(sortOrder) ?? ['title']
    logDebug('dedupeLimitAndSortReducedResults', `- Will use sortKeys: [${String(sortKeys)}] from ${sortOrder}`)
    // $FlowFixMe[prop-missing]
    // $FlowFixMe[incompatible-exact]
    resultReducedParas = sortListBy(resultReducedParas, sortKeys)
  } else {
    logDebug('dedupeLimitAndSortReducedResults', `- useNativeSortOrder set, so will not sort results`)
  }

  return { results: resultReducedParas, fullResultCount }
}

/**
 * Build noteAndLine rows for display / replace.
 * @param {Array<reducedFieldSet>} resultReducedParas
 * @returns {Array<noteAndLine>}
 */
export function reducedFieldSetsToNoteAndLines(resultReducedParas: Array<reducedFieldSet>): Array<noteAndLine> {
  const noteAndLineArr: Array<noteAndLine> = []
  for (let i = 0; i < resultReducedParas.length; i++) {
    noteAndLineArr.push({
      noteFilename: resultReducedParas[i].filename ?? '<error>',
      index: resultReducedParas[i].lineIndex,
      line: resultReducedParas[i].rawContent,
      content: resultReducedParas[i].content,
    })
  }
  return noteAndLineArr
}

//------------------------------------------------------------------------------
// Orchestration

/**
 * Run a search over notes using NotePlan advanced search syntax (NP 3.18.1+).
 * Full-word setting quotes terms for the API. Case-sensitive setting filters after the API.
 * FIXME(Eduard): API issues reported with some date: ranges plus terms (e.g. from /SIP).
 *
 * @param {string} searchStringIn
 * @param {SearchConfig} config object for various settings
 * @param {TSearchOptions} searchOptions object for various settings
 * @returns {TSearchResultSet} results optimised for output
 */
export async function runNativeSearch(
  searchStringIn: string,
  config: SearchConfig,
  searchOptions: TSearchOptions,
): Promise<TSearchResultSet> {
  try {
    // clo(searchOptions, 'runNativeSearch starting with searchOptions:')
    const noteTypesToInclude = searchOptions.noteTypesToInclude || ['notes', 'calendar']
    logDebug('runNativeSearch', `noteTypesToInclude: ${String(noteTypesToInclude)}`)
    const foldersToInclude = searchOptions.foldersToInclude || []
    const foldersToExclude = searchOptions.foldersToExclude || []
    const paraTypesToInclude = searchOptions.paraTypesToInclude || []
    const fullWordSearching: boolean = config.fullWordSearching || false
    const resultLimit: number = config.resultLimit || 500
    const userLocale: string = getLocale(config)
    const caseSensitive: boolean = config.caseSensitiveSearching

    const prepared = prepareNativeSearchString(searchStringIn, fullWordSearching)
    const { searchString, searchOperators, searchTerms, searchTermsToHighlight } = prepared

    logDebug('runNativeSearch', `Starting for [${searchString}] / operators [${searchOperators.join(' ')}] and caseSensitive ${String(caseSensitive)} with locale ${userLocale}`)
    logDebug('runNativeSearch', `searchTermsToHighlight: '${String(searchTermsToHighlight)}'`)

    //-------------------------------------------------------
    // Search API
    const response = await DataStore.search(searchString, noteTypesToInclude, foldersToInclude, foldersToExclude, false)
    logInfo('runNativeSearch', `🔶 API response ${String(response.length)} results for [${searchString}] with params noteTypesToInclude: [${String(noteTypesToInclude)}], foldersToInclude: [${String(foldersToInclude)}], foldersToExclude: [${String(foldersToExclude)}]`)
    const initialResult: Array<TParagraph> = response.slice() // to convert from $ReadOnlyArray to $Array
    //-------------------------------------------------------

    let noteAndLineArr: Array<noteAndLine> = []
    let preLimitResultCount = 0

    if (initialResult.length > 0) {
      logDebug('runNativeSearch', `- Found ${initialResult.length} results for [${searchString}]`)

      let resultReducedParas = mapParagraphsToReducedFieldSets(initialResult)
      resultReducedParas = filterReducedSearchResults(resultReducedParas, {
        noteTypesToInclude,
        // $FlowFixMe[incompatible-type]
        paraTypesToInclude,
        caseSensitive,
        searchStringIn,
        searchStringForUrlFilter: searchString,
        searchTermsToHighlight,
        userLocale,
      })

      const afterDedupeLimitSort = dedupeLimitAndSortReducedResults(resultReducedParas, {
        resultLimit,
        useNativeSortOrder: Boolean(searchOptions.useNativeSortOrder),
        sortOrder: config.sortOrder,
      })
      resultReducedParas = afterDedupeLimitSort.results
      preLimitResultCount = afterDedupeLimitSort.fullResultCount
      noteAndLineArr = reducedFieldSetsToNoteAndLines(resultReducedParas)
    }

    const resultCount = noteAndLineArr.length
    logDebug('runNativeSearch', `- end of runNativeSearch for [${searchString}]: ${resultCount} results from ${numberOfUniqueFilenames(noteAndLineArr)} notes`)

    const returnObject: TSearchResultSet = {
      searchTermsStr: searchTerms.join(' '),
      searchOperatorsStr: searchOperators.join(' '),
      searchTermsToHighlight: searchTermsToHighlight,
      resultNoteAndLineArr: noteAndLineArr,
      resultCount: resultCount,
      resultNoteCount: numberOfUniqueFilenames(noteAndLineArr),
      fullResultCount: preLimitResultCount
    }
    // For open tasks, add line sync with blockIDs (same as plugin extended path)
    if (config.resultStyle === 'NotePlan' && config.syncOpenResultItems) {
      const syncdResultSet = await makeAnySyncs(returnObject)
      return syncdResultSet
    }
    return returnObject
  }
  catch (err) {
    logError('runNativeSearch', err.message)
    // const emptyResultObject = { searchTerm: '', resultsLines: [], resultCount: 0 }
    // $FlowFixMe[incompatible-return]
    return null // for completeness
  }
}

/**
 * Get non-blank terms suitable for highlighting (drops operators and negatives).
 * Copes with "(A OR B)" and "-(A OR B)" style search groups.
 *
 * @author @jgclark
 * @tests in jest file
 *
 * @param {string} searchString string containing search terms and possibly operators
 * @returns {Array<string>} array of subset search terms that could be highlighted
 */
export function getHighlightTermsFromNativeSearch(searchString: string): Array<string> {
  logDebug('getHighlightTermsFromNativeSearch', `starting for [${searchString}]`)
  let searchTermsStr = removeSearchOperators(searchString)

  // Remove all "-(A OR B ...)" patterns and collect the terms inside
  const negativeGroupMatches = searchString.match(/-\(([^)]+ OR [^)]+)\)/g) // case sensitive
  if (negativeGroupMatches) {
    for (const match of negativeGroupMatches) {
      searchTermsStr = searchTermsStr.replace(match, '')
    }
  }

  // Change all positive "(A OR B ...)" patterns to "A B ...". (Needs to follow removal of negative groups.)
  const positiveGroupMatches = searchString.match(/\(([^)]+ OR [^)]+)\)/g) // case sensitive
  if (positiveGroupMatches) {
    for (const match of positiveGroupMatches) {
      const updatedMatch = match.replace('(', '').replace(/\s+OR\s+/g, ' ').replace(')', '')
      searchTermsStr = searchTermsStr.replace(match, updatedMatch)
    }
  }

  // Remove search operators as before
  const searchTerms = searchTermsStr.split(' ').filter((f) => f !== '')
  // Remove any terms that were in negative groups
  const mayOrMustTermsRep = searchTerms.filter((f) => f[0] !== '-')
  // Take off leading + if necessary
  const mayOrMustTerms = mayOrMustTermsRep.map((f) => (f.match(/^[\+]/)) ? f.slice(1) : f)
  const notEmptyMayOrMustTerms = mayOrMustTerms.filter((f) => f !== '')
  return notEmptyMayOrMustTerms
}
