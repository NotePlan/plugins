// @flow
// Development-related helper functions

import isEqual from 'lodash-es/isEqual'
import isObject from 'lodash-es/isObject'
import isArray from 'lodash-es/isArray'
import moment from 'moment'

/**
 * NotePlan API properties which should not be traversed when stringifying an object
 */

const PARAM_BLACKLIST = ['note', 'referencedBlocks', 'availableThemes', 'currentTheme', 'linkedNoteTitles', 'linkedItems'] // fields not to be traversed (e.g. circular references)

export const dt = (): string => {
  const d = new Date()

  const pad = (value: number): string => {
    return value < 10 ? `0${value}` : value.toString()
  }

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${d.toLocaleTimeString('en-GB')}`
}

/**
 * Returns a local datetime timestamp with milliseconds.
 * If a Date object is provided, it formats that date instead.
 *
 * @param {Date} [date] - Optional Date object to format.
 * @returns {string} Formatted datetime string.
 */
export const dtl = (date?: Date): string => {
  const momentDate = date ? moment(date) : moment()
  return momentDate.format('YYYY-MM-DD HH:mm:ss.SSS')
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
export function JSP(obj: any, space: string | number = 2): string {
  if (typeof obj !== 'object' || obj instanceof Date) {
    return String(obj)
  } else {
    if (Array.isArray(obj)) {
      const arrInfo = []
      let isValues = false
      obj.forEach((item, i) => {
        if (typeof item === 'object') {
          arrInfo.push(`[${i}] = ${JSP(item, space)}`)
        } else {
          isValues = true
          arrInfo.push(`${item}`)
        }
      })
      return `${isValues ? '[' : ''}${arrInfo.join(isValues ? ', ' : ',\n')}${isValues ? ']' : ''}`
    }
    const propNames = getFilteredProps(obj)
    const fullObj = propNames.reduce((acc: Object, propName: string) => {
      if (!/^__/.test(propName)) {
        if (Array.isArray(obj[propName])) {
          try {
            if (PARAM_BLACKLIST.indexOf(propName) === -1) {
              acc[propName] = obj[propName].map((x) => {
                if (typeof x === 'object' && !(x instanceof Date)) {
                  return JSP(x, '')
                } else {
                  return x
                }
              })
            } else {
              acc[propName] = obj[propName] //do not traverse any further
            }
          } catch (error) {
            logDebug(
              'helpers/dev',
              `Caught error in JSP for propname=${propName} : ${error} typeof obj[propName]=${typeof obj[propName]} isArray=${String(Array.isArray(obj[propName]))} len=${
                obj[propName]?.length
              } \n VALUE: ${JSON.stringify(obj[propName])}`,
            )
          }
        } else {
          acc[propName] = obj[propName]
        }
      }
      return acc
    }, {})
    // return cleanStringifiedResults(JSON.stringify(fullObj, null, space ?? null))
    return typeof fullObj === 'object' && !(fullObj instanceof Date) ? JSON.stringify(fullObj, null, space ?? null) : 'date'
  }
}

/**
 * Returns whether an object is empty
 * From https://stackoverflow.com/a/679937/3238281
 * @param {Object} obj
 * @returns
 */
export function isObjectEmpty(obj: Object): boolean {
  return Object.keys(obj).length === 0
}

/**
 * Remove quoted and escaped characters from a string
 * @param {*} str
 * @returns
 */
export function cleanStringifiedResults(str: string): string {
  let retStr = str
  retStr = retStr.replace(/","/gm, ',')
  retStr = retStr.replace(/"\{"/gm, '{').replace(/"\}"/gm, '}')
  retStr = str.replace(/\\n/gm, '\n')
  // retStr = retStr.replace(/\\"/gm, '"')
  retStr = retStr.replace(/\\"/gm, '"')
  // retStr = str.replace(/\\n/gm, '\n')
  return retStr
}

/**
 * Console.logs all property names/values of an object to console with text preamble
 * @author @dwertheimer
 *
 * @param {object} obj - array or object
 * @param {string} preamble - (optional) text to prepend to the output
 * @param {string | number} space - A String or Number of spaces that's used to insert white space (including indentation, line break characters, etc.) into the output JSON string for readability purposes.
 * @example clo(obj, 'myObj:')
 */
export function clo(obj: any, preamble: string = '', space: string | number = 2): void {
  if (!obj) {
    logDebug(preamble, `null`)
    return
  }
  if (typeof obj !== 'object') {
    logDebug(preamble, `${obj}`)
  } else {
    logDebug(preamble, JSP(obj, space))
  }
}

type DiffValue = { before: any, after: any } | DiffObject | DiffArray

type DiffObject = { [key: string]: DiffValue }
type DiffArray = Array<DiffValue | null>

/**
 * Compare two objects or arrays and return an object containing only the NEW properties that have changed.
 * Note: dbw created a version below called getDiff that gives before and after values.
 * Fields listed in fieldsToIgnore are ignored when comparing objects (does not apply to arrays).
 *
 * @param {Object|Array} oldObj - The original object or array to compare against.
 * @param {Object|Array} newObj - The new object or array with potential changes.
 * @param {Array<string | RegExp>} fieldsToIgnore - An array of field names to ignore when comparing objects.
 * @param {boolean} logDiffDetails - If true, will log details of the differences.
 * @returns {Object|Array|null} - An object or array containing only the properties that have changed, or null if no changes.
 */
export function compareObjects(oldObj: any, newObj: any, fieldsToIgnore: Array<string | RegExp> = [], logDiffDetails: boolean = false): any | null {
  if (oldObj === newObj) {
    return null // No changes
  }

  if (typeof oldObj !== typeof newObj) {
    // logDebug('compareObjects', 'Objects are of different types.')
    return newObj // Type has changed, consider as changed
  }

  if (Array.isArray(newObj)) {
    if (!Array.isArray(oldObj)) {
      logDebug('compareObjects', 'Changed from non-array to array.')
      return newObj // Changed from non-array to array
    }

    const differences = []
    const maxLength = Math.max(oldObj.length, newObj.length)

    for (let i = 0; i < maxLength; i++) {
      const oldVal = oldObj[i]
      const newVal = newObj[i]
      const diff = compareObjects(oldVal, newVal, fieldsToIgnore)
      if (diff !== null) {
        logDiffDetails && logDebug('compareObjects', `Array difference at index ${i}: ${JSON.stringify(diff)}`)
        differences[i] = diff
      }
    }

    return differences.length > 0 ? differences : null
  } else if (typeof newObj === 'object' && newObj !== null) {
    if (typeof oldObj !== 'object' || oldObj === null) {
      logDiffDetails && logDebug('compareObjects', 'Changed from non-object to object.')
      return newObj // Changed from non-object to object
    }

    const differences = {}
    const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])

    for (const key of keys) {
      // Check if the key should be ignored
      const shouldIgnore = fieldsToIgnore.some((ignore) => {
        if (typeof ignore === 'string') {
          return key === ignore
        } else if (ignore instanceof RegExp) {
          return ignore.test(key)
        }
        return false
      })

      if (shouldIgnore) {
        continue // Ignore fields listed in fieldsToIgnore
      }

      const oldVal = oldObj[key]
      const newVal = newObj[key]
      const diff = compareObjects(oldVal, newVal, fieldsToIgnore)
      if (diff !== null) {
        logDiffDetails && logDebug('compareObjects', `Object difference: value[${key}]= "${oldVal}" !== "${newVal}"`)
        differences[key] = diff
      }
    }

    return Object.keys(differences).length > 0 ? differences : null
  } else {
    // Primitives
    const result = oldObj !== newObj ? newObj : null
    if (result !== null) {
      logDiffDetails && logDebug('compareObjects', `Primitive difference: oldVal=${oldObj}, newVal=${newObj}`)
    }
    return result
  }
}

/**
 * Compares two objects and returns the differences.
 * @param {Object} obj1 - The original object.
 * @param {Object} obj2 - The modified object.
 * @returns {Object|null} - An object representing the differences or null if no differences.
 */
function getObjectDiff(obj1: any, obj2: any): DiffObject | null {
  const diff = {}

  const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)])

  keys.forEach((key) => {
    const val1 = obj1[key]
    const val2 = obj2[key]

    if (!isEqual(val1, val2)) {
      if (isObject(val1) && isObject(val2) && !isArray(val1) && !isArray(val2)) {
        // Recursively find differences in nested objects
        const nestedDiff = getObjectDiff(val1, val2)
        if (nestedDiff !== null) {
          diff[key] = nestedDiff
        }
      } else if (isArray(val1) && isArray(val2)) {
        // Handle arrays
        const arrayDiff = getArrayDiff(val1, val2)
        if (arrayDiff !== null) {
          diff[key] = arrayDiff
        }
      } else {
        // Primitive value or different types
        diff[key] = {
          before: val1,
          after: val2,
        }
      }
    }
  })

  return Object.keys(diff).length > 0 ? diff : null
}

/**
 * Compares two arrays and returns the differences.
 * @param {Array} arr1 - The original array.
 * @param {Array} arr2 - The modified array.
 * @returns {Array|null} - An array representing the differences or null if no differences.
 */
function getArrayDiff(arr1: Array<any>, arr2: Array<any>): DiffArray | null {
  const diff = []

  const maxLength = Math.max(arr1.length, arr2.length)

  for (let i = 0; i < maxLength; i++) {
    const item1 = arr1[i]
    const item2 = arr2[i]

    if (!isEqual(item1, item2)) {
      if (isObject(item1) && isObject(item2)) {
        const nestedDiff = getObjectDiff(item1, item2)
        if (nestedDiff !== null) {
          diff[i] = nestedDiff
        }
      } else {
        diff[i] = {
          before: item1,
          after: item2,
        }
      }
    }
  }

  return diff.length > 0 ? diff : null
}

/**
 * Wrapper function that determines whether to perform an object or array diff.
 * Deals with the case where the two items are not the same type, e.g. an array and an object.
 * Deals with
 * Returns null if there are no differences.
 * @param {*} data1 - The original data (object or array).
 * @param {*} data2 - The modified data (object or array).
 * @returns {*} - The differences or null if no differences.
 * @usage const differences = getDiff(obj1, obj2);
 */
export function getDiff(data1: any, data2: any): ?(DiffObject | DiffArray | { before: any, after: any }) {
  if (isArray(data1) && isArray(data2)) {
    return getArrayDiff(data1, data2)
  } else if (isObject(data1) && isObject(data2)) {
    return getObjectDiff(data1, data2)
  } else {
    // If data types are different or not objects/arrays, perform a direct comparison
    if (!isEqual(data1, data2)) {
      return {
        before: data1,
        after: data2,
      }
    }
    return null
  }
}

/**
 * CLO + field-limited - Loop through and Console.log only certain names/values of an object to console with text preamble
 * Like CLO but more concise, only showing certain fields. Useful for large objects with many fields.
 * Prunes object properties that are not in the list, but continues to look deeper as long as properties match the list.
 * @param {object} obj - array or object
 * @param {string} preamble - (optional) text to prepend to the output
 * @param {Array<string>|string} fields - the field property names to display (default: null - display all fields)
 * @param {boolean} compactMode - [default: false] if true, will display the fields in a more compact format (less vertical space)
 * @author @dwertheimer
 * @example clof(note.paragraphs, 'paragraphs',['content'],true)
 * @example clof({ foo: { bar: [{ willPrint: 1, ignored:2 }] } }, 'Goes deep as long as it finds a matching field', ['foo', 'bar', 'willPrint'], false)
 */
export function clof(obj: any, preamble: string = '', fields: ?Array<string> | string = null, compactMode: ?boolean = false): void {
  const topLevelIsArray = Array.isArray(obj)
  const copy = deepCopy(obj, fields?.length ? fields : null, true)
  const topLevel = topLevelIsArray ? Object.keys(copy).map((k) => copy[k]) : copy
  if (Array.isArray(topLevel)) {
    if (topLevel.length === 0) {
      logDebug(`${preamble}: [] (no data)`)
      return
    }
    logDebug(`${preamble}: vvv`)
    topLevel.forEach((item, i) => {
      logDebug(`${preamble}: [${i}]: ${typeof item === 'object' && item !== null ? JSON.stringify(item, null, compactMode ? undefined : 2) : String(item)}`)
    })
    logDebug(`${preamble}: ^^^`)
  } else {
    if (topLevel === {}) {
      const keycheck = fields ? ` for fields: [${fields.join(', ')}] - all other properties are pruned` : ''
      logDebug(`${preamble}: {} (no data${keycheck})`)
    } else {
      logDebug(`${preamble}:\n`, compactMode ? JSON.stringify(topLevel) : JSON.stringify(topLevel, null, 2))
    }
  }
}

export function dump(pluginInfo: any, obj: { [string]: mixed }, preamble: string = '', space: string | number = 2): void {
  log(pluginInfo, '-------------------------------------------')
  clo(obj, preamble, space)
  log(pluginInfo, '-------------------------------------------')
}

/**
 * Create a list of the properties of an object, including inherited properties (which are not typically visible in JSON.stringify)
 * Often includes a bunch of properties that are not useful for the user, e.g. constructor, __proto__
 * See getFilteredProps for a cleaner version
 * @author @dwertheimer (via StackOverflow)
 *
 * @param {object} inObj
 * @returns {Array<string>}
 * @reference https://stackoverflow.com/questions/59228638/console-log-an-object-does-not-log-the-method-added-via-prototype-in-node-js-c
 */
export function getAllPropertyNames(inObj: interface { [string]: mixed }): Array<string> {
  let obj = inObj
  const props = []
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
 * Get the properties of interest (i.e. excluding all the ones added automatically)
 * @author @dwertheimer
 * @param {object} object
 * @returns {Array<string>} - an array of the interesting properties of the object
 */
export const getFilteredProps = (object: any): Array<string> => {
  const ignore = ['toString', 'toLocaleString', 'valueOf', 'hasOwnProperty', 'propertyIsEnumerable', 'isPrototypeOf']
  if (typeof object !== 'object' || Array.isArray(object)) {
    // console.log(`getFilteredProps improper type: ${typeof object}`)
    return []
  }
  return getAllPropertyNames(object).filter((prop) => !/(^__)|(constructor)/.test(prop) && !ignore.includes(prop))
}

/**
 * Copy the first level of an object and its prototypes as well, return as a normal object
 * with no prototypes. This is useful for copying objects that have
 * prototypes that are not normally visible in JSON.stringify
 * (e.g. most objects that come from the NotePlan API)
 * @author @dwertheimer
 * @param {any} obj
 */
export function copyObject(obj: any): any {
  const props = getFilteredProps(obj)
  return props.reduce((acc, p: any) => {
    acc[p] = obj[p]
    return acc
  }, {})
}

/**
 * Deeply copies an object including its prototype properties. Optionally filters properties by a given list.
 * For arrays, can optionally modify their representation in the stringified output to include indices.
 * Handles objects, arrays, Dates, and primitive types.
 * Result is JSON-safe, free of recursion, and can be stringified.
 * Use function clof to display objects with certain properties
 * NOTE: Does not actually copy prototype (does not work for NP), only the properties.
 *
 * @template T The type of the value being copied.
 * @param {T} value The value to copy.
 * @param {?Array<string>|string} [propsToInclude=null] Optional single field name or array of property names to include in the copy. As objects are traversed, only these properties will be included in the copy. If null, all properties will be included.
 * @param {boolean} [showIndices=false] Optional parameter to include indices in array representation during stringification.
 * @return {T|{ [key: string]: any }} The deep copy of the value.
 */
export function deepCopy<T>(value: T, _propsToInclude: ?Array<string> | string = null, showIndices: boolean = false): T | { [key: string]: any } {
  const propsToInclude = _propsToInclude === [] ? null : typeof _propsToInclude === 'string' ? [_propsToInclude] : _propsToInclude

  // Handle null, undefined, and primitive types
  if (value === null || typeof value !== 'object') {
    return value
  }

  // Handle Date
  if (value instanceof Date) {
    return new Date(value.getTime())
  }

  // Handle Array
  if (Array.isArray(value)) {
    const arrayCopy = value.map((item: any) => deepCopy(item, propsToInclude, showIndices))
    if (showIndices) {
      // Convert array to object with index keys for stringification
      const objectWithIndices = {}
      arrayCopy.forEach((item: any, index: number) => {
        objectWithIndices[`[${index}]`] = item
      })
      return objectWithIndices
    } else {
      return arrayCopy
    }
  }

  // Handle Object (including objects with prototype properties)
  const copy = {}
  const propNames = propsToInclude || Object.keys(value)
  for (const key of propNames) {
    if (propsToInclude ? propsToInclude.includes(key) : true) {
      const isBlacklisted = PARAM_BLACKLIST.indexOf(key) !== -1
      const isPrivateVar = /^__/.test(key)
      const isFunction = typeof value[key] === 'function'
      if (!isBlacklisted && !isPrivateVar && !isFunction) {
        copy[key] = deepCopy(value[key], propsToInclude, showIndices)
      }
    }
  }

  return copy
}

/**
 * Print to the console log, the properties of an object (including its prototype/private methods). This is useful if you want to know which properties are on the object vs the prototype because it will display in two lines, but it's more succinct to use getAllPropertyNames()
 * @author @dwertheimer
 * @param {object} obj
 * @returns {void}
 */
// This works and is good if you want to know which properties are on the object vs the prototype
// because it will display in two lines
export function logAllPropertyNames(obj?: mixed): void {
  if (typeof obj !== 'object' || obj == null) return // recursive approach
  logDebug(
    'helpers/dev',
    Object.getOwnPropertyNames(obj).filter((x) => /^__/.test(x) === false),
  )
  logAllPropertyNames(obj.__proto__)
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

const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'none']
export const LOG_LEVEL_STRINGS = ['| DEBUG |', '| INFO  |', '🥺 WARN 🥺', '❗️ ERROR ❗️', 'none']

/**
 * Test _logLevel against logType to decide whether to output
 * @param {string} logType
 * @returns {boolean}
 */
export const shouldOutputForLogLevel = (logType: string): boolean => {
  let userLogLevel = 1
  const thisMessageLevel = LOG_LEVELS.indexOf(logType.toUpperCase())
  const pluginSettings = typeof DataStore !== 'undefined' ? DataStore.settings : null
  // Note: Performing a null change against a value that is `undefined` will be true
  // Sure wish NotePlan would not return `undefined` but instead null, then the previous implementataion would not have failed

  // se _logLevel to decide whether to output
  if (pluginSettings && pluginSettings.hasOwnProperty('_logLevel')) {
    userLogLevel = pluginSettings['_logLevel']
  }
  const userLogLevelIndex = LOG_LEVELS.indexOf(userLogLevel)
  return thisMessageLevel >= userLogLevelIndex
}

/**
 * Test if _logFunctionRE is set and matches the current log details.
 * Note: only works if DataStore is available.
 * @param {any} pluginInfo
 * @returns
 */
export const shouldOutputForFunctionName = (pluginInfo: any): boolean => {
  const pluginSettings = typeof DataStore !== 'undefined' ? DataStore.settings : null
  if (pluginSettings && pluginSettings.hasOwnProperty('_logFunctionRE')) {
    const functionRE = new RegExp(pluginSettings['_logFunctionRE'], 'i')
    const infoStr: string = pluginInfo === 'object' ? pluginInfo['plugin.id'] : String(pluginInfo)
    return functionRE.test(infoStr)
  }
  return false
}

export function getLogDateAndTypeString(type: string): string {
  const thisMessageLevel = LOG_LEVELS.indexOf(type.toUpperCase())
  const thisIndicator = LOG_LEVEL_STRINGS[thisMessageLevel]
  return `${dt().padEnd(19)} ${thisIndicator}`
}

/**
 * Formats log output to include timestamp pluginId, pluginVersion
 * @author @codedungeon extended by @jgclark
 * @param {any} pluginInfo
 * @param {any} message
 * @param {string} type
 * @returns {string}
 */
export function log(pluginInfo: any, message: any = '', type: string = 'INFO'): string {
  let msg = ''
  if (shouldOutputForLogLevel(type) || shouldOutputForFunctionName(pluginInfo)) {
    let pluginId = ''
    let pluginVersion = ''
    const isPluginJson = typeof pluginInfo === 'object' && pluginInfo.hasOwnProperty('plugin.id')

    const ldts = getLogDateAndTypeString(type)

    if (isPluginJson) {
      pluginId = pluginInfo.hasOwnProperty('plugin.id') ? pluginInfo['plugin.id'] : 'INVALID_PLUGIN_ID'
      pluginVersion = pluginInfo.hasOwnProperty('plugin.version') ? pluginInfo['plugin.version'] : 'INVALID_PLUGIN_VERSION'
      msg = `${ldts} ${pluginId} v${pluginVersion} :: ${_message(message)}`
    } else {
      if (message.length > 0) {
        // msg = `${dt().padEnd(19)} | ${thisIndicator.padEnd(7)} | ${pluginInfo} :: ${_message(message)}`
        msg = `${ldts} ${pluginInfo} :: ${_message(message)}`
      } else {
        // msg = `${dt().padEnd(19)} | ${thisIndicator.padEnd(7)} | ${_message(pluginInfo)}`
        msg = `${ldts} ${_message(pluginInfo)}`
      }
    }
    console.log(msg)
  }

  return msg
}

/**
 * Formats log output as ERROR to include timestamp pluginId, pluginVersion
 * @author @codedungeon
 * @param {any} pluginInfo
 * @param {any} message
 * @returns {string}
 */
export function logError(pluginInfo: any, error?: any): string {
  if (typeof error === 'object' && error != null) {
    const msg = `${error.filename ?? '<unknown file>'} ${error.lineNumber ?? '<unkonwn line>'}: ${error.message}`
    return log(pluginInfo, msg, 'ERROR')
  }
  return log(pluginInfo, error, 'ERROR')
}

/**
 * Formats log output as WARN to include timestamp pluginId, pluginVersion
 * @author @codedungeon
 * @param {any} pluginInfo
 * @param {any} message
 * @returns {string}
 */
export function logWarn(pluginInfo: any, message: any = ''): string {
  return log(pluginInfo, message, 'WARN')
}

/**
 * Formats log output as INFO to include timestamp pluginId, pluginVersion
 * @author @codedungeon
 * @param {any} pluginInfo
 * @param {any} message
 * @returns {string}
 */
export function logInfo(pluginInfo: any, message: any = ''): string {
  return log(pluginInfo, message, 'INFO')
}

/**
 * Formats log output as DEBUG to include timestamp pluginId, pluginVersion
 * @author @dwertheimer
 * @param {any} pluginInfo
 * @param {any} message
 * @returns {string}
 */
export function logDebug(pluginInfo: any, message: any = ''): string {
  return log(pluginInfo, message, 'DEBUG')
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
  // @ts-ignore
  const difference = timeEnd - timeStart
  // const d = new Date(difference)
  // const diffText = `${d.getMinutes()}m${d.getSeconds()}.${d.getMilliseconds()}s`
  const diffText = `${difference.toLocaleString()}ms`
  return diffText
}

/**
 * A special logger that logs the time it takes to execute a function, or a certain stage of a function, that this is called from.
 * It can be turned on/off independently from _logLevel. And for it to always trigger if a threshold is passed.
 * Assumes that `const startTime = new Date()` is included earlier in the function.
 * If separate plugin-level _logTimer setting is true, then it will log, irrespective of the main _logLevel setting.
 * But if warningTrigger (in milliseconds)is exceeded, then this will log with a warning, irrespective of _logTimer or _logLevel settings.
 * @author @jgclark
 * @param {string} functionName - to display after time in log line
 * @param {Date} startTime - the date object from when timer started (using new Date())
 * @param {string} explanation - optional text to display after the duration in log line
 * @param {number} warningThreshold - optional duration in milliseconds: if the timer is more than this it will log with added warning symbol.
 */
export function logTimer(functionName: string, startTime: Date, explanation: string = '', warningThreshold?: number): void {
  // @ts-ignore
  const difference = new Date() - startTime
  const diffTimeText = `${difference.toLocaleString()}ms`
  const output = `${diffTimeText} ${explanation}`
  if (warningThreshold && difference > warningThreshold) {
    const msg = `${dt().padEnd(19)} | ⏱️ ⚠️ ${functionName} | ${output}`
    console.log(msg)
  } else {
    const pluginSettings = typeof DataStore !== 'undefined' ? DataStore.settings : null
    // const timerSetting = pluginSettings['_logTimer'] ?? false
    if (pluginSettings && pluginSettings.hasOwnProperty('_logTimer') && pluginSettings['_logTimer'] === true) {
      const msg = `${dt().padEnd(19)} | ⏱️ ${functionName} | ${output}`
      console.log(msg)
    }
  }
}

/**
 * Add or override parameters from args to the supplied config object.
 * This is the **simple version** that treats all the passed arguments as strings, leaving some of the typing to the developer.
 * Tested with strings, ints, floats, boolean and simple array of strings.
 * Note: Different parameters are separated by ';' (not the more usual ',' to allow for comma-separated arrays)
 * Note: use the advanced version to pass more advanced quoted arrays, and items containing commas or semicolons.
 * Note: This can't tell the difference between single-element arrays and strings, so that processing needs to be done by the calling function.
 * @author @jgclark and @dwertheimer
 * @param {any} config object
 * @param {string} argsAsString e.g. 'field1=Bob Skinner;field2=false;field3=simple,little,array'
 * @returns {any} configOut
 */
export function overrideSettingsWithStringArgs(config: any, argsAsString: string): any {
  try {
    // Parse argsAsJSON (if any) into argObj using JSON
    if (argsAsString) {
      const argObj = {}
      argsAsString.split(';').forEach((arg) => (arg.split('=').length === 2 ? (argObj[arg.split('=')[0]] = arg.split('=')[1]) : null))
      // use the built-in way to add (or override) from argObj into config
      const configOut = Object.assign(config)

      // Attempt to change arg values that are numerics or booleans to the right types, otherwise they will stay as strings
      for (const key in argObj) {
        let value = argObj[key]
        logDebug(`dev.js`, `overrideSettingsWithStringArgs key:${key} value:${argObj[key]} typeof:${typeof argObj[key]} !isNaN(${value}):${String(!isNaN(argObj[key]))}`)
        if (!isNaN(value) && value !== '') {
          // Change to number type
          value = Number(value)
        } else if (value === 'false') {
          // Change to boolean type
          value = false
        } else if (value === 'true') {
          // Change to boolean type
          value = true
        } else if (value.includes(',')) {
          // Split to make an array
          value = value.split(',')
        }
        configOut[key] = value
        if (configOut[key] !== argObj[key]) {
          logDebug('overrideSettingsWithStringArgs', `- updated setting '${key}' -> value '${String(value)}'`)
        }
      }
      return configOut
    } else {
      return config
    }
  } catch (error) {
    logError('overrideSettingsWithStringArgs', JSP(error))
    console.log(JSP(error))
  }
}

/**
 * Add or override parameters from args to the supplied config object. This is the **advanced version** that respects more complex typing of the passed arguments, by using JSON.
 * This has been tested with strings, ints, floats, boolean and array of strings.
 * Note: on reflection the name '...TypedArgs' is a bit of a misnomer. Perhaps '...JSONArgs' is more accurate.
 * Note: input `"key":"one,two,three"` will be treated as a string. To treat as an array, need `"key":["one","two","three"]`
 * @author @jgclark
 * @param {any} config object
 * @param {string} argsAsJSON e.g. '{"style":"markdown", "excludedFolders":["one","two","three"]}'
 * @returns {any} configOut
 */
export function overrideSettingsWithTypedArgs(config: any, argsAsJSON: string): any {
  try {
    // Parse argsAsJSON (if any) into argObj using assuming JSON
    if (argsAsJSON) {
      let argObj = {}
      argObj = JSON.parse(argsAsJSON)
      // use the built-in way to add (or override) from argObj into config
      const configOut = Object.assign(config, argObj)
      return configOut
    } else {
      return config
    }
  } catch (error) {
    logError('overrideSettingsWithTypedArgs', JSP(error))
  }
}

/**
 * A version of overrideSettingsWithTypedArgs that first URL-decodes the args
 * As above, Note: on reflection the name '...TypedArgs' is a bit of a misnomer. Perhaps '...JSONArgs' is more accurate.
 * @author @jgclark
 * @param {any} config object
 * @param {string} argsAsEncodedJSON e.g. '%7B%22style%22%3A%22markdown%22%2C%20%22exludedFolders%3A%5B%22one%22%2C%22two%22%2C%22three%22%5D%7D'
 * @returns {any} configOut
 */
export function overrideSettingsWithEncodedTypedArgs(config: any, argsAsEncodedJSON: string): any {
  try {
    return overrideSettingsWithTypedArgs(config, decodeURIComponent(argsAsEncodedJSON))
  } catch (error) {
    logError('overrideSettingsWithEncodedTypedArgs', JSP(error))
  }
}
