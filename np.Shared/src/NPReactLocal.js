// @flow

import pluginJson from '../plugin.json'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { showHTMLV2, getThemeJS, type HtmlWindowOptions, sendBannerMessage, generateScriptTags } from '@helpers/HTMLView'
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
 * Prepare React window data and HTML components (shared between openReactWindow and showInMainWindow)
 * @param {any} globalData - Initial data to be sent to the HTML window
 * @param {HtmlWindowOptions} windowOptions - Window options
 * @returns {Object} - { globalSharedData, bodyHTML, generatedOptions, cssTags, themeJS }
 */
function prepareReactWindowData(
  globalData: any,
  windowOptions: HtmlWindowOptions,
): {
  globalSharedData: any,
  bodyHTML: string,
  generatedOptions: any,
  cssTags: string,
  themeJS: any,
} {
  if (!globalData) throw `prepareReactWindowData() globalData was null. This is required.`
  let globalSharedData = globalData

  globalSharedData = setEnv(globalSharedData) // set the build mode etc
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

  const reactRootComponent = `<script type="text/javascript" src="../np.Shared/react.c.Root.dev.js"></script>\n`

  // Add NP_THEME to preBodyScript if includeCSSAsJS is true (same logic as showHTMLV2)
  let preBS = windowOptions.preBodyScript || ''
  if (windowOptions.includeCSSAsJS) {
    const preBody: Array<Object> = preBS ? (Array.isArray(preBS) ? preBS : [preBS]) : []
    const theme = getThemeJS(true, true)
    if (theme.values) {
      const themeName = theme.name ?? '<unknown>'
      const themeJSONStr = JSON.stringify(theme.values, null, 4) ?? '<empty>'
      preBody.push(`/* Basic Theme as JS for CSS-in-JS use in scripts \n  Created from theme: "${themeName}" */\n  const NP_THEME=${themeJSONStr}\n`)
      logDebug(pluginJson, `prepareReactWindowData: Saving NP_THEME in JavaScript`)
    }
    preBS = preBody
  }

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

  return {
    globalSharedData,
    bodyHTML,
    generatedOptions,
    cssTags,
    themeJS,
  }
}

/**
 * Assemble HTML string from prepared data (for use with HTMLView.showInMainWindow)
 * @param {string} bodyHTML - The body HTML content
 * @param {any} generatedOptions - Generated options with scripts, headerTags, etc.
 * @param {HtmlWindowOptions} windowOptions - Original window options
 * @returns {string} - Complete HTML string
 */
function assembleHTMLString(bodyHTML: string, generatedOptions: any, windowOptions: HtmlWindowOptions): string {
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
  return fullHTML.join('\n')
}

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
    if (!globalData) throw `NPReactLocal.openReactWindow() globalData was null. This is required. See the README`

    // Prepare all React window data using shared function
    const { bodyHTML, generatedOptions } = prepareReactWindowData(globalData, windowOptions)

    // Use showHTMLV2 which handles HTML assembly internally
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
    if (!globalData) throw `NPReactLocal.showInMainWindow() globalData was null. This is required. See the README`

    // Prepare all React window data using shared function
    const { bodyHTML, generatedOptions } = prepareReactWindowData(globalData, windowOptions)

    // Assemble the HTML string (since showInMainWindow needs a complete HTML string, not just body)
    const fullHTMLStr = assembleHTMLString(bodyHTML, generatedOptions, windowOptions)

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

    // If wanted, also write this HTML to a file so we can work on it offline.
    // Note: this is saved to the Plugins/Data/<Plugin> folder, not a user-accessible Note.
    if (windowOptions.savedFilename && windowOptions.savedFilename !== '') {
      const thisFilename = windowOptions.savedFilename ?? ''
      const filenameWithoutSpaces = thisFilename.split(' ').join('') ?? ''
      // Write to specified file in NP sandbox
      const res = DataStore.saveData(fullHTMLStr, filenameWithoutSpaces, true)
      if (res) {
        logDebug(pluginJson, `showInMainWindow: - Saved copy of HTML to '${windowOptions.windowTitle || 'React Window'}' to ${thisFilename}`)
      } else {
        logError(pluginJson, `showInMainWindow: - Couldn't save resulting HTML '${windowOptions.windowTitle || 'React Window'}' to ${thisFilename}.`)
      }
    }

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
 * Also handles ScriptObj types (converts to string) and undefined/null
 * @param {Array<string>} arr
 * @param {any} items - Can be string, Array<string>, ScriptObj, or undefined/null
 * @returns {Array<string>}
 */
const addStringOrArrayItems = (arr: Array<string>, items: any): Array<string> => {
  if (!items) return arr
  if (typeof items === 'string') {
    arr.push(items)
  } else if (Array.isArray(items)) {
    // Handle array of strings or ScriptObj
    for (const item of items) {
      if (typeof item === 'string') {
        arr.push(item)
      } else if (item && typeof item === 'object') {
        // ScriptObj - convert to string using generateScriptTags
        const scriptStr = generateScriptTags(item)
        if (scriptStr) {
          arr.push(scriptStr)
        }
      }
    }
  } else if (items && typeof items === 'object') {
    // ScriptObj - convert to string using generateScriptTags
    const scriptStr = generateScriptTags(items)
    if (scriptStr) {
      arr.push(scriptStr)
    }
  }
  return arr
}
