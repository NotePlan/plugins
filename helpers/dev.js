// @flow
// Development-related helper functions

/**
 * Returns ISO formatted date time
 * @author @codedungeon
 * @return {string} formatted date time
 */
const dt = (): string => {
  const d = new Date()

  const pad = (value: number): string => {
    return value < 10 ? '0' + value : value.toString()
  }

  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + d.toLocaleTimeString('en-GB')
}

/**
 * JSON.stringify() with support for Prototype properties
 * @author @dwertheimer
 *
 * @param {object} obj
 * @param {string | number} space - A String or Number of spaces that's used to insert white space (including indentation, line break characters, etc.) into the output JSON string for readability purposes.
 * @returns {string} stringified object
 * @example console.log(JSP(obj, '\t')) // prints the full object with newlines and tabs for indentation
 */
export function JSP(obj: { [string]: mixed }, space: string | number = 2): string {
  const propNames = getAllPropertyNames(obj)
  const fullObj = propNames.reduce((acc, propName) => {
    acc[propName] = obj[propName]
    return acc
  }, {})
  return JSON.stringify(fullObj, null, space ?? null)
}

/**
 * Console.logs all property names/values of an object to console with text preamble
 * @author @dwertheimer
 *
 * @param {object} obj
 * @param {string} preamble - (optional) text to prepend to the output
 * @param {string | number} space - A String or Number of spaces that's used to insert white space (including indentation, line break characters, etc.) into the output JSON string for readability purposes.
 * @example clo(obj, 'myObj:')
 */
export function clo(obj: { [string]: mixed }, preamble: string = '', space: string | number = 2): void {
  console.log(`${preamble !== '' ? `${preamble} ` : ''}${JSP(obj, space)}`)
}

/**
 * Create a list of the properties of an object, including inherited properties (which are not typically visible in JSON.stringify)
 * @author @dwertheimer
 *
 * @param {object} inObj
 * @returns [string]
 * @reference https://stackoverflow.com/questions/13796360/javascript-get-all-properties-of-an-object
 */
export function getAllPropertyNames(inObj: { [string]: mixed }): Array<string> {
  const p = []
  for (let obj = { ...inObj }; obj != null; obj = Object.getPrototypeOf(obj)) {
    const op = Object.getOwnPropertyNames(obj)
    for (let i = 0; i < op.length; i++) {
      if (/^__/.test(op[i]) === false && op[i] !== 'constructor' && p.indexOf(op[i]) === -1) p.push(op[i])
    }
  }
  return p
}

/**
 * Print to the console log, the properties of an object (including its prototype/private methods). This is useful if you want to know which properties are on the object vs the prototype because it will display in two lines, but it's more succinct to use getAllPropertyNames()
 * @author @dwertheimer
 *
 * @param {object} obj
 * @returns {void}
 */
// This works and is good if you want to know which properties are on the object vs the prototype
// because it will display in two lines
export function logAllPropertyNames(obj: { [string]: mixed }): void {
  if (obj == null) return // recursive approach
  console.log(Object.getOwnPropertyNames(obj).filter((x) => /^__/.test(x) === false))
  logAllPropertyNames(Object.getPrototypeOf(obj))
}

/**
 * Converts any to message string
 * @author @codedungeon
 * @param {any} message
 * @returns {string}
 */
const _message = (message: any): string => {
  let logMessage = ''

  switch (typeof message) {
    case 'string':
      logMessage = message
      break
    case 'object':
      logMessage = message instanceof Date ? message.toString() : JSON.stringify(message)
      break
    default:
      logMessage = message.toString()
      break
  }

  return logMessage
}
/**
 * Formats log output to include timestamp pluginId, pluginVersion
 * @author @codedungeon
 * @param {any} pluginInfo
 * @param {any} message
 * @param {string} type
 * @returns {string}
 */
export function log(pluginInfo: any, message: any = '', type: string = 'LOG'): string {
  let msg = ''
  let pluginId = ''
  let pluginVersion = ''
  let msgType = ''
  let isPluginJson = typeof pluginInfo === 'object' && pluginInfo.hasOwnProperty('plugin.id')

  if (isPluginJson) {
    pluginId = pluginInfo.hasOwnProperty('plugin.id') ? pluginInfo['plugin.id'] : 'INVALID_PLUGIN_ID'
    pluginVersion = pluginInfo.hasOwnProperty('plugin.version') ? pluginInfo['plugin.version'] : 'INVALID_PLUGIN_VERSION'
    msg = `${dt().padEnd(19)} | ${type.padEnd(5)} | ${pluginId} v${pluginVersion} :: ${_message(message)}`
  } else {
    msgType = arguments.length === 2 ? message : type
    msg = `${dt().padEnd(19)} | ${msgType.padEnd(5)} | INVALID_PLUGIN_INFO :: ${_message(pluginInfo)}`
  }

  console.log(msg)
  return msg
}

/**
 * Formats log output as ERROR to include timestamp pluginId, pluginVersion
 * @author @codedungeon
 * @param {any} pluginInfo
 * @param {any} message
 * @returns {string}
 */
export function logError(pluginInfo: any, message: any = ''): string {
  return log(pluginInfo, message, 'ERROR')
}

/**
 * Formats log output as WARN to include timestamp pluginId, pluginVersion
 * @author @codedungeon
 * @param {any} pluginInfo
 * @param {any} message
 * @returns {void}
 */
export function logWarn(pluginInfo: any, message: any = ''): string {
  return log(pluginInfo, message, 'WARN')
}
