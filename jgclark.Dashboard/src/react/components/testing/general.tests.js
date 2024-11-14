// @flow

import { expect } from '@helpers/testing/expect'
import { type TestResult, waitFor } from '@helpers/testing/testingUtils'
import { clo, logDebug } from '@helpers/react/reactDev'
import { DASHBOARD_ACTIONS } from '../../reducers/actionTypes'
import type { AppContextType } from '../AppContext'

type Test = {
  name: string,
  test: (getContext: () => AppContextType) => Promise<void>,
}

type TestGroup = {
  groupName: string,
  tests: Array<Test>,
}

const getDashboardSettingsWithShowVarsSetTo = (context: AppContextType, showValue: boolean): Object => {
  return Object.keys(context.dashboardSettings).reduce(
    (acc, key) => {
      if (key.startsWith('show')) {
        acc[key] = showValue
      }
      return acc
    },
    { ...context.dashboardSettings },
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

export default {
  groupName: 'General Tests',
  tests: [
    {
      name: 'Sample Test will always pass after 1s',
      test: async (getContext: () => AppContextType): Promise<void> => {
        let context = getContext()
        console.log('Do some test here that updates dashboardSettings in some way') // then wait
        await waitFor(1000) // After 1s context will be stale after this
        context = getContext() // get the latest context after the waitFor
        const foo = true
        expect(foo).toBe(true, 'foo') // Example assertion (tell it the variable name in the 2nd parameter)
      },
    },
    {
      name: 'Perspective: Switch to Home (via plugin)',
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
        await waitFor(2000) // context will be stale after this
        context = getContext() // so get the latest context after the waitFor
        // or just include the call in the expect statement
        const updatedPerspective = getContext().perspectiveSettings.find((p) => p.name === 'Home' && p.isActive === true && p.isModified === false)
        expect(updatedPerspective).not.toBeUndefined('Active home perspective')
      },
    },
    {
      name: 'Perspective: Switch to Work (via plugin)',
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
      test: async (getContext: () => AppContextType): Promise<void> => {
        let context = getContext()
        const sendActionToPlugin = context.sendActionToPlugin
        const newDashboardSettings = getDashboardSettingsWithShowVarsSetTo(context, false)
        newDashboardSettings.lastChange = `Turning all sections off`
        sendDashboardSettingsToPlugin(sendActionToPlugin, newDashboardSettings, `Turning all sections off`)

        await waitFor(2000) // Add a timeout to prevent indefinite waiting
        context = getContext() // so get the latest context after the waitFor
        console.log(`waitied for 2s and here is dashboardSettings`, context.dashboardSettings)
        expect(context.dashboardSettings.showProjectSection).toBe(false, 'dashboardSettings.showProjectSection')
      },
    },
    {
      name: `Set Dashboard Settings in plugin (turn all sections on)`,
      test: async (getContext: () => AppContextType): Promise<void> => {
        const context = getContext()
        const sendActionToPlugin = context.sendActionToPlugin
        const newDashboardSettings = getDashboardSettingsWithShowVarsSetTo(context, true)
        newDashboardSettings.lastChange = `Turning all sections on`
        newDashboardSettings.showPrioritySection = false // this one is too slow to turn on
        sendDashboardSettingsToPlugin(sendActionToPlugin, newDashboardSettings, `Turning all sections on`)

        await waitFor(2000) // Add a timeout to prevent indefinite waiting

        console.log(`waitied for 2s and here is dashboardSettings`, context.dashboardSettings)
        expect(context.dashboardSettings.showProjectSection).toBe(false, 'dashboardSettings.showProjectSection')
      },
    },
    {
      name: `Set Dashboard Settings in react (turn all sections off -- false)`,
      test: async (getContext: () => AppContextType): Promise<void> => {
        let context = getContext()
        const newDashboardSettings = getDashboardSettingsWithShowVarsSetTo(context, false)
        newDashboardSettings.lastChange = `Turning all sections off (false)`
        context.dispatchDashboardSettings({ type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS, payload: newDashboardSettings })

        await waitFor(2000) // Add a timeout to prevent indefinite waiting

        context = getContext()
        console.log(`waitied for 2s and here is dashboardSettings`, context.dashboardSettings)
        // check that all show* settings are false
        Object.keys(context.dashboardSettings).forEach((key) => {
          if (key.startsWith('show')) {
            console.log(`key: ${key}, current value: ${String(context.dashboardSettings[key])}`)
            expect(context.dashboardSettings[key]).toBe(false, `dashboardSettings.${key}`)
          }
        })
      },
    },
    {
      name: `Set Dashboard Settings in react (turn all sections on -- true)`,
      test: async (getContext: () => AppContextType): Promise<void> => {
        let context = getContext()
        const newDashboardSettings = getDashboardSettingsWithShowVarsSetTo(context, true)
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
        context = getContext()
        Object.keys(context.dashboardSettings).forEach((key) => {
          if (key.startsWith('show') && key !== 'showPrioritySection') {
            console.log(`key: ${key}, current value: ${String(context.dashboardSettings[key])}`)
            expect(context.dashboardSettings[key]).toBe(true, `dashboardSettings.${key}`)
          }
        })

        console.log(`After waiting, here is dashboardSettings:`)
        console.log(context.dashboardSettings)

        // Check that all show* settings are true
        Object.keys(context.dashboardSettings).forEach((key) => {
          if (key.startsWith('show') && key !== 'showPrioritySection') {
            console.log(`key: ${key}, current value: ${String(context.dashboardSettings[key])}`)
            expect(context.dashboardSettings[key]).toBe(true, `dashboardSettings.${key}`)
          }
        })
      },
    },
    {
      name: `Test Set Dashboard Settings - Toggle Projects Section`,
      test: async (getContext: () => AppContextType): Promise<void> => {
        let context = getContext()
        const sendActionToPlugin = context.sendActionToPlugin
        const prevSetting = context.dashboardSettings.showProjectSection
        const newSetting = !prevSetting
        const newDashboardSettings = {
          ...context.dashboardSettings,
          showProjectSection: newSetting,
          lastChange: `Changing showProjectSection setting to ${String(newSetting)}`,
        }
        sendDashboardSettingsToPlugin(sendActionToPlugin, newDashboardSettings, `Changing showProjectSection setting to ${String(newSetting)}`)

        // Wait for the dashboardSettings to update -- continue to wait until the condition is true (or default timeout of 5s)
        await waitFor(() => getContext().dashboardSettings.showProjectSection === newSetting, 'dashboardSettings.showProjectSection')

        expect(() => getContext().dashboardSettings.showProjectSection).toBe(newSetting, 'dashboardSettings.showProjectSection')
      },
    },
    {
      name: `Test Evaluate String (create overdue task in project note and find it in the dashboard sectionItems)`,
      test: async (getContext: () => AppContextType): Promise<void> => {
        const context = getContext()
        const sendActionToPlugin = context.sendActionToPlugin
        // create a string with JS API code to create an overdue task in the project note
        const taskContent = 'This is a test of the evaluateString command >2000-01-01'
        // NOTE: \n needs to be escaped
        const stringToEvaluate = `
            Editor.openNoteByFilename('zDELETEME-test-evaluateString.md', true, 0, 0, false, true, "# Created by Dashboard Test\\n* ${taskContent}"); 
        `
        const mbo = { actionType: 'evaluateString', stringToEvaluate: stringToEvaluate.trim() }
        sendActionToPlugin('evaluateString', mbo, `Evaluating string: Creating overdue task`)
        await waitFor(2000)
        // make sure overdue is on and everything else is off
        const currentDashboardSettings = getContext().dashboardSettings
        const newDashboardSettings = getDashboardSettingsWithShowVarsSetTo(context, false)
        newDashboardSettings.showOverdueSection = true
        newDashboardSettings.lastChange = `Turning all sections off`
        newDashboardSettings.includedFolders = 'zDELETEME'
        newDashboardSettings.excludedFolders = '@Templates, @Trash'
        console.log(`sending dashboardSettingsChanged sendActionToPlugin to the plugin`)
        getContext().dispatchDashboardSettings({ type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS, payload: newDashboardSettings })
        // start waiting for the task we created in NP to come over to the overdue section
        const anonFunc = () =>
          getContext()
            .pluginData?.sections?.find((section) => section.sectionCode === 'OVERDUE')
            ?.sectionItems?.find((s, i) => {
              return s.para.content === taskContent
            })
        await waitFor(anonFunc, 'find overdue task we created')
        expect(() =>
          getContext()
            .pluginData?.sections?.find((section) => section.sectionCode === 'OVERDUE')
            ?.sectionItems?.find((s) => s.para.content === taskContent)
            ?.not.toBeUndefined('overdue task we created'),
        )
        // restore the original dashboard settings
        getContext().dispatchDashboardSettings({ type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS, payload: currentDashboardSettings })
      },
    },
  ],
}
