// @flow

const DEBUG = false // change to quickly turn debugging code on/off

import pluginJson from '../plugin.json'
import { getGlobalSharedData, sendToHTMLWindow, sendBannerMessage } from '../../helpers/HTMLView'
import { getFilteredPluginData } from './commandListGenerator'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'

/**
 * Gather data you want passed to the React Window (e.g. what you want to display)
 */
export async function getData(): any {
  // we will just fake some data for now, you would want to gather some data from your plugin
  const data = Array.from(Array(10).keys()).map((i) => ({ textValue: `Item ${i}`, id: i, buttonText: `Submit ${i}` }))
  const pluginList = await getFilteredPluginData(false)
  return { tableRows: data, pluginList }
}

export type PassedData = {
  startTime?: Date /* used for timing/debugging */,
  title?: string /* React Window Title */,
  pluginData: any /* Your plugin's data to pass on first launch */,
  ENV_MODE?: 'development' | 'production',
  debug: boolean /* set based on ENV_MODE above */,
  returnPluginCommand: { id: string, command: string } /* plugin jsFunction that will receive comms back from the React window */,
  componentPath: string /* the path to the rolled up webview bundle. should be ../pluginID/react.c.WebView.bundle.* */,
  passThroughVars?: any /* any data you want to pass through to the React Window */,
}

/**
 * Gathers key data for the React Window, including the callback function that is used for comms back to the plugin
 * @returns {PassedData} the React Data Window object
 */
export async function getDataObjectForReactView(): Promise<PassedData> {
  const startTime = new Date()
  // get whatever pluginData you want the React window to start with and include it in the object below. This all gets passed to the React window
  const pluginData = await getData()
  // make sure to change np.plugin-test to your plugin name below
  const ENV_MODE = DEBUG
    ? 'development'
    : 'production' /* helps during development. ouputs passed variables on the page and attaches react-devtools. set to 'production' when ready to release */
  const dataToPass: PassedData = {
    pluginData,
    title: `Plugin Command List`,
    debug: ENV_MODE === 'development' ? true : false,
    ENV_MODE,
    returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onMessageFromHTMLView' },
    /* change the ID below to your plugin ID */
    componentPath: `../np.plugin-test/react.c.WebView.bundle.${ENV_MODE === 'development' ? 'dev' : 'min'}.js`,
    startTime,
  }
  return dataToPass
}

/**
 * An example handler function for the React Window's "Submit" button
 * @param {any} data - the data sent from the React Window for the action 'onSubmitClick'
 * @param {any} reactWindowData - the current data in the React Window
 * @returns {any} - the updated data to send back to the React Window
 */
async function handleSubmitButtonClick(data, reactWindowData) {
  const { index: clickedIndex } = data
  await sendBannerMessage(
    pluginJson['plugin.id'],
    `Plugin received an actionType: "onSubmitClick" command with data:\n${JSON.stringify(data)}.\nPlugin then fired this message over the bridge to the React window.`,
  )
  // change the data in the React window for the row that was clicked (just an example)
  clo(reactWindowData, `handleSubmitButtonClick: reactWindowData BEFORE update`)
  reactWindowData.pluginData.tableRows[clickedIndex].textValue = `Item ${clickedIndex} was updated by the plugin`
  return reactWindowData //updated data to send back to React Window
}

/**
 * onMessageFromHTMLView
 * Here's where you will process the commands+data that comes back from the React Window
 * Plugin entrypoint for "/onMessageFromHTMLView"
 * @author @dwertheimer
 */
export async function onMessageFromHTMLView(actionType: string, data: any): Promise<any> {
  try {
    logDebug(pluginJson, `NP Plugin return path (onMessageFromHTMLView) received actionType="${actionType}" (typeof=${typeof actionType})  (typeof data=${typeof data})`)
    clo(data, `Plugin onMessageFromHTMLView data=`)
    let reactWindowData = await getGlobalSharedData(pluginJson['plugin.id']) // get the current data from the React Window
    if (data.passThroughVars) reactWindowData.passThroughVars = { ...reactWindowData.passThroughVars, ...data.passThroughVars }
    switch (actionType) {
      /* best practice here is not to actually do the processing but to call a function based on what the actionType was sent by React */
      /* you would probably call a different function for each actionType */
      case 'onSubmitClick':
        reactWindowData = await handleSubmitButtonClick(data, reactWindowData) //update the data to send it back to the React Window
        break
      default:
        await sendBannerMessage(pluginJson['plugin.id'], `Plugin received an unknown actionType: "${actionType}" command with data:\n${JSON.stringify(data)}`)
        break
    }
    if (reactWindowData) {
      const updateText = `After ${actionType}: data was updated` /* this is just a string for debugging so you know what changed in the React Window */
      sendToHTMLWindow('SET_DATA', reactWindowData, updateText) // note this will cause the React Window to re-render with the currentJSData
    }
    return {} // this return value is ignored but needs to exist or we get an error
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * @author @dwertheimer
 */
export async function openReactPluginCommandsWindow() {
  try {
    logDebug(pluginJson, `testReactWindow starting up`)
    await DataStore.installOrUpdatePluginsByID(['np.Shared'], false, false, true) // you must have np.Shared code in order to open up a React Window
    // logDebug(pluginJson, `testReactWindow: installOrUpdatePluginsByID ['np.Shared'] completed`)
    const data = await getDataObjectForReactView()
    // Note the first tag below uses the w3.css scaffolding for basic UI elements. You can delete that line if you don't want to use it
    // w3.css reference: https://www.w3schools.com/w3css/defaulT.asp
    // The second line needs to be updated to your pluginID in order to load any specific CSS you want to include for the React Window (in requiredFiles)
    const cssTagsString = `
      <link rel="stylesheet" href="../np.Shared/css.w3.css">
		  <link rel="stylesheet" href="../np.plugin-test/css.plugin.css">`
    const windowOptions = {
      savedFilename: `../../${pluginJson['plugin.id']}/savedOutput.html` /* for saving a debug version of the html file */,
      headerTags: cssTagsString,
      windowTitle: `Plugin Commands`,
      includeCSSAsJS: false /* don't want CSS because we are doing this page non-themed */,
      generalCSSIn: ' ' /* don't want CSS because we are doing this page non-themed, needs to be non '' */,
    }
    logDebug(`===== testReactWindow Calling React after ${timer(data.startTime || new Date())} =====`)
    logDebug(pluginJson, `testReactWindow invoking window. testReactWindow stopping here. It's all React from this point forward`)
    // clo(data, `testReactWindow data object passed`)
    await DataStore.invokePluginCommandByName('openReactWindow', 'np.Shared', [data, windowOptions])
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * generatePluginCommandListHTML
 * Plugin entrypoint for "/Show Plugin Commands in Popup Window"
 * @author @dwertheimer
 */
export async function generatePluginCommandListHTML() {
  try {
    await openReactPluginCommandsWindow()
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
