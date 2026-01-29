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
 * Note: this almost a dupe of perspectiveHelpers::getAllowedFoldersInCurrentPerspective()
 * TODO: Probably could be refactored into a single function that accepts an array of perspective definitions or a TDashboardSettings object. Tried 23.1.2026 and it set up a circular dependency again.
 * @param {TDashboardSettings} dashboardSettings
 * @returns
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
