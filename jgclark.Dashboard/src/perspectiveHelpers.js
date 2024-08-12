// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions for Perspectives
// Last updated 2024-08-09 for v2.1.0.a6 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getDashboardSettings } from "./dashboardHelpers.js"
import { refreshDashboardData } from './reactMain'
import { parseSettings } from './shared'
import type { TDashboardSettings, TPerspectiveDef } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getFoldersMatching } from '@helpers/folders'
import { chooseOption, getInputTrimmed } from '@helpers/userInput'

// Note: DBW originally suggested:
// e.g. perspectiveSettings[“Home”] rather than a flat array

//-----------------------------------------------------------------------------

const pluginID = pluginJson['plugin.id']

export const perspectiveSettingDefaults: Array<TPerspectiveDef> = [
  // $FlowFixMe[prop-missing] rest specified later
  {
    name: "Home",
    isActive: false,
    // $FlowFixMe[prop-missing]
    dashboardSettings: {
      includedFolders: "Home, NotePlan",
      excludedFolders: "Readwise 📚, Saved Searches",
      ignoreItemsWithTerms: "#test, @church",
    }
  },
  // $FlowFixMe[prop-missing] rest specified later
  {
    name: "Work",
    isActive: false,
    // $FlowFixMe[prop-missing] rest specified later
    dashboardSettings: {
      includedFolders: "Work, CCC, Ministry",
      excludedFolders: "Readwise 📚, Saved Searches",
      ignoreItemsWithTerms: "#test, @home",
    }
  }
]

//-----------------------------------------------------------------------------

/**
 * Add a new Perspective setting, through asking user.
 * Note: Just a limited subset for now, during debugging.
 * TODO: Extend to allow x-callback
 */
export async function addNewPerspective(/* nameIn: string, makeActiveIn: boolean, dashboardSettingsIn?: TDashboardSettings */): Promise<void> {
  const allDefs = await getPerspectiveSettings()
  logDebug('addPerspectiveSetting', `Found ${allDefs.length} existing Perspective settings ...`)

  // Get user input
  const name = await getInputTrimmed('Enter name of new Perspective:', 'OK', 'Add Perspective', 'Test')
  if (typeof name === 'boolean') {
    logWarn('addPerspectiveSetting', `Cancelled adding new Perspective`)
    return
  }
  const includedFolders = await getInputTrimmed('Enter list of folders to include (comma-separated):', 'OK', 'Add Perspective', 'TEST')
  if (typeof includedFolders === 'boolean') {
    logWarn('addPerspectiveSetting', `Cancelled adding new Perspective`)
    return
  }
  const excludedFolders = await getInputTrimmed('Enter list of folders to exclude (comma-separated):', 'OK', 'Add Perspective', 'Work, Home, CCC, Ministry')
  if (typeof excludedFolders === 'boolean') {
    logWarn('addPerspectiveSetting', `Cancelled adding new Perspective`)
    return
  }
  const newDef: TPerspectiveDef = {
    name: name,
    isActive: true, // make it active straight away
    // $FlowFixMe[prop-missing] gets set later
    dashboardSettings: {
      includedFolders: includedFolders || "",
      excludedFolders: excludedFolders || "",
    }
  }

  // TODO: Persist this!
  allDefs.push(newDef)
  DataStore.settings.perspectiveSettings = allDefs
  clo(newDef, `... added perspectve #${String(allDefs.length)}:`) // ✅

  refreshDashboardData() // FIXME: but nothing happens on front end, and new perspective doesn't show up
}

/**
 * Delete all Perspective settings
 */
// eslint-disable-next-line require-await
export async function deletePerspectiveSettings(): Promise<void> {
  logDebug('deletePerspectiveSettings', `Attempting to delete all Perspective settings ...`)
  const pluginSettings = DataStore.settings
  pluginSettings.perspectiveSettings = "[]"
  clo(pluginSettings.perspectiveSettings, `... leaves: pluginSettings.perspectiveSettings =`)
  DataStore.settings = pluginSettings
}

/**
 * Get all perspective settings (as array of TPerspectiveDef)
 * @returns {Array<TPerspectiveDef>} all perspective settings
 */
