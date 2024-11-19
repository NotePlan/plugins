// @flow

// FIXME: (dbw) This does seem to be sending a copy of dashboardSettings to the plugin, but then it's resetting it and sending back the old copy.

import { useEffect, useRef } from 'react'
import { logDebug, clo } from '@helpers/react/reactDev.js'
import { compareObjects, getDiff } from '@helpers/dev'
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
    const pluginSettingsChanged = pluginSettings && compareFn(lastPluginSettingsRef.current, pluginSettings) !== null
    console.log(`useSyncWithPlugin [${actionType}]`, `DW 08 pluginSettingsChanged: ${pluginSettingsChanged}`, pluginSettings)
    if (pluginSettingsChanged) {
      // If the pluginSettings were sent by us, then the plugin sends them back in the pluginData with a _in front of lastChange to tell us to ignore them
      // because we already applied them.
      // logDebug(`useSyncWithPlugin/useEffect(pluginSettings) [${actionType}]`, `about to compare pluginSettings and localSettings`)
      const diff = compareFn(pluginSettings, localSettings)
      const isEq = isEqual(pluginSettings, localSettings)
      const realDiff = getDiff(pluginSettings, localSettings)
      console.log(`useSyncWithPlugin [${actionType}]`, `DW 09 pluginSettingsChanged: diff=`, realDiff)
      if (diff && Object.keys(diff).length > 0) {
        logDebug(`useSyncWithPlugin [${actionType}]`, `actionType=${actionType}; Receivedfrom plugin: diff=`, diff)
        dispatch({
          type: actionType,
          payload: pluginSettings,
          reason: `${actionType} changed from plugin`,
        })
        lastPluginSettingsRef.current = pluginSettings
        lastLocalSettingsRef.current = pluginSettings
      } else {
        // logDebug('useSyncWithPlugin', `Noticed pluginSettings change but diff is empty; do nothing :)`)
      }
    }
  }, [pluginSettings, localSettings, dispatch, actionType, compareFn])

  // Handle Dashboard front-end changes which need sending changes to the plugin
  useEffect(() => {
    const diff = localSettings ? compareFn(lastLocalSettingsRef.current, localSettings) : null
    const localSettingsChanged = localSettings && diff !== null
    const realDiff = getDiff(lastLocalSettingsRef.current, localSettings)
    if (localSettingsChanged) {
      if (diff && Object.keys(diff).length > 0) {
        if (localSettings.lastChange && (localSettings.lastChange[0] === '_' || localSettings.lastChange.endsWith('changed from plugin'))) {
          // logDebug(
          //   `useSyncWithPlugin [${actionType}]`,
          //   `DW 19 NOT SENDING BECAUSE OF UNDERSCORE:localSettings.lastChange=${JSON.stringify(localSettings.lastChange)} diff=${JSON.stringify(diff)}`,
          // )
        } else {
          if (actionType !== 'perspectiveSettingsChanged') {
            console.log(
              `useSyncWithPlugin [${actionType}]`,
              `DW 20 SENDING TO PLUGIN: ${actionType === 'perspectiveSettingsChanged' ? `localSettings.lastChange=${JSON.stringify(localSettings.lastChange)}` : ''} diff=`,
              realDiff,
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
        }
        lastLocalSettingsRef.current = localSettings
      }
    }
  }, [localSettings, pluginSettings, sendActionToPlugin, actionType, compareFn])
}
