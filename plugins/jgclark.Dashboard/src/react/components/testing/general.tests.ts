// @flow

import { expect } from '@np/helpers/testing/expect'
import { type TestResult, waitFor } from '@np/helpers/testing/testingUtils'
import { clo, logDebug } from '@np/helpers/react/reactDev'
import { DASHBOARD_ACTIONS } from '../../reducers/actionTypes'
import type { AppContextType } from '../AppContext'
import { backupCurrentSettings, restoreSettings, getDashboardSettingsWithShowVarsSetTo } from './testingHelpers'
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
      test: async (getContext: () => AppContextType, { pause }: { pause: (msg?: string) => Promise<void> }): Promise<void> => {
        let context = getContext()
        console.log('Do some test here that updates dashboardSettings in some way') // then wait
        await waitFor(1000) // After 1s context will be stale after this
        context = getContext() // get the latest context after the waitFor
        const foo = true
        expect(foo).toBe(true, 'foo') // Example assertion (tell it the variable name in the 2nd parameter)
      },
    },
    {
      name: 'Show banner (cannot verify automatically - you should see a banner at the top of the screen)',
      skip: true, // keeps it from running in the runAllTestsInGroup mode
      test: async (getContext: () => AppContextType, { pause }: { pause: (msg?: string) => Promise<void> }): Promise<void> => {
        let context = getContext()
        console.log('Sending an unknown click handler command. Should fail and show a banner to the user.')
        context.sendActionToPlugin(
          'BANNER_TEST',
          { actionType: 'BANNER_TEST - if you are reading this, this is not actually a failure' },
          'Sending an unknown click handler command (BANNER_TEST). Should fail and show a banner to the user.',
        )
        console.log(`Sent unknown click handler command. You should see a banner now.`)
      },
    },
    {
      name: `Create overdue task in project project note and find it in the OVERDUE dashboard sectionItems (uses evaluateString to run JS code in NP)`,
      test: async (getContext: () => AppContextType, { pause }: { pause: (msg?: string) => Promise<void> }): Promise<void> => {
        const [backupDashboardSettings, backupPerspectiveSettings] = backupCurrentSettings(getContext)
        const minimalSettings = getDashboardSettingsWithShowVarsSetTo(getContext, false)
        // make sure overdue is on and everything else is off
        minimalSettings.showOverdueSection = true
        minimalSettings.includedFolders = 'zDELETEME'
        minimalSettings.excludedFolders = '@Templates, @Trash'
        try {
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
          console.log(`sending dashboardSettingsChanged sendActionToPlugin to the plugin`)
          getContext().dispatchDashboardSettings({ type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS, payload: minimalSettings })
          // start waiting for the task we created in NP to come over to the overdue section
          const anonFunc = () =>
            getContext()
              .pluginData?.sections?.find((section) => section.sectionCode === 'OVERDUE')
              ?.sectionItems?.find((s, i) => {
                return s.para?.content === taskContent
              })
          await waitFor(anonFunc, 'find overdue section with task we created', 20000)
        } catch (error: any) {
          await pause(error.message)
          throw error
        } finally {
          await restoreSettings(getContext, backupDashboardSettings, backupPerspectiveSettings)
        }
      },
    },
  ],
}
