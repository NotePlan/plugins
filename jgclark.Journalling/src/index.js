// @flow

//---------------------------------------------------------------
// Journalling commands
// Jonathan Clark
// last update 2026-03-28 for v2.0.0.b4 by @jgclark
//---------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { clo, compareObjects, JSP, logDebug, logInfo, logError } from "@helpers/dev"
import { backupSettings, getSettings, pluginUpdated, saveSettings } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'

const pluginID = 'jgclark.Journalling'
const oldPluginID = 'jgclark.DailyJournal'

export {
  dailyJournalQuestions,
  onReviewWindowAction,
  weeklyJournalQuestions,
  monthlyJournalQuestions,
  quarterlyJournalQuestions,
  yearlyJournalQuestions,
} from './periodReviews'

export {
  dayStart,
  dayEnd,
  todayStart,
  todayEnd,
  weekStart,
  weekEnd,
  monthStart,
} from './templatesStartEnd'

// TODO(later): remove
// import { isEditorWindowOpen, isEditorWindowOpenByTitle } from '@helpers/NPWindows'
// export function testEditorOpen(): void {
//   try {
//     // Test 1
//     // const title = "2026-03-30"
//     // const res = isEditorWindowOpenByTitle(title)
//     // logInfo('testEditorOpen', `isEditorWindowOpenByTitle(${title}) => ${String(res)}`)

//     // Test 2
//     const title = "20260331.md" // "%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919/20260331.md"
//     const res = isEditorWindowOpen(title)
//     logInfo('testEditorOpen', `isEditorWindowOpen(${title}) => ${String(res)}`)
//   } catch (error) {
//     logError('testEditorOpen', error.message)
//   }
// }

export function init(): void {
  try {
    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message
    DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], true, false, false)
  } catch (error) {
    logError(pluginJson, `init: ${JSP(error)}`)
  }
}

export async function onSettingsUpdated(): Promise<void> {
  // Placeholder only to stop error in logs
}

export async function onUpdateOrInstall(): Promise<void> {
  try {
    logDebug(pluginJson, `onUpdateOrInstall() ...`)
    const initialNewPluginSettings = (await getSettings(pluginID, DataStore.settings)) || DataStore.settings

    if (initialNewPluginSettings.newInstall || initialNewPluginSettings.newInstall === undefined) {
      logDebug(pluginID, `onUpdateOrInstall: first run after install or newInstall is undefined`)
      // Deal with first run after install: if the old plugin exists, copy its matching settings.
      const oldPluginSettings = await getSettings(oldPluginID, null)
      const migratedSettings = { ...initialNewPluginSettings }

      if (oldPluginSettings && Object.keys(oldPluginSettings).length > 0) {
        await backupSettings(pluginID, `before_migration_from_old_plugin_to_new_v${pluginJson['plugin.version']}`, true)
        Object.keys(initialNewPluginSettings).forEach((key) => {
          if (key !== 'newInstall' && oldPluginSettings.hasOwnProperty(key)) {
            migratedSettings[key] = oldPluginSettings[key]
          }
        })
        clo(migratedSettings, `onUpdateOrInstall: migratedSettings from ${oldPluginID}:`)
      } else {
        logDebug(pluginID, `onUpdateOrInstall: no settings found to migrate from ${oldPluginID}`)
      }

      // Ensure migration runs only once.
      migratedSettings.newInstall = false
      // Save any changes
      const diff = compareObjects(migratedSettings, initialNewPluginSettings, [], true)
      if (diff != null) {
        logInfo(pluginID, `onUpdateOrInstall: first-run settings changes detected; saving`)
        await saveSettings(pluginID, migratedSettings)
      } else {
        logDebug(pluginID, `onUpdateOrInstall: first-run settings unchanged`)
      }
    }

    // Migration safety for renamed heading setting:
    // old "reviewSectionHeading" now maps to dailyJournalSectionHeading,
    // while reviewSectionHeading is used for non-daily periods.
    const latestSettings = (await getSettings(pluginID, DataStore.settings)) || DataStore.settings
    const updatedSettings = { ...latestSettings }
    const dailyHeading = String(updatedSettings.dailyJournalSectionHeading ?? '').trim()
    const reviewHeading = String(updatedSettings.reviewSectionHeading ?? '').trim()
    const needsDailyHeadingMigration = dailyHeading === '' && reviewHeading !== ''
    const needsReviewHeadingDefault = reviewHeading === ''
    if (needsDailyHeadingMigration || needsReviewHeadingDefault) {
      if (needsDailyHeadingMigration) {
        updatedSettings.dailyJournalSectionHeading = reviewHeading
      }
      if (needsReviewHeadingDefault) {
        updatedSettings.reviewSectionHeading = dailyHeading !== '' ? dailyHeading : 'Review'
      }
      const migrationDiff = compareObjects(updatedSettings, latestSettings, [], true)
      if (migrationDiff != null) {
        logInfo(pluginID, 'onUpdateOrInstall: heading settings migration changes detected; saving')
        await saveSettings(pluginID, updatedSettings)
      }
    }

    // Tell user the plugin has been updated
    logInfo(pluginID, `... finished onUpdateOrInstall`)
    await pluginUpdated(pluginJson, { code: 2, message: `Plugin Installed or Updated.` })
  } catch (error) {
    logError(pluginID, `onUpdateOrInstall: ${JSP(error)}`)
  }
}

/**
 * Update Settings/Preferences (for iOS etc)
 * Plugin entrypoint for command: "/<plugin>: Update Plugin Settings/Preferences"
 * @author @dwertheimer
 */
export async function updateSettings() {
  try {
    logDebug(pluginJson, `updateSettings running`)
    await editSettings(pluginJson)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
