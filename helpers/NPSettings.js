/* eslint-disable import/order */
// @flow

import moment from 'moment'
import { getPluginJson, saveSettings } from './NPConfiguration'
import { getInput, showMessage, showMessageYesNo, chooseOption } from './userInput'
import { clo, JSP, log, logDebug, logError, logInfo, timer } from '@helpers/dev'

const pluginJson = 'helpers/NPSettings'

function getSettingsFromPluginJson(pluginJson: any) {
  return pluginJson['plugin.settings']
}

/**
 * Get options array (label/value pairs for popup) for settings
 * @param {*} settingsArray - the [plugin.settings] array from plugin.json
 * @param {boolean} includeHidden - whether to include hidden settings (default is false)
 * @returns {*} settings array
 */
export function getSettingsOptions(settingsArray: any, includeHidden: boolean = false): any {
  let settings = settingsArray.filter((setting) => Boolean(setting.type))
  settings = settings.filter((setting) => setting.type !== 'separator')
  settings = includeHidden ? settings : settings.filter((setting) => setting.type !== 'hidden')
  return settings.map((setting) => {
    if (setting.type === 'heading') {
      return {
        label: setting.title.toUpperCase(),
        value: '---',
      }
    }
    return {
      label: `    ${setting.title}`,
      value: setting.key,
    }
  })
}

/**
 * hidden type - this should not ever be called because of the filter
 * @param {*} setting object
 * @param {*} currentValue
 * @returns {string}
 */
// eslint-disable-next-line no-unused-vars
export function updateSettingType_hidden(setting: any, currentValue: any): Promise<string> {
  return currentValue
}

/**
 * bool type
 * @param {*} setting object
 * @param {*} currentValue
 * @returns {boolean}
 */
export async function updateSettingType_bool(setting: any, currentValue: any): Promise<boolean> {
  const newVal = await showMessageYesNo(`"${setting.title}" is currently: '${currentValue}'. Set '${setting.title}' to:`, ['False', 'True'])
  return newVal === 'True'
}

/**
 * number type
 * @param {*} setting object
 * @param {*} currentValue
 * @returns {number}
 */
export async function updateSettingType_number(setting: any, currentValue: any): Promise<number> {
  const newVal = await getInput(`${setting.title} is currently: '${currentValue}'. Set '${setting.title}' to:`, 'OK', setting.title, currentValue)
  return Number(newVal)
}

/**
 * single string type
 * @param {*} setting object
 * @param {*} currentValue
 * @returns {string}
 */
export async function updateSettingType_string(setting: any, currentValue: any): Promise<string> {
  const newVal = await getInput(`Enter a value for '${setting.title}'`, 'OK', `${setting.title}`, currentValue)
  if (newVal !== false) {
    logDebug(pluginJson, `updateSettingType_string: newValue: ${newVal}`)
    return newVal
  } else {
    return currentValue
  }
}

/**
 * [string] type
 * @param {*} setting object
 * @param {*} currentValue
 * @returns {Array<string>}
 */
export async function updateSettingType__string_(setting: any, currentValue: any): Promise<Array<string>> {
  const newVal = await getInput(`Enter a value for '${setting.title}' as an array of strings separated by commas`, 'OK', `${setting.title}`, currentValue)
  if (newVal !== false) {
    logDebug(pluginJson, `updateSettingType_[string]: newValue: ${newVal}`)
    return newVal.split(',').map((item) => item.trim())
  } else {
    return currentValue
  }
}

/**
 * string CHOICES type
 * @param {*} setting object
 * @param {*} currentValue
 * @returns {string}
 */
export async function updateSettingType_stringChoices(setting: any, currentValue: any): Promise<string> {
  const choices = setting.choices.map((choice) => ({ label: choice, value: choice.trim() }))
  const newVal = await chooseOption(`Choose a value for '${setting.title}'`, choices, currentValue)
  if (newVal !== false) {
    logDebug(pluginJson, `updateSettingType_string: newValue: ${newVal}`)
    return newVal
  } else {
    return currentValue
  }
}

