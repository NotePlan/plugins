// @flow

// const pluginJson = 'helpers/NPPresets'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { getPluginJson, savePluginJson } from '@helpers/NPConfiguration'
import { chooseOption, showMessage } from '@helpers/userInput'

export type PresetCommand = {
  name: string,
  jsFunction: string,
  description: string,
  isPreset: ?boolean,
  hidden?: boolean,
  index?: number,
  data?: string,
}

/**
 * This file contains functions that allow you to use plugin.json to
 * create preset commands that a user can run directly from a keyboard shortcut
 * Here's how it works:
 * pluginJson holds some number of presets in the 'plugin.commands' section
 
There are 3 parts to a preset:
1. The command (saved in plugin.json) that a user sees/runs
2. The function (plugin entrypoint) which is called when user runs it
3. The settings which saves user settings because plugin.json gets overwritten every time the plugin updates
plugin.json:
 [commands]
    {
      "name": "Theme Chooser: Set Preset 01", // the name the user will give it
      "description": "Switch Theme", // Make this short/descriptive, because you see it behind the command name in CommandBar
      "jsFunction": "runPreset01",
      "data": "" //data stores data which can be used by the plugin when this item is selected
      "isPreset": true,
      "hidden": true // NOTE THIS CAN BE false if you want the command to be visible to users immediately (selecting it the first time will ask them to set it) 
    },
...
 [settings]
    {
      "key": "runPreset01",
      "type": "hidden",
      "default" : "",
      "title": "Preset 01",
      "description": "Do not change this setting manually. Use the \"/Change Theme Preset\" command."
    },
Main file:
export async function runPreset01() {
  try {
    await presetChosen(`runPreset01`, themePresetChosen)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
...and a function to process the clicks for this plugin in particular...
export async function themePresetChosen(commandDetails: PresetCommand | null = null, overwrite: boolean = false) {
  // one single function to process a click or a set/reset command -- see np.ThemeChooser/NPThemePresets for an example
}

IMPORTANT: Those functions should always be called runPresetXXX (the name is required)

When the command runs, it calls the shared presetChosen function, which looks up the object for that function
And passes it through to the callback passed (themePresetChosen in above example)

 * All commands are hidden when they are unset
 * Name field is what shows up for the user to see/choose from (by default in plugin.json shoudl be something like `Theme Chooser: Set Default 1`)
 * Description can be set to whatever
 * isPreset is set to true to be a preset
 * The jsFunction ties to a jsFunction in index.js as normal
 *
 * import { presetChosen } from '@helpers/NPPresets'
 */

/**
 * Show Users a list of command names and return the chosen command's jsFunction
 * @param {object} pluginJson - the entire settings object for a plugin
 * @param {?string} msg - to display to user
 * @param {?boolean} showHiddenValueOf - show commands that have a hidden field of true|false (leave blank for both)
 * @returns {string | false} - jsFunction string of command chosen or false
 * @author @dwertheimer
 */
export async function choosePreset(pluginJson: any, msg: string = 'Choose a preset to change', showHiddenValueOf: boolean | null = null): Promise<string | false> {
  const livePluginJson = await getPluginJson(pluginJson['plugin.id'])
  if (livePluginJson) {
    const commands = livePluginJson['plugin.commands']
    let presetCommands = commands.filter((command) => command.isPreset)
    if (showHiddenValueOf !== null) {
      presetCommands = presetCommands.filter((command) => command.hidden === showHiddenValueOf)
    }
    const opts = presetCommands.map((command) => ({ label: command.name, value: command.jsFunction }))
    if (opts.length) {
      return await await chooseOption(msg, opts)
    } else {
      logDebug(pluginJson, `choosePreset no preset commands and hidden=${String(showHiddenValueOf) || ''}`)
    }
  }
  return false
}

/**
 * Helper function (not called directly)
 * Change the name and description of a plugin command inside the plugin.json object
 * Returns the updated object (does not save anything) -- this function is called by savePluginCommand() which does save it
 * the functionName is the key of the command in the plugin.commands array to find
 * @author @dwertheimer
 * @param {object} pluginJson - the entire settings object for a plugin
 * @param {PresetCommand} fields - object with fields to set {jsFunction,name,description}
 * @param {boolean} commandHidden - should the command be hidden (not shown in the command bar) default is false
 * @return {object} pluginJson object
 */
export function updateJSONForFunctionNamed(pluginJson: any, fields: PresetCommand, commandHidden: ?boolean = false): any {
  const { jsFunction, ...rest } = fields
  const foundIndex = getCommandIndex(pluginJson, jsFunction)
  if (foundIndex != null && foundIndex > -1) {
    Object.keys(rest).forEach((key) => (pluginJson['plugin.commands'][foundIndex][key] = fields[key]))
    // pluginJson['plugin.commands'][foundIndex].name = name
    // pluginJson['plugin.commands'][foundIndex].description = description
    pluginJson['plugin.commands'][foundIndex].hidden = commandHidden
  }
  return pluginJson
}

