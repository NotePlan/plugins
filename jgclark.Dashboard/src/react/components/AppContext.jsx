/****************************************************************************************************************************
 *                             APP CONTEXT
 ****************************************************************************************************************************
 * This is a shared context provider for NotePlan React Apps. It provides a context for the app to communicate with the plugin.
 * It also provides a context for the plugin to communicate with the app.
 * @usage import { useAppContext } from './AppContext.jsx'
 * @usage const {sendActionToPlugin, sendToPlugin, dispatch, pluginData, reactSettings, setReactSettings, updatePluginData, dashboardSettings, dispatchDashboardSettings } = useAppContext()
 *
 ****************************************************************************************************************************/
// @flow

import React, { createContext, useContext, useEffect, useReducer, useRef, type Node } from 'react'
import type { TDashboardSettings, TReactSettings, TPerspectiveDef, TPluginData } from '../../types'
import { clo, logDebug, logError } from '@helpers/react/reactDev.js'
import { compareObjects } from '@helpers/dev'

/****************************************************************************************************************************
 *                             TYPES
 ****************************************************************************************************************************/

export type AppContextType = {
  sendActionToPlugin: (command: string, dataToSend: any, details?: string, updateGlobalData?: boolean) => void,
  sendToPlugin: ([string, any, string]) => void,
  dispatch: (command: string, dataToSend: any, message?: string) => void,
  pluginData: TPluginData,
  reactSettings: ?TReactSettings,
  setReactSettings: (any) => void,
  updatePluginData: (newData: TPluginData, messageForLog?: string) => void,
  dashboardSettings: TDashboardSettings,
  dispatchDashboardSettings: (action: { type: string, payload?: any, reason?: string }) => void,
  perspectiveSettings: Array<TPerspectiveDef>,
  setPerspectiveSettings: (any) => void,
}

type Props = {
  children?: Node,
} & AppContextType;

export type TDashboardSettingsAction =
  | {|
  type: 'SET_DASHBOARD_SETTINGS',
    payload: TDashboardSettings,
      reason ?: string,
    |}
  | {|
  type: 'UPDATE_DASHBOARD_SETTING',
    payload: {| key: $Keys < TDashboardSettings >, value: any |},
reason ?: string,
    |}
  | {|
  type: 'UPDATE_DASHBOARD_SETTINGS',
    payload: TDashboardSettings,
      reason ?: string,
    |}

/****************************************************************************************************************************
 *                             DEFAULT CONTEXT VALUE
 ****************************************************************************************************************************/

// Default context value with initial reactSettings and functions.
const defaultContextValue: AppContextType = {
  sendActionToPlugin: () => { },
  sendToPlugin: () => { },
  dispatch: () => { },
  pluginData: {}, // TEST: removal of settings in here
  reactSettings: {}, // Initial empty reactSettings local
  setReactSettings: () => { },
  updatePluginData: () => { }, // Placeholder function, actual implementation below.
  dashboardSettings: {},
  dispatchDashboardSettings: () => { },
  perspectiveSettings: [],
  setPerspectiveSettings: () => { },
}

  // Reducer for dashboardSettings
  const dashboardSettingsReducer = (
    state: TDashboardSettings,
    action: TDashboardSettingsAction,
  ): TDashboardSettings => {
    const { type, payload, reason } = action
    logDebug('AppContext/dashboardSettingsReducer', `Action Type: ${type}, Reason: ${reason ?? 'None'}`, payload)
    switch (type) {
      case 'SET_DASHBOARD_SETTINGS': // replace the full dashboard settings object with the payload sent
        return {
          ...payload,
        }
      case 'UPDATE_DASHBOARD_SETTINGS': // replace only the specific properties sent in the payload
        const changedProps = compareObjects(state, payload)
        logDebug('AppContext/dashboardSettingsReducer', `Changed properties: ${JSON.stringify(changedProps)}`)
        return {
          ...state,
          ...payload,
        }
      case 'UPDATE_DASHBOARD_SETTING': // update a single property in the dashboard settings object
        if (payload) {
          const { key, value } = payload
          return {
            ...state,
            [key]: value,
          }
        } else {
          logError('AppContext/dashboardSettingsReducer', 'Payload is undefined for UPDATE_DASHBOARD_SETTING')
          return state
        }
      default:
        logError('AppContext/dashboardSettingsReducer', `Unhandled action type: ${type}`)
        return state
    }
  }
  
/****************************************************************************************************************************
 *                             VARIABLES
 ****************************************************************************************************************************/

const AppContext = createContext < AppContextType > (defaultContextValue)

/****************************************************************************************************************************
 *                             CONTEXT PROVIDER FUNCTIONS
 ****************************************************************************************************************************/

// eslint-disable-next-line max-len
export const AppProvider = ({
  children,
  sendActionToPlugin,
  sendToPlugin,
  dispatch,
  pluginData,
  reactSettings,
  setReactSettings,
  updatePluginData,
  dashboardSettings: initialDashboardSettings,
  perspectiveSettings,
  setPerspectiveSettings,
}: Props): Node => {
  // logDebug(`AppProvider`, `inside component code`)

    /** 
   * Ref to store the last dashboardSettings sent to the plugin to make sure React doesn't send the same thing twice
   * @type {React.RefObject<?TDashboardSettings>} 
   */
    const lastSentDashboardSettingsRef = useRef<?TDashboardSettings>(null)


  // Use useReducer for dashboardSettings
  const [dashboardSettings, dispatchDashboardSettings] = useReducer(
    dashboardSettingsReducer,
    initialDashboardSettings
  )

  // Effect to call sendActionToPlugin when dashboardSettings change
  useEffect(() => {
    const shouldSendToPlugin = dashboardSettings.lastChange && dashboardSettings.lastChange[0] !== '_' && JSON.stringify(dashboardSettings) !== JSON.stringify(lastSentDashboardSettingsRef.current)

    const changedProps = compareObjects(dashboardSettings, pluginData.dashboardSettings)
    logDebug('AppContext/useEffect(dashboardSettings)', `Changed properties: ${JSON.stringify(changedProps)}`)  

    if (shouldSendToPlugin) {
      sendActionToPlugin(
      'dashboardSettingsChanged',
      {
        actionType: 'dashboardSettingsChanged',
        settings: dashboardSettings,
        logMessage: dashboardSettings.lastChange || '',
      },
      'Dashboard dashboardSettings updated',
      true
      )
      lastSentDashboardSettingsRef.current = dashboardSettings
    } else {
      logDebug(`AppContext/useEffect(dashboardSettings)`,`Settings is the same. No need to send to plugin`)
    }
  }, [dashboardSettings, sendActionToPlugin])

  const contextValue: AppContextType = {
    sendActionToPlugin,
    sendToPlugin,
    dispatch,
    pluginData,
    reactSettings,
    setReactSettings,
    updatePluginData,
    dashboardSettings,
    dispatchDashboardSettings,
    perspectiveSettings,
    setPerspectiveSettings,
  }

  useEffect(() => {
    logDebug('AppContext', `Just FYI, React settings updated somewhere.`, reactSettings)
  }, [reactSettings])

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
}

export const useAppContext = (): AppContextType => useContext(AppContext)
