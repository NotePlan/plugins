// @flow
// ---------------------------------------------------------
// HTML helper functions for use with HTMLView API
// by @jgclark
// Last updated 3.8.2023 by @jgclark
// ---------------------------------------------------------

import { clo, logDebug, logError, logWarn, JSP } from '@helpers/dev'
import { getStoredWindowRect, isHTMLWindowOpen, setHTMLWindowId, storeWindowRect } from '@helpers/NPWindows'

// ---------------------------------------------------------
// Constants and Types

const pluginJson = 'helpers/HTMLView'

let baseFontSize = 14

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

// ---------------------------------------------------------

/**
 * Generate CSS instructions from the given theme (or current one if not given, or 'dark' theme if that isn't available) to use as an embedded style sheet.
 * TODO: be smarter at getting priority task theming
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

    // If that hasn't worked, then currentTheme
    if (themeName === '') {
      themeName = Editor.currentTheme.name ?? ''
      themeName = themeName.endsWith('.json') ? themeName.slice(0, -5) : themeName
      logDebug('generateCSSFromTheme', `Translating your current theme '${themeName}'`)
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
    const bgMainColor = themeJSON?.editor?.backgroundColor ?? '#1D1E1F'
    tempSel.push(`background: var(--bg-main-color)`) //`color: ${bgMainColor}`
    output.push(makeCSSSelector('html', tempSel))
    // rootSel.push(`--fg-main-color: ${themeJSON.styles.body.color ?? "#DAE3E8"}`)
    rootSel.push(`--bg-main-color: ${bgMainColor}`)

    // Set body:
    // - main font = styles.body.font
    const bodyFont = themeJSON.styles.body.font ?? ''
    logDebug('generateCSSFromTheme', `bodyFont: ${bodyFont}`)
    // - main foreground colour (styles.body.color)
    // - main background colour (editor.backgroundColor)
    tempSel = []
    tempSel.push(`font-size: ${baseFontSize}px`)
    styleObj = themeJSON.styles.body
    if (styleObj) {
      const thisColor = RGBColourConvert(themeJSON?.editor?.textColor ?? '#CC6666')
      tempSel.push(`color: var(--fg-main-color)`) //`color: ${thisColor}`
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('body, .body', tempSel))
      // tempSel = styleObj.size // TEST:
      rootSel.push(`--fg-main-color: ${thisColor}`)
    }

    // Set H1 from styles.title1
    tempSel = []
    styleObj = themeJSON.styles.title1
    if (styleObj) {
      const thisColor = RGBColourConvert(themeJSON.styles.title1.color ?? '#CC6666')
      tempSel.push(`color: ${thisColor}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('h1, .h1', tempSel)) // allow this same style to be used as a class too
      rootSel.push(`--h1-color: ${thisColor}`)
    }
    // Set H2 similarly
    tempSel = []
    styleObj = themeJSON.styles.title2
    if (styleObj) {
      const thisColor = RGBColourConvert(themeJSON.styles.title2.color ?? '#E9C062')
      tempSel.push(`color: ${thisColor}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('h2, .h2', tempSel))
      rootSel.push(`--h2-color: ${thisColor}`)
    }
    // Set H3 similarly
    tempSel = []
    styleObj = themeJSON.styles.title3
    if (styleObj) {
      const thisColor = RGBColourConvert(themeJSON.styles.title3.color ?? '#E9C062')
      tempSel.push(`color: ${thisColor}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('h3, .h3', tempSel))
      rootSel.push(`--h3-color: ${thisColor}`)
    }
    // Set H4 similarly
    tempSel = []
    styleObj = themeJSON.styles.title4
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(themeJSON.styles.title4.color ?? '#E9C062')}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('h4, .h4', tempSel))
    }
    // NP doesn't support H5 styling

    // Set core table features from theme
    const altColor = RGBColourConvert(themeJSON.editor?.altBackgroundColor) ?? '#2E2F30'
    rootSel.push(`--bg-alt-color: ${altColor}`)
    const tintColor = RGBColourConvert(themeJSON.editor?.tintColor) ?? '#E9C0A2'
    rootSel.push(`--tint-color: ${tintColor}`)

    // Set core button style from macOS based on dark or light:
    // Similarly for fake-buttons (i.e. from <a href ...>)
    if (isLightTheme) {
      output.push(makeCSSSelector('button', [
        'color: var(--fg-main-color)',
        'background-color: #FFFFFF',
        `font-family: "${bodyFont}"`, // needs to repeat for potentially-native controls
        // 'font-size: 1.0rem',
        'font-weight: 500',
        'border-radius: 4px',
      ]))
      output.push(
        makeCSSSelector('.fake-button a', [
          'color: var(--fg-main-color)',
          'background-color: #FFFFFF',
          // 'font-size: 1.0rem',
          'font-weight: 500',
          'text-decoration: none',
          'border-color: #DFE0E0',
          'border-radius: 4px',
          'box-shadow: 0 1px 1px #CBCBCB',
          'padding: 1px 7px 1px 7px',
          'margin: 2px 4px',
          'white-space: nowrap', // no wrapping (i.e. line break) within the button display
        ]),
      )
    } else {
      // dark theme
      output.push(makeCSSSelector('button', [
        'color: var(--fg-main-color)',
        'background-color: #5E5E5E',
        `font-family: "${bodyFont}"`, // needs to repeat for potentially-native controls
        // 'font-size: 1.0rem',
        'font-weight: 500',
        'border-radius: 4px',
      ]))
      output.push(
        makeCSSSelector('.fake-button a', [
          'color: var(--fg-main-color)',
          'background-color: #5E5E5E',
          // 'font-size: 1.0rem',
          'font-weight: 500',
          'text-decoration: none',
          'border-color: #5E5E5E',
          'border-radius: 4px',
          'box-shadow: 0 -1px 1px #6F6F6F',
          'padding: 1px 7px 1px 7px',
          'margin: 2px 4px',
          'white-space: nowrap', // no wrapping (i.e. line break) within the button display
        ]),
      )
    }

    // Set italic text if present
    tempSel = []
    styleObj = themeJSON.styles.italic
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color ?? '#96CBFE')}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('p i', tempSel)) // not just 'i' as otherwise it can mess up the fontawesome icons
    }
    // Set bold text if present
    tempSel = []
    styleObj = themeJSON.styles.bold
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color ?? '#CC6666')}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('p b', tempSel))
    }
    // Can't easily set bold-italic in CSS ...

    // Set class for open tasks ('todo') if present
    tempSel = []
    styleObj = themeJSON.styles.todo
    if (styleObj) {
      tempSel.push(`color: ${styleObj.color ? RGBColourConvert(styleObj.color) : 'var(--tint-color)'}`)
      output.push(makeCSSSelector('.todo', tempSel))
    }

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

    // Set class for hashtags ('hashtag') if present
    tempSel = []
    styleObj = themeJSON.styles.hashtag
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color ?? '#96CBFE')}`)
      tempSel.push(`background-color: ${RGBColourConvert(styleObj.backgroundColor ?? 'inherit')}`)
      tempSel.push('border-radius: 5px')
      tempSel.push('padding-inline: 3px')
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('.hashtag', tempSel))
    }

    // Set class for mentions ('attag') if present
    tempSel = []
    styleObj = themeJSON.styles.attag
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color ?? '#96CBFE')}`)
      tempSel.push(`background-color: ${RGBColourConvert(styleObj.backgroundColor ?? 'inherit')}`)
      tempSel.push('border-radius: 5px')
      tempSel.push('padding-inline: 3px')
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('.attag', tempSel))
    }

    // Set class for 'flagged-1' (priority 1) if present
    tempSel = []
    styleObj = themeJSON.styles['flagged-1']
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color) ?? 'inherit'}`)
      tempSel.push(`background-color: ${RGBColourConvert(styleObj.backgroundColor ?? '#FFE5E5')}`)
      tempSel.push('border-radius: 5px')
      tempSel.push('padding-inline: 3px')
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('.priority1', tempSel))
    }

    // Set class for 'flagged-2' (priority 2) if present
    tempSel = []
    styleObj = themeJSON.styles['flagged-2']
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color) ?? 'inherit'}`)
      tempSel.push(`background-color: ${RGBColourConvert(styleObj.backgroundColor ?? '#FFC5C5')}`)
      tempSel.push('border-radius: 5px')
      tempSel.push('padding-inline: 3px')
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('.priority2', tempSel))
    }

    // Set class for 'flagged-3' (priority 3) if present
    tempSel = []
    styleObj = themeJSON.styles['flagged-3']
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color) ?? 'inherit'}`)
      tempSel.push(`background-color: ${RGBColourConvert(styleObj.backgroundColor ?? '#FFA5A5')}`)
      tempSel.push('border-radius: 5px')
      tempSel.push('padding-inline: 3px')
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('.priority3', tempSel))
    }

    // Set class for 'working-on' if present
    tempSel = []
    styleObj = themeJSON.styles['working-on']
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color) ?? 'inherit'}`)
      tempSel.push(`background-color: ${RGBColourConvert(styleObj.backgroundColor ?? '#FFA5A5')}`)
      tempSel.push('border-radius: 5px')
      tempSel.push('padding-inline: 3px')
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('.priority5', tempSel))
    }

    // Now put the important info and rootSel at the start of the output
    output.unshift(makeCSSSelector(':root', rootSel))
    output.unshift(`/* Generated from theme '${themeName}' by @jgclark's generateCSSFromTheme */`)

    // logDebug('generateCSSFromTheme', `Generated CSS:\n${output.join('\n')}`)
    return output.join('\n')
  } catch (error) {
    logError('generateCSSFromTheme', error.message)
    return '<error>'
  }
}

/**
 * Convert NotePlan Theme style information to CSS equivalent(s)
 * Covers attributes: size, paragraphSpacingBefore, paragraphSpacing, font, strikethroughStyle, underlineStyle.
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
    cssStyleLinesOutput.push(`margin-top: ${pxToRem(styleObject?.paragraphSpacingBefore, baseFontSize)}`)
  }
  if (styleObject?.paragraphSpacing) {
    cssStyleLinesOutput.push(`margin-bottom: ${pxToRem(styleObject?.paragraphSpacing, baseFontSize)}`)
  }
  if (styleObject?.lineSpacing) {
    const lineSpacingRem = Number(styleObject?.lineSpacing) * 1.5
    cssStyleLinesOutput.push(`line-height: ${String(lineSpacingRem)}rem`)
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
  // logDebug('fontPropertiesFromNP', `for '${fontNameNP}'`)
  const outputArr = []

  // Deal with special case of Apple's System font
  // See https://www.webkit.org/blog/3709/using-the-system-font-in-web-content/ for more info
  if (fontNameNP.startsWith(".AppleSystemUIFont")) {
    outputArr.push(`font-family: "-apple-system"`)
    outputArr.push(`line-height: 1.2rem`)
    // logDebug('fontPropertiesFromNP', `special: ${fontNameNP} ->  ${outputArr.toString()}`)
    return outputArr
  }

  // Then test to see if this is one of the other specials
  const specialFontList = new Map()
  // lookup list of special cases
  specialFontList.set('System', ['sans', 'regular', 'normal'])
  specialFontList.set('', ['sans', 'regular', 'normal'])
  specialFontList.set('noteplanstate', ['noteplanstate', 'regular', 'normal'])
  const specials = specialFontList.get(fontNameNP) // or undefined if none match
  if (specials !== undefined) {
    outputArr.push(`font-family: "${specials[0]}"`)
    outputArr.push(`font-weight: "${specials[1]}"`)
    outputArr.push(`font-style: "${specials[2]}"`)
    // logDebug('fontPropertiesFromNP', `specials: ${fontNameNP} ->  ${outputArr.toString()}`)
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
  // logDebug('fontPropertiesFromNP', `family -> ${translatedFamily}`)

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
    altColor: RGBColourConvert(themeJSON.editor?.altBackgroundColor) ?? '#2E2F30',
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
 */
export function showHTMLWindow(windowTitle: string, body: string, opts: HtmlWindowOptions) {
  const preBody = opts.preBodyScript ? (Array.isArray(opts.preBodyScript) ? opts.preBodyScript : [opts.preBodyScript]) : []
  if (opts.includeCSSAsJS) {
    const theme = getThemeJS(true, true)
    if (theme.values) {
      preBody.push(`/* Basic Theme as JS for CSS-in-JS use in scripts \n  Created from theme: "${theme.name}" */\n  const NP_THEME=${JSON.stringify(theme.values, null, 4)}\n`)
      logDebug(pluginJson, `showHTMLWindow Saving NP_THEME in JavaScript`)
    }
  }
  showHTML(
    windowTitle,
    opts.headerTags ?? '',
    body,
    opts.generalCSSIn ?? '',
    opts.specificCSS ?? '',
    opts.makeModal ?? false,
    [...preBody],
    opts.postBodyScript ?? '',
    opts.savedFilename ?? '',
    opts.width,
    opts.height,
  )
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
    fullHTML.push(`<meta charset="utf-8">`)
    const preScript = generateScriptTags(winOpts.preBodyScript ?? '')
    if (preScript !== '') {
      fullHTML.push(preScript) // dbw moved to top because we need the logging bridge to be loaded before any content which could have errors
    }
    fullHTML.push(winOpts.headerTags)
    fullHTML.push('<style type="text/css">')
    // If generalCSSIn is empty, then generate it from the current theme. (Note: could extend this to save CSS from theme, and then check if it can be reused.)
    const generalCSS = winOpts.generalCSSIn && winOpts.generalCSSIn !== '' ? winOpts.generalCSSIn : generateCSSFromTheme('')
    fullHTML.push(generalCSS)
    fullHTML.push(winOpts.specificCSS)
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
 * WARNING: Deprecated. Please use more advanced features in showHTMLV2() instead.
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
  customId: string = '',
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

    // Set customId for this window (with fallback to be windowTitle) Note: requires NP v3.8.1+
    if (NotePlan.environment.buildVersion >= 976) {
      // FIXME: Currently this is warning 0 HTML Windows
      setHTMLWindowId(customId ?? windowTitle)
    }

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
export async function showHTMLV2(
  body: string,
  opts: HtmlWindowOptions,
): Promise<Window | boolean> {
  try {
    if (NotePlan.environment.buildVersion < 1037) {
      logWarn('HTMLView / showHTMLV2', 'showHTMLV2() is only available on 3.9.2 build 1037 or newer. Will fall back to using simpler showHTML() instead ...')
      await showHTML(opts.windowTitle,
        opts.headerTags ?? '',
        body,
        opts.generalCSSIn ?? '',
        opts.specificCSS ?? '',
        opts.makeModal,
        opts.preBodyScript,
        opts.postBodyScript,
        opts.savedFilename ?? '',
        opts.width,
        opts.height,
        opts.customId)
      return true // for completeness

    } else {

      // clo(opts, 'showHTMLV2 starting with options:')
      // Assemble the parts of the HTML into a single string
      const fullHTMLStr = assembleHTMLParts(body, opts)
      const cId = opts.customId ?? opts.windowTitle ?? ''

      // Before showing anything, see if the window is already open, and if so save its x/y/w/h (if requested)
      if (opts.reuseUsersWindowRect && isHTMLWindowOpen(cId)) {
        logDebug('showHTMLV2', `Window is already open, and will save its x/y/w/h`)
        storeWindowRect(cId)
      }

      // Decide which of the appropriate functions to call.
      if (opts.makeModal || NotePlan.environment.platform !== 'macOS') {
        logDebug('showHTMLV2', `Using modal 'sheet' view for ${NotePlan.environment.buildVersion} build on ${NotePlan.environment.platform}`)
        if (opts.width === undefined || opts.height === undefined) {
          HTMLView.showSheet(fullHTMLStr)
        } else {
          HTMLView.showSheet(fullHTMLStr, opts.width, opts.height)
        }
      } else {
        let winOptions = {}
        // First set to the default values
        winOptions = {
          x: opts.x,
          y: opts.y,
          width: opts.width,
          height: (opts.height > 56) ? opts.height : 500, // to attempt to cope with bug where height can change to 28px
          shouldFocus: opts.shouldFocus,
          // Note: can't set customId, but only long UID ('id')
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
              height: (storedRect.height > 56) ? storedRect.height : 500, // to attempt to cope with bug where height can change to 28px
              shouldFocus: opts.shouldFocus
            }
            logDebug('showHTMLV2', `- Read user's saved Rect from pref from ${cId}`)
          } else {
            logDebug('showHTMLV2', `- Couldn't read user's saved Rect from pref from ${cId}`)
          }
        }
        clo(winOptions, 'showHTMLV2 using winOptions:')
        // $FlowIgnore[invalid-compare]
        if (winOptions.height < 29) {
          // $FlowIgnore[incompatible-type]
          logWarn('showHTMLV2', `**** height to use = ${winOptions.height}px! ****`)
        }

        // clo(winOptions, 'subset of options for API call:')
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

        // Set customId for this window (with fallback to be windowTitle) Note: requires NP v3.8.1+
        logDebug('showHTMLV2', `- opts.customId: '${opts.customId ?? '?'}'`)
        const customIdToUse = opts.customId ?? opts.windowTitle
        logDebug('showHTMLV2', `- customIdToUse: '${customIdToUse}'`)
        win.customId = customIdToUse
        // Read this back from the window itself
        // logDebug('showHTMLV2', `- Window has customId '${win.customId}' / id ${win.id}`)

        return win
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
 */
