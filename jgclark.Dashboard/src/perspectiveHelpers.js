// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions for Perspectives
// Last updated 2024-08-03 for v2.1.0.a3 by @jgclark
//-----------------------------------------------------------------------------

import { dashboardSettingDefs, perspectiveSettingDefaults } from "./dashboardSettings.js"
import { getDashboardSettings } from "./dashboardHelpers.js"
import type { TDashboardSettings, TPerspectiveDef } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getFoldersMatching } from '@helpers/folders'
import { chooseOption, getInputTrimmed } from '@helpers/userInput'

// TODO: change to save all settings in separate data structure

// TODO: update to DBW suggestion:
// e.g. perspectiveSettings[“Home”] rather than a flat array

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
  const allDefs = dashboardSettings.perspectives ?? perspectiveSettingDefaults
  if (!allDefs) {
    logWarn('getCurrentPerspectiveDef', `No perspectives defined, AND couldn't find defaults.`)
    clo(perspectiveSettingDefaults, `perspectiveSettingDefaults:`)
    return false
  }
  clo(allDefs, `getCurrentPerspectiveDef: allDefs =`)
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
 * Get named Perspective definition
 * @param {string} name to find
 * @param {TDashboardSettings} dashboardSettings
 * @returns {TPerspectiveDef | false}
 */
export function getPerspectiveNamed(name: string, dashboardSettings: TDashboardSettings): TPerspectiveDef | false {
  return dashboardSettings.perspectives.find(s => s.name === name) ?? false
}

/**
 * Add new Perspective using current settings
 * TEST: live
 * TEST: from param: noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=Add%20new%20Perspective&arg0=Home
 * TODO: shift to using new data structure
 */
export async function addNewPerspective(nameIn: string = ''): Promise<void> {
  try {
    logDebug('addNewPerspective', `Starting with ${nameIn} para`)
    const dashboardSettings = (await getDashboardSettings()) || {}

    // Get name of new Perspective
    const res = await getInputTrimmed('Please give the name of the new Perspective', 'OK', 'New Perspective', '')
    if (!res) {
      logInfo('deletePerspective', `User cancelled operation.`)
      return
    }
    // Find out how many Perspective definitions we already have
    const existingDefs = dashboardSettings.perspectives
    const newPerspectiveObject: TPerspectiveDef = {
      key: `persp${String(existingDefs.length)}`, // TODO: remove in time
      // $FlowIgnore[incompatible-type]
      name: res,
      includedFolders: dashboardSettings.includeFolders,
      excludedFolders: dashboardSettings.ignoreFolders,
      includedTags: '', // not implemented yet
      excludedTags: '', // not implemented yet
    }
    dashboardSettings.perspectives.push(newPerspectiveObject)
    // TODO: HELP: How to get this persisted?
  } catch (error) {
    logError('addNewPerspective', error.message)
  }
}

/**
 * Delete a Perspective definition from dashboardSettings.
 * @param {string} nameIn
 * TEST: live
 * TEST: from param: noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=Delete%20Perspective&arg0=Home
 * TODO: neither actually changing anything
 */
export async function deletePerspective(nameIn: string = ''): Promise<void> {
  try {
    let nameToUse = ''
    const dashboardSettings = (await getDashboardSettings()) || {}
    const allDefs = dashboardSettings.perspectives ?? dashboardSettingDefs.find((dsd) => dsd.key === 'perspectives')
    if (allDefs.length === 0) {
      throw new Error(`No perspective settings found. Stopping.`)
    }
    logDebug('deletePerspective', `Starting with ${allDefs.length} perspectives and param '${nameIn}'`)

    if (nameIn !== '' && getPerspectiveNamed(nameIn, dashboardSettings)) {
      nameToUse = nameIn
      logDebug('deletePerspective', `Will delete perspective '${nameToUse}' passed as parameter`)
    } else {
      logDebug('deletePerspective', `Asking user to pick perspective to delete`)
      const options = allDefs.map((p) => {
        return { label: p.name, value: p.name }
      })
      const res = await chooseOption('Please pick the Perspective to delete', options)
      if (!res) {
        logInfo('deletePerspective', `User cancelled operation.`)
        return
      }
      nameToUse = String(res)
      logDebug('deletePerspective', `Will delete perspective '${nameToUse}' selected by user`)
    }
    // delete this Def from the perspectives
    // delete dashboardSettings.perspectives[nameToUse]
    const perspectivesWithoutOne = allDefs.filter(obj => obj.name !== nameToUse)
    dashboardSettings.perspectives = perspectivesWithoutOne
    logDebug('deletePerspective', `Finished with ${dashboardSettings.perspectives.length} perspectives remaining`)
    // TODO: HELP: How to get this change persisted?
  } catch (error) {
    logError('deletePerspective', error.message)
  }
}

/**
 * Get list of all Perspective names
 * @param {TDashboardSettings} dashboardSettings
 * @param {boolean} includeEmptyOption?
 * @returns {Array<string>}
 */
export function getListOfPerspectiveNames(
  dashboardSettings: TDashboardSettings,
  includeEmptyOption: boolean,
): Array<string> {
  const options: Array<string> = [] // ['Home', 'Work'] // FIXME:
  // Get all perspective names
  const allDefs = dashboardSettings.perspectives ?? perspectiveSettingDefaults
  if (allDefs.length === 0) {
    throw new Error(`No existing Perspective settings found. Stopping.`)
  }
  for (const def of allDefs) {
    options.push(def.name)
  }
  if (includeEmptyOption) {
    options.unshift("-")
  }
  logDebug('getListOfPerspectiveNames ->', String(options))
  return options
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
 * @param {boolean} allowAllCalendarNotes (optional, defaults to true)
 * @returns {boolean}
 */
export function isFilenameAllowedInFolderList(
  filename: string,
  folderList: Array<string>,
): boolean {
  // Is filename in folderList?
  const matchFound = folderList.some((f) => filename.includes(f))
  logDebug('isFilenameIn...FolderList', `- ${matchFound ? 'match' : 'NO match'} to ${filename} from ${String(folderList.length)} folders`)
  return matchFound
}

/**
 * Is the filename from the given list of folders?
 * @param {TNote} note
 * @param {Array<string>} folderList
 * @param {boolean} allowAllCalendarNotes (optional, defaults to true)
 * @returns {boolean}
 */
export function isNoteInAllowedFolderList(
  note: TNote,
  folderList: Array<string>,
  allowAllCalendarNotes: boolean = true,
): boolean {
  // Is note a Calendar note or is in folderList?
  const matchFound = (allowAllCalendarNotes && note.type === 'Calendar') || folderList.some((f) => note.filename.includes(f))
  // logDebug('isFilenameIn...FolderList', `- ${matchFound ? 'match' : 'NO match'} to ${note.filename} from ${String(folderList.length)} folders`)
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
