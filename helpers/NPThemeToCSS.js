// @flow
// ---------------------------------------------------------
// HTML helper functions to create CSS from NP Themes
// by @jgclark
// Last updated 22.12.2023 by @jgclark
// ---------------------------------------------------------

import { clo, logDebug, logError, logInfo, logWarn, JSP } from '@helpers/dev'


// ---------------------------------------------------------
// Constants and Types

let baseFontSize = 14

// ---------------------------------------------------------

/**
 * Generate CSS instructions from the given theme (or current one if not given, or 'dark' theme if that isn't available) to use as an embedded style sheet.
 * @author @jgclark
 * @param {string?} themeNameIn
 * @returns {string} outputCSS
 */
export function generateCSSFromTheme(themeNameIn: string = ''): string {
  try {
    let themeName = ''
    let themeJSON: Object
    const availableThemeNames = Editor.availableThemes.map((m) => (m.name.endsWith('.json') ? m.name.slice(0, -5) : m.name))
    let matchingThemeObjs: Array<any> = [] // Eduard hasn't typed the Theme objects

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
    const fsPref = DataStore.preference('fontSize')
    baseFontSize = (fsPref && !isNaN(Number(fsPref))) ? Number(fsPref) : 14
    const bgMainColor = themeJSON?.editor?.backgroundColor ?? '#1D1E1F'
    tempSel.push(`background: var(--bg-main-color)`)
    output.push(makeCSSSelector('html', tempSel))
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
      tempSel.push(`color: var(--fg-main-color)`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('body, .body', tempSel))
      rootSel.push(`--fg-main-color: ${thisColor}`)
      if (styleObj?.lineSpacing) {
        // borrowed from convertStyleObjectBlock()
        const lineSpacingRem = (Number(styleObj?.lineSpacing) * 1.5).toPrecision(3) // some fudge factor seems to be needed
        rootSel.push(`--body-line-height: ${String(lineSpacingRem)}rem`)
      }
    }

    // Set H1 from styles.title1
    tempSel = []
    styleObj = themeJSON.styles.title1
    if (styleObj) {
      const thisColor = RGBColourConvert(themeJSON.styles.title1.color ?? '#CC6666')
      tempSel.push(`color: ${thisColor}`)
      const thisBackgroundColor = RGBColourConvert(themeJSON.styles.title1.backgroundColor ?? bgMainColor)
      tempSel.push(`background-color: ${thisBackgroundColor}`)
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
      const thisBackgroundColor = RGBColourConvert(themeJSON.styles.title2.backgroundColor ?? bgMainColor)
      tempSel.push(`background-color: ${thisBackgroundColor}`)
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
      const thisBackgroundColor = RGBColourConvert(themeJSON.styles.title3.backgroundColor ?? bgMainColor)
      tempSel.push(`background-color: ${thisBackgroundColor}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('h3, .h3', tempSel))
      rootSel.push(`--h3-color: ${thisColor}`)
    }
    // Set H4 similarly
    tempSel = []
    styleObj = themeJSON.styles.title4
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(themeJSON.styles.title4.color ?? '#E9C062')}`)
      const thisBackgroundColor = RGBColourConvert(themeJSON.styles.title4.backgroundColor ?? bgMainColor)
      tempSel.push(`background-color: ${thisBackgroundColor}`)
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
      output.push(makeCSSSelector('p emph', tempSel)) // not 'i' as otherwise it can mess up the fontawesome icons
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
      tempSel.push(`color: ${RGBColourConvert(styleObj.color) ?? 'var(--tint-color)'}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj, false))
      // hack: easier to add second definition than to undo the last one
      tempSel.push('line-height: var(--body-line-height)')
      output.push(makeCSSSelector('.todo', tempSel))
    }

    // Set class for completed tasks ('checked') if present
    tempSel = []
    styleObj = themeJSON.styles.checked
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color ?? '#098308A0')}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj, false))
      tempSel.push('line-height: var(--body-line-height)')
      output.push(makeCSSSelector('.checked', tempSel))
    }

    // Set class for cancelled tasks ('checked-canceled') if present
    // following is workaround in object handling as 'checked-canceled' JSON property has a dash in it
    tempSel = []
    styleObj = themeJSON.styles['checked-canceled']
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color ?? '#E04F57A0')}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj, false))
      tempSel.push('line-height: var(--body-line-height)')
      output.push(makeCSSSelector('.cancelled', tempSel))
    }

    // Set class for scheduled tasks ('checked-scheduled') if present
    // following is workaround in object handling as 'checked-canceled' JSON property has a dash in it
    tempSel = []
    styleObj = themeJSON.styles['checked-scheduled']
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color ?? '#7B7C86A0')}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj, false))
      tempSel.push('line-height: var(--body-line-height)')
      output.push(makeCSSSelector('.task-scheduled', tempSel))
    }

    // Set class for hashtags ('hashtag') if present
    tempSel = []
    styleObj = themeJSON.styles.hashtag
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color ?? 'inherit')}`)
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
      tempSel.push(`color: ${RGBColourConvert(styleObj.color ?? 'inherit')}`)
      tempSel.push(`background-color: ${RGBColourConvert(styleObj.backgroundColor ?? 'inherit')}`)
      tempSel.push('border-radius: 5px')
      tempSel.push('padding-inline: 3px')
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('.attag', tempSel))
    }

    // Set class for `pre-formatted text` ('code') if present
    tempSel = []
    styleObj = themeJSON.styles.code
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color ?? 'inherit')}`)
      tempSel.push(`background-color: ${RGBColourConvert(styleObj.backgroundColor ?? 'inherit')}`)
      tempSel.push('border-radius: 5px')
      tempSel.push('padding-inline: 3px')
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('.code', tempSel))
    }

    // Set class for ==highlights== ('highlighted') if present
    tempSel = []
    styleObj = themeJSON.styles.highlighted
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color ?? 'inherit')}`)
      tempSel.push(`background-color: ${RGBColourConvert(styleObj.backgroundColor ?? 'inherit')}`)
      tempSel.push('border-radius: 5px')
      tempSel.push('padding-inline: 3px')
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('.highlighted', tempSel))
    }

    // Set class for ~underlined~ ('underline') if present
    tempSel = []
    styleObj = themeJSON.styles.underline
    if (styleObj) {
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj, true))
      output.push(makeCSSSelector('.underlined', tempSel))
    }
    // Set class for ~~strikethrough~~ ('strikethrough') if present
    tempSel = []
    styleObj = themeJSON.styles.strikethrough
    if (styleObj) {
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj, true))
      output.push(makeCSSSelector('.strikethrough', tempSel))
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
      output.push(makeCSSSelector('.priority4', tempSel))
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
 * Covers attributes within a theme item: size, paragraphSpacingBefore, paragraphSpacing, lineSpacing, font, strikethroughStyle, underlineStyle, underlineColor.
 * @author @jgclark
 * @param {Object} style object from JSON theme
 * @param {boolean} includeFontDetails? (default: false)
 * @returns {Array} CSS elements
 */
