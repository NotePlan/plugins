// @flow
// ---------------------------------------------------------
// HTML helper functions for use with HTMLView API
// by @jgclark, @dwertheimer
// Last updated 5.9.2023 by @jgclark
// ---------------------------------------------------------

import { clo, logDebug, logError, logInfo, logWarn, JSP } from '@helpers/dev'
import { getStoredWindowRect, isHTMLWindowOpen, storeWindowRect } from '@helpers/NPWindows'
import { generateCSSFromTheme, RGBColourConvert } from '@helpers/NPThemeToCSS'
import { isTermInNotelinkOrURI } from '@helpers/paragraph'
import { RE_EVENT_LINK, RE_SYNC_MARKER } from '@helpers/regex'

// ---------------------------------------------------------
// Constants and Types

const pluginJson = 'helpers/HTMLView'

export type HtmlWindowOptions = {
  windowTitle: string,
  headerTags?: string,
  generalCSSIn?: string,
  specificCSS?: string,
  makeModal?: boolean,
  bodyOptions?: string,
  preBodyScript?: string | ScriptObj | Array<string | ScriptObj>,
  postBodyScript?: string | ScriptObj | Array<string | ScriptObj>,
  savedFilename?: string,
  width?: number,
  height?: number,
  x?: number,
  y?: number,
  reuseUsersWindowRect?: boolean,
  includeCSSAsJS?: boolean,
  customId?: string,
  shouldFocus?: boolean,
}

// Meta tags to always apply:
// - to make windows always responsive
const fixedMetaTags = `
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
`

// ---------------------------------------------------------

/**
 * This function creates the webkit message handler for an action in HTML sending data back to the plugin. Generally passed through to showHTMLWindow as part of the pre or post body script.
 * @param {string} commandName - the *name* of the plugin command to be called (not the jsFunction) -- THIS NAME MUST BE ONE WORD, NO SPACES - generally a good idea for name/jsFunction to be the same for callbacks
 * @param {string} pluginID - the plugin ID
 * @param {string} returnPathFuncName - the name of the function in HTML/JS that NotePlan will call after receiving a message on the bridge (if one is passed/needed)
 * Note re: commandArgs - in the HTML/JS code, pass an array of values to be passed into the plugin command callback
 * @example
 * You could create one of these callbacks for each HTML element that needs to send data back to the plugin. However, that requires a lot of boilerplate code (in plugin.json, index.html, and your plugin file).
 * Alternatively, you could have one callback (onHTMLWindowAction) for multiple HTML elements, and the first argument could be the name of the action to be taken in the plugin
 * const cb = getCallbackCodeString('onHTMLWindowAction', 'dwertheimer.myplugin')
 * const myButton = `<button id="foo" onclick="onHTMLWindowAction(['colorWasPicked', document.getElementById('colorPicker').value])">Select this color</button>`
 * showHTMLWindow('Test', `<p>Test</p>${myButton}`, { savedFilename: 'test.html', postBodyScript: cb })
 * ...The HTML element in your HTML (myButton in this example) passes a static variable/string or the value of something in the HTML to the callback onClick
 * @returns
 */
export function getCallbackCodeString(jsFunctionName: string, commandName: string = '%%commandName%%', pluginID: string = '%%pluginID%%', returnPathFuncName: string = ''): string {
  const haveNotePlanExecute = JSON.stringify(`(async function() { await DataStore.invokePluginCommandByName("${commandName}", "${pluginID}", %%commandArgs%%);})()`)
  // logDebug(`getCallbackCodeString: In HTML Code, use "${commandName}" to send data to NP, and use a func named <returnPathFuncName> to receive data back from NP`)
  //TODO: could use "runCode()" as shorthand for the longer postMessage version below, but it does the same thing
  // "${returnPathFuncName}" was the onHandle, but since that function doesn't really do anything, I'm not sending it
  return `
    // This is a callback bridge from HTML to the plugin
    const ${jsFunctionName} = (commandName = "${commandName}", pluginID = "${pluginID}", commandArgs = []) => {
      const code = ${haveNotePlanExecute}.replace("%%commandName%%",commandName).replace("%%pluginID%%",pluginID).replace("%%commandArgs%%", JSON.stringify(commandArgs));
      // console.log(\`${jsFunctionName}: Sending command "\$\{commandName\}" to NotePlan: "\$\{pluginID\}" with args: \$\{JSON.stringify(commandArgs)\}\`);
      console.log(\`window.${jsFunctionName}: Sending code: "\$\{code\}"\`)
      if (window.webkit) {
        window.webkit.messageHandlers.jsBridge.postMessage({
          code: code,
          onHandle: "${returnPathFuncName}" ,
          id: "1"
        });
      } else {
        console.log(\`window.${jsFunctionName}: \$\{commandName\} called with args:\`, commandArgs);
      }
    };
`
}

/**
 * This function creates the webkit console.log/error handler for HTML messages to get back to NP console.log
 * @returns {string} - the javascript (without a tag)
 */
export const getErrorBridgeCodeString = (): string => `
  // This is a bridge to get errors from the HTML window back to the NP console.log
  window.onerror = (msg, url, line, column, error) => {
      const message = {
        message: msg,
        url: url,
        line: line,
        column: column,
        error: JSON.stringify(error)
      }

      if (window.webkit) {
        window.webkit.messageHandlers.error.postMessage(message);
      } else {
        console.log("Error:", message);
      }
    };  `

/**
 * Remove selectors and props we know we will never use in CSS-to-JS
 * @author @dwertheimer
 * @param {any} themeObj
 * @returns {any}
 */
