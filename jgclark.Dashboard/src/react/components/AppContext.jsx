/****************************************************************************************************************************
 *                             APP CONTEXT
 ****************************************************************************************************************************
 * This is a shared context provider for NotePlan React Apps. It provides a context for the app to communicate with the plugin.
 * It also provides a context for the plugin to communicate with the app.
 * @usage import { useAppContext } from './AppContext.jsx'
 * @usage const {sendActionToPlugin, sendToPlugin, dispatch, TPluginData, reactSettings, setReactSettings, updatePluginData, dashboardSettings, setDashboardSettings}  = useAppContext()
 *
 ****************************************************************************************************************************/
// @flow

import React, { createContext, useContext, useEffect, type Node } from 'react'
import type { TDashboardConfig, TReactSettings, TPluginData } from '../../types'
import { logDebug } from '@helpers/react/reactDev'


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
  dashboardSettings: TDashboardConfig,
  setDashboardSettings: (any) => void
}

type Props = {
  children?: Node,
} & AppContextType;

// Default context value with initial reactSettings and functions.
// FIXME(@dwertheimer): should we have 2 uses of dashboardSettings here?
const defaultContextValue: AppContextType = {
  sendActionToPlugin: () => {},
  sendToPlugin: () => {},
  dispatch: () => {},
  pluginData: { dashboardSettings: {} },
  reactSettings: {}, // Initial empty reactSettings local
  setReactSettings: () => {},
  updatePluginData: () => {}, // Placeholder function, actual implementation below.
  dashboardSettings: {},
  setDashboardSettings: () => { },
}

/****************************************************************************************************************************
 *                             VARIABLES
 ****************************************************************************************************************************/

const AppContext = createContext<AppContextType>(defaultContextValue)

/****************************************************************************************************************************
 *                             CONTEXT PROVIDER FUNCTIONS
 ****************************************************************************************************************************/

// eslint-disable-next-line max-len
export const AppProvider = ({ children, sendActionToPlugin, sendToPlugin, dispatch, pluginData, reactSettings, setReactSettings, updatePluginData, dashboardSettings, setDashboardSettings }: Props): Node => {
  // logDebug(`AppProvider`, `inside component code`)

  const contextValue: AppContextType = {
    sendActionToPlugin,
    sendToPlugin,
    dispatch,
    pluginData,
    reactSettings,
    setReactSettings,
    updatePluginData,
    dashboardSettings,
    setDashboardSettings,
  }

  useEffect(() => {
    // logDebug('AppContext', `Just FYI, React settings updated somewhere.`, reactSettings)
  }, [reactSettings])

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
}

export const useAppContext = (): AppContextType => useContext(AppContext)
