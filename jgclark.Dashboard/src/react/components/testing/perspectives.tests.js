// @flow

import { expect } from '@helpers/testing/expect'
import { type TestResult, waitFor } from '@helpers/testing/testingUtils'
import { clo, logDebug } from '@helpers/react/reactDev'
import { DASHBOARD_ACTIONS } from '../../reducers/actionTypes'
import type { AppContextType } from '../AppContext'
import { dashboardSettingsDefaults } from '../../support/settingsHelpers'

type Test = {
  name: string,
  test: (getContext: () => AppContextType) => Promise<void>,
}

type TestGroup = {
  groupName: string,
  tests: Array<Test>,
}

// helper functions for repeated use in tests

const getDashboardSettingsWithShowVarsSetTo = (dashboardSettings: Object, showValue: boolean): Object => {
  return Object.keys(dashboardSettings).reduce(
    (acc, key) => {
      if (key.startsWith('show')) {
        acc[key] = showValue
      }
      if (key === 'showPrioritySection') {
        acc[key] = false // this one is too slow to ever turn on
      }
      return acc
    },
    { ...dashboardSettings },
  )
}

const sendDashboardSettingsToPlugin = (sendActionToPlugin, newDashboardSettings, message) => {
  const mbo = {
    actionType: `dashboardSettingsChanged`,
    settings: newDashboardSettings,
  }
  console.log(`sending this mbo to the plugin`, mbo)
  sendActionToPlugin('dashboardSettingsChanged', mbo, message)
}

// tests start here

export default {
  groupName: 'Perspectives Tests',
  tests: [
    {
      name: 'Perspective: Switch to Home (via plugin) -- you have to have a Home and Work perspective for this to work',
      test: async (getContext: () => AppContextType): Promise<void> => {
        let context = getContext()
        const sendActionToPlugin = context.sendActionToPlugin
        sendActionToPlugin(
          'switchToPerspective',
          {
            perspectiveName: 'Home',
            actionType: 'switchToPerspective',
            logMessage: `Perspective changed to Home`,
          },
          `Perspective changed to Home`,
        )
        // wait for the perspective to be switched to Home
        await waitFor(3000) // context will be stale after this
        context = getContext() // so get the latest context after the waitFor
        // or just include the call in the expect statement
        const updatedPerspective = getContext().perspectiveSettings.find((p) => p.name === 'Home' && p.isActive === true && p.isModified === false)
        expect(updatedPerspective).not.toBeUndefined('Active home perspective (assumes you have a home perspective)')
      },
    },
    {
      name: 'Perspective: Switch to Work (via plugin) -- you have to have a Home and Work perspective for this to work',
      test: async (getContext: () => AppContextType): Promise<void> => {
        let context = getContext()
        const sendActionToPlugin = context.sendActionToPlugin
        // now change it back to Work
        sendActionToPlugin(
          'switchToPerspective',
          {
            perspectiveName: 'Work',
            actionType: 'switchToPerspective',
            logMessage: `Perspective changed to Work`,
          },
          `Perspective changed to Work`,
        )
        await waitFor(3000)
        context = getContext() // so get the latest context after the waitFor
        // check another way that the perspective is switched to Work
        const updatedSettings = context.perspectiveSettings.find((p) => p.name === 'Work' && p.isActive === true)
        expect(updatedSettings).not.toBeUndefined('Work .isActive') // make sure Work is active
        const updatedSettings2 = context.perspectiveSettings.find((p) => p.name === 'Home' && p.isActive === true)
        expect(updatedSettings2).toBeUndefined('Home .isActive') // make sure Home is active
      },
    },
    {
      name: 'Perspective: Loop through multiple perspectives and verify that they loaded correctly',
      test: async (getContext: () => AppContextType): Promise<void> => {
        const NUM_PERSPECTIVES = 5
        let failed = '' // we can't use expect in this test because it throws an error and stops the test, but we need to restore the original settings
        let context = getContext()
        const sendActionToPlugin = context.sendActionToPlugin
        const oldSettings = context.dashboardSettings
        const oldPerspectiveSettings = context.perspectiveSettings
        const allOffSettings = getDashboardSettingsWithShowVarsSetTo(dashboardSettingsDefaults, false)
        const msg = `_Testing_Perspectives: Turning all off`
        const newSettings = { ...allOffSettings, perspectivesEnabled: true, lastChange: msg }
        // save the all off settings
        context.dispatchDashboardSettings({ type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS, payload: newSettings, reason: msg })
        // wait until the setting has been applied - should turn off all s
        await waitFor(2000)
        const c = getContext()
        if (c.dashboardSettings.lastChange !== msg) {
          failed = `Turning all sections off did not work; lastChange was ${c.dashboardSettings.lastChange}`
        }

        if (!failed) {
          console.log(`all off settings applied; now setting up 10 perspectives`)
          let perspectives = []
          for (let i = 0; i < NUM_PERSPECTIVES; i++) {
            const perspective = { name: `Perspective ${i}`, isActive: false, isModified: false, dashboardSettings: { excludedFolders: `${i}` } }
            perspectives.push(perspective)
          }
          perspectives[0].isActive = true
          context.sendActionToPlugin(
            'perspectiveSettingsChanged',
            { settings: perspectives, actionType: 'perspectiveSettingsChanged', logMessage: `Perspective changed to ${perspectives[0].name}` },
            `Perspective changed to  ${perspectives[0].name}`,
          )
          await waitFor(2000)

          const ef = () => {
            const c = getContext()
            return c.dashboardSettings.excludedFolders
          }

          for (let i = 0; i < NUM_PERSPECTIVES; i++) {
            context = getContext()
            context.sendActionToPlugin(
              'switchToPerspective',
              { perspectiveName: `Perspective ${i}`, actionType: 'switchToPerspective', logMessage: `Perspective changed to ${perspectives[i].name}` },
              `Perspective changed to  ${perspectives[i].name}`,
            )
            await waitFor(3000)
            const efStr = ef()
            if (efStr !== `${i}`) {
              failed = `FAILED: DashboardSettings had excludedFolders set to "${efStr}" during perspective switch to ${perspectives[i].name}`
              console.log(`FAILED: DashboardSettings had excludedFolders set to "${efStr}" during perspective switch to ${perspectives[i].name}`)
              break
            } else {
              logDebug(`Passed: DashboardSettings had excludedFolders set to "${efStr}" during perspective switch to ${perspectives[i].name}`)
            }
            const ps = getContext().perspectiveSettings.find((p) => p.name === perspectives[i].name)
            if (!ps || ps.isModified) {
              failed = `FAILED: Perspective ${perspectives[i].name} was modified, but should not be when switching to it`
              console.log(`FAILED: Perspective ${perspectives[i].name} was modified`)
              break
            } else {
              logDebug(`Passed: Perspective ${perspectives[i].name} was not modified`)
            }
          }
        }
        // restore it all
        context.dispatchDashboardSettings({
          type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS,
          payload: { ...oldSettings, lastChange: '_Restoring changed from plugin' },
          reason: `_Restoring changed from plugin`,
        })
        await waitFor(1000)
        sendActionToPlugin(
          'perspectiveSettingsChanged',
          { settings: oldPerspectiveSettings, actionType: 'perspectiveSettingsChanged', logMessage: `Perspective changed to ${getContext().perspectiveSettings[0].name}` },
          `Restoring original settings`,
        )
        if (failed) {
          throw new Error(failed)
        }
      },
    },
  ],
}
