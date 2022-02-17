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
 * Formats log output to include timestamp pluginName and version
 * @author @codedungeon
 * @param {mixed} pluginInfo
 * @param {string} message
 * @param {string} type
 * @returns {void}
 */
export function log(pluginInfo: any, message: string = '', type: string = 'LOG') {
  let msg = `${dt().padEnd(19)} | ${type.padEnd(5)} | ${pluginInfo['plugin.id']} v${
    pluginInfo['plugin.version']
  } :: ${message}`
  console.log(msg)
}

/**
 * Formats log output to include timestamp pluginName and version
 * @author @codedungeon
 * @param {mixed} pluginInfo
 * @param {string} message
 * @returns {void}
 */
export function logError(pluginInfo: any, message: string = '') {
  log(pluginInfo, message, 'ERROR')
}

/**
 * Formats log output to include timestamp pluginName and version
 * @author @codedungeon
 * @param {mixed} pluginInfo
 * @param {string} message
 * @returns {void}
 */
export function logWarn(pluginInfo: any, message: string = '') {
  log(pluginInfo, message, 'WARN')
}
