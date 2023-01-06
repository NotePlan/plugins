// @flow
// ---------------------------------------------------------
// HTML helper functions for use with HTMLView API
// by @jgclark
// Last updated 10.10.2022
// ---------------------------------------------------------

import { clo, logDebug, logError, logWarn } from '@helpers/dev'
const pluginJson = 'helpers/HTMLView'

let baseFontSize = 14

/**
 * Generate CSS instructions from the given theme (or current one if not given, or 'dark' theme if that isn't available) to use as an embedded style sheet.
 * Note: used to have 'if (NotePlan.environment.buildVersion > 849) {}' to check we are on 3.6.2+ which means we can get current theme name. Hopefully no longer needed.
 * @author @jgclark
 * @param {string?} themeNameIn
 * @returns {string} outputCSS
 */
export function generateCSSFromTheme(themeNameIn: string = ''): string {
  try {
    let themeName = ''
    let themeJSON: Object
    const availableThemeNames = Editor.availableThemes.map((m) => (m.name.endsWith('.json') ? m.name.slice(0, -5) : m.name))
    let matchingThemeObjs = []

    // If we havee a supplied themeName, then attempt to use it
    if (themeNameIn !== '') {
      // get list of available themes
      logDebug('generateCSSFromTheme', String(availableThemeNames))
      matchingThemeObjs = Editor.availableThemes.filter((f) => f.name === themeNameIn)
      if (matchingThemeObjs.length > 0) {
        themeName = themeNameIn
        logDebug('generateCSSFromTheme', `Reading theme '${themeName}'`)
        themeJSON = matchingThemeObjs[0].values
      } else {
        logWarn('generateCSSFromTheme', `Theme '${themeNameIn}' is not in list of available themes. Will try to use current theme instead.`)
      }
    }

    // If that hasn't worked, they currentTheme
    if (themeName === '') {
      themeName = Editor.currentTheme.name ?? ''
      themeName = themeName.endsWith('.json') ? themeName.slice(0, -5) : themeName
      logDebug('generateCSSFromTheme', `Reading your current theme '${themeName}'`)
      if (themeName !== '') {
        themeJSON = Editor.currentTheme.values
        // let currentThemeMode = Editor.currentTheme.mode ?? 'dark'
      } else {
        logWarn('generateCSSFromTheme', `Cannot get settings for your current theme '${themeName}'`)
      }
    }

    // If that hasn't worked, try dark theme
    if (themeName === '') {
      themeName = String(DataStore.preference('themeDark'))
      themeName = themeName.endsWith('.json') ? themeName.slice(0, -5) : themeName
      matchingThemeObjs = Editor.availableThemes.filter((f) => f.name === themeName)
      if (matchingThemeObjs.length > 0) {
        logDebug('generateCSSFromTheme', `Reading your dark theme '${themeName}'`)
        themeJSON = matchingThemeObjs[0].values
      } else {
        logWarn('generateCSSFromTheme', `Cannot get settings for your dark theme '${themeName}'`)
      }
    }

    // Check we can proceed
    if (themeJSON == null || themeJSON.length === 0) {
      logError('generateCSSFromTheme', `themeJSON is empty. Stopping.`)
      return ''
    }

    //-----------------------------------------------------
    // Calculate the CSS properties for various selectors
    const output: Array<string> = []
    let tempSel = []
    const rootSel = [] // for special :root selector which sets variables picked up in several places below
    let styleObj: Object
    const isLightTheme = themeJSON.style === 'Light'

    // Set 'html':
    // - main font size
    // set global variable
    baseFontSize = Number(DataStore.preference('fontSize')) ?? 14
    // tempSel.push(`color: ${themeJSON.styles.body.color ?? "#DAE3E8"}`)
    tempSel.push(`background: ${themeJSON.editor.backgroundColor ?? '#1D1E1F'}`)
    output.push(makeCSSSelector('html', tempSel))
    // rootSel.push(`--fg-main-color: ${themeJSON.styles.body.color ?? "#DAE3E8"}`)
    rootSel.push(`--bg-main-color: ${themeJSON.editor.backgroundColor ?? '#1D1E1F'}`)

    // Set body:
    // - main font = styles.body.font)
    // const bodyFont = translateFontNameNPToCSS(themeJSON.styles.body.font)
    // - main foreground colour (styles.body.color)
    // - main background colour (editor.backgroundColor)
    tempSel = []
    styleObj = themeJSON.styles.body
    if (styleObj) {
      const thisColor = RGBColourConvert(themeJSON.editor.textColor ?? '#CC6666')
      tempSel.push(`color: ${thisColor}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('body', tempSel))
      rootSel.push(`--fg-main-color: ${RGBColourConvert(themeJSON.editor.textColor)}` ?? '#CC6666')
    }

    // Set H1 (styles.title1)
    tempSel = []
    styleObj = themeJSON.styles.title1
    if (styleObj) {
      const thisColor = RGBColourConvert(themeJSON.styles.title1.color ?? '#CC6666')
      tempSel.push(`color: ${thisColor}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('h1', tempSel))
      rootSel.push(`--h1-color: ${thisColor}`)
    }
    // Set H2 similarly
    tempSel = []
    styleObj = themeJSON.styles.title2
    if (styleObj) {
      const thisColor = RGBColourConvert(themeJSON.styles.title2.color ?? '#E9C062')
      tempSel.push(`color: ${thisColor}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('h2', tempSel))
      rootSel.push(`--h2-color: ${thisColor}`)
    }
    // Set H3 similarly
    tempSel = []
    styleObj = themeJSON.styles.title3
    if (styleObj) {
      const thisColor = RGBColourConvert(themeJSON.styles.title3.color ?? '#E9C062')
      tempSel.push(`color: ${thisColor}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('h3', tempSel))
      rootSel.push(`--h3-color: ${thisColor}`)
    }
    // Set H4 similarly
    tempSel = []
    styleObj = themeJSON.styles.title4
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(themeJSON.styles.title4.color ?? '#E9C062')}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('h4', tempSel))
    }
    // NP doesn't support H5 styling

    // Set core table features from theme
    const altColor = RGBColourConvert(themeJSON.editor?.altBackgroundColor) ?? '#2E2F30'
    const tintColor = RGBColourConvert(themeJSON.editor?.tintColor) ?? '#E9C0A2'
    // output.push(makeCSSSelector('table th', [`background-color: ${altColor}`]))
    output.push(makeCSSSelector('tbody > tr:nth-child(odd)', [`background-color: ${altColor}`])) // i.e. won't apply to rows in thead
    rootSel.push(`--bg-alt-color: ${altColor}`)
    output.push(makeCSSSelector('table tbody tr:first-child', [`border-top: 1px solid ${tintColor}`]))
    output.push(makeCSSSelector('table tbody tr:last-child', [`border-bottom: 1px solid ${RGBColourConvert(themeJSON.editor?.tintColor)}` ?? '1px solid #E9C0A2']))
    rootSel.push(`--tint-color: ${tintColor}`)

    // Set core button style from macOS based on dark or light:
    // Similarly for fake-buttons (i.e. from <a href ...>)
    if (isLightTheme) {
      output.push(makeCSSSelector('button',
        ['background-color: #FFFFFF',
          'font-size: 1.0rem',
          'font-weight: 500']))
      output.push(makeCSSSelector('.fake-button a',
        ['background-color: #FFFFFF',
//          'font-size: 1.0rem',
          'font-weight: 500',
          'text-decoration: none',
          'border-color: #DFE0E0',
          'border-radius: 4px',
          'box-shadow: 0 1px 1px #CBCBCB',
          'padding: 1px 7px 1px 7px',
          'margin: 2px 4px']))
    }
    else { // dark theme
      output.push(makeCSSSelector('button',
        ['background-color: #5E5E5E',
          'font-size: 1.0rem',
          'font-weight: 500']))
      output.push(makeCSSSelector('.fake-button a',
        ['background-color: #5E5E5E',
          'font-size: 1.0rem',
          'font-weight: 500',
          'text-decoration: none',
          'border-color: #5E5E5E',
          'border-radius: 4px',
          'box-shadow: 0 -1px 1px #6F6F6F',
          'padding: 1px 7px 1px 7px',
          'margin: 1px 4px',
        ]),
      )
    }

    // Set bold text if present
    tempSel = []
    styleObj = themeJSON.styles.bold
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color ?? '#CC6666')}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('b', tempSel))
    }
    // Set italic text if present
    tempSel = []
    styleObj = themeJSON.styles.italic
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color ?? '#96CBFE')}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('i', tempSel))
    }
    // Can't easily set bold-italic in CSS ...

    // Set class for completed tasks ('checked') if present
    tempSel = []
    styleObj = themeJSON.styles.checked
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color ?? '#098308A0')}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('.checked', tempSel))
    }

    // Set class for cancelled tasks ('checked-canceled') if present
    // following is workaround in object handling as 'checked-canceled' JSON property has a dash in it
    tempSel = []
    styleObj = themeJSON.styles['checked-canceled']
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color ?? '#E04F57A0')}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('.cancelled', tempSel))
    }

    // Set class for scheduled tasks ('checked-scheduled') if present
    // following is workaround in object handling as 'checked-canceled' JSON property has a dash in it
    tempSel = []
    styleObj = themeJSON.styles['checked-scheduled']
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color ?? '#7B7C86A0')}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('.task-scheduled', tempSel))
    }

    // Now put the important info and rootSel at the start of the output
    output.unshift(makeCSSSelector(':root', rootSel))
    output.unshift(`/* Generated by @jgclark's translateFontNameNPToCSS from NotePlan theme '${themeName}' by jgc */`)

    // logDebug('generateCSSFromTheme', `Generated CSS:\n${output.join('\n')}`)
    return output.join('\n')
  } catch (error) {
    logError('generateCSSFromTheme', error.message)
    return '<error>'
  }
}

