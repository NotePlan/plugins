/****************************************************************************************************************************
 *                             WEBVIEW COMPONENT
 * This is your top-level React component. All other React components should be imported and included below
 ****************************************************************************************************************************/
// @flow

/**
 * IMPORTANT
 * YOU MUST ROLL UP THESE FILES INTO A SINGLE FILE IN ORDER TO USE IT IN THE PLUGIN
 * RUN FROM THE SHELL: node 'jgclark.Dashboard/src/react/support/performRollup.node.js' --watch
 */

/****************************************************************************************************************************
 *                             NOTES
 * WebView should act as a "controlled component", as far as the data from the plugin is concerned.
 * Plugin-related data is always passed in via props, and never stored in state in this component
 *
 * FYI, if you do use state, it is highly recommended when setting state with hooks to use the functional form of setState
 * e.g. setTodos((prevTodos) => [...prevTodos, newTodo]) rather than setTodos([...todos, newTodo])
 * This has cost me a lot of time in debugging stale state issues
 */

/****************************************************************************************************************************
 *                             IMPORTS
 ****************************************************************************************************************************/

import React, { useEffect, useLayoutEffect, type Node } from 'react'
import { type PassedData } from '../../reactMain.js'
import { type TReactSettings, type TSettingItem } from '../../types'
import { createDashboardSettingsItems } from '../../dashboardSettings'
import { createFilterDropdownItems } from './Header/filterDropdownItems.js'
import Dashboard from './Dashboard.jsx'
import { AppProvider } from './AppContext.jsx'
import { clo, logDebug, logError, logInfo } from '@helpers/react/reactDev.js'

/**
 * Reduces an array of dashboard settings items into an object including default values.
 * FIXME(@dwertheimer): I don't see anything about defaults in the code: is this more like getSettingItemValues()?
 * @param {Array<DashboardSettingItem>} items - The array of dashboard settings items.
 * @returns {Object} - The resulting object with settings including defaults.
 */
function getSettingsDefaults(items: Array<TSettingItem>): { [key: string]: any } {
  return items.reduce((acc: { [key: string]: any }, item) => {
    if (item.key) {
      acc[item.key] = item.value || item.checked || ''
    }
    return acc
  }, {})
}

/**
 * Root element for the Plugin's React Tree
 * @param {any} data
 * @param {Function} dispatch - function to send data back to the Root Component and plugin
 */

type Props = {
  data: any /* passed in from the plugin as globalSharedData */,
  dispatch: Function,
  reactSettings: TReactSettings,
  setReactSettings: Function,
}

