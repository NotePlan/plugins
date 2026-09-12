// @flow
//-----------------------------------------------------------------------------
// Dashboard wrappers around the Shared tag/mention cache (np.Shared).
// last updated 2026-09-12 for v2.4.3 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import type { TPerspectiveDef } from './types'
import { WEBVIEW_WINDOW_ID } from './constants'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { logDebug } from '@helpers/dev'
import { sendBannerMessage } from '@helpers/HTMLView'
import {
  addTagMentionCacheDefinitions as addTagMentionCacheDefinitionsShared,
  generateTagMentionCache as generateTagMentionCacheShared,
  registerTagMentionCacheItems,
} from '../../np.Shared/src/tagMentionCache'

export {
  WANTED_PARA_TYPES,
  addTagMentionCacheItemsForPlugin,
  buildTagMentionLookupContext,
  getCacheItemsFromNote,
  getFilenamesOfNotesWithTagOrMentions,
  getRegularNoteFilenamesFromTagMentionCache,
  getTagMentionCacheDefinitions,
  getTagMentionCacheDiagnosticsLines,
  getTagMentionCacheRegistrations,
  getUnionOfTagMentionCacheRegistrations,
  getWantedTagOrMentionListFromNote,
  isTagMentionCacheAvailable,
  isTagMentionCacheAvailableForItem,
  isTagMentionCacheGenerationScheduled,
  isWantedItem,
  isWantedMention,
  noteMayContainCacheItems,
  parseTagMentionCacheRegistrationsJson,
  parseTagMentionCacheTimestamp,
  pruneTagMentionCacheToUnion,
  registerTagMentionCacheItems,
  scheduleTagMentionCacheGeneration,
  scheduleTagMentionCacheGenerationIfTooOld,
  serializeTagMentionCacheTimestamp,
  trimMentionSuffix,
  unregisterTagMentionCacheItems,
  updateTagMentionCache,
  updateTagMentionCacheIfTooOld,
} from '../../np.Shared/src/tagMentionCache'
export type { TTagMentionCacheProgress, TTagMentionCacheRegistrations, TagMentionLookupContext } from '../../np.Shared/src/tagMentionCache'

const DASHBOARD_PLUGIN_ID = 'jgclark.Dashboard'

/**
 * Dashboard-compat: add items to the Dashboard registration slot only.
 * @param {Array<string>} mentionOrTagsIn
 * @returns {void}
 */
export function addTagMentionCacheDefinitions(mentionOrTagsIn: Array<string>): void {
  addTagMentionCacheDefinitionsShared(mentionOrTagsIn)
}

/**
 * Dashboard-compat: replace the Dashboard registration slot only (other plugins are kept).
 * @param {Array<string>} wantedItems
 * @returns {void}
 */
export function setTagMentionCacheDefinitions(wantedItems: Array<string>): void {
  registerTagMentionCacheItems(DASHBOARD_PLUGIN_ID, wantedItems)
}

/**
 * Register the union of every saved perspective's tagsToShow as Dashboard's slot.
 * Does not touch other plugins' registrations.
 * @param {Array<TPerspectiveDef>} allPerspectiveDefs
 * @returns {void}
 */
export function updateTagMentionCacheDefinitionsFromAllPerspectives(allPerspectiveDefs: Array<TPerspectiveDef>): void {
  const updatedWantedItems = getListOfWantedTagsAndMentionsFromAllPerspectives(allPerspectiveDefs)
  registerTagMentionCacheItems(DASHBOARD_PLUGIN_ID, updatedWantedItems)
}

/**
 * Generate the tag/mention cache, showing Dashboard banners while it runs.
 * @param {string} generationReason
 * @param {boolean} forceRebuild
 * @returns {Promise<void>}
 */
export async function generateTagMentionCache(
  generationReason: string = 'Triggered by external call',
  forceRebuild: boolean = true,
): Promise<void> {
  await generateTagMentionCacheShared(generationReason, forceRebuild, {
    onProgress: async (message: string) => {
      await sendBannerMessage(WEBVIEW_WINDOW_ID, message, 'INFO')
    },
    onComplete: async (message: string) => {
      await sendBannerMessage(WEBVIEW_WINDOW_ID, message, 'INFO', 5000)
    },
    onError: async (message: string) => {
      await sendBannerMessage(WEBVIEW_WINDOW_ID, message, 'ERROR', 5000)
    },
    onRemoveProgress: async () => {
      await sendBannerMessage(WEBVIEW_WINDOW_ID, '', 'REMOVE')
    },
  })
}

/**
 * Get the list of wanted tags and mentions from all perspectives.
 * Note: kept here (not Shared) to avoid a Shared -> Dashboard types dependency.
 * @param {Array<TPerspectiveDef>} allPerspectives
 * @returns {Array<string>}
 */
export function getListOfWantedTagsAndMentionsFromAllPerspectives(allPerspectives: Array<TPerspectiveDef>): Array<string> {
  const wantedItems: Set<string> = new Set()
  for (const perspective of allPerspectives) {
    logDebug('getListOfWantedTagsAndMentionsFromAllPerspectives', `- reading perspective: [${String(perspective.name)}]`)
    const tagsAndMentionsStr = perspective.dashboardSettings.tagsToShow ?? ''
    const tagsAndMentionsArr = stringListOrArrayToArray(tagsAndMentionsStr, ',')
    tagsAndMentionsArr.forEach((torm) => {
      wantedItems.add(torm.trim())
    })
  }
  logDebug('getListOfWantedTagsAndMentionsFromAllPerspectives', `=> wantedItems: ${String(Array.from(wantedItems))}`)
  return Array.from(wantedItems)
}
