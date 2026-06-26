// @flow
//-----------------------------------------------------------------------------
// clickHandlers.js
// Handler functions for dashboard clicks that come over the bridge
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated 2026-06-13 for v2.4.0.b46 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import { getDashboardSettings, handlerResult, setPluginData, getDashboardSettingsDefaults } from './dashboardHelpers'
import { WEBVIEW_WINDOW_ID } from './constants'
import { loadDashboardPluginSettings, saveDashboardPluginSettings } from './dashboardPluginSettings'
import type { MessageDataObject, TBridgeClickHandlerResult, TDashboardSettings, TPerspectiveSettings } from './types'
import { prepareDashboardSettingsForSave, preparePerspectiveSettingsForSave } from './dashboardSettingsClean'
import {
  addNewPerspective,
  cleanDashboardSettingsInAPerspective,
  deletePerspective,
  getActivePerspectiveDef,
  getPerspectiveNamed,
  loadPerspectiveDefsFromPluginSettings,
  logPerspectives,
  replacePerspectiveDef,
  switchToPerspective,
  renamePerspective,
  savePerspectiveSettings,
  mergeDashboardSettingsForPerspectiveDef,
  logPerspectiveNames,
  isNamedPerspectiveModified,
} from './perspectiveHelpers'
import { clo, dt, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { getGlobalSharedData } from '@helpers/HTMLView'

/**
 * Live dashboard settings for perspective save: prefer WebView state (what the user sees), then disk.
 * @param {Partial<TDashboardSettings>} [settingsFromBridge] - optional `data.settings` from React
 * @returns {Promise<TDashboardSettings>}
 */
async function getLiveDashboardSettingsForPerspectiveSave(settingsFromBridge?: Partial<TDashboardSettings>): Promise<TDashboardSettings> {
  if (settingsFromBridge && typeof settingsFromBridge === 'object' && !Array.isArray(settingsFromBridge) && Object.keys(settingsFromBridge).length > 0) {
    const defaults = getDashboardSettingsDefaults()
  // $FlowIgnore[cannot-spread-indexer]
    return { ...defaults, ...settingsFromBridge, showSearchSection: true }
  }
  const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
  const fromReact = reactWindowData?.pluginData?.dashboardSettings
  if (fromReact && typeof fromReact === 'object' && !Array.isArray(fromReact) && Object.keys(fromReact).length > 0) {
    const defaults = getDashboardSettingsDefaults()
  // $FlowIgnore[cannot-spread-indexer]
    return { ...defaults, ...fromReact, showSearchSection: true }
  }
  return getDashboardSettings()
}

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
  const updatesToPluginData = {
    perspectiveSettings: await loadPerspectiveDefsFromPluginSettings(),
    dashboardSettings: await getDashboardSettings(),
    pushFromServer: { dashboardSettings: true, perspectiveSettings: true },
  }
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
  const perspectiveSettings = await loadPerspectiveDefsFromPluginSettings()
  const activeDef = getActivePerspectiveDef(perspectiveSettings)
  if (!activeDef) return handlerResult(false, [], { errorMsg: `getActivePerspectiveDef failed` })
  const newDef = { ...activeDef, name: newName, isModified: false, isActive: false }
  const revisedDefs = replacePerspectiveDef(perspectiveSettings, newDef)
  if (!revisedDefs) return handlerResult(false, [], { errorMsg: `doCopyPerspective failed` })
  const result = await savePerspectiveSettings(revisedDefs)
  if (!result) return handlerResult(false, [], { errorMsg: `savePerspectiveSettings failed` })
  await setPluginData({ perspectiveSettings: revisedDefs }, `_Copied settings to perspective ${newName}`)
  return handlerResult(true, [])
}

