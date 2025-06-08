// @flow
//-----------------------------------------------------------------------------
// clickHandlers.js
// Handler functions for dashboard clicks that come over the bridge
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated 2025-06-04 for v2.3.0
//-----------------------------------------------------------------------------

import { getDashboardSettings, handlerResult, setPluginData } from './dashboardHelpers'
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
import { dashboardFilterDefs, dashboardSettingDefs } from './dashboardSettings'
import { clo, dt, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { getSettings, saveSettings } from '@helpers/NPConfiguration'

/****************************************************************************************************************************
 *                             NOTES
 ****************************************************************************************************************************
- Handlers should use the standard return type of TBridgeClickHandlerResult
- handlerResult() can be used to create the result object
- Types are defined in types.js
    - type TActionOnReturn = 'UPDATE_CONTENT' | 'REMOVE_LINE' | 'REFRESH_JSON' | 'START_DELAYED_REFRESH_TIMER' etc.

/****************************************************************************************************************************
 *                             Data types + constants
 ****************************************************************************************************************************/

const pluginID = 'jgclark.Dashboard'
/****************************************************************************************************************************
 *                             HANDLERS
 ****************************************************************************************************************************/

export async function doAddNewPerspective(_data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  clo(_data, `doAddNewPerspective starting ...`)
  await addNewPerspective(_data?.perspectiveName || '')
  const updatesToPluginData = { perspectiveSettings: await getPerspectiveSettings() }
  await setPluginData(updatesToPluginData, `_Added perspective in DataStore.settings & reloaded perspectives`)
  return handlerResult(true, [])
}

export async function doCopyPerspective(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  clo(data, `doCopyPerspective starting ... with mbo`)
  // const fromName = data.userInputObj?.fromName ?? ''
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
  if (!existingDef) return handlerResult(false, [], { errorMsg: `can't get definition for perspective ${origName}` })
  const revisedDefs = renamePerspective(origName, newName, perspectiveSettings)
  if (!revisedDefs) return handlerResult(false, [], { errorMsg: `savePerspectiveSettings failed` })
  const res = await savePerspectiveSettings(revisedDefs)
  await setPluginData({ perspectiveSettings: revisedDefs }, `_Saved perspective ${newName}`)
  if (!res) {
    return handlerResult(false, [], { errorMsg: `savePerspectiveSettings failed` })
  } else {
    return handlerResult(true, [])
  }
}

/**
 * Switch to a perspective and save the new perspective settings and dashboard settings
 * TODO: Add default dashboardSettings to the perspectiveDefs if they are missing.
 * @param {MessageDataObject} data - the data object containing the perspective name
 * @returns {TBridgeClickHandlerResult} - the result of the switch to perspective
 */
export async function doSwitchToPerspective(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  //aka doSwitchPerspective
  const switchToName = data?.perspectiveName || ''
  if (!switchToName) {
    logError('doSwitchToPerspective', `No perspective name provided.`)
    return handlerResult(false, [], { errorMsg: `No perspectiveName provided.` })
  }
  const ps = await getPerspectiveSettings()
  // logPerspectiveNames(ps, 'doSwitchToPerspective: Persp settings before switch:')
  const revisedDefs = await switchToPerspective(switchToName, ps)
  // logPerspectiveNames(revisedDefs || [], 'doSwitchToPerspective: Persp settings after switch:')
  if (!revisedDefs) return handlerResult(false, [], { errorMsg: `switchToPerspective failed` })
  const activeDef = getActivePerspectiveDef(revisedDefs)
  if (!activeDef) return handlerResult(false, [], { errorMsg: `getActivePerspectiveDef failed` })
  const prevDashboardSettings = await getDashboardSettings()

  // each perspective has its own tagged sections so we don't want to keep old ones around
  // so we will remove all keys from prevDS that start with showTagSection_
  if (!prevDashboardSettings) return handlerResult(false, [], { errorMsg: `getDashboardSettings failed` })
  // apply the new perspective's settings to the main dashboard settings
  const dashboardFilterDefaults = dashboardFilterDefs.filter((f) => f.key !== 'includedFolders')
  const nonFilterDefaults = dashboardSettingDefs.filter((f) => f.key)
  const dashboardSettingsDefaults = [...dashboardFilterDefaults, ...nonFilterDefaults].reduce((acc, curr) => {
    // logDebug('doSwitchToPerspective', `doSwitchToPerspective: curr.key='${String(curr.key)}' curr.default='${String(curr.default)}'`)
    if (curr.key && curr.default !== undefined) {
    // $FlowIgnore[prop-missing]
      acc[curr.key] = curr.default
    } else {
      logError('doSwitchToPerspective', `doSwitchToPerspective: default value for ${String(curr.key)} is not set in dashboardSettings file defaults.`)
    }
    return acc
  }, {})
  // $FlowIgnore[prop-missing] // flow doesn't know that it will be complete
  let newDashboardSettings = {
    ...dashboardSettingsDefaults, // helps to add settings that may be new since this perspective was last saved
    ...prevDashboardSettings,
    ...(activeDef.dashboardSettings || {}),
  }
  newDashboardSettings = removeInvalidTagSections(newDashboardSettings) // just to make sure we don't have any invalid tag sections left over from previous perspectives
  newDashboardSettings.lastChange = `_Switched to perspective ${switchToName} ${dt()} changed from plugin`
  logDebug(`doSwitchToPerspective`, `saving ${String(revisedDefs.length)} perspectiveDefs and ${String(Object.keys(newDashboardSettings).length)} dashboardSettings`)
  clo(newDashboardSettings, `doSwitchToPerspective: newDashboardSettings=`)

  // Use helper to save settings from now on, not unreliable `DataStore.settings = {...}`
  // TEST: FIXME: DBW suspects this is not working as expected, because DataStore.settings is not correct here.
  const res = await saveSettings(pluginID, { ...await (getSettings('jgclark.Dashboard')), perspectiveSettings: JSON.stringify(revisedDefs), dashboardSettings: JSON.stringify(newDashboardSettings) })
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
      dashboardSettings = { ...await (getSettings('jgclark.Dashboard')), ...currentPerspDef.dashboardSettings }
      updatedPluginData.dashboardSettings = dashboardSettings
    }
  }
  const combinedUpdatedSettings = { ...await getSettings('jgclark.Dashboard'), perspectiveSettings: JSON.stringify(cleanedPerspSettings), dashboardSettings: JSON.stringify(dashboardSettings) }

  // Note: Use helper to save settings from now on, not unreliable `DataStore.settings = combinedUpdatedSettings`
  const res = await saveSettings(pluginID, combinedUpdatedSettings)
  if (!res) {
    return handlerResult(false, [], { errorMsg: `saveSettings failed` })
  }
  await setPluginData(updatedPluginData, `_Updated perspectiveSettings in global pluginData`)
  return handlerResult(true, ['REFRESH_ALL_ENABLED_SECTIONS'])
}
