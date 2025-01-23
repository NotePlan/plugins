// @flow

import { useEffect, useRef } from 'react'
import isEqual from 'lodash/isEqual'
import { DASHBOARD_ACTIONS } from '../reducers/actionTypes'
import { type TPluginData } from '../../types'
import { compareObjects, getDiff } from '@helpers/dev'
import { logDebug, clo } from '@helpers/react/reactDev.js'

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

  // Handle receiving changes from the plugin which need to update the dashboard settings in the front-end
  useEffect(() => {
    const pluginDataDSettingsChanged = pluginDataDSettings && compareFn(lastpluginDataDSettingsRef.current, pluginDataDSettings) !== null
    logDebug(
      `useSyncDashboardSettingsWithPlugin effect1 PLUGIN->REACT checking pluginData?.serverPush?.dashboardSettings=${String(pluginData?.serverPush?.dashboardSettings) || ''}`,
    )
    if (pluginDataDSettingsChanged) {
      logDebug(
        `useSyncDashboardSettingsWithPlugin PLUGIN->REACT plugin sent changes to front-end`,
        `CC pluginDataDSettingsChanged=${String(pluginDataDSettingsChanged)} excluded=${pluginDataDSettings.excludedFolders}`,
        { pluginDataDSettings },
        { lastpluginDataDSettingsRef: lastpluginDataDSettingsRef.current },
      )
      const changes = compareFn(pluginDataDSettings, dashboardSettings)
      const realDiff = getDiff(pluginDataDSettings, dashboardSettings)
      lastpluginDataDSettingsRef.current = pluginDataDSettings
      if (changes && Object.keys(changes).length > 0) {
        logDebug(`useSyncDashboardSettingsWithPlugin plugin sent changes to front-end`, `diff=`, realDiff)
        logDebug('Dispatching to front-end to set values')
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
    const diff = dashboardSettings ? compareFn(lastDashboardSettingsRef.current, dashboardSettings) : null
    const dashboardSettingsChanged = dashboardSettings && diff !== null
    const realDiff = getDiff(lastDashboardSettingsRef.current, dashboardSettings)
    if (dashboardSettingsChanged) {
      logDebug(
        `useSyncDashboardSettingsWithPlugin dashboardSettings in REACT changed BB dashboardSettingsChanged: ${String(
          dashboardSettingsChanged,
        )} pluginData.perspectiveChanging:${String(pluginData.perspectiveChanging)}`,
        { dashboardSettings, realDiff, serverPush: pluginData?.serverPush?.dashboardSettings },
      )
      if (pluginData?.serverPush?.dashboardSettings) {
        logDebug(
          `useSyncDashboardSettingsWithPlugin pluginData changed; serverPush=${JSON.stringify(
            pluginData.serverPush,
          )} changing serverPush.dashboardSettings to false; not sending to server`,
        )
        const newPluginData = { ...pluginData, serverPush: { ...pluginData.serverPush, dashboardSettings: false } }
        updatePluginData(newPluginData, `acknowledging server push`)
        // was a server push so don't need to send to server
      } else {
        logDebug(`useSyncDashboardSettingsWithPlugin front-end settings data changed (was not server push) AC diff/realDiff=`, { diff, realDiff })
        if (diff && Object.keys(diff).length > 0) {
          logDebug(`useSyncDashboardSettingsWithPlugin pluginData changed (was not server push) AC diff=`, { realDiff })
          if (dashboardSettings.lastChange && (dashboardSettings.lastChange[0] === '_' || dashboardSettings.lastChange.endsWith('changed from plugin'))) {
            logDebug(`useSyncDashboardSettingsWithPlugin`, `NOT SENDING BECAUSE OF UNDERSCORE: dashboardSettings.lastChange=${JSON.stringify(dashboardSettings.lastChange)}`, diff)
          } else {
            logDebug(`useSyncDashboardSettingsWithPlugin SENDING: dashboardSettings.lastChange=${JSON.stringify(dashboardSettings.lastChange)}`, dashboardSettings)
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
        }
      }
      lastDashboardSettingsRef.current = dashboardSettings
    }
  }, [dashboardSettings, sendActionToPlugin, compareFn, pluginData])

  useEffect(() => {
    if (pluginData.serverPush.dashboardSettings) {
      logDebug(`useSyncDashboardSettingsWithPlugin pluginData.serverPush.dashboardSettings is true; resetting it`, {
        pluginData,
      })
      const newPluginData = { ...pluginData, serverPush: { ...pluginData.serverPush, dashboardSettings: false } }
      updatePluginData(newPluginData, `acknowledging server push`)
    }
  }, [pluginData.serverPush.dashboardSettings])
}
