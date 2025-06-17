// @flow
// -----------------------------------------------------------------------------
// Functions to support TOC creation & update
// David Wertheimer (original version), adapted for plugin by @jgclark
// Last updated 2025-06-13 for v1.0.0 by @jgclark
// -----------------------------------------------------------------------------

import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'

// -----------------------------------------------------------------------------
// Constants

const pluginID = 'np.TOC'

// -----------------------------------------------------------------------------
// config

export type TOCConfig = {
  writeUnderHeading: string,
  includeH1BlankLineUnder: boolean | string,
  padTextWithSpaces: boolean | string,
  horizontal: boolean | string,
  bullet: string,
  CAPS: boolean | string,
  highlight: boolean | string,
  indented: boolean | string,
}


export async function getSettings(): Promise<TOCConfig> {
  try {
    const config: TOCConfig = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    if (config == null || Object.keys(config).length === 0) {
      throw new Error(`Cannot find settings for '${pluginID}' plugin`)
    }
    return config
  } catch (error) {
    logError(`getSettings`, error.message)
    return {
      writeUnderHeading: 'Table of Contents',
      includeH1BlankLineUnder: true,
      padTextWithSpaces: true,
      horizontal: false,
      bullet: '-',
      CAPS: false,
      highlight: false,
      indented: false,
    }
  }
}

// -----------------------------------------------------------------------------
// Functions

/**
 * Processes the heading text based on settings.
 *
 * @param {string} text - The original heading text.
 * @param {boolean|string} capsSetting - If true, converts text to uppercase.
 * @param {boolean|string} highlightSetting - If true, wraps text with '=='.
 * @returns {string} Processed heading text.
 */
export function processHeading(text: string, capsSetting: boolean | string, highlightSetting: boolean | string): string {
  const caps = (capsSetting === true || capsSetting === 'true')
  const highlight = (highlightSetting === true || highlightSetting === 'true')

  // Remove markdown links and keep only the text within square brackets
  let safeText = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // Escape brackets for markdown by adding a backslash before [ and ]
  safeText = safeText.replace(/[\[\(]/g, '{').replace(/[\]\)]/g, '}')

  if (caps) {
    safeText = safeText.toUpperCase()
  }
  if (highlight) {
    safeText = `==${safeText}==`
  }
  return safeText
}

/**
 * Extracts the text portion from a markdown link.
 *
 * @param {string} text - The text that may contain markdown links
 * @returns {string} The text with markdown links replaced by their text portion
 */
export function extractLinkText(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}
