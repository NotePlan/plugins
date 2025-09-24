// @flow

export type headingLevelType = 1 | 2 | 3 | 4 | 5

/**
 * Trims off matching pair of surrounding " or ' marks
 * @author @jgclark
 *
 * @param {string} inStr the string to trim
 * @returns {string}
 */
export function trimAnyQuotes(inStr: string): string {
  return inStr.match(/^'.*'$/) || inStr.match(/^".*"$/) ? inStr.slice(1, -1) : inStr
}

/**
 * Trims a string to be be no more than maxLen long; if trimmed add '...'
 * @author @jgclark
 *
 * @param {string} inStr the string to trim
 * @returns {string}
 */
export function trimString(inStr: string, maxLen: number): string {
  return inStr.length > maxLen ? `${inStr.slice(0, maxLen)} ...` : inStr
}

/**
 * Converts a string with dividers in it or an array into a unified array type
 * @param {string|Array<string>|null} input - string or array to be converted
 * @param {string} separator - separator to use to split string
 * @returns {Array<string>}
 */
export function stringListOrArrayToArray(input: string | Array<string> | null, separator: string): Array<string> {
  let fullArray = []
  if (!input) {
    return []
  } else if (input !== undefined && input !== '') {
    if (typeof input === 'string') {
      if (input.indexOf(separator) === -1) {
        fullArray.push(input)
      } else {
        fullArray = input.split(separator)
      }
    } else {
      fullArray = input // keep as an array
    }
  }
  // Now trim whitespace around elements in the array
  fullArray = fullArray.map((x) => x.trim())
  return fullArray
}

/**
 * Cast boolean from the config mixed. Based on @m1well's config system.
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {boolean} cast value
 */
export const castBooleanFromMixed = (val: { [string]: ?mixed }, key: string): boolean => {
  return val.hasOwnProperty(key) ? ((val[key]: any): boolean) : false
}

/**
 * Cast number from the config mixed. Based on @m1well's config system.
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {number} cast value
 */
export const castNumberFromMixed = (val: { [string]: ?mixed }, key: string): number => {
  return val.hasOwnProperty(key) ? ((val[key]: any): number) : NaN
}

/**
 * cast string from the config mixed
 * @author @m1well
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {string} casted value
 */
export const castStringFromMixed = (val: { [string]: ?mixed }, key: string): string => {
  return val.hasOwnProperty(key) ? ((val[key]: any): string) : ''
}

/**
 * cast string array from the config mixed
 * @author @m1well
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {Array<string>} casted array
 */
export const castStringArrayFromMixed = (val: { [string]: ?mixed }, key: string): Array<string> => {
  return val.hasOwnProperty(key) ? ((val[key]: any): Array<string>) : []
}

/**
 * Cast number from the config mixed. Based on @m1well's config system.
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {number} cast value
 */

export const castHeadingLevelFromMixed = (val: { [string]: ?mixed }, key: string): headingLevelType => {
  return val.hasOwnProperty(key) ? ((val[key]: any): headingLevelType) : 2
}

/**
 * Simple Object equality test, working for ONE-LEVEL only objects.
 * from https://stackoverflow.com/a/5859028/3238281
 * @param {Object} o1
 * @param {Object} o2
 * @returns {boolean} does o1 = o2?
 * @test in jest file
 */
export function compareObjects(o1: Object, o2: Object): boolean {
  for (const p in o1) {
    if (o1.hasOwnProperty(p)) {
      if (o1[p] !== o2[p]) {
        return false
      }
    }
  }
  for (const p in o2) {
    if (o2.hasOwnProperty(p)) {
      if (o1[p] !== o2[p]) {
        return false
      }
    }
  }
  return true
}
/**
 * Remove the 'exclude' array terms from given 'arr' array.
 * Assumes both arrays are of the same Object type, and that we will only remove
 * when all properties are equal.
 * @param {Array<Object>} arr - array to remove from
 * @param {Array<Object>} exclucde - array to remove
 * @returns {Array<Object>} arr minus exclude
 * @tests in jest file
 */

export function differenceByObjectEquality<P: string, T: { +[P]: mixed }>(arr: $ReadOnlyArray<T>, exclude: $ReadOnlyArray<T>): Array<T> {
  return arr.filter((a: T) => !exclude.find((b: T) => compareObjects(b, a)))
}

