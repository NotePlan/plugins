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

  /**
   * If a perspective is not set, then save current settings to the default "-" perspective because we always
   * want to have the last settings a user chose to be saved in the default perspective (unless they are in a perspective)
   * @param {any} perspectiveSettings 
   * @param {any} newDashboardSettings 
   * @param {Function} dispatchPerspectiveSettings 
   */
  function saveDefaultPerspectiveData(perspectiveSettings: any, newDashboardSettings: Partial<TDashboardSettings>, dispatchPerspectiveSettings: Function) {

    const newPerspectiveDefs = replacePerspectiveDef(perspectiveSettings, { name: "-", isModified: false, dashboardSettings: cleanDashboardSettings(newDashboardSettings), isActive: false })

    dispatchPerspectiveSettings({ type: PERSPECTIVE_ACTIONS.SET_PERSPECTIVE_SETTINGS, payload: newPerspectiveDefs, reason: `No perspective was set; saving default perspective info.` })
  }


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

/****************************************************************************************************************************
 *                             STATE VARIABLES
 ****************************************************************************************************************************/

  const [dashboardSettings, dispatchDashboardSettings] = useReducer(dashboardSettingsReducer, initialDashboardSettings)

  const [perspectiveSettings, dispatchPerspectiveSettings] = useReducer(perspectiveSettingsReducer, initialPerspectiveSettings)

  /****************************************************************************************************************************
 *                             HOOKS
 ****************************************************************************************************************************/

  // Syncing dashboardSettings with plugin when things change in front-end or the plugin sends a change in pluginData
  useSyncWithPlugin(
    dashboardSettings,
    pluginData.dashboardSettings,
    dispatchDashboardSettings,
    DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS,
    sendActionToPlugin
  )

  // Syncing perspectiveSettings with plugin when things change in front-end or the plugin sends a change in pluginData
  useSyncWithPlugin(
    perspectiveSettings,
    pluginData.perspectiveSettings,
    dispatchPerspectiveSettings,
    PERSPECTIVE_ACTIONS.SET_PERSPECTIVE_SETTINGS,
    sendActionToPlugin
  )

  //FIXME:  (dbw) finish cutting things that don't need to be here

  useEffect(() => {
    const diff = compareObjects(perspectiveSettings, pluginData.perspectiveSettings)
    if (diff) {
      logDebug('AppContext', `perspectiveSettings changed: ${JSON.stringify(diff)} NOT DOING ANYTHING`)
      return
      //TODO: delete this effect
      dispatchPerspectiveSettings({ type: PERSPECTIVE_ACTIONS.SET_PERSPECTIVE_SETTINGS, payload: pluginData.perspectiveSettings, reason: `Perspective settings changed: ${JSON.stringify(diff)}` })
    }
  }, [pluginData.perspectiveSettings])

  // Effect to call sendActionToPlugin when dashboardSettings change
  useEffect(() => {
    const shouldSendToPlugin = lastSentDashboardSettingsRef.current && dashboardSettings.lastChange && dashboardSettings.lastChange[0] !== '_' && JSON.stringify(dashboardSettings) !== JSON.stringify(lastSentDashboardSettingsRef.current)
      dashboardSettings.lastChange && dashboardSettings.lastChange[0] !== '_' && JSON.stringify(dashboardSettings) !== JSON.stringify(lastSentDashboardSettingsRef.current)
    const diff = compareObjects(dashboardSettings, lastSentDashboardSettingsRef.current)
    const changedProps = lastSentDashboardSettingsRef.current ? diff : dashboardSettings // first time thru .current is null so everything is changed
    shouldSendToPlugin && logDebug('AppContext/useEffect(dashboardSettings)', `Changed properties: ${JSON.stringify(changedProps)}`)
    // clo(dashboardSettings,'AppContext/useEffect(dashboardSettings) dashboardSettings')
    // clo(lastSentDashboardSettingsRef.current,'AppContext/useEffect(dashboardSettings) lastSentDashboardSettingsRef.current')
    const apn = getActivePerspectiveName(perspectiveSettings)
    if (diff && apn === "-" || !apn) {
      // If the apn is "-" (meaning default is set) then we need to constantly update that perspectives when any settings are changed
      logDebug('AppContext/useEffect(dashboardSettings)',`No named perspective set, so saving this change into the "-" perspective.`)
      if (dashboardSettings) {
        saveDefaultPerspectiveData(perspectiveSettings, dashboardSettings, dispatchPerspectiveSettings)
      }
    }

    if (shouldSendToPlugin && changedProps) {
      logDebug(`AppContext/useEffect(dashboardSettings)`,`dashboardSettings. SENDING changes to plugin`)
      clo(perspectiveSettings,`AppContext/useEffect(dashboardSettings) perspectiveSettings NOT but would be sending:`)
      return
      //TODO: delete this effect
      sendActionToPlugin(
        'dashboardSettingsChanged',
        {
          actionType: 'dashboardSettingsChanged',
          settings: dashboardSettings,
          perspectiveSettings: perspectiveSettings, // Because when settings change we need to set isModified also in the perspectiveSettings
          logMessage: dashboardSettings.lastChange || '',
        },
        'Dashboard dashboardSettings updated',
        true,
      )
      lastSentDashboardSettingsRef.current = dashboardSettings
    } 
  }, [dashboardSettings, sendActionToPlugin, perspectiveSettings])

  useEffect(() => {
    // dbw note: this code is new after removing .activePerspectiveName from dashboardSettings
    const diff = compareObjects(perspectiveSettings, pluginData.perspectiveSettings)
    if (diff && perspectiveSettings.length > 0) {
      logDebug('AppContext/useEffect(perspectiveSettings) watcher',`perspectiveSettings changed: ${JSON.stringify(diff)} NOT DOING ANYTTHING `)
      return
      //TODO: delete this effect
      sendActionToPlugin(
        'perspectiveSettingsChanged',
        {
          actionType: 'perspectiveSettingsChanged',
          settings: perspectiveSettings, // Because when settings change we need to set isModified also in the perspectiveSettings
          logMessage: 'perspectiveSettings changed',
        },
        'Dashboard dashboardSettings updated',
        true,
      )
    }
  }, [perspectiveSettings])

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
