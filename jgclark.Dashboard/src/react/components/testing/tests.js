// @flow

/*
 * Tests for Dashboard
 * NOTES:
 * - do not destructure the context va
 * - context variables are fixed at the test runtime. so if you have a waitFor statement, get the context variable again after it. See the sample test.
 */

import { expect } from '@helpers/testing/expect'
import { type TestResult, waitFor } from '@helpers/testing/testingUtils'
import { clo, logDebug } from '@helpers/react/reactDev'
import { DASHBOARD_ACTIONS } from '../../reducers/actionTypes'

type ContextType = {
  sendActionToPlugin: (command: string, dataToSend: any, details?: string, updateGlobalData?: boolean) => void,
  perspectiveSettings: Array<any>,
  dashboardSettings: { [string]: any },
  dispatchDashboardSettings: (action: any) => void,
  updatePluginData: (data: any, logMessage?: string) => void,
  // Include any other properties that exist in context
  [string]: any,
}

/**
 * Returns an array of test functions.
 *
 * @param {() => ContextType} getContext - A function that returns the current context.
 * @returns {Array<{ name: string, test: () => Promise<void> }>} An array of test objects with names and test functions.
 */
export const getTests = (getContext: () => ContextType): (Array<{ name: string, test: () => Promise<void> }>) => {
  // IMPORTANT NOTE: DO NOT DESTRUCTURE ANY CONTEXT VARIABLES THAT COULD CHANGE DURING THE TESTS
  // BECAUSE ONCE YOU DESTRUCTURE, THE VALUES ARE LOCKED AT THE TIME OF DESTRUCTION AND WILL NOT REFLECT ANY FUTURE CHANGES

  return [
    {
      name: 'Sample Test will always pass after 1s',
      test: async (): Promise<void> => {
        let { dashboardSettings } = getContext()
        console.log('Do some test here that updates dashboardSettings in some way') // then wait
        await waitFor(1000) // After 1s context will be stale after this
        dashboardSettings = getContext() // so get the latest context after the waitFor
        const foo = true
        console.log('this is a debug log first field', '2nd field', dashboardSettings)
        expect(foo).toBe(true, 'foo') // Example assertion (tell it the variable name in the 2nd parameter)
      },
    },
    {
      name: 'Perspective: Switch to Home',
      test: async (): Promise<void> => {
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
        await waitFor(2000) // context will be stale after this
        context = getContext() // so get the latest context after the waitFor
        const updatedPerspective = context.perspectiveSettings.find((p) => p.name === 'Home' && p.isActive === true && p.isModified === false)
        expect(updatedPerspective).not.toBeUndefined('Active home perspective')
      },
    },
    {
      name: 'Perspective: Switch to Work',
      test: async (): Promise<void> => {
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
        await waitFor(2000)
        context = getContext() // so get the latest context after the waitFor
        // check another way that the perspective is switched to Work
        const updatedSettings = context.perspectiveSettings.find((p) => p.name === 'Work' && p.isActive === true)
        expect(updatedSettings).not.toBeUndefined('Work .isActive') // make sure Work is active
        const updatedSettings2 = context.perspectiveSettings.find((p) => p.name === 'Home' && p.isActive === true)
        expect(updatedSettings2).toBeUndefined('Home .isActive') // make sure Home is active
      },
    },
    {
      name: `Set Dashboard Settings in plugin (turn all sections off)`,
      test: async (): Promise<void> => {
        let context = getContext()
        const sendActionToPlugin = context.sendActionToPlugin
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
        context = getContext() // so get the latest context after the waitFor
        console.log(`waitied for 2s and here is dashboardSettings`, context.dashboardSettings)
        expect(context.dashboardSettings.showProjectSection).toBe(false, 'dashboardSettings.showProjectSection')
      },
    },
    {
      name: `Set Dashboard Settings in plugin (turn all sections on)`,
      test: async (): Promise<void> => {
        const context = getContext()
        const sendActionToPlugin = context.sendActionToPlugin
        const currentDashboardSettings = { ...context.dashboardSettings }
        // set all settings that start with show to false
        const newDashboardSettings = Object.keys(currentDashboardSettings).reduce((acc, key) => {
          if (key.startsWith('show')) {
            acc[key] = true
          }
          return acc
        }, currentDashboardSettings)
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
      name: `Set Dashboard Settings in react (turn all sections off -- false)`,
      test: async (): Promise<void> => {
        let context = getContext()
        const sendActionToPlugin = context.sendActionToPlugin
        const currentDashboardSettings = { ...context.dashboardSettings }
        // set all settings that start with show to false
        const newDashboardSettings = Object.keys(currentDashboardSettings).reduce((acc, key) => {
          if (key.startsWith('show')) {
            acc[key] = false
          }
          return acc
        }, {})
        newDashboardSettings.lastChange = `Turning all sections off (false)`
        context.dispatchDashboardSettings({ type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS, payload: newDashboardSettings })

        // await waitFor(() => context.dashboardSettings.showProjectSection === newSetting, 2000) // Add a timeout to prevent indefinite waiting
        await waitFor(2000) // Add a timeout to prevent indefinite waiting

        context = getContext()
        console.log(`waitied for 2s and here is dashboardSettings`, context.dashboardSettings)
        // check that all show* settings are false
        Object.keys(context.dashboardSettings).forEach((key) => {
          if (key.startsWith('show')) {
            console.log(`key: ${key}, current value: ${context.dashboardSettings[key]}`)
            expect(context.dashboardSettings[key]).toBe(false, `dashboardSettings.${key}`)
          }
        })
      },
    },
    {
      name: `Set Dashboard Settings in react (turn all sections on -- true)`,
      test: async (): Promise<void> => {
        let context = getContext()
        const sendActionToPlugin = context.sendActionToPlugin
        // Set all settings that start with 'show' to true
        const newDashboardSettings = {
          ...context.dashboardSettings,
        }
        Object.keys(newDashboardSettings).forEach((key) => {
          if (key.startsWith('show')) {
            newDashboardSettings[key] = true
          }
        })
        newDashboardSettings.lastChange = `Turning all sections on`
        newDashboardSettings.showPrioritySection = false // This one is too slow to turn on

        console.log('Sending this to DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS:')
        console.log(newDashboardSettings)
        context.dispatchDashboardSettings({
          type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS,
          payload: newDashboardSettings,
        })
        // Yield control to allow React to process the update
        await new Promise((resolve) => setTimeout(resolve, 0))
        await waitFor(1000)
        console.log('after 1s, here is dashboardSettings', context.dashboardSettings)
        // Wait for the dashboardSettings to update
        // await waitFor(
        //   () => {
        //     const updatedContext = getContext()
        //     return Object.keys(updatedContext.dashboardSettings).every((key) => {
        //       if (key.startsWith('show') && key !== 'showPrioritySection') {
        //         console.log(`key: ${key}, current value: ${updatedContext.dashboardSettings[key]}`)
        //         return updatedContext.dashboardSettings[key] === true
        //       }
        //       return true
        //     })
        //   },
        //   'All show* settings to be true',
        //   5000,
        //   100,
        // )
        context = getContext()
        Object.keys(context.dashboardSettings).forEach((key) => {
          if (key.startsWith('show') && key !== 'showPrioritySection') {
            console.log(`key: ${key}, current value: ${context.dashboardSettings[key]}`)
            expect(context.dashboardSettings[key]).toBe(true, `dashboardSettings.${key}`)
          }
        })

        console.log(`After waiting, here is dashboardSettings:`)
        console.log(context.dashboardSettings)

        // Check that all show* settings are true
        Object.keys(context.dashboardSettings).forEach((key) => {
          if (key.startsWith('show') && key !== 'showPrioritySection') {
            console.log(`key: ${key}, current value: ${context.dashboardSettings[key]}`)
            expect(context.dashboardSettings[key]).toBe(true, `dashboardSettings.${key}`)
          }
        })
      },
    },
    {
      name: `Test Set Dashboard Settings - Toggle Projects Section (${getContext().dashboardSettings.showProjectSection} to ${!getContext().dashboardSettings.showProjectSection})`,
      test: async (): Promise<void> => {
        const context = getContext()
        const sendActionToPlugin = context.sendActionToPlugin
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
 * @param {Array<{ name: string, test: () => Promise<void> }>} tests - The array of test objects.
 */
export const runTestsSequentially = async (tests: Array<{ name: string, test: () => Promise<void> }>) => {
  for (const test of tests) {
    console.log(`>>> Starting Test: ${test.name} <<<`)
    const startTime = performance.now()
    try {
      await test.test()
      const duration = performance.now() - startTime
      console.log(`>>> Passed Test: ${test.name} <<< Duration: ${duration.toFixed(0)}ms`)
    } catch (error) {
      const duration = performance.now() - startTime
      console.error(`>>> Failed Test: ${test.name} <<< Duration: ${duration.toFixed(0)}ms`)
      console.error(`Test failed: ${error.message}`)
    }
  }
}
