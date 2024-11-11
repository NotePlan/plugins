// @flow

import { expect } from '@helpers/testing/expect'
import { type TestResult, waitFor } from '@helpers/testing/testingUtils'
import { clo, logDebug } from '@helpers/react/reactDev'
import { DASHBOARD_ACTIONS } from '../../reducers/actionTypes'

type ContextType = {
  sendActionToPlugin: (command: string, dataToSend: any, details?: string, updateGlobalData?: boolean) => void,
  perspectiveSettings: Array<any>,
  dashboardSettings: { [string]: any },
  dispatchDashboardSettings: (action: any) => void,
  [string]: any,
}

/**
 * Returns an array of test functions.
 *
 * @param {ContextType} context - The application context providing necessary functions and variables.
 * @returns {Array<{name: string, test: () => Promise<void>}>} An array of test objects with names and test functions.
 */
export const getTests = (context: ContextType): (Array<{ name: string, test: () => Promise<void> }>) => {
  // IMPORTANT NOTE: DO NOT DESTRUCTURE ANY CONTEXT VARIABLES THAT COULD CHANGE DURING THE TESTS
  // BECAUSE ONCE YOU DESTRUCTURE, THE VALUES ARE LOCKED AT THE TIME OF DESTRUCTION AND WILL NOT REFLECT ANY FUTURE CHANGES
  const { sendActionToPlugin } = context // this one is ok because it is not changed during the tests

  return [
    {
      name: 'Sample Test will always pass after 1s',
      test: async (): Promise<void> => {
        console.log('Sample log entries')
        await waitFor(1000)
        const foo = true
        console.log('this is a debug log first field', '2nd field', context.dashboardSettings)
        expect(foo).toBe(true, 'foo') // Example assertion
      },
    },
    {
      name: 'Sample Test will always fail after 1s',
      test: async (): Promise<void> => {
        console.log('Sample log entries')
        await waitFor(1000)
        const foo = false
        expect(foo).toBe(true, 'foo') // Example assertion
      },
    },
    {
      name: 'Test Switch to Perspective to Home and then to Work',
      test: async (): Promise<void> => {
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
        await waitFor(() => {
          const updatedSettings = context.perspectiveSettings.find((p) => p.name === 'Home' && p.isActive === true && p.isModified === false)
          return updatedSettings !== undefined
        }, 1000) // Add a timeout to prevent indefinite waiting
        console.log('got through 1')
        // then change it back to Work
        sendActionToPlugin(
          'switchToPerspective',
          {
            perspectiveName: 'Work',
            actionType: 'switchToPerspective',
            logMessage: `Perspective changed to Home`,
          },
          `Perspective changed to Work`,
        )
        // this time wait 3s
        await waitFor(3000)

        // check another way that the perspective is switched to Work
        const updatedSettings = context.perspectiveSettings.find((p) => p.name === 'Work' && p.isActive === true)
        expect(updatedSettings).not.toBeUndefined('updatedSettings')
      },
    },
    {
      name: `Set Dashboard Settings in plugin (turn all sections off)`,
      test: async (): Promise<void> => {
        const currentDashboardSettings = { ...context.dashboardSettings }
        // set all settings that start with show to false
        const newDashboardSettings = Object.keys(currentDashboardSettings).reduce((acc, key) => {
          if (key.startsWith('show')) {
            acc[key] = false
          }
          return acc
        }, {})
        newDashboardSettings.lastChange = `Turning all sections off`
        const mbo = {
          actionType: `dashboardSettingsChanged`,
          settings: newDashboardSettings,
        }
        console.log(`sending this mbo to the plugin`, mbo)
        sendActionToPlugin('dashboardSettingsChanged', mbo, `Turning all sections off`)

        // await waitFor(() => context.dashboardSettings.showProjectSection === newSetting, 2000) // Add a timeout to prevent indefinite waiting
        await waitFor(2000) // Add a timeout to prevent indefinite waiting

        console.log(`waitied for 2s and here is dashboardSettings`, context.dashboardSettings)
        expect(context.dashboardSettings.showProjectSection).toBe(false, 'dashboardSettings.showProjectSection')
      },
    },
    {
      name: `Set Dashboard Settings in plugin (turn all sections on)`,
      test: async (): Promise<void> => {
        const currentDashboardSettings = { ...context.dashboardSettings }
        // set all settings that start with show to false
        const newDashboardSettings = Object.keys(currentDashboardSettings).reduce((acc, key) => {
          if (key.startsWith('show')) {
            acc[key] = true
          }
          return acc
        }, {})
        newDashboardSettings.lastChange = `Turning all sections on`
        newDashboardSettings.showPrioritySection = false // this one is too slow to turn on
        const mbo = {
          actionType: `dashboardSettingsChanged`,
          settings: newDashboardSettings,
        }
        console.log(`sending this mbo to the plugin`, mbo)
        sendActionToPlugin('dashboardSettingsChanged', mbo, `Turning all sections on`)

        // await waitFor(() => context.dashboardSettings.showProjectSection === newSetting, 2000) // Add a timeout to prevent indefinite waiting
        await waitFor(2000) // Add a timeout to prevent indefinite waiting

        console.log(`waitied for 2s and here is dashboardSettings`, context.dashboardSettings)
        expect(context.dashboardSettings.showProjectSection).toBe(false, 'dashboardSettings.showProjectSection')
      },
    },
    {
      name: `Set Dashboard Settings in react (turn all sections off)`,
      test: async (): Promise<void> => {
        const currentDashboardSettings = { ...context.dashboardSettings }
        // set all settings that start with show to false
        const newDashboardSettings = Object.keys(currentDashboardSettings).reduce((acc, key) => {
          if (key.startsWith('show')) {
            acc[key] = false
          }
          return acc
        }, {})
        newDashboardSettings.lastChange = `Turning all sections off`
        context.dispatchDashboardSettings({ type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS, payload: newDashboardSettings })

        // await waitFor(() => context.dashboardSettings.showProjectSection === newSetting, 2000) // Add a timeout to prevent indefinite waiting
        await waitFor(2000) // Add a timeout to prevent indefinite waiting

        console.log(`waitied for 2s and here is dashboardSettings`, context.dashboardSettings)
        // check that all show* settings are true
        Object.keys(context.dashboardSettings).forEach((key) => {
          if (key.startsWith('show')) {
            console.log(`key: ${key}, current value: ${context.dashboardSettings[key]}`)
            expect(context.dashboardSettings[key]).toBe(false, `dashboardSettings.${key}`)
          }
        })
      },
    },
    {
      name: `Set Dashboard Settings in react (turn all sections on)`,
      test: async (): Promise<void> => {
        const currentDashboardSettings = { ...context.dashboardSettings }
        // set all settings that start with show to false
        const newDashboardSettings = Object.keys(currentDashboardSettings).reduce((acc, key) => {
          if (key.startsWith('show')) {
            acc[key] = true
          }
          return acc
        }, {})
        newDashboardSettings.lastChange = `Turning all sections on`
        newDashboardSettings.showPrioritySection = false // this one is too slow to turn on
        context.dispatchDashboardSettings({ type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS, payload: newDashboardSettings })

        // await waitFor(() => context.dashboardSettings.showProjectSection === newSetting, 2000) // Add a timeout to prevent indefinite waiting
        await waitFor(1000) // Add a timeout to prevent indefinite waiting

        console.log(`waitied for 2s and here is dashboardSettings`, context.dashboardSettings)
        // check that all show* settings are true
        Object.keys(context.dashboardSettings).forEach((key) => {
          if (key.startsWith('show') && key !== 'showPrioritySection') {
            console.log(`key: ${key}, current value: ${context.dashboardSettings[key]}`)
            expect(context.dashboardSettings[key]).toBe(true, `dashboardSettings.${key}`)
          }
        })
      },
    },
    {
      name: `Test Set Dashboard Settings - Toggle Projects Section (${context.dashboardSettings.showProjectSection} to ${!context.dashboardSettings.showProjectSection})`,
      test: async (): Promise<void> => {
        const prevSetting = context.dashboardSettings.showProjectSection
        const newSetting = !prevSetting
        const newDashboardSettings = {
          ...context.dashboardSettings,
          showProjectSection: newSetting,
          lastChange: `Changing showProjectSection setting to ${newSetting}`,
        }
        const mbo = {
          actionType: `dashboardSettingsChanged`,
          settings: newDashboardSettings,
        }
        console.log(`sending this mbo to the plugin`, mbo)
        sendActionToPlugin('dashboardSettingsChanged', mbo, `Changing showProjectSection setting to ${newSetting}`)

        // Wait for the dashboardSettings to update
        await waitFor(() => context.dashboardSettings.showProjectSection === newSetting, 5000)

        console.log(`After wait, dashboardSettings:`, context.dashboardSettings)
        expect(context.dashboardSettings.showProjectSection).toBe(newSetting, 'dashboardSettings.showProjectSection')
      },
    },
  ]
}

/**
 * Executes all tests sequentially.
 *
 * @param {Array<{name: string, test: () => Promise<void>}>} tests - The array of test objects.
 */
export const runTestsSequentially = async (tests: Array<{ name: string, test: () => Promise<void> }>) => {
  for (const test of tests) {
    await test.test()
  }
}

// FIXME: have not implemented the memoize ->
