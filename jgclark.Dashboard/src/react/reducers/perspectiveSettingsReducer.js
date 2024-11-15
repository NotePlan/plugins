// @flow
import type { TPerspectiveSettings } from '../../types'
import { PERSPECTIVE_ACTIONS } from './actionTypes'
import { compareObjects } from '@helpers/dev'
import { logDebug, logError } from '@helpers/react/reactDev'

export type TPerspectiveSettingsAction = {
  type: $Values<typeof PERSPECTIVE_ACTIONS>,
  payload: TPerspectiveSettings,
  reason?: string,
}

/**
 * Reducer for managing perspective settings
 * @param {*} state
 * @param {*} action
 * @returns TPerspectiveSettings
 */
export function perspectiveSettingsReducer(state: TPerspectiveSettings, action: TPerspectiveSettingsAction): TPerspectiveSettings {
  const { type, payload, reason } = action
  switch (type) {
    case PERSPECTIVE_ACTIONS.SET_PERSPECTIVE_SETTINGS: {
      const changedProps = compareObjects(state, payload)
      logDebug('perspectiveSettingsReducer', `"${reason || ''}" - Changed properties: ${JSON.stringify(changedProps)}`)
      return payload
    }
    default:
      logError('perspectiveSettingsReducer', `Unhandled action type: ${type}`)
      return state
  }
}
