// @flow
// --------------------------------
// HTML helpers
// --------------------------------

import { clo, logDebug, logError, logWarn } from '@helpers/dev'
// import { getOrMakeNote } from '@helpers/note'

let baseFontSize = 14

/**
 * Generate CSS instructions from the given theme (or current one if not given)
 * to use as an embedded style sheet
 * @author @jgclark
 * @param {string?} themeNameIn
 * @returns {string} outputCSS
 */
// $FlowIgnore[incompatible-return]
export function generateCSSFromTheme(themeNameIn: string = ''): string {
  try {
    let themeName = ''
    let themeJSON: Object
    if (NotePlan.environment.buildVersion > 849) {
      logDebug('generateCSSFromTheme', `Current theme = '${String(Editor.currentTheme.name)}', mode '${String(Editor.currentTheme.mode)}'`)

      // log list of available themes
      const availableThemeNames = Editor.availableThemes.map((m) => (m.name.endsWith('.json') ? m.name.slice(0, -5) : m.name))
      logDebug('generateCSSFromTheme', availableThemeNames.toString())

      // if themeName is blank, then use Editor.currentTheme
      themeName = (themeNameIn && themeNameIn !== '') ? themeNameIn : Editor.currentTheme.name

      if (!availableThemeNames.includes(themeName)) {
        logError('generateCSSFromTheme', `Theme '${themeName}' is not in list of available themes. Stopping`)
        return ''
      }
    } else {
      // if themeName is blank, then use user's dark theme (which we can access before NP 3.6.2)
      themeName = (themeNameIn && themeNameIn !== '') ? themeNameIn : String(DataStore.preference('themeDark'))
    }

    // try simplest way first (for NP b850+)
    themeName = Editor.currentTheme.name
    logDebug('generateCSSFromTheme', `Reading theme '${themeName}'`)

    // eslint-disable-next-line prefer-const
    themeJSON = Editor.currentTheme.values

    // TODO: allow for specified theme, not just current one
    // Read theme (old way)
    // logDebug('generateCSSFromTheme', `Reading theme '${themeName}'`)
    // const relativeThemeFilepath = `../../../Themes/${themeName}.json` // TODO: will need updating
    // const themeJSON = DataStore.loadJSON(relativeThemeFilepath)
    // const themeJSON = availableThemes

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

    // Set 'html':
    // - main font size
    // set global variable
    baseFontSize = Number(DataStore.preference('fontSize')) ?? 14
    // tempSel.push(`color: ${themeJSON.styles.body.color}` ?? "#DAE3E8")
    tempSel.push(`background: ${themeJSON.editor.backgroundColor}` ?? "#1D1E1F")
    output.push(makeCSSSelector('html', tempSel))
    // rootSel.push(`--fg-main-color: ${themeJSON.styles.body.color}` ?? "#DAE3E8")
    rootSel.push(`--bg-main-color: ${themeJSON.editor.backgroundColor}` ?? "#1D1E1F")

    // Set body:
    // - main font = styles.body.font)
    // const bodyFont = translateFontNameNPToCSS(themeJSON.styles.body.font)
    // - main foreground colour (styles.body.color)
    // - main background colour (editor.backgroundColor)
    tempSel = []
    styleObj = themeJSON.styles.body
    if (styleObj) {
      const thisColor = RGBColourConvert(themeJSON.editor.textColor) ?? "#CC6666"
      tempSel.push(`color: ${thisColor}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('body', tempSel))
      rootSel.push(`--fg-main-color: ${RGBColourConvert(themeJSON.editor.textColor)}` ?? "#CC6666")
    }

    // Set H1 (styles.title1)
    tempSel = []
    styleObj = themeJSON.styles.title1
    if (styleObj) {
      const thisColor = RGBColourConvert(themeJSON.styles.title1.color) ?? "#CC6666"
      tempSel.push(`color: ${thisColor}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('h1', tempSel))
      rootSel.push(`--h1-color: ${thisColor}`)
    }
    // Set H2 similarly:
    tempSel = []
    styleObj = themeJSON.styles.title2
    if (styleObj) {
      const thisColor = RGBColourConvert(themeJSON.styles.title2.color) ?? "#E9C062"
      tempSel.push(`color: ${thisColor}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('h2', tempSel))
      rootSel.push(`--h2-color: ${thisColor}`)
    }
    // Set H3 similarly:
    tempSel = []
    styleObj = themeJSON.styles.title3
    if (styleObj) {
      const thisColor = RGBColourConvert(themeJSON.styles.title3.color) ?? "#E9C062"
      tempSel.push(`color: ${thisColor}`)
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('h3', tempSel))
      rootSel.push(`--h3-color: ${thisColor}`)
    }
    // Set H4 similarly:
    tempSel = []
    styleObj = themeJSON.styles.title4
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(themeJSON.styles.title4.color)}` ?? "#E9C062")
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('h4', tempSel))
    }
    // NP doesn't support H5 styling

    // Set core table features from theme:
    const altColor = RGBColourConvert(themeJSON.editor?.altBackgroundColor) ?? "#2E2F30"
    output.push(makeCSSSelector('tr:nth-child(even)', [
      `background-color: ${altColor}`,
    ]))
    output.push(makeCSSSelector('th', [
      `background-color: ${altColor}`,
    ]))
    rootSel.push(`--bg-alt-color: ${altColor}`)
    const tintColor = RGBColourConvert(themeJSON.editor?.tintColor) ?? "#E9C0A2"
    output.push(makeCSSSelector('table tbody tr:first-child', [
      `border-top: 1px solid ${tintColor}`]))
    output.push(makeCSSSelector('table tbody tr:last-child', [
      `border-bottom: 1px solid ${RGBColourConvert(themeJSON.editor?.tintColor)}` ?? "1px solid #E9C0A2",
    ]))
    rootSel.push(`--tint-color: ${tintColor}`)

    // Set bold text if present
    tempSel = []
    styleObj = themeJSON.styles.bold
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color)}` ?? "#CC6666") // FIXME:
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('b', tempSel))
    }
    // Set italic text if present
    tempSel = []
    styleObj = themeJSON.styles.italic
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color)}` ?? "#96CBFE") // FIXME:
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('i', tempSel))
    }
    // Can't easily set bold-italic in CSS ...

    // Set class for completed tasks ('checked') if present
    tempSel = []
    styleObj = themeJSON.styles.checked
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color)}` ?? "#9DC777")
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('.task-checked', tempSel))
    }

    // Set class for cancelled tasks ('checked-canceled') if present
    // following is workaround in object handling as 'checked-canceled' JSON property has a dash in it
    tempSel = []
    styleObj = themeJSON.styles['checked-canceled']
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color)}` ?? "#9DC777")
      tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
      output.push(makeCSSSelector('.task-cancelled', tempSel))
    }

    // Set class for scheduled tasks ('checked-scheduled') if present
    // following is workaround in object handling as 'checked-canceled' JSON property has a dash in it
    tempSel = []
    styleObj = themeJSON.styles['checked-scheduled']
    if (styleObj) {
      tempSel.push(`color: ${RGBColourConvert(styleObj.color)}` ?? "#9DC777")
    }
    tempSel = tempSel.concat(convertStyleObjectBlock(styleObj))
    output.push(makeCSSSelector('.task-scheduled', tempSel))

    // Now put the important info and rootSel at the start of the output
    output.unshift(makeCSSSelector(':root', rootSel))
    output.unshift(`/* Generated by @jgclark's translateFontNameNPToCSS from NotePlan theme '${themeName}' by jgc */`)

    logDebug('generateCSSFromTheme', `Generated CSS:\n${output.join('\n')}`)
    return output.join('\n')
  }
  catch (error) {
    logError('generateCSSFromTheme', error.message)
  }
}

