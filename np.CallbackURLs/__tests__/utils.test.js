/* global describe, test, expect */
import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'
import utils from '../src/support/utils'

// Make DataStore and Editor available globally for the source code
global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan

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