export function pruneTheme(themeObj: any): any {
  // remove selectors we know we will never use
  const selectorsToPrune = ['__orderedStyles', 'author']
  // any object that contains these keys will have these props erased
  const propsToPrune = ['regex', 'matchPosition', 'isMarkdownCharacter', 'isRevealOnCursorRange', 'isHiddenWithoutCursor', 'headIndent']
  Object.keys(themeObj).forEach((key) => {
    if (selectorsToPrune.includes(key)) {
      delete themeObj[key]
    } else {
      if (typeof themeObj[key] === 'object') {
        if (Array.isArray(themeObj[key]) && themeObj[key].length > 0) {
          themeObj[key] = themeObj[key].map(pruneTheme)
        } else {
          Object.keys(themeObj[key]).forEach((prop) => {
            if (propsToPrune.includes(prop)) {
              delete themeObj[key][prop]
            } else {
              themeObj[key][prop] = pruneTheme(themeObj[key][prop])
            }
            if (!themeObj[key][prop]) delete themeObj[key][prop]
          })
        }
      } else {
        if (propsToPrune.includes(key) || !themeObj[key] || themeObj[key] === '') {
          delete themeObj[key]
        }
      }
    }
    if (typeof themeObj[key] === 'object' && Object.keys(themeObj[key]).length === 0) delete themeObj[key]
  })
  if (typeof themeObj === 'object' && Object.keys(themeObj).length === 0) return null
  return themeObj
}

/**
 * Get the basic colors for CSS-in-JS
 * All code lifted from @jgclark CSS conversion above - thank you!
 * @author @dwertheimer
 * @param {any} themeJSON - theme file (e.g. theme.values) from Editor
 */
const getBasicColors = (themeJSON: any) => {
  if (!themeJSON) return {}
  return {
    backgroundColor: themeJSON.editor?.backgroundColor ?? '#1D1E1F',
    textColor: RGBColourConvert(themeJSON.editor?.textColor) ?? '#FFFFFF',
    h1: RGBColourConvert(themeJSON.styles?.title1?.color ?? '#CC6666'),
    h2: RGBColourConvert(themeJSON.styles?.title2?.color ?? '#E9C062'),
    h3: RGBColourConvert(themeJSON.styles?.title3?.color ?? '#E9C062'),
    h4: RGBColourConvert(themeJSON.styles?.title4?.color ?? '#E9C062'),
    tintColor: RGBColourConvert(themeJSON.editor?.tintColor) ?? '#E9C0A2',
    altColor: RGBColourConvert(themeJSON.editor?.altBackgroundColor) ?? (RGBColourConvert(themeJSON.editor?.altColor) || '#2E2F30'),
    baseFontSize: Number(DataStore.preference('fontSize')) ?? 14,
  }
}

/**
 * Get the current theme as a JSON string that can be passed to Javascsript in the HTML window for CSS-in-JS styling
 * Mainly, we are doing this to get the Editor object with the core styles, but we can also get the custom styles (optionally)
 * @author @dwertheimer
 * @param {boolean} cleanIt - clean properties we know we won't use to save space (default: true, set to false for no pruning/cleaning)
 * @param {boolean} includeSpecificStyles - include the "styles" object with all the specific custom styles (default: false)
 * @returns {any} - object to be stringified or null if there are no styles to send
 */
export function getThemeJS(cleanIt: boolean = true, includeSpecificStyles: boolean = false): any {
  const theme = { ...Editor.currentTheme }
  // logDebug(pluginJson, `getThemeJS currentTheme="${theme?.name}"`)
  if (!includeSpecificStyles && theme?.values?.styles) delete theme.values.styles
  if (cleanIt) theme.values = pruneTheme(theme.values)
  if (!theme.values) {
    // clo(Editor.currentTheme, `getThemeJS Editor.currentTheme="${theme?.name || ''}"`)
    throw 'No theme values found in theme, cannot continue'
  }
  theme.values.base = getBasicColors(Editor.currentTheme.values)
  return theme
}

/**
 * WARNING: Deprecated. Please use more advanced features in showHTMLV2() instead.
 * Convenience function for opening HTML Window with as few arguments as possible
 * Automatically adds the error bridge to bring console log errors back to NP
 * You should add your own callback bridge to get data back from the HTML window to your plugin (see getCallbackCodeString() above)
 * @param {string} windowTitle - (required) window title
 * @param {string} body - (required) body HTML code
 * @param {HtmlWindowOptions} opts - (optional) options: {headerTags, generalCSSIn, specificCSS, makeModal, preBodyScript, postBodyScript, savedFilename, width, height}
 * Note: opts. includeCSSAsJS - (optional) if true, then the theme will be included as a JS object in the HTML window, and you can use it for CSS-in-JS styling
 * Notes: if opts.generalCSSIn is not supplied, then CSS will be generated based on the user's current theme.
 * If you want to save the HTML to a file for debugging, then you should supply opts.savedFilename (it will be saved in the plugin's data/<plugin.id> folder).
 * Your script code in pre-body or post-body do not need to be wrapped in <script> tags, and can be either a string or an array of strings or an array of objects with code and type properties (see ScriptObj above)
 * @example showHTMLWindow("Test", "<p>Test</p>", {savedFilename: "test.html"})
 * @author @dwertheimer
 */
export async function showHTMLWindow(body: string, opts: HtmlWindowOptions) {
  const preBody: Array<Object> = opts.preBodyScript
    ? (Array.isArray(opts.preBodyScript)
      ? opts.preBodyScript
      : [opts.preBodyScript])
    : []
  if (opts.includeCSSAsJS) {
    const theme = getThemeJS(true, true)
    if (theme.values) {
      const themeName = theme.name ?? '<unknown>'
      const themeJSONStr = JSON.stringify(theme.values, null, 4) ?? '<empty>'
      preBody.push(`/* Basic Theme as JS for CSS-in-JS use in scripts \n  Created from theme: "${themeName}" */\n  const NP_THEME=${themeJSONStr}\n`)
      logDebug(pluginJson, `showHTMLWindow Saving NP_THEME in JavaScript`)
    }
  }
  opts.preBodyScript = preBody
  await showHTMLV2(body, opts)
  // showHTML(
  //   windowTitle,
  //   opts.headerTags ?? '',
  //   body,
  //   opts.generalCSSIn ?? '',
  //   opts.specificCSS ?? '',
  //   opts.makeModal ?? false,
  //   [...preBody],
  //   opts.postBodyScript ?? '',
  //   opts.savedFilename ?? '',
  //   opts.width,
  //   opts.height,
  // )
}

