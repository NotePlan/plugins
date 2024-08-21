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
}/**
 * Is the filename from the given list of folders?
 * @param {string} filename
 * @param {Array<string>} folderList
 * @param {boolean} allowAllCalendarNotes (optional, defaults to true)
 * @returns {boolean}
 */

export function isFilenameAllowedInFolderList(
  filename: string,
  folderList: Array<string>
): boolean {
  // Is filename in folderList?
  const matchFound = folderList.some((f) => filename.includes(f))
  // logDebug('isFilenameIn...FolderList', `- ${matchFound ? 'match' : 'NO match'} to ${filename} from ${String(folderList.length)} folders`)
  return matchFound
}

