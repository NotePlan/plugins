// @flow
//-----------------------------------------------------------------------------
// Settings for the Reviews plugin: load/normalise config, heading-setting parse,
// and what a settings-pane save should do to the project list.
// by @jgclark
// Last updated 2026-09-13 for v2.2.0 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import { getActivePerspectiveDef, loadPerspectiveDefsFromPluginSettings } from '../../jgclark.Dashboard/src/perspectiveHelpers'
import type { TPerspectiveDef } from '../../jgclark.Dashboard/src/types'
import pluginJson from '../plugin.json'
import { checkString } from '@helpers/checkType'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { type headingLevelType } from '@helpers/general'
import { backupSettings } from '@helpers/NPConfiguration'
import { showMessage } from '@helpers/userInput'

export type ReviewConfig = {
  usePerspectives: boolean,
  perspectiveName: string,
  outputStyle: string,
  reviewsTheme: string,
  folderToStore: string,
  foldersToInclude: Array<string>,
  foldersToIgnore: Array<string>,
  includedTeamspaces: Array<string>, // Array of teamspace IDs to include ('private' for Private space)
  projectTypeTags: Array<string>,
  numberDaysForFutureToIgnore: number,
  cancelledMentionStr: string,
  completedMentionStr: string,
  confirmNextReview: boolean,
  displayArchivedProjects: boolean,
  displayDates: boolean,
  displayPaused: boolean,
  displayFinished: boolean,
  displayGroupedByFolder: boolean,
  displayNextActions: boolean,
  displayOrder: string,
  displayOnlyDue: boolean,
  displayProgress: boolean,
  /** Project-type hashtags currently toggled off in Filter + Order (Rich list only). */
  hiddenProjectTypeTags?: Array<string>,
  dueMentionStr: string,
  finishedListHeading: string,
  hideTopLevelFolder: boolean,
  ignoreChecklistsInProgress: boolean,
  reviewedMentionStr: string,
  reviewIntervalMentionStr: string,
  sequentialTag: string,
  showFolderName: boolean,
  startMentionStr: string,
  nextReviewMentionStr: string,
  progressStr: string, // new in 2.0.1
  archiveUsingFolderStructure: boolean,
  archiveFolder: string,
  removeDueDatesOnPause?: boolean,
  nextActionTags: Array<string>,
  preferredWindowType: string, // "New Window" |"Main Window" | "Split View"
  autoUpdateAfterIdleTime?: number,
  progressHeading?: string,
  writeMostRecentProgressToFrontmatter?: boolean,
  projectMetadataFrontmatterKey?: string,
  weeklyProjectProgressHeading?: string,
  weeklyProjectProgressShowEmptyFolders?: boolean,
  weeklyProjectProgressBulletSummary?: string,
  _logLevel: string,
  _logFunctionRE: string,
  _logTimer: boolean,
}

/**
 * Keys in "What do you want to Review?" and "Customise the metadata terms".
 * Changing any of these changes which notes are projects, or how their metadata is read.
 */
export const SETTINGS_THAT_REQUIRE_REBUILD: $ReadOnlyArray<string> = [
  'projectTypeTags',
  'usePerspectives',
  'foldersToInclude',
  'foldersToIgnore',
  'startMentionStr',
  'completedMentionStr',
  'cancelledMentionStr',
  'dueMentionStr',
  'reviewIntervalMentionStr',
  'reviewedMentionStr',
  'nextReviewMentionStr',
  'progressStr',
  'projectMetadataFrontmatterKey',
]

/**
 * Next-action and progress-calculation keys.
 * These change fields stored on existing allProjects list rows, but not which notes are projects.
 */
export const SETTINGS_THAT_REQUIRE_RECALCULATE: $ReadOnlyArray<string> = [
  'nextActionTags',
  'sequentialTag',
  'ignoreChecklistsInProgress',
  'numberDaysForFutureToIgnore',
]

/**
 * Keys in "Display settings for 'project lists' command".
 * These only affect how an existing allProjects list is rendered.
 */
