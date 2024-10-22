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
import type { TDashboardSettings, TReactSettings, TPluginData, TPerspectiveSettings } from '../../types'
import { dashboardSettingsReducer } from '../reducers/dashboardSettingsReducer'
import { perspectiveSettingsReducer } from '../reducers/perspectiveSettingsReducer'
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
  perspectiveSettings: TPerspectiveSettings,
  dispatchPerspectiveSettings: (action: { type: string, payload?: any, reason?: string }) => void,
}

type Props = {
  children?: Node,
} & AppContextType

/****************************************************************************************************************************
 *                             DEFAULT CONTEXT VALUE
 ****************************************************************************************************************************/

// Default context value with initial reactSettings and functions.
const defaultContextValue: AppContextType = {
  sendActionToPlugin: () => {},
  sendToPlugin: () => {},
  dispatch: () => {},
  pluginData: {}, // TEST: removal of settings in here
  reactSettings: {}, // Initial empty reactSettings local
  setReactSettings: () => {},
  updatePluginData: () => {}, // Placeholder function, actual implementation below.
  dashboardSettings: {},
  dispatchDashboardSettings: () => {},
  perspectiveSettings: [],
  dispatchPerspectiveSettings: () => {},
}

/****************************************************************************************************************************
 *                             VARIABLES
 ****************************************************************************************************************************/

const AppContext = createContext<AppContextType>(defaultContextValue)

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
  perspectiveSettings: initialPerspectiveSettings,
}: Props): Node => {
  // logDebug(`AppProvider`, `inside component code`)

  /**
   * Ref to store the last dashboardSettings sent to the plugin to make sure React doesn't send the same thing twice
   * @type {React.RefObject<?TDashboardSettings>}
   */
  const lastSentDashboardSettingsRef = useRef<?TDashboardSettings>(null)

  // Use useReducer for dashboardSettings
  const [dashboardSettings, dispatchDashboardSettings] = useReducer(dashboardSettingsReducer, initialDashboardSettings)

  const [perspectiveSettings, dispatchPerspectiveSettings] = useReducer(perspectiveSettingsReducer, initialPerspectiveSettings)

  // Effect to call sendActionToPlugin when dashboardSettings change
  useEffect(() => {
    const shouldSendToPlugin =
      dashboardSettings.lastChange && dashboardSettings.lastChange[0] !== '_' && JSON.stringify(dashboardSettings) !== JSON.stringify(lastSentDashboardSettingsRef.current)

    const changedProps = lastSentDashboardSettingsRef.current ? compareObjects(dashboardSettings, lastSentDashboardSettingsRef.current) : dashboardSettings // first time thru .current is null so everything is changed
    logDebug('AppContext/useEffect(dashboardSettings)', `Changed properties: ${JSON.stringify(changedProps)}`)
    // clo(dashboardSettings,'AppContext/useEffect(dashboardSettings) dashboardSettings')
    // clo(lastSentDashboardSettingsRef.current,'AppContext/useEffect(dashboardSettings) lastSentDashboardSettingsRef.current')

    if (shouldSendToPlugin && changedProps) {
      sendActionToPlugin(
        'dashboardSettingsChanged',
        {
          actionType: 'dashboardSettingsChanged',
          settings: dashboardSettings,
          logMessage: dashboardSettings.lastChange || '',
        },
        'Dashboard dashboardSettings updated',
        true,
      )
      lastSentDashboardSettingsRef.current = dashboardSettings
    } else {
      logDebug(`AppContext/useEffect(dashboardSettings)`, `Settings is the same. No need to send to plugin`)
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
    dispatchPerspectiveSettings,
  }

  useEffect(() => {
    logDebug('AppContext', `Just FYI, React settings updated somewhere.`, reactSettings)
  }, [reactSettings])

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
}

export const useAppContext = (): AppContextType => useContext(AppContext)
