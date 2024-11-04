// @flow
import { useEffect, useRef } from 'react'
import { compareObjects } from '@helpers/dev'
import { logDebug } from '@helpers/react/reactDev.js'

type DispatchAction = {
  type: string,
  payload: any,
  reason?: string,
}

type SendActionToPlugin = (command: string, dataToSend: any, details?: string, updateGlobalData?: boolean) => void

type CompareFn = (a: any, b: any) => any

/**
 * Custom hook to sync local settings with plugin settings.
 * @param {any} localSettings - The local settings state.
 * @param {any} pluginSettings - The settings from the plugin.
 * @param {Function} dispatch - Dispatch function to update local settings.
 * @param {string} actionType - The action type for dispatching changes.
 * @param {Function} sendActionToPlugin - Function to send changes to the plugin.
 * @param {Function} compareFn - Function to compare local and plugin settings.
 */
export const useSyncWithPlugin = (
  localSettings: any,
  pluginSettings: any,
  dispatch: (action: DispatchAction) => void,
  actionType: string,
  sendActionToPlugin: SendActionToPlugin,
  compareFn: CompareFn = compareObjects,
) => {
  const lastSentSettingsRef = useRef<?any>(null)

  // Handle receiving changes from the plugin which need dispatching to the front-end
  useEffect(() => {
    const diff = compareFn(localSettings, pluginSettings)
    if (diff) {
      logDebug('useSyncWithPlugin', `${actionType} changed from plugin: ${JSON.stringify(diff)}`)
      dispatch({
        type: actionType,
        payload: pluginSettings,
        reason: `${actionType} changed from plugin: ${JSON.stringify(diff)}`,
      })
    }
  }, [pluginSettings, dispatch, actionType, compareFn])

  // Handle Dashboard front-end changes which need sending changes to the plugin
  useEffect(() => {
    const shouldSendToPlugin = lastSentSettingsRef.current && JSON.stringify(localSettings) !== JSON.stringify(lastSentSettingsRef.current)

    const diff = compareFn(localSettings, lastSentSettingsRef.current)
    if (shouldSendToPlugin && diff) {
      logDebug('useSyncWithPlugin', `Sending ${actionType} changes to plugin: ${JSON.stringify(diff)}`)
      sendActionToPlugin(
        `${actionType}Changed`,
        {
          actionType: `${actionType}Changed`,
          settings: localSettings,
          logMessage: `${actionType} changed`,
        },
        `${actionType} updated`,
        true,
      )
      lastSentSettingsRef.current = localSettings
    }
  }, [localSettings, sendActionToPlugin, actionType, compareFn])
}
