Mocking NotePlan objects in your Jest testing files:

1. Import the mock
2. Hoist the mock up to global scope in the beforeAll() method of your test file

For example:

import *as helpers from '../src/support/helpers'
import* as NPfile from '../src/NPPluginMain'
import DataStore from '../../__mocks__/DataStore.mock'
beforeAll(() => {
  global.DataStore = DataStore
})
describe('dwertheimer.JestHelpers' /*pluginID*/, () => {
  describe('DataStore' /*file*/, () => {
    describe('NP file settings mock' /*function*/, () => {
      test('should return a settings object with settingsFieldName', async () => {
        const res = await NPfile.testOfDataStoreAccess() // comes back undefined because DataStore is not mocked outside in NP files
        expect(res?.settingsFieldName).toEqual('Settings field value')
      })
    })
  })
})