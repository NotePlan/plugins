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
import { useSyncWithPlugin } from '../customHooks/useSyncWithPlugin'
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

  // Syncing dashboardSettings with plugin when things change in front-end or the plugin sends a change in pluginData
  useSyncWithPlugin(dashboardSettings, pluginData.dashboardSettings, dispatchDashboardSettings, DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS, sendActionToPlugin, compareFn)

  // Syncing perspectiveSettings with plugin when things change in front-end or the plugin sends a change in pluginData
  useSyncWithPlugin(perspectiveSettings, pluginData.perspectiveSettings, dispatchPerspectiveSettings, PERSPECTIVE_ACTIONS.SET_PERSPECTIVE_SETTINGS, null, compareFn) // for now do not allow sending to plugin

  // // Effect to update the default perspective "-" when dashboardSettings change
  // // FIXME: the idea behind this was to pick up dropdown/dashboard settings dialog changes, but it's also picking up when a perspective is changed and settings change, and that's ok
  // // but we can't be setting isModified to true in that case
  // // should we maybe set this in the SettingsDialog and the Dropdown instead? we need to set isMofified somewhere
  // useEffect(() => {
  //   const diff = compareObjects(dashboardSettings, lastSeenDashboardSettingsRef.current || {}, ['lastChange', 'activePerspectiveName'])
  //   if (diff) {
  //     logDebug('AppContext/useEffect(dashboardSettings)', `local dashboardSettings changed.`, dashboardSettings)
  //     const apn = getActivePerspectiveName(perspectiveSettings)
  //     if (apn === '-' || !apn) {
  //       // If the apn is "-" (meaning default is set) then we need to constantly update that perspectives when any settings are changed
  //       logDebug('AppContext/useEffect(dashboardSettings)', `No named perspective set, so saving this change into the "-" perspective.`)
  //       if (dashboardSettings) {
  //         saveDefaultPerspectiveData(perspectiveSettings, dashboardSettings, dispatchPerspectiveSettings)
  //       }
  //     } else {
  //       logDebug('AppContext/useEffect(dashboardSettings)', `Named perspective is set but not saved. Change persp to .isModified=true`)
  //       // const usingPerspectives = dashboardSettings.perspectivesEnabled
  //       // if (usingPerspectives) {
  //       //   dispatchPerspectiveSettings({
  //       //     type: PERSPECTIVE_ACTIONS.SET_PERSPECTIVE_SETTINGS,
  //       //     payload: perspectiveSettings.map((p) => (p.name === apn && p.name !== '-' ? { ...p, isModified: true } : { ...p, isModified: false })),
  //       //     reason: `AppContext useEffect picked it up`,
  //       //   })
  //       // } else {
  //       //   logDebug('AppContext/useEffect(dashboardSettings)', `Perspectives are not being used, this would be strange!`)
  //       // }
  //     }
  //   }
  //   lastSeenDashboardSettingsRef.current = dashboardSettings
  // }, [dashboardSettings, perspectiveSettings])

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