type ScriptObj = {
  // script code with or without <script> tags
  code: string,
  // script type (e.g. "text/babel" for React/JSX, or blank for "text/javascript")
  type?: string,
}

/**
 * Generate scripts string from array of strings or objects with code and type
 * Strings are assumed to be javascript
 * Use ScriptObj type to specify type (typically "text/babel" for React/JSX)
 * @author @dwertheimer
 * @param {string|ScriptObj | Array<string|ScriptObj>} scripts
 * @returns {string} the fully formed string with all the scripts
 * @tests exist
 */
export function generateScriptTags(scripts: string | ScriptObj | Array<string | ScriptObj>): string {
  if (!scripts || (!scripts?.length && typeof scripts !== 'object')) return ''
  const scriptsArr = Array.isArray(scripts) ? scripts : [scripts]
  const output = []
  scriptsArr.forEach((script) => {
    let hasScriptTag
    let scriptText = ''
    if (typeof script === 'string') {
      if (script !== '') {
        hasScriptTag = script.includes('<script')
        scriptText = hasScriptTag ? '' : '<script type="text/javascript">\n'
        scriptText += script
      }
    } else {
      const { code, type } = script || {}
      hasScriptTag = code.includes('<script')
      if (hasScriptTag && type !== 'text/javascript') {
        logError(pluginJson, `generateScriptTags script had <script tag and type:"${type || ''}" and value:"${code}" - this is not supported (send only the code)`)
      }
      scriptText += hasScriptTag ? '' : `<script type="${type ?? 'text/javascript'}">\n`
      scriptText += code
    }
    if (script !== '') scriptText += hasScriptTag ? '\n' : '\n</script>\n'
    output.push(scriptText)
  })
  return output.join('\n')
}

/**
 * Assemble/collate the HTML to use from its various parts.
 * @author @jgclark
 * @param {string} body
 * @param {HtmlWindowOptions} winOpts
 * @returns
 */
function assembleHTMLParts(body: string, winOpts: HtmlWindowOptions): string {
  try {
    const fullHTML = []
    fullHTML.push('<!DOCTYPE html>') // needed to let emojis work without special coding
    fullHTML.push('<html>')
    fullHTML.push('<head>')
    fullHTML.push(`<title>${winOpts.windowTitle}</title>`)
    fullHTML.push(fixedMetaTags)
    const preScript = generateScriptTags(winOpts.preBodyScript ?? '')
    if (preScript !== '') {
      fullHTML.push(preScript) // dbw moved to top because we need the logging bridge to be loaded before any content which could have errors
    }
    fullHTML.push(winOpts.headerTags ?? '')
    fullHTML.push('<style type="text/css">')
    // If generalCSSIn is empty, then generate it from the current theme. (Note: could extend this to save CSS from theme, and then check if it can be reused.)
    const generalCSS = winOpts.generalCSSIn && winOpts.generalCSSIn !== '' ? winOpts.generalCSSIn : generateCSSFromTheme('')
    fullHTML.push(generalCSS)
    fullHTML.push(winOpts.specificCSS ?? '')
    fullHTML.push('</style>')
    fullHTML.push('</head>')
    fullHTML.push(winOpts.bodyOptions ? `\n<body ${winOpts.bodyOptions}>` : `\n<body>`)
    fullHTML.push(body)
    fullHTML.push('\n</body>')
    const postScript = generateScriptTags(winOpts.postBodyScript ?? '')
    if (postScript !== '') {
      fullHTML.push(postScript)
    }
    fullHTML.push('</html>')
    const fullHTMLStr = fullHTML.join('\n')
    return fullHTMLStr
  } catch (err) {
    logError(pluginJson, err.message)
    return ''
  }
}

/**
 * WARNING: Deprecated. Please use more advanced features in showHTMLV2() instead. This version will also (probably) not allow use of multiple HTML windows from NP3.9.6.
 * Helper function to construct HTML to show in a new window.
 * Note: used up to v3.9.2 before more advanced window handling possible.
 * Note: if customID not passed, it will fall back to using windowTitle
 *
 * @param {string} windowTitle
 * @param {string} headerTags
 * @param {string} body
 * @param {string} generalCSSIn
 * @param {string} specificCSS
 * @param {boolean?} makeModal?
 * @param {string|ScriptObj | Array<string|ScriptObj>?} preBodyScript
 * @param {string|ScriptObj | Array<string|ScriptObj>?} postBodyScript
 * @param {string?} filenameForSavedFileVersion
 * @param {number?} width
 * @param {number?} height
 * @param {string?} customId
 */
