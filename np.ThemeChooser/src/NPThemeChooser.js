// @flow
// From the command line:
// `noteplan-cli plugin:dev np.ThemeChooser --test --watch --coverage`

import pluginJson from '../plugin.json'
import { logDebug, log, logError, clo, JSP } from '../../helpers/dev'
import { showMessage, showMessageYesNo, chooseOption } from '@helpers/userInput'

/**
 * Get the theme object by name
 * @param {string} name - the name of the theme to get
 * @returns {any} - the object of the theme
 */
export async function getThemeObjByName(name: string): Promise<any | null> {
  const themes = Editor.availableThemes
  logDebug(pluginJson, `getThemeObjByName, looking for ${name}, total themes: ${themes.length}`)
  const theme = themes.filter((t) => t.name === name)
  // clo(theme,`getThemeObjByName After filter`)
  logDebug(pluginJson, `getThemeObjByName, after filter themename = ${theme[0].name}`)
  if (theme.length) {
    return theme[0]
  } else {
    await showMessage(`Could not find theme named: ${name}`)
    return null
  }
}

export async function chooseTheme(incoming: ?string = ''): Promise<void> {
  // every command/plugin entry point should always be wrapped in a try/catch block
  try {
    // const settings = DataStore.settings // Plugin settings documentation: https://help.noteplan.co/article/123-plugin-configuration
    if (incoming?.length) {
      const themeName = incoming.trim()
      const theme = await getThemeObjByName(themeName)
      if (theme && theme.filename) {
        Editor.setTheme(theme.filename)
        return
      } else {
        await showMessage(`Theme "${incoming}" does not seem to be installed.`)
        logDebug(pluginJson, `chooseTheme: Theme "${incoming}" does not seem to be installed. Installed = ${themes.toString()}`)
        return
      }
    }
    const themeName = await getThemeChoice()
    logDebug(pluginJson, `chooseTheme: ${themeName} chosen`)
    const selected = await getThemeObjByName(themeName)
    if (selected && selected.filename) {
      Editor.setTheme(selected.filename)
    } else {
      logError(pluginJson, `chooseTheme filename does not exist: selected=${JSP(selected)}`)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Ask user to choose a theme, return the name (string) of the chosen theme
 * @param {string} lightOrDark //not currently used
 * @returns {string} theme name or default -- BLANK: "Theme Chooser: Set Preset"
 */
export async function getThemeChoice(lightOrDark: string = '', message: string = 'Choose a Theme'): Promise<string> {
  const themeData = Editor.availableThemes // {name:string,mode:'light'|'dark',values:<themedata>}
  const themeOpts = themeData.map((t) => t.name)
  if (lightOrDark !== '') {
    // would be nice to filter here, but how to read system themes?
  }
  const selection = await CommandBar.showOptions(themeOpts, message)
  return selection ? selection.value : ''
}

/*
 * PLUGIN ENTRYPOINTS BELOW THIS LINE
 */

export async function setDefaultLightDarkTheme() {
  try {
    const which = await showMessageYesNo(
      `Default Light/Dark Themes need to be set on a per-device basis. Which default theme do you want to set?`,
      ['Light', 'Dark'],
      `Set device default Light/Dark theme`,
    )
    const themeName = await getThemeChoice(which)
    const themeObj = await getThemeObjByName(themeName)
    const themeChoice = themeObj?.name || ''
    if (themeChoice.length && which) {
      if (which === 'Light') {
        DataStore.setPreference('themeChooserLight', themeChoice)
        Editor.saveDefaultTheme(themeChoice, which.toLowerCase())
      } else {
        DataStore.setPreference('themeChooserDark', themeChoice)
        Editor.saveDefaultTheme(themeChoice, which.toLowerCase())
      }
      await showMessage(`Default ${which} theme set to: ${themeChoice}. You may need to restart NotePlan to see it in action.`)
      logDebug(pluginJson, `setDefaultLightDarkTheme set${which} to ${themeChoice}`)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Toggle between light and dark theme
 * Originally had to ask which you want because there was no way to know if you were in light/dark mode, but now we know so
 * TODO: do something more automatic with light/dark?
 * (entry point for /Toggle Light/Dark Theme)
 */
export async function toggleTheme() {
  try {
    const lightTheme = String(DataStore.preference('themeChooserLight')) || ''
    const darkTheme = String(DataStore.preference('themeChooserDark')) || ''
    logDebug(pluginJson, `toggleTheme: lightTheme = ${String(lightTheme)} | darkTheme = ${String(darkTheme)}`)
    if (lightTheme && darkTheme) {
      const current = Editor.currentTheme
      logDebug(pluginJson, `toggleTheme Editor.currentTheme.name = "${current.name}"`)
      let switchTo = ''
      if (current.name === lightTheme) {
        switchTo = darkTheme
      } else if (current.name === darkTheme) {
        switchTo = lightTheme
      } else {
        const opts = [
          { label: `Light: "${String(lightTheme)}"`, value: String(lightTheme) },
          { label: `Dark: "${String(darkTheme)}"`, value: String(darkTheme) },
          { label: `[Change Default Light/Dark Themes]`, value: `__change__` },
        ]
        switchTo = await chooseOption(`Which theme do you want to switch to?`, opts, opts[0].value)
        if (switchTo === '__change__') {
          await setDefaultLightDarkTheme()
          await toggleTheme()
          return
        }
      }
      if (switchTo !== '') {
        const theme = await getThemeObjByName(switchTo)
        if (theme) {
          logDebug(pluginJson, `toggleTheme: Setting theme to: ${switchTo}`)
          Editor.setTheme(theme.filename)
        } else {
          logError(pluginJson, `toggleTheme: could not find theme: ${switchTo}`)
          await showMessage(`could not find theme: ${switchTo}`)
        }
      } else {
        logError(pluginJson, `toggleTheme: switchTo was blank ${switchTo}`)
      }
    } else {
      await showMessage(`You need to set the default Light and Dark themes first.\nYour current themes are:\nLight: ${String(lightTheme)}\nDark: ${String(darkTheme)}`)
      await setDefaultLightDarkTheme()
      await toggleTheme()
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
