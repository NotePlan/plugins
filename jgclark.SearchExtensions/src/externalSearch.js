/* eslint-disable max-len */
// @flow
//-----------------------------------------------------------------------------
// Entry point to the SearchExtensions plugin from other plugins.
// Last updated 2026-08-09 for v3.0.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import type { resultOutputV3Type, TSearchOptions } from './searchHelpers'
import { getSearchSettings } from './searchHelpers'
import { runNPExtendedSyntaxSearches } from './NPExtendedSyntaxHelpers'
import { clo, logDebug, logError } from '@helpers/dev'

/**
 * Entry point for extended search where all the parameters are supplied.
 * Uses NotePlan advanced (native) search syntax only (requires NP 3.18.1+).
 * Callers such as Dashboard must pass NP advanced syntax, not plugin v2 `+term` / `!term`.
 *
 * @param {string} searchString as a string with items separated by spaces, to suit taking from a search box.
 * @param {TSearchOptions} searchOptions object for various settings
 * @returns {Promise<?resultOutputV3Type>}
 */
export async function extendedSearch(
  searchString: string,
  searchOptions: TSearchOptions,
): Promise<?resultOutputV3Type> {
  try {
    // get relevant settings
    const config = await getSearchSettings()
    logDebug(pluginJson, `Starting extendedSearch() with searchString: '${searchString}'`)
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

    //---------------------------------------------------------
    // Call main native advanced search
    await CommandBar.onAsyncThread()

    const results: resultOutputV3Type = await runNPExtendedSyntaxSearches(searchString, config, searchOptions)

    await CommandBar.onMainThread()

    return results
  }
  catch (err) {
    logError(pluginJson, err.message)
    return null
  }
}
