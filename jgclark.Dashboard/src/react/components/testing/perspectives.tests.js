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

// Helper functions for repeated use in tests

const getDashboardSettingsWithShowVarsSetTo = (dashboardSettings: Object, showValue: boolean): Object => {
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

const sendDashboardSettingsToPlugin = (sendActionToPlugin, newDashboardSettings, message) => {
  const mbo = {
    actionType: `dashboardSettingsChanged`,
    settings: newDashboardSettings,
  }
  console.log(`Sending this mbo to the plugin`, mbo)
  sendActionToPlugin('dashboardSettingsChanged', mbo, message)
}

// Backup and restore utility functions

const backupCurrentSettings = (getContext) => {
  const context = getContext()
  const backupDashboardSettings = { ...context.dashboardSettings }
  const backupPerspectiveSettings = [...context.perspectiveSettings]
  return [backupDashboardSettings, backupPerspectiveSettings]
}

const restoreSettings = async (getContext, backupDashboardSettings, backupPerspectiveSettings) => {
  // Use getContext() directly
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

// Tests start here

export default {
  groupName: 'Perspectives Tests',
  tests: [
    {
      name: 'Perspective: Switch to Home (via plugin) -- you have to have a Home and Work perspective for this to work',
      test: async (getContext: () => AppContextType): Promise<void> => {
        const [backupDashboardSettings, backupPerspectiveSettings] = backupCurrentSettings(getContext)
        try {
          // Verify that 'Home' perspective exists
          const homePerspective = getContext().perspectiveSettings.find((p) => p.name === 'Home')
          expect(homePerspective).not.toBeUndefined('Home perspective does not exist')

          // Switch to 'Home' perspective using getContext() directly
          getContext().sendActionToPlugin(
            'switchToPerspective',
            {
              perspectiveName: 'Home',
              actionType: 'switchToPerspective',
              logMessage: `Perspective changed to Home`,
            },
            `Perspective changed to Home`,
          )
          // Wait until 'Home' perspective is active
          await waitFor(
            () => {
              const updatedPerspective = getContext().perspectiveSettings.find((p) => p.name === 'Home' && p.isActive === true && p.isModified === false)
              return updatedPerspective !== undefined
            },
            'Home perspective to be active',
            5000,
            100,
          )

          // Verify that 'Home' perspective is now active
          const updatedPerspective = getContext().perspectiveSettings.find((p) => p.name === 'Home' && p.isActive === true && p.isModified === false)
          expect(updatedPerspective).not.toBeUndefined('Active home perspective (assumes you have a home perspective)')
        } catch (error) {
          throw error
        } finally {
          // Restore settings using getContext() directly
          await restoreSettings(getContext, backupDashboardSettings, backupPerspectiveSettings)
        }
      },
    },

    {
      name: 'Perspective: Switch to Work (via plugin) -- you have to have a Home and Work perspective for this to work',
      test: async (getContext: () => AppContextType): Promise<void> => {
        const [backupDashboardSettings, backupPerspectiveSettings] = backupCurrentSettings(getContext)
        try {
          const context = getContext()
          const sendActionToPlugin = context.sendActionToPlugin
          // Now change it back to Work
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
          // Check that the perspective is switched to Work
          const updatedSettings = getContext().perspectiveSettings.find((p) => p.name === 'Work' && p.isActive === true)
          expect(updatedSettings).not.toBeUndefined('Work .isActive') // Make sure Work is active
          const updatedSettings2 = getContext().perspectiveSettings.find((p) => p.name === 'Home' && p.isActive === true)
          expect(updatedSettings2).toBeUndefined('Home .isActive') // Make sure Home is not active
        } catch (error) {
          throw error
        } finally {
          await restoreSettings(getContext, backupDashboardSettings, backupPerspectiveSettings)
        }
      },
    },
    {
      name: 'Perspective: Loop through multiple perspectives and verify that they loaded correctly',
      test: async (getContext: () => AppContextType): Promise<void> => {
        const [backupDashboardSettings, backupPerspectiveSettings] = backupCurrentSettings(getContext)
        try {
          const NUM_PERSPECTIVES = 5
          const allOffSettings = getDashboardSettingsWithShowVarsSetTo(dashboardSettingsDefaults, false)
          const msg = `Testing_Perspectives: Turning all off`
          const newSettings = { ...allOffSettings, perspectivesEnabled: true, lastChange: msg }

          // Save the all-off settings
          getContext().dispatchDashboardSettings({
            type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS,
            payload: newSettings,
            reason: msg,
          })

          // Wait until the dashboard settings have been updated
          await waitFor(
            () => {
              const c = getContext()
              console.log(`waiting for dashboardSettings.lastChange: ${c.dashboardSettings.lastChange}`)
              return c.dashboardSettings.lastChange === `Testing_Perspectives: Turning all off`
            },
            'dashboardSettings to be updated',
            6000,
            100,
          )

          console.log(`All-off settings applied; now setting up ${NUM_PERSPECTIVES} perspectives`)

          const perspectives = []
          const currentDashboardSettings = { ...getContext().dashboardSettings }

          for (let i = 0; i < NUM_PERSPECTIVES; i++) {
            const perspectiveDashboardSettings = { ...currentDashboardSettings, excludedFolders: `${i}` }
            const perspective = {
              name: `Perspective ${i}`,
              isActive: false,
              isModified: false,
              dashboardSettings: perspectiveDashboardSettings,
            }
            perspectives.push(perspective)
          }
          perspectives[0].isActive = true

          // Send the new perspectives to the plugin
          getContext().sendActionToPlugin(
            'perspectiveSettingsChanged',
            {
              settings: perspectives,
              actionType: 'perspectiveSettingsChanged',
              logMessage: `Perspectives initialized`,
            },
            `Perspectives initialized`,
          )

          // Wait until the perspectives have been updated
          await waitFor(
            () => {
              const c = getContext()
              return c.perspectiveSettings.some((p) => p.name === 'Perspective 0')
            },
            'perspectiveSettings to be updated',
            5000,
            100,
          )

          for (let i = 0; i < NUM_PERSPECTIVES; i++) {
            // Switch to the perspective
            getContext().sendActionToPlugin(
              'switchToPerspective',
              {
                perspectiveName: `Perspective ${i}`,
                actionType: 'switchToPerspective',
                logMessage: `Perspective changed to ${perspectives[i].name}`,
              },
              `Perspective changed to ${perspectives[i].name}`,
            )

            // Wait until the dashboardSettings.excludedFolders equals the expected value
            await waitFor(
              () => {
                const efStr = getContext().dashboardSettings.excludedFolders
                return efStr === `${i}`
              },
              `dashboardSettings.excludedFolders to equal "${i}"`,
              5000,
              100,
            )

            const efStr = getContext().dashboardSettings.excludedFolders
            expect(efStr).toEqual(`${i}`, `DashboardSettings had excludedFolders set incorrectly during perspective switch to ${perspectives[i].name}`)
            logDebug(`Passed: DashboardSettings had excludedFolders set to "${efStr}" during perspective switch to ${perspectives[i].name}`)

            const ps = getContext().perspectiveSettings.find((p) => p.name === perspectives[i].name)
            expect(ps).not.toBeUndefined(`Perspective ${perspectives[i].name} was not found`)
            expect(ps.isModified).toBeFalsy(`Perspective ${perspectives[i].name} was modified, but should not be when switching to it`)
            logDebug(`Passed: Perspective ${perspectives[i].name} was not modified`)
          }
        } catch (error) {
          throw error
        } finally {
          await restoreSettings(getContext, backupDashboardSettings, backupPerspectiveSettings)
        }
      },
    },
  ],
}
