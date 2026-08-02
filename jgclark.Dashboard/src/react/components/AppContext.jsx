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

import React, { createContext, useContext, useEffect, useReducer, useRef, useMemo, type Node } from 'react'
// import { PERSPECTIVE_ACTIONS, DASHBOARD_ACTIONS } from '../reducers/actionTypes'
import type { TDashboardSettings, TReactSettings, TPluginData, TPerspectiveSettings } from '../../types'
import type { TDashboardSettingsAction } from '../reducers/dashboardSettingsReducer'
import type { TPerspectiveSettingsAction } from '../reducers/perspectiveSettingsReducer'
import { dashboardSettingsReducer } from '../reducers/dashboardSettingsReducer'
import { perspectiveSettingsReducer } from '../reducers/perspectiveSettingsReducer'
import { useSyncDashboardSettingsWithPlugin } from '../customHooks/useSyncDashboardSettingsWithPlugin'
import { useSyncPerspectivesWithPlugin } from '../customHooks/useSyncPerspectivesWithPlugin'
import { clo, logDebug, logError } from '@helpers/dev'
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
  // These are the raw useReducer() dispatchers, so they must be typed with the reducers' own action types:
  // an { type: string, payload?: any } shape is contravariantly incompatible (it would let a caller omit `payload`).
  dispatchDashboardSettings: (action: TDashboardSettingsAction) => void,
  perspectiveSettings: TPerspectiveSettings,
  dispatchPerspectiveSettings: (action: TPerspectiveSettingsAction) => void,
}

type Props = {
  children?: Node,
} & AppContextType

/****************************************************************************************************************************
 *                             DEFAULT CONTEXT VALUE
 ****************************************************************************************************************************/

// Default context value with initial reactSettings and functions.
// Note: `pluginData` and `dashboardSettings` are deliberately empty placeholders — React replaces
// this whole object with the provider's value on the first render. They are cast rather than
// filled in because a bare `{}` is checked against every required property of TPluginData /
// TDashboardSettings, one error each (136 from these two lines).
const defaultContextValue: AppContextType = {
  sendActionToPlugin: () => {},
  sendToPlugin: () => {},
  dispatch: () => {},
  pluginData: ({}: any), // TEST: removal of settings in here
  reactSettings: {}, // Initial empty reactSettings local
  setReactSettings: () => {},
  updatePluginData: () => {}, // Placeholder function, actual implementation below.
  dashboardSettings: ({}: any),
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

  const compareFn = (oldObj: any, newObj: any) => compareObjects(oldObj, newObj, ['lastChange', 'lastModified', 'activePerspectiveName' /* , new RegExp('FFlag.*', 'ig') */])

  // Syncing dashboardSettings with plugin
  useSyncDashboardSettingsWithPlugin(dashboardSettings, pluginData.dashboardSettings, dispatchDashboardSettings, sendActionToPlugin, pluginData, updatePluginData, compareFn)

  // Syncing perspectiveSettings with plugin
  useSyncPerspectivesWithPlugin(perspectiveSettings, pluginData.perspectiveSettings, dispatchPerspectiveSettings, compareFn)

  // Memoize the context value to prevent unnecessary re-renders of all consumers
  // This ensures that functions like sendActionToPlugin and dispatch maintain stable references
  // Only recreate the context value when the actual props change
  const contextValue: AppContextType = useMemo(
    () => ({
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
    }),
    [
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
    ],
  )

  useEffect(() => {
    logDebug('AppContext', `Just FYI, React settings updated somewhere.`, { reactSettings })
  }, [reactSettings])

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
}

export const useAppContext = (): AppContextType => useContext(AppContext)
