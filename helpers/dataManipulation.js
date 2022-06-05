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

