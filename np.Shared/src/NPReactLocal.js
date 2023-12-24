// @flow

import pluginJson from '../plugin.json'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { showHTMLWindow, getCallbackCodeString, getThemeJS, type HtmlWindowOptions, sendBannerMessage } from '@helpers/HTMLView'

const startTime = new Date()

let ENV_MODE = 'production' // whether to use minified react or not

const ReactDevToolsImport = `<script src="http://localhost:8097"></script>`

function setEnv(globalData: any) {
  if (globalData.hasOwnProperty('ENV_MODE')) {
    ENV_MODE = globalData.ENV_MODE
  } else {
    if (globalData.debug) {
      ENV_MODE = 'development'
      globalData.ENV_MODE = 'development'
    }
  }
  // const LOAD_REACT_DEVTOOLS = ENV_MODE === 'development' // for debugging in local browser using react devtools & React Profiler
  return globalData
}

const mountAppString = `
    <script type="text/javascript" >
      ${`
          // createRoot should be exported in the rollup file (not exporting all of ReactDOM for tree-shaking reasons)
          const root = createRoot(document.getElementById('root'));
          root.render(
            React.createElement(Root, {}, null)
          );
        `}
    </script>
`

/**
 * onMessageFromHTMLView
 * Plugin entrypoint for "/onMessageFromHTMLView"
 * @author @dwertheimer
 */
