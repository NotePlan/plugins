// @flow

import type { TDashboardSettings } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { getFoldersMatching } from '@helpers/folders'
import { logDebug } from '@helpers/dev'

/**
 * Get all folders that are allowed in the current settings/Perspective.
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
