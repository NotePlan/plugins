// @flow
//-----------------------------------------------------------------------------
// Search Extensions helpers (err...)
// Jonathan Clark
// Last updated 1.7.2022 for v0.1.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { logError } from '@helpers/dev'
import { type headingLevelType } from '@helpers/general'

//------------------------------------------------------------------------------

export type resultObjectType = {
  resultHeading: string,
  resultLines: Array<string>
}

//------------------------------------------------------------------------------
// Settings things

const configKey = 'search'

export type SearchConfig = {
  folderToStore: string,
  foldersToExclude: Array<string>,
  headingLevel: headingLevelType,
  defaultSearchTerms: Array<string>,
  searchHeading: string,
  groupResultsByNote: boolean,
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
  // log(pluginJson, `Start of getSearchSettings()`)
  try {
    // Get settings using ConfigV2
    const v2Config: SearchConfig = await DataStore.loadJSON('../jgclark.SearchExtensions/settings.json')
    // clo(v2Config, `${configKey} settings from V2:`)

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      throw new Error(`Cannot find settings for '${configKey}' plugin`)
    }
    return v2Config
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return null // for completeness
  }
}
