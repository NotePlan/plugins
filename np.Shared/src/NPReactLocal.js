// @flow

import pluginJson from '../plugin.json'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { showHTMLV2, showHTMLWindow, getCallbackCodeString, getThemeJS, type HtmlWindowOptions, sendBannerMessage, generateScriptTags } from '@helpers/HTMLView'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'

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
      'INFO',
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
    logDebug(pluginJson, `NPReactLocal.openReactWindow Starting ...`)
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
    const css: Array<string> = []

    // put underscore in front of all requiredFiles filenames so they visually stay together in the plugin folder
    // the files live in the 'requiredFiles' folder in the plugin dev directory but are copied to the plugin root
    // React and ReactDOM are now bundled into Root, so we don't need a separate react.core bundle
    // Root will export React and ReactDOM as globals for other bundles to use
    // Empty strings so react.core.dev.js is not loaded
    const reactJSmin = ``
    const reactJSDev = ``

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

    // <script> logDebug("HTML JS","Root component loaded. There is no babel, so you cannot use JSX unless it's compiled by rollup."); </script>
    const reactComponents = `     
          ${componentsStr}
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
        console.log('JS baked into page HTML: Setting globalSharedData');
        globalSharedData = ${JSON.stringify(globalSharedData)};
        // This setting comes from ${pluginJson['plugin.id']}
        // if (typeof DataStore === 'undefined') {
        //   let DataStore = { settings: {_logLevel: "${DataStore.settings._logLevel}" } };
        // }
      </script>
    `
    // set up bridge to NP
    const pluginToHTMLCommsBridge = `
    <script type="text/javascript" src="../np.Shared/pluginToHTMLErrorBridge.js"></script>
    <script>
      const receivingPluginID = "${pluginJson['plugin.id']}";
      const onMessageFromPlugin = ()=>{}; // np.Shared/pluginToHTMLCommsBridge wants to see this function, but we don't use it in React because we will set up our own listener in Root
    </script>
    <script type="text/javascript" src="../np.Shared/pluginToHTMLCommsBridge.js"></script>
    `

    const runPluginCommandFunction = getCallbackCodeString('runPluginCommand') // generic function to run any plugin command
    const sendMessageToPluginFunction = `
      const sendMessageToPlugin = (args) => runPluginCommand('onMessageFromHTMLView', '${pluginJson['plugin.id']}', args);
    `

    const reactRootComponent = `<script type="text/javascript" src="../np.Shared/react.c.Root.dev.js"></script>\n`
    const preBS = (windowOptions.preBodyScript = windowOptions.preBodyScript || '')
    const generatedOptions = {
      includeCSSAsJS: windowOptions.includeCSSAsJS === false ? false : true,
      headerTags: `${[cssTags].join('\n')}${windowOptions.headerTags || ''}` /* needs to be a string */,
      preBodyScript: addStringOrArrayItems(
        [pluginToHTMLCommsBridge, ENV_MODE === 'development' ? ReactDevToolsImport : '', ENV_MODE === 'production' ? reactJSmin : reactJSDev, globalSharedDataScriptStr],
        preBS,
      ),
      // Load order is critical: Root must load first to set React/ReactDOM as globals,
      // then Forms bundle can use them as externals, then mountAppString can use createRoot
      postBodyScript: addStringOrArrayItems([reactRootComponent, reactComponents, mountAppString], windowOptions.postBodyScript),
      customId: windowOptions.customId ?? pluginJson['plugin.id'],
    }

    showHTMLV2(bodyHTML, { ...windowOptions, ...generatedOptions })

    logDebug(pluginJson, `openReactWindow: ---------------------------------------- HTML prep: ${timer(startTime)} | Total so far: ${timer(globalData.startTime)}`)
    return true
  } catch (error) {
    logError(pluginJson, `openReactWindow: Error ${JSP(error)}`)
    return false
  }
}

/**
 * Show a React Window in the main window (split view) with data and window options provided by another plugin (e.g. via invokeCommandByName)
 * Plugin entrypoint for "/React showInMainWindow"
 * Similar to openReactWindow but uses HTMLView.showInMainWindow instead of showHTMLV2
 * @param {Object} globalData - data to be sent to the HTML window
 *  - ENV_MODE - 'development' or 'production' - whether to use minified react or not
 *  - debug - boolean - outputs debugging variables at the bottom of the screen
 * @param {Object} windowOptions - window options including windowTitle, customId, etc.
 * @author @dwertheimer
 */