export async function onMessageFromHTMLView(incoming: string): Promise<any> {
  try {
    logDebug(
      pluginJson,
      `onMessageFromHTMLView: incoming: ${incoming}. This is just a comms bridge test. Does not do anything. But at least you know the React window can talk to NotePlan. Use the function 'onMessageFromHTMLView' in the plugin you are building to do something useful.`,
    )
    await sendBannerMessage(
      pluginJson['plugin.id'],
      `np.Shared successfully received and executed command onMessageFromHTMLView(). This message is coming from NotePlan and confirms bilateral communications are functional. Use the function 'onMessageFromHTMLView' in the plugin you are building to do something useful.`,
    )
    return {} // return blank to keep NotePlan from throwing an error
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Open a React Window with data and windo options provided by another plugin (e.v. via invokeCommandByName)
 * Plugin entrypoint for "/React openReactWindow"
 * Note: Paragraph data should be sent in after making static copies -- see dev.js : createStaticArray()
 * @param {Object} globalData - data to be sent to the HTML window
 *  - ENV_MODE - 'development' or 'production' - whether to use minified react or not
 *  - debug - boolean - outputs debugging variables at the bottom of the screen
 * @author @dwertheimer
 */
// $FlowFixMe - inexact object literal
export function openReactWindow(globalData: any = null, windowOptions?: HtmlWindowOptions = {}): boolean {
  try {
    logDebug(`NPReactLocal.openReactWindow`, `Starting ...`)
    // the first parameter sent is globalData -- some initial data we will add as a global 'globalSharedData' in the HTML window
    // react will use this to populate the page
    // that the plugin can write to and the HTML App can access
    // we will try not to update this object directly, but instead
    // use message passing
    // should always have a lastUpdated field so we can see when the data was last updated on the HTML side
    if (!globalData) throw `NPReactLocal.openReactWindow() globalData was null. This is required. See the README`
    let globalSharedData = globalData

    globalSharedData = setEnv(globalSharedData) // set the build mode etc

    /*************************************************************************
     * YOU SHOULD NOT NEED TO EDIT ANYTHING BELOW THIS LINE
     *************************************************************************/

    globalSharedData.lastUpdated = { msg: 'Initial data load', date: new Date().toLocaleString() }

    // Load all components in the plugin.json file that end in '.jsx
    // const components = pluginJson['plugin.requiredFiles']?.filter((f) => f.endsWith('.jsx'))
    // Load all CSS files in the plugin.json file that end in '.css
    // const css = pluginJson['plugin.requiredFiles']?.filter((f) => f.endsWith('.css'))
    const css = []

    // put underscore in front of all requiredFiles filenames so they visually stay together in the plugin folder
    // the files live in the 'requiredFiles' folder in the plugin dev directory but are copied to the plugin root
    // because NotePlan does not allow for subfolders in the plugin root
    // used rollup to bundle react and react-dom into a single file
    const reactJSmin = `<script src="../np.Shared/react.core.min.js"></script>`
    const reactJSDev = `<script src="../np.Shared/react.core.dev.js"></script>`

    // was creating a separate bundle for each component but that was too slow with babel loading
    // so now we force there to be a rollup bundle of all components
    // const componentsStr =
    //   ENV_MODE === 'production'
    //     ? `\t\t<script type="text/javascript" src="${globalSharedData.componentPath}"></script>\n`
    //     : components.reduce((acc, cur) => {
    //         return `${acc}\t\t<script type="text/babel" src="./${cur}"></script>\n`
    //       }, '\n')
    if (!globalSharedData.componentPath?.length) logError("globalSharedData.componentPath is not set. cannot load your plugin's React components")
    const componentsStr = `\t\t<script type="text/javascript" src="${globalSharedData.componentPath}"></script>\n`

    //TODO: delete this after testing that we don't need it. Always use React.* (e.g. React.useState)
    const destructureReact = `
    <!-- Load React Functions Used by Components in case someone uses without the React. in front -->
      <script type="text/javascript"> const { useState, useEffect, useReducer, createContext, useContext, useRef, useMemo } = React; </script>
    <!-- Load React Components -->`

    const reactComponents = `     
          ${destructureReact}
          ${componentsStr}
        <script> console.log("HTML: Components loaded. REMEMBER there is no babel, so you cannot use JSX unless it's compiled by rollup. Alternatively, use React.createElement https://beta.reactjs.org/reference/react/createElement")</script>
        `

    const cssTags = css.reduce((acc, cur) => {
      return `${acc}\t\t<link rel="stylesheet" href="./${cur}">\n`
    }, '\n')

    const themeJS = getThemeJS()

    const bodyHTML = `
    <!-- Show loading spinner while React loads/renders -->
    <div id="root">
      <div id="spinner" class="container" style="background-color: ${themeJS?.values?.editor?.backgroundColor ?? '#ffffff'}">
        <div class="loading" style="background-color: ${themeJS?.values?.editor?.tintColor ?? '#000000'}"></div>
        <p class="loading-text">Searching & Preparing Your Data...</p>
      </div>
    </div>
  `

    // don't edit this next block, it's just a way to send the plugin data object to the HTML window
    // at the time of the HTML window creation
    // globalSharedData is a global variable in the HTML window
    const globalSharedDataScriptStr = `
      <script type="text/javascript" >
        console.log('HTML: Updating globalSharedData');
        globalSharedData = ${JSON.stringify(globalSharedData)};
      </script>
    `
    // set up bridge to NP
    const pluginToHTMLCommsBridge = `
    <script type="text/javascript" src="../np.Shared/pluginToHTMLErrorBridge.js"></script>
    <script>
      const receivingPluginID = "${pluginJson['plugin.id']}";
      const onMessageFromPlugin = ()=>{} // np.Shared/pluginToHTMLCommsBridge wants to see this function, but we don't use it in React because we will set up our own listener in Root
    </script>
    <script type="text/javascript" src="../np.Shared/pluginToHTMLCommsBridge.js"></script>
    `

    const runPluginCommandFunction = getCallbackCodeString('runPluginCommand') // generic function to run any plugin command
    const sendMessageToPluginFunction = `
      const sendMessageToPlugin = (args) => runPluginCommand('onMessageFromHTMLView', '${pluginJson['plugin.id']}', args);
    `

    const reactRootComponent = `<script type="text/javascript" src="../np.Shared/react.c.Root.min.js"></script>`
    const preBS = (windowOptions.preBodyScript = windowOptions.preBodyScript || '')
    const generatedOptions = {
      includeCSSAsJS: windowOptions.includeCSSAsJS === false ? false : true,
      headerTags: `${[cssTags].join('\n')}${windowOptions.headerTags || ''}` /* needs to be a string */,
      preBodyScript: addStringOrArrayItems(
        [pluginToHTMLCommsBridge, ENV_MODE === 'development' ? ReactDevToolsImport : '', ENV_MODE === 'production' ? reactJSmin : reactJSDev, globalSharedDataScriptStr],
        preBS,
      ),
      postBodyScript: addStringOrArrayItems([reactComponents, reactRootComponent, mountAppString], windowOptions.postBodyScript),
      customId: windowOptions.customId ?? pluginJson['plugin.id'],
    }
    // const title = windowOptions.title ?? windowOptions.windowTitle ?? 'React Window'
    showHTMLWindow(bodyHTML, { ...windowOptions, ...generatedOptions })
    // showHTMLV2(bodyHTML, { ...windowOptions, ...generatedOptions })
    logDebug(`np.Shared::openReactWindow: ---------------------------------------- HTML prep: ${timer(startTime)} | Total so far: ${timer(globalData.startTime)}`)
    return true
  } catch (error) {
    logError(pluginJson, `openReactWindow: Error ${JSP(error)}`)
    return false
  }
}

/**
 * Add a string or array of strings to the end of an array
 * Because we build JS from an array of strings, we need to make sure that if the user passes in a string or array of strings, we add them to the array
 * @param {Array<string>} arr
 * @param {string|Array<string>} items
 * @returns {Array<string>}
 */
const addStringOrArrayItems = (arr: Array<string>, items: string | Array<string>) => {
  if (!items) return arr
  if (typeof items === 'string') {
    arr.push(items)
  } else if (Array.isArray(items)) {
    arr.push(...items)
  }
  return arr
}
