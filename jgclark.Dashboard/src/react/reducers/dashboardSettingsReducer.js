// @flow
import type { TDashboardSettings } from '../../../src/types'
import { DASHBOARD_ACTIONS } from './actionTypes'
import { compareObjects, getDiff } from '@helpers/dev'
import { logDebug, logError } from '@helpers/react/reactDev'

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
      // TODO: remove these diffs when debugging is complete
      const changedProps = compareObjects(state, payload)
      const diff = getDiff(state, payload)
      changedProps && logDebug('dashboardSettingsReducer BB', `${type} "${reason || ''}" - Changed properties: ${Object.keys(changedProps).join(', ').length} keys changed`)
      console.log(`...dashboardSettingsReducer BC ${type} - diff:`, diff)
      return {
        ...state,
        ...payload,
        lastChange: reason || state.lastChange,
      }
    }
    default:
      logError('AppContext/dashboardSettingsReducer', `Unhandled action type: ${type}`)
      return state
  }
}
