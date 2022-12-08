// @flow

import { get, set, unset } from 'lodash-es'
import { createPrettyRunPluginLink } from '../../helpers/general'
import pluginJson from '../plugin.json'
import { getThemePropertiesInfoText, isBuiltInTheme, getPropDifferences } from './support/themeHelpers'
import { askForColor } from './NPThemeHTML'
import { getThemeObj } from './NPThemeShared'
import { chooseTheme, getThemeChoice } from './NPThemeChooser'
import * as masterThemeImport from './support/masterTheme.json'
import { openNoteByFilename } from '@helpers/NPnote'
import { chooseOption, showMessageYesNo, showMessage } from '@helpers/userInput'
import { log, logError, logDebug, timer, clo, JSP, getFilteredProps } from '@helpers/dev'
const masterTheme = masterThemeImport.default

/**
 * Write out edited theme file
 * @param {any} themeObj
 * @param {filePath} filePath
 */
export async function saveTheme(themeObj: any, filename: string, showMessageAfterSave: boolean = false) {
  // save out the revised theme
  const result = DataStore.saveJSON(themeObj, `../../../Themes/${filename}`)
  if (!result) {
    await showMessage(`Could not write to theme: ${filename}`)
  } else {
    if (showMessageAfterSave) await showMessage(`Saved theme: "${filename}"`)
  }
}

/**
 * Save a theme and then run a plugin command if required
 * @param {any} theme object
 * @param {string} pluginIDToCall
 * @param {string} pluginCommandToCall
 * @param {Array<string>} args
 */
async function saveChangedTheme(theme: any, filename, pluginIDToCall: string | null = null, pluginCommandToCall: string | null = null, args: Array<string> = []): Promise<void> {
  logDebug(pluginJson, `saveChangedTheme saving changed theme ${filename} ${theme.name}`)
  await saveTheme(theme, filename, false)
  logDebug(
    pluginJson,
    `saveChangedTheme theme saved now reloading theme with force refresh and then running command: ${String(pluginCommandToCall)} in plugin: ${String(pluginIDToCall)}`,
  )
  await chooseTheme(theme.name, pluginIDToCall, pluginCommandToCall, args, true)
}

/**
 * **********************
 * ENTRYPOINTS
 * **********************
 */

/**
 * Choose a style from the master style template (in this plugin in /src/support/masterTheme.json)
 * Plugin entrypoint for command: "/addStyle"
 * NOTE: the entry point is now disabled. I don't think the command will work anymore without the xcallback path
 */
