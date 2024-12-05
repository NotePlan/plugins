// @flow

import { expect } from '@np/helpers/testing/expect'
import { type TestResult, waitFor } from '@np/helpers/testing/testingUtils'
import { compareObjects, getDiff, dtl } from '@np/helpers/dev'
import { clo, logDebug } from '@np/helpers/react/reactDev'
import { DASHBOARD_ACTIONS } from '../../reducers/actionTypes'
import type { AppContextType } from '../AppContext'
import { dashboardSettingsDefaults } from '../../support/settingsHelpers'
import { backupCurrentSettings, restoreSettings, getDashboardSettingsWithShowVarsSetTo } from './testingHelpers'

// Tests start here
/* TEMPLATE
{
  name: 'Template: Single Perspective Test with Timestamp',
      test: async (
        getContext: () => AppContextType,
        { pause }: { pause: (msg?: string) => Promise<void> },
      ): Promise<void> => {    const [backupDashboardSettings, backupPerspectiveSettings] = backupCurrentSettings(getContext)
    const allOffSettings = getDashboardSettingsWithShowVarsSetTo(getContext, false)
    try {
      // Create a single perspective with a modified timestamp
      const perspectiveName = 'Template Perspective'
      const now = dtl()
      const perspective = {
        name: perspectiveName,
        isActive: true,
        isModified: false,
        dashboardSettings: allOffSettings,
        lastModified: now,
      }

      // Send the perspective to the plugin
      getContext().sendActionToPlugin(
        'perspectiveSettingsChanged',
        {
          settings: [perspective],
          actionType: 'perspectiveSettingsChanged',
          logMessage: `Template perspective initialized`,
        },
        `Template perspective initialized`,
      )

      // Wait for the perspective to be available in the context
      await waitFor(
        () => {
          const availablePerspective = getContext().perspectiveSettings.find((p) => p.name === perspectiveName && p.lastModified === now)
          return availablePerspective !== undefined
        },
        'Perspective to be available in context',
        5000,
        100,
      )

      // Make a change to the dashboard settings
      const newDashboardSettings = { ...getContext().dashboardSettings, lastChange: 'Template Change' }
      getContext().dispatchDashboardSettings({
        type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS,
        payload: newDashboardSettings,
        reason: 'Template Change',
      })

      // Wait for the perspectiveSetting that isActive to also be isModified
      await waitFor(
        () => {
          const updatedPerspective = getContext().perspectiveSettings.find((p) => p.name === perspectiveName && p.isActive && p.isModified)
          return updatedPerspective !== undefined
        },
        'Active perspective to be modified',
        5000,
        100,
      )

      // Verify that the perspective is modified
      const modifiedPerspective = getContext().perspectiveSettings.find((p) => p.name === perspectiveName)
      expect(modifiedPerspective).not.toBeUndefined(`Perspective ${perspectiveName} was not found`)
      expect(modifiedPerspective.isModified).toBeTruthy(`Perspective ${perspectiveName} should be modified`)
    } catch (error: any) {
      throw error
    } finally {
      console.log(`=== Restoring settings ===`)
      await restoreSettings(getContext, backupDashboardSettings, backupPerspectiveSettings)
    }
  },

*/

