/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Helpers for NotePlan advanced (native) search (NP 3.18.1+)
// Jonathan Clark
// Last updated 2026-08-09 for v3.0.0, @jgclark
//-----------------------------------------------------------------------------

// import pluginJson from '../plugin.json'
import type { noteAndLine, resultOutputV3Type, reducedFieldSet, SearchConfig, TSearchOptions } from './searchHelpers'
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
//

//------------------------------------------------------------------------------
// Functions

/**
 * Run a search over notes using NotePlan advanced search syntax (NP 3.18.1+).
 * Full-word setting quotes terms for the API. Case-sensitive setting filters after the API.
 * FIXME(Eduard): API issues reported with some date: ranges plus terms (e.g. from /SIP).
 *
 * @param {string} searchStringIn
 * @param {SearchConfig} config object for various settings
 * @param {TSearchOptions} searchOptions object for various settings
 * @returns {resultOutputV3Type} results optimised for output
 */
export async function runNPExtendedSyntaxSearches(
  searchStringIn: string,
  config: SearchConfig,
  searchOptions: TSearchOptions,
): Promise<resultOutputV3Type> {
  try {
    // clo(searchOptions, 'runNPExtendedSyntaxSearches starting with searchOptions:')
    const noteTypesToInclude = searchOptions.noteTypesToInclude || ['notes', 'calendar']
    logDebug('runNPExtendedSyntaxSearches', `noteTypesToInclude: ${String(noteTypesToInclude)}`)
    const foldersToInclude = searchOptions.foldersToInclude || []
    // logDebug('runNPExtendedSyntaxSearches', `foldersToInclude: ${String(foldersToInclude)}`)
    const foldersToExclude = searchOptions.foldersToExclude || []
    // logDebug('runNPExtendedSyntaxSearches', `foldersToExclude: ${String(foldersToExclude)}`)
    const paraTypesToInclude = searchOptions.paraTypesToInclude || []
    // logDebug('runNPExtendedSyntaxSearches', `paraTypesToInclude: ${String(paraTypesToInclude)}`)
    const fullWordSearching: boolean = config.fullWordSearching || false
    // logDebug('runNPExtendedSyntaxSearches', `fullWordSearching: ${String(fullWordSearching)}`)
    const resultLimit: number = config.resultLimit || 500
    // logDebug('runNPExtendedSyntaxSearches', `resultLimit: ${String(resultLimit)}`)
    const userLocale: string = getLocale(config)
    // logDebug('runNPExtendedSyntaxSearches', `userLocale: ${String(userLocale)}`)

    const caseSensitive: boolean = config.caseSensitiveSearching
    let preLimitResultCount = 0

    let searchString = searchStringIn
    const searchOperators = getSearchOperators(searchString)
    const searchTerms = searchString.split(' ').filter((f) => !searchOperators.includes(f))

    logDebug('runNPExtendedSyntaxSearches', `Starting for [${searchString}] / operators [${searchOperators.join(' ')}] and caseSensitive ${String(caseSensitive)} with locale ${userLocale}`)

    const searchTermsToHighlight = getNonNegativeSearchTermsFromNPExtendedSyntax(searchString)
    logDebug('runNPExtendedSyntaxSearches', `searchTermsToHighlight: '${String(searchTermsToHighlight)}'`)

    // If the settings say we want only full word matches, then update the searchString to surround the search term(s) with quotes
    if (fullWordSearching) {
      searchString = (searchOperators.join(" ") + " " + quoteTermsInSearchString(searchTerms.join(" "))).trim()
      logInfo('runNPExtendedSyntaxSearches', `fullWordSearching: updated searchString to [${searchString}]`)
    }

    //-------------------------------------------------------
    // And now, the actual Search API Call!
    const response = await DataStore.search(searchString, noteTypesToInclude, foldersToInclude, foldersToExclude, false)
    logInfo('runNPExtendedSyntaxSearches', `🔶 API response ${String(response.length)} results for [${searchString}] with params noteTypesToInclude: [${String(noteTypesToInclude)}], foldersToInclude: [${String(foldersToInclude)}], foldersToExclude: [${String(foldersToExclude)}]`)
    const initialResult: Array<TParagraph> = response.slice() // to convert from $ReadOnlyArray to $Array
    //-------------------------------------------------------

    const noteAndLineArr: Array<noteAndLine> = []

    if (initialResult.length > 0) {
      logDebug('runNPExtendedSyntaxSearches', `- Found ${initialResult.length} results for [${searchString}]`)

      // Try creating much smaller data sets, without full Note or Para. Use filename for disambig later.
      // $FlowIgnore[prop-missing]
      let resultReducedParas: Array<reducedFieldSet> = initialResult.map((p) => {
        const note = p.note
        // const tempDate = note ? toISOShortDateTimeString(note.createdDate) : '?'
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

      // Confirmatory note-type filter if API ignores source: / noteTypesToInclude (see Discord thread on source:calendar API)
      // TODO(later): remove after NP search API fix
      if (noteTypesToInclude && noteTypesToInclude.length === 1) {
        const preFilterCount = resultReducedParas.length
        // $FlowFixMe[prop-missing]
        resultReducedParas = resultReducedParas.filter((p) => noteTypesToInclude.includes(p.noteType?.toLowerCase() ?? ''))
        if (resultReducedParas.length !== preFilterCount) {
          logWarn('runNPExtendedSyntaxSearches', `- confirmatory noteType filter shows ${String(preFilterCount-resultReducedParas.length)} results not matching noteType [${String(noteTypesToInclude)}] (${String(preFilterCount)} / ${String(resultReducedParas.length)})`)
        }
      }

      // Drop out search results with the wrong paragraph type (if any given)
      if (paraTypesToInclude && paraTypesToInclude.length > 0) {
        const preFilterCount = resultReducedParas.length
        logDebug('runNPExtendedSyntaxSearches', `- before para types filter (${paraTypesToInclude.length} = '${String(paraTypesToInclude)}'), ${resultReducedParas.length} results`)
        resultReducedParas = resultReducedParas.filter((p) => paraTypesToInclude.includes(p.type))
        logDebug('runNPExtendedSyntaxSearches', `  - after para types filter = ${resultReducedParas.length} results`)

        if (resultReducedParas.length !== preFilterCount) {
          logWarn('runNPExtendedSyntaxSearches', `- confirmatory para type filter shows ${String(preFilterCount-resultReducedParas.length)} results not matching para type [${String(noteTypesToInclude)}] (${String(preFilterCount)} / ${String(resultReducedParas.length)})`)
        }
      }

      // Drop out search results found only in a URL or the path of a [!][link](path)
      const preURLPathFilteringResultCount = resultReducedParas.length
      resultReducedParas = resultReducedParas
        .filter((f) => !isTermInURL(searchString, f.content))
        .filter((f) => !isTermInMarkdownPath(searchString, f.content))
      if (preURLPathFilteringResultCount !== resultReducedParas.length) {
        logDebug('runNPExtendedSyntaxSearches', `  - URL/path filtering removed ${String(preURLPathFilteringResultCount - resultReducedParas.length)} results`)
      }
      
      // If we want case-sensitive searching, then filter the results to only those that contains the exact search string
      // TEST: get this to work for multi-term searches
      if (caseSensitive) {
        logDebug('runNPExtendedSyntaxSearches', `case-sensitive: before filtering for [${searchStringIn}]: ${String(resultReducedParas.length)}`)
        // FIXME: this fails when it comes in as a double-quoted string
        resultReducedParas = resultReducedParas.filter(p => caseSensitiveSubstringLocaleMatch(searchTermsToHighlight, p.content, userLocale)) // Note: this is the unmodified searchStringIn, not the modified searchString which can have extra quotes
        // TEST: display the results after filtering
        // const rrpStrArray = resultReducedParas.map((p) => {
        //   const truncatedRawContent = (p.rawContent.length > 100) ? p.rawContent.slice(0, 70) + '...' : p.rawContent
        //   return `  ${truncatedRawContent} [${p.filename}]`
        // })
        // logDebug('runNPExtendedSyntaxSearches', `case-sensitive: after filtering: ${String(resultReducedParas.length)}:\n${rrpStrArray.join('\n')}`)
      }

      // Dedupe identical synced lines
      logDebug('runNPExtendedSyntaxSearches', `- before dedupe = ${resultReducedParas.length} results`)
      // $FlowFixMe[prop-missing]
      // $FlowFixMe[incompatible-exact]
      resultReducedParas = eliminateDuplicateParagraphs(resultReducedParas, 'most-recent', true)
      logDebug('runNPExtendedSyntaxSearches', `  - after dedupe = ${resultReducedParas.length} results`)
      preLimitResultCount = resultReducedParas.length

      // Now check to see if we have more than config.resultLimit: if so only use the first amount to return
      if (resultLimit > 0 && preLimitResultCount > resultLimit) {
        // First make a note of the total (to display later)
        logWarn('runNPExtendedSyntaxSearches', `We have more than ${resultLimit} results, so will discard all the ones beyond that limit.`)
        // $FlowFixMe[prop-missing]
        // $FlowFixMe[incompatible-exact]
        resultReducedParas = resultReducedParas.slice(0, resultLimit)
        logDebug('applySearchOperators', `-> now ${resultReducedParas.length} results`)
      }

      // Sort results, unless the searchOptions.useNativeSortOrder is set.
      // Note: 'asc' and 'desc' refer to date of note (though the documentation doesn't say which date this is)
      if (!searchOptions.useNativeSortOrder) {
        const sortKeys = SORT_MAP.get(config.sortOrder) ?? ['title'] // get value, falling back to 'title'
        logDebug('runNPExtendedSyntaxSearches', `- Will use sortKeys: [${String(sortKeys)}] from ${config.sortOrder}`)
        // $FlowFixMe[prop-missing]
        // $FlowFixMe[incompatible-exact]
        resultReducedParas = sortListBy(resultReducedParas, sortKeys)
      } else {
        logDebug('runNPExtendedSyntaxSearches', `- useNativeSortOrder set, so will not sort results`)
      }

      // Form the return object from sortedFieldSets
      for (let i = 0; i < resultReducedParas.length; i++) {
        noteAndLineArr.push({
          noteFilename: resultReducedParas[i].filename ?? '<error>',
          index: resultReducedParas[i].lineIndex,
          line: resultReducedParas[i].rawContent,
        })
      }
    }
    const resultCount = noteAndLineArr.length
    logDebug('runNPExtendedSyntaxSearches', `- end of runNPExtendedSyntaxSearches for [${searchString}]: ${resultCount} results from ${numberOfUniqueFilenames(noteAndLineArr)} notes`)
    // const nalStrArray = noteAndLineArr.map((nal) => {
    //   const truncatedRawContent = (nal.line.length > 100) ? nal.line.slice(0, 70) + '...' : nal.line
    //   return `  ${truncatedRawContent}`
    // })
    // logDebug('runNPExtendedSyntaxSearches', `${String(nalStrArray.length)} nals:\n${nalStrArray.join('\n')}`)
    
    const returnObject: resultOutputV3Type = {
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
    logError('runNPExtendedSyntaxSearches', err.message)
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
export function getNonNegativeSearchTermsFromNPExtendedSyntax(searchString: string): Array<string> {
  logDebug('getNonNegativeSearchTermsFromNPExtendedSyntax', `starting for [${searchString}]`)
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