/**
 * Compute difference of two arrays, by a given property value
 * from https://stackoverflow.com/a/63745126/3238281
 * translated into Flow syntax with Generics by @nmn:
 * - PropertyName is no longer just a string type. It's now a Generic type itself called P. But we constrain P such that it must be string. How is this different from just a string? Instead of being any string, P can be a specific string literal. eg. id
 * - T is also constrained. T can no longer be any arbitrary type. It must be an object type that contains a key of the type P that we just defined. It may still have other keys indicated by the ...
 * @param {<Array<T>} arr The initial array
 * @param {<Array<T>} exclude The array to remove
 * @param {string} propertyName the key of the object to match on
 * @return {Array<T>}
 * @tests in jest file
 */
export function differenceByPropVal<P: string, T: { +[P]: mixed, ... }>(arr: $ReadOnlyArray<T>, exclude: $ReadOnlyArray<T>, propertyName: P): Array<T> {
  return arr.filter((a: T) => !exclude.find((b: T) => b[propertyName] === a[propertyName]))
}

/**
 * Recursively rename keys at any level of an object
 * Written by cursor.ai
 * @param {any} obj - The object to modify
 * @param {string} oldKey - The key name to replace
 * @param {string} newKey - The new key name to use
 * @returns {any} - The modified object
 */
export function renameKey(obj: any, oldKey: string, newKey: string): any {
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => renameKey(item, oldKey, newKey))
  }

  // Handle objects
  if (obj && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc: { [key: string]: any }, key) => {
      const value = obj[key]
      const newKeyName = key === oldKey ? newKey : key

      acc[newKeyName] = renameKey(value, oldKey, newKey)
      return acc
    }, {})
  }

  // Return non-object values as is
  return obj
}

/**
 * Rename multiple keys in an object according to a mapping
 * @param {any} obj - The object to modify
 * @param {Object<string, string>} keysMap - An object where keys are old key names and values are new key names
 * @returns {any} - The modified object
 */
export function renameKeys(obj: any, keysMap: { [oldKey: string]: string }): any {
  if (!obj || typeof obj !== 'object' || !keysMap || typeof keysMap !== 'object') {
    return obj
  }

  let result = obj

  // Loop through each key mapping and apply renameKey
  Object.entries(keysMap).forEach(([oldKey, newKey]) => {
    result = renameKey(result, oldKey, newKey)
  })

  return result
}

/**
 * Helper function to get the value of a nested field in an object.
 *
 * @param {Object} obj - The object to search for the nested field.
 * @param {string} path - The path to the nested field, e.g., 'para.filename'.
 * @returns {any} The value of the nested field, or undefined if the field doesn't exist.
 */
export function getNestedValue(obj: any, path: string): any {
  const fields = path.split('.')
  let value = obj

  for (const field of fields) {
    if (value && typeof value === 'object' && field in value) {
      value = value[field]
    } else {
      return undefined
    }
  }

  return value
}

/**
 * Helper function to set the value of a nested field in an object.
 *
 * @param {Object} obj - The object to set the nested field value in.
 * @param {string} path - The path to the nested field, e.g., 'para.filename'.
 * @param {any} value - The value to set for the nested field.
 */
export function setNestedValue(obj: any, path: string, value: any): void {
  const fields = path.split('.')
  let currentObj = obj

  for (let i = 0; i < fields.length - 1; i++) {
    const field = fields[i]
    if (!currentObj.hasOwnProperty(field)) {
      currentObj[field] = {}
    }
    currentObj = currentObj[field]
  }
  const finalField = fields[fields.length - 1]
  currentObj[finalField] = value
}

/**
 * For parameter casting: Convert input to boolean value. Returns the input as-is if it's already a boolean, otherwise converts string values to boolean.
 * String values that convert to true: 'true', '1', 'yes', 'on' (case insensitive)
 * String values that convert to false: 'false', '0', 'no', 'off' (case insensitive)
 * @param {string|boolean} input - The input to convert
 * @param {boolean} defaultValue - Default value if conversion fails
 * @returns {boolean} The boolean value
 */
export function getBooleanValue(input: string | boolean, defaultValue: boolean = false): boolean {
  if (typeof input === 'boolean') {
    return input
  }

  if (typeof input === 'string') {
    const lowerInput = input.toLowerCase()
    if (lowerInput === 'true' || lowerInput === '1' || lowerInput === 'yes' || lowerInput === 'on') {
      return true
    }
    if (lowerInput === 'false' || lowerInput === '0' || lowerInput === 'no' || lowerInput === 'off') {
      return false
    }
  }

  return defaultValue
}

/**
 * For parameter casting: Convert input to array value. Returns the input as-is if it's already an array, otherwise converts string to array.
 * If string looks like JSON array (starts with '[' and ends with ']'), attempts JSON.parse.
 * Otherwise splits the string by the provided separator and trims whitespace from each element.
 * @param {string|Array<mixed>} input - The input to convert
 * @param {Array<mixed>} defaultValue - Default value if conversion fails
 * @param {string} separator - Separator to use for string splitting (default: ',')
 * @returns {Array<mixed>} The array value
 */
