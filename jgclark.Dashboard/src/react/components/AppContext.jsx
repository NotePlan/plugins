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
import { PERSPECTIVE_ACTIONS } from '../reducers/actionTypes'
import type { TDashboardSettings, TReactSettings, TPluginData, TPerspectiveSettings } from '../../types'
import { dashboardSettingsReducer } from '../reducers/dashboardSettingsReducer'
import { cleanDashboardSettings } from '../../perspectiveHelpers'
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
 *                             FUNCTIONS
 ****************************************************************************************************************************/

  /**
   * If a perspective is not set, then save current settings to the default "-" perspective because we always
   * want to have the last settings a user chose to be saved in the default perspective (unless they are in a perspective)
   * @param {any} perspectiveSettings 
   * @param {any} newDashboardSettings 
   * @param {Function} dispatchPerspectiveSettings 
   */
  function saveDefaultPerspectiveData(perspectiveSettings: any, dashboardSettings: TDashboardSettings, newDashboardSettings: Partial<TDashboardSettings>, dispatchPerspectiveSettings: Function) {
    const dashPerspectiveIndex = perspectiveSettings.findIndex(s => s.name === "-")
    if (dashPerspectiveIndex > -1) {
      perspectiveSettings[dashPerspectiveIndex] = { name: "-", isModified: false, dashboardSettings: cleanDashboardSettings(newDashboardSettings) }
    } else {
      logDebug('Dashboard/saveDefaultPerspectiveData', `- Shared settings updated: "${newDashboardSettings.lastChange}" but could not find dashPerspectiveIndex; adding it to the end`, dashboardSettings)
      perspectiveSettings.push({ name: "-", isModified: false, dashboardSettings: cleanDashboardSettings(newDashboardSettings) })
    }
    dispatchPerspectiveSettings({ type: PERSPECTIVE_ACTIONS.SET_PERSPECTIVE_SETTINGS, payload: perspectiveSettings, reason: `No perspective was set; saving default perspective info.` })
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

  // Use useReducer for dashboardSettings
  const [dashboardSettings, dispatchDashboardSettings] = useReducer(dashboardSettingsReducer, initialDashboardSettings)

  const [perspectiveSettings, dispatchPerspectiveSettings] = useReducer(perspectiveSettingsReducer, initialPerspectiveSettings)

  useEffect(() => {
    logDebug('AppContext', `Just FYI, perspectiveSettings updated somewhere.`, perspectiveSettings)
    const diff = compareObjects(perspectiveSettings, pluginData.perspectiveSettings)
    if (diff) {
      logDebug('AppContext', `perspectiveSettings changed: ${JSON.stringify(diff)}`)
      dispatchPerspectiveSettings({ type: PERSPECTIVE_ACTIONS.SET_PERSPECTIVE_SETTINGS, payload: pluginData.perspectiveSettings, reason: `Perspective settings changed: ${JSON.stringify(diff)}` })
    }
  }, [pluginData.perspectiveSettings])

  // Effect to call sendActionToPlugin when dashboardSettings change
  useEffect(() => {
    const shouldSendToPlugin =
      dashboardSettings.lastChange && dashboardSettings.lastChange[0] !== '_' && JSON.stringify(dashboardSettings) !== JSON.stringify(lastSentDashboardSettingsRef.current)
    const diff = compareObjects(dashboardSettings, lastSentDashboardSettingsRef.current)
    const changedProps = lastSentDashboardSettingsRef.current ? diff : dashboardSettings // first time thru .current is null so everything is changed
    // logDebug('AppContext/useEffect(dashboardSettings)', `Changed properties: ${JSON.stringify(changedProps)}`)
    // clo(dashboardSettings,'AppContext/useEffect(dashboardSettings) dashboardSettings')
    // clo(lastSentDashboardSettingsRef.current,'AppContext/useEffect(dashboardSettings) lastSentDashboardSettingsRef.current')
    if (dashboardSettings.activePerspectiveName === "-" || !(dashboardSettings.activePerspectiveName)) {
      // If the activePerspectiveName is "-" (meaning default is set) then we need to constantly update that perspectives when any settings are changed
      logDebug('AppContext/useEffect(dashboardSettings)',`No named perspective set, so saving this change into the "-" perspective.`)
      saveDefaultPerspectiveData(perspectiveSettings, dashboardSettings, cleanDashboardSettings(dashboardSettings), dispatchPerspectiveSettings)
    }

    if (shouldSendToPlugin && changedProps) {
      logDebug(`AppContext/useEffect(dashboardSettings)`,`dashboardSettings. SENDING changes to plugin ${diff ? JSON.stringify(diff): ''}`)
      sendActionToPlugin(
        'dashboardSettingsChanged',
        {
          actionType: 'dashboardSettingsChanged',
          settings: dashboardSettings,
          perspectiveSettings: perspectiveSettings,
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
