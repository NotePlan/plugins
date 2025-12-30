// @flow
// ---------------------------------------------------------
// HTML helper functions for use with HTMLView API
// by @jgclark, @dwertheimer
// Last updated 2025-12-27 by @jgclark
// ---------------------------------------------------------
import showdown from 'showdown' // for Markdown -> HTML from https://github.com/showdownjs/showdown
import {
  hasFrontMatter
} from '@helpers/NPFrontMatter'
import { getFolderFromFilename } from '@helpers/folders'
import { clo, logDebug, logError, logInfo, logWarn, JSP, timer } from '@helpers/dev'
import { getStoredWindowRect, getWindowFromCustomId, isHTMLWindowOpen, storeWindowRect } from '@helpers/NPWindows'
import { generateCSSFromTheme, RGBColourConvert } from '@helpers/NPThemeToCSS'
import { isTermInEventLinkHiddenPart, isTermInNotelinkOrURI, isTermInMarkdownPath } from '@helpers/paragraph'
import { RE_EVENT_LINK, RE_SYNC_MARKER, formRegExForUsersOpenTasks } from '@helpers/regex'
import { getTimeBlockString, isTimeBlockLine } from '@helpers/timeblocks'
import { usersVersionHas } from '@helpers/NPVersions'

// ---------------------------------------------------------
// Constants and Types

const pluginJson = 'helpers/HTMLView'

const defaultBorderWidth = 8 // in pixels

// If reuseUsersWindowRect is true, then the window will be resized to the user's saved window rect. If this is not available, then use x/y/width/height if available, or failing that use paddingWidth/paddingHeight to fill the screen other than this padding.
// (This is useful when we don't know user's screen dimensions.)

