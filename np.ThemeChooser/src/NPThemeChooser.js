// @flow
// From the command line:
// `noteplan-cli plugin:dev np.ThemeChooser --test --watch --coverage`

import pluginJson from '../plugin.json'
import { log, logError, clo, JSP } from '@helpers/dev'
import { showMessage, showMessageYesNo, chooseOption } from '@helpers/userInput'
import { setCommandDetailsForFunctionNamed, getCommandIndex } from '@helpers/config'
import { getPluginJson, savePluginJson } from '@helpers/NPConfiguration'

const BLANK = `Theme Chooser: Set Preset`
const PRESET_DESC = `Switch Theme`

export async function chooseTheme(incoming: ?string = ''): Promise<void> {
  // every command/plugin entry point should always be wrapped in a try/catch block
  try {
    // const settings = DataStore.settings // Plugin settings documentation: https://help.noteplan.co/article/123-plugin-configuration
    const themes = Editor.availableThemes
    if (incoming?.length) {
      const themeName = incoming.trim()
      if (themes.includes(themeName)) {
        Editor.setTheme(themeName)
        return
      } else {
        await showMessage(`Theme "${incoming}" does not seem to be installed.`)
        log(pluginJson, `chooseTheme: Theme "${incoming}" does not seem to be installed. Installed = ${themes.toString()}`)
      }
    }
    const selected = await getThemeChoice()
    Editor.setTheme(selected)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function getThemeChoice(lightOrDark: string = ''): Promise<string> {
  const themes = Editor.availableThemes
  if (lightOrDark !== '') {
    // would be nice to filter here, but how to read system themes?
  }
  const selection = await CommandBar.showOptions(themes, 'Choose a Theme')
  return selection ? selection.value : BLANK
}

export async function saveThemeNameAsCommand(commandName: string, themeName: string) {
  if (themeName !== '') {
    log(pluginJson, `NPThemeChooser::saveThemeNameAsCommand: setting: ${String(commandName)} to: ${String(themeName)}; First will pull the existing plugin.json`)
    const livePluginJson = await getPluginJson(pluginJson['plugin.id'])
    const newPluginJson = setCommandDetailsForFunctionNamed(livePluginJson, commandName, themeName, PRESET_DESC, false)
    const settings = DataStore.settings
    DataStore.settings = { ...settings, ...{ [commandName]: themeName } }
    const ret = await savePluginJson(pluginJson['plugin.id'], newPluginJson)
    log(pluginJson, `NPThemeChooser::saveThemeNameAsCommand:  savePluginJson result = ${String(ret)}`)
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
    log(pluginJson, `presetChosen: command.name = "${commandDetails.name}"`)
    const themeIsUnset = commandDetails.name.match(/Theme Chooser: Set Preset/)
    console.log(themeIsUnset)
    if (themeIsUnset || overwrite) {
      const themeName = await getThemeChoice()
      await saveThemeNameAsCommand(commandName, themeName)
      await showMessage(`Menu command set to:\n"${themeName}"\nYou will find it in the CommandBar immediately, but won't see it in the menu until you restart NotePlan.`)
    } else {
      Editor.setTheme(commandDetails.name)
      log(pluginJson, `Setting theme to: ${commandDetails.name}`)
    }
  } else {
    log(pluginJson, `presetChosen: ${commandName} not found`)
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
    const themeChoice = await getThemeChoice(which)
    if (themeChoice && which) {
      if (which === 'Light') {
        DataStore.setPreference('themeChooserLight', themeChoice)
      } else {
        DataStore.setPreference('themeChooserDark', themeChoice)
      }
      await showMessage(`Default ${which} theme set to: ${themeChoice}. You may need to restart NotePlan to see it in action.`)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function toggleTheme() {
  try {
    const lightTheme = DataStore.preference('themeChooserLight')
    const darkTheme = DataStore.preference('themeChooserDark')
    log(pluginJson, `toggleTheme: lightTheme = ${String(lightTheme)} | darkTheme = ${String(darkTheme)}`)
    if (lightTheme && darkTheme) {
      const opts = [
        { label: `Light: "${String(lightTheme)}"`, value: String(lightTheme) },
        { label: `Dark: "${String(darkTheme)}"`, value: String(darkTheme) },
        { label: `[Change Default Light/Dark Themes]`, value: `__change__` },
      ]
      const switchTo = await chooseOption(`Which theme do you want to switch to?`, opts, opts[0].value)
      if (switchTo === '__change__') {
        await setDefaultLightDarkTheme()
      } else {
        Editor.setTheme(switchTo)
        log(pluginJson, `Theme Toggle: Setting theme to: ${switchTo}`)
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
