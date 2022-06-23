// Jest testing docs: https://jestjs.io/docs/using-matchers

import * as helpers from '../src/support/helpers'

describe('np.ThemeChooser' /* pluginID */, () => {
  describe('helpers' /* file */, () => {
    describe('uppercase' /* function */, () => {
      test('should uppercase a lowercase string', async () => {
        // tests start with "should" to describe the expected behavior
        const result = await helpers.uppercase('hello world')
        expect(result).toEqual('HELLO WORLD')
      })
      test('should return empty string if empty string sent', async () => {
        // tests start with "should" to describe the expected behavior
        const result = await helpers.uppercase('')
        expect(result).toEqual('')
      })
      test('should return empty string if empty string sent', async () => {
        // tests start with "should" to describe the expected behavior
        const result = await helpers.uppercase()
        expect(result).toEqual('')
      })
    })
  })
})