/**
 * 
 * @param {Object} style object from JSON theme
 * @returns {Array}
 */
function convertStyleObjectBlock(styleObject: any): Array<string> {
  let cssStyleLinesOutput: Array<string> = []
  if (styleObject?.size) {
    cssStyleLinesOutput.push(`font-size: ${pxToRem(styleObject?.size, baseFontSize)}`)
  }
  if (styleObject?.paragraphSpacingBefore) {
    cssStyleLinesOutput.push(`line-height: ${pxToRem(styleObject?.paragraphSpacingBefore, baseFontSize)}`)
  }
  if (styleObject?.font) {
    cssStyleLinesOutput = cssStyleLinesOutput.concat(fontPropertiesFromNP(styleObject?.font))
  }
  if (styleObject?.strikethroughStyle) {
    cssStyleLinesOutput.push(textDecorationFromNP('strikethrough', styleObject?.strikethroughStyle))
  }
  if (styleObject?.underlineStyle) {
    cssStyleLinesOutput.push(textDecorationFromNP('underline', styleObject?.underlineStyle))
  }
  // `padding-bottom: ${themeJSON.styles.body.paragraphSpacing}` ?? "6" + 'px', // TODO:
  // `padding-top: ${themeJSON.styles.body.paragraphSpacingBefore}` ?? "0" + 'px', // TODO:
  return cssStyleLinesOutput
}