export async function copyThemeStyle(stylePath: string | null = null) {
  try {
    if (!Editor) {
      showMessage(`You must be in the Editor with a document open to run this command`)
      return
    }
    const currentTheme = Editor.currentTheme
    // clo(masterTheme, `NPStyleChooser::copyThemeStyle masterTheme=`) //if you want to console.log the whole theme file
    const { styles } = masterTheme // pluck just the styles property from the theme file //this was originally styles but now should be something else
    let chosenStyle
    if (stylePath) {
      chosenStyle = stylePath
    } else {
      const keys = Object.keys(styles)
      const optionText = keys.map((k) => ({ label: `${k}${styles[k].description ? ` (${styles[k].description})` : ''}`, value: k }))
      chosenStyle = await chooseOption(`Choose a Style`, optionText, '')
    }
    if (chosenStyle !== '') {
      let myThemeValues
      if (!stylePath) {
        const allThemes = Editor.availableThemes
        const myThemeName = await getThemeChoice('', `What theme do you want to add it to?`)
        logDebug(pluginJson, `User chose theme: "${myThemeName}`)
        const myThemeObj = allThemes.filter((t) => t.name === myThemeName)[0]
        // Editor.availableThemes sends back the themes wrapped in an object with extra data (.name && .filename)
        // so to get the actual theme file data, we look under the .values property
        myThemeValues = myThemeObj.values
      } else {
        myThemeValues = currentTheme.values
      }
      // clo(myThemeObj, `NPStyleChooser::copyThemeStyle myThemeObj=`)
      let writeIt = true
      if (get(myThemeValues, chosenStyle)) {
        const replace = await showMessageYesNo(`The key "${chosenStyle}" already exists in theme:\n"${currentTheme.name}".\nReplace it?`)
        if (replace && replace === 'yes') {
          set(myThemeValues, stylePath, get(masterTheme, chosenStyle))
        } else {
          writeIt = false
        }
      } else {
        set(myThemeValues, stylePath, get(masterTheme, chosenStyle))
      }
      if (writeIt) {
        await saveTheme(myThemeValues, Editor.currentTheme.filename, !stylePath)
        logDebug(pluginJson, `copyThemeStyle copying path:${String(stylePath)}`)
        if (stylePath) {
          replaceContentContainingText(
            stylePath,
            `\\[.*Add to My Theme.*\\)`,
            `[Refresh the Page to See Details](noteplan://x-callback-url/runPlugin?pluginID=np.ThemeChooser&command=Customize%20Themes)`,
          )
        }
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Remove a style from the current theme
 * Plugin entrypoint for command: "/COMMAND"
 * @param {*} incoming
 */
export async function removeStyle(stylePath: string | null = null) {
  try {
    logDebug(pluginJson, `removeStyle running with stylePath:${String(stylePath)}`)
    if (!Editor) {
      logError(pluginJson, `removeStyle no Editor`)
      return
    }
    if (!stylePath || stylePath === '') {
      logError(pluginJson, `removeStyle: no stylePath sent`)
      return
    }
    const currentThemeObj = Editor.currentTheme
    const result = unset(currentThemeObj.values, stylePath)
    if (result) {
      logDebug(pluginJson, `removeStyle: style removed. saving theme`)
      await saveTheme(currentThemeObj.values, currentThemeObj.filename, false)
      await createThemeSamples() //need to redraw the page
    } else {
      logError(pluginJson, `removeStyle: could not remove stylePath:${String(stylePath)}`)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 *
 * @param {*} text that must be in the line (may or may not be the part to be replaced)
 * @param {*} oldText the part to replace (is converted to a regex, so you can use regex syntax REMEMBER TO DOUBLE ESCAPE, e.g \\d+)
 * @param {*} replacementText the text to replace with
 */
export function replaceContentContainingText(text: string, oldText: string, replacementText: string /*, scrollHighlightAfter: boolean = false */): void {
  const p = getParagraphContainingText(text)
  if (p) {
    p.content = p.content.replace(new RegExp(oldText, 'ig'), replacementText)
    logDebug(pluginJson, `replaceContentContainingText replacing old: ${text} ${oldText} with ${replacementText}; updating Paragraph now`)
    Editor.updateParagraph(p)
    // if (scrollHighlightAfter) Editor.highlight(p) // -- will cause NP to hang if you try to scroll to it
  }
}

/**
 * Callback function for the color picker HTML (called via invokePluginCommandByName)
 * @param {*} color
 */
export async function setColor(key: string, color: string): Promise<void> {
  logDebug(pluginJson, `setColor() user wants to set ${key} to ${color}`)
  const activeTheme = Editor.currentTheme
  const theme = activeTheme.values
  if (get(theme, key) !== color) {
    logDebug(pluginJson, `setting ${key} to ${color} and calling saveChangedTheme`)
    set(theme, key, color.toUpperCase())
    await saveChangedTheme(theme, activeTheme.filename, /*'np.ThemeChooser'*/ null, /*'Customize Themes'*/ null, [key])
    replaceContentContainingText(key, '(#[0-9a-f]{6})', color.toUpperCase())
  } else {
    logDebug(pluginJson, `setColor no change. Not saving`)
  }
}

/**
 * Help a user change/set a theme setting
 * @param {any} currentPropObj - an object from the theme file
 * @param {string} key - the key in that object
 * @param {string} text - the human-readable text to show the user
 * @param {'text'|'color'} interactionType
 * @returns
 */
async function getValueFromUser(currentPropObj: any, key: string, text: string, interactionType: string = 'text', wasUndefined: boolean = false): any | null {
  logDebug(pluginJson, `getValueFromUser key:${key} text:${text} interactionType:${interactionType} wasUndefined:${String(wasUndefined)}`)
  const attribute = get(currentPropObj, key)
  const attributeInfo = get(masterTheme, `${key}_info`) || {}
  const desc = attributeInfo.description || null
  let newVal = attribute
  let handingOffToHTML = false
  const prevValue = `Previous value: ${wasUndefined ? '[NOT SET]' : attribute}`
  switch (interactionType) {
    case 'text':
      newVal = await CommandBar.textPrompt(`Set value for "${key}"`, `${desc ? `\n(${desc})\n` : ''}${prevValue}`, attribute)
      break
    case 'color':
      // do something else, like a color picker
      newVal = null // setting will happen asynchronously in the callback to setColor
      handingOffToHTML = true
      askForColor(key, attribute) //non-blocking
      // newVal = await CommandBar.textPrompt(`Set value for "${key}"`, `${desc ? `\n(${desc})\n` : ''}Previous value: ${attribute}`, attribute)
      break
    case 'boolean':
      newVal = (await showMessageYesNo(`${desc ? `\n(${desc})\n` : ''}${prevValue}`, ['True', 'False'], `Set value for "${key}"`)) === 'True'
      break
    default:
      newVal = await CommandBar.textPrompt(`Set value for "${key}"`, prevValue, attribute)
      logDebug(pluginJson, `getValueFromUser falling back to text because received: ${interactionType}`)
      break
  }
  if (newVal && newVal !== attribute) {
    logDebug(pluginJson, `User changed ${key}=${attribute} to ${String(newVal)} (typeof attribute = ${typeof attribute})`)
    const searchFor = '` \\[(.*)\\]'
    const replacement = `\` [${String(newVal)}]`
    switch (typeof attribute) {
      case 'number':
        set(currentPropObj, key, Number(newVal))
        replaceContentContainingText(key, searchFor, replacement)
        break
      case 'boolean':
        set(currentPropObj, key, Boolean(newVal))
        replaceContentContainingText(key, '` (.*) `', replacement)
        break
      default:
        if (newVal === 'EMPTY STRING') newVal = ''
        set(currentPropObj, key, String(newVal))
        replaceContentContainingText(key, '` (.*) `', replacement)
        break
    }
    return currentPropObj
  } else {
    const msg = handingOffToHTML ? `Opened HTML window for input` : `User canceled ${String(newVal)} or returned same value as before: ${attribute}`
    logDebug(pluginJson, `getValueFromUser: ${msg}`)
    return null
  }
}

function addDefaultTheme() {
  const success = Editor.addTheme(JSON.stringify(masterTheme), 'ThemeChooserMasterTheme.json')
  logDebug(pluginJson, `addDefaultTheme saving theme success: ${String(success)}`)
}

/**
 * Search Editor paragraphs for the first one which contains the string
 * @param {*} text - the string to search for
 * @returns {TParagraph} - the first paragraph found, or null
 */
function getParagraphContainingText(text: string): Paragraph | null {
  const p = Editor.paragraphs.find((p) => p.content.includes(text))
  return p || null
}

/**
 * Insert theme samples at the cursor
 * Plugin entrypoint for command: "/Customize Themes"
 */
export async function createThemeSamples(idToScrollTo: string = '', autoRefreshRunning: boolean = false) {
  try {
    // CommandBar.showLoading(true, 'Loading Theme Data')
    logDebug(pluginJson, `createThemeSamples (aka Customize Themes) running; autoRefreshRunning:${String(autoRefreshRunning)}`)
    const frontmatter = `---\ntriggers:	onOpen => np.ThemeChooser.onOpenRefreshPage\n---`
    addDefaultTheme()
    const activeThemeName = Editor.currentTheme.name
    const viewingMasterTheme = activeThemeName === 'ThemeChooserMasterTheme'
    const activeIsBuiltInTheme = isBuiltInTheme(Editor.currentTheme.filename)
    // const theme = activeTheme.values
    // clo(masterTheme, `NPStyleChooser::createThemeSamples masterTheme=`)
    const currentTheme = Editor.currentTheme?.name || ''
    const currentSystemMode = `Current device system mode: "${Editor.currentSystemMode}" (just FYI, you can't change it)`

    const changeThemeLink = createPrettyRunPluginLink(`Change`, 'np.ThemeChooser', 'Choose Theme', ['', `np.ThemeChooser`, `Customize Themes`])
    const copyThemeLink = createPrettyRunPluginLink('Copy Theme', 'np.ThemeChooser', 'Copy Currently Active Theme', [``, `np.ThemeChooser`, `Customize Themes`])
    const defaultLight = getThemeObj(DataStore.preference('themeLight') || '', true)?.name || '' // will return the filename. use getThemeObj(defaultLight,true) to get a name
    const defaultDark = getThemeObj(DataStore.preference('themeDark') || '', true)?.name || ''
    const changeDefaultLink = createPrettyRunPluginLink('Change Default', 'np.ThemeChooser', 'Set Default Light/Dark Theme (for this device)', [
      'XXX',
      '',
      `np.ThemeChooser`,
      `Customize Themes`,
    ])
    const changeCurrentToDefaultLink = createPrettyRunPluginLink('_YYY_', 'np.ThemeChooser', 'Set Default Light/Dark Theme (for this device)', [
      '_XXX_',
      currentTheme,
      `np.ThemeChooser`,
      `Customize Themes`,
    ])
    const changeDefaultLight = changeCurrentToDefaultLink.replace('_YYY_', 'Light').replace('_XXX_', 'Light')
    const changeDefaultDark = changeCurrentToDefaultLink.replace('_YYY_', 'Dark').replace('_XXX_', 'Dark')
    const changeToLightLink = createPrettyRunPluginLink(`${String(defaultLight)}`, 'np.ThemeChooser', 'Choose Theme', [
      `${String(defaultLight)}`,
      `np.ThemeChooser`,
      `Customize Themes`,
    ])
    const changeToDarkLink = createPrettyRunPluginLink(`${String(defaultDark)}`, 'np.ThemeChooser', 'Choose Theme', [
      `${String(defaultDark)}`,
      `np.ThemeChooser`,
      `Customize Themes`,
    ])
    // const changeToCurrent = createPrettyRunPluginLink(`${currentTheme}`, 'np.ThemeChooser', 'Choose Theme', [`${String(currentTheme)}`, `np.ThemeChooser`, `Customize Themes`])
    const light = `Default light theme (for this device): ${changeToLightLink} ${changeDefaultLink.replace('XXX', 'light')}`
    const dark = `Default dark theme (for this device): ${changeToDarkLink} ${changeDefaultLink.replace('XXX', 'dark')}`
    const current = `Currently displayed theme: ***${currentTheme}*** ${changeThemeLink} ${
      activeIsBuiltInTheme
        ? `${copyThemeLink}\n*Note: this is a built-in theme, which cannot be edited. Make a copy if you want to edit the properties of this theme.*`
        : `${copyThemeLink} | Make Default: ${changeDefaultLight} | ${changeDefaultDark} Theme`
    }`
    const viewUsingMasterTheme = viewingMasterTheme
      ? ''
      : createPrettyRunPluginLink('View using MasterTheme', 'np.ThemeChooser', 'Choose Theme', [`ThemeChooserMasterTheme`, `np.ThemeChooser`, `Customize Themes`])
    const preamble = [
      `[Theme Docs](https://help.noteplan.co/article/44-customize-themes)`,
      /*
      `- [Strikethrough and Underline Styles](https://help.noteplan.co/article/48-strikethrough-underline-styles)`,
      `- [Fonts](https://help.noteplan.co/article/44-customize-themes#fonts)`,
      */
      '## Theme Info',
      `*For speed, this page's text/contents are not updated when you change theme properties. To see text changes, [Refresh the Page](noteplan://x-callback-url/runPlugin?pluginID=np.ThemeChooser&command=Customize%20Themes)*`,
    ]
    const modeExplainer = `> You can set one theme to be your default dark theme (e.g. for night) and another to be your default light theme (e.g. for day), and when your Mac or iOS device switches modes to dark or light, NotePlan will change to your default dark or light theme. You can also manually switch between dark and light modes in the Theme Chooser. Note: light and dark theme defaults are stored on a per-device basis, so you can have different defaults for your Mac and iOS devices.`
    const themes = []
    themes.push(current, light, dark, modeExplainer, currentSystemMode)
    if (viewUsingMasterTheme) {
      themes.push(`See full range of style settings: ${viewUsingMasterTheme}`)
    }
    const currentStyles = Editor.currentTheme.values.styles
    const [, localAdditionalStyles] = getPropDifferences(masterTheme.styles, currentStyles)
    // const styleDiffs = localAdditionalStyles.length > 0 ? localAdditionalStyles.map((s) => currentStyles[s]) : []
    // clo(localAdditionalStyles, `NPStyleChooser::createThemeSamples localAdditionalStyles=`)
    let customs = []
    const styleDiff = localAdditionalStyles.reduce((acc, s) => {
      acc[s] = currentStyles[s]
      return acc
    }, {})
    // clo(styleDiff, `NPStyleChooser::createThemeSamples styleDiff=`)
    // styleDiffs.forEach((diff, i) => {
    //   getThemePropertiesInfoText({ styles: { [localAdditionalStyles[i]]: diff } }, customs, `styles.${localAdditionalStyles[i]}`, currentStyles)
    // })
    customs = getThemePropertiesInfoText(styleDiff, customs, `styles`, Editor.currentTheme.values)
    // clo(customs, `NPStyleChooser::createThemeSamples customs custom Styles=`)
    const credits = `\n*Special thanks to @clayrussell, @jgclark, @nmn, @qualitativeEasing, @m1well, @gracius, @orionp, @pan, @brokosz and many more who wittingly (or mostly unwittingly) contributed to this plugin.*`
    if (customs.length > 1) customs = ['## Custom Styles (in this theme)', ...customs] // styles will be there by default
    const outputArray = [
      '# Customize Themes',
      ...preamble,
      ...themes,
      ...getThemePropertiesInfoText(masterTheme, [`## Current Theme Properties`], '', Editor.currentTheme.values),
      ...customs,
      ...[credits],
    ]
    outputArray.push(`\n[Refresh the Page](noteplan://x-callback-url/runPlugin?pluginID=np.ThemeChooser&command=Customize%20Themes)`)
    const content = outputArray.join('\n')
    // logDebug(pluginJson, `createThemeSamples content=\n${content}`)
    // clo(outputArray, `NPThemeCustomizer::createThemeSamples outputArray=`)
    // Editor.insertTextAtCursor(outputArray.join('\n')) //TODO: open document
    logDebug(pluginJson, `createThemeSamples about to open file by filename`)
    const filepath = `@Theme/Customize Themes.md`
    let note,
      contentWritten = false
    if (Editor?.note?.filename === filepath) {
      // Don't reload the file if we are already in it
      note = Editor
    } else {
      note = openNoteByFilename(filepath, { createIfNeeded: true, content: `${frontmatter}\n${content}` })
      if (note) {
        contentWritten = true
        logDebug(pluginJson, `createThemeSamples new note created successfully using openNoteByFilename`)
      } else {
        // NONE OF THIS SHOULD BE NECESSARY IF THE API WORKS CORRECTLY - AT SOME POINT DELETE IT
        await showMessage(`Error: new API failed could not open file ${filepath}`, 'error')
        let testNote = await DataStore.noteByFilename(filepath, 'Notes')
        if (!testNote) {
          const createdFile = await DataStore.newNoteWithContent(content, `/`, 'Customize Themes.md')
          logDebug(pluginJson, `createThemeSamples createdFile named:${createdFile}`)
          if (createdFile === filepath) {
            testNote = await DataStore.noteByFilename(filepath, 'Notes')
          }
        }
        if (testNote) {
          logDebug(pluginJson, `createThemeSamples found file by filename: ${testNote.filename}`)
          note = await Editor.openNoteByFilename(testNote.filename, false, 0, 0, false, false)
          // clo(note, `NPThemeCustomizer::createThemeSamples note=`)
        }
      }
    }
    if (note && !contentWritten) {
      // We had the page open in the editor already, so let's just re-write the content
      const start = new Date()
      const linesPerInsert = 20
      if (note && Editor.note) {
        logDebug(pluginJson, `createThemeSamples after Editor.openNoteByFilename. about to insert content: ${content.length} chars`)
        // clo(content, `NPThemeCustomizer::createThemeSamples content=`)
        // note.content = content
        if (Editor && Editor.note) {
          const note = Editor.note
          if (note) note.content = frontmatter
          let str = ''
          outputArray.forEach((line, i) => {
            str += `${line}`
            if (i % linesPerInsert === 0 || i === outputArray.length - 1) {
              if (note) note.appendParagraph(str, 'text')
              str = ''
            } else {
              str += '\n'
            }
          })
          // clo(outputArray, `NPThemeCustomizer::createThemeSamples outputArray=`)
        }
        logDebug(pluginJson, `createThemeSamples set content theme is now:${currentTheme}`)
        logDebug(pluginJson, `createThemeSamples Inserting ${outputArray.length} lines (${linesPerInsert} at a time) using Editor.note.appendParagraph took ${timer(start)} ms`)
      } else {
        logDebug(pluginJson, `createThemeSamples could not open file by ${filepath} in Editor`)
      }
      if (idToScrollTo?.length) {
        logDebug(pluginJson, `createThemeSamples about to scroll to id:${idToScrollTo} paras in Editor.paragraphs:${Editor.paragraphs.length}`)
        logDebug(pluginJson, `createThemeSamples about to scroll to id:${idToScrollTo} paras in Editor.note.paragraphs:${Editor.paragraphs.length}`)
        // find paragraph where .content contains idToScrollTo
        let para
        if (Editor) {
          para = Editor.paragraphs.filter((p) => p.content.includes(idToScrollTo))
          if (para?.length) {
            logDebug(pluginJson, `createThemeSamples about to scroll to id:${idToScrollTo} id:${para[0].lineIndex}  para:${para[0].content}`)
            // Editor.highlight(para[0]) // TODO: figure out how to make this work
            logDebug(pluginJson, `createThemeSamples hoping someday to be able to SCROLL to id:${idToScrollTo} id:${para[0].lineIndex}  para:${para[0].content}`)
          }
        }
      }
    } else {
      if (!contentWritten) {
        logError(pluginJson, `createThemeSamples failed to open note`)
        await showMessage('Failed to open Theme Customizer page')
      }
    }
    logDebug(pluginJson, `createThemeSamples after open file got to the end of the function`)
    // CommandBar.showLoading(false)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Edit a style
 * Plugin entrypoint for command: "/Edit a Theme Style Attribute"
 */
export async function editStyleAttribute(stylePath: string | null = null, pluginIDToCall: string | null = null, pluginCommandToCall: string | null = null) {
  try {
    if (!Editor) {
      showMessage(`You must be in the Editor with a document open to run this command`)
      return
    }
    logDebug(pluginJson, `editStyleAttribute running will set: ${String(stylePath)} Returning to: ${String(pluginIDToCall)} ${String(pluginCommandToCall)}`)
    const activeTheme = Editor.currentTheme
    const theme = activeTheme.values
    let currentPropObj = { ...theme }
    let changes = false,
      wasUndefined = false
    if (stylePath) {
      let attribute = get(currentPropObj, stylePath)
      logDebug(`NPStyleChooser::editStyleAttribute typeof:${typeof stylePath}  stylePath=${stylePath} current value=${attribute}`)
      if (attribute === undefined) {
        wasUndefined = true
        // does not yet exist in current theme
        const defaultValue = get(masterTheme, stylePath)
        set(currentPropObj, stylePath, defaultValue)
        attribute = defaultValue
      }
      const attributeInfo = get(masterTheme, `${stylePath}_info`) || {}
      if (!attributeInfo.type) {
        if (/color$/i.test(stylePath)) attributeInfo.type = 'color'
        if (/font$/i.test(stylePath)) attributeInfo.type = 'font'
      }
      // clo(attribute, `NPStyleChooser::editStyleAttribute typeof:${typeof stylePath}  attribute current value=`)
      // clo(attributeInfo, `NPStyleChooser::editStyleAttribute typeof:${typeof stylePath}  attributeInfo.type=${attributeInfo.type} attributeInfo=`)
      // getValueFromUser(currentPropObj: any, key: string, text: string, interactionType: string = 'text')
      const newObj = await getValueFromUser(currentPropObj, stylePath, attribute, attributeInfo.type || 'text', wasUndefined) //TODO: add other input types
      if (newObj) {
        changes = true
        currentPropObj = newObj
      }
    } else {
      let done = false
      do {
        const propsThisLevel = getFilteredProps(currentPropObj)
        const opts = propsThisLevel.map((p) => ({ label: `${p}`, value: p }))
        const ret = await chooseOption(`Choose an option to edit`, opts, '')
        if (ret === '') {
          done = true
        } else {
          logDebug(
            pluginJson,
            `User selected: "${ret}" from: \n${propsThisLevel.toString()} \n...typeof currentPropObj[ret]=${String(currentPropObj && typeof currentPropObj[ret])}`,
          )
          if (currentPropObj && typeof currentPropObj[ret] === 'object') {
            currentPropObj = currentPropObj[ret]
          } else {
            // prompt user to set
            currentPropObj = await getValueFromUser(currentPropObj, ret, ret, 'text')
            changes = true
            done = true
          }
        }
      } while (!done)
    }
    if (changes) {
      // clo(theme, `NPThemeCustomizer::editSyleAttribute full theme after edit. now saving...`)
      logDebug(pluginJson, `editStyleAttribute ${String(stylePath)} changed, saving theme`)
      await saveChangedTheme(theme, activeTheme.filename, pluginIDToCall, pluginCommandToCall, stylePath ? [stylePath] : [])
    }
    // gonna try to have chooseTheme do the reload
    // if (pluginIDToCall && pluginCommandToCall) {
    //   logDebug(pluginJson, `chooseTheme, After Editor.setTheme. Executing command: ${pluginCommandToCall} in plugin: ${pluginIDToCall}`)
    //   await DataStore.invokePluginCommandByName(pluginCommandToCall, pluginIDToCall, [stylePath])
    // }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
