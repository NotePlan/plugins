// @flow

import { expect } from '@np/helpers/testing/expect'
import { type TestResult, waitFor } from '@np/helpers/testing/testingUtils'
import { clo, logDebug } from '@np/helpers/react/reactDev'
import { DASHBOARD_ACTIONS } from '../../reducers/actionTypes'
import type { AppContextType } from '../AppContext'
import { dashboardSettingsDefaults } from '../../support/settingsHelpers'
import { sendDashboardSettingsToPlugin, getDashboardSettingsWithShowVarsSetTo } from './testingHelpers'

type Test = {
  name: string,
  test: (getContext: () => AppContextType) => Promise<void>,
}

type TestGroup = {
  groupName: string,
  tests: Array<Test>,
}

// tests start here

export default {
  groupName: 'Dashboard Settings Tests',
  tests: [
    {
      name: `Set Dashboard Settings in plugin (turn all sections off)`,
      test: async (getContext: () => AppContextType, { pause }: { pause: (msg?: string) => Promise<void> }): Promise<void> => {
        const sendActionToPlugin = getContext().sendActionToPlugin
        const newDashboardSettings = getDashboardSettingsWithShowVarsSetTo(getContext, false)
        newDashboardSettings.lastChange = `Turning all sections off`
        sendDashboardSettingsToPlugin(sendActionToPlugin, newDashboardSettings, `Turning all sections off`)

        const testFunc = () =>
          Object.keys(getContext().dashboardSettings)
            .filter((key) => key.startsWith('show'))
            .every((key) => getContext().dashboardSettings[key] === false)
        await waitFor(testFunc, 'dashboardSettings.show* settings are false')
      },
    },
    {
      name: `Set Dashboard Settings in plugin (turn all sections on)`,
      test: async (getContext: () => AppContextType, { pause }: { pause: (msg?: string) => Promise<void> }): Promise<void> => {
        const sendActionToPlugin = getContext().sendActionToPlugin
        const newDashboardSettings = getDashboardSettingsWithShowVarsSetTo(getContext, true)
        newDashboardSettings.lastChange = `Turning all sections on`
        newDashboardSettings.showPrioritySection = false // this one is too slow to turn on
        sendDashboardSettingsToPlugin(sendActionToPlugin, newDashboardSettings, `Turning all sections on`)

        const testFunc = () =>
          Object.keys(getContext().dashboardSettings)
            .filter((key) => key.startsWith('show'))
            .every((key) => getContext().dashboardSettings[key] === (key === 'showPrioritySection' ? false : true))
        await waitFor(testFunc, 'dashboardSettings.show* settings are false')
      },
    },
    {
      name: `Set Dashboard Settings in react (turn all sections off -- false)`,
      test: async (getContext: () => AppContextType, { pause }: { pause: (msg?: string) => Promise<void> }): Promise<void> => {
        let context = getContext()
        const newDashboardSettings = getDashboardSettingsWithShowVarsSetTo(getContext, false)
        newDashboardSettings.lastChange = `Turning all sections off (false)`
        context.dispatchDashboardSettings({ type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS, payload: newDashboardSettings })

        const testFunc = () =>
          Object.keys(getContext().dashboardSettings)
            .filter((key) => key.startsWith('show'))
            .every((key) => getContext().dashboardSettings[key] === false)
        await waitFor(testFunc, 'dashboardSettings.show* settings are false', 5000)
      },
    },
    {
      name: `Set Dashboard Settings in react (turn all sections on -- true)`,
      test: async (getContext: () => AppContextType, { pause }: { pause: (msg?: string) => Promise<void> }): Promise<void> => {
        let context = getContext()
        const newDashboardSettings = getDashboardSettingsWithShowVarsSetTo(getContext, true)
        newDashboardSettings.lastChange = `Turning all sections on`
        newDashboardSettings.showPrioritySection = false // This one is too slow to turn on

        console.log('Sending this to dispatch DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS:', { newDashboardSettings })
        context.dispatchDashboardSettings({
          type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS,
          payload: newDashboardSettings,
        })
        // Yield control to allow React to process the update
        await new Promise((resolve) => setTimeout(resolve, 0))
        const testFunc = () =>
          Object.keys(getContext().dashboardSettings)
            .filter((key) => key.startsWith('show'))
            .every((key) => getContext().dashboardSettings[key] === (key === 'showPrioritySection' ? false : true))
        await waitFor(testFunc, 'dashboardSettings.show* settings are true', 20000)
      },
    },
  ],
}