export async function doDeletePerspective(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  await deletePerspective(data.perspectiveName)
  let perspectiveSettings = await loadPerspectiveDefsFromPluginSettings()
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
  // clo(data, `doSavePerspective starting ... with mbo`)
  logInfo('doSavePerspective', `Starting for perspective ${data?.perspectiveName || ''}`)
  const perspectiveSettings = await loadPerspectiveDefsFromPluginSettings()
  const activeDef = getActivePerspectiveDef(perspectiveSettings)
  logInfo('doSavePerspective', `- Active perspective: ${activeDef?.name || ''}`)
  if (!activeDef) return handlerResult(false, [], { errorMsg: `getActivePerspectiveDef failed` })
  if (activeDef.name === '-') return handlerResult(false, [], { errorMsg: `Perspective "-" is not allowed to be saved.` })
  const dashboardSettings = await getLiveDashboardSettingsForPerspectiveSave(data?.settings)
  if (!dashboardSettings) return handlerResult(false, [], { errorMsg: `getDashboardSettinFfgs failed` })
  const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
  const dashboardSettingsBaseline = reactWindowData?.pluginData?.dashboardSettingsBaseline
  if (!isNamedPerspectiveModified(activeDef, dashboardSettings, dashboardSettingsBaseline, { forSave: true })) {
    return handlerResult(false, [], { errorMsg: `Perspective ${activeDef.name} is not modified. Not saving.` })
  }

  const cleanedLiveSettings = prepareDashboardSettingsForSave(activeDef.dashboardSettings ?? {}, dashboardSettings, { mergeDefaults: true })
  const newDef = {
    ...activeDef,
    dashboardSettings: cleanDashboardSettingsInAPerspective(cleanedLiveSettings),
    isModified: false,
  }
  const revisedDefs = replacePerspectiveDef(perspectiveSettings, newDef)
  const res = await saveDashboardPluginSettings({
    ...(await loadDashboardPluginSettings()),
    perspectiveSettings: revisedDefs,
    dashboardSettings: cleanedLiveSettings,
  })
  if (!res) return handlerResult(false, [], { errorMsg: `saveDashboardPluginSettings failed` })
  const savedPerspectives = (await loadDashboardPluginSettings()).perspectiveSettings
  const cleanedBaseline = cleanDashboardSettingsInAPerspective(cleanedLiveSettings)
  await setPluginData(
    {
      perspectiveSettings: Array.isArray(savedPerspectives) ? savedPerspectives : revisedDefs,
      dashboardSettings: cleanedLiveSettings,
      dashboardSettingsBaseline: cleanedBaseline,
      pushFromServer: { dashboardSettings: true, perspectiveSettings: true },
    },
    `_Saved perspective ${activeDef.name}`,
  )
  return handlerResult(true, ['CLOSE_UNNEEDED_SECTIONS', 'REFRESH_ALL_ENABLED_SECTIONS'])
}

/**
 * Save the active modified perspective, then switch to another (single bridge round-trip avoids save/switch race).
 * @param {MessageDataObject} data - must include `switchToPerspectiveName` (target) and optional `perspectiveName` (active, for save)
 * @returns {Promise<TBridgeClickHandlerResult>}
 */
export async function doSavePerspectiveAndSwitchToPerspective(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const switchToName = data?.switchToPerspectiveName || ''
  if (!switchToName) {
    return handlerResult(false, [], { errorMsg: `doSavePerspectiveAndSwitchToPerspective: switchToPerspectiveName is required.` })
  }
  const saveResult = await doSavePerspective(data)
  if (!saveResult.success) {
    return saveResult
  }
  return doSwitchToPerspective({ ...data, perspectiveName: switchToName })
}

