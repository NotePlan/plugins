// @flow
// From the command line:
// `noteplan-cli plugin:dev np.ThemeChooser --test --watch --coverage`

import pluginJson from '../plugin.json'
import { logDebug , log, logError, clo, JSP } from "../../helpers/dev"
import { showMessage, showMessageYesNo, chooseOption } from '@helpers/userInput'
import { setCommandDetailsForFunctionNamed, getCommandIndex } from '@helpers/config'
import { getPluginJson, savePluginJson } from '@helpers/NPConfiguration'

const BLANK = `Theme Chooser: Set Preset`
const PRESET_DESC = `Switch Theme`

/**
 * Get the theme object by name
 * @param {string} name - the name of the theme to get
 * @returns {any} - the object of the theme
 */
async function getThemeObjByName(name:string): Promise<any|null> {
  const themes = Editor.availableThemes
  logDebug(pluginJson,`getThemeObjByName, looking for ${name}, total themes: ${themes.length}`)
  const theme = themes.filter(t=>t.name === name)
  // clo(theme,`getThemeObjByName After filter`)
  logDebug(pluginJson,`getThemeObjByName, after filter themename = ${theme[0].name}`)
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
    logDebug(pluginJson,`chooseTheme: ${themeName} chosen`)
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
 * Ask user to choose a theme, return the name of the chosen theme
 * @param {string} lightOrDark //not currently used
 * @returns {string} theme name or default -- BLANK: "Theme Chooser: Set Preset"
 */
export async function getThemeChoice(lightOrDark: string = ''): Promise<string> {
  const themeData = Editor.availableThemes // {name:string,mode:'light'|'dark',values:<themedata>}
  const themeOpts = themeData.map(t=>t.name)
  if (lightOrDark !== '') {
    // would be nice to filter here, but how to read system themes?
  }
  const selection = await CommandBar.showOptions(themeOpts, 'Choose a Theme')
  return selection ? selection.value : BLANK
}

export async function saveThemeNameAsCommand(commandName: string, themeName: string) {
  if (themeName !== '') {
    logDebug(pluginJson, `NPThemeChooser::saveThemeNameAsCommand: setting: ${String(commandName)} to: ${String(themeName)}; First will pull the existing plugin.json`)
    const livePluginJson = await getPluginJson(pluginJson['plugin.id'])
    const newPluginJson = setCommandDetailsForFunctionNamed(livePluginJson, commandName, themeName, PRESET_DESC, false)
    const settings = DataStore.settings
    DataStore.settings = { ...settings, ...{ [commandName]: themeName } }
    const ret = await savePluginJson(pluginJson['plugin.id'], newPluginJson)
    logDebug(pluginJson, `NPThemeChooser::saveThemeNameAsCommand:  savePluginJson result = ${String(ret)}`)
  }
}

export async function changePreset() {
  const livePluginJson = await getPluginJson(pluginJson['plugin.id'])
  if (livePluginJson) {
    const commands = livePluginJson['plugin.commands']
    const presetCommands = commands.filter((command) => command.description === PRESET_DESC)
    const opts = presetCommands.map((command) => ({ label: command.name, value: command.jsFunction }))
    const chosen = await chooseOption('Choose a preset to change', opts)
    if (chosen) {
      await presetChosen(chosen, true)
    }
  }
}

export async function presetChosen(selectedItem: string, overwrite: boolean = false) {
  const commandName = selectedItem
  const livePluginJson = await getPluginJson(pluginJson['plugin.id'])
  const index = getCommandIndex(livePluginJson, commandName)
  if (livePluginJson && index > -1) {
    const commandDetails = livePluginJson['plugin.commands'][index]
    logDebug(pluginJson, `presetChosen: command.name = "${commandDetails.name}"`)
    const themeIsUnset = commandDetails.name.match(/Theme Chooser: Set Preset/)
    logDebug(`presetChosen: themeIsUnset=${themeIsUnset}`)
    if (themeIsUnset || overwrite) {
      const themeObj = await getThemeChoice()
      const themeName = themeObj.name
      await saveThemeNameAsCommand(commandName, themeName)
      await showMessage(`Menu command set to:\n"${themeName}"\nYou will find it in the CommandBar immediately, but won't see it in the menu until you restart NotePlan.`)
    } else {
      const theme = await getThemeObjByName(commandDetails.name)
      if (theme) {
        logDebug(pluginJson, `presetChosen: Setting theme to: ${commandDetails.name}`)
        Editor.setTheme(theme.filename)
      } else {
        logError(pluginJson, `presetChosen: ${commandName} theme not found`)
        await showMessage(`Could not find theme named "${commandName}"`)        
      }
    }
  } else {
    logError(pluginJson, `presetChosen: ${commandName} not found`)
    await showMessage(`Could not find preset theme named "${commandName}"`)
  }
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
        Editor.saveDefaultTheme(themeChoice,which.toLowerCase())
      } else {
        DataStore.setPreference('themeChooserDark', themeChoice)
        Editor.saveDefaultTheme(themeChoice,which.toLowerCase())
      }
      await showMessage(`Default ${which} theme set to: ${themeChoice}. You may need to restart NotePlan to see it in action.`)
      logDebug(pluginJson,`setDefaultLightDarkTheme set${which} to ${themeChoice}`)
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
      logDebug(pluginJson,`toggleTheme Editor.currentTheme.name = "${current.name}"`)
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
        logError(pluginJson,`toggleTheme: switchTo was blank ${switchTo}`)
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

export async function setPreset01() {
  try {
    await presetChosen(`setPreset01`)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
export async function setPreset02() {
  try {
    await presetChosen(`setPreset02`)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
export async function setPreset03() {
  try {
    await presetChosen(`setPreset03`)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
export async function setPreset04() {
  try {
    await presetChosen(`setPreset04`)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
export async function setPreset05() {
  try {
    await presetChosen(`setPreset05`)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
