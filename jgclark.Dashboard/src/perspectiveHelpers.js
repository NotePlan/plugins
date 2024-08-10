// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions for Perspectives
// Last updated 2024-08-07 for v2.1.0.a5 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getDashboardSettings } from "./dashboardHelpers.js"
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
 * Delete all Perspective settings
 */
// eslint-disable-next-line require-await
export async function deletePerspectiveSettings(): Promise<void> {
  logDebug('deletePerspectiveSettings', `Attempting to delete all Perspective settings ...`)
  const pluginSettings = DataStore.settings
  delete pluginSettings.perspectiveSettings
  clo(pluginSettings.perspectiveSettings, `... leaves: pluginSettings.perspectiveSettings =`)
}

/**
 * Get all perspective settings (as array of TPerspectiveDef)
 * @returns {Array<TPerspectiveDef>} all perspective settings
 */
export async function getPerspectiveSettings(): Promise<Array<TPerspectiveDef>> {
  logDebug('getPerspectiveSettings', `Attempting to get Perspective settings ...`)
  // Note: Copied from above.
  // Note: We think following (newer API call) is unreliable.
  let pluginSettings = DataStore.settings
  let perspectiveSettingsStr = pluginSettings?.perspectiveSettings
  let perspectiveSettings 
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
    perspectiveSettingsStr = JSON.stringify(perspectiveSettings) // must stringify it because it is JS ARRAY and needs to be stored as string
    pluginSettings.perspectiveSettings = perspectiveSettingsStr 
    DataStore.settings = pluginSettings
  }
  clo(pluginSettings, `getPerspectiveSettings: pluginSettings =`)
  return parseSettings(perspectiveSettingsStr) // must parse it because it is stringified JSON (an array of TPerspectiveDef)
}

/**
 * WARNING: not yet working, and not yet called
 * Initialise Perspective settings when Dashboard starts up
 * Note: used to be handled in WebView
 */
export async function initialisePerpsectiveSettings(): Promise<void> {
  const pluginSettings = DataStore.settings
  const currentDashboardSettings = await getDashboardSettings()
  // set up perspectiveSettings state using defaults as the base and then overriding with any values from the plugin saved settings
  const pSettings = pluginSettings.perspectiveSettings || {} // FIXME: @jgclark: this won't work because pluginSettings.perspectiveSettings is a string, not an object and needs parsing
  // FIXME: @jgclark: shouldn't it just call the function getPerspectiveSettings() on that line?
  logInfo('initialisePerpsectiveSettings', `found ${String(pSettings.length)} pSettings: ${JSON.stringify(pSettings, null, 2)}`)

  // TODO: P version of these:
  // const pSettingsItems = createDashboardSettingsItems(pSettings)
  // FIXME: @jgclark: i am not sure what this is supposed to do and where it will be called
  // I'm not understanding the intents, so it's hard for me to suggest a fix. Can you provide more documentation on what this is supposed to do?
  // FIXME: @jgclark: The code below seems to want to create a map of perspectives and for each perspective, we are going to merge the dashboardSettings with the currentDashboardSettings
  // I don't understand why we are doing this. Can you provide more context?
  // I am concerned that we might be mixing objects and arrays (remember that you wanted perspectives to be an array of objects) -- keep an eye on that
  const pSettingDefaults = perspectiveSettingDefaults.map(
    psd => ({
      ...psd,
      // FIXME: @jgclark said: this doesn't merge as expected, but adds a new layer called dashboardSettingsOrDefaults, which in turn includes perspectives
      // FIXME: @jgclark: this seems backwards to me. I would expect the psd settings to come 2nd so that they override the currentDashboardSettings
      // as written, the current dashboard settings will override whatever you have in perspectives/dashboardSettings in each perspective
      dashboardSettings: { ...psd.dashboardSettings, ...currentDashboardSettings } // so I would reverse these two
      // But again, I'm not sure what the intent is here and why we would be adding every dashboard setting to every perspective whether it is used or not
    })
  )
  logInfo('initialisePerpsectiveSettings', `found ${String(pSettingDefaults.length)} pSettingDefaults: ${JSON.stringify(pSettingDefaults, null, 2)}`)

  // FIXME: So now what is this doing? seems to me like it's undoing some of the work we just did
  const perspectiveSettingsOrDefaults = {
    ...pSettingDefaults, ...pSettings, lastChange: `initialisePerpsectiveSettings`
  }
  logInfo('initialisePerpsectiveSettings', `perspectiveSettingsOrDefaults: ${JSON.stringify(perspectiveSettingsOrDefaults, null, 2)}`)
  // FIXME: and i don't understand the following line at all because as far as I know this variable does not exist in pluginSettings and so how could you parse it?
  const outputObj = parseSettings(pluginSettings.perspectiveSettingsOrDefaults)
  pluginSettings.perspectiveSettings = outputObj
  clo(outputObj, `initialisePerpsectiveSettings -> outputObj =`)
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
export function getPerspectiveNamed(name: string, perspectiveSettings: Array<TPerspectiveDef>): TPerspectiveDef | false {
  return perspectiveSettings.find(s => s.name === name) ?? false
}

/**
 * Add new Perspective using current settings
 * TEST: live
 * TEST: from param: noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=Add%20new%20Perspective&arg0=Home
 * @param {string} nameIn
 */
export async function addNewPerspective(nameIn: string = ''): Promise<void> {
  try {
    logDebug('addNewPerspective', `Starting with ${nameIn} para`)
    const dashboardSettings = (await getDashboardSettings()) || {}
    const existingDefs = (await getPerspectiveSettings()) || {}

    // Get name of new Perspective
    const res = await getInputTrimmed('Please give the name of the new Perspective', 'OK', 'New Perspective', '')
    if (!res) {
      logInfo('deletePerspective', `User cancelled operation.`)
      return
    }
    // Find out how many Perspective definitions we already have
    const newPerspectiveObject: TPerspectiveDef = {
      name: String(res), // to keep flow happy
      isActive: false,
      dashboardSettings: dashboardSettings
    }
    existingDefs.push(newPerspectiveObject)
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
  const includedFolderArr = stringListOrArrayToArray(activeDef.dashboardSettings.includeFolders ?? '', ',')
  const excludedFolderArr = stringListOrArrayToArray(activeDef.dashboardSettings.ignoreFolders ?? '', ',')
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