// Note: This is a *superset* of window options required for the different API calls (showWindow, showWindowWithOptions, showInMainWindow)
export type HtmlWindowOptions = {
  windowTitle?: string,
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
  paddingWidth?: number,
  paddingHeight?: number,
  reuseUsersWindowRect?: boolean,
  includeCSSAsJS?: boolean,
  shouldFocus?: boolean,
  // TODO: work out which of these 3 are actually needed, and remove the rest:
  id?: string,
  windowId?: string,
  customId?: string,
  // New in 3.20 for loading into main window:
  showInMainWindow?: boolean,
  splitView?: boolean, // only usde if showInMainWindow is true
  icon?: string, // only used if showInMainWindow is true
  iconColor?: string, // only used if showInMainWindow is true
  autoTopPadding?: boolean, // only used if showInMainWindow is true
  showReloadButton?: boolean, // only used if showInMainWindow is true
}


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
  // logDebug(`getCallbackCodeString: (generated using getCallbackCodeString), use "${commandName}" to send data to NP, and use a func named <returnPathFuncName> to receive data back from NP`)
  // Note: could use "runCode()" as shorthand for the longer postMessage version below, but it does the same thing
  // "${returnPathFuncName}" was the onHandle, but since that function doesn't really do anything, I'm not sending it
  return `
    console.log(\`${jsFunctionName}: (generated using getCallbackCodeString) "\$\{commandName\}" to send data to NP, and use a func named "\$\{returnPathFuncName\}" to receive data back from NP\`)
    // This is a callback bridge from HTML to the plugin
    const ${jsFunctionName} = (commandName = "${commandName}", pluginID = "${pluginID}", commandArgs = []) => {
      // const code = ${haveNotePlanExecute}.replace("%%commandName%%",commandName).replace("%%pluginID%%",pluginID).replace("%%commandArgs%%", ()=>JSON.stringify(commandArgs));
          const code = \`${haveNotePlanExecute}\`
            .replace("%%commandName%%", commandName)
            .replace("%%pluginID%%", pluginID)
            .replace("%%commandArgs%%", () => JSON.stringify(commandArgs)); //This is important because it works around problems with $$ in commandArgs
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
 * Convert a note's content to HTML and include any images as base64
 * @param {string} content
 * @param {TNote} Note
 * @returns {string} HTML
 */
export async function getNoteContentAsHTML(content: string, note: TNote): Promise<string> {
  try {
    let lines = content?.split('\n') ?? []

    let hasFrontmatter = hasFrontMatter(content ?? '')
    const RE_OPEN_TASK_FOR_USER = formRegExForUsersOpenTasks(false)

    // Work on a copy of the note's content
    // Change frontmatter for this note (if present)
    // In particular remove trigger line
    if (hasFrontmatter) {
      let titleAsMD = ''
      // look for 2nd '---' and double it, because of showdown bug
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].match(/^title:\s/)) {
          titleAsMD = lines[i].replace('title:', '#')
          logDebug('getNoteContentAsHTML', `removing title line ${String(i)}`)
          lines.splice(i, 1)
        }
        if (lines[i].trim() === '---') {
          lines.splice(i, 0, '') // add a blank before second HR to stop it acting as an ATX header line
          lines.splice(i + 2, 0, titleAsMD) // add the title (as MD)
          break
        }
      }

      // If we now have empty frontmatter (so, just 3 sets of '---'), then remove them all
      if (lines[0] === '---' && lines[1] === '' && lines[2] === '---') {
        lines.splice(0, 3)
        hasFrontmatter = false
      }
    }

    // Make some necessary changes before conversion to HTML
    for (let i = 0; i < lines.length; i++) {
      // remove any sync link markers (blockIds)
      lines[i] = lines[i].replace(/\^[A-z0-9]{6}([^A-z0-9]|$)/g, '').trimRight()

      // change open tasks to GFM-flavoured task syntax
      const res = lines[i].match(RE_OPEN_TASK_FOR_USER)
      if (res) {
        lines[i] = lines[i].replace(res[0], '- [ ]')
      }
    }

    // Make this proper Markdown -> HTML via showdown library
    // Set some options to turn on various more advanced HTML conversions (see actual code at https://github.com/showdownjs/showdown/blob/master/src/options.js#L109):
    const converterOptions = {
      emoji: true,
      footnotes: true,
      ghCodeBlocks: true,
      strikethrough: true,
      tables: true,
      tasklists: true,
      metadata: false, // otherwise metadata is swallowed
      requireSpaceBeforeHeadingText: true,
      simpleLineBreaks: true // Makes this GFM style. TODO: make an option?
    }
    const converter = new showdown.Converter(converterOptions)
    let body = converter.makeHtml(lines.join(`\n`))
    body = `<style>img { background: white; max-width: 100%; max-height: 100%; }</style>${body}` // fix for bug in showdown
    
    const imgTagRegex = /<img src=\"(.*?)\"/g
    const matches = [...body.matchAll(imgTagRegex)]
    const noteDirPath = getFolderFromFilename(note.filename)
    
    for (const match of matches) {
      const imagePath = match[1]
      try {
        // Handle both absolute and relative paths
        let fullPath = `../../../Notes/${noteDirPath}/${decodeURI(imagePath)}`
        if(fullPath.endsWith('.drawing')) {
          fullPath = fullPath.replace('.drawing', '.png')
        }
        const data = await DataStore.loadData(fullPath, false)
        if (data) {
          const base64Data = `data:image/png;base64,${data.toString('base64')}`
          body = body.replaceAll(imagePath, base64Data)
        }
      } catch (err) {
        logWarn('getNoteContentAsHTML', `Failed to load image "${imagePath}". Error: ${err.message}`)
      }
    }

    // TODO: Ideally build a frontmatter styler extension (to use above) but for now ...
    // Tweak body output to put frontmatter in a box if it exists
    if (hasFrontmatter) {
      // replace first '<hr />' with start of div
      body = body.replace('<hr />', '<div class="frontmatter">')
      // replace what is now the first '<hr />' with end of div
      body = body.replace('<hr />', '</div>')
    }
    // logDebug(pluginJson, body)

    // Make other changes to the HTML to cater for NotePlan-specific syntax
    lines = body.split('\n')
    const modifiedLines = []
    for (let line of lines) {
      const origLine = line

      // Display hashtags with .hashtag style
      line = convertHashtagsToHTML(line)

      // Display mentions with .attag style
      line = convertMentionsToHTML(line)

      // Display highlights with .highlight style
      line = convertHighlightsToHTML(line)

      // Replace [[notelinks]] with just underlined notelink
      const captures = line.match(/\[\[(.*?)\]\]/)
      if (captures) {
        // clo(captures, 'results from [[notelinks]] match:')
        for (const capturedTitle of captures) {
          line = line.replace(`[[${capturedTitle}]]`, `~${capturedTitle}~`)
        }
      }
      // Display underlining with .underlined style
      line = convertUnderlinedToHTML(line)

      // Remove any blockIDs
      line = line.replace(RE_SYNC_MARKER, '')

      if (line !== origLine) {
        logDebug('getNoteContentAsHTML', `modified {${origLine}} -> {${line}}`)
      }
      modifiedLines.push(line)
    }
    return modifiedLines.join('\n')

  } catch (error) {
    logError('getNoteContentAsHTML', error.message)
    return '<conversion error>'
  }
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
  const preBody: Array<Object> = opts.preBodyScript ? (Array.isArray(opts.preBodyScript) ? opts.preBodyScript : [opts.preBodyScript]) : []
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
function assembleHTMLParts(body: string, title: string, winOpts: HtmlWindowOptions): string {
  try {
    const fullHTML = []
    fullHTML.push('<!DOCTYPE html>') // needed to let emojis work without special coding
    fullHTML.push('<html>')
    fullHTML.push('<head>')
    fullHTML.push(`<title>${title}</title>`)
    fullHTML.push(`<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, maximum-scale=1, viewport-fit=cover">`)
    const preScript = generateScriptTags(winOpts.preBodyScript ?? '')
    if (preScript !== '') {
      fullHTML.push(preScript) // dbw moved to top because we need the logging bridge to be loaded before any content which could have errors
    }
    fullHTML.push(winOpts.headerTags ?? '')
    fullHTML.push('<style type="text/css" title="Original Theme Styles">')
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
 * Helper function to construct HTML and decide how and where to show it in a window. (Replaces showHTML() which was deprecated in v3.9.6.)
 * Most data comes via an opts object, to ease future expansion.
 * Adds ability to automatically display (floating) windows at the last position and size that the user had left them at. To enable this:
 * - set opts.reuseUsersWindowRect to true
 * - supply a opts.customId to distinguish which window this is to the plugin (e.g. 'review-list'). I suggest this is lower-case-with-dashes. (If customId not passed, it will fall back to using opts.windowTitle instead.)
 * - (optional) still supply default opts.width and opts.height to use the first time
 * Under the hood it saves the windowRect to local preference "<plugin.id>.<customId>".
 * Note: Could allow for style file via saving arbitrary data file, and have it triggered on theme change.
 * @author @jgclark
 * @param {string} body
 * @param {HtmlWindowOptions} opts
 */
