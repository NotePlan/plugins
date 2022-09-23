// @flow

/**
 * Check if a spy was called (at any point) with a regex
 * @param { JestSpyType } spy
 * @param {*} regex - a regex to match the spy call's arguments
 * @returns {boolean} was called or not
 * @example usage:
      const spy = jest.spyOn(console, 'log')
      const result = mainFile.getConfig()
      expect(mockWasCalledWith(spy, /config was empty/)).toBe(true)
 */
export const mockWasCalledWith = (spy: any, regex: RegExp): boolean => {
  let found = []
  if (spy?.mock?.calls?.length) {
    const calls = spy.mock.calls
    found = calls.filter((call) => call.find((arg) => regex.test(arg)))
  }
  return found.length > 0
}
