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
  let fullArray: string[] = []
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
export const castBooleanFromMixed = (val: { [key: string]: unknown }, key: string): boolean => {
  return val.hasOwnProperty(key) ? ((val[key] as any) as boolean) : false
}

/**
 * Cast number from the config mixed. Based on @m1well's config system.
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {number} cast value
 */
export const castNumberFromMixed = (val: { [key: string]: unknown }, key: string): number => {
  return val.hasOwnProperty(key) ? ((val[key] as any) as number) : NaN
}

/**
 * cast string from the config mixed
 * @author @m1well
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {string} casted value
 */
export const castStringFromMixed = (val: { [key: string]: unknown }, key: string): string => {
  return val.hasOwnProperty(key) ? ((val[key] as any) as string) : ''
}

/**
 * cast string array from the config mixed
 * @author @m1well
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {Array<string>} casted array
 */
export const castStringArrayFromMixed = (val: { [key: string]: unknown }, key: string): Array<string> => {
  return val.hasOwnProperty(key) ? ((val[key] as any) as Array < string >) : []
}

/**
 * Cast number from the config mixed. Based on @m1well's config system.
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {number} cast value
 */

export const castHeadingLevelFromMixed = (val: { [key: string]: unknown }, key: string): headingLevelType => {
  return val.hasOwnProperty(key) ? ((val[key] as any) as headingLevelType) : 2
}

