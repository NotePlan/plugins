// @flow
import type { TDashboardSettings } from '../../../src/types'
import { DASHBOARD_ACTIONS } from './actionTypes'
import { compareObjects } from '@helpers/dev'
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
      logDebug(
        'dashboardSettingsReducer called to set dashboardSettings',
        `${type} "${reason || ''}" - payload.lastChange=${payload.lastChange || ''} payload.filterPriorityItems=${JSON.stringify(
          payload.filterPriorityItems,
        )} payload.excludedFolders=${JSON.stringify(payload.excludedFolders)}; about to compare state and payload`,
      )
      const changedProps = compareObjects(state, payload)
      changedProps && logDebug('dashboardSettingsReducer', `${type} "${reason || ''}" - Changed properties: ${JSON.stringify(changedProps)}`)
      return {
        ...state,
        ...payload,
        lastChange: reason || '',
      }
    }
    default:
      logError('AppContext/dashboardSettingsReducer', `Unhandled action type: ${type}`)
      return state
  }
}