export async function showHTMLV2(body: string, opts: HtmlWindowOptions): Promise<boolean> {
  try {
    const screenWidth = NotePlan.environment.screenWidth
    const screenHeight = NotePlan.environment.screenHeight
    logDebug('HTMLView / showHTMLV2', `starting with customId ${opts.customId ?? ''} and reuseUsersWindowRect ${String(opts.reuseUsersWindowRect) ?? '??'} for screen dimensions ${screenWidth}x${screenHeight}`)

    // Assemble the parts of the HTML into a single string
    const fullHTMLStr = assembleHTMLParts(body, opts.windowTitle ?? '', opts)

    // Ensure we have a window ID to use
    const cId = opts.customId ?? opts.windowTitle ?? 'fallback'

    // Before showing anything, see if the window is already open, and if so save its x/y/w/h (if requested)
    if (isHTMLWindowOpen(cId)) {
      logDebug('showHTMLV2', `Window is already open, and will save its x/y/w/h`)
      storeWindowRect(cId)
    }

    // Decide which of the appropriate functions to call
    if (opts.makeModal) {
      logDebug('showHTMLV2', `Using modal 'sheet' view for ${NotePlan.environment.buildVersion} build on ${NotePlan.environment.platform}`)
      HTMLView.showSheet(fullHTMLStr, opts.width, opts.height)
      return true
    } else {
      // Make a normal non-modal window
      let winOptions: HtmlWindowOptions = {}

      // First set to the values set in the opts object, using x/y/w/h if available, or if not, then use paddingWidth/paddingHeight to fill the screen other than this padding.
      winOptions = {
        x: opts.x ?? (screenWidth - (screenWidth - (opts.paddingWidth ?? 0) * 2)) / 2,
        y: opts.y ?? (screenHeight - (screenHeight - (opts.paddingHeight ?? 0) * 2)) / 2,
        width: opts.width ?? (screenWidth - (opts.paddingWidth ?? 0) * 2),
        height: opts.height ?? (screenHeight - (opts.paddingHeight ?? 0) * 2),
        shouldFocus: opts.shouldFocus,
        id: cId, // TODO: don't need both ... but trying to work out which is the current one for the API
        windowId: cId,
      }
      if ('showInMainWindow' in opts) {
        // $FlowFixMe[prop-missing] - splitView is an optional property in HtmlWindowOptions, and flow doesn't like it
        winOptions.splitView = ("splitView" in opts) ? opts.splitView : false
        // $FlowFixMe[prop-missing] - as above
        winOptions.icon = ("icon" in opts) ? opts.icon : ''
        // $FlowFixMe[prop-missing] - as above
        winOptions.iconColor = ("iconColor" in opts) ? opts.iconColor : ''
        // $FlowFixMe[prop-missing] - as above
        winOptions.autoTopPadding = ("autoTopPadding" in opts) ? opts.autoTopPadding : true
        // $FlowFixMe[prop-missing] - as above
        winOptions.showReloadButton = ("showReloadButton" in opts) ? opts.showReloadButton : false
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
        }
      }
      clo(winOptions, 'showHTMLV2 using winOptions:')

      // Test to see if requested window dimensions would exceed screen dimensions; if so reduce them accordingly
      logDebug('showHTMLV2', `- screen dimensions are ${String(screenWidth)} x ${String(screenHeight)} for device ${NotePlan.environment.machineName}`)
      if (winOptions.width > screenWidth) {
        logDebug('showHTMLV2', `- Constrained width from ${String(winOptions.width)} to ${String(screenWidth)}`)
        winOptions.width = screenWidth - defaultBorderWidth * 2
      }
      if (winOptions.height > screenHeight) {
        logDebug('showHTMLV2', `- Constrained height from ${String(winOptions.height)} to ${String(screenHeight)}`)
        winOptions.height = screenHeight - defaultBorderWidth * 2
      }

      // Check window will be visible on screen and if not, move accordingly
      if (winOptions?.x && winOptions.x < 0) {
        winOptions.x = 0
      }
      if (winOptions?.y && winOptions.y < 0) {
        winOptions.y = 0
      }

      let win: HTMLView|TEditor|false
      let success: boolean = false
      if (opts.showInMainWindow && usersVersionHas('showInMainWindow')) {
          logDebug('showHTMLV2', `- Showing in main window with options: ${JSON.stringify(winOptions)}`)
          const mainWindowSpecificOptions = {
            splitView: opts.splitView,
            icon: opts.icon,
            iconColor: opts.iconColor,
            autoTopPadding: opts.autoTopPadding,
            showReloadButton: opts.showReloadButton,
          }
          // clo(mainWindowSpecificOptions, `showHTMLV2 mainWindowSpecificOptions:`)
          const { success: mainViewSuccess, windowID } = await HTMLView.showInMainWindow(fullHTMLStr, opts.windowTitle ?? '', mainWindowSpecificOptions)
          if (mainViewSuccess) {
            success = true
            logDebug('showHTMLV2', `- Main view window opened successfully with ID '${windowID}'`)
            win = getWindowFromCustomId(windowID)
          }
      } else {
        logDebug('showHTMLV2', `- Showing in floating window with options: ${JSON.stringify(winOptions)}`)
        win = await HTMLView.showWindowWithOptions(fullHTMLStr, opts.windowTitle ?? '', winOptions)
        if (win) {
          logDebug('showHTMLV2', `- Window opened successfully with ID '${win.id}'`)
          success = true
        }
      }

      // If wanted, also write this HTML to a file so we can work on it offline.
      // Note: this is saved to the Plugins/Data/<Plugin> folder, not a user-accessible Note.
      if (opts.savedFilename !== '') {
        const thisFilename = opts.savedFilename ?? ''
        const filenameWithoutSpaces = thisFilename.split(' ').join('') ?? ''
        // Write to specified file in NP sandbox
        const res = DataStore.saveData(fullHTMLStr, filenameWithoutSpaces, true)
        if (res) {
          logDebug('showHTMLV2', `- Saved copy of HTML for '${opts.windowTitle ?? '?'}' to ${thisFilename}`)
        } else {
          logError('showHTMLV2', `- Couldn't save resulting HTML for '${opts.windowTitle ?? '?'}' to ${thisFilename}.`)
        }
      }

      // Note: the customId for this window is set by NP.
      // Double-check: read back from the window itself
      if (win) {
        logDebug('showHTMLV2', `- Window has customId:'${win?.customId || ''}' / id:"${win?.id || ''}" / success:${String(success)}`)
        return success
      } else {
        logError('showHTMLV2', `- Window customID not found after opening`)
        return false
      }
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
 * @tests in jest file
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
export async function sendToHTMLWindow(
  windowId: string,
  actionType: string,
  data: any = {},
  updateInfo: string = '',
): Promise<any> {
  try {
    const windowExists = isHTMLWindowOpen(windowId)
    if (!windowExists) logWarn(`sendToHTMLWindow`, `Window ${windowId} does not exist; setting NPWindowID = undefined`)
    const windowIdToSend = windowExists ? windowId : undefined // for iphone/ipad you have to send undefined
    const dataWithUpdated = {
      ...data,
      ...{
        lastUpdated: {
          msg: `${actionType}${updateInfo ? ` ${updateInfo}` : ''}`,
          date: new Date().toLocaleString()
        },
      },
      NPWindowID: windowExists ? windowId : undefined,
    }
    // logDebug(`Bridge::sendToHTMLWindow`, `sending type:"${actionType}" payload=${JSON.stringify(data, null, 2)}`)
    // logDebug(`Bridge::sendToHTMLWindow`, `sending type: "${actionType}" to window: "${windowId}" msg=${dataWithUpdated.lastUpdated.msg}`)
    // const start = new Date()
    const result = await HTMLView.runJavaScript(
      `window.postMessage(
        {
          type: '${actionType}',
          payload: ${JSON.stringify(dataWithUpdated)}
        },
        '*'
      );`,
      windowIdToSend,
    )
    // logDebug(`Bridge::sendToHTMLWindow`, `${actionType} took ${timer(start)}`)
    // logDebug(`Bridge::sendToHTMLWindow`, `result from the window: ${JSON.stringify(result)}`)
    return result
  } catch (error) {
    logError(pluginJson, `Bridge::sendToHTMLWindow: ${error.message}`)
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
    // logDebug(pluginJson, `getGlobalSharedData getting var '${varName}' from window ID '${windowId}'`)
    const currentValue = await HTMLView.runJavaScript(`${varName};`, windowId)
    // if (currentValue !== undefined) logDebug(`getGlobalSharedData`, `got ${varName}: ${JSON.stringify(currentValue)}`)
    return currentValue
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Check to see if the theme has changed since we initially drew the window
 * This can happen when your computer goes from light to dark mode or you change the theme
 * We want the dashboard to always match.
 * Note: if/when we get a themeChanged trigger, then this can be simplified.
 * Note: assumes you have a field in pluginData called themeName
 * @param {string} windowID - The ID of the window to check.
 * @param {string} overrideThemeName (optional) - The theme name to check against. If not provided, the current Editor theme will be used.
 * @returns {Promise<boolean>} - true if the theme has changed, false otherwise.
 */
export async function themeHasChanged(windowID: string, overrideThemeName?: string): Promise<boolean> {
  const reactWindowData = await getGlobalSharedData(windowID)
  const { pluginData } = reactWindowData
  const { themeName: themeInWindow } = pluginData

  const currentTheme = overrideThemeName ? overrideThemeName : Editor.currentTheme?.name || null

  if (!currentTheme) {
    logError('themeHasChanged', `Could not find currentTheme: "${currentTheme}", overrideThemeName: "${overrideThemeName || ''}", themeInReactWindow: "${themeInWindow}"`)
    return false
  }
  if (currentTheme !== themeInWindow) {
    logDebug('themeHasChanged', `theme changed from "${themeInWindow}" to "${currentTheme}"`)
    return true
  }
  return false
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
 * Send a warning message to the HTML window (displays a warning message at the top of page). Takes various parameters. Newer version that allows for more easier specifiation of message severity level.
 * @param {string} windowId - the id of the window to send the message to (should be the same as the window's id attribute)
 * @param {string} message - the message to be displayed
 * @param {string} type - the type of the message: 'INFO', 'WARN', 'ERROR', or 'REMOVE'
 * @param {number} timeout (optional) - the number of milliseconds to wait before the message disappears
 */
export async function sendBannerMessage(windowId: string, message: string, type: string, timeout: number = NaN): Promise<any> {
  logDebug(`sendBannerMessage`, `message: ${message}, type: ${type}, timeout: ${timeout}`)
  if (type === 'REMOVE') {
    return await sendToHTMLWindow(windowId, 'REMOVE_BANNER', {}, '')
  }

  let colorClass = 'color-error'
  let borderClass = 'border-error'
  let icon = 'fa-regular fa-circle-exclamation'
  switch (type) {
    case 'INFO':
      colorClass = 'color-info'
      borderClass = 'border-info'
      icon = 'fa-regular fa-circle-info'
      break
    case 'WARN':
      colorClass = 'color-warn'
      borderClass = 'border-warn'
      icon = 'fa-regular fa-triangle-exclamation'
      break
  }
  logDebug(`sendBannerMessage`, `colorClass: ${colorClass}, borderClass: ${borderClass}, icon: ${icon}`)
  return await sendToHTMLWindow(windowId, 'SHOW_BANNER', { type, msg: message, color: colorClass, border: borderClass, icon, timeout }, '')
}

/**
 * add basic ***bolditalic*** styling
 * add basic **bold** or __bold__ styling
 * add basic *italic* or _italic_ styling
 * In each of these, if the text is within a URL, don't add the ***bolditalic*** or **bold** or *italic* styling
 * @param {string} input
 * @returns
 */
export function convertBoldAndItalicToHTML(input: string): string {
  let output = input
  const RE_URL = new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/, 'g')
  const urls = input.match(RE_URL) ?? []
  // clo(urls, 'urls')

  // start with ***bolditalic*** styling
  const RE_BOLD_ITALIC_PHRASE = new RegExp(/\*\*\*\b(.*?)\b\*\*\*/, 'g')
  const BIMatches = output.match(RE_BOLD_ITALIC_PHRASE)
  if (BIMatches) {
    // clo(BIMatches, 'BIMatches')
    const filteredMatches = BIMatches.filter((match) => {
      const index = input.indexOf(match)
      return !urls.some((url) => input.indexOf(url) < index && input.indexOf(url) + url.length > index)
    })
    for (const match of filteredMatches) {
      // logDebug('convertBoldAndItalicToHTML', `- making bold-italic with [${String(match)}]`)
      output = output.replace(match, `<b><em>${match.slice(3, match.length - 3)}</em></b>`)
    }
  }

  // add basic **bold** or __bold__ styling
  // Use word boundaries for underscore-based bold formatting to ignore underscores in middle of words
  const RE_BOLD_PHRASE = new RegExp(/(\*\*|\b__)([^_*]+?)\1/, 'g')
  const boldMatches = output.match(RE_BOLD_PHRASE)
  if (boldMatches) {
    // clo(boldMatches, 'boldMatches')
    const filteredMatches = boldMatches.filter((match) => {
      const index = input.indexOf(match)
      return !urls.some((url) => input.indexOf(url) < index && input.indexOf(url) + url.length > index)
    })
    for (const match of filteredMatches) {
      // logDebug('convertBoldAndItalicToHTML', `- making bold with [${String(match)}]`)
      output = output.replace(match, `<b>${match.slice(2, match.length - 2)}</b>`)
    }
  }

  // add basic *italic* or _italic_ styling
  // Note: uses a simplified regex that needs to come after bold above
  // Use word boundaries for underscore-based italic formatting to ignore underscores in middle of words
  const RE_ITALIC_PHRASE = new RegExp(/(\*|\b_)([^*]+?)\1/, 'g')
  const italicMatches = output.match(RE_ITALIC_PHRASE)
  if (italicMatches) {
    // clo(italicMatches, 'italicMatches')
    const filteredMatches = italicMatches.filter((match) => {
      const index = input.indexOf(match)
      return !urls.some((url) => input.indexOf(url) < index && input.indexOf(url) + url.length > index)
    })
    for (const match of filteredMatches) {
      // logDebug('convertBoldAndItalicToHTML', `- making italic with [${String(match)}]`)
      output = output.replace(match, `<em>${match.slice(1, match.length - 1)}</em>`)
    }
  }
  // logDebug('convertBoldAndItalicToHTML', `-> ${output}`)
  return output
}

// Simplify NP event links
// of the form `![📅](2023-01-13 18:00:::F9766457-9C4E-49C8-BC45-D8D821280889:::NA:::Contact X about Y:::#63DA38)`
export function simplifyNPEventLinksForHTML(input: string): string {
  try {
  let output = input
  const captures = output.match(RE_EVENT_LINK)
  if (captures) {
    clo(captures, 'results from NP event link matches:')
    // Matches come in threes (plus full match), so process four at a time
    for (let c = 0; c < captures.length; c = c + 3) {
      const eventLink = captures[c]
      const eventTitle = captures[c + 1]
      const eventColor = captures[c + 2]
      output = output.replace(eventLink, `<i class="fa-light fa-calendar" style="color: ${eventColor}"></i> <span class="event-link">${eventTitle}</span>`)
    }
  }
    // logDebug('simplifyNPEventLinksForHTML', `{${input}} -> {${output}}`)
    return output
  } catch (error) {
    logError(pluginJson, `simplifyNPEventLinksForHTML: ${error.message}`)
    return input
  }
}

// Simplify embedded images of the form ![image](...) by replacing with an icon.
// (This also helps remove false positives for ! priority indicator)
export function simplifyInlineImagesForHTML(input: string): string {
  try {
  let output = input
  const captures = output.match(/!\[image\]\([^\)]+\)/g)
  if (captures) {
    // clo(captures, 'results from embedded image match:')
    for (const capture of captures) {
      // logDebug(`simplifyInlineImagesForHTML`, capture)
      output = output.replace(capture, `<i class="fa-regular fa-image"></i> `)
      // logDebug(`simplifyInlineImagesForHTML`, `-> ${output}`)
    }
  }
    // logDebug('simplifyInlineImagesForHTML', `{${input}} -> {${output}}`)
    return output
  } catch (error) {
    logError(pluginJson, `simplifyInlineImagesForHTML: ${error.message}`)
    return input
  }
}

/**
 * Display hashtags with .hashtag style. Now includes multi-part hashtags (e.g. #one/two/three)
 * Ignores hashtag-like strings in URLs, markdown links, and event links.
 * Now also ignores CSS style definitions (e.g.`style="color: #1BADF8"`)
 * Note: need to make only one capture group, and use 'g'lobal flag.
 * @param {string} input
 * @returns {string}
 */
export function convertHashtagsToHTML(input: string): string {
  try {
    // const RE_HASHTAG_G = new RegExp(/(\s|^|\"|\'|\(|\[|\{)(?!#[\d[:punct:]]+(\s|$))(#([^[:punct:]\s]|[\-_\/])+?\(.*?\)|#([^[:punct:]\s]|[\-_\/])+)/, 'g') // regex from @EduardMe's file
    // const RE_HASHTAG_G = new RegExp(/(\s|^|\"|\'|\(|\[|\{)(?!#[\d\'\"]+(\s|$))(#([^\'\"\s]|[\-_\/])+?\(.*?\)|#([^\'\"\s]|[\-_\/])+)/, 'g') // regex from @EduardMe's file without :punct:
    // now copes with Unicode characters, with help from https://stackoverflow.com/a/74926188/3238281
    const RE_HASHTAG_G = new RegExp(/\B(?:#|＃)((?![\p{N}_\/\-]+(?:$|\s|\b))(?:[\p{L}\p{M}\p{N}_\/\-]{1,60}))/, 'gu')
    const matches = input.match(RE_HASHTAG_G)
    let output = input
    if (matches) {
      // logDebug('convertHashtagsToHTML', `results from hashtag matches: ${String(matches)}`)
      for (const match of matches) {
        // logDebug('convertHashtagsToHTML', `- match: ${String(match)}`)
        if (isTermInNotelinkOrURI(match, output) || isTermInMarkdownPath(match, output) || isTermInEventLinkHiddenPart(match, output) || isTermAColorStyleDefinition(match, output)
        ) { continue }
        output = output.replace(match, `<span class="hashtag">${match}</span>`)
      }
    }
    // logDebug('convertHashtagsToHTML', `{${input}} -> {${output}}`)
    return output
  } catch (error) {
    logError(pluginJson, `convertHashtagsToHTML: ${error.message}`)
    return input
  }
}


function isTermAColorStyleDefinition(term: string, input: string): boolean {
  const RE_CSS_STYLE_DEFINITION = new RegExp(`style="color:\\s*${term}"`, "i")
  return RE_CSS_STYLE_DEFINITION.test(input)
}

/**
 * Display mentions with .attag style. Now includes also parts in brackets directly after it.
 * Ignores mention-like strings in URLs, markdown links, and event links.
 * Note: need to make only one capture group, and use 'g'lobal flag.
 * @param {string} input
 * @returns {string}
 */
export function convertMentionsToHTML(input: string): string {
  try {
    let output = input
    // regex from @EduardMe's file
    // const RE_MENTION_G = new RegExp(/(\s|^|\"|\'|\(|\[|\{)(?!@[\d[:punct:]]+(\s|$))(@([^[:punct:]\s]|[\-_\/])+?\(.*?\)|@([^[:punct:]\s]|[\-_\/])+)/, 'g')
    // regex from @EduardMe's file, without [:punct:]
    // const RE_MENTION_G = new RegExp(/(\s|^|\"|\'|\(|\[|\{)(?!@[\d\`\"]+(\s|$))(@([^\`\"\s]|[\-_\/])+?\(.*?\)|@([^\`\"\s]|[\-_\/])+)/, 'g') 
    // now copes with Unicode characters, with help from https://stackoverflow.com/a/74926188/3238281
    const RE_MENTION_G = new RegExp(/\B@((?![\p{N}_]+(?:$|\s|\b))(?:[\p{L}\p{M}\p{N}_\/\-]{1,60})(\(.*?\))?)/, 'gu')
    const matches = input.match(RE_MENTION_G)
    if (matches) {
      // logDebug('convertMentionsToHTML', `results from mention matches: ${String(matches)}`)
      for (const match of matches) {
        // logDebug('convertMentionsToHTML', `- match: ${String(match)}`)
        if (isTermInNotelinkOrURI(match, output) || isTermInMarkdownPath(match, output) || isTermInEventLinkHiddenPart(match, output)) { continue }
        output = output.replace(match, `<span class="attag">${match}</span>`)
      }
    }
    // logDebug('convertMentionsToHTML', `{${input}} -> {${output}}`)
    return output
  } catch (error) {
    logError(pluginJson, `convertMentionsToHTML: ${error.message}`)
    return input
  }
}

/**
 * Convert markdown `pre-formatted` fragments to HTML with .code class
 * @param {string} input
 * @returns {string}
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

/**
 * Display time blocks with .timeBlock style
 * Note: uses definition of time block syntax from plugin helpers, not directly from NP itself. So it may vary slightly.
 * WARNING: can't be used from React, as this calls a DataStore function
 * @param {string} input
 * @param {string} timeblockTextMustContainString (optional)
 * @returns {string}
 */
export function convertTimeBlockToHTML(input: string, timeblockTextMustContainString: string = ''): string {
  let output = input
  if (isTimeBlockLine(input, timeblockTextMustContainString)) {
    const timeBlockPart = getTimeBlockString(input)
    // logDebug('convertTimeBlockToHTML', `found time block '${timeBlockPart}'`)
    output = output.replace(timeBlockPart, `<span class="timeBlock">${timeBlockPart}</span>`)
  }
  return output
}

// Change markdown ~underlined~ to HTML with .underlined style
// Ignores ~ in URLs
export function convertUnderlinedToHTML(input: string): string {
  let output = input
  const captures = output.match(/~[^~]*?~/g)
  if (captures) {
    // clo(captures, 'results from underlined matches:')
    for (const capture of captures) {
      // Check if the capture is part of a URL (either markdown links or HTML anchor tags)
      const isInMarkdownURL = new RegExp(`\\[.*?\\]\\(.*?${capture}.*?\\)`).test(input)
      const isInHTMLURL = new RegExp(`<a[^>]*href=["'][^"']*${capture}[^"']*["'][^>]*>`).test(input)
      if (!isInMarkdownURL && !isInHTMLURL) {
        const match = capture
        output = output.replace(match, `<span class="underlined">${match.slice(1, -1)}</span>`)
      }
    }
  }
  return output
}

// Display strike text with .strikethrough style
// Ignores ~~ in URLs
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

/**
 * Replace blockID sync indicator with icon
 * Note: needs to go after #hashtag change above, as it includes a # marker for colors.
 * @param {string} input
 * @returns {string}
 */
export function convertNPBlockIDToHTML(input: string): string {
  let output = input
  const captures = output.match(RE_SYNC_MARKER)
  if (captures) {
    // clo(captures, 'results from RE_SYNC_MARKER match:')
    for (const capture of captures) {
      output = output.replace(capture, `<i class="fa-solid fa-asterisk" style="color: var(--block-id-color);"></i>`)
    }
  }
  return output
}

/**
 * Make HTML for a real button that is used to call a plugin's command, by sending params for a invokePluginCommandByName() call
 * Note: follows earlier makeRealCallbackButton()
 * @param {string} buttonText to display on button
 * @param {string} pluginName of command to call
 * @param {string} commandName to call when button is 'clicked'
 * @param {string} commandArgs (may be empty)
 * @param {string?} tooltipText to hover display next to button
 * @param {boolean} nativeTooltips use native browser tooltips (default: false)
 * @returns {string}
 */
export function makePluginCommandButton(
  buttonText: string,
  pluginName: string,
  commandName: string,
  commandArgs: string,
  tooltipText: string = '',
  nativeTooltips: boolean = false,
): string {
  const output = tooltipText
    ? nativeTooltips
      ? `<button class="PCButton" title="${tooltipText}" data-plugin-id="${pluginName}" data-command="${commandName}" data-command-args="${String(
          commandArgs,
        )}">${buttonText}</button>`
      : `<button class="PCButton tooltip" data-tooltip="${tooltipText}" data-plugin-id="${pluginName}" data-command="${commandName}" data-command-args="${String(
          commandArgs,
        )}">${buttonText}</button>`
    : `<button class="PCButton" data-plugin-id="${pluginName}" data-command="${commandName}" data-command-args="${commandArgs}" >${buttonText}</button>`
  return output
}
