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

// helper functions for repeated use in tests

const getDashboardSettingsWithShowVarsSetTo = (context: AppContextType, showValue: boolean): Object => {
  return Object.keys(context.dashboardSettings).reduce(
    (acc, key) => {
      if (key.startsWith('show')) {
        acc[key] = showValue
      }
      if (key === 'showPrioritySection') {
        acc[key] = false // this one is too slow to ever turn on
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

// tests start here

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
      name: 'Show banner (error - unknown click handler)',
      test: async (getContext: () => AppContextType): Promise<void> => {
        let context = getContext()
        console.log('Sending an unknown click handler command. Should fail and show a banner to the user.')
        context.sendActionToPlugin(
          'unknownClickHandler',
          { actionType: 'unknownClickHandler test - if you are reading this, this is not actually a failure' },
          'Sending an unknown click handler command. Should fail and show a banner to the user.',
        )
        console.log(`Sent unknown click handler command. You should see a banner now.`)
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