// $FlowFixMe - inexact object literal
export function showInMainWindow(globalData: any = null, windowOptions?: HtmlWindowOptions = {}): boolean {
  try {
    logDebug(pluginJson, `NPReactLocal.showInMainWindow Starting ...`)
    // the first parameter sent is globalData -- some initial data we will add as a global 'globalSharedData' in the HTML window
    // react will use this to populate the page
    // that the plugin can write to and the HTML App can access
    // we will try not to update this object directly, but instead
    // use message passing
    // should always have a lastUpdated field so we can see when the data was last updated on the HTML side
    if (!globalData) throw `NPReactLocal.showInMainWindow() globalData was null. This is required. See the README`
    let globalSharedData = globalData

    globalSharedData = setEnv(globalSharedData) // set the build mode etc

    /*************************************************************************
     * YOU SHOULD NOT NEED TO EDIT ANYTHING BELOW THIS LINE
     *************************************************************************/

    globalSharedData.lastUpdated = { msg: 'Initial data load', date: new Date().toLocaleString() }

    // Load all CSS files in the plugin.json file that end in '.css
    const css: Array<string> = []

    // Empty strings so react.core.dev.js is not loaded
    const reactJSmin = ``
    const reactJSDev = ``

    if (!globalSharedData.componentPath?.length) logError("globalSharedData.componentPath is not set. cannot load your plugin's React components")
    const componentsStr = `\t\t<script type="text/javascript" src="${globalSharedData.componentPath}"></script>\n`

    const reactComponents = `     
          ${componentsStr}
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
        console.log('JS baked into page HTML: Setting globalSharedData');
        globalSharedData = ${JSON.stringify(globalSharedData)};
        // This setting comes from ${pluginJson['plugin.id']}
      </script>
    `
    // set up bridge to NP
    const pluginToHTMLCommsBridge = `
    <script type="text/javascript" src="../np.Shared/pluginToHTMLErrorBridge.js"></script>
    <script>
      const receivingPluginID = "${pluginJson['plugin.id']}";
      const onMessageFromPlugin = ()=>{}; // np.Shared/pluginToHTMLCommsBridge wants to see this function, but we don't use it in React because we will set up our own listener in Root
    </script>
    <script type="text/javascript" src="../np.Shared/pluginToHTMLCommsBridge.js"></script>
    `

    const reactRootComponent = `<script type="text/javascript" src="../np.Shared/react.c.Root.dev.js"></script>\n`
    const preBS = (windowOptions.preBodyScript = windowOptions.preBodyScript || '')
    const generatedOptions = {
      includeCSSAsJS: windowOptions.includeCSSAsJS === false ? false : true,
      headerTags: `${[cssTags].join('\n')}${windowOptions.headerTags || ''}` /* needs to be a string */,
      preBodyScript: addStringOrArrayItems(
        [pluginToHTMLCommsBridge, ENV_MODE === 'development' ? ReactDevToolsImport : '', ENV_MODE === 'production' ? reactJSmin : reactJSDev, globalSharedDataScriptStr],
        preBS,
      ),
      // Load order is critical: Root must load first to set React/ReactDOM as globals,
      // then Forms bundle can use them as externals, then mountAppString can use createRoot
      postBodyScript: addStringOrArrayItems([reactRootComponent, reactComponents, mountAppString], windowOptions.postBodyScript),
      customId: windowOptions.customId ?? pluginJson['plugin.id'],
    }

    // Assemble the HTML parts into a full HTML string (similar to assembleHTMLParts but inline)
    const fullHTML: Array<string> = []
    fullHTML.push('<!DOCTYPE html>')
    fullHTML.push('<html>')
    fullHTML.push('<head>')
    fullHTML.push(`<title>${windowOptions.windowTitle || 'React Window'}</title>`)
    fullHTML.push('<meta charset="utf-8">')
    fullHTML.push('<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, maximum-scale=1, viewport-fit=cover">')

    // Add preBodyScript using generateScriptTags
    // $FlowFixMe - generatedOptions.preBodyScript can be array/string/ScriptObj
    const preScript = generateScriptTags((generatedOptions.preBodyScript: any) ?? '')
    if (preScript !== '') {
      fullHTML.push(preScript)
    }

    fullHTML.push(generatedOptions.headerTags || '')
    fullHTML.push('<style type="text/css" title="Original Theme Styles">')
    // If generalCSSIn is empty, generate it from the current theme
    const generalCSS = windowOptions.generalCSSIn && windowOptions.generalCSSIn !== '' ? windowOptions.generalCSSIn : generateCSSFromTheme('')
    fullHTML.push(generalCSS)
    fullHTML.push(windowOptions.specificCSS || '')
    fullHTML.push('</style>')
    fullHTML.push('</head>')
    fullHTML.push('<body>')
    fullHTML.push(bodyHTML)

    // Add postBodyScript using generateScriptTags
    // $FlowFixMe - generatedOptions.postBodyScript can be array/string/ScriptObj
    const postScript = generateScriptTags((generatedOptions.postBodyScript: any) ?? '')
    if (postScript !== '') {
      fullHTML.push(postScript)
    }

    fullHTML.push('</body>')
    fullHTML.push('</html>')
    const fullHTMLStr = fullHTML.join('\n')

    // Use HTMLView.showInMainWindow instead of showHTMLV2
    // $FlowFixMe[prop-missing] - showInMainWindow is available in NotePlan v3.20+
    const windowOptsAny = (windowOptions: any)
    const mainWindowOptions = {
      splitView: windowOptsAny.splitView ?? false,
      id: generatedOptions.customId || windowOptions.windowTitle || 'react-window',
      icon: windowOptsAny.icon || 'window-maximize',
      iconColor: windowOptsAny.iconColor || 'blue-500',
      autoTopPadding: windowOptsAny.autoTopPadding ?? true,
    }
    // $FlowFixMe[prop-missing] - showInMainWindow is available in NotePlan v3.20+
    HTMLView.showInMainWindow(fullHTMLStr, windowOptions.windowTitle || 'React Window', mainWindowOptions)

    logDebug(pluginJson, `showInMainWindow: ---------------------------------------- HTML prep: ${timer(startTime)} | Total so far: ${timer(globalData.startTime)}`)
    return true
  } catch (error) {
    logError(pluginJson, `showInMainWindow: Error ${JSP(error)}`)
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
