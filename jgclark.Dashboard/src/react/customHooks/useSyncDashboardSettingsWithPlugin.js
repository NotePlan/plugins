// @flow

import { useEffect, useRef } from 'react'
import { logDebug, clo } from '@helpers/react/reactDev.js'
import { compareObjects, getDiff } from '@helpers/dev'
import isEqual from 'lodash/isEqual'
import { DASHBOARD_ACTIONS } from '../reducers/actionTypes'
import { type TPluginData } from '../../types'

type DispatchAction = {
  type: string,
  payload: any,
  reason?: string,
}

type SendActionToPlugin = (actionType: string, data: any, methodName: string, showNotification?: boolean) => void

type CompareFn = (a: any, b: any) => any

/**
 * Custom hook to synchronize dashboard settings with plugin settings.
 * When a change is made to dashboardSettings in React, we send a sendActionToPlugin to update the dashboard settings in the plugin
 * But also if the plugin sends a change to pluginData.dashboardSettings, we need to update the local dashboardSettings
 * @param {any} dashboardSettings - The local dashboard settings state.
 * @param {any} pluginDataDSettings - The dashboard settings from the plugin.
 * @param {Function} dispatch - Dispatch function to update local settings.
 * @param {Function} sendActionToPlugin - Function to send changes to the plugin.
 * @param {TPluginData} pluginData - The plugin data.
 * @param {Function} updatePluginData - Function to update the plugin data.
 * @param {Function} compareFn - Function to compare local and plugin settings.
 */
export const useSyncDashboardSettingsWithPlugin = (
  dashboardSettings: any,
  pluginDataDSettings: any,
  dispatch: (action: DispatchAction) => void,
  sendActionToPlugin: SendActionToPlugin,
  pluginData: TPluginData, // for tracking serverPush
  updatePluginData: (data: any, msg: string) => void,
  compareFn: CompareFn = compareObjects,
) => {
  const lastpluginDataDSettingsRef = useRef(pluginDataDSettings)
  const lastDashboardSettingsRef = useRef(dashboardSettings)

  // Handle receiving changes from the plugin which need dispatching to the front-end
  useEffect(() => {
    const pluginDataDSettingsChanged = pluginDataDSettings && compareFn(lastpluginDataDSettingsRef.current, pluginDataDSettings) !== null
    if (pluginDataDSettingsChanged) {
      console.log(
        `useSyncDashboardSettingsWithPlugin`,
        `CC pluginDataDSettingsChanged=${String(pluginDataDSettingsChanged)} excluded=${pluginDataDSettings.excludedFolders}`,
        { pluginDataDSettings },
        { lastpluginDataDSettingsRef: lastpluginDataDSettingsRef.current },
      )
      const changes = compareFn(pluginDataDSettings, dashboardSettings)
      const realDiff = getDiff(pluginDataDSettings, dashboardSettings)
      lastpluginDataDSettingsRef.current = pluginDataDSettings
      if (changes && Object.keys(changes).length > 0) {
        console.log(`useSyncDashboardSettingsWithPlugin`, `diff=`, realDiff)
        console.log('Dispatching to front-end to set values')
        lastDashboardSettingsRef.current = pluginDataDSettings
        dispatch({
          type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS,
          payload: pluginDataDSettings,
        })
      }
    }
  }, [pluginDataDSettings, dashboardSettings, dispatch, compareFn])

  // Handle Dashboard front-end changes which need sending changes to the plugin
  useEffect(() => {
    // console.log(`useSyncDashboardSettingsWithPlugin pluginData changed check AA`)
    const diff = dashboardSettings ? compareFn(lastDashboardSettingsRef.current, dashboardSettings) : null
    const dashboardSettingsChanged = dashboardSettings && diff !== null
    const realDiff = getDiff(lastDashboardSettingsRef.current, dashboardSettings)
    // console.log(`useSyncDashboardSettingsWithPlugin pluginData changed`, `AB dashboardSettingsChanged: ${String(dashboardSettingsChanged)}`, dashboardSettings)
    // console.log(`useSyncDashboardSettingsWithPlugin pluginData changed`, `AC diff=${JSON.stringify(diff)}`, realDiff)
    if (dashboardSettingsChanged) {
      console.log(`useSyncDashboardSettingsWithPlugin pluginData changed BB dashboardSettingsChanged: ${String(dashboardSettingsChanged)}`, { dashboardSettings, realDiff })
      // check if this change was caused by a server push or a user event
      if (pluginData.serverPush.dashboardSettings) {
        const newPluginData = { ...pluginData, serverPush: { ...pluginData.serverPush, dashboardSettings: false } }
        updatePluginData(newPluginData, `acknowledging server push`)
        console.log(`useSyncDashboardSettingsWithPlugin pluginData changed; serverPush=${JSON.stringify(pluginData.serverPush)} changing serverPush.dashboardSettings to false`)
        return // was a server push so don't need to send to server
      }
      if (diff && Object.keys(diff).length > 0) {
        console.log(`useSyncDashboardSettingsWithPlugin pluginData changed AC diff=`, realDiff)
        if (dashboardSettings.lastChange && (dashboardSettings.lastChange[0] === '_' || dashboardSettings.lastChange.endsWith('changed from plugin'))) {
          console.log(`useSyncDashboardSettingsWithPlugin`, `NOT SENDING BECAUSE OF UNDERSCORE: dashboardSettings.lastChange=${JSON.stringify(dashboardSettings.lastChange)}`, diff)
        } else {
          console.log(`useSyncDashboardSettingsWithPlugin SENDING: dashboardSettings.lastChange=${JSON.stringify(dashboardSettings.lastChange)}`, dashboardSettings)
          sendActionToPlugin &&
            sendActionToPlugin(
              'dashboardSettingsChanged',
              {
                actionType: 'dashboardSettingsChanged',
                settings: dashboardSettings,
                logMessage: `dashboardSettingsChanged: ${JSON.stringify(diff)}`,
              },
              `dashboardSettings updated`,
              true,
            )
        }
        lastDashboardSettingsRef.current = dashboardSettings
      }
    }
  }, [dashboardSettings, pluginDataDSettings, sendActionToPlugin, compareFn, pluginData])
}
