/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Helpers for NP Extended Syntax
// Jonathan Clark
// Last updated 2025-09-29 for v3.0.0, @jgclark
//-----------------------------------------------------------------------------

// import pluginJson from '../plugin.json'
import type { noteAndLine, resultOutputV3Type, reducedFieldSet, SearchConfig, TSearchOptions } from './searchHelpers'
import { getNonNegativeSearchTerms, numberOfUniqueFilenames } from './searchHelpers'
import { clo, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getLocale } from '@helpers/NPConfiguration'
import { isTermInMarkdownPath, isTermInURL } from '@helpers/paragraph'
import { caseSensitiveSubstringLocaleMatch, getSearchOperators, quoteTermsInSearchString, removeSearchOperators } from '@helpers/search'
import { sortListBy } from '@helpers/sorting'
import { eliminateDuplicateSyncedParagraphs } from '@helpers/syncedCopies'

//------------------------------------------------------------------------------
// Notes
//
// More complex boolean logic
//
// My method in v2 was limited to simple and/or/not boolean logic.
// NP extended syntax now gives a way to use those, and to have grouping of OR-d terms with parentheses. [e.g. (a OR b) c]
// This is great but means the v2 method of having a simple-ish array of typed search terms is no longer good enough.
// So, for v3 I now deal with the whole searchString in one go, not just the searchTerms.
//
// New NP search operators in v3
//
// v3.18.1 introduced the following search operators, which need to come at start of search string, and not have spaces after the colon (but can have value in double quotes).
// - date:.. (search by date range ... see separate file for details)
// - path:.. (search by path, e.g. path:Projects/Work)
// - source:.. (one or more of calendar, dated-notes, notes, events, reminders, list-reminders)
// - is:.. (one or more para types: open, done, scheduled, cancelled, not-task, checklist, checklist-done, checklist-scheduled, checklist-cancelled)
// - heading:... (search under given heading)
// - sort:asc|desc
// - show:... & hide:... (view options for timeblocked, past-events, archive, teamspace)
//
// Dealing with multi-word (phrase) searches.
// 
// My method in v2 had been to handle this by asking for multi-word searches to be enclosed in double quotes. Then split the search terms and searching for each one, and then extra logic at the end to combine and format the results.
// NP extended syntax does give a way to search for multiple words (phrases), by enclosing in double quotes.
// 
// Dealing with case-sensitive searching
// 
// NP doesn't appear to give a way to ask for this.
// My method in v2 has been to try to do a further case-sensitive match of the search terms into the matched line.
// Challenge is when the search terms are multi-word, or otherwise enclosed by double quotes, as we need to ignore the extra quotes.

//------------------------------------------------------------------------------
// Functions

/**
 * Run an extended search over all search terms in 'searchTermsStr' over the set of notes determined by the parameters.
 * V4 of this function, which uses NP's extended search syntax available from 3.18.1.
 * Note: To get 'fullWord' matches, the syntax is now to surround a word with quotes. Example: "sun" returns lines where sun appears as a word, not as part of sunlight. So the fullWordSearching parameter is now ignored.
 *
 * @param {Array<string>} searchStringIn
 * @param {SearchConfig} config object for various settings - Note: there are two overrides later in these parameters
 * @param {TSearchOptions} searchOptions object for various settings
 * @returns {resultObjectType} results optimised for output
 */
