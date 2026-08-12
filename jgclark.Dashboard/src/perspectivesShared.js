// @flow
//-----------------------------------------------------------------------------
// Shared perspective-related utilities
// This file is reserved for shared perspective functions that don't belong
// in perspectiveHelpers.js (to avoid circular dependency).
//-----------------------------------------------------------------------------

import type { TDashboardSettings } from './types'
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
