// @flow
import type { TPerspectiveSettings } from '../../types'
import { setActivePerspective } from '../../perspectiveHelpers'
import { PERSPECTIVE_ACTIONS } from './actionTypes'
import { compareObjects, getDiff } from '@np/helpers/dev'
import { logDebug, logError, clo } from '@np/helpers/react/reactDev'

export type TPerspectiveSettingsAction =
  | {
      type: typeof PERSPECTIVE_ACTIONS.SET_PERSPECTIVE_SETTINGS,
      payload: TPerspectiveSettings,
      reason?: string,
    }
  | {
      type: typeof PERSPECTIVE_ACTIONS.SET_ACTIVE_PERSPECTIVE,
      payload: string,
      reason?: string,
    }

/**
 * Reducer for managing perspective settings
 * @param {TPerspectiveSettings} state
 * @param {TPerspectiveSettingsAction} action
 * @returns {TPerspectiveSettings}
 */
export function perspectiveSettingsReducer(state: TPerspectiveSettings, action: TPerspectiveSettingsAction): TPerspectiveSettings {
  const { type, payload, reason } = action
  switch (type) {
    case PERSPECTIVE_ACTIONS.SET_PERSPECTIVE_SETTINGS: {
      if (payload && typeof payload === 'object') {
        const changedProps = compareObjects(state, payload)
        console.log('perspectiveSettingsReducer', `"${reason || ''}" - Changed properties:`, changedProps)
        return payload
      }
      logError('perspectiveSettingsReducer', `"${reason || ''}" - SET_PERSPECTIVE_SETTINGS action received with non-object payload: ${payload}`)
      return state
    }
    case PERSPECTIVE_ACTIONS.SET_ACTIVE_PERSPECTIVE: {
      if (typeof payload === 'string') {
        logDebug('perspectiveSettingsReducer', `"${reason || ''}" - Active perspective set to: ${payload}`)
        return setActivePerspective(payload, state)
      }
      logError('perspectiveSettingsReducer', `"${reason || ''}" - SET_ACTIVE_PERSPECTIVE action received with non-string payload: ${String(payload)}`)
      return state
    }
    default:
      logError('perspectiveSettingsReducer', `Unhandled action type: ${type}`)
      return state
  }
}
