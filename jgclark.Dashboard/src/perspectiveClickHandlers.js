// @flow
//-----------------------------------------------------------------------------
// clickHandlers.js
// Handler functions for dashboard clicks that come over the bridge
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated for v2.1.0.a
//-----------------------------------------------------------------------------
import { addChecklistToNoteHeading, addTaskToNoteHeading } from '../../jgclark.QuickCapture/src/quickCapture'
import { allCalendarSectionCodes, WEBVIEW_WINDOW_ID } from './constants'
import { getTotalDoneCountsFromSections, updateDoneCountsFromChangedNotes } from './countDoneTasks'
import { getDashboardSettings, getNotePlanSettings, handlerResult, mergeSections, moveItemToRegularNote, setPluginData } from './dashboardHelpers'
import { getAllSectionsData, getSomeSectionsData } from './dataGeneration'
import type { MessageDataObject, TBridgeClickHandlerResult, TDashboardSettings, TPluginData, TPerspectiveSettings } from './types'
import { validateAndFlattenMessageObject } from './shared'
import {
  addNewPerspective,
  cleanDashboardSettings,
  deletePerspective,
  getActivePerspectiveDef,
  getPerspectiveNamed,
  getPerspectiveSettings,
  logPerspectives,
  replacePerspectiveDef,
  setActivePerspective,
  switchToPerspective,
  renamePerspective,
  savePerspectiveSettings,
} from './perspectiveHelpers'
import {
  cancelItem,
  completeItem,
  completeItemEarlier,
  deleteItem,
  findParaFromStringAndFilename,
  highlightParagraphInEditor,
  scheduleItem,
  unscheduleItem,
} from '@helpers/NPParagraph'
import { getNPWeekData, type NotePlanWeekInfo } from '@helpers/NPdateTime'
import { openNoteByFilename } from '@helpers/NPnote'
import { calcOffsetDateStr, getDateStringFromCalendarFilename, getTodaysDateHyphenated, RE_DATE, RE_DATE_INTERVAL } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer, dt } from '@helpers/dev'
import { getGlobalSharedData } from '@helpers/HTMLView'
import { cyclePriorityStateDown, cyclePriorityStateUp } from '@helpers/paragraph'
import { showMessage, processChosenHeading } from '@helpers/userInput'

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
  const fromName = data.userInputObj?.fromName ?? ''
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

export async function doSwitchToPerspective(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const switchToName = data?.perspectiveName || ''
  if (!switchToName) {
    logError('doSwitchToPerspective', `No perspective name provided.`)
    return handlerResult(false, [], { errorMsg: `No perspectiveName provided.` })
  }
  const revisedDefs = await switchToPerspective(switchToName, await getPerspectiveSettings())
  if (!revisedDefs) return handlerResult(false, [], { errorMsg: `switchToPerspective failed` })
  const activeDef = getActivePerspectiveDef(revisedDefs)
  if (!activeDef) return handlerResult(false, [], { errorMsg: `getActivePerspectiveDef failed` })
  const prevDashboardSettings = await getDashboardSettings()
  if (!prevDashboardSettings) return handlerResult(false, [], { errorMsg: `getDashboardSettings failed` })
  // apply the new perspective's settings to the main dashboard settings
  const newDashboardSettings = {
    ...prevDashboardSettings,
    ...(activeDef.dashboardSettings || {}),
    lastChange: `_Switched to perspective ${switchToName} ${dt()} changed from plugin`,
  } // the ending "changed from plugin" is important because it keeps it from sending back
  logDebug(`doSwitchToPerspective`, `saving ${String(revisedDefs.length)} perspectiveDefs and ${String(Object.keys(newDashboardSettings).length)} dashboardSettings`)
  clo(newDashboardSettings, `doSwitchToPerspective: newDashboardSettings=`)
  DataStore.settings = { ...DataStore.settings, perspectiveSettings: JSON.stringify(revisedDefs), dashboardSettings: JSON.stringify(newDashboardSettings) }
  const updatesToPluginData = { perspectiveSettings: revisedDefs, dashboardSettings: newDashboardSettings, serverPush: { dashboardSettings: true, perspectiveSettings: true } }
  logDebug(
    `doSwitchToPerspective`,
    `sending revised perspectiveSettings and dashboardSettings to react window after switching to ${data?.perspectiveName || ''} current excludedFolders=${
      newDashboardSettings.excludedFolders
    }`,
  )
  await setPluginData(updatesToPluginData, `_Switched to perspective ${switchToName} in DataStore.settings ${dt()} changed in plugin`)
  return handlerResult(true, ['REFRESH_ALL_SECTIONS'])
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