function convertStyleObjectBlock(styleObject: any, includeFontDetails: boolean = true): Array<string> {
  let cssStyleLinesOutput: Array<string> = []
  if (styleObject?.size) {
    cssStyleLinesOutput.push(`font-size: ${pxToRem(styleObject?.size, baseFontSize)}`)
  }
  if (includeFontDetails) {
    if (styleObject?.font) {
      cssStyleLinesOutput = cssStyleLinesOutput.concat(fontPropertiesFromNP(styleObject?.font))
    }
  }
  if (styleObject?.paragraphSpacingBefore) {
    cssStyleLinesOutput.push(`margin-top: ${pxToRem(styleObject?.paragraphSpacingBefore, baseFontSize)}`)
  }
  if (styleObject?.paragraphSpacing) {
    cssStyleLinesOutput.push(`margin-bottom: ${pxToRem(styleObject?.paragraphSpacing, baseFontSize)}`)
  }
  if (styleObject?.lineSpacing) {
    const lineSpacingRem = (Number(styleObject?.lineSpacing) * 1.5).toPrecision(3) // this fudge factor seems to be required
    cssStyleLinesOutput.push(`line-height: ${String(lineSpacingRem)}rem`)
  }
  if (styleObject?.strikethroughStyle) {
    const themeStyleNumber = Number(styleObject?.strikethroughStyle)
    /**
     * Values from 1-8 increase the thickness.
     * The next bit values that have an effect are: 1...
     * + 8: double (= 9)
     * + 256: patternDot (= 257)
     * + 512: patternDash (= 513)
     * + 1024: patternDashDotDot (= 1025)
     * + 8192: over line (= 8193)
     * +32768: by Word (= 32769)
     */
    if (themeStyleNumber > 0 && themeStyleNumber <= 8) {
      cssStyleLinesOutput.push('text-decoration: line-through')
      cssStyleLinesOutput.push(`text-decoration-style: solid`)
      cssStyleLinesOutput.push(`text-decoration-thickness: ${String(themeStyleNumber)}px`)
    }
    if (themeStyleNumber > 8 && themeStyleNumber <= 16) {
      cssStyleLinesOutput.push('text-decoration: line-through')
      cssStyleLinesOutput.push(`text-decoration-style: double`)
      cssStyleLinesOutput.push(`text-decoration-thickness: ${String(themeStyleNumber - 8)}px`)
    }
    if (themeStyleNumber > 256 && themeStyleNumber <= 264) {
      cssStyleLinesOutput.push('text-decoration: line-through')
      cssStyleLinesOutput.push(`text-decoration-style: dotted`)
      cssStyleLinesOutput.push(`text-decoration-thickness: ${String(themeStyleNumber - 256)}px`)
    }
    if (themeStyleNumber > 512 && themeStyleNumber <= 520) {
      cssStyleLinesOutput.push('text-decoration: line-through')
      cssStyleLinesOutput.push(`text-decoration-style: dashed`)
      cssStyleLinesOutput.push(`text-decoration-thickness: ${String(themeStyleNumber - 512)}px`)
    }
    if (themeStyleNumber > 8192 && themeStyleNumber <= 8200) {
      cssStyleLinesOutput.push(`text-decoration-style: overline`)
      cssStyleLinesOutput.push(`text-decoration-thickness: ${String(themeStyleNumber - 8192)}px`)
    }
    // cssStyleLinesOutput.push(textDecorationFromNP('strikethroughStyle', Number(styleObject?.strikethroughStyle)))
  }
  if (styleObject?.strikethroughColor) {
    cssStyleLinesOutput.push(`text-decoration-color: ${RGBColourConvert(styleObject.strikethroughColor ?? 'var(--fg-main-color)')}`)
  }
  if (styleObject?.underlineStyle) {
    const themeStyleNumber = Number(styleObject?.underlineStyle)
    /**
     * Values from 1-8 increase the thickness.
     * The next bit values that have an effect are: 1...
     * + 8: double (= 9)
     * + 256: patternDot (= 257)
     * + 512: patternDash (= 513)
     * + 1024: patternDashDotDot (= 1025)
     * + 8192: over line (= 8193)
     * +32768: by Word (= 32769)
     */
    if (themeStyleNumber > 0 && themeStyleNumber <= 8) {
      cssStyleLinesOutput.push('text-decoration: underline')
      cssStyleLinesOutput.push(`text-decoration-style: solid`)
      cssStyleLinesOutput.push(`text-decoration-thickness: ${String(themeStyleNumber)}px`)
    }
    if (themeStyleNumber > 8 && themeStyleNumber <= 16) {
      cssStyleLinesOutput.push('text-decoration: underline')
      cssStyleLinesOutput.push(`text-decoration-style: double`)
      cssStyleLinesOutput.push(`text-decoration-thickness: ${String(themeStyleNumber - 8)}px`)
    }
    if (themeStyleNumber > 256 && themeStyleNumber <= 264) {
      cssStyleLinesOutput.push('text-decoration: underline')
      cssStyleLinesOutput.push(`text-decoration-style: dotted`)
      cssStyleLinesOutput.push(`text-decoration-thickness: ${String(themeStyleNumber - 256)}px`)
    }
    if (themeStyleNumber > 512 && themeStyleNumber <= 520) {
      cssStyleLinesOutput.push('text-decoration: underline')
      cssStyleLinesOutput.push(`text-decoration-style: dashed`)
      cssStyleLinesOutput.push(`text-decoration-thickness: ${String(themeStyleNumber - 512)}px`)
    }
    if (themeStyleNumber > 8192 && themeStyleNumber <= 8200) {
      cssStyleLinesOutput.push(`text-decoration-style: overline`)
      cssStyleLinesOutput.push(`text-decoration-thickness: ${String(themeStyleNumber - 8192)}px`)
    }
  }
  if (styleObject?.underlineColor) {
    cssStyleLinesOutput.push(`text-decoration-color: ${RGBColourConvert(styleObject.underlineColor ?? 'var(--fg-main-color)')}`)
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
export function pxToRem(thisFontSize: number, baseFontSize: number): string {
  const output = `${String((thisFontSize / baseFontSize).toPrecision(2))}rem`
  return output
}

/**
 * Convert [A]RGB (used by NP) to RGB[A] (CSS)
 * @param {string} #[A]RGB
 * @returns {string} #RGB[A]
 */
export function RGBColourConvert(RGBIn: string): string {
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
  const specialFontList: Map<string, Array<string>> = new Map()
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