/**
 * Convert NP strikethrough/underline styling to CSS setting (or empty string if none)
 * Full details at  
 * @author @jgclark
 * @param {string}
 * @returns {string}
 */
export function textDecorationFromNP(selector: string, value: string = ''): string {
  logDebug('textDecorationFromNP', `starting for ${selector} / ${value}`)
  if (selector === 'underline') {
    switch (value) {
      case '1': {
        return "text-decoration: underline"
      }
      case '9': { // double  TODO: Test me
        return "text-decoration: underline double"
      }
      case '513': { // dashed TODO: Test me
        return "text-decoration: underline dashed"
      }
      default: {
        logWarn('textDecorationFromNP', `No matching CSS found for underline style value '${value}'`)
        return ""
      }
    }
  }
  else if (selector === 'strikethrough') {
    switch (value) {
      case '1': { // FIXME: why doesn't this fire?
        return "text-decoration: line-through"
      }
      case '9': { // double TODO: Test me
        return "text-decoration: line-through double"
      }
      case '513': { // dashed TODO: Test me
        return "text-decoration: line-through dashed"
      }
      default: {
        logWarn('textDecorationFromNP', `No matching CSS found for style strikethrough value '${value}'`)
        return ""
      }
    }
  }
  else {
    logWarn('textDecorationFromNP', `No matching CSS found for style setting "${selector}"`)
    return ""
  }
}

/**
 * Convert a font size (in px) to rem (as a string) using baseFontSize (in px) to be the basis for 1.0rem.
 * @param {number} thisFontSize 
 * @param {number} baseFontSize 
 * @returns {string}
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
  // default to just passing the colour through, unless
  // we have ARGB, so need to switch things round
  let output = RGBIn
  if (RGBIn.match(/#[0-9A-Fa-f]{8}/)) {
    output = '#' + RGBIn.slice(7, 9) + RGBIn.slice(1, 7)
  }
  return output
}

/**
 * Translate from the font name, as used in the NP Theme file,
 * and the form CSS is expecting.
 * If no translation is defined, try to use the user's own default font.
 * If that fails, use built-in font.
 * Further info at https://help.noteplan.co/article/44-customize-themes#fonts
 * @author @jgclark
 * @param {string} fontNameNP 
 * @returns {Array<string>} resulting CSS font properties
 */