export async function getPerspectiveSettings(): Promise<Array<TPerspectiveDef>> {
  try {
    logDebug('getPerspectiveSettings', `Attempting to get Perspective settings ...`)
    // Note: Copied from above.
    // Note: We think following (newer API call) is unreliable.
    let pluginSettings = DataStore.settings
    let perspectiveSettingsStr: string = pluginSettings?.perspectiveSettings
    let perspectiveSettings: Array<TPerspectiveDef>
    if (!perspectiveSettingsStr) {
      clo(pluginSettings, `getPerspectiveSettings (newer API): DataStore.settings?.perspectiveSettings not found. Here's the full settings for ${pluginID} plugin: `)

      // Fall back to the older way:
      pluginSettings = await DataStore.loadJSON(`../${pluginID}/settings.json`)
      clo(pluginSettings, `getPerspectiveSettings (older lookup): pluginSettings loaded from settings.json`)
      perspectiveSettingsStr = pluginSettings?.perspectiveSettings
    }
    if (!perspectiveSettingsStr) {
      // Will need to set from the defaults
      logDebug('getPerspectiveSettings', `None found: will use the defaults`)
      perspectiveSettings = perspectiveSettingDefaults
      perspectiveSettingsStr = JSON.stringify(perspectiveSettings) ?? "" // must stringify it because it is JS ARRAY and needs to be stored as string
      pluginSettings.perspectiveSettings = perspectiveSettingsStr
      DataStore.settings = pluginSettings
    }
    // clo(pluginSettings, `getPerspectiveSettings: pluginSettings =`)
    return parseSettings(perspectiveSettingsStr) // must parse it because it is stringified JSON (an array of TPerspectiveDef)
  } catch (error) {
    logError('getPerspectiveSettings', `Error: ${error.message}`)
    return []
  }
}

/**
 * WARNING: not yet working, and not yet called. Aim is to migrate this aspect of WebView into the backend.
 * Initialise Perspective settings when Dashboard starts up
 * Note: used to be handled in WebView
 */
export async function initialisePerpsectiveSettings(): Promise<void> {
  const pluginSettings = DataStore.settings
  const currentDashboardSettings = await getDashboardSettings()
}

/**
 * Get active Perspective definition
 * @param {string} activePerspectiveName
 * @param {TDashboardSettings} perspectiveSettings
 * @returns {TPerspectiveDef | false}
 */
export function getActivePerspectiveDef(
  dashboardSettings: TDashboardSettings,
  perspectiveSettings: Array<TPerspectiveDef>
): TPerspectiveDef | false {
  const activePerspectiveName = dashboardSettings.activePerspectiveName
  if (!activePerspectiveName) {
    logWarn('getActivePerspectiveDef', `No active perspective name passed. Returning false.`)
    return false
  }
  // Get relevant perspectiveDef
  const allDefs = perspectiveSettings ?? []
  if (!allDefs) {
    logWarn('getActivePerspectiveDef', `No perspectives defined.`)
    return false
  }
  clo(allDefs, `getActivePerspectiveDef: allDefs =`)
  const activeDef: TPerspectiveDef | null = allDefs.find((d) => d.name === activePerspectiveName) ?? null
  if (!activeDef) {
    logWarn('getActivePerspectiveDef', `Could not find definition for perspective '${activePerspectiveName}'.`)
    return false
  } else {
    clo(activeDef, `Active perspective '${activePerspectiveName}':`)
    return activeDef
  }
}

/**
 * Get named Perspective definition
 * @param {string} name to find
 * @param {TDashboardSettings} perspectiveSettings
 * @returns {TPerspectiveDef | false}
 */
