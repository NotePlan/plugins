// @flow
// ----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated 2026-07-16 for v2.4.0.b51 by @CursorAI
// ----------------------------------------------------------------------------

/**
 * Imports
 */
import pluginJson from '../plugin.json'
import { loadDashboardPluginSettings, saveDashboardPluginSettings } from './dashboardPluginSettings'
import { parseSettings } from './shared'
import { generateTagMentionCache, updateTagMentionCacheDefinitionsFromAllPerspectives } from './tagMentionCache'
import {
  clo, JSP, logDebug, logError, logInfo, logWarn,
} from '@helpers/dev'
import * as npc from '@helpers/NPConfiguration'
import { checkForRequiredSharedFiles } from '@helpers/NPRequiredFiles'

// ----------------------------------------------------------------------------

const pluginID = 'jgclark.Dashboard'

/**
 * Command Exports
 */
export { editSettings } from '@helpers/NPSettings'

/**
 * Other imports/exports
 */
export {
  decideWhetherToUpdateDashboard, /// TODO(later): remove, now that onEditorWillSave is here
  onEditorWillSave,
  refreshSectionByCode,
  refreshSectionsByCode
} from './dashboardHooks.js'

export { generateDiagnosticsFile } from './diagnosticGenerator'

export {
  addNewPerspective,
  deletePerspective,
  deleteAllNamedPerspectiveSettings,
  loadPerspectiveDefsFromPluginSettings, // TODO(later): remove
  logPerspectiveFiltering,
  updateCurrentPerspectiveDef,
} from './perspectiveHelpers.js'

export {
  makeSettingsAsCallback,
  reactWindowInitialisedSoStartGeneratingData,
  showDashboardReact,
  showDemoDashboard,
  showPerspective,
  showSections,
  setSetting,
  setSettings,
} from './reactMain.js'

export { refreshDashboard } from './refreshClickHandlers'

export { onMessageFromHTMLView } from './routeRequestsFromReact.js'

export {
  // onUpdateOrInstall, // Note: a more specialised version of this is below
  init,
  onSettingsUpdated,
  versionCheck,
} from './NPHooks'

export { generateTagMentionCache, updateTagMentionCache } from './tagMentionCache'

export { updateDoneCountsFromChangedNotes } from './countDoneTasks'

export { externallyStartSearch } from './dataGenerationSearch.js'

//-----------------------------------------------------------------------------

export { repairDashboardSettings } from './dashboardPluginSettings'

export async function backupSettings(): Promise<void> {
  const res = await npc.backupSettings(pluginID, 'backup')
  if (res) {
    logInfo(pluginJson, `backupSettings() - backup successful.`)
  } else {
    logError(pluginJson, `backupSettings() - backup failed.`)
  }
}

// Carry out any operations necessary when the plugin is updated.
export async function onUpdateOrInstall(): Promise<void> {
  try {
    logInfo(pluginJson, `onUpdateOrInstall() starting ...`)
    const initialSettings = (await loadDashboardPluginSettings()) || DataStore.settings
    // clo(initialSettings, `onUpdateOrInstall - initialSettings:`)
    // Note: this is deceptive because dashboardSettings is one single JSON stringified key inside initialSettings

    // Backup the settings on all new installs (quietly)
    await npc.backupSettings('jgclark.Dashboard', `before_onUpdateOrInstall_v${pluginJson["plugin.version"]}`, true)

    // Log warnings if we don't have required files
    await checkForRequiredSharedFiles(pluginJson)

    // Make sure we have the np.Shared plugin which has the core react code and some basic CSS
    await DataStore.installOrUpdatePluginsByID(['np.Shared'], false, false, true) // you must have np.Shared code in order to open up a React Window
    // logDebug(pluginJson, `onUpdateOrInstall: installOrUpdatePluginsByID ['np.Shared'] completed`)

    // parseSettings returns undefined on bad/missing JSON - never assign into undefined
    const initialDashboardSettings = parseSettings(initialSettings.dashboardSettings) ?? {}
    // const defaults = getDashboardSettingsDefaultsWithSectionsSetToFalse()
    // const migratedDashboardSettings = { ...defaults, ...renameKeys(initialDashboardSettings, keysToChange) }

    // Note: most *new* settings are merged from defaults at runtime. For showRemindersSection we also
    // backfill into stored settings so upgrades (and empty fresh installs) persist the new default of ON.
    // Respect an explicit false if the user already turned Reminders off.

    // Note: Workaround for number types getting changed to strings at some point in our Settings system.  FIXME: but lower priority for now.
    initialDashboardSettings.newTaskSectionHeadingLevel = parseInt(initialDashboardSettings.newTaskSectionHeadingLevel || 2)
    initialDashboardSettings.maxItemsToShowInSection = parseInt(initialDashboardSettings.maxItemsToShowInSection || 24)
    initialDashboardSettings.lookBackDaysForOverdue = parseInt(initialDashboardSettings.lookBackDaysForOverdue || 7)
    initialDashboardSettings.autoUpdateAfterIdleTime = parseInt(initialDashboardSettings.autoUpdateAfterIdleTime || 10)

    clo(initialDashboardSettings, `onUpdateOrInstall - initialDashboardSettings:`)

    let settingsNeedSave = false
    if (initialDashboardSettings.showRemindersSection === undefined) {
      initialDashboardSettings.showRemindersSection = true
      settingsNeedSave = true
      logInfo(`onUpdateOrInstall`, `- set showRemindersSection=true (default on for upgrades / fresh installs)`)
    }

    const perspectiveDefsRaw = initialSettings?.perspectiveSettings
    const perspectiveDefs = Array.isArray(perspectiveDefsRaw)
      ? perspectiveDefsRaw
      : (parseSettings(perspectiveDefsRaw) ?? [])
    const newPerspectiveDefs = perspectiveDefs.map((p) => {
      if (!p || typeof p !== 'object') return p
      const perspectiveDashboardSettings =
        (typeof p.dashboardSettings === 'string' ? parseSettings(p.dashboardSettings) : p.dashboardSettings) ?? {}
      if (perspectiveDashboardSettings.showRemindersSection !== undefined) {
        return p
      }
      settingsNeedSave = true
      logInfo(`onUpdateOrInstall`, `- set showRemindersSection=true on perspective '${String(p.name)}'`)
      return {
        ...p,
        dashboardSettings: { ...perspectiveDashboardSettings, showRemindersSection: true },
      }
    })

    if (settingsNeedSave) {
      await saveDashboardPluginSettings({
        ...initialSettings,
        dashboardSettings: initialDashboardSettings,
        perspectiveSettings: newPerspectiveDefs,
      })
      logInfo(`onUpdateOrInstall`, `- saved settings after showRemindersSection default backfill`)
    }

    // Rebuild wantedTagMentionsList.json from every saved perspective (fixes stale file after upgrade).
    if (Array.isArray(newPerspectiveDefs) && newPerspectiveDefs.length > 0) {
      updateTagMentionCacheDefinitionsFromAllPerspectives(newPerspectiveDefs)
    }

    // Now get the tagMentionCache up to date, by forcing a rebuild.
    // Note: DBW thinks that if we don't await this, NotePlan will kill the thread, and stop this from finishing.
    await generateTagMentionCache('After plugin install or update', true)
  } catch (err) {
    logError(pluginJson, `onUpdateOrInstall() error: ${err.message}`)
  }
}
