// @flow
//-----------------------------------------------------------------------------
// Clean dashboard settings objects (per-perspective strip list).
// Extracted from perspectiveHelpers.js to avoid circular imports with
// dashboardPluginSettings.js / dashboardHelpers.js.
// Last updated 2026-05-28 for v2.4.0.b45 by @CursorAI
//-----------------------------------------------------------------------------

import { getTagSectionDetails } from './react/components/Section/sectionHelpers'
import type { TDashboardSettings, TSection } from './types'
import { logDebug, logError } from '@helpers/dev'

/** Tag cache is used unless FFlag_UseTagCache is explicitly false in dashboardSettings. */
export function isTagCacheEnabled(dashboardSettings?: Partial<TDashboardSettings>): boolean {
  return dashboardSettings?.FFlag_UseTagCache !== false
}

/**
 * Build strip patterns for keys that belong in top-level dashboardSettings only (not in perspective defs).
 * @param {boolean} deleteAllShowTagSections
 * @returns {Array<RegExp>}
 */
function buildDashboardGlobalSettingPatterns(deleteAllShowTagSections?: boolean): Array<RegExp> {
  const patternsToRemove = [
    'perspectivesEnabled',
    'usePerspectives',
    'showFeatureFlagMenu',
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
    'searchOptions',
    'preferredWindowType',
  ].map((pattern) => (typeof pattern === 'string' ? new RegExp(`^${pattern}$`) : pattern))
  if (deleteAllShowTagSections) {
    patternsToRemove.push(/showTagSection_/)
  }
  return patternsToRemove
}

/**
 * Whether a dashboardSettings key is dashboard-global (stored only in top-level dashboardSettings).
 * @param {string} key
 * @returns {boolean}
 */
export function isDashboardGlobalSettingKey(key: string): boolean {
  return buildDashboardGlobalSettingPatterns(false).some((pattern) => pattern.test(key))
}

/**
 * Whether every key in a settings diff is dashboard-global (FFlags, showFeatureFlagMenu, etc.).
 * @param {Array<string>} diffKeys
 * @returns {boolean}
 */
export function isDashboardGlobalOnlySettingsDiff(diffKeys: Array<string>): boolean {
  return diffKeys.length > 0 && diffKeys.every((key) => isDashboardGlobalSettingKey(key))
}

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
  const patternsToRemove = buildDashboardGlobalSettingPatterns(deleteAllShowTagSections)

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
      // logDebug('cleanDashboardSettingsInAPerspective', `- Removed keys: [${removedKeys.join(', ')}]`)
    }

    return settingsOut
  } catch (error) {
    logError('cleanDashboardSettingsInAPerspective', `Error: ${error.message}`)
    return {}
  }
}

/**
 * Tag section names currently listed in `tagsToShow` (source of truth for TAG section sync).
 * @param {TDashboardSettings} dashboardSettings
 * @returns {Set<string>}
 */
export function getWantedTagNamesFromSettings(dashboardSettings: TDashboardSettings): Set<string> {
  const tagsCsv = (dashboardSettings.tagsToShow ?? '').trim()
  if (!tagsCsv) return new Set()
  return new Set(getTagSectionDetails(dashboardSettings).map((d) => d.sectionName))
}

/**
 * Remove tag sections from the dashboard settings that are not relevant to the current perspective
 * (e.g. leaving only the tags included in dashboardSettings.tagsToShow)
 * Related: {@link removeStaleTagSections} cleans the same tag drift in `pluginData.sections` (TAG rows), not settings keys.
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

/**
 * Drop generated TAG sections that are no longer listed in `tagsToShow`.
 * Why? `CLOSE_UNNEEDED_SECTIONS` only checks sectionCode `TAG`, so stale tag rows (e.g. @father after switching to @friend) were left in pluginData until a perspective switch cleared `sections`.
 * Related: {@link removeInvalidTagSections} cleans the same tag drift in dashboard settings (`showTagSection_*` keys), not section rows.
 * @author @CursorAI
 * @param {Array<TSection>} sections
 * @param {TDashboardSettings} dashboardSettings
 * @returns {Array<TSection>}
 */
export function removeStaleTagSections(sections: Array<TSection>, dashboardSettings: TDashboardSettings): Array<TSection> {
  try {
    const wantedTagNames = getWantedTagNamesFromSettings(dashboardSettings)
    if (wantedTagNames.size === 0) {
      return sections.filter((s) => s.sectionCode !== 'TAG')
    }
    const removed: Array<string> = []
    const kept = sections.filter((s) => {
      if (s.sectionCode !== 'TAG') return true
      if (wantedTagNames.has(s.name)) return true
      removed.push(s.name)
      return false
    })
    if (removed.length > 0) {
      logDebug('removeStaleTagSections', `- Removed stale TAG section(s): [${removed.join(', ')}]`)
    }
    return kept
  } catch (error) {
    logError('removeStaleTagSections', `Error: ${error.message}. Returning original sections.`)
    return sections
  }
}

/**
 * Synchronise TAG sections in `pluginData.sections` with current dashboard settings.
 * This performs three passes:
 * - remove stale tags not present in `tagsToShow`
 * - remove TAG sections explicitly toggled off via `showTagSection_*`
 * - dedupe repeated TAG sections by tag name (keep latest / last)
 * @author @CursorAI
 * @param {Array<TSection>} sections
 * @param {TDashboardSettings} dashboardSettings
 * @returns {Array<TSection>}
 */
export function syncTagSectionsWithSettings(sections: Array<TSection>, dashboardSettings: TDashboardSettings): Array<TSection> {
  try {
    const withoutStale = removeStaleTagSections(sections, dashboardSettings)
    const tagDetails = getTagSectionDetails(dashboardSettings)
    const enabledByTagName: Map<string, boolean> = new Map(
      tagDetails.map((detail) => {
        // $FlowIgnore[invalid-computed-prop]
        const showSettingValue = dashboardSettings[detail.showSettingName]
        return [detail.sectionName, showSettingValue !== false]
      }),
    )

    const removedDisabled: Array<string> = []
    const withoutDisabled = withoutStale.filter((section) => {
      if (section.sectionCode !== 'TAG') return true
      if (!enabledByTagName.has(section.name)) return false
      const isEnabled = enabledByTagName.get(section.name) === true
      if (!isEnabled) removedDisabled.push(section.name)
      return isEnabled
    })
    if (removedDisabled.length > 0) {
      logDebug('syncTagSectionsWithSettings', `- Removed disabled TAG section(s): [${removedDisabled.join(', ')}]`)
    }

    // Keep the latest TAG row for a given tag name (last in array wins), preserve overall order.
    const seen = new Set()
    const dedupedReversed: Array<TSection> = []
    const removedDupes: Array<string> = []
    for (let i = withoutDisabled.length - 1; i >= 0; i--) {
      const section = withoutDisabled[i]
      if (section.sectionCode !== 'TAG') {
        dedupedReversed.push(section)
        continue
      }
      const tagName = section.name
      if (seen.has(tagName)) {
        removedDupes.push(tagName)
        continue
      }
      seen.add(tagName)
      dedupedReversed.push(section)
    }
    if (removedDupes.length > 0) {
      logDebug('syncTagSectionsWithSettings', `- Removed duplicate TAG section(s): [${removedDupes.join(', ')}]`)
    }
    return dedupedReversed.reverse()
  } catch (error) {
    logError('syncTagSectionsWithSettings', `Error: ${error.message}. Returning original sections.`)
    return sections
  }
}
