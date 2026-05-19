// @flow
//-----------------------------------------------------------------------------
// Resolve perspectiveSettings when saving dashboardSettings without a full
// perspective payload from the client (bridge). Extracted from clickHandlers.
// Last updated 2026-05-13 for v2.4.0.b33, @CursorAI
//-----------------------------------------------------------------------------

import { getDashboardSettingsDefaults, handlerResult } from './dashboardHelpers'
import { loadDashboardPluginSettings, saveDashboardPluginSettings } from './dashboardPluginSettings'
import { setDashPerspectiveSettings } from './perspectiveClickHandlers'
import { cleanDashboardSettingsInAPerspective, getActivePerspectiveDef, loadPerspectiveDefsFromPluginSettings } from './perspectiveHelpers'
import type { TBridgeClickHandlerResult, TDashboardSettings, TPerspectiveSettings } from './types'
import { clo, compareObjects, JSP, logDebug, logError } from '@helpers/dev'

const logFn = 'doSaveDashboardSettingsFromBridge'

export type TPerspectiveResolveForDashboardSaveResult =
  | { kind: 'continue', perspectivesToSave?: TPerspectiveSettings }
  | { kind: 'done', result: TBridgeClickHandlerResult }

/**
 * When `dashboardSettings` is saved without `data.perspectiveSettings`, decide whether to
 * short-circuit (no perspective merge / empty diff / FFlag-only) or continue with a `perspectivesToSave` array.
 * @param {Partial<TDashboardSettings>} dashboardNewSettings - normalised dashboard settings from the client
 * @param {Partial<TDashboardSettings>} newSettings - raw settings payload (e.g. FFlag save uses this object)
 * @returns {Promise<TPerspectiveResolveForDashboardSaveResult>}
 */
export async function resolvePerspectivesWhenDashboardSettingsWithoutPerspectivePayload(
  dashboardNewSettings: Partial<TDashboardSettings>,
  newSettings: Partial<TDashboardSettings>,
): Promise<TPerspectiveResolveForDashboardSaveResult> {
  let perspectivesToSave: void | TPerspectiveSettings
  let needToSetDash = false
  const perspectiveSettings = await loadPerspectiveDefsFromPluginSettings()
  if (dashboardNewSettings.usePerspectives) {
    // All changes to dashboardSettings should be saved in the "-" perspective (changes to perspectives are not saved until Save... is selected)
    const activePerspDef = getActivePerspectiveDef(perspectiveSettings)
    logDebug(logFn, `activePerspDef.name=${String(activePerspDef?.name || '')} Array.isArray(newSettings)=${String(Array.isArray(newSettings))}`)

    if (activePerspDef && activePerspDef.name !== '-' && !Array.isArray(dashboardNewSettings)) {
      // Clean up the settings before then comparing them with the active perspective settings
      const dashboardSettingsDefaults = getDashboardSettingsDefaults()
      const newSettingsWithDefaults = { ...dashboardSettingsDefaults, ...dashboardNewSettings }
      const activePerspDefDashboardSettingsWithDefaults = { ...dashboardSettingsDefaults, ...activePerspDef.dashboardSettings }
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const cleanedSettings = cleanDashboardSettingsInAPerspective(newSettingsWithDefaults)

      // Now add all the TAG sections, which otherwise aren't included in the active perspective settings.
      // Get any active perspective setting keys that start 'showTagSection_'
      const activePerspDefShowTagSectionKeys = Object.keys(activePerspDef.dashboardSettings).filter((k) => k.startsWith('showTagSection_'))
      clo(activePerspDefShowTagSectionKeys, `${logFn}: activePerspDefShowTagSectionKeys`)
      // Add all the TAG sections to the active perspective settings
      // $FlowIgnore[prop-missing] - Dynamic property access for tag section keys
      const activePerspDefShowTagSectionObject = activePerspDefShowTagSectionKeys.reduce((acc, k) => {
        acc[k] = activePerspDef.dashboardSettings[k]
        return acc
      }, ({}: { [string]: any }))
      // $FlowIgnore[cannot-spread-indexer] - Dynamic property spread for tag section keys
      const activePerspDefDashboardSettingsWithDefaultsAndTAGs = { ...activePerspDefDashboardSettingsWithDefaults, ...activePerspDefShowTagSectionObject }

      // Compare the cleaned settings with the active perspective settings
      const diff = compareObjects(activePerspDefDashboardSettingsWithDefaultsAndTAGs, cleanedSettings, ['lastModified', 'lastChange', 'usePerspectives'])
      clo(diff, `${logFn}: diff`)

      // No perspective-relevant diff: still save top-level dashboardSettings (e.g. usePerspectives), do not set isModified
      if (!diff || Object.keys(diff).length === 0) {
        logDebug(logFn, `No perspective-relevant diff vs saved def; continuing to save dashboardSettings only`)
        return { kind: 'continue' }
      }
      if (Object.keys(diff).every((d) => d.startsWith('FFlag'))) {
        logDebug(logFn, `Was just a FFlag change. Saving dashboardSettings to DataStore.settings`)
        const res = await saveDashboardPluginSettings({
          ...(await loadDashboardPluginSettings()),
          dashboardSettings: newSettings,
        })
        return { kind: 'done', result: handlerResult(res) }
      }

      clo(diff, `${logFn}: Setting perspective.isModified because of changes to settings: ${Object.keys(diff).length} keys: ${Object.keys(diff).join(', ')}`)
      Object.keys(diff).forEach((d) => {
        logDebug(
          logFn,
          // $FlowIgnore[invalid-computed-prop]
          `activePerspDefDashboardSettingsWithDefaults['${String(d)}']=${d ? activePerspDefDashboardSettingsWithDefaults[d] : ''} vs. sent to save: cleanedSettings['${String(d)}']=${d ? cleanedSettings[d] : ''
          }`,
        )
      })

      // ignore dashboard changes in the perspective definition until it is saved explicitly
      // but we need to set the isModified flag on the perspective
      logDebug(logFn, `Setting isModified to true for perspective ${activePerspDef.name}`)
      perspectivesToSave = perspectiveSettings.map((p) => (p.name === activePerspDef.name ? { ...p, isModified: true } : { ...p, isModified: false }))
    } else {
      needToSetDash = true
    }
  } else {
    needToSetDash = true
  }
  if (needToSetDash) {
    if (dashboardNewSettings && typeof dashboardNewSettings === 'object' && !Array.isArray(dashboardNewSettings)) {
      // $FlowFixMe[incompatible-call]
      perspectivesToSave = setDashPerspectiveSettings(dashboardNewSettings, perspectiveSettings)
    } else {
      logError(logFn, `newSettings is not an object: ${JSP(newSettings)}`)
    }
  }
  return { kind: 'continue', perspectivesToSave }
}
