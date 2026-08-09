/* eslint-disable max-len */
// @flow
//-----------------------------------------------------------------------------
// Entry point to the SearchExtensions plugin from other plugins.
// Last updated 2025-10-03 for v3.0.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import type { resultOutputV3Type, TSearchOptions } from './searchHelpers'
import { getSearchSettings } from './searchHelpers'
import { runPluginExtendedSyntaxSearches, validateAndTypeSearchTerms
} from './pluginExtendedSyntaxHelpers'
import { runNPExtendedSyntaxSearches } from './NPExtendedSyntaxHelpers'
import { clo, logDebug, logInfo, logError, logWarn } from '@helpers/dev'

/**
 * Entry point for extended search where all the parameters are supplied.
 * @param {string} searchString as a string with items separated by spaces, to suit taking from a search box.
 * @param {SearchOptions} searchOptions object for various settings
 */
export async function extendedSearch(
  searchString: string,
  searchOptions: TSearchOptions,
): Promise<resultOutputV3Type> {
  try {
    // get relevant settings
    const config = await getSearchSettings()
    logDebug(pluginJson, `Starting extendedSearch() with searchString: '${searchString}'`)
    clo(searchOptions, 'extendedSearch searchOptions:')
    const NPAdvancedSyntaxAvailable = NotePlan.environment.buildVersion >= 1429

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

    //---------------------------------------------------------
    // Call main extended search function
    // CommandBar.showLoading(true, `Searching ...`)
    await CommandBar.onAsyncThread()

    let results: resultOutputV3Type
    if (config.useNativeSearch && NPAdvancedSyntaxAvailable) {
      results = await runNPExtendedSyntaxSearches(searchString, config, searchOptions)
    } else {
      // Validate the search terms: an empty return means failure. There is error logging in the function.
      const validatedSearchTerms = await validateAndTypeSearchTerms(searchString, false)
      if (validatedSearchTerms == null || validatedSearchTerms.length === 0) {
        throw new Error(`These search terms aren't valid. Please see Plugin Console for details.`)
      }

      results = await runPluginExtendedSyntaxSearches(validatedSearchTerms, config, searchOptions)
    }

    await CommandBar.onMainThread()

    return results
  }
  catch (err) {
    logError(pluginJson, err.message)
    // $FlowFixMe[incompatible-return]
    return null
  }
}
