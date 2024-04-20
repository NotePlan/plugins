/****************************************************************************************************************************
 *                             WEBVIEW COMPONENT
 * This is your top-level React component. All other React components should be imported and included below
 ****************************************************************************************************************************/
// @flow

/**
 * IMPORTANT
 * YOU MUST ROLL UP THESE FILES INTO A SINGLE FILE IN ORDER TO USE IT IN THE PLUGIN
 * RUN FROM THE SHELL: node 'jgclark.DashboardReact/src/react/support/performRollup.node.js' --watch
 */

type Props = {
  data: any /* passed in from the plugin as globalSharedData */,
  dispatch: Function,
}
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

import React, { useEffect, type Node } from 'react'
import { type PassedData } from '../../reactMain.js'
import Dashboard from './Dashboard.jsx'
import { AppProvider } from './AppContext.jsx'

/****************************************************************************************************************************
 *                             CONSOLE LOGGING
 ****************************************************************************************************************************/
// color this component's output differently in the console
const consoleStyle = 'background: #222; color: #bada55' //lime green
const logDebug = (msg: string, ...args: any) => console.log(`${window.webkit ? '' : '%c'}${msg}`, consoleStyle, ...args)
const logSubtle = (msg: string, ...args: any) => console.log(`${window.webkit ? '' : '%c'}${msg}`, 'color: #6D6962', ...args)
const logTemp = (msg: string, ...args: any) => console.log(`${window.webkit ? '' : '%c'}${msg}`, 'background: #fff; color: #000', ...args)

/**
 * Root element for the Plugin's React Tree
 * @param {any} data
 * @param {Function} dispatch - function to send data back to the Root Component and plugin
 */
export function WebView({ data, dispatch }: Props): Node {
  /****************************************************************************************************************************
   *                             HOOKS
   ****************************************************************************************************************************/

  // GENERALLY SPEAKING YOU DO NOT WANT TO USE STATE HOOKS IN THE WEBVIEW COMPONENT
  // because the plugin may need to know what changes were made so when it updates data, it will be consistent
  // otherwise when the plugin updates data, it will overwrite any changes made locally in the Webview
  // instead of using hooks here, save updates to data using:
  // dispatch('UPDATE_DATA', {...data,changesToData})
  // this will save the data at the Root React Component level, which will give the plugin access to this data also
  // sending this dispatch will re-render the Webview component with the new data

  /****************************************************************************************************************************
   *                             VARIABLES
   ****************************************************************************************************************************/

  // destructure all the startup data we expect from the plugin
  const { pluginData, debug } = data
  if (!pluginData) throw new Error('WebView: pluginData must be called with an object')
  // logDebug(`Webview received pluginData:\n${JSON.stringify(pluginData, null, 2)}`)

  /****************************************************************************************************************************
   *                             HANDLERS
   ****************************************************************************************************************************/

  /****************************************************************************************************************************
   *                             EFFECTS
   ****************************************************************************************************************************/

  /**
   * When the data changes, console.log it so we know and scroll the window
   * Fires after components draw
   */
  useEffect(() => {
    // logDebug(`Webview: useEffect: data changed. data: ${JSON.stringify(data)}`)
    logDebug(`Webview: useEffect: data changed.`)
    if (data?.passThroughVars?.lastWindowScrollTop !== undefined && data.passThroughVars.lastWindowScrollTop !== window.scrollY) {
      debug && logDebug(`Webview: useEffect: data changed. Scrolling to ${String(data.lastWindowScrollTop)}`)
      window.scrollTo(0, data.passThroughVars.lastWindowScrollTop)
    }
  }, [data])

  /****************************************************************************************************************************
   *                        HELPER FUNCTIONS
   ****************************************************************************************************************************/
  /**
   * Remove HTML entities from a string. Useful if you want to allow people to enter text in an HTML field.
   * @param {string} text
   * @returns {string} cleaned text without HTML entities
   */
  // eslint-disable-next-line no-unused-vars
  function decodeHTMLEntities(text: string): string {
    const textArea = document.createElement('textarea')
    textArea.innerHTML = text
    const decoded = textArea.value
    return decoded
  }

  /**
   * Add the passthrough variables to the data object that will roundtrip to the plugin and come back in the data object
   * Because any data change coming from the plugin will force a React re-render, we can use this to store data that we want to persist
   * (e.g. lastWindowScrollTop)
   * @param {*} data
   * @returns
   */
  const addPassthroughVars = (data: PassedData): PassedData => {
    const newData = { ...data }
    if (!newData.passThroughVars) newData.passThroughVars = {}
    newData.passThroughVars.lastWindowScrollTop = window.scrollY
    return newData
  }

  /**
   * Convenience function to send an action to the plugin and saving any passthrough data first in the Root data store
   * This is useful if you want to save data that you want to persist when the plugin sends data back to the Webview
   * For instance, saving where the scroll position was so that when data changes and the Webview re-renders, it can scroll back to where it was
   * @param {string} command
   * @param {any} dataToSend
   */
  const sendActionToPlugin = (command: string, dataToSend: any) => {
    const newData = addPassthroughVars(data) // save scroll position and other data in data object at root level
    dispatch('UPDATE_DATA', newData) // save the data at the Root React Component level, which will give the plugin access to this data also
    sendToPlugin([command, dataToSend]) // send action to plugin
  }

  /**
   * Send data back to the plugin to update the data in the plugin
   * This could cause a refresh of the Webview if the plugin sends back new data, so we want to save any passthrough data first
   * In that case, don't call this directly, use sendActionToPlugin() instead
   * @param {[command:string,data:any,additionalDetails:string]} param0
   */
  const sendToPlugin = ([command, data, additionalDetails = '']) => {
    if (!command) throw new Error('sendToPlugin: command must be called with a string')
    logDebug(`Webview: sendToPlugin: ${JSON.stringify(command)} ${additionalDetails}`, command, data, additionalDetails)
    if (!data) throw new Error('sendToPlugin: data must be called with an object')
    dispatch('SEND_TO_PLUGIN', [command, data], `WebView: sendToPlugin: ${String(command)} ${additionalDetails}`)
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
  if (!pluginData.reactSettings) pluginData.reactSettings = {}

  /****************************************************************************************************************************
   *                             RENDER
   ****************************************************************************************************************************/

  return (
    <AppProvider sendActionToPlugin={sendActionToPlugin} sendToPlugin={sendToPlugin} dispatch={dispatch} pluginData={pluginData} updatePluginData={updatePluginData}>
      <Dashboard pluginData={pluginData} />
    </AppProvider>
  )
}
