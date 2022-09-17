// @flow

const pluginJson = '../plugin.json'
import { getThemeChoice } from './NPThemeChooser'
import * as masterTheme from './support/masterTheme.json'
import { chooseOption, showMessageYesNo, showMessage } from '@helpers/userInput'
import { log, logError, logDebug, timer, clo, JSP, getFilteredProps } from '@helpers/dev'

/**
 * Write out edited theme file
 * @param {any} themeObj
 * @param {filePath} filePath
 */
export async function saveTheme(themeObj: any, filename: string) {
  // save out the revised theme
  const result = DataStore.saveJSON(themeObj, `../../../Themes/${filename}`)
  if (!result) {
    await showMessage(`Could not write to theme: ${filename}`)
  } else {
    await showMessage(`Saved theme: "${filename}"`)
  }
}

/**
 * Choose a style from the master style template (in this plugin in /src/support/masterTheme.json)
 * Plugin entrypoint for command: "/Add a Style to Current Theme"
 */
export async function copyThemeStyle() {
  try {
    if (!Editor) {
      showMessage(`You must be in the Editor with a document open to run this command`)
      return
    }
    // @qualitativeeasing: this works, but should probably turn this into a do-while loop so you can keep adding styles without re-invoking the plugin. just put a showMessageYesNo at the end asking if they want to add more
    // clo(masterTheme, `NPStyleChooser::copyThemeStyle masterTheme=`) //if you want to console.log the whole theme file
    // NOTE: in order to see the console logs, go to the plugin settings and set log level to DEBUG
    const { styles } = masterTheme // pluck just the styles property from the theme file
    const keys = Object.keys(styles)
    // @QualitativeEasing: Add a description to each key in the masterTheme (I just put one of my themes there temporarily -- you may have more complete ones)
    const optionText = keys.map((k) => ({ label: `${k}${styles[k].description ? ` (${styles[k].description})` : ''}`, value: k }))
    const chosenStyle = await chooseOption(`Choose a Style`, optionText, '')
    if (chosenStyle !== '') {
      const allThemes = Editor.availableThemes
      const myThemeName = await getThemeChoice('', `What theme do you want to add it to?`)
      logDebug(pluginJson, `User chose theme: "${myThemeName}`)
      const myThemeObj = allThemes.filter((t) => t.name === myThemeName)[0]
      // Editor.availableThemes sends back the themes wrapped in an object with extra data (.name && .filename)
      // so to get the actual theme file data, we look under the .values property
      const myThemeObjStyles = myThemeObj.values.styles
      clo(myThemeObj, `NPStyleChooser::copyThemeStyle myThemeObj=`)
      let writeIt = true
      if (myThemeObjStyles.hasOwnProperty('chosenStyle')) {
        const replace = await showMessageYesNo(`The key "${chosenStyle}" already exists in theme: "${myThemeName}". Replace it?`)
        if (replace && replace === 'yes') {
          myThemeObjStyles[chosenStyle] = styles[chosenStyle]
        } else {
          writeIt = false
        }
      } else {
        myThemeObj.values.styles = { ...myThemeObjStyles, ...styles[chosenStyle] }
      }
      if (writeIt) {
        await saveTheme(myThemeObj.values, myThemeObj.filename)
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Edit a style
 * Plugin entrypoint for command: "/Edit a Theme Style Attribute"
 */
export async function editStyleAttribute() {
  try {
    if (!Editor) {
      showMessage(`You must be in the Editor with a document open to run this command`)
      return
    }
    const activeTheme = Editor.currentTheme
    const theme = activeTheme.values
    let done = false,
      changes = false,
      currentPropObj = { ...theme }
    do {
      const propsThisLevel = getFilteredProps(currentPropObj)
      const opts = propsThisLevel.map((p) => ({ label: `${p}`, value: p }))
      const ret = await chooseOption(`Choose an option to edit`, opts, '')
      if (ret === '') {
        done = true
      } else {
        logDebug(pluginJson, `User selected: "${ret}" from: \n${propsThisLevel.toString()} \n...typeof currentPropObj[ret]=${typeof currentPropObj[ret]}`)
        if (typeof currentPropObj[ret] === 'object') {
          currentPropObj = currentPropObj[ret]
        } else {
          // prompt user to set
          const newVal = await CommandBar.textPrompt(`Set value for ${ret}`, `Previous value: ${currentPropObj[ret]}`, currentPropObj[ret])
          if (newVal) {
            logDebug(pluginJson, `User changed ${currentPropObj[ret]} to ${newVal} (typeof currentPropObj[ret] = ${typeof currentPropObj[ret]})`)
            switch (typeof currentPropObj[ret]) {
              case 'number':
                currentPropObj[ret] = Number(newVal)
                break
              case 'boolean':
                currentPropObj[ret] = Boolean(newVal)
                break
              default:
                currentPropObj[ret] = String(newVal)
                break
            }
            changes = true
            done = true
          }
        }
      }
    } while (!done)
    if (changes) {
      clo(theme, `NPThemeCustomizer::editSyleAttribute full theme after edit`)
      await saveTheme(theme, activeTheme.filename)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
