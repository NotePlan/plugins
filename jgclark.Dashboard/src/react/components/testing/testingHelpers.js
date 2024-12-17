// @flow
import type { AppContextType } from '../AppContext'
import { DASHBOARD_ACTIONS } from '../../reducers/actionTypes'
import { waitFor } from '@helpers/testing/testingUtils'

// Helper functions for repeated use in tests

export const sendDashboardSettingsToPlugin = (sendActionToPlugin, newDashboardSettings, message: string) => {
  const mbo = {
    actionType: `dashboardSettingsChanged`,
    settings: newDashboardSettings,
  }
  console.log(`sending this mbo to the plugin`, mbo)
  sendActionToPlugin('dashboardSettingsChanged', mbo, message)
}

export const getDashboardSettingsWithShowVarsSetTo = (getContext: () => AppContextType, showValue: boolean): Object => {
  const dashboardSettings = getContext().dashboardSettings
  return Object.keys(dashboardSettings).reduce(
    (acc, key) => {
      if (key.startsWith('show')) {
        acc[key] = showValue
      }
      if (key === 'showPrioritySection') {
        acc[key] = false // This one is too slow to ever turn on
      }
      return acc
    },
    { ...dashboardSettings },
  )
}

// Backup and restore utility functions

export const backupCurrentSettings = (getContext: () => AppContextType): [Object, Array<Object>] => {
  const context = getContext()
  const backupDashboardSettings = { ...context.dashboardSettings }
  const backupPerspectiveSettings = [...context.perspectiveSettings]
  return [backupDashboardSettings, backupPerspectiveSettings]
}

export const restoreSettings = async (getContext, backupDashboardSettings, backupPerspectiveSettings) => {
  // Use getContext() directly
  console.log(`Restoring backup settings`)
  getContext().dispatchDashboardSettings({
    type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS,
    payload: { ...backupDashboardSettings, lastChange: 'Restoring backup settings' },
    reason: 'Restoring backup settings',
  })
  await waitFor(1000) // Wait for the settings to be applied
  getContext().sendActionToPlugin(
    'perspectiveSettingsChanged',
    {
      settings: backupPerspectiveSettings,
      actionType: 'perspectiveSettingsChanged',
      logMessage: `Restoring perspective settings`,
    },
    `Restoring perspective settings`,
  )
  await waitFor(1000)
}

export async function setMinimumDashboardSettings(getContext: () => AppContextType, additionalOverrides: Object) {
  const minimalSettings = { ...getDashboardSettingsWithShowVarsSetTo(getContext, false), ...additionalOverrides }
  getContext().dispatchDashboardSettings({ type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS, payload: minimalSettings, reason: 'Setting minimum dashboard settings' })
}
