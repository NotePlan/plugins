// @flow

import { expect } from '@helpers/testing/expect'
import { type TestResult, waitFor } from '@helpers/testing/testingUtils'

type ContextType = {
  sendActionToPlugin: (command: string, dataToSend: any, details?: string, updateGlobalData?: boolean) => void,
  perspectiveSettings: Array<any>,
  dashboardSettings: { [string]: any },
  [string]: any,
}

/**
 * Returns an array of test functions.
 *
 * @param {ContextType} context - The application context providing necessary functions and variables.
 * @returns {Array<{name: string, test: () => Promise<void>}>} An array of test objects with names and test functions.
 */
export const getTests = (context: ContextType): (Array<{ name: string, test: () => Promise<void> }>) => {
  const { sendActionToPlugin } = context

  return [
    {
      name: 'Sample Test will always pass after 1s',
      test: async (): Promise<void> => {
        console.log('Sample log entries')
        await waitFor(1000)
        const foo = true
        expect(foo).toBe(true) // Example assertion
      },
    },
    {
      name: 'Sample Test will always fail after 1s',
      test: async (): Promise<void> => {
        console.log('Sample log entries')
        await waitFor(1000)
        const foo = false
        expect(foo).toBe(true) // Example assertion
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
        expect(updatedSettings).not.toBeUndefined()
      },
    },
    {
      name: 'Test Set Dashboard Settings',
      test: async (): Promise<void> => {
        const mbo = { actionType: `dashboardSettingsChanged`, settings: { ...context.dashboardSettings, filterPriorityItems: true } }
        sendActionToPlugin('dashboardSettingsChanged', mbo, `Setting filterPriorities in dashboard settings`)

        await waitFor(() => context.dashboardSettings.filterPriorityItems === true, 1000) // Add a timeout to prevent indefinite waiting

        expect(context.dashboardSettings.filterPriorityItems).toBe(true)
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