export function showHTML(
  windowTitle: string,
  headerTags: string,
  body: string,
  generalCSSIn: string,
  specificCSS: string,
  makeModal: boolean = false,
  preBodyScript: string | ScriptObj | Array<string | ScriptObj> = '',
  postBodyScript: string | ScriptObj | Array<string | ScriptObj> = '',
  filenameForSavedFileVersion: string = '',
  width?: number,
  height?: number,
  // eslint-disable-next-line no-unused-vars
  customId: string = '', // Note: now unused
): void {
  try {
    const opts: HtmlWindowOptions = {
      windowTitle: windowTitle,
      headerTags: headerTags,
      generalCSSIn: generalCSSIn,
      specificCSS: specificCSS,
      preBodyScript: preBodyScript,
      postBodyScript: postBodyScript,
    }
    // clo(opts)
    const fullHTMLStr = assembleHTMLParts(body, opts)

    // Call the appropriate function, with or without h/w params.
    // Currently non-modal windows only available on macOS and from 3.7 (build 864)
    if (width === undefined || height === undefined) {
      if (makeModal || NotePlan.environment.platform !== 'macOS') {
        logDebug('showHTML', `Using showSheet modal view for b${NotePlan.environment.buildVersion}`)
        HTMLView.showSheet(fullHTMLStr) // available from 3.6.2
      } else {
        logDebug('showHTML', `Using showWindow non-modal view for b${NotePlan.environment.buildVersion}`)
        HTMLView.showWindow(fullHTMLStr, windowTitle) // available from 3.7.0
      }
    } else {
      if (makeModal || NotePlan.environment.platform !== 'macOS' || NotePlan.environment.buildVersion < 863) {
        logDebug('showHTML', `Using showSheet modal view for b${NotePlan.environment.buildVersion}`)
        HTMLView.showSheet(fullHTMLStr, width, height)
      } else {
        logDebug('showHTML', `Using showWindow non-modal view with w+h for b${NotePlan.environment.buildVersion}`)
        HTMLView.showWindow(fullHTMLStr, windowTitle, width, height) // available from 3.7.0
      }
    }

    // TEST: remove from 3.9.6
    // Set customId for this window (with fallback to be windowTitle) Note: requires NP v3.8.1+
    // if (NotePlan.environment.buildVersion >= 976) {
    //   setHTMLWindowId(customId ?? windowTitle)
    // }

    // If wanted, also write this HTML to a file so we can work on it offline.
    // Note: this is saved to the Plugins/Data/<Plugin> folder, not a user-accessible Note.
    if (filenameForSavedFileVersion !== '') {
      const filenameWithoutSpaces = filenameForSavedFileVersion.split(' ').join('')
      // Write to specified file in NP sandbox
      const res = DataStore.saveData(fullHTMLStr, filenameWithoutSpaces, true)
      if (res) {
        logDebug('showHTML', `Saved copy of HTML to '${windowTitle}' to ${filenameForSavedFileVersion}`)
      } else {
        logError('showHTML', `Couldn't save resulting HTML '${windowTitle}' to ${filenameForSavedFileVersion}.`)
      }
    }
  } catch (error) {
    logError('HTMLView / showHTML', error.message)
  }
}

/**
 * V2 helper function to construct HTML and decide how and where to show it in a window.
 * Most data comes via an opts object, to ease future expansion.
 * Adds ability to automatically display windows at the last position and size that the user had left them at. To enable this:
 * - set opts.reuseUsersWindowRect to true
 * - supply a opts.customId to distinguish which window this is to the plugin (e.g. 'review-list'). I suggest this is lower-case-with-dashes. (If customId not passed, it will fall back to using opts.windowTitle instead.)
 * - (optional) still supply default opts.width and opts.height to use the first time
 * Under the hood it saves the windowRect to local preference "<plugin.id>.<customId>".
 * Note: Could allow for style file via saving arbitrary data file, and have it triggered on theme change.
 * Note: requires NP v3.9.2 build 1037
 * @author @jgclark
 * @param {string} body
 * @param {HtmlWindowOptions} opts
 */
