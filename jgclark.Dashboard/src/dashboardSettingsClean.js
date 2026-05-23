// @flow
//-----------------------------------------------------------------------------
// Clean dashboard settings objects (per-perspective strip list).
// Extracted from perspectiveHelpers.js to avoid circular imports with
// dashboardPluginSettings.js / dashboardHelpers.js.
// Last updated 2026-05-23 for v2.4.0.b42 by @CursorAI
//-----------------------------------------------------------------------------

import { getTagSectionDetails } from './react/components/Section/sectionHelpers'
import type { TDashboardSettings } from './types'
import { logDebug, logError } from '@helpers/dev'

/**
 * Clean a Dashboard settings object of properties we don't want to use or see
 * (we only want things in the perspectiveSettings object that could be set in dashboard settings or filters).
 * FIXME: some number settings arrive here as strings.
 * TODO: Is it true that sometimes this will be called with a partial object, and sometimes with a full object?
 * It can be called before doing a comparison with the active perspective settings.
 * Note: index.js::onUpdateOrInstall() does the renaming of keys in the settings object.
 * @param {Partial<TDashboardSettings>} settingsIn
 * @param {boolean} deleteAllShowTagSections - also clean out showTag_* settings
 * @returns {Partial<TDashboardSettings>}
 */
export function cleanDashboardSettingsInAPerspective(settingsIn: Partial<TDashboardSettings>, deleteAllShowTagSections?: boolean): Partial<TDashboardSettings> {
  // Define keys to remove
  const patternsToRemove = [
    // the following shouldn't be persisted in the perspectiveSettings object, but only in the top-level dashboardSettings object
    'perspectivesEnabled',
    'usePerspectives',
    /FFlag_/,
    /_log/,
    'pluginID',
    'lastChange',
    'timeblockMustContainString',
    'defaultFileExtension',
    'doneDatesAvailable',
    'migratedSettingsFromOriginalDashboard',
    'settingsMigrated',
    'triggerLogging',
    /separator\d/,
    /heading\d/,
    // the following were added in v2.2.0
    'searchOptions',
    // the following were added in v2.4.0
    'preferredWindowType',
  ].map((pattern) => (typeof pattern === 'string' ? new RegExp(`^${pattern}`) : pattern))
  if (deleteAllShowTagSections) {
    patternsToRemove.push(/showTagSection_/)
  }

  function shouldRemoveKey(key: string): boolean {
    return patternsToRemove.some((pattern) => pattern.test(key))
  }

  try {
    if (!settingsIn || settingsIn === {}) {
      throw new Error(`No settingsIn found`)
    }

    // Filter out any showTagSection_ keys that are not used in the current perspective (i.e. not in tagsToShow)
    // $FlowIgnore[incompatible-call] - settingsIn is Partial<TDashboardSettings> but removeInvalidTagSections accepts TDashboardSettings; this is safe as it creates a copy
    const perspSettingsWithoutIrrelevantTags = removeInvalidTagSections(settingsIn) // OK

    const removedKeys: Array<string> = []
    const settingsOut = Object.keys(perspSettingsWithoutIrrelevantTags).reduce((acc: Partial<TDashboardSettings>, key) => {
      if (!shouldRemoveKey(key)) {
        acc[key] = perspSettingsWithoutIrrelevantTags[key]
      } else {
        removedKeys.push(key)
      }
      return acc
    }, {})
    if (removedKeys.length > 0) {
      logDebug('cleanDashboardSettingsInAPerspective', `- Removed keys: [${removedKeys.join(', ')}]`)
    }

    return settingsOut
  } catch (error) {
    logError('cleanDashboardSettingsInAPerspective', `Error: ${error.message}`)
    return {}
  }
}

/**
 * Remove tag sections from the dashboard settings that are not relevant to the current perspective
 * (e.g. leaving only the tags included in dashboardSettings.tagsToShow)
 * @param {TDashboardSettings} settingsIn
 * @returns {TDashboardSettings} - settings without irrelevant tag sections
 */
export function removeInvalidTagSections(settingsIn: TDashboardSettings): TDashboardSettings {
  try {
    const result = { ...settingsIn }
    const tagSectionDetails = getTagSectionDetails(result)
    const showTagSectionKeysToRemove = Object.keys(result).filter(
      (key) => key.startsWith('showTagSection_') && !tagSectionDetails.some((detail) => detail.showSettingName === key),
    )

    showTagSectionKeysToRemove.forEach((key) => {
      if (result[key] !== undefined && typeof result[key] === 'boolean') {
        // $FlowIgnore[incompatible-type]
        delete result[key]
      }
    })
    return result
  } catch (error) {
    logError('removeInvalidTagSections', `Error: ${error.message}. Returning original settings.`)
    return settingsIn
  }
}
