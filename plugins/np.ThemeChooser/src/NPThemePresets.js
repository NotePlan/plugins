// @flow

import pluginJson from '../plugin.json'
import { getThemeChoice } from './NPThemeChooser'
import { getThemeObj } from './NPThemeShared'
import { showMessage } from '@helpers/userInput'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { type PresetCommand, savePluginCommand, choosePreset, presetChosen } from '@helpers/NPPresets'
import { getPluginJson } from '@helpers/NPConfiguration'

/**
 * Each of the preset commands calls this function, as does set/reset a command
 * It is called indirectly, as a callback sent to presetChosen
 * @param {PresetCommand} commandDetails - the full command object from the current plugin.json
 * @param {boolean} overwrite - this is a set/reset call
 */
export async function themePresetChosen(commandDetails: PresetCommand | null = null, overwrite: boolean = false) {
  if (!Editor) {
    showMessage(`You must be in the Editor with a document open to run this command`)
    return
  }
  clo(commandDetails, `themePresetChosen: overwrite:${String(overwrite)} commandDetails:`)
  if (commandDetails) {
    const commandName = commandDetails.name
    logDebug(pluginJson, `themePresetChosen: command.name = "${commandDetails.name}" overwrite?:${String(overwrite)}`)
    // Put the text of an unset command in the plugin.json here (how we tell if it's vanilla/unset)
    const themeIsUnset = !commandDetails.name || commandDetails.name.match(/Theme Chooser: Set Preset/)
    logDebug(pluginJson, `themePresetChosen: themeIsUnset=${String(themeIsUnset)}`)
    if (themeIsUnset || overwrite) {
      // SET THE PRESET COMMAND
      const themeName = await getThemeChoice()
      if (themeName !== '') {
        const text = await CommandBar.textPrompt('Set Preset', 'What text do you want to use for the command?', `${themeName}`)
        if (text) {
          await savePluginCommand(pluginJson, { ...commandDetails, name: text, data: themeName })
          await showMessage(`Menu command set to:\n"${themeName}"\nYou will find it in the CommandBar immediately, but won't see it in the menu until you restart NotePlan.`)
        }
      }
    } else {
      // EXECUTE THE COMMAND CLICKED
      if (commandDetails.data) {
        const theme = await getThemeObj(commandDetails.data)
        if (theme) {
          logDebug(pluginJson, `themePresetChosen: Setting theme to: ${theme.name}`)
          Editor.setTheme(theme.filename)
        } else {
          logError(pluginJson, `themePresetChosen: ${commandName} theme not found`)
          await showMessage(`Could not find theme named "${commandName}"`)
        }
      } else {
        logDebug(pluginJson, `themePresetChosen No commandDetails.data for command: ${commandName}. Cannot move forward.`)
      }
    }
  } else {
    logError(pluginJson, `themePresetChosen: no command details object sent. Cannot continue.`)
  }
}

/*
 * PLUGIN ENTRYPOINTS BELOW THIS LINE
 */

/**
 * Change a preset to another one
 * Plugin entrypoint for command: "/Change Theme Preset"
 * @param {*} incoming
 */
export async function changePreset(incoming: string) {
  try {
    logDebug(pluginJson, `changePreset  running incoming:${incoming}`)
    const livePluginJson = await getPluginJson(pluginJson['plugin.id'])
    const chosen = await choosePreset(livePluginJson, 'Choose a preset to set/reset')
    if (chosen) {
      logDebug(pluginJson, `changePreset: ${chosen} -- calling presetChosen with themePresetChosen callback`)
      await presetChosen(pluginJson, chosen, themePresetChosen, [true])
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * PRESET ENTRYPOINTS BELOW
 */

export async function runPreset01() {
  try {
    await presetChosen(pluginJson, `runPreset01`, themePresetChosen)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function runPreset02() {
  try {
    await presetChosen(pluginJson, `runPreset02`, themePresetChosen)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
export async function runPreset03() {
  try {
    await presetChosen(pluginJson, `runPreset03`, themePresetChosen)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
export async function runPreset04() {
  try {
    await presetChosen(pluginJson, `runPreset04`, themePresetChosen)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
export async function runPreset05() {
  try {
    await presetChosen(pluginJson, `runPreset05`, themePresetChosen)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
