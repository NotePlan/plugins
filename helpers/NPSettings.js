/* eslint-disable import/order */
// @flow

import { getInput, showMessage, showMessageYesNo, chooseOption } from './userInput'

import moment from 'moment'

const pluginJson = 'helpers/NPSettings'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'

function getSettingsFromPluginJson(pluginJson: any) {
  return pluginJson['plugin.settings']
}

/**
 * Get options array (label/value pairs for popup) for settings
 * @param {} settingsArray - the [plugin.settings] array from plugin.json
 * @param {boolean} includeHidden - whether to include hidden settings (default is false)
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
 * @param {*} setting
 */
// eslint-disable-next-line no-unused-vars
export function updateSettingType_hidden(setting: any, currentValue: any): Promise<string> {
  return currentValue
}

/**
 * bool type
 * @param {*} setting
 */
export async function updateSettingType_bool(setting: any, currentValue: any): Promise<boolean> {
  const newVal = await showMessageYesNo(`"${setting.title}" is currently: '${currentValue}'. Set '${setting.title}' to:`, ['False', 'True'])
  return newVal === 'True'
}

/**
 * number type
 * @param {*} setting
 */
export async function updateSettingType_number(setting: any, currentValue: any): Promise<number> {
  const newVal = await getInput(`${setting.title} is currently: '${currentValue}'. Set '${setting.title}' to:`, 'OK', setting.title, currentValue)
  return Number(newVal)
}

/**
 * single string type
 * @param {string} setting
 */
export async function updateSettingType_string(setting: any, currentValue: any): Promise<string> {
  const newVal = await getInput(`Enter a value for '${setting.title}'`, 'OK', `${setting.title}`, currentValue)
  if (newVal !== false) {
    logDebug(pluginJson, `updateSettingType_string: newValue: ${newVal}`)
    return newVal
  }
  return currentValue
}

/**
 * [string] type
 * @param {*} setting
 */
export async function updateSettingType__string_(setting: any, currentValue: any): Promise<Array<string>> {
  const newVal = await getInput(`Enter a value for '${setting.title}' as an array of strings separated by commas`, 'OK', `${setting.title}`, currentValue)
  if (newVal !== false) {
    logDebug(pluginJson, `updateSettingType_[string]: newValue: ${newVal}`)
    return newVal.split(',').map((item) => item.trim())
  }
  return currentValue
}

/**
 * string CHOICES type
 * @param {string} setting
 */
export async function updateSettingType_stringChoices(setting: any, currentValue: any): Promise<string> {
  const choices = setting.choices.map((choice) => ({ label: choice, value: choice.trim() }))
  const newVal = await chooseOption(`Choose a value for '${setting.title}'`, choices, currentValue)
  if (newVal !== false) {
    logDebug(pluginJson, `updateSettingType_string: newValue: ${newVal}`)
    return newVal
  }
  return currentValue
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
  }
  return null
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
  }
  return currentValue
}

/**
 * string type
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
 * @param {any} pluginJson
 * @returns
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
 * Choose from all commands in plugin.json to edit a setting (for plugin settings changes on iOS)
 * @param {*} pluginJson - the whole plugin json object
 *
 */
export async function editSettings(pluginJson: any): Promise<number> {
  clo(DataStore.settings, 'editSettings: starting settings:')
  const settings = getSettingsFromPluginJson(pluginJson)

  let editsMade = 0
  if (settings && settings.length) {
    let chosenSetting = null
    const settingsOptions = await getSettingsOptions(settings)
    while (chosenSetting !== '__done__') {
      logDebug(pluginJson, `editSettings: top of while loop: editsMade=${editsMade}`)
      const msg = `Choose a${editsMade > 0 ? 'nother' : ''} setting to edit`
      logDebug(pluginJson, `editSettings: msg="${msg}"`)
      chosenSetting = await chooseOption(msg, settingsOptions)
      logDebug(pluginJson, `editSettings: after chooseOption: chosenSetting=${chosenSetting}`)
      if (chosenSetting && chosenSetting !== '__done__' && chosenSetting !== '---') {
        logDebug(pluginJson, `editSettings: chosenSetting: "${chosenSetting}"`)
        await updateSetting(chosenSetting, pluginJson)
        logDebug(pluginJson, `editSettings: updated: "${chosenSetting}"`)
      }
      if (editsMade === 0) {
        settingsOptions.unshift({ label: '[ ✅ Finished Editing Settings ]', value: '__done__' })
      }
      editsMade++
    }
    clo(DataStore.settings, 'editSettings: final settings:')
  } else {
    logError(pluginJson, 'No settings array found')
  }
  return editsMade
}
