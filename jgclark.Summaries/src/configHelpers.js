// @flow
//-----------------------------------------------------------------------------
// Configuration helper functions for jgclark.Summaries plugin
// Last updated 2026-01-29 for v1.0.2 by @Cursor
//-----------------------------------------------------------------------------

import type { OccurrencesToLookFor } from './summaryHelpers'

/**
 * Creates OccurrencesToLookFor configuration object for tracking totals only.
 * 
 * Separates hashtags and mentions from a mixed array and configures them
 * to track totals (sum of numeric values).
 * 
 * @param {Array<string>} items - Array of hashtags and mentions (e.g., ['#run', '@sleep'])
 * @returns {OccurrencesToLookFor} Configuration object for gatherOccurrences
 */
export function createTotalTrackingConfig(items: Array<string>): OccurrencesToLookFor {
  const hashtagItems = items.filter((a) => a.startsWith('#'))
  const mentionItems = items.filter((a) => a.startsWith('@'))
  
  return {
    GOYesNo: [],
    GOHashtagsCount: [],
    GOHashtagsAverage: [],
    GOHashtagsTotal: hashtagItems,
    GOMentionsCount: [],
    GOMentionsAverage: [],
    GOMentionsTotal: mentionItems,
    GOChecklistRefNote: "",
  }
}

/**
 * Creates OccurrencesToLookFor configuration object for tracking a single tag/mention.
 * 
 * Used for heatmap generation where we only track one specific tag or mention.
 * 
 * @param {string} tagName - Tag or mention to track (must start with '#' or '@')
 * @returns {OccurrencesToLookFor} Configuration object for gatherOccurrences
 * @throws {Error} If tagName doesn't start with '#' or '@'
 */
export function createSingleTagTrackingConfig(tagName: string): OccurrencesToLookFor {
  if (!tagName.startsWith('#') && !tagName.startsWith('@')) {
    throw new Error(`Invalid tag name '${tagName}': must start with '#' (hashtag) or '@' (mention)`)
  }

  return {
    GOYesNo: [],
    GOHashtagsCount: [],
    GOHashtagsAverage: [],
    GOHashtagsTotal: tagName.startsWith('#') ? [tagName] : [],
    GOMentionsCount: [],
    GOMentionsAverage: [],
    GOMentionsTotal: tagName.startsWith('@') ? [tagName] : [],
    GOChecklistRefNote: "",
  }
}
