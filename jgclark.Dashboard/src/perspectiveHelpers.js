// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions for Perspectives
// Last updated 2024-08-01 for v2.1.0.a3 by @jgclark
//-----------------------------------------------------------------------------

import { dashboardSettingDefs } from "./dashboardSettings.js"
import type { TDashboardSettings, TPerspectiveDef } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { getFoldersMatching } from '@helpers/folders'

/**
 * Get active Perspective definition
 * @param {TDashboardSettings} dashboardSettings
 * @returns {TPerspectiveDef | false}
 */
export function getCurrentPerspectiveDef(
  dashboardSettings: TDashboardSettings
): TPerspectiveDef | false {
  const activePerspectiveName = dashboardSettings.activePerspectiveName ?? ''
  if (!activePerspectiveName) {
    logDebug('getCurrentPerspectiveDef', `No active perspective`)
    return false
  }
  // Get relevant perspectiveDef
  const allDefs = dashboardSettings.perspectives ?? dashboardSettingDefs.find((dsd) => dsd.key === 'perspectives')
  const activeDef: TPerspectiveDef | null = allDefs.find((d) => d.name === activePerspectiveName) ?? null
  if (!activeDef) {
    logWarn('getCurrentPerspectiveDef', `Could not find definition for perspective '${activePerspectiveName}'.`)
    return false
  } else {
    clo(activeDef, `Active perspective '${activePerspectiveName}':`)
    return activeDef
  }
}

/**
 * Get all folders that are allowed in the current Perspective.
 * @param {TDashboardSettings} dashboardSettings 
 * @returns 
 */
export function getAllowedFoldersInCurrentPerspective(
  dashboardSettings: TDashboardSettings
): Array<string> {
  if (dashboardSettings.activePerspectiveName === '') {
    logWarn('getAllowedFoldersInCurrentPerspective', `No active Perspective, so returning empty list.`)
    return []
  }
  const activeDef = getCurrentPerspectiveDef(dashboardSettings)
  if (!activeDef) {
    logWarn('getAllowedFoldersInCurrentPerspective', `Could not get active Perspective definition. Stopping.`)
    return []
  }
  // Note: can't use simple .split(',') as it does unexpected things with empty strings. 
  // Note: also needed to check that whitespace is trimmed.
  const includedFolderArr = stringListOrArrayToArray(activeDef.includedFolders, ',')
  const excludedFolderArr = stringListOrArrayToArray(activeDef.excludedFolders, ',')
  const folderListToUse = getFoldersMatching(includedFolderArr, true, excludedFolderArr)
  return folderListToUse
}

/**
 * Is the filename from the given list of folders?
 * @param {string} filename
 * @param {Array<string>} folderList
 * @returns {boolean}
 */
export function isFilenameAllowedInFolderList(filename: string, folderList: Array<string>): boolean {
  // Is filename in folderList?
  const matchFound = folderList.some((f) => filename.includes(f))
  logDebug('isFilenameIn...FolderList', `- ${matchFound ? 'match' : 'NO match'} to ${filename} from ${String(folderList.length)} folders`)
  return matchFound
}

/**
 * Test to see if the current filename is in a folder that is allowed in the current Perspective definition
 * @param {string} filename 
 * @param {TDashboardSettings} dashboardSettings 
 * @returns {boolean}
 */
export function isFilenameAllowedInCurrentPerspective(
  filename: string,
  dashboardSettings: TDashboardSettings
): boolean {
  const activeDef = getCurrentPerspectiveDef(dashboardSettings)
  if (!activeDef) {
    logError('isFilenameIn...CurrentPerspective', `Could not get active Perspective definition. Stopping.`)
    return false
  }
  // Note: can't use simple .split(',') as it does unexpected things with empty strings
  const includedFolderArr = stringListOrArrayToArray(activeDef.includedFolders, ',')
  const excludedFolderArr = stringListOrArrayToArray(activeDef.excludedFolders, ',')
  // logDebug('isFilenameIn...CurrentPerspective', `using ${String(includedFolderArr.length)} inclusions [${includedFolderArr.toString()}] and ${String(excludedFolderArr.length)} exclusions [${excludedFolderArr.toString()}]`)
  const folderListToUse = getFoldersMatching(includedFolderArr, true, excludedFolderArr)

  const matchFound = folderListToUse.some((f) => filename.includes(f))
  logDebug('isFilenameIn...CurrentPerspective', `- Did ${matchFound ? 'find ' : 'NOT find'} matching folders amongst ${String(folderListToUse)}`)
  return matchFound
}

/**
 * Test to see if the current line contents is allowed in the current Perspective definition, by whether it has a disallowed tag/mention
 * @param {string} content
 * @param {TDashboardSettings} dashboardSettings 
 * @returns {boolean}
 */
export function isTagAllowedInCurrentPerspective(
  content: string,
  dashboardSettings: TDashboardSettings
): boolean {
  const activeDef = getCurrentPerspectiveDef(dashboardSettings)
  if (!activeDef) {
    logError('isTag...CurrentPerspective', `Could not get active Perspective definition. Stopping.`)
    return false
  }
  // Note: can't use simple .split(',') as it does unexpected things with empty strings
  const includedTagArr = stringListOrArrayToArray(activeDef.includedTags, ',')
  const excludedTagArr = stringListOrArrayToArray(activeDef.excludedTags, ',')
  // logDebug('isTag...CurrentPerspective', `using ${String(includedTagArr.length)} inclusions [${includedFolderArr.toString()}] and ${String(excludedTagArr.length)} exclusions [${excludedTagArr.toString()}]`)

  const matchFound = includedTagArr.some((t) => content.includes(t)) && !excludedTagArr.some((t) => content.includes(t))
  logDebug('isTag...CurrentPerspective', `- Did ${matchFound ? 'find ' : 'NOT find'} matching folders amongst '${String(content)}'`)
  return matchFound
}
