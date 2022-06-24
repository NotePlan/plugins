// @flow
// From the command line:
// `noteplan-cli plugin:dev np.ThemeChooser --test --watch --coverage`

import * as helpers from './support/helpers'
import { log, logError, clo, JSP } from '@helpers/dev'
import { createRunPluginCallbackUrl } from '@helpers/general'
import { showMessage, chooseOption } from '@helpers/userInput'
import pluginJson from '../plugin.json'
import { setCommandDetailsForFunctionNamed, getCommandIndex } from '@helpers/config'
import { getPluginJson, savePluginJson } from '@helpers/NPConfiguration'

const BLANK = `Theme Chooser: Set Preset`
const PRESET_DESC = `Switch Theme`

export async function chooseTheme(incoming: ?string = ''): Promise<void> {
  // every command/plugin entry point should always be wrapped in a try/catch block
  try {
    const settings = DataStore.settings // Plugin settings documentation: https://help.noteplan.co/article/123-plugin-configuration
    const themes = Editor.availableThemes
    if (incoming?.length) {
      const themeName = incoming.trim()
      if (themes.includes(themeName)) {
        Editor.setTheme(themeName)
        return
      } else {
        await showMessage(`Theme "${incoming}" does not seem to be installed.`)
        log(
          pluginJson,
          `chooseTheme: Theme "${incoming}" does not seem to be installed. Installed = ${themes.toString()}`,
        )
      }
    }
    const selected = await getThemeChoice()
    Editor.setTheme(selected)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function getThemeChoice(): Promise<string> {
  const themes = Editor.availableThemes
  const selection = await CommandBar.showOptions(themes, 'Choose a Theme')
  return selection ? selection.value : BLANK
}

export async function saveThemeNameAsCommand(commandName: string, themeName: string) {
  const livePluginJson = await getPluginJson(pluginJson['plugin.id'])
  const newPluginJson = setCommandDetailsForFunctionNamed(livePluginJson, commandName, themeName, PRESET_DESC)
  const ret = await savePluginJson(pluginJson['plugin.id'], newPluginJson)
  log(pluginJson, `NPThemeChooser::presetChosen: after savePluginJson: ${String(ret)}`)
}

export async function changePreset() {
  const livePluginJson = await getPluginJson(pluginJson['plugin.id'])
  const commands = livePluginJson['plugin.commands']
  const presetCommands = commands.filter((command) => command.description === PRESET_DESC)
  const opts = presetCommands.map((command) => ({ label: command.name, value: command.jsFunction }))
  const chosen = await chooseOption('Choose a preset to change', opts)
  if (chosen) {
    await presetChosen(chosen, true)
  }
}

export async function presetChosen(selectedItem: string, overwrite: boolean = false) {
  const commandName = selectedItem
  const livePluginJson = await getPluginJson(pluginJson['plugin.id'])
  const index = getCommandIndex(livePluginJson, commandName)
  if (index > -1) {
    const commandDetails = livePluginJson['plugin.commands'][index]
    log(pluginJson, `presetChosen: command.name = "${commandDetails.name}"`)
    const themeIsUnset = commandDetails.name.match(/Theme Chooser: Set Preset/)
    console.log(themeIsUnset)
    if (themeIsUnset || overwrite) {
      const themeName = await getThemeChoice()
      await saveThemeNameAsCommand(commandName, themeName)
      await showMessage(
        `Menu command set to:\n"${themeName}"\nYou will find it in the CommandBar immediately, but won't see it in the menu until you restart NotePlan.`,
      )
    } else {
      Editor.setTheme(commandDetails.name)
      log(pluginJson, `Setting theme to: ${commandDetails.name}`)
    }
  } else {
    log(pluginJson, `presetChosen: ${commandName} not found`)
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
