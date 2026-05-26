// @flow
//-----------------------------------------------------------------------------
// Resolve perspectiveSettings when saving dashboardSettings without a full
// perspective payload from the client (bridge). Extracted from clickHandlers.
// Last updated 2026-05-25 for v2.4.0.b44, @CursorAI
//-----------------------------------------------------------------------------

import { isDashboardGlobalOnlySettingsDiff } from './dashboardSettingsClean'
import { setDashPerspectiveSettings } from './perspectiveClickHandlers'
import { getActivePerspectiveDef, getPerspectiveLiveVsSavedDiff, loadPerspectiveDefsFromPluginSettings } from './perspectiveHelpers'
import type { TBridgeClickHandlerResult, TDashboardSettings, TPerspectiveSettings } from './types'
import { clo, JSP, logDebug, logError } from '@helpers/dev'

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
      const diff = getPerspectiveLiveVsSavedDiff(activePerspDef, dashboardNewSettings)

      // No perspective-relevant diff: still save top-level dashboardSettings (e.g. usePerspectives), do not set isModified
      if (!diff) {
        logDebug(logFn, `No perspective-relevant diff vs saved def; continuing to save dashboardSettings only`)
        return { kind: 'continue' }
      }
      if (isDashboardGlobalOnlySettingsDiff(Object.keys(diff))) {
        logDebug(logFn, `Dashboard-global-only diff (${Object.keys(diff).join(', ')}); continuing through doSaveDashboardSettingsFromBridge (setPluginData + disk)`)
        return { kind: 'continue' }
      }

      clo(diff, `${logFn}: Setting perspective.isModified because of changes to settings: ${Object.keys(diff).length} keys: ${Object.keys(diff).join(', ')}`)
      Object.keys(diff).forEach((d) => {
        logDebug(logFn, `perspective-relevant diff key '${String(d)}'`)
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
