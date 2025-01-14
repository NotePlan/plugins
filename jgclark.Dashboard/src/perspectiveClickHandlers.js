// @flow
//-----------------------------------------------------------------------------
// clickHandlers.js
// Handler functions for dashboard clicks that come over the bridge
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated for v2.1.0.b
//-----------------------------------------------------------------------------

import { getDashboardSettings, handlerResult, setPluginData } from './dashboardHelpers'
import type { MessageDataObject, TBridgeClickHandlerResult, TDashboardSettings, TPerspectiveSettings } from './types'
import {
  addNewPerspective,
  cleanDashboardSettings,
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
import { clo, dt, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'

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
  const newDef = { ...activeDef, dashboardSettings: cleanDashboardSettings(dashboardSettings), isModified: false }
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
  await savePerspectiveSettings(revisedDefs)
  await setPluginData({ perspectiveSettings: revisedDefs }, `_Saved perspective ${newName}`)
  return handlerResult(true, [])
}

/**
 * Switch to a perspective and save the new perspective settings and dashboard settings
 * @param {MessageDataObject} data - the data object containing the perspective name
 * @returns {TBridgeClickHandlerResult} - the result of the switch to perspective
 */
export async function doSwitchToPerspective(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const switchToName = data?.perspectiveName || ''
  if (!switchToName) {
    logError('doSwitchToPerspective', `No perspective name provided.`)
    return handlerResult(false, [], { errorMsg: `No perspectiveName provided.` })
  }
  const ps = await getPerspectiveSettings()
  logPerspectiveNames(ps, 'doSwitchToPerspective: Persp settings before switch:')
  const revisedDefs = await switchToPerspective(switchToName, ps)
  logPerspectiveNames(revisedDefs || [], 'doSwitchToPerspective: Persp settings after switch:')
  if (!revisedDefs) return handlerResult(false, [], { errorMsg: `switchToPerspective failed` })
  const activeDef = getActivePerspectiveDef(revisedDefs)
  if (!activeDef) return handlerResult(false, [], { errorMsg: `getActivePerspectiveDef failed` })
  const prevDashboardSettings = await getDashboardSettings()
  // each perspective has its own tagged sections so we don't want to keep old ones around
  // so we will remove all keys from prevDS that start with showTagSection_
  const prevDSWithoutTags = removeInvalidTagSections(prevDashboardSettings)
  if (!prevDSWithoutTags) return handlerResult(false, [], { errorMsg: `getDashboardSettings failed` })
  // apply the new perspective's settings to the main dashboard settings
  const newDashboardSettings = {
    ...prevDSWithoutTags,
    ...(activeDef.dashboardSettings || {}),
    lastChange: `_Switched to perspective ${switchToName} ${dt()} changed from plugin`,
  } // the ending "changed from plugin" is important because it keeps it from sending back
  logDebug(`doSwitchToPerspective`, `saving ${String(revisedDefs.length)} perspectiveDefs and ${String(Object.keys(newDashboardSettings).length)} dashboardSettings`)
  clo(newDashboardSettings, `doSwitchToPerspective: newDashboardSettings=`)
  DataStore.settings = { ...DataStore.settings, perspectiveSettings: JSON.stringify(revisedDefs), dashboardSettings: JSON.stringify(newDashboardSettings) }
  const afterPerspSettings = await getPerspectiveSettings(true)
  logPerspectiveNames(afterPerspSettings, 'doSwitchToPerspective: Persp settings reading back from DataStore.settings:')
  // TODO: @jgclark resetting sections to [] on perspective switch forces a refresh of all enabled sections
  // You may or may not want to get fancy and try to delete the sections that are no longer enabled (e.g. tags)
  // and only refresh the sections that are new
  // But for now, the brute force way seems the most reliable :)
  const updatesToPluginData = {
    perspectiveSettings: revisedDefs,
    dashboardSettings: newDashboardSettings,
    serverPush: { dashboardSettings: true, perspectiveSettings: true },
    sections: [],
    lastChange: `_Switched to perspective ${switchToName} ${dt()} changed from plugin`,
  }
  logDebug(
    `doSwitchToPerspective`,
    `sending revised perspectiveSettings and dashboardSettings to react window after switching to ${data?.perspectiveName || ''} current excludedFolders=${
      newDashboardSettings.excludedFolders ? newDashboardSettings.excludedFolders : 'not set'
    }`,
  )
  logPerspectiveNames(afterPerspSettings, 'doSwitchToPerspective: Sending these perspectiveSettings to react window in pluginData')
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
  logDebug(`doSettingsChanged`, `Saving new Dashboard settings to "-" perspective, setting isModified and isActive to false for all other perspectives`)
  const dashDef = { name: '-', isActive: true, dashboardSettings: cleanDashboardSettings(newDashboardSettings), isModified: false }
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
  const updatedPluginData = { perspectiveSettings: newSettings, dashboardSettings, serverPush: { perspectiveSettings: true, dashboardSettings: true } }
  if (dashboardSettings.perspectivesEnabled) {
    const currentPerspDef = getActivePerspectiveDef(newSettings)
    if (currentPerspDef && currentPerspDef.name !== '-') {
      dashboardSettings = { ...dashboardSettings, ...currentPerspDef.dashboardSettings }
      updatedPluginData.dashboardSettings = dashboardSettings
    }
  }
  const combinedUpdatedSettings = { ...DataStore.settings, perspectiveSettings: JSON.stringify(newSettings), dashboardSettings: JSON.stringify(dashboardSettings) }

  DataStore.settings = combinedUpdatedSettings
  await setPluginData(updatedPluginData, `_Updated perspectiveSettings in global pluginData`)
  return handlerResult(true, ['REFRESH_ALL_ENABLED_SECTIONS'])
}