export async function showHTMLV2(body: string, opts: HtmlWindowOptions): Promise<Window | boolean> {
  try {
    if (NotePlan.environment.buildVersion < 1037) {
      logWarn('HTMLView / showHTMLV2', 'showHTMLV2() is only available on 3.9.2 build 1037 or newer. Will fall back to using older, simpler, showHTML() instead ...')
      await showHTML(
        opts.windowTitle,
        fixedMetaTags + (opts.headerTags ?? ''),
        body,
        opts.generalCSSIn ?? '',
        opts.specificCSS ?? '',
        opts.makeModal,
        opts.preBodyScript,
        opts.postBodyScript,
        opts.savedFilename ?? '',
        opts.width,
        opts.height,
        opts.customId,
      )
      return true // for completeness
    }

    logDebug('HTMLView / showHTMLV2', `starting with customId ${opts.customId ?? ''} and reuseUsersWindowRect ${String(opts.reuseUsersWindowRect) ?? '??'}`)

    // Assemble the parts of the HTML into a single string
    const fullHTMLStr = assembleHTMLParts(body, opts)

    // Ensure we have a window ID to use
    const cId = opts.customId ?? opts.windowTitle ?? 'fallback'

    // Before showing anything, see if the window is already open, and if so save its x/y/w/h (if requested)
    if (isHTMLWindowOpen(cId)) {
      logDebug('showHTMLV2', `Window is already open, and will save its x/y/w/h`)
      storeWindowRect(cId)
    }

    // Decide which of the appropriate functions to call.
    if (opts.makeModal) {
      // if (opts.makeModal || NotePlan.environment.platform !== 'macOS') {
      logDebug('showHTMLV2', `Using modal 'sheet' view for ${NotePlan.environment.buildVersion} build on ${NotePlan.environment.platform}`)
      // if (opts.width === undefined || opts.height === undefined) {
      //   HTMLView.showSheet(fullHTMLStr)
      // } else {
      HTMLView.showSheet(fullHTMLStr, opts.width, opts.height)
      // }
    } else {
      // Make a normal non-modal window
      let winOptions = {}
      // First set to the default values
      if (NotePlan.environment.buildVersion >= 1087) {
        // From 3.9.6 can set windowId/customId directly through options
        winOptions = {
          x: opts.x,
          y: opts.y,
          width: opts.width,
          height: opts.height,
          shouldFocus: opts.shouldFocus,
          id: cId, // don't need both ... but trying to work out which is the current one for the API
          windowId: cId,
        }
      } else {
        winOptions = {
          x: opts.x,
          y: opts.y,
          width: opts.width,
          height: opts.height,
          shouldFocus: opts.shouldFocus,
        }
      }
      // Now override with saved x/y/w/h for this window if wanted, and if available
      if (opts.reuseUsersWindowRect && cId) {
        // logDebug('showHTMLV2', `- Trying to use user's saved Rect from pref for ${cId}`)
        const storedRect = getStoredWindowRect(cId)
        if (storedRect) {
          winOptions = {
            x: storedRect.x,
            y: storedRect.y,
            width: storedRect.width,
            height: storedRect.height,
            shouldFocus: opts.shouldFocus,
            id: cId, // don't need both ... but trying to work out which is the current one for the API
            windowId: cId,
          }
          logDebug('showHTMLV2', `- Read user's saved Rect from pref from ${cId}`)
          // if (NotePlan.environment.platform !== 'macOS') {
          // const extraInfo = "<p>OS:" + NotePlan.environment.platform +
          //   " Type: " + (opts.makeModal ? 'Modal' : 'Floating') +
          //   " W: " + opts.width +
          //   " H: " + opts.height + "</p>\n" +
          //   " StoredW: " + storedRect.width +
          //   " StoredH: " + storedRect.height + "</p>\n"
          // fullHTMLStr = fullHTMLStr.replace("<body>", `<body>\n${extraInfo}\n`)
          // }
        } else {
          logDebug('showHTMLV2', `- Couldn't read user's saved Rect from pref from ${cId}`)
          // if (NotePlan.environment.platform !== 'macOS') {
          //   const extraInfo = "<p>OS:" + NotePlan.environment.platform +
          //     " Type: " + (opts.makeModal ? 'Modal' : 'Floating') +
          //     " W: " + opts.width +
          //     " H: " + opts.height + "</p>\n"
          //   fullHTMLStr = fullHTMLStr.replace("<body>", `<body>\n${extraInfo}\n`)
          // }
        }
      }
      // clo(winOptions, 'showHTMLV2 using winOptions:')

      // From v3.9.8 we can test to see if requested window dimensions would exceed screen dimensions; if so reduce them accordingly
      // Note: could also check window will be visible on screen and if not, move accordingly
      if (NotePlan.environment.buildVersion >= 1100) {
        const screenWidth = NotePlan.environment.screenWidth
        const screenHeight = NotePlan.environment.screenHeight
        logDebug('showHTMLV2', `- screen dimensions are ${String(screenWidth)} x ${String(screenHeight)} for device ${NotePlan.environment.machineName}`)
        if (winOptions.width > screenWidth) {
          logDebug('showHTMLV2', `- Constrained width from ${String(winOptions.width)} to ${String(screenWidth)}`)
          winOptions.width = screenWidth
        }
        if (winOptions.height > screenHeight) {
          logDebug('showHTMLV2', `- Constrained height from ${String(winOptions.height)} to ${String(screenHeight)}`)
          winOptions.height = screenHeight
        }
      }

      const win: Window = await HTMLView.showWindowWithOptions(fullHTMLStr, opts.windowTitle, winOptions) // winOptions available from 3.9.1.
      // clo(win, '-> win:')

      // If wanted, also write this HTML to a file so we can work on it offline.
      // Note: this is saved to the Plugins/Data/<Plugin> folder, not a user-accessible Note.
      if (opts.savedFilename !== '') {
        const thisFilename = opts.savedFilename ?? ''
        const filenameWithoutSpaces = thisFilename.split(' ').join('') ?? ''
        // Write to specified file in NP sandbox
        const res = DataStore.saveData(fullHTMLStr, filenameWithoutSpaces, true)
        if (res) {
          logDebug('showHTMLV2', `- Saved copy of HTML to '${opts.windowTitle}' to ${thisFilename}`)
        } else {
          logError('showHTMLV2', `- Couldn't save resulting HTML '${opts.windowTitle}' to ${thisFilename}.`)
        }
      }

      // Set customId for this window (with fallback to be windowTitle)
      // Note: only required between NP v3.8.1 + and 3.9.5.After that its built in.
      if (NotePlan.environment.buildVersion < 1087) {
        logDebug('showHTMLV2', `- setting the customId to '${cId}'`)
        win.customId = cId
      }

      // Double-check: read back from the window itself
      logDebug('showHTMLV2', `- Window has customId '${win.customId}' / id ${win.id}`)
      return win
    }
  } catch (error) {
    logError('HTMLView / showHTMLV2', error.message)
    return false
  }
}

/**
 * Draw (animated) percent ring with the number in the middle.
 * If 'textToShow' is given then use this instead of the percentage.
 * Note: harder than it looks to change text color: see my contribution at https://stackoverflow.com/questions/17466707/how-to-apply-a-color-to-a-svg-text-element/73538662#73538662 when I worked out how.
 * Note: It needs to be followed by call to JS function setPercentRing() to set the ring's state.
 * @param {number} percent 0-100
 * @param {string?} color for ring and text (as colour name or #RGB)
 * @param {string?} textToShow inside ring (which can be different from just the percent)
 * @param {ID} string identifier for this ring (unique within the HTML page)
 * @returns {string} SVG code to insert in HTML
 */
export function makeSVGPercentRing(percent: number, color: string, textToShow: string, ID: string): string {
  return `<svg id="pring${ID}" class="percent-ring" height="200" width="200" viewBox="0 0 100 100" onload="setPercentRing(${percent}, 'pring${ID}');">
    <circle class="percent-ring-circle" stroke="${color}" stroke-width=12% fill="transparent" r=40% cx=50% cy=50% />
    <g class="circle-percent-text" color=${color}>
    <text class="circle-percent-text" x=50% y=53% dominant-baseline="middle" text-anchor="middle" fill="currentcolor" stroke="currentcolor">${textToShow}</text>
    </g>
  </svg>`
}

