// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions for Perspectives
// Last updated 2024-08-21 for v2.1.0.a8 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { doSettingsChanged } from "./clickHandlers.js"
import { getDashboardSettings, setPluginData } from "./dashboardHelpers.js"
// import { refreshDashboardData } from './reactMain'
import { parseSettings } from './shared'
import type { TDashboardSettings, TPerspectiveDef } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getFoldersMatching } from '@helpers/folders'
import { chooseOption, getInputTrimmed } from '@helpers/userInput'


/* -----------------------------------------------------------------------------
   Design logic
 -------------------------------------------------------------------------------

Default perspective = "-", when no others set.
- persisted as a name, but cannot be deleted
- it's a save of the last settings you made (before you switched into a named perspective). So the way I implemented it is that it saves your changes to the "-" perspective any time you are not in a perspective and make a change. So if you switch to "Work" and then switch back to "-" it returns you to your last state before you switched to "Work"
  * [x] ensure `-` cannot be deleted @done(2024-08-20)
  * [x] ensure `-` cannot be added as a new Perspective @done(2024-08-20)
- When we make changes to `-` it doesn't become `-*` but stays at `-`.

Named perspectives
- Created: by user through /save new perspective, or through settings UI.
  - The activePerspectiveName (in main dashboardSettings) holds the name of the currently-active perspective.  We no longer want the isActive flag.
    * [x] #jgcDR: remove isActive flag @done(2024-08-20)
  - Adding a new perspective is working saving-wise, but it doesn't show in the dropdown. Adding a new perspective should update the dropdown selector list and set the dropdown to the new perspective. savePerspectiveSettings() or somewhere else in the flow needs to update the data in the window using `await setPluginData()`  See other examples of where this is used to update the various objects. 

- Read: through helper function getPerspectiveSettings()

- Applied: through calling function switchToPerspective()
  > JGC new thought: Before changing to any other perspective, I think we should check whether current one isModified, and if it is offer to update/save it first. DBW agrees.
  > dbw says: it sure would be nice if we had a dialog that opened up inside the window. It's kind of jarring to have the NP main window pop up on you. Are you up for trying to create a dialog?
  * [ ] #jgcDR ask user whether to update a modified Perspective before changing to a new one -- but try to use a native dialog not NP main window

- Altered: by setting changes(s) made by user or callback.  
  - all the changes you are making are saved to your dashboardSettings
  - At this point a "*" is appended to the display name, via an `isModified` flag
  - However, the default Perspective `-` does not get shown as `-*`
  * [x] #jgcDR: add isModified flag (to separate logic from display, which might change in the future)

- Saved: by user through /update current perspective
  - done by calling updateCurrentPerspectiveDef(), which sets isModified to false

- Deleted: through settings UI or /delete current perspective.
  - TEST: needs to update list of available perspectives
  - TEST: set active perspective to default

-----------------------------------------------------------------------------*/

const pluginID = pluginJson['plugin.id']

export const perspectiveSettingDefaults: Array<TPerspectiveDef> = [
  // $FlowFixMe[prop-missing] rest specified later
  {
    name: "-",
    isModified: false,
    // $FlowFixMe[prop-missing] rest specified later
    dashboardSettings: {
    }
  },
  {
    name: "Home",
    isModified: false,
    // $FlowFixMe[prop-missing]
    dashboardSettings: {
      includedFolders: "Home, NotePlan",
      excludedFolders: "Readwise 📚, Saved Searches, Work",
      ignoreItemsWithTerms: "#test, @church",
    }
  },
  // $FlowFixMe[prop-missing] rest specified later
  {
    name: "Work",
    isModified: false,
    // $FlowFixMe[prop-missing] rest specified later
    dashboardSettings: {
      includedFolders: "Work, CCC, Ministry",
      excludedFolders: "Readwise 📚, Saved Searches, Home",
      ignoreItemsWithTerms: "#test, @home",
    }
  },
]

//-----------------------------------------------------------------------------
// Getters
//-----------------------------------------------------------------------------

/**
 * Get all perspective settings (as array of TPerspectiveDef)
 * @returns {Array<TPerspectiveDef>} all perspective settings
 */