export function fontPropertiesFromNP(fontNameNP: string): Array<string> {
  const fontList = new Map()
  // lookup list
  fontList.set('noteplanstate', ['noteplanstate', 'regular', 'normal'])
  fontList.set('AvenirNext', ['Avenir Next', 'regular', 'normal'])
  fontList.set('AvenirNext-Italic', ['Avenir Next', 'regular', 'italic'])
  fontList.set('AvenirNext-DemiBold', ['Avenir Next', '500', 'normal'])
  fontList.set('AvenirNext-Bold', ['Avenir Next', 'bold', 'normal'])
  fontList.set('Avenir Next', ['Avenir Next', 'regular', 'normal'])
  fontList.set('HelveticaNeue', ['Helvetica Neue', 'regular', 'normal'])
  fontList.set('HelveticaNeue-Italic', ['Helvetica Neue', 'regular', 'italic'])
  fontList.set('HelveticaNeue-Bold', ['Helvetica Neue', 'bold', 'normal'])
  fontList.set('Helvetica Neue', ['Helvetica Neue', 'regular', 'normal'])

  // Set fallbacks first
  let translatedFamily: string = 'Sans'
  let translatedWeight: string = 'regular'
  let translatedStyle: string = 'normal'

  let tuple: [string, string, string] = fontList.get(fontNameNP) ?? ['', '', '']
  translatedFamily = tuple[0]
  if (tuple[0] !== '') {
    // set properties from the lookup list
    translatedFamily = tuple[0]
    translatedWeight = tuple[1]
    translatedStyle = tuple[2]
  } else {
    // otherwise try using user's default font setting
    const userFont: string = String(DataStore.preference('fontFamily')) ?? ''
    tuple = fontList.get(userFont) ?? ['', '', '']
    if (tuple[0] !== '') {
      // set properties from the lookup list
      translatedFamily = tuple[0]
      translatedWeight = tuple[1]
      translatedStyle = tuple[2]
    }
  }

  const outputArr = []
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
 * Helper function to construct HTML to show
 * @param {string} noteTitle 
 * @param {string} headerTags 
 * @param {string} body 
 * @param {string} generalCSSIn 
 * @param {string} specificCSS
 * @param {string?} preBodyScript
 * @param {string?} postBodyScript
 * @param {string?} filenameForSavedFileVersion
 * TODO: Allow for style file when we can save arbitrary data files, not just read them
 * TODO: How to allow for emojis?
 */
export function showHTML(
  noteTitle: string,
  headerTags: string,
  body: string,
  generalCSSIn: string,
  specificCSS: string,
  preBodyScript: string = '',
  postBodyScript: string = '',
  filenameForSavedFileVersion: string = ''
): void {

  const fullHTML = []
  fullHTML.push('<html>')
  fullHTML.push('<head>')
  fullHTML.push(`<title>${noteTitle}</title>`)
  fullHTML.push(headerTags)
  fullHTML.push('<style type="text/css">')
  // If CSS is empty, then generate it from the current theme
  const generalCSS = (generalCSSIn && generalCSSIn !== '') ? generalCSSIn : generateCSSFromTheme('')
  fullHTML.push(generalCSS)
  fullHTML.push(specificCSS)
  fullHTML.push('</style>')
  if (preBodyScript !== '') {
    fullHTML.push('\n<script>')
    fullHTML.push(preBodyScript)
    fullHTML.push('\n</script>')
  }
  fullHTML.push('</head>')
  fullHTML.push('\n<body>')
  fullHTML.push(`<h1>${noteTitle}</h1>`)
  fullHTML.push(body)
  fullHTML.push('\n</body>')
  if (postBodyScript !== '') {
    fullHTML.push('\n<script>')
    fullHTML.push(postBodyScript)
    fullHTML.push('\n</script>')
  }
  fullHTML.push('</html>')

  HTMLView.showSheet(fullHTML.join('\n'))

  // If wanted, also write this HTML to a note so we can work on it offline. (Works only with 3.6.2 build >847.)
  if (filenameForSavedFileVersion !== '' && NotePlan.environment.buildVersion > 847) {

    // NEWER METHOD (to arbitrary file in NP sandbox)
    const res = DataStore.saveData(fullHTML.join('\n'), filenameForSavedFileVersion, true)
    if (res) {
      logDebug('showHTML', `Saved resulting HTML to ${filenameForSavedFileVersion} as well.`)
    } else {
      logDebug('showHTML', `Couoldn't Save resulting HTML to ${filenameForSavedFileVersion} as well.`)
    }

    // OLDER METHOD (to MD note in main Notes folder)
    // const folderToStore = '/' // could be smarter
    // const note: ?TNote = await getOrMakeNote(filenameForSavedFileVersion, folderToStore)
    // if (note != null) {
    //   logDebug('showHTML', `writing HTML to note with filename '${note.filename}'`)
    //   note.content = fullHTML.join('\n')
    // } else {
    //   logError('showHTML', `couldn't write to note '${filenameForSavedFileVersion}'`)
    // }
  }
}