/**
 * Draw pause icon (adapted on https://www.svgrepo.com/svg/135248/pause)
 * Note: not animated, and doesn't need any following call to activate.
 * @returns {string} SVG code to insert in HTML
 */
export function makeSVGPauseIcon(): string {
  return `<svg id="pause" x="0px" y="0px"
	 viewBox="0 0 58 58" style="enable-background:new 0 0 58 58;" xml:space="preserve"><circle style="fill:#979797;" cx="29" cy="29" r="29"/><g><rect x="17" y="18" style="fill:#FFFFFF;" width="8" height="22"/></g><g><rect x="33" y="18" style="fill:#FFFFFF;" width="8" height="22"/></g></svg>`
}

/**
 * Create an interpolated colour from red (0%) to green (100%), passing through yellow.
 * Note: not using quite pure red to pure green, to make it less harsh, and spending more time from red to yellow than yellow to green, to make it look better.
 * Tweaked from https://stackoverflow.com/a/6394340/3238281
 * @param {number} percent
 * @returns {string} #RRGGBB value
 */
export function redToGreenInterpolation(percent: number): string {
  // Work out colour ranges from nearly pure red to nearly full green, passing through yellow
  const red = (percent > 60 ? 1 - (2 * (percent - 60)) / 100.0 : 1.0) * 223
  const green = (percent > 40 ? 1.0 : (2 * percent) / 100.0) * 187 // 223
  const blue = Math.abs(50.0 - percent) // add some blue increasingly at both red and green ends
  return rgbToHex(Math.round(red), Math.round(green), Math.round(blue))
}

/**
 * Create '#RRGGBB' string from RGB values each from 0-255
 * From https://stackoverflow.com/a/5624139/3238281
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string} #RRGGBB value
 */