export async function runNPExtendedSyntaxSearches(
  searchStringIn: string,
  config: SearchConfig,
  searchOptions: TSearchOptions,
): Promise<resultOutputV3Type> {
  try {
    const noteTypesToInclude = searchOptions.noteTypesToInclude || ['notes', 'calendar']
    const foldersToInclude = searchOptions.foldersToInclude || []
    const foldersToExclude = searchOptions.foldersToExclude || []
    const paraTypesToInclude = searchOptions.paraTypesToInclude || []
    const fromDateStr = searchOptions.fromDateStr || ''
    const toDateStr = searchOptions.toDateStr || ''
    const fullWordSearching: boolean = config.fullWordSearching || false
    const resultLimit: number = config.resultLimit || 500
    const userLocale: string = getLocale()

    // const headingMarker = '#'.repeat(config.headingLevel)
    // let searchTerm = fullSearchTerm
    // let multiWordSearch = false
    // let resultParas: Array<TParagraph> = []
    let wildcardedSearch = false
    const caseSensitive: boolean = config.caseSensitiveSearching
    let fullResultCount = 0

    let searchString = searchStringIn
    const searchOperators = getSearchOperators(searchString)
    const searchTerms = searchString.split(' ').filter((f) => !searchOperators.includes(f))

    logDebug('runNPExtendedSyntaxSearches', `Starting for [${searchString}] / operators [${searchOperators.join(' ')}] and caseSensitive ${String(caseSensitive)} with locale ${userLocale}`)

    // TODO: update this to on terms with a longer string
    // // if search term includes * or ? then we need to do further wildcard filtering: for now reduce search term to just the part before the wildcard. We will do more filtering later.
    // if (searchString.includes("*") || searchString.includes("?")) {
    //   searchTerm = searchTerm.split(/[\*\?]/, 1)[0]
    //   wildcardedSearch = true
    //   logDebug('runNPExtendedSyntaxSearches', `wildcard: will now use [${searchTerm}] for [${fullSearchTerm}]`)
    // }

    const searchTermsToHighlight = getNonNegativeSearchTerms(searchTerms)
    logDebug('runNPExtendedSyntaxSearches', `searchTermsToHighlight: ${String(searchTermsToHighlight)}`)

    // If the settings say we want only full word matches, then update the searchString to surround the search term(s) with quotes
    if (fullWordSearching) {
      searchString = quoteTermsInSearchString(searchString)
      logInfo('runNPExtendedSyntaxSearches', `fullWordSearching: updated searchString to [${searchString}]`)
    }

    //-------------------------------------------------------
    // And now, the actual Search API Call!

    const response = await DataStore.search(searchString, noteTypesToInclude, foldersToInclude, foldersToExclude, false)
    const initialResult: Array<TParagraph> = response.slice() // to convert from $ReadOnlyArray to $Array

    // CommandBar.showLoading(false)
    //-------------------------------------------------------

    const noteAndLineArr: Array<noteAndLine> = []

    if (initialResult.length > 0) {
      logDebug('runNPExtendedSyntaxSearches', `- Found ${initialResult.length} results for '${searchString}'`)

      // Try creating much smaller data sets, without full Note or Para. Use filename for disambig later.
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
        }
        return fieldSet
      })

      // Drop out search results with the wrong paragraph type (if any given)
      // TODO(later): optimise by pulling this filtering in the search call?
      if (paraTypesToInclude && paraTypesToInclude.length > 0) {
        logDebug('runNPExtendedSyntaxSearches', `- before types filter (${paraTypesToInclude.length} = '${String(paraTypesToInclude)}'), ${resultReducedParas.length} results`)
        resultReducedParas = resultReducedParas.filter((p) => paraTypesToInclude.includes(p.type))
        logDebug('runNPExtendedSyntaxSearches', `- after types filter (to ${String(paraTypesToInclude)}), ${resultReducedParas.length} results`)
      } else {
        logDebug('runNPExtendedSyntaxSearches', `- no type filtering requested`)
      }

      // TODO(later): update this for search phrases not single terms
      // If search term includes * or ? then we need to do further wildcard filtering, using regex equivalent:
      // - replace ? with .
      // - replace * with [^\s]*? (i.e. any anything within the same 'word')
      // if (wildcardedSearch) {
      //   const regexSearchTerm = new RegExp('\\b' + searchString.replace(/\?/g, '.').replace(/\*/g, '[^\\s]*?') + '\\b')
      //   logDebug('runNPExtendedSyntaxSearches', `wildcard: before regex filtering with ${String(regexSearchTerm)}: ${String(resultParas.length)}`)
      //   resultParas = resultParas.filter(tr => regexSearchTerm.test(tr.content))
      //   logDebug('runNPExtendedSyntaxSearches', `wildcard: after filtering: ${String(resultParas.length)}`)
      // }

      fullResultCount = resultReducedParas.length

      // Drop out search results found only in a URL or the path of a [!][link](path)
      const numberOfResultsBeforeURLPathFiltering = resultReducedParas.length
      resultReducedParas = resultReducedParas
        .filter((f) => !isTermInURL(searchString, f.content))
        .filter((f) => !isTermInMarkdownPath(searchString, f.content))
      if (numberOfResultsBeforeURLPathFiltering !== resultReducedParas.length) {
        logDebug('runNPExtendedSyntaxSearches', `  - URL/path filtering removed ${String(numberOfResultsBeforeURLPathFiltering - resultReducedParas.length)} results`)
      }
      
      // If we want case-sensitive searching, then filter the results to only those that contains the exact search string
      // TEST: get this to work for multi-term searches
      if (caseSensitive) {
        logDebug('runNPExtendedSyntaxSearches', `case-sensitive: before filtering for '${searchStringIn}': ${String(resultReducedParas.length)}`)
        // FIXME: this fails when it comes in as a double-quoted string
        resultReducedParas = resultReducedParas.filter(p => caseSensitiveSubstringLocaleMatch(searchTermsToHighlight, p.content, userLocale)) // Note: this is the unmodified searchStringIn, not the modified searchString which can have extra quotes
        // TEST: display the results after filtering
        const rrpStrArray = resultReducedParas.map((p) => {
          const truncatedRawContent = (p.rawContent.length > 100) ? p.rawContent.slice(0, 70) + '...' : p.rawContent
          return `  ${truncatedRawContent} [${p.filename}]`
        })
        logDebug('runNPExtendedSyntaxSearches', `case-sensitive: after filtering: ${String(resultReducedParas.length)}:\n${rrpStrArray.join('\n')}`)
      }

      // Dedupe identical synced lines
      logDebug('runNPExtendedSyntaxSearches', `- Before dedupe, ${resultReducedParas.length} results for [${searchString}]`)
      // $FlowFixMe[prop-missing]
      // $FlowFixMe[incompatible-exact]
      resultReducedParas = eliminateDuplicateSyncedParagraphs(resultReducedParas, 'most-recent', true)
      logDebug('runNPExtendedSyntaxSearches', `- After dedupe, ${resultReducedParas.length} results for [${searchString}]`)

      // Now check to see if we have more than config.resultLimit: if so only use the first amount to return
      if (resultLimit > 0 && resultReducedParas.length > resultLimit) {
        // First make a note of the total (to display later)
        logWarn('runNPExtendedSyntaxSearches', `We have more than ${resultLimit} results, so will discard all the ones beyond that limit.`)
        // $FlowFixMe[prop-missing]
        // $FlowFixMe[incompatible-exact]
        resultReducedParas = resultReducedParas.slice(0, resultLimit)
        logDebug('applySearchOperators', `-> now ${resultReducedParas.length} results`)
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
      logDebug('runNPExtendedSyntaxSearches', `- Will use sortKeys: [${String(sortKeys)}] from ${config.sortOrder}`)
      // $FlowFixMe[prop-missing]
      // $FlowFixMe[incompatible-exact]
      const sortedReducedParas: Array<reducedFieldSet> = sortListBy(resultReducedParas, sortKeys)

      // Form the return object from sortedFieldSets
      for (let i = 0; i < sortedReducedParas.length; i++) {
        noteAndLineArr.push({
          noteFilename: sortedReducedParas[i].filename,
          index: sortedReducedParas[i].lineIndex,
          line: sortedReducedParas[i].rawContent,
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
      fullResultCount: fullResultCount,
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
 * Create a string to display the number of results and notes: "[first N] from M results from P notes"
 * @author @jgclark
 * @param {resultOutputType} resultSet
 * @returns {string}
 */
export function resultCounts(resultSet: resultOutputV3Type): string {
  return (resultSet.resultCount < resultSet.fullResultCount)
    ? `(first ${resultSet.resultCount} from ${resultSet.fullResultCount} results from ${resultSet.resultNoteCount} notes)`
    : `(${resultSet.resultCount} results from ${resultSet.resultNoteCount} notes)`
}

/**
 * Get array of non-blank non-negative (i.e.  not starting with '-') search terms in case we want to display highlights.
 * Copes with "(A OR B)" and "-(A OR B)" style search groups.
 * Ignores search operators.
 * Note: separate from getNonNegativeSearchTermsFromPluginExtendedSyntax() which does not cope with "-(A OR B)" style search groups.
 
 * @author @jgclark
 * @tests in jest file
 * 
 * @param {string} searchString string containing search terms and possibly operators
 * @returns {Array<string>} array of subset search terms that could be highlighted
 */
export function getNonNegativeSearchTermsFromNPExtendedSyntax(searchString: string): Array<string> {
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
