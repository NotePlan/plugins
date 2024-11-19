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
import { PERSPECTIVE_ACTIONS, DASHBOARD_ACTIONS } from '../reducers/actionTypes'
import type { TDashboardSettings, TReactSettings, TPluginData, TPerspectiveSettings } from '../../types'
import { dashboardSettingsReducer } from '../reducers/dashboardSettingsReducer'
import { cleanDashboardSettings, getActivePerspectiveName, replacePerspectiveDef } from '../../perspectiveHelpers'
import { perspectiveSettingsReducer } from '../reducers/perspectiveSettingsReducer'
import { useSyncDashboardSettingsWithPlugin } from '../customHooks/useSyncDashboardSettingsWithPlugin'
import { useSyncPerspectivesWithPlugin } from '../customHooks/useSyncPerspectivesWithPlugin'
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
 *                             FUNCTIONS
 ****************************************************************************************************************************/

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
  const lastSeenDashboardSettingsRef = useRef<?TDashboardSettings>(null)

  /****************************************************************************************************************************
   *                             STATE VARIABLES
   ****************************************************************************************************************************/

  const [dashboardSettings, dispatchDashboardSettings] = useReducer(dashboardSettingsReducer, initialDashboardSettings)

  const [perspectiveSettings, dispatchPerspectiveSettings] = useReducer(perspectiveSettingsReducer, initialPerspectiveSettings)

  /****************************************************************************************************************************
   *                             HOOKS
   ****************************************************************************************************************************/

  const compareFn = (oldObj: any, newObj: any) => compareObjects(oldObj, newObj, ['lastChange', 'activePerspectiveName', new RegExp('FFlag.*', 'ig')])

  // Syncing dashboardSettings with plugin
  useSyncDashboardSettingsWithPlugin(dashboardSettings, pluginData.dashboardSettings, dispatchDashboardSettings, sendActionToPlugin, pluginData, updatePluginData, compareFn)

  // Syncing perspectiveSettings with plugin
  useSyncPerspectivesWithPlugin(perspectiveSettings, pluginData.perspectiveSettings, dispatchPerspectiveSettings, compareFn)

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
