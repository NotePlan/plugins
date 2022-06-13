// Jest testing docs: https://jestjs.io/docs/using-matchers

import * as helpers from '../src/support/helpers'
import * as NPfile from '../src/NPPluginMain'
import DataStore from '../../__mocks__/DataStore.mock'

beforeAll(() => {
  global.DataStore = DataStore
})

describe('dwertheimer.JestHelpers' /* pluginID */, () => {
  describe('DataStore' /* file */, () => {
    describe('local settings mock' /* function */, () => {
      test('should return a settings object with settingsFieldName', async () => {
        const res = DataStore.settings //works because DataStore is mocked inside this context
        expect(res?.settingsFieldName).toEqual('Settings field value')
      })
      test('should return undefined for mocks not created yet', async () => {
        expect(await DataStore.calendarNoteByDate()).toEqual(undefined)
      })
    })
    describe('NP file settings mock' /* function */, () => {
      test('should return a settings object with settingsFieldName', async () => {
        const res = await NPfile.testOfDataStoreAccess() // comes back undefined because DataStore is not mocked outside in NP files
        expect(res?.settingsFieldName).toEqual('Settings field value')
      })
    })
  })
})
