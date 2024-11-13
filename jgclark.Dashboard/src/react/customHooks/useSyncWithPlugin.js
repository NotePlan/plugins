// @flow

// FIXME: (dbw) This does seem to be sending a copy of dashboardSettings to the plugin, but then it's resetting it and sending back the old copy.

import { useEffect, useRef } from 'react'
import { logDebug, clo } from '@helpers/react/reactDev.js'
import { compareObjects } from '@helpers/dev'
import isEqual from 'lodash/isEqual'

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
  sendActionToPlugin?: SendActionToPlugin | null,
  compareFn: CompareFn = compareObjects,
) => {
  const lastPluginSettingsRef = useRef<any>(pluginSettings)
  const lastLocalSettingsRef = useRef<any>(localSettings)

  // Handle receiving changes from the plugin which need dispatching to the front-end
  useEffect(() => {
    // logDebug(`useSyncWithPlugin/useEffect(pluginSettings) [${actionType}]`, `about to compare pluginSettings and lastPluginSettingsRef.current`)
    const pluginSettingsChanged = pluginSettings && compareFn(lastPluginSettingsRef.current, pluginSettings) !== null

    if (pluginSettingsChanged && (!pluginSettings.lastChange || pluginSettings.lastChange[0] !== '_')) {
      // If the pluginSettings were sent by us, then the plugin sends them back in the pluginData with a _in front of lastChange to tell us to ignore them
      // because we already applied them.
      // logDebug(`useSyncWithPlugin/useEffect(pluginSettings) [${actionType}]`, `about to compare pluginSettings and localSettings`)
      const diff = compareFn(pluginSettings, localSettings)
      const isEq = isEqual(pluginSettings, localSettings)
      console.log(`useSyncWithPlugin [${actionType}]`, `isEq=${isEq} diff=${JSON.stringify(diff)}`)
      if (diff && Object.keys(diff).length > 0) {
        logDebug(`useSyncWithPlugin [${actionType}]`, `actionType=${actionType}; Receivedfrom plugin: diff=${JSON.stringify(diff)}`)
        dispatch({
          type: actionType,
          payload: pluginSettings,
          reason: `${actionType} changed from plugin`,
        })
        lastPluginSettingsRef.current = pluginSettings
        lastLocalSettingsRef.current = pluginSettings
      } else {
        logDebug('useSyncWithPlugin', `Noticed pluginSettings change but diff is empty; do nothing :)`)
      }
    }
  }, [pluginSettings, localSettings, dispatch, actionType, compareFn])

  // Handle Dashboard front-end changes which need sending changes to the plugin
  useEffect(() => {
    // logDebug(`useSyncWithPlugin/useEffect(pluginSettings) [${actionType}]`, `DW 05 about to compare localSettings and lastLocalSettingsRef.current`)
    const diff = localSettings ? compareFn(lastLocalSettingsRef.current, localSettings) : null
    // clo(localSettings, `useSyncWithPlugin/useEffect(localSettings): ${diff ? 'changed' : 'not changed'} localSettings`, 2)
    // clo(lastLocalSettingsRef.current, `useSyncWithPlugin/useEffect(localSettings): ${diff ? 'changed' : 'not changed'} lastLocalSettingsRef.current`, 2)
    const localSettingsChanged = localSettings && diff !== null
    localSettingsChanged && diff && logDebug(`useSyncWithPlugin/useEffect(localSettings)[${actionType}]`, `DW 08 after diff diff=${JSON.stringify(diff)}`)

    if (localSettingsChanged) {
      if (diff && Object.keys(diff).length > 0) {
        if (localSettings.lastChange && localSettings.lastChange[0] === '_') {
          logDebug(
            `useSyncWithPlugin [${actionType}]`,
            `DW 19 NOT SENDING BECAUSE OF UNDERSCORE:localSettings.lastChange=${JSON.stringify(localSettings.lastChange)} diff=${JSON.stringify(diff)}`,
          )
        } else {
          logDebug(
            `useSyncWithPlugin [${actionType}]`,
            `DW 20 SENDING TO PLUGIN: localSettings.lastChange=${JSON.stringify(localSettings.lastChange)} diff=${JSON.stringify(diff)}`,
          )
          sendActionToPlugin &&
            sendActionToPlugin(
              actionType,
              {
                actionType: actionType,
                settings: localSettings,
                logMessage: `${actionType} changed: ${JSON.stringify(diff)}`,
              },
              `${actionType} updated`,
              true,
            )
        }
        lastLocalSettingsRef.current = localSettings
      }
    }
  }, [localSettings, pluginSettings, sendActionToPlugin, actionType, compareFn])
}
