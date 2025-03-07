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
  return inStr.match(/^'.*'$/) || inStr.match(/^".*"$/)
    ? inStr.slice(1,-1)
    : inStr
}

/**
 * Trims a string to be be no more than maxLen long; if trimmed add '...'
 * @author @jgclark
 * 
 * @param {string} inStr the string to trim
 * @returns {string}
 */
export function trimString(inStr: string, maxLen: number): string {
  return inStr.length > maxLen
    ? inStr.slice(0, maxLen) + ' ...'
    : inStr
}

/**
 * Convert a comma-separated string, which can just have a single term, to an array.
 * Returns empty list if no input, empty or undefined input.
 * Trims whitespace from each element before returning.
 * Based on https://stackoverflow.com/a/19523289/3238281
 * @author @jgclark
 * @tests in jest file
 * @param {string | Array<string>} input
 * @param {string} separator
 * @returns {Array<string>}
 */
export function stringListOrArrayToArray(input: string | Array<string>, separator: string): Array<string> {
  let fullArray = []
  if (!input) {
    return []
  }
  else if (input !== undefined && input !== '') {
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
  return val.hasOwnProperty(key) ? ((val[key]: any): Array < string >) : []
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

export function differenceByObjectEquality<P: string, T: { +[P]: mixed }> (
  arr: $ReadOnlyArray < T >,
    exclude: $ReadOnlyArray < T >
): Array < T > {
  return arr.filter(
    (a: T) => !exclude.find((b: T) => compareObjects(b, a))
  )
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
export function differenceByPropVal<P: string, T: { +[P]: mixed, ... }>
  (arr: $ReadOnlyArray < T >,
    exclude: $ReadOnlyArray < T >,
      propertyName: P
  ): Array < T > {
  return arr.filter(
    (a: T) => !exclude.find((b: T) => b[propertyName] === a[propertyName])
  )
}

/**
 * Recursively rename keys at any level of an object
 * Written by cursor.ai
 * @param {any} obj
 * @param {string} oldKey
 * @param {string} newKey
 * @returns {any}
 */
export function renameKeys(obj: any, oldKey: string, newKey: string): any {
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => renameKeys(item, oldKey, newKey))
  }

  // Handle objects
  if (obj && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const value = obj[key]
      const newKeyName = key === oldKey ? newKey : key

      acc[newKeyName] = renameKeys(value, oldKey, newKey)
      return acc
    }, {})
  }

  // Return non-object values as is
  return obj
}
