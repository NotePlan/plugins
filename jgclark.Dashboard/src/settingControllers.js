// @flow
//-----------------------------------------------------------------------------
// Control settings for Dashboard
// Last updated 22.3.2024 for v1.0.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  type dashboardConfigType,
  getSettings
} from './dashboardHelpers'
import { showDashboard } from './HTMLGeneratorGrid'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { saveSettings } from '@helpers/NPConfiguration'

const pluginID = 'jgclark.Dashboard'

/**
 * Toggle showing the 'Overdue' section of the dashboard, by changing the setting file
 * and then refreshing the dashboard.
 */
export async function toggleOverdueSection(): Promise<void> {
  try {
    // Get plugin settings
    const config: dashboardConfigType = await getSettings()
    logDebug('toggleOverdueSection', `starting with existing value ${String(config.showOverdueTaskSection)}`)

    if (config == null || Object.keys(config).length === 0) {
      throw new Error(
        `Cannot find settings for the '${pluginID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`,
      )
    }
    config.showOverdueTaskSection = !config.showOverdueTaskSection

    // Save it back
    const res = await saveSettings(pluginID, config)
    // logDebug('toggleOverdueSection', `result -> ${String(res)}`)
    logDebug('toggleOverdueSection', `-> new value ${String(config.showOverdueTaskSection)}`)
    logDebug('toggleOverdueSection', `------- now Refresh ---------`)
    await showDashboard()
  } catch (error) {
    logError(pluginJson, `toggleOverdueSection: ${error.name}: ${error.message}`)
  }
}

/**
 * Toggle showing the 'Month' section of the dashboard, by changing the setting file
 * and then refreshing the dashboard.
 */
export async function toggleMonthSection(): Promise<void> {
  try {
    // Get plugin settings
    const config: dashboardConfigType = await getSettings()
    logDebug('toggletoggleMonthSection', `starting with existing value ${String(config.showMonthSection)}`)

    if (config == null || Object.keys(config).length === 0) {
      throw new Error(
        `Cannot find settings for the '${pluginID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`,
      )
    }
    config.showMonthSection = !config.showMonthSection

    // Save it back
    const res = await saveSettings(pluginID, config)
    // logDebug('toggletoggleMonthSection', `result -> ${String(res)}`)
    logDebug('toggleMonthSection', `-> new value ${String(config.showMonthSection)}`)
    logDebug('toggleMonthSection', `------- now Refresh ---------`)
    await showDashboard()
  } catch (error) {
    logError(pluginJson, `toggletoggleMonthSection: ${error.name}: ${error.message}`)
  }
}

/**
 * Toggle showing the 'Week' section of the dashboard, by changing the setting file
 * and then refreshing the dashboard.
 */
export async function toggleWeekSection(): Promise<void> {
  try {
    // Get plugin settings
    const config: dashboardConfigType = await getSettings()
    // logDebug('toggleWeekSection', `starting with existing value ${String(config.showWeekSection)}`)

    if (config == null || Object.keys(config).length === 0) {
      throw new Error(
        `Cannot find settings for the '${pluginID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`,
      )
    }
    config.showWeekSection = !config.showWeekSection

    // Save it back
    const res = await saveSettings(pluginID, config)
    // logDebug('toggleWeekSection', `result -> ${String(res)}`)
    logDebug('toggleWeekSection', `-> new value ${String(config.showWeekSection)}`)
    logDebug('toggleWeekSection', `------- now Refresh ---------`)
    await showDashboard()
  } catch (error) {
    logError(pluginJson, `toggleWeekSection: ${error.name}: ${error.message}`)
  }
}

/**
 * ???
 * Note: A little different from the above, as this already had an existing UI element
 * and override on the settings.
 */
export async function togglePriorityFilter(): Promise<void> {
  try {
    // Get plugin settings
    const config: dashboardConfigType = await getSettings()
    logDebug('togglePriorityFilter', `starting with existing value ${String(config.showWeekSection)}`)

    if (config == null || Object.keys(config).length === 0) {
      throw new Error(
        `Cannot find settings for the '${pluginID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`,
      )
    }
    config.showWeekSection = !config.showWeekSection

    // Save it back
    const res = await saveSettings(pluginID, config)
    logDebug('togglePriorityFilter', `result -> ${String(res)}`)
    logDebug('togglePriorityFilter', `ending with existing value ${String(config.showWeekSection)}`)
  } catch (error) {
    logError(pluginJson, `togglePriorityFilter: ${error.name}: ${error.message}`)
  }
}
