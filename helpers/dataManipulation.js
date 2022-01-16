// @flow

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

