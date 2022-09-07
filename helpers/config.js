// @flow

import { logDebug } from './dev'

/**
 * Check whether this config meets a minimum defined spec of keys and types. This function replaces
 * the old validateMinimumConfig function
 * @author @dwertheimer
 * @param {object} config - configuration object as structured JSON5 object
 * @param {object} validations - JSON5 object to use as types for this configuration section (see example below). All properties are required unless set as optional
 * @return {object} return config if it passes OR throws an error with description of what failed (wrap call to this function in tr/catch)
 * @example validations = {
 *   // the format of the validations object is:
 *   fieldName: 'type' // where type is one of: string, number, boolean, regex, array, object
 *   // type can be 'string' for any string, or a /regex/ if the string must match the regex
 *   propertyThatShouldBeAnyString: 'string',
 *   propertyThatIsStringButShouldMatchRegex: /^[a-zA-Z0-9]+$/,
 *   propertyThatShouldBeNumber: 'number',
 *   propertyThatShouldBeBoolean: 'boolean',
 *   propertyThatShouldBeArray: 'array',
 *   propertyThatShouldBeObject: 'object',
 * // all the aforementioned properties are required. here's an optional property:
 *   propertyThatIsOptional: {type: 'string', optional: true},
 * }
 * try {
 *  validateConfigProperties(config, validations)
 * } catch (e) {
 *  console.log(e.message)
 * }
 */
export function validateConfigProperties(config: { [string]: mixed }, validations: { [string]: mixed }): { [string]: mixed } {
  let failed = ''
  const propsToValidate = Object.keys(validations)
  if (propsToValidate.length) {
    propsToValidate.forEach((v) => {
      const isOptional = typeof validations[v] === 'object' && validations[v]?.optional
      // $FlowIgnore
      const requiredType = isOptional && validations[v]?.type ? validations[v].type : validations[v]
      const configFieldValue = config[v]

      if (configFieldValue === null || configFieldValue === undefined) {
        if (!isOptional) {
          logDebug(`validateConfigProperties: configFieldValue: ${configFieldValue ?? 'null'} for ${v} is null or undefined`)
          failed = `Config required field: "${v}" is missing;\n`
        }
      } else {
        if (requiredType instanceof RegExp) {
          if (typeof configFieldValue !== 'string' || !requiredType.test(configFieldValue)) {
            failed += `Config field: "${v}" (${String(config[v])}) is not the proper type;\n`
          }
        } else {
          const test = requiredType === 'array' ? Array.isArray(configFieldValue) : typeof configFieldValue === requiredType
          if (!test) {
            failed += `Config required field: "${v}" is not of type "${String(requiredType)}";\n`
          }
        }
      }
    })
  } else {
    // failed += 'No validations provided'
  }
  if (failed !== '') {
    // console.log(`Config failed minimum validation spec!\n>${failed}`)
    throw new Error(failed)
  } else {
    return config
  }
}

/**
 * Pull the plugin commands out of the Plugin.json object
 * @param {*} pluginJson
 * @returns
 */
export function getPluginCommands(pluginJson: any): Array<any> {
  return pluginJson['plugin.commands'] || []
}

/**
 * Find a command inside the pluginJson with the functionName matching param
 * @param {*} pluginJson - the entire settings object
 * @param {*} functionName - the name of the function to look for
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
 * Change the name and description of a plugin command inside the plugin.json object
 * the functionName is the key of the command in the plugin.commands array to find
 * @param {object} pluginJson - the entire settings object for a plugin
 * @param {string} functionName - the key of the command to change info for
 * @param {string} commandName - the new name of the command
 * @param {string} commandDescription - the new description of the command
 * @param {boolean} commandHidden - should the command be hidden (not shown in the command bar) default is false
 * @return {object} pluginJson object
 */
export function setCommandDetailsForFunctionNamed(
  pluginJson: any,
  functionName: string,
  commandName: string,
  commandDescription: string = '',
  commandHidden: ?boolean = false,
): any {
  const foundIndex = getCommandIndex(pluginJson, functionName)
  if (foundIndex != null && foundIndex > -1) {
    pluginJson['plugin.commands'][foundIndex].name = commandName
    pluginJson['plugin.commands'][foundIndex].description = commandDescription
    pluginJson['plugin.commands'][foundIndex].hidden = commandHidden
  }

  return pluginJson
}