export const SETTINGS_THAT_REQUIRE_REDISPLAY: $ReadOnlyArray<string> = [
  'outputStyle',
  'preferredWindowType',
  'reviewsTheme',
  'folderToStore',
  'displayOrder',
  'displayGroupedByFolder',
  'hideTopLevelFolder',
  'displayFinished',
  'displayOnlyDue',
  'displayDates',
  'displayProgress',
  'displayNextActions',
  'autoUpdateAfterIdleTime',
]

export type SettingsUpdateAction = 'rebuild' | 'recalculate' | 'redisplay' | 'none'

const LAST_SETTINGS_SNAPSHOT_PREF = 'Reviews-lastSettingsSnapshot'

/**
 * Parse a setting value that may include markdown heading markers (e.g. "## Progress").
 * @param {string} setting
 * @returns {{ level: headingLevelType, text: string }}
 */
export function parseMarkdownHeadingSetting(setting: string): { level: headingLevelType, text: string } {
  const trimmed = setting.trim()
  if (!trimmed) {
    return { level: 2, text: '' }
  }
  const match = trimmed.match(/^(#{1,5})\s+(.*)$/)
  if (match) {
    const level = Math.min(5, Math.max(1, match[1].length))
    return { level: (level: any), text: match[2].trim() }
  }
  return { level: 2, text: trimmed }
}

/**
 * Lookup user's preferred metadata item string ready to use as a frontmatter key. Note: Any leading # or @ is stripped off.
 * @param {string} prefName
 * @param {string} defaultKey
 * @returns {string}
 */
export function getFieldKeyStringFromPreference(prefName: string, defaultKey: string): string {
  return checkString(DataStore.preference(prefName) || '').replace(/^[@#]/, '') || defaultKey
}

/**
 * Field name prefix for progress body lines (e.g. 'Progress' when the configured key is 'progress').
 * Uses DataStore preference set by getReviewSettings().
 * @returns {string}
 */
export function getProgressFieldNameForBodyLines(): string {
  const key = getFieldKeyStringFromPreference('progressStr', 'progress')
  return key.charAt(0).toUpperCase() + key.slice(1)
}

/**
 * Frontmatter key for progress metadata (e.g. 'progress' or 'this_is_progress' when configured).
 * Uses DataStore preference set by getReviewSettings().
 * @returns {string}
 */
export function getProgressFrontmatterKey(): string {
  return getFieldKeyStringFromPreference('progressStr', 'progress')
}

/**
 * Configured combined project frontmatter key name (e.g. 'project'), without trailing colon.
 * @returns {string}
 */
export function getCombinedProjectFrontmatterKeyName(): string {
  return checkString(DataStore.preference('projectMetadataFrontmatterKey') || 'project')
}

/**
 * Get config settings
 * @author @jgclark
 * @param {boolean} externalCall - true if called from an external plugin
 * @return {?ReviewConfig} object with configuration, or null if no settings found
 */
export async function getReviewSettings(externalCall: boolean = false): Promise<ReviewConfig | null> {
  try {
    if (externalCall) {
      logInfo(pluginJson, `getReviewSettings() Starting from a different plugin ...`)
    }
    // Get settings
    const config: ReviewConfig = await DataStore.loadJSON('../jgclark.Reviews/settings.json')

    // If an external call allow silent return of null if no settings found.
    // Otherwise complain, as there should be settings.
    if (config == null || Object.keys(config).length === 0) {
      if (externalCall) {
        // Fail silently
        return null
      }
      // Throw an error to trigger the backupSettings call in the catch block
      throw new Error('No Reviews settings found')
    }
    // clo(config, `Review settings for '${pluginJson['plugin.version']}' version:`)

    // Need to store some things in the Preferences API mechanism, in order to pass things to the Project class
    DataStore.setPreference('startMentionStr', config.startMentionStr)
    DataStore.setPreference('completedMentionStr', config.completedMentionStr)
    DataStore.setPreference('cancelledMentionStr', config.cancelledMentionStr)
    DataStore.setPreference('dueMentionStr', config.dueMentionStr)
    DataStore.setPreference('reviewIntervalMentionStr', config.reviewIntervalMentionStr)
    DataStore.setPreference('reviewedMentionStr', config.reviewedMentionStr)
    DataStore.setPreference('nextReviewMentionStr', config.nextReviewMentionStr)
    DataStore.setPreference('progressStr', config.progressStr)
    DataStore.setPreference('numberDaysForFutureToIgnore', config.numberDaysForFutureToIgnore)
    DataStore.setPreference('ignoreChecklistsInProgress', config.ignoreChecklistsInProgress)
    // Used by body-metadata detection so unrelated personal hashtags are not treated as legacy project tags
    DataStore.setPreference('projectTypeTags', Array.isArray(config.projectTypeTags) ? config.projectTypeTags : [])
    DataStore.setPreference('sequentialTag', config.sequentialTag ?? '#sequential')

    // Frontmatter metadata preferences
    // Set a preference for the key name to use for project metadata in the frontmatter. (Dev Note: This is to make the setting available in the Project class.)
    // Allow any frontmatter key name, defaulting to 'project'
    const rawSingleMetadataKeyName: string =
      config.projectMetadataFrontmatterKey && typeof config.projectMetadataFrontmatterKey === 'string'
        ? config.projectMetadataFrontmatterKey.trim()
        : ''
    const singleMetadataKeyName: string = rawSingleMetadataKeyName !== '' ? rawSingleMetadataKeyName : 'project'
    config.projectMetadataFrontmatterKey = singleMetadataKeyName
    DataStore.setPreference('projectMetadataFrontmatterKey', singleMetadataKeyName)
    // Default when Perspectives are off. Callers already gate teamspace filtering on usePerspectives, so this value is unused in that path.
    if (!config.usePerspectives) {
      config.includedTeamspaces = ['private']
    }

    // If we want to use Perspectives, get all perspective settings from Dashboard plugin.
    if (config.usePerspectives) {
      const perspectiveSettings: Array<TPerspectiveDef> = await loadPerspectiveDefsFromPluginSettings(false)
      // Get the current Perspective
      const currentPerspective: any = getActivePerspectiveDef(perspectiveSettings)
      if (!currentPerspective) {
        logWarn('getReviewSettings', `usePerspectives is true but no active Dashboard perspective found (Dashboard perspective list may be empty or corrupt). Using folder/teamspace values from Reviews settings only, same as when usePerspectives is off.`)
        config.includedTeamspaces = ['private']
      } else {
        config.perspectiveName = currentPerspective.name
        logInfo('getReviewSettings', `Will use Perspective '${config.perspectiveName}', and its folder & teamspace settings`)
        config.foldersToInclude = stringListOrArrayToArray(currentPerspective.dashboardSettings?.includedFolders ?? '', ',')
        // logDebug('getReviewSettings', `- foldersToInclude: [${String(config.foldersToInclude)}]`)
        config.foldersToIgnore = stringListOrArrayToArray(currentPerspective.dashboardSettings?.excludedFolders ?? '', ',')
        // logDebug('getReviewSettings', `- foldersToIgnore: [${String(config.foldersToIgnore)}]`)
        config.includedTeamspaces = currentPerspective.dashboardSettings?.includedTeamspaces ?? ['private']
        // logDebug('getReviewSettings', `- includedTeamspaces: [${String(config.includedTeamspaces)}]`)
      }
    }

    // Ensure following have sensible defaults if missing from settings
    if (config.displayPaused == null) {
      config.displayPaused = true
    }
    if (config.hiddenProjectTypeTags == null || !Array.isArray(config.hiddenProjectTypeTags)) {
      config.hiddenProjectTypeTags = []
    }
    if (config.autoUpdateAfterIdleTime == null) {
      config.autoUpdateAfterIdleTime = 0
    }

    // Ensure reviewsTheme has a default if missing (e.g. before 'Theme to use for Project Lists' setting existed from v1.3.1)
    if (config.reviewsTheme == null || config.reviewsTheme === undefined) {
      config.reviewsTheme = ''
    }

    return config
  } catch (err) {
    logError(pluginJson, `getReviewSettings() error: ${err.name}: ${err.message}`)
    await backupSettings('jgclark.Reviews', 'error_in_file')
    await showMessage(`Sorry, there's been an error getting the settings for this plugin.\nI have tried to make a copy of the settings file to send to the plugin author on Discord if you wish.\n\nnNow please delete your NotePlan/Plugins/data/jgclark.Reviews/settings.json file. Then re-run the command, which should create a new settings file from the plugin defaults. If the issue persists, please raise an issue on GitHub.`, 'OK, thanks', 'Settings Error')
    return null
  }
}

/**
 * Compare two setting values, including arrays/objects.
 * @param {mixed} a
 * @param {mixed} b
 * @returns {boolean}
 */
function settingValuesEqual(a: mixed, b: mixed): boolean {
  if (a === b) return true
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  if (typeof a !== typeof b) return false
  if (typeof a === 'object') {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return false
}

/**
 * Return setting keys whose values differ between two settings objects.
 * @param {?{ [string]: any }} previous
 * @param {?{ [string]: any }} current
 * @returns {Array<string>}
 */
export function getChangedSettingKeys(previous: ?{ [string]: any }, current: ?{ [string]: any }): Array<string> {
  if (previous == null || current == null) {
    return []
  }
  const keys = new Set([...Object.keys(previous), ...Object.keys(current)])
  const changed: Array<string> = []
  for (const key of keys) {
    if (!settingValuesEqual(previous[key], current[key])) {
      changed.push(key)
    }
  }
  return changed
}

/**
 * Decide what a settings-pane save should do to the project list.
 * Priority: rebuild (membership/metadata) > recalculate (existing rows) > redisplay (render only) > none.
 * With no previous snapshot, return rebuild so the first save after upgrade stays safe.
 * @param {?{ [string]: any }} previous - last raw settings.json snapshot (not perspective-overlaid ReviewConfig)
 * @param {?{ [string]: any }} current - raw settings.json just saved
 * @returns {SettingsUpdateAction}
 */
export function getSettingsUpdateAction(previous: ?{ [string]: any }, current: ?{ [string]: any }): SettingsUpdateAction {
  if (previous == null || current == null) {
    return 'rebuild'
  }
  const changed = getChangedSettingKeys(previous, current)
  if (changed.some((key) => SETTINGS_THAT_REQUIRE_REBUILD.includes(key))) {
    return 'rebuild'
  }
  if (changed.some((key) => SETTINGS_THAT_REQUIRE_RECALCULATE.includes(key))) {
    return 'recalculate'
  }
  if (changed.some((key) => SETTINGS_THAT_REQUIRE_REDISPLAY.includes(key))) {
    return 'redisplay'
  }
  return 'none'
}

/**
 * Load the last raw settings.json snapshot used to classify settings-pane saves.
 * @returns {?{ [string]: any }}
 */
export function getLastSettingsSnapshot(): ?{ [string]: any } {
  const pref: mixed = DataStore.preference(LAST_SETTINGS_SNAPSHOT_PREF)
  if (pref == null || pref === '') {
    return null
  }
  if (typeof pref === 'string') {
    try {
      const parsed = JSON.parse(pref)
      if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed
      }
      return null
    } catch (error) {
      logWarn('getLastSettingsSnapshot', `Could not parse Reviews-lastSettingsSnapshot: ${String(error)}`)
      return null
    }
  }
  if (typeof pref === 'object' && !Array.isArray(pref)) {
    return ((pref: any): { [string]: any })
  }
  return null
}

/**
 * Persist a raw settings.json snapshot for the next settings-pane save comparison.
 * @param {{ [string]: any }} settings
 * @returns {void}
 */
export function persistLastSettingsSnapshot(settings: { [string]: any }): void {
  DataStore.setPreference(LAST_SETTINGS_SNAPSHOT_PREF, JSON.stringify(settings))
  logDebug('persistLastSettingsSnapshot', `stored snapshot with ${String(Object.keys(settings).length)} key(s)`)
}

/**
 * Store a snapshot only when none exists yet (e.g. after install/update).
 * @param {{ [string]: any }} settings
 * @returns {void}
 */
export function seedLastSettingsSnapshotIfMissing(settings: { [string]: any }): void {
  if (getLastSettingsSnapshot() == null) {
    persistLastSettingsSnapshot(settings)
  }
}
