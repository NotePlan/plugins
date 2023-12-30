/****************************************************************************************************************************
 *                             WEBVIEW COMPONENT
 * This is your top-level React component. All other React components should be imported and included below
 ****************************************************************************************************************************/
// @flow

/**
 * IMPORTANT
 * YOU MUST ROLL UP THESE FILES INTO A SINGLE FILE IN ORDER TO USE IT IN THE PLUGIN
 * RUN FROM THE SHELL: node 'dwertheimer.ReactSkeleton/src/react/support/performRollup.node.js' --watch
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
import { type PassedData } from '../reactMain.js'
import CompositeLineExample from './CompositeLineExample.jsx'
import Button from './Button.jsx'

/****************************************************************************************************************************
 *                             CONSOLE LOGGING
 ****************************************************************************************************************************/
// color this component's output differently in the console
const consoleStyle = 'background: #222; color: #bada55' //lime green
const logDebug = (msg, ...args) => console.log(`${window.webkit ? '' : '%c'}${msg}`, consoleStyle, ...args)
const logSubtle = (msg, ...args) => console.log(`${window.webkit ? '' : '%c'}${msg}`, 'color: #6D6962', ...args)
const logTemp = (msg, ...args) => console.log(`${window.webkit ? '' : '%c'}${msg}`, 'background: #fff; color: #000', ...args)

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
  const { tableRows } = pluginData

  /****************************************************************************************************************************
   *                             HANDLERS
   ****************************************************************************************************************************/

  /**
   * Submit button on the page was clicked
   * (sample handler for a button in the react window)
   * @param {any} e - the event object
   * @param {number} index - the index of the button that was clicked
   */
  const onSubmitClick = (e, index) => {
    logDebug(`Webview: onSubmitClick: ${e.type || ''} click on index: ${index}`)
    sendActionToPlugin('onSubmitClick', { index: index })
  }

  // A sample function that does something interactive in the window using React
  // you will delete this
  const scrambleLines = () => {
    logDebug(`Webview: scrambleLines: click`)
    // in this example, we are not going to send any data back to the plugin, everything is local
    // we are just randomly reordering the lines just for demonstration purposes
    const newTableRows = [...tableRows]
    newTableRows.sort(() => Math.random() - 0.5)
    const newData = { ...data, pluginData: { ...data.pluginData, tableRows: newTableRows } }
    dispatch('UPDATE_DATA', newData) // save the data at the Root React Component level, which will give the plugin access to this data also
    // this will cause this component to re-render with the new data
    // will never reach anything below this line because the component will re-render
    dispatch('SHOW_BANNER', {
      msg: 'FYI: Page automatically re-rendered locally after pluginData was changed at Root component level. Did not call the plugin.',
      color: 'blue',
      border: 'blue',
    })
  }

  /****************************************************************************************************************************
   *                             EFFECTS
   ****************************************************************************************************************************/

  /**
   * When the data changes, console.log it so we know and scroll the window
   * Fires after components draw
   */
  useEffect(() => {
    logDebug(`Webview: useEffect: data changed. data: ${JSON.stringify(data)}`)
    if (data?.passThroughVars?.lastWindowScrollTop !== undefined && data.passThroughVars.lastWindowScrollTop !== window.scrollY) {
      debug && logDebug(`Webview: useEffect: data changed. Scrolling to ${String(data.lastWindowScrollTop)}`)
      window.scrollTo(0, data.passThroughVars.lastWindowScrollTop)
    }
  }, [data])

  /****************************************************************************************************************************
   *                             FUNCTIONS
   ****************************************************************************************************************************/
  /**
   * Helper function to remove HTML entities from a string. Not used in this example but leaving here because it's useful
   * if you want to allow people to enter text in an HTML field
   * @param {string} text
   * @returns {string} cleaned text without HTML entities
   */
  // eslint-disable-next-line no-unused-vars
  function decodeHTMLEntities(text) {
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

  /****************************************************************************************************************************
   *                             RENDER
   ****************************************************************************************************************************/

  return (
    <div style={{ maxWidth: '100vw', width: '100vw' }}>
      <Button onClick={scrambleLines} className="w3-light-blue">
        Randomize Lines Locally in React (without calling Plugin)
      </Button>
      <div className="w3-container w3-green w3-margin-top">
        <div className="w3-cell-row" style={{ fontWeight: 'bold' }}>
          <div className="w3-cell">Text</div>
          <div className="w3-cell">Submit Change to Plugin</div>
        </div>
      </div>
      {tableRows.map((row) => (
        <CompositeLineExample index={row.id} onSubmitClick={onSubmitClick} key={row.id} textValue={row.textValue} buttonText={row.buttonText} />
      ))}
    </div>
  )
}
