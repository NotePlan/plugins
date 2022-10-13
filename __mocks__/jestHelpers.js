// @flow

/**
 * Check if a spy was called (at any point) with a string parameter matching the given string/regex
 * Mostly used for checking a console.log call when you don't know when in the sequence that log may have been called
 * Assumes that the parameter to the mock was a string (e.g. console.log(xxx))
 * @param { JestSpyType } spy
 * @param {regexp|string} testStrRegex - a string or regex to match the spy call's arguments
 * @returns {boolean} was called or not
 * @example usage:
      const spy = jest.spyOn(console, 'log')
      const result = mainFile.getConfig()
      expect(mockWasCalledWithString(spy, /config was empty/)).toBe(true)
 */
export const mockWasCalledWithString = (spy: any, testStrRegex: RegExp | string): boolean => {
  let found = []
  const regex = typeof testStrRegex === 'string' ? new RegExp(testStrRegex) : testStrRegex
  if (spy?.mock?.calls?.length) {
    const calls = spy.mock.calls
    found = calls.filter((call) => call.find((arg) => regex.test(arg)))
  }
  return found.length > 0
}

/**
 * Minimize console.log output during test runs
 * (way to much wasted whitespace in the jest default output)
 * per: https://stackoverflow.com/questions/51555568/remove-logging-the-origin-line-in-jest/57443150#57443150
 * @param {*} type
 * @param {*} message
 * @returns
 */
export function simpleFormatter(type: string, message: string): string {
  const TITLE_INDENT = '    '
  const CONSOLE_INDENT = `${TITLE_INDENT}  `

  return message
    .split(/\n/)
    .map((line) => CONSOLE_INDENT + line)
    .join('\n')
}
