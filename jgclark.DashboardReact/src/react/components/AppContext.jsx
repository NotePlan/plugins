// @flow
import React, { createContext, useContext, useCallback, type Node } from 'react'

/**
 * Type definition for dialog data stored in the React context.
 */
export type DialogData = {
  isOpen: boolean,
  [key: string]: any,
}

/**
 * Type definition for settings stored in the React context.
 */
export type ReactSettings = {
  dialogData?: DialogData,
  [key: string]: any,
}

/**
 * Type definition for data coming from and managed by the plugin, including React settings.
 */
export type PluginData = {
  [key: string]: any,
  reactSettings: ReactSettings,
}

/**
 * Type definitions for the application context.
 */
export type AppContextType = {
  sendActionToPlugin: (command: string, dataToSend: any) => void,
  sendToPlugin: (command: string, dataToSend: any) => void,
  dispatch: (command: string, dataToSend: any, message?: string) => void,
  pluginData: PluginData,
  reactSettings: ReactSettings,
  updateReactSettings: (newSettings: Object, msgForLog?: string) => void,
  updatePluginData: (newData: Object, messageForLog?: string) => void,
}

const defaultReactSettings: ReactSettings = {
  dialogData: { isOpen: false },
}

const defaultContextValue: AppContextType = {
  sendActionToPlugin: () => {},
  sendToPlugin: () => {},
  dispatch: () => {},
  pluginData: { reactSettings: defaultReactSettings },
  reactSettings: defaultReactSettings,
  updateReactSettings: () => {},
  updatePluginData: () => {},
}

type Props = {
  children?: Node,
  sendActionToPlugin: (command: string, dataToSend: any, additionalDetails?: string) => void,
  sendToPlugin: (command: string, dataToSend: any) => void,
  dispatch: (command: string, dataToSend: any, messageForLog?: string) => void,
  pluginData: PluginData,
  updatePluginData: (newData: Object, messageForLog?: string) => void,
}

const AppContext = createContext<AppContextType>(defaultContextValue)

/**
 * Provides the application-wide context.
 * @param {Props} props - Properties passed to the AppProvider.
 * @returns {Node} The Provider component wrapping children.
 */
export const AppProvider = ({ children, sendActionToPlugin, sendToPlugin, dispatch, pluginData, updatePluginData }: Props): Node => {
  /**
   * Updates the reactSettings stored within pluginData.
   * @param {Object} newSettings - The new reactSettings object.
   * @param {string} [messageForLog] - Optional message for logging.
   */
  const updateReactSettings = useCallback<(newSettings: Object, messageForLog?: string) => void>(
    (newSettings, messageForLog) => {
      pluginData.reactSettings = newSettings
      updatePluginData(pluginData, messageForLog)
    },
    [pluginData, updatePluginData],
  )

  const contextValue: AppContextType = {
    sendActionToPlugin,
    sendToPlugin,
    dispatch,
    pluginData,
    reactSettings: pluginData.reactSettings,
    updateReactSettings,
    updatePluginData,
  }

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
}

/**
 * Custom hook to use the AppContext.
 * @returns {AppContextType} The context value.
 */
export const useAppContext = (): AppContextType => useContext(AppContext)
