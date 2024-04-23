/****************************************************************************************************************************
 *                             APP CONTEXT
 ****************************************************************************************************************************
 * This is a shared context provider for NotePlan React Apps. It provides a context for the app to communicate with the plugin.
 * It also provides a context for the plugin to communicate with the app.
 * Plus local storage of reactSettings
 * @usage import { useAppContext } from './AppContext.jsx'
 * @usage const {sendActionToPlugin, sendToPlugin, dispatch, pluginData, reactSettings, setReactSettings}  = useAppContext()
 *
 ****************************************************************************************************************************/
// @flow

import React, { createContext, useContext, useEffect, type Node } from 'react'
import { logDebug } from '@helpers/reactDev'

logDebug(`AppContext`, `outside component code`)

/****************************************************************************************************************************
 *                             TYPES
 ****************************************************************************************************************************/

export type DialogData = {
  isOpen: boolean,
  [key: string]: any,
}

export type ReactSettings = {
  dialogData?: DialogData,
  [key: string]: any,
}

export type PluginData = {
  [key: string]: any,
}

export type AppContextType = {
  sendActionToPlugin: (command: string, dataToSend: any) => void,
  sendToPlugin: ([string, any, string]) => void,
  dispatch: (command: string, dataToSend: any, message?: string) => void,
  pluginData: PluginData,
  reactSettings: ReactSettings,
  setReactSettings: (newSettings: ReactSettings, msgForLog?: string) => void,
  updatePluginData: (newData: PluginData, messageForLog?: string) => void,
}

type Props = {
  children?: Node,
  sendActionToPlugin: (command: string, dataToSend: any, additionalDetails?: string) => void,
  sendToPlugin: ([string, any, string]) => void,
  dispatch: (command: string, dataToSend: any, messageForLog?: string) => void,
  pluginData: PluginData,
  reactSettings: ReactSettings,
  setReactSettings: (newSettings: ReactSettings, msgForLog?: string) => void,
  updatePluginData: (newData: PluginData, messageForLog?: string) => void,
}

// Default context value with initial reactSettings and functions.
const defaultContextValue: AppContextType = {
  sendActionToPlugin: () => {},
  sendToPlugin: () => {},
  dispatch: () => {},
  pluginData: {},
  reactSettings: {}, // Initial empty reactSettings local
  setReactSettings: () => {},
  updateReactSettings: () => {}, // Placeholder function, actual implementation below.
  updatePluginData: () => {}, // Placeholder function, actual implementation below.
}

/****************************************************************************************************************************
 *                             VARIABLES
 ****************************************************************************************************************************/

const AppContext = createContext<AppContextType | null>(defaultContextValue)

/****************************************************************************************************************************
 *                             CONTEXT PROVIDER FUNCTIONS
 ****************************************************************************************************************************/

export const AppProvider = ({ children, sendActionToPlugin, sendToPlugin, dispatch, pluginData, reactSettings, setReactSettings, updatePluginData }: Props): Node => {
  logDebug(`AppProvider`, `inside component code`)

  const contextValue: AppContextType = {
    sendActionToPlugin,
    sendToPlugin,
    dispatch,
    pluginData,
    reactSettings,
    setReactSettings,
    updatePluginData,
  }

  useEffect(() => {
    logDebug('AppContext', `Just FYI, React settings updated somewhere: ${JSON.stringify(reactSettings)}`)
  }, [reactSettings])

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
}

export const useAppContext = (): AppContextType | null => useContext(AppContext)
