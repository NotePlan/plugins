// @flow
//-----------------------------------------------------------------------------
// Control settings for Dashboard
// Last updated 12.5.2024 for v2.0.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  type dashboardConfigType,
  getSettings
} from './dashboardHelpers'
// import { showDashboard } from './HTMLGeneratorGrid'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { saveSettings } from '@helpers/NPConfiguration'

const pluginID = 'jgclark.DashboardReact'

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
    // await showDashboard()
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
    // await showDashboard()
  } catch (error) {
    logError(pluginJson, `toggletoggleMonthSection: ${error.name}: ${error.message}`)
  }
}

/**
 * Toggle showing the 'Tomorrow' section of the dashboard, by changing the setting file
 * and then refreshing the dashboard.
 */
export async function toggleTomorrowSection(): Promise<void> {
  try {
    // Get plugin settings
    const config: dashboardConfigType = await getSettings()
    // logDebug('toggleTomorrowSection', `starting with existing value ${String(config.showTomorrowSection)}`)

    if (config == null || Object.keys(config).length === 0) {
      throw new Error(
        `Cannot find settings for the '${pluginID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`,
      )
    }
    config.showTomorrowSection = !config.showTomorrowSection

    // Save it back
    const res = await saveSettings(pluginID, config)
    // logDebug('toggleTomorrowSection', `result -> ${String(res)}`)
    logDebug('toggleTomorrowSection', `-> new value ${String(config.showTomorrowSection)}`)
    logDebug('toggleTomorrowSection', `------- now Refresh ---------`)
    // await showDashboard()
  } catch (error) {
    logError(pluginJson, `toggleTomorrowSection: ${error.name}: ${error.message}`)
  }
}

/**
 * Toggle showing the 'Quarter' section of the dashboard, by changing the setting file
 * and then refreshing the dashboard.
 */
export async function toggleQuarterSection(): Promise<void> {
  try {
    // Get plugin settings
    const config: dashboardConfigType = await getSettings()
    // logDebug('toggleQuarterSection', `starting with existing value ${String(config.showQuarterSection)}`)

    if (config == null || Object.keys(config).length === 0) {
      throw new Error(
        `Cannot find settings for the '${pluginID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`,
      )
    }
    config.showQuarterSection = !config.showQuarterSection

    // Save it back
    const res = await saveSettings(pluginID, config)
    // logDebug('toggleQuarterSection', `result -> ${String(res)}`)
    logDebug('toggleQuarterSection', `-> new value ${String(config.showQuarterSection)}`)
    logDebug('toggleQuarterSection', `------- now Refresh ---------`)
    // await showDashboard()
  } catch (error) {
    logError(pluginJson, `toggleQuarterSection: ${error.name}: ${error.message}`)
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
    // await showDashboard()
  } catch (error) {
    logError(pluginJson, `toggleWeekSection: ${error.name}: ${error.message}`)
  }
}

/**
 * TODO: Finish me -- if this is still used?
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
/**
 * Turn on all sections of the Dashboard, by changing the setting file
 * and then refreshing the dashboard.
 */
export async function turnOnAllSections(): Promise<void> {
  try {
    // Get plugin settings
    const config: dashboardConfigType = await getSettings()
    logDebug('turnOnAllSections', `starting with existing value ${String(config.showWeekSection)}`)

    if (config == null || Object.keys(config).length === 0) {
      throw new Error(
        `Cannot find settings for the '${pluginID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`,
      )
    }
    config.showYesterdaySection = true
    config.showTomorrowSection = true
    config.showWeekSection = true
    config.showMonthSection = true
    config.showQuarterSection = true
    config.showOverdueTaskSection = true

    // Save it back
    const res = await saveSettings(pluginID, config)
    logDebug('toggleWeekSection', `------- now Refresh ---------`)
    // await showDashboard()
  } catch (error) {
    logError(pluginJson, `turnOnAllSections: ${error.name}: ${error.message}`)
  }
}