/**
 * Convert NotePlan Theme style information to CSS equivalent(s)
 * @author @jgclark
 * @param {Object} style object from JSON theme
 * @returns {Array} CSS elements
 */
function convertStyleObjectBlock(styleObject: any): Array<string> {
  let cssStyleLinesOutput: Array<string> = []
  if (styleObject?.size) {
    cssStyleLinesOutput.push(`font-size: ${pxToRem(styleObject?.size, baseFontSize)}`)
  }
  if (styleObject?.paragraphSpacingBefore) {
    cssStyleLinesOutput.push(`line-height: ${pxToRem(styleObject?.paragraphSpacingBefore, baseFontSize)}`)
    // `padding-top: ${themeJSON.styles.body.paragraphSpacingBefore}` ?? "0" + 'px', // TODO:
  }
  if (styleObject?.paragraphSpacing) {
    cssStyleLinesOutput.push(`padding-bottom: ${pxToRem(styleObject?.paragraphSpacing, baseFontSize)}`)
    // `padding-bottom: ${themeJSON.styles.body.paragraphSpacing}` ?? "6" + 'px', // TODO:
  }
  if (styleObject?.font) {
    cssStyleLinesOutput = cssStyleLinesOutput.concat(fontPropertiesFromNP(styleObject?.font))
  }
  if (styleObject?.strikethroughStyle) {
    cssStyleLinesOutput.push(textDecorationFromNP('strikethroughStyle', Number(styleObject?.strikethroughStyle)))
  }
  if (styleObject?.underlineStyle) {
    cssStyleLinesOutput.push(textDecorationFromNP('underlineStyle', Number(styleObject?.underlineStyle)))
  }
  return cssStyleLinesOutput
}