export default {
  groupName: 'Perspectives Tests',
  tests: [
    {
      name: 'Test that perspective gets isModified flag when dashboardSettings are modified',
      test: async (getContext: () => AppContextType, { pause }: { pause: (msg?: string) => Promise<void> }): Promise<void> => {
        const [backupDashboardSettings, backupPerspectiveSettings] = backupCurrentSettings(getContext)
        await turnPerspectivesOn(getContext, true)
        const allOffSettings = getDashboardSettingsWithShowVarsSetTo(getContext, false)
        try {
          const perspectiveName = 'Template Perspective'
          const now = dtl()
          const perspective = {
            name: perspectiveName,
            isActive: true,
            isModified: false,
            dashboardSettings: { ...allOffSettings, lastModified: now },
            lastModified: now,
          }
          console.log(`=== Sending perspective to plugin:`, perspective)
          // Send the perspective to the plugin
          getContext().sendActionToPlugin(
            'perspectiveSettingsChanged',
            {
              settings: [perspective],
              actionType: 'perspectiveSettingsChanged',
              logMessage: `Adding single perspective`,
            },
            `basic perspective initialized`,
          )
          console.log(`=== Waiting for the perspective to be available in the context`)
          // Wait for the perspective to be available in the context
          await waitFor(
            () => {
              const availablePerspective = getContext().perspectiveSettings.find((p) => p.name === perspectiveName && p.lastModified === now)
              if (!availablePerspective) console.log(`Not yet available: perspectiveSettings:`, getContext().perspectiveSettings)
              return availablePerspective !== undefined
            },
            `New Perspective to be available (lastModified === ${now})`,
            5000,
            100,
            async (elapsed) =>
              console.log(`___ ${elapsed.toFixed(0)}ms: Wait for the perspective to be named ${perspectiveName} and modified=${now}...`, {
                perspectiveSettings: getContext().perspectiveSettings,
              }),
          )
          console.log(`=== Perspective ${perspectiveName} found; now switching to it to save dashboardSettings ===`)
          // switching to perspective via plugin
          getContext().sendActionToPlugin(
            'switchToPerspective',
            {
              actionType: 'switchToPerspective',
              perspectiveName: perspectiveName,
            },
            `switching to perspective ${perspectiveName}`,
          )
          console.log(`=== Just ran switchToPerspective ${perspectiveName}. Waiting for it to be active ===`)

          await waitFor(() => {
            const updatedPerspective = getContext().perspectiveSettings.find((p) => p.name === perspectiveName && p.isActive)
            return updatedPerspective !== undefined
          }, `Perspective ${perspectiveName} to be active`)

          console.log(`=== Perspective ${perspectiveName} active; now waiting for dashboardSettings to match allOffSettings:`, {
            dashboardSettings: getContext().dashboardSettings,
          })

          // console.log(`=== Perspective ${perspectiveName} active; now pausing before waiting for dashboardSettings to match allOffSettings ===`)
          // await pause(`After this we will wait for all dashboardSettings.show* to be off`)
          console.log(`=== Waiting for the settings to match the ones we set (all show==false) and lastModified to match the timestamp we set: ${now}`)

          // Wait for the settings to match the ones we set
          await waitFor((elapsed) => {
            const modifiedMatch = getContext().dashboardSettings.lastModified === now
            const testPassed =
              modifiedMatch &&
              Object.keys(getContext().dashboardSettings)
                .filter((s) => s.startsWith('show'))
                .every((s) => getContext().dashboardSettings[s] === false)
            elapsed > 4000 &&
              console.log(
                `___ ${elapsed.toFixed(0)}ms: into Wait for the settings to match all off...modifiedMatch: ${String(modifiedMatch)} testPassed:${String(
                  testPassed,
                )} looking for "${now}", but value is ${String(getContext().dashboardSettings.lastModified)}`,
                { dashboardSettings: getContext().dashboardSettings },
              )
            return Boolean(testPassed)
          }, 'Wait for the settings to match all off')

          // Make a change to the dashboard settings
          const newDashboardSettings = { ...getContext().dashboardSettings, excludedFolders: `set by test ${now}`, lastChange: 'Random Change' }
          getContext().dispatchDashboardSettings({
            type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS,
            payload: newDashboardSettings,
            reason: 'Making any change to get perspective to be modified',
          })

          // await pause(`After this we will wait for the perspective to be modified`)

          // Wait for the perspectiveSetting that isActive to also be isModified
          const failFunc = async (elapsed: number) =>
            console.log(`___ ${elapsed.toFixed(0)}ms: into Wait for the perspectiveSetting that isActive to also be isModified...`, {
              perspectiveSettings: getContext().perspectiveSettings,
            })
          await waitFor(
            () => {
              const updatedPerspective = getContext().perspectiveSettings.find((p) => p.name === perspectiveName && p.isActive && p.isModified)
              return updatedPerspective !== undefined
            },
            'Active perspective to be modified after a dashboardSettings change',
            5000,
            100,
            failFunc,
          )

          // Verify that the perspective is modified
          const modifiedPerspective = getContext().perspectiveSettings.find((p) => p.name === perspectiveName)
          if (!modifiedPerspective) throw (`perspectiveSettings:`, getContext().perspectiveSettings)
          expect(modifiedPerspective).not.toBeUndefined(`Perspective ${perspectiveName} was not found`)
          expect(modifiedPerspective.isModified).toBeTruthy(`Perspective ${perspectiveName} should be modified`)
        } catch (error: any) {
          await pause(error.message)
          throw error
        } finally {
          await restoreSettings(getContext, backupDashboardSettings, backupPerspectiveSettings)
        }
      },
    },
    {
      name: 'Perspective: Switch between Home and Work (via plugin)',
      test: async (getContext: () => AppContextType, { pause }: { pause: (msg?: string) => Promise<void> }): Promise<void> => {
        const [backupDashboardSettings, backupPerspectiveSettings] = backupCurrentSettings(getContext)
        await turnPerspectivesOn(getContext, true)
        try {
          // Verify that 'Home' perspective exists
          const newPerspectives = [
            { name: 'Home', isActive: false, isModified: false, dashboardSettings: { excludedFolders: 'THIS_IS_HOME' } },
            { name: 'Work', isActive: true, isModified: false, dashboardSettings: { excludedFolders: 'THIS_IS_WORK' } },
          ]
          getContext().sendActionToPlugin(
            'perspectiveSettingsChanged',
            { settings: newPerspectives, actionType: 'perspectiveSettingsChanged', logMessage: `Perspectives initialized` },
            `Perspectives initialized`,
          )
          await waitFor(1000)

          const testFunc = (elapsed: number) => {
            const homePerspective = getContext().perspectiveSettings.find((p) => p.name === 'Home')
            elapsed > 4000 &&
              console.log(`___ ${elapsed.toFixed(0)}ms: into Wait for the Home perspective to be available...`, { perspectiveSettings: getContext().perspectiveSettings })
            return Boolean(homePerspective)
          }
          const failFunc = async (elapsed: number) =>
            console.log(`___ failFunc: ${elapsed.toFixed(0)}ms: into Wait for the Home perspective to exist...`, { perspectiveSettings: getContext().perspectiveSettings })
          await waitFor(testFunc, 'Home perspective to be available', 5000, 100, failFunc)

          // Switch to 'Home' perspective using sendActionToPlugin::switchToPerspective
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
            (elapsed) => {
              const updatedPerspective = getContext().perspectiveSettings.find((p) => p.name === 'Home' && p.isActive === true && p.isModified === false)
              elapsed > 4000 &&
                console.log(`___ ${elapsed.toFixed(0)}ms: into Wait for the Home perspective to be active`, { perspectiveSettings: getContext().perspectiveSettings })
              return updatedPerspective !== undefined
            },
            'Home perspective to be active',
            5000,
            100,
          )

          // Switch to 'Work' perspective
          getContext().sendActionToPlugin(
            'switchToPerspective',
            {
              perspectiveName: 'Work',
              actionType: 'switchToPerspective',
              logMessage: `Perspective changed to Work`,
            },
            `Perspective changed to Work`,
          )
          // Wait until 'Home' perspective is active
          await waitFor(
            () => {
              const updatedPerspective = getContext().perspectiveSettings.find((p) => p.name === 'Work' && p.isActive === true && p.isModified === false)
              return updatedPerspective !== undefined
            },
            'Work perspective to be active',
            5000,
            100,
          )

          // Verify that 'Work' perspective is now active (should be if we are here after the waitFor)
          const updatedPerspective = getContext().perspectiveSettings.find((p) => p.name === 'Work' && p.isActive === true && p.isModified === false)
          expect(updatedPerspective).not.toBeUndefined('Active work perspective')
        } catch (error: any) {
          await pause(error.message)
          throw error
        } finally {
          // Restore settings using getContext() directly
          await restoreSettings(getContext, backupDashboardSettings, backupPerspectiveSettings)
        }
      },
    },
    {
      name: 'Perspective: Loop through multiple perspectives and verify that they loaded correctly',
      test: async (getContext: () => AppContextType, { pause }: { pause: (msg?: string) => Promise<void> }): Promise<void> => {
        const [backupDashboardSettings, backupPerspectiveSettings] = backupCurrentSettings(getContext)
        await turnPerspectivesOn(getContext, true)
        console.log(`backupDashboardSettings:`, backupDashboardSettings)
        try {
          const NUM_PERSPECTIVES = 10
          await turnPerspectivesOn(getContext, true)

          console.log(`--- Passed: All-off settings applied; now setting up ${NUM_PERSPECTIVES} perspectives ---`)

          const perspectives = []
          const currentDashboardSettings = { ...getContext().dashboardSettings }
          const now = Date.now()
          const dateStr = new Date(now).toISOString()
          for (let i = 0; i < NUM_PERSPECTIVES; i++) {
            const perspName = `Perspective ${i} @ ${dateStr}`
            const perspectiveDashboardSettings = { excludedFolders: `${i}` }
            const perspective = {
              name: perspName,
              isActive: false,
              isModified: false,
              dashboardSettings: perspectiveDashboardSettings,
              lastModified: now,
            }
            perspectives.push(perspective)
          }
          perspectives[0].isActive = true

          console.log(`===== TEST: Sending ${perspectives.length} new perspectives to the plugin =====`, perspectives)
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
              const modifiedMatch = c.perspectiveSettings.find((p) => p.name === perspectives[0].name && p.lastModified === now)
              if (!modifiedMatch) console.log(`perspectiveSettings:`, c.perspectiveSettings)
              return Boolean(modifiedMatch)
            },
            `perspectiveSettings to be updated (modified time (${now}) on perspective 0 to match and return to front-end)`,
            10000,
            100,
          )
          await waitFor(5000) // give all the dashboardSettings time to be updated

          for (let i = 0; i < NUM_PERSPECTIVES; i++) {
            // Switch to the perspective
            console.log(`=== Will now TEST ${i}: Switching to perspective ${perspectives[i].name} ===`)
            getContext().sendActionToPlugin(
              'switchToPerspective',
              {
                perspectiveName: perspectives[i].name,
                actionType: 'switchToPerspective',
                logMessage: `Perspective changed to ${perspectives[i].name}`,
              },
              `Perspective changed to ${perspectives[i].name}`,
            )
            await waitFor(1000)
            // Wait until the dashboardSettings.excludedFolders equals the expected value
            console.log(`TEST ${i}: Will now wait for dashboardSettings.excludedFolders to equal "${i}"`)
            await waitFor(
              (elapsed) => {
                const lookingForExcluded = perspectives[i].dashboardSettings.excludedFolders
                const dashboardSettingsExcluded = getContext().dashboardSettings.excludedFolders
                const testPassed = lookingForExcluded === dashboardSettingsExcluded
                if (elapsed > 5000)
                  console.log(
                    `___ CONDITION ${
                      testPassed ? 'PASS' : 'FAIL'
                    }\n\tperspectives[i].dashboardSettings.excludedFolders=${lookingForExcluded}\n\tdashboardSettingsExcluded=${dashboardSettingsExcluded}`,
                    { dashboardSettings: getContext().dashboardSettings },
                  )
                console.log(`in waitFor:pluginData.dashboardSettings:`, getContext().pluginData.dashboardSettings)
                return testPassed
              },
              `${i}: name: ${getContext().perspectiveSettings[i].name} dashboardSettings.excludedFolders to equal "${i}"`,
              10000,
              100,
            )

            console.log(`=== TEST ${i}: Verifying that dashboardSettings.excludedFolders is set to "${i}" ===`)
            const efStr = getContext().dashboardSettings.excludedFolders
            expect(efStr).toEqual(
              perspectives[i].dashboardSettings.excludedFolders,
              `DashboardSettings had excludedFolders set incorrectly during perspective switch to ${perspectives[i].name}`,
            )
            logDebug(`Passed: DashboardSettings had excludedFolders set to "${efStr}" during perspective switch to ${perspectives[i].name}`)

            console.log(`TEST ${i}: Verifying that perspective ${perspectives[i].name} is not modified`)
            const ps = getContext().perspectiveSettings.find((p) => p.name === perspectives[i].name)
            expect(ps).not.toBeUndefined(`Perspective ${perspectives[i].name} was not found`)
            console.log(`getContext().perspectiveSettings:`, getContext().perspectiveSettings)
            ps && expect(ps.isModified).toBeFalsy(`Perspective ${perspectives[i].name} was modified, but should not be when switching to it`)
            console.log(`================================ TEST ${i}: Passed: Perspective ${perspectives[i].name} was set and not modified ================================`)
          }
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

/**
 * Turn perspectives on by setting perspectivesEnabled:true in dashboardSettings
 * And turn all sections off
 * @param {*} getContext
 */
async function turnPerspectivesOn(getContext: () => AppContextType, allSectionsOff: boolean = false) {
  const allOffSettings = allSectionsOff ? getDashboardSettingsWithShowVarsSetTo(getContext, false) : getContext().dashboardSettings
  const msg = `Testing_Perspectives: Turning perspectives on and ${allSectionsOff ? 'all sections off' : 'keeping sections on'}`
  // setting excluded folders to the current timestamp to make sure it's different and triggers a send to the plugin
  const newSettings = { ...allOffSettings, perspectivesEnabled: true, excludedFolders: `${dtl()}`, lastChange: msg }

  // Save the all-off settings
  getContext().dispatchDashboardSettings({
    type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS,
    payload: newSettings,
    reason: msg,
  })

  // Wait until the dashboard settings have been updated
  await waitFor(
    (elapsed) => {
      // ensure all show vars are off
      const showVars = Object.keys(getContext().dashboardSettings).filter((s) => s.startsWith('show'))
      const allShowVarsOff = showVars.every((s) => getContext().dashboardSettings[s] === false)
      // ensure perspectivesEnabled is true
      const perspectivesEnabled = getContext().dashboardSettings.perspectivesEnabled
      const testPassed = perspectivesEnabled && allShowVarsOff
      testPassed && console.log(`Perspectives enabled and all sections ${allSectionsOff ? 'off' : 'unchanged'}`)
      elapsed > 5000 &&
        console.log(`___ About to timeout waiting for perspectives to be enabled and all sections ${allSectionsOff ? 'off' : 'unchanged'}`, {
          dashboardSettings: getContext().dashboardSettings,
        })
      return testPassed
    },
    'dashboardSettings with perspectivesEnabled:true to be available',
    6000,
    100,
  )
}
