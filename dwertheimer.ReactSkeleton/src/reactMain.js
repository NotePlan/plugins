// @flow

import pluginJson from '../plugin.json'
import { logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { getWindowFromId } from '@helpers/NPWindows'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import { onMessageFromHTMLView } from './router'

const WEBVIEW_WINDOW_ID = `${pluginJson['plugin.id']} React Window` // will be used as the customId for your window
// you can leave it like this or if you plan to open multiple windows, make it more specific per window
const REACT_WINDOW_TITLE = 'React View Skeleton Test' // change this to what you want window title to display

export type PassedData = {
  startTime?: Date /* used for timing/debugging */,
  title?: string /* React Window Title */,
  pluginData: any /* Your plugin's data to pass on first launch (or edited later) */,
  ENV_MODE?: 'development' | 'production',
  debug: boolean /* set based on ENV_MODE above */,
  logProfilingMessage: boolean /* whether you want to see profiling messages on React redraws (not super interesting) */,
  returnPluginCommand: { id: string, command: string } /* plugin jsFunction that will receive comms back from the React window */,
  componentPath: string /* the path to the rolled up webview bundle. should be ../pluginID/react.c.WebView.bundle.* */,
  passThroughVars?: { lastWindowScrollTop: number } /* any data you want to pass through to the React Window */,
}

/**
 * Gathers key data for the React Window, including the callback function that is used for comms back to the plugin
 * @returns {PassedData} the React Data Window object
 */
export function getInitialDataForReactWindow(): PassedData {
  const startTime = new Date()
  // get whatever pluginData you want the React window to start with and include it in the object below. This all gets passed to the React window
  const pluginData = getPluginData()
  const ENV_MODE = 'development' /* helps during development. set to 'production' when ready to release */
  const dataToPass: PassedData = {
    pluginData,
    title: REACT_WINDOW_TITLE,
    logProfilingMessage: false,
    debug: ENV_MODE === 'development' ? true : false,
    ENV_MODE,
    returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onMessageFromHTMLView' },
    /* change the ID below to your plugin ID */
    componentPath: `../dwertheimer.ReactSkeleton/react.c.WebView.bundle.${ENV_MODE === 'development' ? 'dev' : 'min'}.js`,
    startTime,
  }
  return dataToPass
}

/**
 * Gather data you want passed to the React Window (e.g. what you you will use to display)
 * You will likely use this function to pull together your starting window data
 * Must return an object, with any number of properties, however you cannot use the following reserved
 * properties: pluginData, title, debug, ENV_MODE, returnPluginCommand, componentPath, passThroughVars, startTime
 * @returns {[string]: mixed} - the data that your React Window will start with
 */
export function getPluginData(): { [string]: mixed } {
  // for demonstration purposes will just fake some data for now,
  // you would want to gather some data from your plugin
  const data = Array.from(Array(10).keys()).map((i) => ({ textValue: `Item ${i}`, id: i, buttonText: `Submit ${i}` }))
  return {
    platform: NotePlan.environment.platform, // used in dialog positioning and CSS
    tableRows: data,
  } // this could be any object full of data you want to pass to the window
  // we return tableRows just as an example, but there's nothing magic about that property name
  // you could pass any object with any number of fields you want
}

/**
 * Update the data in the React Window (and cause it to re-draw as necessary with the new data)
 * This is likely most relevant when a trigger has been sent from a NotePlan window, but could be used anytime a plugin wants to update the data in the React Window
 * This calls the router function (onMessageFromHTMLView) which handles both REQUEST and non-REQUEST actions
 * @param {string} actionType - the reducer-type action to be dispatched
 * @param {any} data - any data that the router needs -- may be nothing
 * @returns {Promise<any>} - does not return anything important
 */
export async function updateReactWindowData(actionType: string, data: any = null): Promise<any> {
  if (!getWindowFromId(WEBVIEW_WINDOW_ID)) {
    logError(pluginJson, `updateReactWindowData('${actionType}'): Window with ID ${WEBVIEW_WINDOW_ID} not found. Could not update data.`)
    return
  }
  // Call the router function
  return await onMessageFromHTMLView(actionType, data)
}

/**
 * Plugin Entry Point for "Test React Window"
 * @author @dwertheimer
 */
export async function openReactWindow(): Promise<void> {
  try {
    logDebug(pluginJson, `openReactWindow starting up`)
    // make sure we have the np.Shared plugin which has the core react code and some basic CSS
    await DataStore.installOrUpdatePluginsByID(['np.Shared'], false, false, true) // you must have np.Shared code in order to open up a React Window
    logDebug(pluginJson, `openReactWindow: installOrUpdatePluginsByID ['np.Shared'] completed`)
    // get initial data to pass to the React Window
    const data = await getInitialDataForReactWindow()

    // Note the first tag below uses the w3.css scaffolding for basic UI elements. You can delete that line if you don't want to use it
    // w3.css reference: https://www.w3schools.com/w3css/defaulT.asp
    // The second line needs to be updated to your pluginID in order to load any specific CSS you want to include for the React Window (in requiredFiles)
    const cssTagsString = `
      <link rel="stylesheet" href="../np.Shared/css.w3.css">
		  <link rel="stylesheet" href="../dwertheimer.ReactSkeleton/css.plugin.css">\n`
    const windowOptions = {
      savedFilename: `../../${pluginJson['plugin.id']}/saved-output.html` /* for saving a debug version of the html file */,
      headerTags: cssTagsString,
      windowTitle: data.title,
      customId: WEBVIEW_WINDOW_ID,
      reuseUsersWindowRect: true,
      shouldFocus: true /* focus window every time (set to false if you want a bg refresh) */,
      generalCSSIn: generateCSSFromTheme(), // either use dashboard-specific theme name, or get general CSS set automatically from current theme
      postBodyScript: `
        <script type="text/javascript" >
        // Set DataStore.settings so default logDebug etc. logging works in React
        // This setting comes from ${pluginJson['plugin.id']}
        let DataStore = { settings: {_logLevel: "${DataStore.settings._logLevel}" } };
        </script>
      `,
    }
    logDebug(`===== openReactWindow Calling React after ${timer(data.startTime || new Date())} =====`)
    logDebug(pluginJson, `openReactWindow invoking window. openReactWindow stopping here. It's all React from this point forward`)
    clo(data, `openReactWindow data object passed`)
    // now ask np.Shared to open the React Window with the data we just gathered
    await DataStore.invokePluginCommandByName('openReactWindow', 'np.Shared', [data, windowOptions])
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