/**
 * Convert NP strikethrough/underline styling to CSS setting (or empty string if none)
 * Full details at https://help.noteplan.co/article/48-strikethrough-underline-styles
 * @author @jgclark
 * @param {string} selector to use from NP
 * @param {number} value to use from NP
 * @returns {string} CSS setting to return
 */
export function textDecorationFromNP(selector: string, value: number): string {
  // logDebug('textDecorationFromNP', `starting for ${selector} / ${value}`)
  if (selector === 'underlineStyle') {
    switch (value) {
      case 1: {
        return 'text-decoration: underline'
      }
      case 9: {
        // double
        return 'text-decoration: underline double'
      }
      case 513: {
        // dashed
        return 'text-decoration: underline dashed'
      }
      default: {
        logWarn('textDecorationFromNP', `No matching CSS found for underline style value '${value}'`)
        return ''
      }
    }
  } else if (selector === 'strikethroughStyle') {
    switch (value) {
      case 1: {
        return 'text-decoration: line-through'
      }
      case 9: {
        // double
        return 'text-decoration: line-through double'
      }
      case 513: {
        // dashed
        return 'text-decoration: line-through dashed'
      }
      default: {
        logWarn('textDecorationFromNP', `No matching CSS found for style strikethrough value '${value}'`)
        return ''
      }
    }
  } else {
    logWarn('textDecorationFromNP', `No matching CSS found for style setting "${selector}"`)
    return ''
  }
}