export function WebView({ data, dispatch, reactSettings, setReactSettings }: Props): Node {

  /****************************************************************************************************************************
   *                             HOOKS
   ****************************************************************************************************************************/

  // set up dashboardSettings state using defaults as the base and then overriding with any values from the plugin saved settings
  const dSettings = data.pluginData.dashboardSettings || {}
  const dSettingsItems = createDashboardSettingsItems(dSettings)
  const settingsDefaults = getSettingsDefaults(dSettingsItems)
  const [sectionToggles, _otherToggles] = createFilterDropdownItems(dSettings)
  const filterSettingsDefaults = getSettingsDefaults(sectionToggles)
  const otherSettingsDefaults = getSettingsDefaults(_otherToggles)
  const dashboardSettingsOrDefaults = { ...settingsDefaults, ...filterSettingsDefaults, ...otherSettingsDefaults, ...dSettings, lastChange: `_WebView_DefaultSettings` }
  const [dashboardSettings, setDashboardSettings] = React.useState(dashboardSettingsOrDefaults)

  /****************************************************************************************************************************
   *                             VARIABLES
   ****************************************************************************************************************************/

  // destructure all the startup data we expect from the plugin
  const { pluginData } = data

  if (!pluginData) throw new Error('WebView: pluginData must be called with an object')
  // logDebug(`Webview received pluginData:\n${JSON.stringify(pluginData, null, 2)}`)

  /**
   * Settings which are local to the React window
   */
  const defaultReactSettings = {
    dialogData: { isOpen: false, isTask: true, details: {} },
  }

  /****************************************************************************************************************************
   *                             HANDLERS
   ****************************************************************************************************************************/

  /****************************************************************************************************************************
   *                             EFFECTS
   ****************************************************************************************************************************/

  type Settings = {
    setter: (prev: any) => void,
    currentSettings: ?Object,
    settingsKey: string,
    defaultSettings: Object,
    effectName: string
  };

  /**
   * @typedef {Object} Settings
   * @property {Function} setter - Function to set settings state.
   * @property {Object|null} currentSettings - Current settings state.
   * @property {string} settingsKey - Key to access the right settings from plugin data.
   * @property {Object} defaultSettings - Default settings to apply.
   * @property {string} effectName - Name of the effect for debugging purposes.
   */
  /**
   * Helper function to initialize settings (used for reactSettings and dashboardSettings)
   * TODO: (@dwertheimer): This was general purpose but after dashboardSettings refactor I'm not sure it's needed anymore
   * @param {Settings} settings
   */
  // function initializeSettings({ setter, currentSettings, settingsKey, defaultSettings, effectName }: Settings) {
  //   if (!setter) return
  //   const pluginSettingsPassed = pluginData.dashboardSettings || {}

  //   let parsedSettings = currentSettings
  //   if (pluginSettingsPassed) {
  //     try {
  //       logDebug(`Webview`, `${effectName} effect: loading initial data from pluginData.dashboardSettings.${settingsKey}`)
  //       // parsedSettings = parseSettings(pluginData.dashboardSettings[settingsKey])
  //       parsedSettings = { ...defaultSettings, ...pluginSettingsPassed }
  //     } catch (error) {
  //       logDebug(`Webview`, `${effectName} effect: could not parse settings. ${error} pluginData.dashboardSettings.${settingsKey}: ${pluginData.dashboardSettings[settingsKey]}`)
  //     }
  //   }

  //   setter((prev) => ({ ...prev, ...parsedSettings, lastChange: `_Webview_firstLoad` }))
  // }

  /**
   * Set up the initial React Settings (runs only on load)
   */
  useEffect(() => {
    setReactSettings((prev) => ({ ...prev, ...defaultReactSettings, lastChange: `_Webview_firstLoad` }))
  }, [setReactSettings])


  /**
   * When the data changes, console.log it so we know and scroll the window
   * Fires after components draw
   */
  useLayoutEffect(() => {
    if (data?.passThroughVars?.lastWindowScrollTop !== undefined && data.passThroughVars.lastWindowScrollTop !== window.scrollY) {
      // debug && logDebug(`WebView`, `FYI data watch (for scroll): underlying data has changed, picked up by useEffect. Scrolling to ${String(data.lastWindowScrollTop)}`)
      window.scrollTo(0, data.passThroughVars.lastWindowScrollTop)
    } else {
      // logDebug(`WebView`, `FYI, data watch (for scroll): underlying data has changed, picked up by useEffect. No scroll info to restore, so doing nothing.`)
    }
    // dispatch('SHOW_BANNER', { msg: `Data was updated`, color: 'w3-pale-yellow', border: 'w3-border-yellow'  })
  }, [data])

  useEffect(() => {
    logInfo('WebView', `React Dashboard Initialized and rendered.`)
  }, [])

  /****************************************************************************************************************************
   *                        HELPER FUNCTIONS
   ****************************************************************************************************************************/

  /**
   * Add the passthrough variables to the data object that will roundtrip to the plugin and come back in the data object
   * Because any data change coming from the plugin will force a React re-render, we can use this to store data that we want to persist
   * (e.g. lastWindowScrollTop)
   * @param {*} data
   * @returns
   */
  const addPassthroughVars = (data: PassedData): PassedData => {
    const newData = { ...data }
    if (!newData?.passThroughVars) newData.passThroughVars = { lastWindowScrollTop: 0 }
    newData.passThroughVars.lastWindowScrollTop = window.scrollY
    return newData
  }

  /**
   * Convenience function to send an action to the plugin and saving any passthrough data first in the Root data store
   * This is useful if you want to save data that you want to persist when the plugin sends data back to the Webview
   * For instance, saving where the scroll position was so that when data changes and the Webview re-renders, it can scroll back to where it was
   * @param {string} command
   * @param {any} dataToSend
   * @oaram {any} additionalInfo
   * @param {boolean} updateGlobalData - if false, don't save any passthrough data (eg scroll position, to try to limit redraws)
   */
  const sendActionToPlugin = (command: string, dataToSend: any, additionalInfo: string = '', updateGlobalData: boolean = true) => {
    // logDebug(`Webview`, `sendActionToPlugin: command:${command} dataToSend:${JSON.stringify(dataToSend)}`)
    if (updateGlobalData) {
      const newData = addPassthroughVars(data) // save scroll position and other data in data object at root level
      dispatch('UPDATE_DATA', newData, additionalInfo) // save the data at the Root React Component level, which will give the plugin access to this data also
    }
    sendToPlugin([command, dataToSend, additionalInfo]) // send action to plugin
  }

  /**
   * Send data back to the plugin to update the data in the plugin
   * This could cause a refresh of the WebView if the plugin sends back new data, so we want to save any passthrough data first
   * In that case, don't call this directly, use sendActionToPlugin() instead
   * @param {[command:string,data:any,additionalDetails:string]} param0
   */
  const sendToPlugin = ([command, data, additionalDetails = '']: [string, any, string]) => {
    if (!command) throw new Error('sendToPlugin: command must be called with a string')
    // logDebug(`Webview`,`sendToPlugin: ${JSON.stringify(command)} ${additionalDetails}`, command, data, additionalDetails)
    if (!data) throw new Error('sendToPlugin: data must be called with an object')
    // logDebug(`WebView: sendToPlugin: command:"${command}" data=${JSON.stringify(data)} `)
    dispatch('SEND_TO_PLUGIN', [command, data], `WebView sending: sendToPlugin: ${String(command)} ${additionalDetails} ${JSON.stringify(data)}`)
  }

  /**
   * Updates the pluginData with the provided new data (must be the whole pluginData object)
   *
   * @param {Object} newData - The new data to update the plugin with,
   * @param {string} messageForLog - An optional message to log with the update
   * @throws {Error} Throws an error if newData is not provided or if it does not have more keys than the current pluginData.
   * @return {void}
   */
  const updatePluginData = (newData: any, messageForLog?: string) => {
    if (!newData) throw new Error('updatePluginData: newData must be called with an object')
    if (Object.keys(newData).length < Object.keys(pluginData).length) {
      throw new Error('updatePluginData: newData must be called with an object that has more keys than the current pluginData. You must send a full pluginData object')
    }
    const newFullData = { ...data, pluginData: newData }
    dispatch('UPDATE_DATA', newFullData, messageForLog) // save the data at the Root React Component level, which will give the plugin access to this data also
  }
  /****************************************************************************************************************************
   *                             RENDER
   ****************************************************************************************************************************/

  return (
    // $FlowIgnore
    <AppProvider
      sendActionToPlugin={sendActionToPlugin}
      sendToPlugin={sendToPlugin}
      dispatch={dispatch}
      pluginData={pluginData}
      updatePluginData={updatePluginData}
      reactSettings={reactSettings}
      setReactSettings={setReactSettings}
      dashboardSettings={dashboardSettings}
      setDashboardSettings={setDashboardSettings}
    >
      <Dashboard pluginData={pluginData} />
    </AppProvider>
  )
}
