// @flow
//-----------------------------------------------------------------------------
// Shared perspective-related utilities
// This file is reserved for shared perspective functions that don't belong
// in perspectiveHelpers.js (to avoid circular dependency).
// Last updated 2026-09-10 for v2.5.0.b4 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import type { TDashboardSettings, TPerspectiveDef } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { getFoldersMatching } from '@helpers/folders'
import { logDebug } from '@helpers/dev'

/**
 * Get all folders that are allowed in the current settings/Perspective.
 * Takes live TDashboardSettings (includedFolders / excludedFolders already resolved for the active view).
 * Kept separate from perspectiveHelpers::getAllowedFoldersInCurrentPerspective() (which takes perspective defs
 * and reads the active def) to avoid a circular dependency between those modules -- do not merge.
 * @param {TDashboardSettings} dashboardSettings
 * @returns {Array<string>}
 */
export function getCurrentlyAllowedFolders(
  dashboardSettings: TDashboardSettings
): Array<string> {
  // Note: can't use simple .split(',') as it does unexpected things with empty strings. 
  // Note: also needed to check that whitespace is trimmed.
  const includedFolderArr = stringListOrArrayToArray(dashboardSettings.includedFolders ?? '', ',')
  const excludedFolderArr = stringListOrArrayToArray(dashboardSettings.excludedFolders ?? '', ',')
  const folderListToUse = getFoldersMatching(includedFolderArr, true, excludedFolderArr)
  return folderListToUse
}

/**
 * Sync read of the active Perspective name from DataStore.settings (or '-' if none).
 * Kept here so dashboardHelpers can call it without importing perspectiveHelpers (circular dependency).
 * @returns {string}
 */
export function getActivePerspectiveNameSync(): string {
  try {
    const raw = DataStore.settings?.perspectiveSettings
    if (raw == null) return '-'
    const defs: Array<TPerspectiveDef> = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(defs)) return '-'
    const active = defs.find((p) => p && p.isActive === true)
    return active && typeof active.name === 'string' && active.name !== '' ? active.name : '-'
  } catch (error) {
    logDebug('getActivePerspectiveNameSync', `Failed to read active perspective: ${error.message}`)
    return '-'
  }
}