export function getArrayValue(input: string | Array<mixed>, defaultValue: Array<mixed> = [], separator: string = ','): Array<mixed> {
  if (Array.isArray(input)) {
    return input
  }

  if (typeof input === 'string') {
    try {
      // Try JSON.parse first if it looks like JSON
      if (input.trim().startsWith('[') && input.trim().endsWith(']')) {
        return JSON.parse(input)
      }

      // Otherwise split by separator
      return input.split(separator).map((item) => item.trim())
    } catch (e) {
      // If JSON.parse fails, fall back to splitting
      return input.split(separator).map((item) => item.trim())
    }
  }

  return defaultValue
}

/**
 * For parameter casting: Convert input to object value. Returns the input as-is if it's already an object, otherwise attempts JSON.parse on string input.
 * @param {string|Object} input - The input to convert
 * @param {Object} defaultValue - Default value if conversion fails
 * @returns {Object} The object value
 */
export function getObjectValue(input: string | Object, defaultValue: Object = {}): Object {
  if (typeof input === 'object' && input !== null) {
    return input
  }

  if (typeof input === 'string') {
    try {
      return JSON.parse(input)
    } catch (e) {
      // If JSON.parse fails, return default
      return defaultValue
    }
  }

  return defaultValue
}

/**
 * For parameter casting: Convert input to number value. Returns the input as-is if it's already a number, otherwise uses parseFloat on string input.
 * @param {string|number} input - The input to convert
 * @param {number} defaultValue - Default value if conversion fails
 * @returns {number} The number value
 */
export function getNumberValue(input: string | number, defaultValue: number = 0): number {
  if (typeof input === 'number') {
    return input
  }

  if (typeof input === 'string') {
    const parsed = parseFloat(input)
    if (!isNaN(parsed)) {
      return parsed
    }
  }

  return defaultValue
}

/**
 * For parameter casting: Convert input to Date value using moment. Returns the input as-is if it's already a Date, otherwise attempts to parse string input.
 * First tries moment.js parsing, then falls back to native Date constructor if moment fails.
 * @param {string|Date} input - The input to convert
 * @param {Date} defaultValue - Default value if conversion fails
 * @returns {Date} The Date value
 */
export function getDateValue(input: string | Date, defaultValue: Date = new Date()): Date {
  if (input instanceof Date) {
    return input
  }

  if (typeof input === 'string') {
    try {
      const moment = require('moment')
      const parsed = moment(input)
      if (parsed.isValid()) {
        return parsed.toDate()
      }
    } catch (e) {
      // If moment fails, try native Date constructor
      const parsed = new Date(input)
      if (!isNaN(parsed.getTime())) {
        return parsed
      }
    }
  }

  return defaultValue
}

/**
 * For parameter casting: Convert input to string value. Returns the input as-is if it's already a string, otherwise converts to string.
 * For numbers and booleans, uses String() conversion. For objects, attempts JSON.stringify.
 * @param {any} input - The input to convert
 * @param {string} defaultValue - Default value if conversion fails
 * @returns {string} The string value
 */
export function getStringValue(input: any, defaultValue: string = ''): string {
  if (typeof input === 'string') {
    return input
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return String(input)
  }

  if (input === null || input === undefined) {
    return defaultValue
  }

  try {
    return JSON.stringify(input)
  } catch (e) {
    return defaultValue
  }
}

/**
 * For parameter casting: Convert input to integer value. Returns Math.floor(input) if it's already a number, otherwise uses parseInt on string input.
 * @param {string|number} input - The input to convert
 * @param {number} defaultValue - Default value if conversion fails
 * @returns {number} The integer value
 */
export function getIntegerValue(input: string | number, defaultValue: number = 0): number {
  if (typeof input === 'number') {
    return Math.floor(input)
  }

  if (typeof input === 'string') {
    const parsed = parseInt(input, 10)
    if (!isNaN(parsed)) {
      return parsed
    }
  }

  return defaultValue
}

/**
 * For parameter casting: Convert input to positive integer value. Uses getIntegerValue internally and ensures the result is positive (> 0).
 * Returns the defaultValue if the converted value is not positive.
 * @param {string|number} input - The input to convert
 * @param {number} defaultValue - Default value if conversion fails
 * @returns {number} The positive integer value
 */
export function getPositiveIntegerValue(input: string | number, defaultValue: number = 1): number {
  const value = getIntegerValue(input, defaultValue)
  return value > 0 ? value : defaultValue
}