/**
 * date type
 * @param {*} setting
 */
export async function updateSettingType_date(setting: any, currentValue: any): Promise<Date | null> {
  const newVal = await getInput(`Enter a value for '${setting.title}' in the form YYYY-MM-DD`, 'OK', `${setting.title}`, currentValue)
  if (newVal !== false) {
    logDebug(pluginJson, `updateSettingType_date: newValue: ${newVal}`)
    return moment(newVal).toDate()
  } else {
    return null
  }
}

/**
 * json type
 * @param {*} setting
 */
export async function updateSettingType_json(setting: any, currentValue: any): Promise<string> {
  const newVal = await getInput(
    `Enter a value for '${setting.title}'. We know, this small box is awful for writing JSON. So write it somewhere else and paste it here.`,
    'OK',
    `${setting.title}`,
    currentValue,
  )
  if (newVal !== false) {
    logDebug(pluginJson, `updateSettingType_string: newValue: ${newVal}`)
    return JSON.parse(newVal)
  } else {
    return currentValue
  }
}

/**
 * all types
 */
const getNewValue = {
  updateSettingType_string,
  updateSettingType__string_,
  updateSettingType_number,
  updateSettingType_bool,
  updateSettingType_hidden,
  updateSettingType_date,
  updateSettingType_json,
  updateSettingType_stringChoices,
}

/**
 * After a user has selected a key to update, call the appropriate update function based on key name
 * @param {string} key - the key of the setting to update
 * @param {*} pluginJson - the current settings for this plugin (JSON)
 * @returns {boolean} success?
 */
export async function updateSetting(key: string, pluginJson: any): any {
  const settings = getSettingsFromPluginJson(pluginJson)
  const setting = settings.find((setting) => setting.key === key)
  const currentSettings = DataStore.settings
  if (setting) {
    logDebug(pluginJson, `updateSetting: ${key}`)
    try {
      const cleanType = setting.type.replace(/-/g, '_').replace(/\[|\]/g, '_')
      const updateFunction = `updateSettingType_${cleanType}${setting.choices ? 'Choices' : ''}`
      if (typeof getNewValue[updateFunction] === 'undefined') {
        throw `updateSetting: function name ${updateFunction} not specified`
      }
      if (setting.description) {
        await showMessage(`${setting.description}`, 'Continue', `About the setting: "${setting.title}"`)
      }
      // call the specific updater function for the setting type
      const newVal = await getNewValue[updateFunction](setting, currentSettings[key])
      // note: can't if (newVal) because newVal could be false
      if (newVal !== undefined && newVal !== null && newVal !== currentSettings[key]) {
        const settings = DataStore.settings
        settings[key] = newVal
        DataStore.settings = settings
        return true
      }
    } catch (error) {
      logError(pluginJson, `updateSetting: ${key} ${JSP(error)}`)
    }
  } else {
    logError(pluginJson, `No setting found with key ${key}`)
  }
  return false
}

/**
 * Choose from all commands in plugin.json to interactively edit a setting (for plugin settings changes on iOS)
 * Can be run directly as a jsFunction or called from another function.
 * @param {any} _pluginJson - the whole plugin json object (optional. if not provided, will be fetched from pluginID in DataStore.settings)
 * @returns {number} - number of edits made
 * @example 3 steps below. Change <plugin_name> and <plugin_id>:
 * Put in index.js: export { editSettings } from '@helpers/NPSettings'
 * Put in plugin.json/commands:     {
      "name": "<plugin_name>: Update Plugin Settings",
      "description": "Preferences",
      "jsFunction": "editSettings"
    },
 * Put in plugin.json/settings:     {
    {
      "type": "hidden",
      "key": "plugin_ID",
      "default": "<pluginid>"
    },
 */
