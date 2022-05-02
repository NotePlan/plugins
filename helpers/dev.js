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
    if (Array.isArray(obj[propName])) {
      acc[propName] = obj[propName].map((x) => {
        if (typeof x === 'object') {
          return JSP(x, null)
        } else {
          return x
        }
      })
    } else {
      acc[propName] = obj[propName]
    }
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
export function clo(obj: any, preamble: string = '', space: string | number = 2): void {
  if (typeof obj !== 'object') {
    console.log(`${obj} ${preamble}`)
  } else {
    console.log(`${preamble !== '' ? `${preamble} ` : ''}${JSP(obj, space)}`)
  }
}

export function dump(pluginInfo: any, obj: { [string]: mixed }, preamble: string = '', space: string | number = 2): void {
  log(pluginInfo, '-------------------------------------------')
  clo(obj, preamble, space)
  log(pluginInfo, '-------------------------------------------')
}

/**
 * Create a list of the properties of an object, including inherited properties (which are not typically visible in JSON.stringify)
 * @author @dwertheimer (via StackOverflow)
 *
 * @param {object} inObj
 * @returns [string]
 * @reference https://stackoverflow.com/questions/59228638/console-log-an-object-does-not-log-the-method-added-via-prototype-in-node-js-c
 */

export function getAllPropertyNames(inObj: { [string]: mixed }): Array<string> {
  let obj = inObj
  var props = []
  do {
    Object.getOwnPropertyNames(obj).forEach(function (prop) {
      if (props.indexOf(prop) === -1) {
        props.push(prop)
      }
    })
  } while ((obj = Object.getPrototypeOf(obj)))
  return props
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
      if (Array.isArray(message)) {
        logMessage = message.toString()
      } else {
        logMessage = message instanceof Date ? message.toString() : JSON.stringify(message)
      }
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
    if (message.length > 0) {
      msg = `${dt().padEnd(19)} | ${type.padEnd(5)} | ${pluginInfo} :: ${_message(message)}`
    } else {
      msg = `${dt().padEnd(19)} | ${type.padEnd(5)} | ${_message(pluginInfo)}`
    }
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
export function logError(pluginInfo: any, error: any = ''): string {
  if (error instanceof Error) {
    let msg = `${error.filename} ${error.lineNumber}: ${error.message}`
    return log(pluginInfo, msg, 'ERROR')
  }
  return log(pluginInfo, error, 'ERROR')
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

/**
 * Time a function
 * @param {*} startTime - the date object from when timer started (using Date.now())
 * @returns {string} - the formatted elapsed time
 * @author @dwertheimer
 * @example
 * const startTime = Date.now()
 * ...some long-running stuff here...
 * const elapsedTime = timer(startTime)
 */
export function timer(startTime: Date): string {
  const timeStart = startTime ?? new Date()
  const timeEnd = new Date()
  const difference = timeEnd - timeStart
  const d = new Date(difference)
  const diffText = `${d.getMinutes()}m${d.getSeconds()}s.${d.getMilliseconds()}ms`
  return diffText
}