export function replaceMarkdownLinkWithHTMLLink(str: string): string {
  return str.replace(/\[(.*?)\]\((.*?)\)/gm, `<a href="$2">$1</a>`)
}

/**
 * Message action types
 * SET_TITLE - update the title of the HTML window (send {title: 'new title'} in the payload)
 * SHOW_BANNER - display a message in the top of the page (use the helper sendBannerMessage('message'))
 * SET_DATA - tell the HTML window to update its state with the data passed
 * RETURN_VALUE - the async return value of a call that came in fron the React Window to the Plugin
 */

/**
 * Send some data to the HTML window (to be written to globalSharedData) using postMessage message passing
 * Note: we can (and do) write to globalSharedData directly, but we should try to use this function
 * to do so, because it will allow us to use message passing to update the state in the HTML window
 * which gives us more visibility into what's happening on the HTML side
 * @param {string - see above} actionType - the reducer-type action to be dispatched (tells the app how to act on the data passed)
 * @param {any} data - the data to be passed to the app (and ultimately to be written to globalSharedData)
 * @param {string} updateInfo - the message to be sent to the app
 * @return {any} - the result of the runJavaScript call (should be unimportant in this case -- undefined is ok)
 * @author @dwertheimer
 */
export async function sendToHTMLWindow(actionType: string, data: any = {}, updateInfo: string = ''): any {
  try {
    const dataWithUpdated = { ...data, ...{ lastUpdated: { msg: `${actionType}${updateInfo ? ` ${updateInfo}` : ''}`, date: new Date().toLocaleString() } } }
    // logDebug(`Bridge::sendToHTMLWindow`, `sending type:"${actionType}" payload=${JSON.stringify(data, null, 2)}`)
    logDebug(`Bridge::sendToHTMLWindow`, `sending type:"${actionType}"`)
    const result = await HTMLView.runJavaScript(`window.postMessage(
        {
          type: '${actionType}',
          payload: ${JSON.stringify(dataWithUpdated)}
        },
        '*'
      );`)
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
 * @returns {Object} - the current state of globalSharedData
 */
export async function getGlobalSharedData(varName: string = 'globalSharedData'): any {
  try {
    const currentValue = await HTMLView.runJavaScript(`${varName};`)
    // if (currentValue !== undefined) logDebug(`getGlobalSharedData`, `got ${varName}: ${JSON.stringify(currentValue)}`)
    return currentValue
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Generally, we will try not to update the global shared object directly, but instead use message passing to let React update the state. But there will be times we need to update the state from here (e.g. when we hit limits of message passing).
 * @author @dwertheimer
 * @param {any} data - the full object to be written to globalSharedData (SHARED DATA MUST BE OBJECTS)
 * @param {boolean} mergeData - if true (default), will merge the new data with the existing data, if false, will fully overwrite
 * @param {string} varName - the name of the global variable to be updated (by default "globalSharedData")
 * @returns {any} returns the result of the runJavaScript call, which in this case is typically identical to the data passed
 * ...and so can probably be ignored
 */
export async function updateGlobalSharedData(data: any, mergeData: boolean = true, varName: string = 'globalSharedData'): any {
  let newData
  const currentData = await getGlobalSharedData(varName)
  if (currentData === undefined) {
    logDebug(`updateGlobalSharedData`, `Variable ${varName} was not defined (creating it now)...ignore the WebView error above ^^^`)
    await HTMLView.runJavaScript(`let ${varName} = {};`) // create the global var if it doesn't exist
  }
  if (mergeData) {
    newData = { ...currentData, ...data }
  } else {
    newData = data
  }
  // logDebug(`updateGlobalSharedData`, `writing globalSharedData (merged=${String(mergeData)}) to ${JSON.stringify(newData)}`)
  const code = `${varName} = JSON.parse(${JSON.stringify(newData)});`
  logDebug(pluginJson, `updateGlobalSharedData code=\n${code}\n`)
  //FIXME: Is this still throwing an error?
  logDebug(pluginJson, `updateGlobalSharedData FIXME: Is this still throwing an error? ^^^`)
  return await HTMLView.runJavaScript(code)
}

/**
 * Send a warning message to the HTML window (displays a warning message at the top of page)
 * @param {string} message
 * @param {string} color https://www.w3schools.com/w3css/w3css_colors.asp
 * @param {string} border (left vertical stripe border of box) https://www.w3schools.com/w3css/w3css_colors.asp
 */
export async function sendBannerMessage(message: string, color: string = 'w3-pale-red', border: string = 'w3-border-red'): Promise<any> {
  return await sendToHTMLWindow('SHOW_BANNER', { warn: true, msg: message, color, border })
}