export async function getPerspectiveSettings(): Promise<Array<TPerspectiveDef>> {
  try {
    logDebug('getPerspectiveSettings', `Attempting to get Perspective settings ...`)
    // Note: (in an earlier place this code was used) we think following (newer API call) is unreliable.
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

    if (perspectiveSettingsStr && perspectiveSettingsStr !== "[]") {
      // must parse it because it is stringified JSON (an array of TPerspectiveDef)
      const settingsArr = parseSettings(perspectiveSettingsStr) ?? []
      logDebug(`getPerspectiveSettings: Loaded from disk: perspectiveSettingsStr (${settingsArr.length})`, `${perspectiveSettingsStr}`)
      return settingsArr
    }
    else {
      // No settings found, so will need to set from the defaults instead
      logWarn('getPerspectiveSettings', `None found: will use the defaults:`)
      perspectiveSettings = perspectiveSettingDefaults

      // now fill in with the rest of the current dashboardSettings
      const currentDashboardSettings = await getDashboardSettings()
          // FIXME: @jgclark (from dbw): I'm still not convinced we need to copy all of these
          const extendedPerspectiveSettings = perspectiveSettings
        //   const extendedPerspectiveSettings: Array<TPerspectiveDef> = perspectiveSettings.map(
        // psd => ({
        //   ...psd /*,
      //   dashboardSettings: cleanDashboardSettings({
        //     ...currentDashboardSettings, ...psd.dashboardSettings,
        //     // // ensure aPN is the same as this perspective name (just in case)
        //     // activePerspectiveName: psd.name
        //     */
        //   })
        // })
      // )
      // const extendedPerspectiveSettings = [
      //   ...pSettingDefaults, pSettings
      // ]
      clo(extendedPerspectiveSettings, `extendedPerspectiveSettings =`)

      // persist and return
      saveAllPerspectiveDefs(extendedPerspectiveSettings)
      return extendedPerspectiveSettings
    }
  } catch (error) {
    logError('getPerspectiveSettings', `Error: ${error.message}`)
    return []
  }
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
  // clo(allDefs, `getActivePerspectiveDef: allDefs =`)
  const activeDef = getPerspectiveNamed(activePerspectiveName, allDefs)
  if (!activeDef) {
    logWarn('getActivePerspectiveDef', `Could not find definition for perspective '${activePerspectiveName}'.`)
    return false
  } else {
    logDebug('getActivePerspectiveDef', `Active perspective = '${activePerspectiveName}':`)
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
 * Get list of all Perspective names
 * @param {Array<TPerspectiveDef>} allDefs
 * @param {boolean} includeDefaultOption? (optional; default = true)
 * @returns {Array<string>}
 */
export function getDisplayListOfPerspectiveNames(
  allDefs: Array<TPerspectiveDef>,
  includeDefaultOption: boolean = true
): Array<string> {
  try {
    // Get all perspective names
    if (!allDefs || allDefs.length === 0) {
      throw new Error(`No existing Perspective settings found.`)
    }

    // Form list of options, removing "-" from the list if wanted
    let options = allDefs
      .map(def => (def.isModified ? `${def.name}*` : def.name))
      .sort((a, b) => (a === "-" ? -1 : b === "-" ? 1 : 0))
    if (!includeDefaultOption) {
      options = options.filter(name => name !== "-")
    }

    logDebug('getDisplayListOfPerspectiveNames ->', String(options))
    return options
  } catch (err) {
    logError('getDisplayListOfPerspectiveNames', err.message)
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

//-----------------------------------------------------------------------------
// Setters
//-----------------------------------------------------------------------------

export async function switchToPerspective(name: string, allDefs: Array<TPerspectiveDef>): Promise<boolean> {
  // Check if perspective exists
  logDebug('switchToPerspective', `for name ${name}, with ...`)
  clo(allDefs, `switchToPerspective: allDefs =`)
  // FIXME: always results in -
  const thisDef = await getPerspectiveNamed(name, allDefs) ?? await getPerspectiveNamed("-", allDefs)
  if (!thisDef) {
    logError('switchToPerspective', `Could not find definition for perspective '${name}'.`)
    return false
  }
  // Now set activePerspectiveName in dashboardSettings
  const dSettings = await getDashboardSettings()
  dSettings.activePerspectiveName = thisDef.name

  // SAVE IT! Based on clickHandlers::doSettingsChanged()
  // TODO: Pull this into a separate function
  const updatedDashboardSettings = { ...DataStore.settings, dashboardSettings: JSON.stringify(dSettings) }
  DataStore.settings = updatedDashboardSettings

  // Send this to front end
  await setPluginData({ dashboardSettings: updatedDashboardSettings }, `End of switchToPerspective('${name}')`)
  // TODO: ^^^^ triggers OK, but not working
  return true
}

/**
 * Update the current perspective settings (as a TPerspectiveDef) and persist.
 * Clear the isModified flag for the current perspective.
 * Note: Always called by user; never an automatic operation.
 * @returns {boolean} success
 */
export async function updateCurrentPerspectiveDef(): Promise<boolean> {
  try {
    // FIXME: doesn't get this OK:
    const activePerspectiveName = DataStore.settings.dashboardSettings.activePerspectiveName
    const allDefs = await getPerspectiveSettings()
    const activeDefIndex: number = allDefs.findIndex((d) => d.name === activePerspectiveName)
    if (activeDefIndex === undefined || activeDefIndex === -1) {
      logWarn('updateCurrentPerspectiveDef', `Couldn't find definition for perspective '${activePerspectiveName}'.`)
      return false
    }
    logDebug('updateCurrentPerspectiveDef', `Will update def '${activePerspectiveName}' (#${String(activeDefIndex)})`)
    const dashboardSettings = await getDashboardSettings()
    allDefs[activeDefIndex].dashboardSettings = dashboardSettings
    allDefs[activeDefIndex].isModified = false
    const res = await saveAllPerspectiveDefs(allDefs)
    return true
  } catch (error) {
    logError('updateCurrentPerspectiveDef', `Error: ${error.message}`)
    return false
  }
}

/**
 * Save all perspective definitions as a stringified array, to suit the forced type of the hidden setting.
 * TODO: from this NP automatically triggers NPHooks::onSettingsUpdated(). This might or might not be desirable.
 * TODO: ideally this should trigger updates in the front end too, but I don't know how.
 * @param {Array<TPerspectiveDef>} allDefs perspective definitions
 * @return {boolean} true if successful
 */
export function saveAllPerspectiveDefs(allDefs: Array<TPerspectiveDef>): boolean {
  try {
    const perspectiveSettingsStr = JSON.stringify(allDefs) ?? ""
    const pluginSettings = DataStore.settings
    pluginSettings.perspectiveSettings = perspectiveSettingsStr
    DataStore.settings = pluginSettings
    logDebug('saveAllPerspectiveDefs', `Apparently saved OK.`)
    return true
  } catch (error) {
    logError('saveAllPerspectiveDefs', `Error: ${error.message}`)
    return false
  }
}

/**
 * Clean a Dashboard settings object of properties we don't want to use
 * (we only want things in the perspectiveSettings object that could be set in dashboard settings or filters)
 * @param {TDashboardSettings} settingsIn 
 * @returns {TDashboardSettings}
 */
export function cleanDashboardSettings(settingsIn: TDashboardSettings): TDashboardSettings {
  // Define keys or patterns to remove from the settings
  const patternsToRemove = [
    'lastChange', 
    'activePerspectiveName', 
    'timeblockMustContainString', 
    'updateTagMentionsOnTrigger',
    'defaultFileExtension',
    'doneDatesAvailable',
    'migratedSettingsFromOriginalDashboard',
    'triggerLogging',
    'pluginID',
    /FFlag_/,
    /separator\d/,  // though JGC has never seen this on 'heading/d' in dashboardSettings?
    /heading\d/,
    /_logLevel/,
    /_logTimer/,
    /_logFunctionRE/,
  ].map(pattern => 
    typeof pattern === 'string' ? new RegExp(`^${pattern}`) : pattern
  )

  // Function to check if a key matches any of the patterns
  function shouldRemoveKey(key: string): boolean {
    return patternsToRemove.some(pattern => pattern.test(key))
  }

  // Reduce the settings object by excluding keys that match any pattern in patternsToRemove
  return Object.keys(settingsIn).reduce((acc, key) => {
    if (!shouldRemoveKey(key)) {
      acc[key] = settingsIn[key]
    }
    return acc
  }, {})
}


/**
 * Add a new Perspective setting. User just gives it a name, and otherwise uses the currently active settings.
 * TODO: ensure no reuse and no * at end or -
 */
export async function addNewPerspective(): Promise<void> {
  const allDefs = await getPerspectiveSettings()
  logInfo('addPerspectiveSetting', `Found ${allDefs.length} existing Perspectives ...`)

  // Get user input
  const name = await getInputTrimmed('Enter name of new Perspective:', 'OK', 'Add Perspective', 'Test')
  if (typeof name === 'boolean') {
    logWarn('addPerspectiveSetting', `Cancelled adding new Perspective`)
    return
  }
  if (name === '-') {
    logWarn('addPerspectiveSetting', `Cannot add default Perspective '-'.`)
    return
  }

  const currentDashboardSettings = await getDashboardSettings()
  const newDef: TPerspectiveDef = {
    name: name,
    isModified: false,
    // $FlowFixMe[prop-missing] gets set later
    dashboardSettings: {
      ...cleanDashboardSettings(currentDashboardSettings)
      // includedFolders: includedFolders || "",
      // excludedFolders: excludedFolders || "",
    }
  }
  logInfo('addPerspectiveSetting', `... adding Perspective #${String(allDefs.length)}:\n${JSON.stringify(newDef, null, 2)}`) // ✅

  // persist the updated Perpsective settings
  const updatedPerspectives = [...allDefs, newDef]
  // save active perspective name into dashboard settings
  const res = saveAllPerspectiveDefs(updatedPerspectives)

  // Then update pluginData with new dS that includes new aPN
  const updatedDashboardSettings = { ...currentDashboardSettings, activePerspectiveName: name }
  await setPluginData({ dashboardSettings: updatedDashboardSettings }, `Updating dashbaordSettings after adding Perspective ${name}`)

  const res2 = await switchToPerspective(name, updatedPerspectives)
  logDebug('addPerspectiveSetting', `Result of switchToPerspective('${name}'): ${String(res2)}`)
  // FIXME: HELP: This writes to the settings file OK, but ^^^ doesn't trigger any update in the UI yet.
}

/**
 * Delete all Perspective settings, other than default
 */
export async function deleteAllNamedPerspectiveSettings(): Promise<void> {
  logDebug('deleteAllNamedPerspectiveSettings', `Attempting to delete all Perspective settings (other than edfault) ...`)
  // v1
  // const pluginSettings = DataStore.settings
  // pluginSettings.perspectiveSettings = "[]"
  // const dSettings = await getDashboardSettings()
  // $FlowIgnore
  // delete dSettings.perspectiveSettings
  // pluginSettings.dashboardSettings = JSON.stringify(dSettings)
  // clo(pluginSettings.perspectiveSettings, `... leaves: pluginSettings.perspectiveSettings =`)
  // DataStore.settings = pluginSettings

  // V2
  let pSettings = await getPerspectiveSettings()
  for (const p of pSettings) {
    if (p.name !== '-') {
      await deletePerspective(p.name)
    }
  }
  logDebug('deleteAllNamedPerspectiveSettings', `Deleted all named perspectives, other than default.`)

  pSettings = await getPerspectiveSettings()
  const updatedListOfPerspectives = getDisplayListOfPerspectiveNames(pSettings)
  logDebug('deleteAllNamedPerspectiveSettings', `- Test: new list of available perspectives: [${String(updatedListOfPerspectives ?? [])}]`)
  // Set current perspective to default ("-")
  const res = await switchToPerspective('-')
  logDebug('deleteAllNamedPerspectiveSettings', `Result of switchToPerspective("-"): ${String(res)}`)
}

/**
 * Delete a Perspective definition from dashboardSettings.
 * @param {string} nameIn
 * TEST: live
 * TEST: from param: noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=Delete%20Perspective&arg0=Home
 */
export async function deletePerspective(nameIn: string = ''): Promise<void> {
  try {
    let nameToUse = ''
    const dashboardSettings = (await getDashboardSettings()) || {}
    const existingDefs = (await getPerspectiveSettings()) || []
    if (existingDefs.length === 0) {
      throw new Error(`No perspective settings found. Stopping.`)
    }
    if (nameIn === '-') {
      logWarn('deletePerspective', `Cannot delete default Perspective '-'.`)
      return
    }

    logInfo('deletePerspective', `Starting with ${existingDefs.length} perspectives and param '${nameIn}'`)

    if (nameIn !== '' && getPerspectiveNamed(nameIn, existingDefs)) {
      nameToUse = nameIn
      logInfo('deletePerspective', `Will delete perspective '${nameToUse}' passed as parameter`)
    } else {
      logInfo('deletePerspective', `Asking user to pick perspective to delete (apart from default)`)
      const displayList = getDisplayListOfPerspectiveNames(existingDefs, false)
      const options = displayList.map((pn) => {
        return { label: pn, value: pn }
      })
      const res = await chooseOption('Please pick the Perspective to delete', options)
      if (!res) {
        logInfo('deletePerspective', `User cancelled operation.`)
        return
      }
      nameToUse = String(res)
      logInfo('deletePerspective', `Will delete perspective '${nameToUse}' selected by user`)
    }

    // if this is the active perspective, then set the activePerspectiveName to default
    if (nameToUse === dashboardSettings.activePerspectiveName) {
      logDebug('deletePerspective', `Deleting active perspective, so will need to switch to default Perspective ("-")`)
      const res = await switchToPerspective('-')
      logDebug('deletePerspective', `Result of switchToPerspective("-"): ${String(res)}`)
    }

    // delete this Def from the list of Perspective Defs
    const perspectivesWithoutOne = existingDefs.filter(obj => obj.name !== nameToUse)
    logInfo('deletePerspective', `Finished with ${String(perspectivesWithoutOne.length)} perspectives remaining`)

    // Persist this change 
    // v1:
    const pluginSettings = DataStore.settings
    pluginSettings.perspectiveSettings = JSON.stringify(perspectivesWithoutOne)
    DataStore.settings = pluginSettings
    // FIXME: ^^^^ not updating elsewhere in the interface.
    // v2:
    // So I want to try the following, but I don't have the function defs to call:
    // await adjustSettingsAndSave(perspectivesWithoutOne, setDashboardSettings, setPerspectiveSettings, `deletePerspective('${nameToUse}')`)

  } catch (error) {
    logError('deletePerspective', error.message)
  }
}

//-----------------------------------------------------------------------------
// Other Helpers
//-----------------------------------------------------------------------------

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
  // logDebug('isLineDisallowedByExcludedTerms', `- Did ${matchFound ? 'find ' : 'NOT find'} matching term(s) amongst '${String(lineContent)}'`)
  return matchFound
}

export const endsWithStar = (input: string): boolean => /\*$/.test(input)

/**
 * TEST: this is new
 * Make a change to the current dashboard settings and save.
 * Note: this does *not* update a current named persectiveDef, but does update the default one ("-").
 * @param {TDashboardSettings} updatedSettings 
 * @param {TDashboardSettings} dashboardSettings
 * @param {Function} setDashboardSettings 
 * @param {Function} setPerspectiveSettings 
 * @param {string} logMessage 
 */
export function adjustSettingsAndSave(
  updatedSettings: any /*TDashboardSettings*/, // TODO: improve type - can be partial settings object
  dashboardSettings: TDashboardSettings,
  setDashboardSettings: Function,
  setPerspectiveSettings: Function,
  logMessage: string
): void {
  try {
    logDebug('adjustSettingsAndSave', `🥷 starting reason "${logMessage}"`)
    clo(updatedSettings, `🥷 - before updating dashboardSettings:`)
    // Note must always include all settings, because FFlags etc. are not in the dialog
		const settingsToSave = { ...dashboardSettings,...updatedSettings }
    // perspectiveSettings is a special case. we don't want to save it into the dashboardSettings object
    // TODO: following discussions on 19/20 August, I'm not sure if this is the right thing to do. We want to update default ("-") not named perspective, right?
    if (settingsToSave.perspectiveSettings) {
      setPerspectiveSettings(settingsToSave.perspectiveSettings)
      delete settingsToSave.perspectiveSettings
      // setUpdatedSettings(settingsToSave) // Probably not needed because dialog is closing anyway
      clo(settingsToSave, `- after updating perspectiveSettings:`)
    }

    if (Object.keys(settingsToSave).length > 0) {
      // there were other (non-perspective) changes made
      const apn = settingsToSave.activePerspectiveName
      if (typeof apn === 'string' && apn.length > 0 && apn !== "-" && !endsWithStar(apn)) {
        // $FlowIgnore // we know apn is a string so this concat will work
        settingsToSave.activePerspectiveName += '*' // add the star/asterisk to indicate a change
      }
      setDashboardSettings({ ...settingsToSave, lastChange: 'Dashboard Settings Modal saved' })
      logDebug('adjustSettingsAndSave', `- after updating dashboardSettings, with activePerspectiveName=${settingsToSave.activePerspectiveName}`)
    }
  } catch (err) {
    logError('adjustSettingsAndSave', err.message)
  }
}