export async function editSettings(_pluginJson?: any): Promise<number> {
  const { pluginID } = DataStore.settings
  const pluginJson = _pluginJson || (await getPluginJson(pluginID))
  if (!pluginJson) throw 'editSettings: no pluginJson or pluginID found. It needs to be passed in or set in DataStore.settings.pluginID'
  // clo(pluginJson, 'editSettings: plugin.json:')
  // clo(DataStore.settings, 'editSettings: starting settings:')
  const settings = getSettingsFromPluginJson(pluginJson)

  let editsMade = 0
  if (settings && settings.length) {
    let chosenSetting = null
    const settingsOptions = await getSettingsOptions(settings)
    while (chosenSetting !== '__done__') {
      logDebug('editSettings', `editSettings: top of while loop: editsMade=${editsMade}`)
      const msg = `Choose a${editsMade > 0 ? 'nother' : ''} setting to edit`
      logDebug('editSettings', `editSettings: msg="${msg}"`)
      chosenSetting = await chooseOption(msg, settingsOptions)
      logDebug('editSettings', `editSettings: after chooseOption: chosenSetting=${chosenSetting}`)
      if (chosenSetting && chosenSetting !== '__done__' && chosenSetting !== '---') {
        logDebug('editSettings', `editSettings: chosenSetting: "${chosenSetting}"`)
        await updateSetting(chosenSetting, pluginJson)
        logDebug('editSettings', `editSettings: updated: "${chosenSetting}"`)
      }
      if (editsMade === 0) {
        settingsOptions.unshift({ label: '[ ✅ Finished Editing Settings ]', value: '__done__' })
      }
      editsMade++
    }
    clo(DataStore.settings, 'editSettings: final settings:')
  } else {
    logError(pluginJson, 'NPSettings/editSettings(): No settings array found')
  }
  return editsMade
}

/**
 * Append a new string to end of an existing [string] setting in the plugin's settings.json file
 * @param {string} key to append to
 * @param {string} newItem to append
 * @param {boolean?} triggerSettingsUpdate? defaults to triggering onSettingsUpdated when writing the file
 * @returns {boolean} success?
 */
export async function appendStringToSettingArray(pluginId: string, key: string, newItem: string, triggerSettingsUpdate: boolean = true): Promise<boolean> {
  logDebug(pluginJson, `appendStringToSettingArray() starting for plugin '${pluginId}', key '${key}' and triggerSettingsUpdate? '${String(triggerSettingsUpdate)}'`)
  const currentSettings = DataStore.settings
  // clo(currentSettings, 'before')
  const currentSettingForKey = currentSettings[key]
  logDebug('appendStringToSettingArray', `- '${key}' currently '${String(currentSettingForKey)}'`)
  if (currentSettingForKey) {
    logDebug('appendStringToSettingArray', `- appending '${newItem}'`)
    try {
      // call the specific updater function for the setting type
      const newValArray: Array<string> = typeof currentSettingForKey === 'string' ? [currentSettingForKey] : currentSettingForKey
      // logDebug('appendStringToSettingArray', `- newValArray '${String(newValArray)}' (${typeof newValArray})`)
      newValArray.push(newItem.trim())
      // logDebug('appendStringToSettingArray', `-> '${String(newValArray)}' (${typeof newValArray})`)
      if (newValArray != null) {
        currentSettings[key] = newValArray
        // DataStore.settings = currentSettings
        await saveSettings(pluginId, currentSettings, triggerSettingsUpdate)
        return true
      } else {
        logDebug('appendStringToSettingArray', `-> nothing to update`)
      }
    } catch (error) {
      logError('appendStringToSettingArray', `appendStringToSettingArray: ${key} ${JSP(error)}`)
    }
  } else {
    logInfo('appendStringToSettingArray', `No setting found with key ${key}: will create it`)
    currentSettings[key] = [newItem.trim()]
    DataStore.settings = currentSettings
    return true
  }
  return false
}
