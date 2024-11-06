// @flow

import { useEffect, useRef } from 'react'
import { logDebug } from '@helpers/react/reactDev.js'
import { compareObjects } from '@helpers/dev'

type DispatchAction = {
  type: string,
  payload: any,
  reason?: string,
}

type SendActionToPlugin = (actionType: string, data: any, methodName: string, showNotification?: boolean) => void

type CompareFn = (a: any, b: any) => any

/**
 * Custom hook to synchronize local settings with plugin settings.
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
  const lastPluginSettingsRef = useRef<any>(pluginSettings)
  const lastLocalSettingsRef = useRef<any>(localSettings)

  // Handle receiving changes from the plugin which need dispatching to the front-end
  useEffect(() => {
    logDebug('useSyncWithPlugin', 'useEffect(pluginSettings) - pluginSettings changed')

    const pluginSettingsChanged = pluginSettings && compareFn(pluginSettings, lastPluginSettingsRef.current) !== null

    if (pluginSettingsChanged) {
      const diff = compareFn(pluginSettings, localSettings)
      if (diff && Object.keys(diff).length > 0) {
        logDebug('useSyncWithPlugin', `${actionType} changed from plugin: diff=${JSON.stringify(diff)}`)
        dispatch({
          type: actionType,
          payload: pluginSettings,
          reason: `${actionType} changed from plugin: ${JSON.stringify(diff)}`,
        })
        lastPluginSettingsRef.current = pluginSettings
        lastLocalSettingsRef.current = pluginSettings
      }
    }
  }, [pluginSettings, localSettings, dispatch, actionType, compareFn])

  // Handle Dashboard front-end changes which need sending changes to the plugin
  useEffect(() => {
    logDebug('useSyncWithPlugin', 'useEffect(localSettings) - React local settings changed')
    const localSettingsChanged = localSettings && compareFn(localSettings, lastLocalSettingsRef.current) !== null

    if (localSettingsChanged) {
      const diff = compareFn(localSettings, pluginSettings)
      if (diff && Object.keys(diff).length > 0) {
        logDebug('useSyncWithPlugin', `Sending ${actionType} changes to plugin: diff=${JSON.stringify(diff)}`)
        sendActionToPlugin(
          actionType,
          {
            actionType: actionType,
            settings: localSettings,
            logMessage: `${actionType} changed`,
          },
          `${actionType} updated`,
          true,
        )
        lastLocalSettingsRef.current = localSettings
      }
    }
  }, [localSettings, pluginSettings, sendActionToPlugin, actionType, compareFn])
}
