// Jest testing docs: https://jestjs.io/docs/using-matchers

import * as helpers from '../src/support/helpers'
import * as NPfile from '../src/NPPluginMain'
import DataStore from '../../__mocks__/DataStore.mock'

jest.mock('DataStore')

describe('dwertheimer.JestHelpers' /* pluginID */, () => {
  describe('DataStore' /* file */, () => {
    describe('local settings mock' /* function */, () => {
      test('should return a settings object', async () => {
        const res = DataStore.settings
        expect(res?.settingsFieldName).toEqual('Settings field value')
      })
    })
    describe('NP file settings mock' /* function */, () => {
      test('should return a settings object', async () => {
        const res = NPfile.testOfDataStoreAccess()
        expect(res?.settingsFieldName).toEqual('Settings field value')
      })
    })
  })
})
