// @flow

// FIXME: (dbw) This does seem to be sending a copy of dashboardSettings to the plugin, but then it's resetting it and sending back the old copy.

import { useEffect, useRef } from 'react'
import { logDebug, clo } from '@helpers/react/reactDev.js'
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
    logDebug(`useSyncWithPlugin/useEffect(localSettings)[${actionType}]`, `DW 08 after diff diff=${JSON.stringify(diff)}`)
    actionType === 'dashboardSettingsChanged' &&
      logDebug(
        `useSyncWithPlugin/useEffect(localSettings) [${actionType}]: DW10 localSettings.filterPriorityItems=${JSON.stringify(
          localSettings.filterPriorityItems,
        )} lastLocal=${JSON.stringify(lastLocalSettingsRef.current.filterPriorityItems)}`,
      )
    const localSettingsChanged = localSettings && diff !== null
    // DELETEME: this is temporary logging to help with debugging
    actionType === 'dashboardSettingsChanged' &&
      logDebug(
        `useSyncWithPlugin/useEffect(localSettings) [${actionType}] DW13`,
        `type=${actionType}: Noticed localSettings change: localSettingsChanged=${String(localSettingsChanged)})}`,
      )

    if (localSettingsChanged) {
      // const diff = compareFn(pluginSettings, localSettings)
      logDebug(`useSyncWithPlugin/useEffect(localSettings) [${actionType}]`, `DW 15 diff=${JSON.stringify(diff)}`)
      logDebug(
        `useSyncWithPlugin/useEffect(localSettings) [${actionType}]`,
        `DW 16 diff? ${diff} typeof diff=${typeof diff} isArray=${Array.isArray(diff)} Object.keys(diff).length=${diff ? Object.keys(diff).length : 0} ${
          diff ? Object.keys(diff).join(', ') : ''
        }`,
      )
      if (diff && Object.keys(diff).length > 0) {
        logDebug(`useSyncWithPlugin [${actionType}]`, `DW 18 ${sendActionToPlugin && diff ? 'Sending to plugin' : 'Just FYI Not sending to plugin'}: diff=${JSON.stringify(diff)}`)
        if (localSettings.lastChange && localSettings.lastChange[0] !== '_') {
          logDebug(`useSyncWithPlugin [${actionType}]`, `DW 19 NOT SENDING BECAUSE OF UNDERSCORE:localSettings.lastChange=${JSON.stringify(localSettings.lastChange)}`)
        } else {
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
      } else {
        logDebug(
          'useSyncWithPlugin/useEffect(localSettings)',
          `type=${actionType}: Noticed localSettings change but diff is empty; doing nothing. localSettings.filterPriorityItems=${JSON.stringify(
            localSettings.filterPriorityItems,
          )}`,
        )
      }
    }
  }, [localSettings, pluginSettings, sendActionToPlugin, actionType, compareFn])
}