export function rgbToHex(r: number, g: number, b: number): string {
  // eslint-disable-next-line prefer-template
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

/**
 * Convert a Markdown link to HTML
 * @param {string} str
 * @returns {string} the new URL HTML anchor
 */
export function replaceMarkdownLinkWithHTMLLink(str: string): string {
  return str.replace(/\[(.*?)\]\((.*?)\)/gm, `<a href="$2">$1</a>`)
}

/**
 * Message action types
 * SET_TITLE - update the title of the HTML window (send {title: 'new title'} in the payload)
 * SHOW_BANNER - display a message in the top of the page (use the helper sendBannerMessage(pluginJson['plugin.id'],'message'))
 * SET_DATA - tell the HTML window to update its state with the data passed
 * RETURN_VALUE - the async return value of a call that came in fron the React Window to the Plugin
 */

/**
 * Send some data to the HTML window (to be written to globalSharedData) using postMessage message passing
 * Note: we can (and do) write to globalSharedData directly, but we should try to use this function
 * to do so, because it will allow us to use message passing to update the state in the HTML window
 * which gives us more visibility into what's happening on the HTML side
 * @param {string} windowId - the id of the window to send the message to (should be the same as the window's id attribute)
 * @param {string - see above} actionType - the reducer-type action to be dispatched (tells the app how to act on the data passed)
 * @param {any} data - the data to be passed to the app (and ultimately to be written to globalSharedData)
 * @param {string} updateInfo - the message to be sent to the app
 * @return {any} - the result of the runJavaScript call (should be unimportant in this case -- undefined is ok)
 * @author @dwertheimer
 */
export async function sendToHTMLWindow(windowId: string, actionType: string, data: any = {}, updateInfo: string = ''): any {
  try {
    const dataWithUpdated = { ...data, ...{ lastUpdated: { msg: `${actionType}${updateInfo ? ` ${updateInfo}` : ''}`, date: new Date().toLocaleString() } } }
    // logDebug(`Bridge::sendToHTMLWindow`, `sending type:"${actionType}" payload=${JSON.stringify(data, null, 2)}`)
    logDebug(`Bridge::sendToHTMLWindow`, `sending type:"${actionType}" to window: "${windowId}"`)
    const result = await HTMLView.runJavaScript(
      `window.postMessage(
        {
          type: '${actionType}',
          payload: ${JSON.stringify(dataWithUpdated)}
        },
        '*'
      );`,
      windowId,
    )
    // logDebug(`Bridge::sendToHTMLWindow`, `result from the window: ${JSON.stringify(result)}`)
    return result
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Get the current state of globalSharedData from the HTML window (SHARED DATA MUST BE OBJECTS)
 * Returns actual object or undefined if the global var doesn't exist (along with some noisy log errors)
 * See notes above
 * NOTE: this function should only be called after the window has fully set up, the global var has been set
 * @author @dwertheimer
 * @param {string} varName - the name of the global variable to be updated (by default "globalSharedData")
 * @param {string} windowId - the id of the window to send the message to (should be the same as the window's id attribute)
 * @returns {Object} - the current state of globalSharedData
 */
export async function getGlobalSharedData(windowId: string, varName: string = 'globalSharedData'): Promise<any> {
  try {
    logDebug(pluginJson, `getGlobalSharedData getting var:${varName} from window:${windowId}`)
    const currentValue = await HTMLView.runJavaScript(`${varName};`, windowId)
    // if (currentValue !== undefined) logDebug(`getGlobalSharedData`, `got ${varName}: ${JSON.stringify(currentValue)}`)
    return currentValue
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Generally, we will try not to update the global shared object directly, but instead use message passing to let React update the state. But there will be times we need to update the state from here (e.g. when we hit limits of message passing).
 * @author @dwertheimer
 * @param {string} windowId - the id of the window to send the message to (should be the same as the window's id attribute)
 * @param {any} data - the full object to be written to globalSharedData (SHARED DATA MUST BE OBJECTS)
 * @param {boolean} mergeData - if true (default), will merge the new data with the existing data, if false, will fully overwrite
 * @param {string} varName - the name of the global variable to be updated (by default "globalSharedData")
 * @returns {any} returns the result of the runJavaScript call, which in this case is typically identical to the data passed
 * ...and so can probably be ignored
 */
export async function updateGlobalSharedData(windowId: string, data: any, mergeData: boolean = true, varName: string = 'globalSharedData'): Promise<any> {
  let newData
  const currentData = await getGlobalSharedData(windowId, varName)
  if (currentData === undefined) {
    logDebug(`updateGlobalSharedData`, `Variable ${varName} was not defined (creating it now)...ignore the WebView error above ^^^`)
    await HTMLView.runJavaScript(`let ${varName} = {};`, windowId) // create the global var if it doesn't exist
  }
  if (mergeData) {
    newData = { ...currentData, ...data }
  } else {
    newData = data
  }
  // logDebug(`updateGlobalSharedData`, `writing globalSharedData (merged=${String(mergeData)}) to ${JSON.stringify(newData)}`)
  const code = `${varName} = JSON.parse(${JSON.stringify(newData)});`
  logDebug(pluginJson, `updateGlobalSharedData code=\n${code}\n`)
  logDebug(pluginJson, `updateGlobalSharedData FIXME: Is this still throwing an error? ^^^`)
  return await HTMLView.runJavaScript(code, windowId)
}

/**
 * Send a warning message to the HTML window (displays a warning message at the top of page)
 * @param {string} windowId - the id of the window to send the message to (should be the same as the window's id attribute)
 * @param {string} message - the message to be displayed
 * @param {string} color https://www.w3schools.com/w3css/w3css_colors.asp
 * @param {string} border (left vertical stripe border of box) https://www.w3schools.com/w3css/w3css_colors.asp
 */
export async function sendBannerMessage(windowId: string, message: string, color: string = 'w3-pale-red', border: string = 'w3-border-red'): Promise<any> {
  return await sendToHTMLWindow(windowId, 'SHOW_BANNER', { warn: true, msg: message, color, border })
}

// add basic ***bolditalic*** styling
// add basic **bold** or __bold__ styling
// add basic *italic* or _italic_ styling
export function convertBoldAndItalicToHTML(input: string): string {
  let output = input
  const RE_BOLD_ITALIC_PHRASE = new RegExp(/\*\*\*\b(.*?)\b\*\*\*/, 'g')
  let captures = output.matchAll(RE_BOLD_ITALIC_PHRASE)
  if (captures) {
    for (const capture of captures) {
      // logDebug('convertBoldAndItalicToHTML', `- making bold-italic with [${String(capture)}]`)
      output = output.replace(capture[0], `<b><em>${capture[1]}</em></b>`)
    }
  }

  // add basic **bold** or __bold__ styling
  const RE_BOLD_PHRASE = new RegExp(/([_\*]{2})([^_*]+?)\1/, 'g')
  captures = output.matchAll(RE_BOLD_PHRASE)
  if (captures) {
    for (const capture of captures) {
      // logDebug('convertBoldAndItalicToHTML', `- making bold with [${String(capture)}]`)
      output = output.replace(capture[0], `<b>${capture[2]}</b>`)
    }
  }

  // add basic *italic* or _italic_ styling
  // Note: uses a simplified regex that needs to come after bold above
  const RE_ITALIC_PHRASE = new RegExp(/([_\*])([^*]+?)\1/, 'g')
  captures = output.matchAll(RE_ITALIC_PHRASE)
  if (captures) {
    for (const capture of captures) {
      // logDebug('convertBoldAndItalicToHTML', `- making italic with [${String(capture)}]`)
      output = output.replace(capture[0], `<em>${capture[2]}</em>`)
    }
  }
  return output
}

// Simplify NP event links
// of the form `![📅](2023-01-13 18:00:::F9766457-9C4E-49C8-BC45-D8D821280889:::NA:::Contact X about Y:::#63DA38)`
export function simplifyNPEventLinksForHTML(input: string): string {
  let output = input
  const captures = output.match(RE_EVENT_LINK)
  if (captures) {
    // clo(captures, 'results from NP event link matches:')
    // Matches come in threes (plus full match), so process four at a time
    for (let c = 0; c < captures.length; c = c + 3) {
      const eventLink = captures[c]
      const eventTitle = captures[c + 1]
      const eventColor = captures[c + 2]
      output = output.replace(eventLink, `<i class="fa-regular fa-calendar" style="color: ${eventColor}"></i> <span class="event-link">${eventTitle}</span>`)
    }
  }
  return output
}

// Simplify embedded images of the form ![image](...) by replacing with an icon.
// (This also helps remove false positives for ! priority indicator)
export function simplifyInlineImagesForHTML(input: string): string {
  let output = input
  const captures = output.match(/!\[image\]\([^\)]+\)/g)
  if (captures) {
    // clo(captures, 'results from embedded image match:')
    for (const capture of captures) {
      logDebug(`simplifyInlineImagesForHTML`, capture)
      output = output.replace(capture, `<i class="fa-regular fa-image"></i> `)
      logDebug(`simplifyInlineImagesForHTML`, `-> ${output}`)
    }
  }
  return output
}

// Display hashtags with .hashtag style
// Note: need to make only one capture group, and use 'g'lobal flag
export function convertHashtagsToHTML(input: string): string {
  let output = input
  // const captures = output.match(/(\s|^|\"|\'|\(|\[|\{)(?!#[\d[:punct:]]+(\s|$))(#([^[:punct:]\s]|[\-_\/])+?\(.*?\)|#([^[:punct:]\s]|[\-_\/])+)/) // regex from @EduardMe's file
  // const captures = output.match(/(\s|^|\"|\'|\(|\[|\{)(?!#[\d\'\"]+(\s|$))(#([^\'\"\s]|[\-_\/])+?\(.*?\)|#([^\'\"\s]|[\-_\/])+)/) // regex from @EduardMe's file without :punct:
  const captures = output.match(/\B(?:#|＃)((?![\p{N}_]+(?:$|\b|\s))(?:[\p{L}\p{M}\p{N}_]{1,60}))/gu) // copes with Unicode characters, with help from https://stackoverflow.com/a/74926188/3238281
  if (captures) {
    // clo(captures, 'results from hashtag matches:')
    for (const capture of captures) {
      // logDebug('convertHashtagsToHTML', `capture: ${capture}`)
      if (!isTermInNotelinkOrURI(output, capture)) {
        output = output.replace(capture, `<span class="hashtag">${capture}</span>`)
      }
    }
  }
  return output
}

// Display mentions with .attag style
// Note: need to make only one capture group, and use 'g'lobal flag
export function convertMentionsToHTML(input: string): string {
  let output = input
  // const captures = output.match(/(\s|^|\"|\'|\(|\[|\{)(?!@[\d[:punct:]]+(\s|$))(@([^[:punct:]\s]|[\-_\/])+?\(.*?\)|@([^[:punct:]\s]|[\-_\/])+)/) // regex from @EduardMe's file
  // const captures = output.match(/(\s|^|\"|\'|\(|\[|\{)(?!@[\d\`\"]+(\s|$))(@([^\`\"\s]|[\-_\/])+?\(.*?\)|@([^\`\"\s]|[\-_\/])+)/) // regex from @EduardMe's file, without [:punct:]
  const captures = output.match(/\B@((?![\p{N}_]+(?:$|\b|\s))(?:[\p{L}\p{M}\p{N}_]{1,60}))/gu) // copes with Unicode characters, with help from https://stackoverflow.com/a/74926188/3238281
  if (captures) {
    // clo(captures, 'results from mention matches:')
    for (const capture of captures) {
      const match = capture //[2] // part from @
      output = output.replace(match, `<span class="attag">${match}</span>`)
    }
  }
  return output
}

/**
 * Convert markdown `pre-formatted` fragments to HTML with .code class
 * @param {string} input
 * @returns {string} output
 */
export function convertPreformattedToHTML(input: string): string {
  let output = input
  const captures = output.match(/`.*?`/g)
  if (captures) {
    // clo(captures, 'results from code matches:')
    for (const capture of captures) {
      const match = capture
      output = output.replace(match, `<span class="code">${match.slice(1, -1)}</span>`)
    }
  }
  return output
}

// Display mentions with .code style
export function convertHighlightsToHTML(input: string): string {
  let output = input
  const captures = output.match(/==.*?==/g)
  if (captures) {
    // clo(captures, 'results from highlight matches:')
    for (const capture of captures) {
      const match = capture
      output = output.replace(match, `<span class="highlighted">${match.slice(2, -2)}</span>`)
    }
  }
  return output
}

// Display underlined with .underlined style
// TODO: regex isn't quite right. But can't get original one to work for reasons I can't understand
// But does cope with lone ~ in URLs
export function convertUnderlinedToHTML(input: string): string {
  let output = input
  // const captures = output.match(/(?:[\s^])~.*?~(?:[\s$])/g)
  const captures = output.match(/~[\w\-'"]*?~/g)
  if (captures) {
    clo(captures, 'results from underlined matches:')
    for (const capture of captures) {
      const match = capture
      output = output.replace(match, `<span class="underlined">${match.slice(1, -1)}</span>`)
    }
  }
  return output
}

// Display strike text with .strikethrough style
//
export function convertStrikethroughToHTML(input: string): string {
  let output = input
  const captures = output.match(/~~.*?~~/g)
  if (captures) {
    // clo(captures, 'results from strikethrough matches:')
    for (const capture of captures) {
      const match = capture
      output = output.replace(match, `<span class="strikethrough">${match.slice(2, -2)}</span>`)
    }
  }
  return output
}

export function convertNPBlockIDToHTML(input: string): string {
  // Replace blockID sync indicator with icon
  // NB: needs to go after #hashtag change above, as it includes a # marker for colors.
  let output = input
  const captures = output.match(RE_SYNC_MARKER)
  if (captures) {
    // clo(captures, 'results from RE_SYNC_MARKER match:')
    for (const capture of captures) {
      output = output.replace(capture, '<i class="fa-solid fa-asterisk" style="color: #71b3c0;"></i>')
    }
  }
  return output
}

/**
 * Truncate visible part of HTML string, without breaking the HTML tags
 * @param {string} htmlIn
 * @param {number} maxLength of output
 * @param {boolean} dots - add ellipsis to end?
 * @returns {string} truncated HTML
 */
export function truncateHTML(htmlIn: string, maxLength: number, dots: boolean = true): string {
  let holdCounter = false
  let truncatedHTML = ''
  let limit = maxLength
  for (let index = 0; index < htmlIn.length; index++) {
    if (!limit || limit === 0) {
      break
    }
    if (htmlIn[index] === '<') {
      holdCounter = true
    }
    if (!holdCounter) {
      limit--
    }
    if (htmlIn[index] === '>') {
      holdCounter = false
    }
    truncatedHTML += htmlIn[index]
  }
  if (dots) {
    truncatedHTML = `${truncatedHTML} …`
  }
  // logDebug('truncateHTML', `{${htmlIn}} -> {${truncatedHTML}}`)
  return truncatedHTML
}
