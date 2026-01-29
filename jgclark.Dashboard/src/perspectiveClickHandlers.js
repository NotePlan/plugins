// @flow
//-----------------------------------------------------------------------------
// clickHandlers.js
// Handler functions for dashboard clicks that come over the bridge
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated 2026-01-22 for v2.4.0.b17
//-----------------------------------------------------------------------------

import { getDashboardSettings, handlerResult, setPluginData, getDashboardSettingsDefaults } from './dashboardHelpers'
import type { MessageDataObject, TBridgeClickHandlerResult, TDashboardSettings, TPerspectiveSettings } from './types'
import {
  addNewPerspective,
  cleanDashboardSettingsInAPerspective,
  deletePerspective,
  getActivePerspectiveDef,
  getPerspectiveNamed,
  getPerspectiveSettings,
  logPerspectives,
  replacePerspectiveDef,
  switchToPerspective,
  renamePerspective,
  savePerspectiveSettings,
  removeInvalidTagSections,
  logPerspectiveNames,
} from './perspectiveHelpers'
// import { dashboardFilterDefs, dashboardSettingDefs } from './dashboardSettings'
import { clo, dt, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { getSettings, saveSettings } from '@helpers/NPConfiguration'

/**
 * -----------------------------------------------------------------------------
*  Notes
* -------------------------------------------------------------------------------
- Handlers should use the standard return type of TBridgeClickHandlerResult
- handlerResult() can be used to create the result object
- Types are defined in types.js
    - type TActionOnReturn = 'UPDATE_CONTENT' | 'REMOVE_LINE' | 'REFRESH_JSON' | 'START_DELAYED_REFRESH_TIMER' etc.
*/

//-----------------------------------------------------------------------------
// Constants
//-----------------------------------------------------------------------------

const pluginID = 'jgclark.Dashboard'

//-----------------------------------------------------------------------------
// Handlers
//-----------------------------------------------------------------------------

export async function doAddNewPerspective(_data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  clo(_data, `doAddNewPerspective starting ...`)
  await addNewPerspective(_data?.perspectiveName || '')
  const updatesToPluginData = { perspectiveSettings: await getPerspectiveSettings() }
  await setPluginData(updatesToPluginData, `_Added perspective in DataStore.settings & reloaded perspectives`)
  return handlerResult(true, [])
}

/**
 * Copy a perspective.
 * Note: This deliberately doesn't guard against the new name already being in use.
 * @param {MessageDataObject} data - the data object containing the oldnew name for the perspective
 * @returns {TBridgeClickHandlerResult} - the result of the copy perspective
 */
export async function doCopyPerspective(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  clo(data, `doCopyPerspective starting ... with mbo`)
  const newName = data.userInputObj?.newName ?? ''
  const perspectiveSettings = await getPerspectiveSettings()
  const activeDef = getActivePerspectiveDef(perspectiveSettings)
  if (!activeDef) return handlerResult(false, [], { errorMsg: `getActivePerspectiveDef failed` })
  const newDef = { ...activeDef, name: newName, isModified: false, isActive: false }
  const revisedDefs = replacePerspectiveDef(perspectiveSettings, newDef)
  if (!revisedDefs) return handlerResult(false, [], { errorMsg: `doCopyPerspective failed` })
  await setPluginData({ perspectiveSettings: revisedDefs }, `_Saved perspective ${activeDef.name}`)
  return handlerResult(true, [])
}

export async function doDeletePerspective(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  await deletePerspective(data.perspectiveName)
  let perspectiveSettings = await getPerspectiveSettings()
  const activeDef = getActivePerspectiveDef(perspectiveSettings)
  if (!activeDef) {
    const newPerspSettings = await switchToPerspective('-', perspectiveSettings)
    if (newPerspSettings) {
      perspectiveSettings = newPerspSettings
    } else {
      logError('doDeletePerspective', `switchToPerspective('-', perspectiveSettings) failed after deleting ${data.perspectiveName || ''}`)
      return handlerResult(false, [], { errorMsg: `switchToPerspective('-', perspectiveSettings) failed` })
    }
  }
  const updatesToPluginData = { perspectiveSettings: perspectiveSettings, dashboardSettings: await getDashboardSettings() }
  await setPluginData(updatesToPluginData, `_Deleted perspective in DataStore.settings & reloaded perspectives`)
  return handlerResult(true, [])
}

export async function doSavePerspective(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  clo(data, `doSavePerspective starting ... with mbo`)
  const perspectiveSettings = await getPerspectiveSettings()
  const activeDef = getActivePerspectiveDef(perspectiveSettings)
  if (!activeDef) return handlerResult(false, [], { errorMsg: `getActivePerspectiveDef failed` })
  if (!activeDef.isModified) return handlerResult(false, [], { errorMsg: `Perspective ${activeDef.name} is not modified. Not saving.` })
  if (activeDef.name === '-') return handlerResult(false, [], { errorMsg: `Perspective "-" is not allowed to be saved.` })
  const dashboardSettings = await getDashboardSettings()
  if (!dashboardSettings) return handlerResult(false, [], { errorMsg: `getDashboardSettings failed` })
  const newDef = { ...activeDef, dashboardSettings: cleanDashboardSettingsInAPerspective(dashboardSettings), isModified: false }
  const revisedDefs = replacePerspectiveDef(perspectiveSettings, newDef)
  const result = await savePerspectiveSettings(revisedDefs)
  if (!result) return handlerResult(false, [], { errorMsg: `savePerspectiveSettings failed` })
  await setPluginData({ perspectiveSettings: revisedDefs }, `_Saved perspective ${activeDef.name}`)
  return handlerResult(true, [])
}

export async function doRenamePerspective(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  clo(data, `doRenamePerspective starting ... with mbo`)
  const origName = data.userInputObj?.oldName ?? ''
  const newName = data.userInputObj?.newName ?? ''
  if (origName === '') return handlerResult(false, [], { errorMsg: `doRenamePerspective: origName is empty` })
  if (newName === '') return handlerResult(false, [], { errorMsg: `doRenamePerspective: newName is empty` })
  if (origName === '-') return handlerResult(false, [], { errorMsg: `Perspective "-" cannot be renamed` })
  if (newName === '-') return handlerResult(false, [], { errorMsg: `Perspectives cannot be renamed to "-".` })
  const perspectiveSettings = await getPerspectiveSettings()
  const existingDef = getPerspectiveNamed(origName, perspectiveSettings)
  if (!existingDef) return handlerResult(false, [], { errorMsg: `Can't find the definition for perspective "${origName}"` })
  const revisedDefs = renamePerspective(origName, newName, perspectiveSettings)
  if (!revisedDefs) return handlerResult(false, [], { errorMsg: `renamePerspective failed` })

  // FIXME: this appears to save Dashboard settings OK to the settings.json file, but not the perspectiveSettings part of that file
  const res = await savePerspectiveSettings(revisedDefs)
  if (!res) {
    return handlerResult(false, [], { errorMsg: `savePerspectiveSettings failed` })
  }
  await setPluginData({ perspectiveSettings: revisedDefs }, `_Saved perspective ${newName}`)
  return handlerResult(true, [])
}

/**
 * Switch to a perspective and save the new perspective settings and dashboard settings
 * TODO: Add default dashboardSettings to the perspectiveDefs if they are missing.
 * @param {MessageDataObject} data - the data object containing the perspective name
 * @returns {TBridgeClickHandlerResult} - the result of the switch to perspective
 */
export async function doSwitchToPerspective(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  // aka doSwitchPerspective
  const switchToName = data?.perspectiveName || ''
  if (!switchToName) {
    logError('doSwitchToPerspective', `No perspective name provided.`)
    return handlerResult(false, [], { errorMsg: `No perspectiveName provided.` })
  }
  const ps = await getPerspectiveSettings()
  // logPerspectiveNames(ps, 'doSwitchToPerspective: Persp settings before switch:')
  // TODO: JGC thinks the following function could be more clearly named.
  const revisedDefs = await switchToPerspective(switchToName, ps)
  // logPerspectiveNames(revisedDefs || [], 'doSwitchToPerspective: Persp settings after switch:')
  if (!revisedDefs) return handlerResult(false, [], { errorMsg: `switchToPerspective couldn't get def for perspective'${switchToName}'` })
  const activeDef = getActivePerspectiveDef(revisedDefs)
  if (!activeDef) return handlerResult(false, [], { errorMsg: `getActivePerspectiveDef failed` })

  // get the previous dashboard settings
  const prevDashboardSettings = await getDashboardSettings()
  if (!prevDashboardSettings) return handlerResult(false, [], { errorMsg: `getDashboardSettings failed` })

  // each perspective has its own tagged sections so we don't want to keep old ones around
  // so we will remove all keys from prevDS that start with showTagSection_ and then apply the new perspective's settings to the main dashboard settings
  // strip out tag section flags from the previous perspective so they don't leak into the next one
  // Also strip out includedTeamspaces since it's perspective-specific and shouldn't leak between perspectives. (JGC doesn't understand this, but DBW does. See https://discord.com/channels/@me/863719873175093259/1449100417211564053)
  const prevWithoutTagSections: Partial<TDashboardSettings> = (Object.fromEntries(
    Object.entries(prevDashboardSettings).filter(([k]) => !k.startsWith('showTagSection_') && k !== 'includedTeamspaces'),
  ): any)
  const dashboardSettingsDefaults = getDashboardSettingsDefaults()
  let newDashboardSettings = {
    ...dashboardSettingsDefaults, // helps to add settings that may be new since this perspective was last saved
    ...prevWithoutTagSections,
    ...(activeDef.dashboardSettings || {}),
  }
  newDashboardSettings = removeInvalidTagSections(newDashboardSettings) // just to make sure we don't have any invalid tag sections left over from previous perspectives
  newDashboardSettings.lastChange = `_Switched to perspective ${switchToName} ${dt()} changed from plugin`
  logDebug(`doSwitchToPerspective`, `saving ${String(revisedDefs.length)} perspectiveDefs and ${String(Object.keys(newDashboardSettings).length)} dashboardSettings`)

  // Use helper to save settings from now on, not unreliable `DataStore.settings = {...}`
  const res = await saveSettings(pluginID, {
    ...(await getSettings('jgclark.Dashboard')),
    perspectiveSettings: revisedDefs,
    dashboardSettings: newDashboardSettings,
  })
  if (!res) {
    return handlerResult(false, [], { errorMsg: `saveSettings failed` })
  }

  // const afterPerspSettings = await getPerspectiveSettings(true)
  // logPerspectiveNames(afterPerspSettings, 'doSwitchToPerspective: Persp settings reading back from DataStore.settings:')

  // TODO: @jgclark resetting sections to [] on perspective switch forces a refresh of all enabled sections
  // You may or may not want to get fancy and try to delete the sections that are no longer enabled (e.g. tags)
  // and only refresh the sections that are new
  // But for now, the brute force way seems the most reliable :)
  const updatesToPluginData = {
    perspectiveSettings: revisedDefs,
    dashboardSettings: newDashboardSettings,
    pushFromServer: { dashboardSettings: true, perspectiveSettings: true },
    sections: [],
    lastChange: `_Switched to perspective ${switchToName} ${dt()} changed from plugin`,
  }
  logDebug(
    `doSwitchToPerspective`,
    `sending revised perspectiveSettings and dashboardSettings to react window after switching to ${data?.perspectiveName || ''} current excludedFolders=${
      newDashboardSettings.excludedFolders ? newDashboardSettings.excludedFolders : 'not set'
    }`,
  )
  // logPerspectiveNames(afterPerspSettings, 'doSwitchToPerspective: Sending these perspectiveSettings to react window in pluginData')
  await setPluginData(updatesToPluginData, `_Switched to perspective ${switchToName} in DataStore.settings ${dt()} changed in plugin`)
  return handlerResult(true, ['PERSPECTIVE_CHANGED'])
}

/**
 * Set the dashboard settings for the "-" perspective, and set isModified and isActive to false for all other perspectives
 * @param {TDashboardSettings} newDashboardSettings
 * @param {TPerspectiveSettings} perspectiveSettings
 * @returns {TPerspectiveSettings}
 */
export function setDashPerspectiveSettings(newDashboardSettings: TDashboardSettings, perspectiveSettings: TPerspectiveSettings): TPerspectiveSettings {
  logDebug(`setDashPerspectiveSettings`, `Saving new Dashboard settings to "-" perspective, setting isModified and isActive to false for all other perspectives`)
  const dashDef = { name: '-', isActive: true, dashboardSettings: cleanDashboardSettingsInAPerspective(newDashboardSettings), isModified: false }
  return replacePerspectiveDef(perspectiveSettings, dashDef).map((p) => (p.name === '-' ? p : { ...p, isModified: false, isActive: false }))
}

/**
 * Update perspectiveSettings in DataStore.settings
 * @param {MessageDataObject} data - a MDO that should have a key "settings" with the items to be set to the settingName key
 * @returns {TBridgeClickHandlerResult}
 */
export async function doPerspectiveSettingsChanged(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  clo(data, `doPerspectiveSettingsChanged() starting with data = `)
  const newSettings = data.settings
  if (!DataStore.settings || !newSettings || !Array.isArray(newSettings)) {
    return handlerResult(false, [], { errorMsg: `doPerspectiveSettingsChanged: newSettings is null or undefined.` })
  }

  let dashboardSettings = await getDashboardSettings()
  if (!dashboardSettings) return handlerResult(false, [], { errorMsg: `getDashboardSettings failed` })
  // after (potential) multi-editing in the PerspectivesTable, we need to clean the dashboardSettings for each perspective
  // because the tagsToShow may have been changed, so we need to clean out the showSection* vars
  const cleanedPerspSettings = newSettings.map((p) => ({ ...p, dashboardSettings: cleanDashboardSettingsInAPerspective(p.dashboardSettings) }))
  const updatedPluginData = { perspectiveSettings: cleanedPerspSettings, dashboardSettings, pushFromServer: { perspectiveSettings: true, dashboardSettings: true } }
  if (dashboardSettings.usePerspectives) {
    const currentPerspDef = getActivePerspectiveDef(cleanedPerspSettings)
    if (currentPerspDef && currentPerspDef.name !== '-') {
      dashboardSettings = { ...(await getSettings('jgclark.Dashboard')), ...currentPerspDef.dashboardSettings }
      updatedPluginData.dashboardSettings = dashboardSettings
    }
  }
  const combinedUpdatedSettings = {
    ...(await getSettings('jgclark.Dashboard')),
    perspectiveSettings: cleanedPerspSettings,
    dashboardSettings: dashboardSettings,
  }

  // Note: Use helper to save settings from now on, not unreliable `DataStore.settings = combinedUpdatedSettings`
  const res = await saveSettings(pluginID, combinedUpdatedSettings)
  if (!res) {
    return handlerResult(false, [], { errorMsg: `saveSettings failed` })
  }
  await setPluginData(updatedPluginData, `_Updated perspectiveSettings in global pluginData`)
  return handlerResult(true, ['REFRESH_ALL_ENABLED_SECTIONS'])
}