export function getPerspectiveNamed(name: string, perspectiveSettings: Array<TPerspectiveDef>): TPerspectiveDef | null {
  return perspectiveSettings.find(s => s.name === name) ?? null
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
    const existingDefs = (await getPerspectiveSettings()) || []
    if (existingDefs.length === 0) {
      throw new Error(`No perspective settings found. Stopping.`)
    }
    logDebug('deletePerspective', `Starting with ${existingDefs.length} perspectives and param '${nameIn}'`)

    if (nameIn !== '' && getPerspectiveNamed(nameIn, existingDefs)) {
      nameToUse = nameIn
      logDebug('deletePerspective', `Will delete perspective '${nameToUse}' passed as parameter`)
    } else {
      logDebug('deletePerspective', `Asking user to pick perspective to delete`)
      const options = existingDefs.map((p) => {
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

    // if this is the active perspective, then unset the activePerspectiveName
    if (nameToUse === dashboardSettings.activePerspectiveName) {
      dashboardSettings.activePerspectiveName = ''
    }

    // delete this Def from the list of Perspective Defs
    const perspectivesWithoutOne = existingDefs.filter(obj => obj.name !== nameToUse)
    logDebug('deletePerspective', `Finished with ${String(perspectivesWithoutOne.length)} perspectives remaining`)
    // TODO: HELP: How to get this change persisted?

  } catch (error) {
    logError('deletePerspective', error.message)
  }
}

/**
 * Get list of all Perspective names
 * @param {Array<TPerspectiveDef>} allDefs
 * @param {boolean} includeEmptyOption?
 * @returns {Array<string>}
 */
export function getListOfPerspectiveNames(
  allDefs: Array<TPerspectiveDef>,
  includeEmptyOption: boolean,
): Array<string> {
  try {
    const options: Array<string> = [] // ['Home', 'Work']
  // Get all perspective names
    if (!allDefs || allDefs.length === 0) {
      throw new Error(`No existing Perspective settings found.`)
    }
    for (const def of allDefs) {
      options.push(def.name)
    }
    if (includeEmptyOption) {
      options.unshift("-")
    }
    logDebug('getListOfPerspectiveNames ->', String(options))
    return options
  } catch (err) {
    logError('getListOfPerspectiveNames', err.message)
    return ['-']
  }
}

/**
 * Get all folders that are allowed in the current Perspective.
 * @param {string} activePerspectiveName 
 * @param {Array<TPerspectiveDef>} perspectiveSettings 
 * @returns 
 */
export function getAllowedFoldersInCurrentPerspective(
  dashboardSettings: TDashboardSettings,
  perspectiveSettings: Array<TPerspectiveDef>
): Array<string> {
  if (dashboardSettings.activePerspectiveName === '') {
    logWarn('getAllowedFoldersInCurrentPerspective', `No active Perspective, so returning empty list.`)
    return []
  }
  const activeDef = getActivePerspectiveDef(dashboardSettings, perspectiveSettings)
  if (!activeDef) {
    logWarn('getAllowedFoldersInCurrentPerspective', `Could not get active Perspective definition. Stopping.`)
    return []
  }
  // Note: can't use simple .split(',') as it does unexpected things with empty strings. 
  // Note: also needed to check that whitespace is trimmed.
  const includedFolderArr = stringListOrArrayToArray(activeDef.dashboardSettings.includedFolders ?? '', ',')
  const excludedFolderArr = stringListOrArrayToArray(activeDef.dashboardSettings.excludedFolders ?? '', ',')
  const folderListToUse = getFoldersMatching(includedFolderArr, true, excludedFolderArr)
  return folderListToUse
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
 * Note: NOT CURRENTLY USED
 * Test to see if the current filename is in a folder that is allowed in the current Perspective definition
 * @param {string} filename 
 * @param {TDashboardSettings} dashboardSettings 
 * @returns {boolean}
 */
// export function isFilenameAllowedInCurrentPerspective(
//   filename: string,
//   dashboardSettings: TDashboardSettings
// ): boolean {
//   const activeDef = getActivePerspectiveDef(dashboardSettings)
//   if (!activeDef) {
//     logError('isFilenameIn...CurrentPerspective', `Could not get active Perspective definition. Stopping.`)
//     return false
//   }
//   // Note: can't use simple .split(',') as it does unexpected things with empty strings
//   const includedFolderArr = stringListOrArrayToArray(activeDef.includedFolders, ',')
//   const excludedFolderArr = stringListOrArrayToArray(activeDef.excludedFolders, ',')
//   // logDebug('isFilenameIn...CurrentPerspective', `using ${String(includedFolderArr.length)} inclusions [${includedFolderArr.toString()}] and ${String(excludedFolderArr.length)} exclusions [${excludedFolderArr.toString()}]`)
//   const folderListToUse = getFoldersMatching(includedFolderArr, true, excludedFolderArr)

//   const matchFound = folderListToUse.some((f) => filename.includes(f))
//   logDebug('isFilenameIn...CurrentPerspective', `- Did ${matchFound ? 'find ' : 'NOT find'} matching folders amongst ${String(folderListToUse)}`)
//   return matchFound
// }

/**
 * Test to see if the current line contents is allowed in the current settings/Perspective, by whether it has a disallowed terms (word/tag/mention)
 * @param {string} lineContent
 * @param {string} ignoreItemsWithTerms
 * @returns {boolean} true if disallowed
 */
export function isLineDisallowedByExcludedTerms(
  lineContent: string,
  ignoreItemsWithTerms: string,
): boolean {
  // Note: can't use simple .split(',') as it does unexpected things with empty strings
  const excludedTagArr = stringListOrArrayToArray(ignoreItemsWithTerms, ',')
  // logDebug('isLineDisallowedByExcludedTerms', `using ${String(includedTagArr.length)} inclusions [${includedFolderArr.toString()}] and ${String(excludedTagArr.length)} exclusions [${excludedTagArr.toString()}]`)

  const matchFound = excludedTagArr.some((t) => lineContent.includes(t))
  logDebug('isLineDisallowedByExcludedTerms', `- Did ${matchFound ? 'find ' : 'NOT find'} matching term(s) amongst '${String(lineContent)}'`)
  return matchFound
}
