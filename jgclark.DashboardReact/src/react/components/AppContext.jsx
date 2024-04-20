// This is a context provider for the app. You should generally not need to edit this file.
// It provides a way to pass functions and data to any component that needs it
// without having to pass from parent to child to grandchild etc.
// including reading and saving reactSettings local to the react window
//
// Any React component that needs access to the AppContext can use the useAppContext hook with these 2 lines
// import { useAppContext } from './AppContext.jsx'
// ...
// const {sendActionToPlugin, sendToPlugin, dispatch, pluginData, reactSettings, updateReactSettings}  = useAppContext() // MUST BE inside the React component/function code, cannot be at the top of a file

// @flow
import React, { createContext, useContext, useCallback, type Node } from 'react'

/**
 * Type definitions for the application context.
 */
export type AppContextType = {
  sendActionToPlugin: (command: string, dataToSend: any) => void, // The main one to use to send actions to the plugin, saves scroll position
  sendToPlugin: (command: string, dataToSend: any) => void, // Sends to plugin without saving scroll position
  dispatch: (command: string, dataToSend: any, message?: string) => void, // Used mainly for showing banner at top of page to user
  pluginData: Object, // The data that was sent from the plugin in the field "pluginData"
  reactSettings: Object, // Dynamic key-value pair for reactSettings local to the react window (e.g. filterPriorityItems)
  updateReactSettings: (newSettings: Object, msgForLog?: string) => void, // Update the reactSettings
  updatePluginData: (newData: Object, messageForLog?: string) => void, // Updates the global pluginData, generally not something you should need to do
}

// Default context value with initial reactSettings and functions.
const defaultContextValue: AppContextType = {
  sendActionToPlugin: () => {},
  sendToPlugin: () => {},
  dispatch: () => {},
  pluginData: {},
  reactSettings: {}, // Initial empty reactSettings local
  updateReactSettings: () => {}, // Placeholder function, actual implementation below.
  updatePluginData: () => {}, // Placeholder function, actual implementation below.
}

type Props = {
  sendActionToPlugin: (command: string, dataToSend: any, additionalDetails?: string) => void,
  sendToPlugin: (command: string, dataToSend: any) => void,
  dispatch: (command: string, dataToSend: any, messageForLog?: string) => void,
  pluginData: Object,
  children: Node, // React component children
  updatePluginData: (newData: Object, messageForLog?: string) => void,
}

/**
 * Create the context with the default value.
 */
const AppContext = createContext<AppContextType>(defaultContextValue)

// Explicitly annotate the return type of AppProvider as a React element
export const AppProvider = ({ children, sendActionToPlugin, sendToPlugin, dispatch, pluginData, updatePluginData }: Props): Node => {
  const reactSettings = pluginData.reactSettings

  /**
   * Update the reactSettings, must be sent the entire reactSettings object.
   * @param {Object} newSettings - The new reactSettings object to replace the current reactSettings (must be the full object)
   * @param {string} [messageForLog] - Optional message to log to the console.
   */
  const updateReactSettings = useCallback<(newSettings: Object, messageForLog?: string) => void>((newSettings, messageForLog) => {
    pluginData.reactSettings = newSettings
    updatePluginData(pluginData, messageForLog)
  }, [])

  // Provide the context value with all functions and state.
  const contextValue: AppContextType = {
    sendActionToPlugin,
    sendToPlugin,
    dispatch,
    pluginData,
    reactSettings,
    updateReactSettings,
    updatePluginData,
  }

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
}

/**
 * Custom hook to use the AppContext.
 * @returns {AppContextType} - The context value.
 */
export const useAppContext = (): AppContextType => useContext(AppContext)
