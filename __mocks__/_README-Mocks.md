# Mocking NotePlan objects in your Jest testing files:

## Steps:
1. Import the mocks
2. Hoist the mock up to global scope in the beforeAll() method of your test file
3. Create content mocks (if necessary) to populate top level objects with Notes, Paragraphs, etc.

## Basic example:

```js
/* global describe, test, it, jest, expect */
import *as helpers from '../src/support/helpers'
import* as NPfile from '../src/NPPluginMain'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, NoteMock, ParagraphMock } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
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
```