export async function doRenamePerspective(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  clo(data, `doRenamePerspective starting ... with mbo`)
  const origName = (data.userInputObj?.oldName ?? '').trim()
  const newName = (data.userInputObj?.newName ?? '').trim()
  if (origName === '') return handlerResult(false, [], { errorMsg: `doRenamePerspective: origName is empty` })
  if (newName === '') return handlerResult(false, [], { errorMsg: `doRenamePerspective: newName is empty` })
  if (origName === newName) return handlerResult(false, [], { errorMsg: `doRenamePerspective: new name is the same as the current name` })
  if (origName === '-') return handlerResult(false, [], { errorMsg: `Perspective "-" cannot be renamed` })
  if (newName === '-') return handlerResult(false, [], { errorMsg: `Perspectives cannot be renamed to "-".` })
  const perspectiveSettings = await loadPerspectiveDefsFromPluginSettings()
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
  const ps = await loadPerspectiveDefsFromPluginSettings()
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

  const dashboardSettingsDefaults = getDashboardSettingsDefaults()
  const newDashboardSettings = mergeDashboardSettingsForPerspectiveDef(
    activeDef,
    prevDashboardSettings,
    dashboardSettingsDefaults,
    `_Switched to perspective ${switchToName} ${dt()} changed from plugin`,
  )
  logDebug(`doSwitchToPerspective`, `saving ${String(revisedDefs.length)} perspectiveDefs and ${String(Object.keys(newDashboardSettings).length)} dashboardSettings`)

  // Use helper to save settings from now on, not unreliable `DataStore.settings = {...}`
  const res = await saveDashboardPluginSettings({
    ...(await loadDashboardPluginSettings()),
    perspectiveSettings: revisedDefs,
    dashboardSettings: newDashboardSettings,
  })
  if (!res) {
    return handlerResult(false, [], { errorMsg: `saveDashboardPluginSettings failed` })
  }

  const savedPerspectives = (await loadDashboardPluginSettings()).perspectiveSettings
  const perspectiveSettingsForPlugin = Array.isArray(savedPerspectives) ? savedPerspectives : revisedDefs

  // TODO: @jgclark resetting sections to [] on perspective switch forces a refresh of all enabled sections
  // You may or may not want to get fancy and try to delete the sections that are no longer enabled (e.g. tags)
  // and only refresh the sections that are new
  // But for now, the brute force way seems the most reliable :)
  const updatesToPluginData = {
    perspectiveChanging: true,
    perspectiveSettings: perspectiveSettingsForPlugin,
    dashboardSettings: newDashboardSettings,
    dashboardSettingsBaseline: newDashboardSettings,
    pushFromServer: { dashboardSettings: true, perspectiveSettings: true },
    sections: [],
    lastChange: `_Switched to perspective ${switchToName} ${dt()} changed from plugin`,
  }
  logDebug(`doSwitchToPerspective`, `sending revised perspectiveSettings and dashboardSettings to react window after switching to '${data?.perspectiveName || ''}'. Current excludedFolders=${newDashboardSettings.excludedFolders ? newDashboardSettings.excludedFolders : 'not set'}`)
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
  const dashDef = { name: '-', isActive: true, dashboardSettings: newDashboardSettings, isModified: false }
  return replacePerspectiveDef(perspectiveSettings, dashDef).map((p) => (p.name === '-' ? p : { ...p, isModified: false, isActive: false }))
}

/**
 * Update perspectiveSettings in DataStore.settings
 * @param {MessageDataObject} data - a MDO that should have a key "settings" with the items to be set to the settingName key
 * @returns {TBridgeClickHandlerResult}
 */
export async function doSavePerspectiveSettingsFromBridge(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  clo(data, `doSavePerspectiveSettingsFromBridge() starting with data = `)
  const newSettings = data.settings
  if (!DataStore.settings || !newSettings || !Array.isArray(newSettings)) {
    return handlerResult(false, [], { errorMsg: `doSavePerspectiveSettingsFromBridge: newSettings is null or undefined.` })
  }

  const pluginSettingsBeforeSave = await loadDashboardPluginSettings()
  const priorPerspectiveSettings = pluginSettingsBeforeSave?.perspectiveSettings ?? []
  const syncedSettings = preparePerspectiveSettingsForSave(
    Array.isArray(priorPerspectiveSettings) ? priorPerspectiveSettings : [],
    newSettings,
  )

  let dashboardSettings = await getDashboardSettings()
  if (!dashboardSettings) return handlerResult(false, [], { errorMsg: `getDashboardSettings failed` })
  const updatedPluginData = { perspectiveSettings: syncedSettings, dashboardSettings, pushFromServer: { perspectiveSettings: true, dashboardSettings: true } }
  if (dashboardSettings.usePerspectives) {
    const currentPerspDef = getActivePerspectiveDef(syncedSettings)
    if (currentPerspDef && currentPerspDef.name !== '-') {
      dashboardSettings = mergeDashboardSettingsForPerspectiveDef(currentPerspDef, dashboardSettings, getDashboardSettingsDefaults())
      updatedPluginData.dashboardSettings = dashboardSettings
    }
  }
  const combinedUpdatedSettings = {
    ...pluginSettingsBeforeSave,
    perspectiveSettings: syncedSettings,
    dashboardSettings: dashboardSettings,
  }

  // Note: Use helper to save settings from now on, not unreliable `DataStore.settings = combinedUpdatedSettings`
  const res = await saveDashboardPluginSettings(combinedUpdatedSettings)
  if (!res) {
    return handlerResult(false, [], { errorMsg: `saveDashboardPluginSettings failed` })
  }
  const savedPerspectives = (await loadDashboardPluginSettings()).perspectiveSettings
  if (Array.isArray(savedPerspectives)) {
    updatedPluginData.perspectiveSettings = savedPerspectives
  }
  await setPluginData(updatedPluginData, `_Updated perspectiveSettings in global pluginData`)
  return handlerResult(true, ['REFRESH_ALL_ENABLED_SECTIONS'])
}