/**
 * Update details of a plugin's command in its plugin.json file.
 * Also saves it to settings, so it can be recovered after a plugin upgrade.
 * @author @dwertheimer
 * @param {object} pluginJson - the existing pluginJson (used for pulling the plugin's ID)
 * @param {PresetCommand} fields - object with fields to set {jsFunction,name,description}
 * @returns {object | false} index of the found item in the commands array (or false)
 */
export async function savePluginCommand(pluginJson: any, fields: PresetCommand): Promise<any | false> {
  const { jsFunction } = fields
  if (jsFunction && jsFunction !== '') {
    logDebug(
      pluginJson,
      `savePluginCommand: running for plugin: ${pluginJson['plugin.id']}\nsetting: ${String(jsFunction)} to:\n\t"${JSP(fields)}"; First will pull the existing plugin.json`,
    )
    const livePluginJson = await getPluginJson(pluginJson['plugin.id'])
    if (livePluginJson) {
      const newPluginJson = updateJSONForFunctionNamed(livePluginJson, fields, false)
      // save command in settings so the command can be set there too when new plugin.json overwrites settings
      if (newPluginJson) {
        const settings = DataStore.settings
        if (settings) {
          DataStore.settings = { ...settings, ...{ [jsFunction]: fields } }
          return await savePluginJson(pluginJson['plugin.id'], newPluginJson)
        } else {
          logError(pluginJson, `savePluginCommand: Could not find settings for ${pluginJson['plugin.id']}`)
        }
      } else {
        logError(pluginJson, `savePluginCommand: Could not update plugin.json for ${pluginJson['plugin.id']}`)
      }
    } else {
      logError(pluginJson, `savePluginCommand: Could not find plugin.json for ${pluginJson['plugin.id']}`)
    }
  }
  return false
}

/**
 * Get a preset command object chosen by user and send it to a specific
 * callback for processing.
 * @author @dwertheimer
 * @param {object} pluginJson - the contents of plugin.json file
 * @param {string} jsFunction - the jsFunction (key) of the command chosen
 * @param {function} callback - a function to pass the chosen object to
 * @param {Array<any>} callbackArgs - arguments to pass to the callback function (after the command object) - empty args for error
 * NOTE: See function themePresetChosen in np.ThemeChooser for example callback
 */
export async function presetChosen(pluginJson: any, jsFunction: string, callback: function, callbackArgs: ?Array<any> = []): Promise<void> {
  // need try/catch here so we can use this immediately after pluginFunction
  try {
    const livePluginJson = await getPluginJson(pluginJson['plugin.id'])
    logDebug(pluginJson, `presetChosen: ${pluginJson['plugin.id']}::${jsFunction}`)
    const index = getCommandIndex(livePluginJson, jsFunction)
    if (index > -1) {
      clo(livePluginJson['plugin.commands'][index], `presetChosen Found "${jsFunction}" details in plugin.json:`)
      clo(callbackArgs, `presetChosen Found ${jsFunction} calling callback()" with args:`)
      await callback({ ...livePluginJson['plugin.commands'][index], index }, ...callbackArgs)
    } else {
      logError(pluginJson, `presetChosen: Could not find index for ${jsFunction}`)
      await showMessage(`Could not find preset: ${jsFunction}`)
      await callback()
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Find a command inside the pluginJson with the jsFunction (functionName) matching param.
 * @author @dwertheimer
 * @param {object} pluginJson - the entire settings object
 * @param {string} functionName - the name of the function to look for
 * @returns {number} index of the found item in the commands array (or -1)
 */
export function getCommandIndex(pluginJson: any, functionName: string): number {
  let foundIndex = -1
  if (pluginJson && pluginJson['plugin.commands']) {
    pluginJson['plugin.commands'].forEach((c, i) => {
      if (c.jsFunction === functionName) foundIndex = i
    })
  }
  return foundIndex
}

/**
 * Migrate user presets to fresh plugin.json after install
 * Because presets are stored in the plugin.json, we need a way to re-populate the plugin.json
 * after a new version of the plugin has been installed and overwritten plugin.json
 * @author @dwertheimer
 * @param {object} pluginJson - the entire settings object
 */
export async function rememberPresetsAfterInstall(pluginJson: any): Promise<void> {
  const settings = DataStore.settings
  const settingsKeys = Object.keys(settings)
  for (let index = 0; index < settingsKeys.length; index++) {
    const setting = settingsKeys[index]
    if (setting.includes('runPreset')) {
      // settings will be empty strings until they are set by a user
      if (settings[setting] === '') continue
      logDebug(pluginJson, `rememberPresetsAfterInstall: ${setting} was prev set to: ${JSP(settings[setting])}`)
      await savePluginCommand(pluginJson, settings[setting])
    }
  }
  // clo(pluginJson, `Before plugin update/install, pluginJson is:`)
  // const livePluginJson = await getPluginJson(pluginJson['plugin.id'])
  // clo(livePluginJson, `After plugin update/install, pluginJson is:`)
}
