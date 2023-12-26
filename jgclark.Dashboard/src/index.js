// @flow

// ----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated 26.12.2023 for v0.7.5, @jgclark
// ----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { showDashboardHTML } from './main'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getPluginJson, pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'
import { isHTMLWindowOpen, logWindowsList } from '@helpers/NPWindows'
import { showMessage } from '@helpers/userInput'

// import { getNPWeekData } from '@helpers/NPdateTime'
import { getDateStringFromCalendarFilename } from '@helpers/dateTime'
import moment from 'moment/min/moment-with-locales'

export { getDemoDataForDashboard } from './demoDashboard'
export { addTask, addChecklist, refreshDashboard, showDashboardHTML, showDemoDashboardHTML, resetDashboardWinSize } from './main'
export { decideWhetherToUpdateDashboard } from './dashboardTriggers'
export { onMessageFromHTMLView } from './pluginToHTMLBridge'
export { getDataForDashboard, logDashboardData } from './dataGeneration'

const thisPluginID = 'jgclark.Dashboard'

/**
 * Check things each time this plugin's commands are run
 */
export async function init(): Promise<void> {
  try {
    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message
    DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false)
  } catch (error) {
    logError(`${thisPluginID}/init`, JSP(error))
  }
}

export async function onSettingsUpdated(): Promise<any> {
  // TODO: Remove this temporary alternative
  const today = new moment().toDate()
  const currentWeeklyNote = DataStore.calendarNoteByDate(today, 'week')
  const thisFilename = currentWeeklyNote?.filename ?? '(error)'
  const dateStr = getDateStringFromCalendarFilename(thisFilename)
  logDebug('test', `currentWeeklyNote: ${thisFilename}`)
  logDebug('test', `dateStr: ${dateStr}`)

  // if (!isHTMLWindowOpen(pluginJson['plugin.id'])) {
  //   await showDashboardHTML('refresh', false) // don't need await in the case I think
  // }
}

export async function onUpdateOrInstall(): Promise<void> {
  try {
    // Tell user the plugin has been updated
    if (pluginJson['plugin.lastUpdateInfo'] !== undefined) {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks', `Plugin ${pluginJson['plugin.name']}\nupdated to v${pluginJson['plugin.version']}`)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Update Settings/Preferences (for iOS etc)
 * Plugin entrypoint for command: "/<plugin>: Update Plugin Settings/Preferences"
 * @author @dwertheimer
 */
export async function updateSettings() {
  try {
    logDebug(pluginJson, `updateSettings running`)
    const res = await editSettings(pluginJson)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
