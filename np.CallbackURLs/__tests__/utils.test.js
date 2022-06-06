import utils from '../src/support/utils'

describe('np.CallbackURLs' /* pluginID */, () => {
  describe('utils' /* file */, () => {
    describe('uppercase' /* function */, () => {
      test('should uppercase a lowercase string', async () => {
        // tests start with "should" to describe the expected behavior
        const result = await utils.uppercase('hello world')
        expect(result).toEqual('HELLO WORLD')
        // Jest docs for matchers: https://jestjs.io/docs/using-matchers
      })
    })
  })
})
