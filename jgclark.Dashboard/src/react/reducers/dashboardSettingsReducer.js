// @flow
//--------------------------------------------------------------------------
// Manage the Dashboard settings state changes
// Last updated 2026-06-13 for v2.4.0.b46 by @jgclark + @CursorAI
//--------------------------------------------------------------------------

import type { TDashboardSettings } from '../../../src/types'
import { applyDerivedDashboardSettings } from '../../../src/dashboardSettings'
import { DASHBOARD_ACTIONS } from './actionTypes'
import { compareObjects, getDiff, dtl } from '@helpers/dev'
import { logDebug, logError } from '@helpers/react/reactDev'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------

export type TDashboardSettingsAction = {
  type: $Values<typeof DASHBOARD_ACTIONS>,
  payload: Partial<TDashboardSettings>, // Overwrites existing properties of supplied object
  reason?: string,
}

/**
 * Reducer for managing dashboard settings
 * @param {TDashboardSettings} state
 * @param {TDashboardSettingsAction} action
 * @returns {TDashboardSettings}
 */
export function dashboardSettingsReducer(state: TDashboardSettings, action: TDashboardSettingsAction): TDashboardSettings {
  const { type, payload, reason } = action
  switch (type) {
    case DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS: {
      // For debugging:
      // const changedProps = compareObjects(state, payload)
      // const diff = getDiff(state, payload)
      // changedProps && logDebug('dashboardSettingsReducer BB', `${type} "${reason || ''}" - Changed properties: ${Object.keys(changedProps).join(', ')} keys changed`)
      // console.log(`...dashboardSettingsReducer BC ${type} - diff:`, diff)

      const merged = {
        ...state,
        ...payload,
        lastChange: reason || payload.lastChange || state.lastChange,
        lastModified: dtl(),
      }
      return (applyDerivedDashboardSettings(state, merged): any)
    }
    default:
      logError('AppContext/dashboardSettingsReducer', `Unhandled action type: ${type}`)
      return state
  }
}
