/* eslint-disable max-len */
// @flow
//-----------------------------------------------------------------------------
// Entry point to the SearchExtensions plugin from other plugins.
// Last updated 2025-03-02 for v1.5.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import type { resultOutputType, SearchOptions } from './searchHelpers'
import { getSearchSettings, runExtendedSearches, validateAndTypeSearchTerms } from './searchHelpers'
import { clo, logDebug, logInfo, logError, logWarn } from '@helpers/dev'

/**
 * Entry point for extended search where all the parameters are supplied.
 * @param {string} searchTerms as a string with items separated by spaces, to suit taking from a search box.
 * @param {SearchOptions} searchOptions object for various settings
 */
export async function extendedSearch(
  searchTerms: string,
  searchOptions: SearchOptions,
): Promise<resultOutputType> {
  try {
    // get relevant settings
    const config = await getSearchSettings()
    logDebug(pluginJson, `Starting extendedSearch() with searchTerms: '${searchTerms}'`)
    clo(searchOptions, 'extendedSearch searchOptions:')

    // Add config settings if not given
    if (searchOptions.caseSensitiveSearching != null) {
      config.caseSensitiveSearching = searchOptions.caseSensitiveSearching
    }
    if (searchOptions.fullWordSearching != null) {
      config.fullWordSearching = searchOptions.fullWordSearching
    }
    // Set syncOpenResultItems to false, as we don't want to sync open result items when just passing results back to the calling function
    config.syncOpenResultItems = false
    logDebug('extendedSearch', `- config.syncOpenResultItems: ${String(config.syncOpenResultItems)}`)

    // Validate the search terms: an empty return means failure. There is error logging in the function.
    const validatedSearchTerms = await validateAndTypeSearchTerms(searchTerms, false)
    if (validatedSearchTerms == null || validatedSearchTerms.length === 0) {
      throw new Error(`These search terms aren't valid. Please see Plugin Console for details.`)
    }

    //---------------------------------------------------------
    // Call main extended search function
    // CommandBar.showLoading(true, `Searching ...`)
    await CommandBar.onAsyncThread()

    // const results: resultOutputType = await runExtendedSearches(validatedSearchTerms, searchOptions.noteTypesToInclude || ['notes', 'calendar'], searchOptions.foldersToInclude || [], searchOptions.foldersToExclude || [], config, searchOptions.paraTypesToInclude || [], searchOptions.fromDateStr || '', searchOptions.toDateStr || '')
    const results: resultOutputType = await runExtendedSearches(validatedSearchTerms, config, searchOptions)

    await CommandBar.onMainThread()

    return results
  }
  catch (err) {
    logError(pluginJson, err.message)
    // $FlowFixMe[incompatible-return]
    return null
  }
}