/**
 * Convert a font size (in px) to rem (as a string).
 * Uses the NP theme's baseFontSize (in px) to be the basis for 1.0rem.
 * @param {number} thisFontSize
 * @param {number} baseFontSize
 * @returns {string} size including 'rem' units
 */
function pxToRem(thisFontSize: number, baseFontSize: number): string {
  const output = `${String((thisFontSize / baseFontSize).toPrecision(2))}rem`
  // logDebug('', `${String(thisFontSize)} -> ${output}`)
  return output
}

/**
 * Convert [A]RGB (used by NP) to RGB[A] (CSS)
 * @param {string} #[A]RGB
 * @returns {string} #RGB[A]
 */
function RGBColourConvert(RGBIn: string): string {
  try {
    // default to just passing the colour through, unless
    // we have ARGB, so need to switch things round
    let output = RGBIn
    if (RGBIn != null && RGBIn.match(/#[0-9A-Fa-f]{8}/)) {
      output = `#${RGBIn.slice(3, 9)}${RGBIn.slice(1, 3)}`
    }
    return output
  } catch (error) {
    logError('RGBColourConvert', `${error.message} for RGBIn '${RGBIn}'`)
    return '#888888' // for completeness
  }
}

/**
 * Translate from the font name, as used in the NP Theme file,
 * to the form CSS is expecting.
 * If no translation is defined, try to use the user's own default font.
 * If that fails, use fallback font 'sans'.
 * Further info at https://help.noteplan.co/article/44-customize-themes#fonts
 * @author @jgclark
 * @param {string} fontNameNP
 * @returns {Array<string>} resulting CSS font properties
 */
export function fontPropertiesFromNP(fontNameNP: string): Array<string> {
  const specialFontList = new Map()
  // lookup list of special cases
  specialFontList.set('System', ['sans', 'regular', 'normal'])
  specialFontList.set('', ['sans', 'regular', 'normal'])
  specialFontList.set('noteplanstate', ['noteplanstate', 'regular', 'normal'])

  const outputArr = []

  // First test to see if this is one of the specials
  const specials = specialFontList.get(fontNameNP) // or undefined if none match
  if (specials !== undefined) {
    outputArr.push(`font-family: "${specials[0]}"`)
    outputArr.push(`font-weight: "${specials[1]}"`)
    outputArr.push(`font-style: "${specials[2]}"`)
    // logDebug('translateFontNameNPToCSS', `${fontNameNP} ->  ${outputArr.toString()}`)
    logDebug(pluginJson, `specials: ${fontNameNP} ->  ${outputArr.toString()}`)
    return outputArr
  }

  // Not a special. So now split input string into parts either side of '-'
  // and then insert spaces before capital letters
  let translatedFamily: string
  let translatedWeight: string = '400'
  let translatedStyle: string = 'normal'
  const splitParts = fontNameNP.split('-')
  const namePartNoSpaces = splitParts[0]
  let namePartSpaced = ''
  const modifierLC = splitParts.length > 0 ? splitParts[1]?.toLowerCase() : ''
  for (let i = 0; i < namePartNoSpaces.length; i++) {
    const c = namePartNoSpaces[i]
    if (c.match(/[A-Z]/)) {
      namePartSpaced += ` ${c}`
    } else {
      namePartSpaced += c
    }
  }
  translatedFamily = namePartSpaced.trim()
  // logDebug('translateFontNameNPToCSS', `${fontNameNP} -> ${translatedFamily}`)

  // Using the numeric font-weight system
  // With info from https://developer.mozilla.org/en-US/docs/Web/CSS/font-weight#common_weight_name_mapping
  switch (modifierLC) {
    case 'thin': {
      translatedWeight = '100'
      break
    }
    case 'light': {
      translatedWeight = '300'
      break
    }
    case 'book': {
      translatedWeight = '500'
      break
    }
    case 'demi-bold': {
      translatedWeight = '600'
      break
    }
    case 'semi-bold': {
      translatedWeight = '600'
      break
    }
    case 'bold': {
      translatedWeight = '700'
      break
    }
    case 'heavy': {
      translatedWeight = '900'
      break
    }
    case 'black': {
      translatedWeight = '900'
      break
    }
    case 'italic': {
      translatedStyle = 'italic'
      break
    }
    case 'bolditalic': {
      translatedWeight = '700'
      translatedStyle = 'italic'
      break
    }
    case 'slant': {
      translatedStyle = 'italic'
      break
    }
    default: {
      // including '', 'normal' and 'regular'
      translatedWeight = '400'
      translatedStyle = 'normal'
      break
    }
  }
  // logDebug('translateFontNameNPToCSS', `  - ${translatedStyle} / ${translatedWeight}`)

  // Finally if we're still working on default 'Sans', then
  // at least try to use the user's default font setting.
  if (translatedFamily === 'Sans') {
    logDebug('fontPropertiesFromNP', `For '${fontNameNP}' trying user's default font setting`)
    const userFont: string = String(DataStore.preference('fontFamily')) ?? ''
    logDebug('fontPropertiesFromNP', `- userFont = '${userFont}'`)
    translatedFamily = userFont
  }

  outputArr.push(`font-family: "${translatedFamily}"`)
  outputArr.push(`font-weight: "${translatedWeight}"`)
  outputArr.push(`font-style: "${translatedStyle}"`)
  // logDebug('translateFontNameNPToCSS', `${fontNameNP} ->  ${outputArr.toString()}`)
  return outputArr
}

/**
 * Make a CSS selector from an array of parameters
 * @param {string} selector
 * @param {Array<string>} settingsArray
 * @returns {string} CSS selector with its various parameters
 */
function makeCSSSelector(selector: string, settingsArray: Array<string>): string {
  const outputArray = []
  outputArray.push(`\t${selector} {`)
  outputArray.push(`\t\t${settingsArray.join(';\n\t\t')}`)
  outputArray.push(`\t}`)
  return outputArray.join('\n')
}

export type HtmlWindowOptions = {
  headerTags?: string,
  generalCSSIn?: string,
  specificCSS?: string,
  makeModal?: boolean,
  preBodyScript?: string,
  postBodyScript?: string,
  savedFilename?: string,
  width?: number,
  height?: number,
}

/**
 * This function creates the webkit message handler for an action in HTML sending data back to the plugin. Generally passed through to showHTMLWindow as part of the pre or post body script.
 * @param {*} commandName - the *name* of the plugin command to be called (not the jsFunction) -- THIS NAME MUST BE ONE WORD, NO SPACES - generally a good idea for name/jsFunction to be the same for callbacks
 * @param {*} pluginID - the plugin ID
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
export function getCallbackCodeString(commandName: string, pluginID: string): string {
  const haveNotePlanExecute = JSON.stringify(`(async function() { await DataStore.invokePluginCommandByName("${commandName}", "${pluginID}", %%commandArgs%%);})()`)

  return `
    const ${commandName} = (commandArgs = []) => {
      console.log("Sending command to NotePlan: ${commandName} with args: ", commandArgs);
      window.webkit.messageHandlers.jsBridge.postMessage({
        code: ${haveNotePlanExecute}.replace("%%commandArgs%%", JSON.stringify(commandArgs)),
        onHandle: "onHandleuUpdateNoteCount",
        id: "1"
      });
    };`
}

/**
 * Convenience function for opening HTML Window with as few arguments as possible
 * @param {string} windowTitle - (required) window title
 * @param {string} body - (required) body HTML code
 * @param {HtmlWindowOptions} opts - (optional) options: {headerTags, generalCSSIn, specificCSS, makeModal, preBodyScript, postBodyScript, savedFilename, width, height}
 * Notes: if opts.generalCSSIn is not supplied, then CSS will be generated based on the user's current theme.
 * If you want to save the HTML to a file for debugging, then you should supply opts.savedFilename (it will be saved in the plugin's data/<plugin.id> folder).
 * Your script code in pre-body or post-body do not need to be wrapped in <script> tags.
 * @example showHTMLWindow("Test", "<p>Test</p>", {savedFilename: "test.html"})
 */
export function showHTMLWindow(windowTitle: string, body: string, opts: HtmlWindowOptions) {
  showHTML(
    windowTitle,
    opts.headerTags ?? '',
    body,
    opts.generalCSSIn ?? '',
    opts.specificCSS ?? '',
    opts.makeModal ?? false,
    opts.preBodyScript ?? '',
    opts.postBodyScript ?? '',
    opts.savedFilename ?? '',
    opts.width,
    opts.height,
  )
}

/**
 * Helper function to construct HTML to show in a new window
 * @param {string} windowTitle
 * @param {string} headerTags
 * @param {string} body
 * @param {string} generalCSSIn
 * @param {string} specificCSS
 * @param {boolean} makeModal?
 * @param {string?} preBodyScript
 * @param {string?} postBodyScript
 * @param {string?} filenameForSavedFileVersion
 * @param {number?} width
 * @param {number?} height
 * TODO: Allow for style file when we can save arbitrary data files, not just read them
 */
export function showHTML(
  windowTitle: string,
  headerTags: string,
  body: string,
  generalCSSIn: string,
  specificCSS: string,
  makeModal: boolean = false,
  preBodyScript: string = '',
  postBodyScript: string = '',
  filenameForSavedFileVersion: string = '',
  width?: number,
  height?: number,
): void {
  try {
    const scriptTag = '<script type="text/javascript">\n'
    const fullHTML = []
    fullHTML.push('<!DOCTYPE html>') // needed to let emojis work without special coding
    fullHTML.push('<html>')
    fullHTML.push('<head>')
    fullHTML.push(`<title>${windowTitle}</title>`)
    fullHTML.push(`<meta charset="utf-8">`)
    fullHTML.push(headerTags)
    fullHTML.push('<style type="text/css">')
    // If CSS is empty, then generate it from the current theme
    const generalCSS = generalCSSIn && generalCSSIn !== '' ? generalCSSIn : generateCSSFromTheme('')
    fullHTML.push(generalCSS)
    fullHTML.push(specificCSS)
    fullHTML.push('</style>')
    if (preBodyScript !== '') {
      const hasScriptTag = preBodyScript.includes('<script')
      fullHTML.push(hasScriptTag ? '\n' : scriptTag)
      fullHTML.push(preBodyScript)
      fullHTML.push(hasScriptTag ? '\n' : '\n</script>\n')
    }
    fullHTML.push('</head>')
    fullHTML.push('\n<body>')
    fullHTML.push(body)
    fullHTML.push('\n</body>')
    if (postBodyScript !== '') {
      const hasScriptTag = postBodyScript.includes('<script')
      fullHTML.push(hasScriptTag ? '\n' : scriptTag)
      fullHTML.push(postBodyScript)
      fullHTML.push(hasScriptTag ? '\n' : '\n</script>\n')
    }
    fullHTML.push('</html>')
    const fullHTMLStr = fullHTML.join('\n')

    logDebug(pluginJson, `showHTML filenameForSavedFileVersion="${filenameForSavedFileVersion}"`)

    // Call the appropriate function, with or without h/w params.
    // Currently non-modal windows only available on macOS and from 3.7 (build 864)
    if (width === undefined || height === undefined) {
      if (makeModal || NotePlan.environment.platform !== 'macOS' || NotePlan.environment.buildVersion < 863) {
        logDebug('showHTML', `Using modal view for ${NotePlan.environment.buildVersion} build on ${NotePlan.environment.platform}`)
        HTMLView.showSheet(fullHTMLStr) // available from 3.6.2
      } else {
        HTMLView.showWindow(fullHTMLStr, windowTitle) // available from 3.7.0
      }
    } else {
      if (makeModal || NotePlan.environment.platform !== 'macOS' || NotePlan.environment.buildVersion < 863) {
        logDebug('showHTML', `Using modal view for ${NotePlan.environment.buildVersion} build on ${NotePlan.environment.platform}`)
        HTMLView.showSheet(fullHTMLStr, width, height)
      } else {
        HTMLView.showWindow(fullHTMLStr, windowTitle, width, height)
      }
    }

    // If wanted, also write this HTML to a file so we can work on it offline.
    // Note: this is saved to the Plugins/Data/<Plugin> folder, not a user-accessible Note.
    if (filenameForSavedFileVersion !== '') {
      const filenameWithoutSpaces = filenameForSavedFileVersion.split(' ').join('')
      // Write to specified file in NP sandbox
      const res = DataStore.saveData(fullHTMLStr, filenameWithoutSpaces, true)
      if (res) {
        logDebug('showHTML', `Saved resulting HTML '${windowTitle}' to ${filenameForSavedFileVersion} as well.`)
      } else {
        logError('showHTML', `Couoldn't save resulting HTML '${windowTitle}'  to ${filenameForSavedFileVersion}.`)
      }
    }
  } catch (error) {
    logError('HTMLView / showHTML', error.message)
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
