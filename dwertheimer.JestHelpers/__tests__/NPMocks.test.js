// Jest testing docs: https://jestjs.io/docs/using-matchers

import * as helpers from '../src/support/helpers'
import * as NPfile from '../src/NPPluginMain'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
})

describe('dwertheimer.JestHelpers' /* pluginID */, () => {
  describe('Calendar' /* file */, () => {
    describe('local settings mock' /* function */, () => {
      test('should return a settings object with settingsFieldName', async () => {
        const cal = Calendar // local context
        expect(cal.availableCalendarTitles(true)).toEqual(['cal1'])
      })
    })
    describe('NP file settings mock' /* function */, () => {
      test('should return a settings object with settingsFieldName', async () => {
        const cal = await NPfile.getCalendar() // should come back with the mock
        expect(cal.availableCalendarTitles(false)).toEqual(['cal1', 'cal2'])
      })
    })
  })

  describe('Clipboard' /* file */, () => {
    describe('local settings mock' /* function */, () => {
      test('should return a settings object with settingsFieldName', async () => {
        const clip = Clipboard // should work in local context
        expect(clip.string).toEqual('clipString')
      })
    })
    describe('NP file settings mock' /* function */, () => {
      test('should return a settings object with settingsFieldName', async () => {
        const clip = await NPfile.getClipboard() // should come back with the mock
        expect(clip.string).toEqual('clipString')
      })
    })
  })

  describe('CommandBar' /* file */, () => {
    describe('local settings mock' /* function */, () => {
      test('should return a settings object with settingsFieldName', async () => {
        const commandBar = CommandBar //works because DataStore is mocked inside this context
        expect(commandBar.placeholder).toEqual('CommandBar placeholder')
      })
    })
    describe('NP file settings mock' /* function */, () => {
      test('should return a settings object with settingsFieldName', async () => {
        const commandBar = await NPfile.getCommandBar() // should come back with the mock
        expect(commandBar.placeholder).toEqual('CommandBar placeholder')
      })
    })
  })

  describe('DataStore' /* file */, () => {
    describe('local settings mock' /* function */, () => {
      test('should return a settings object with settingsFieldName', async () => {
        const res = DataStore.settings //works because DataStore is mocked inside this context
        expect(res?.settingsFieldName).toEqual('Settings field value')
      })
    })
    describe('NP file settings mock' /* function */, () => {
      test('should return a settings object with settingsFieldName', async () => {
        const res = await NPfile.getDataStore() // comes back undefined because DataStore is not mocked outside in NP files
        expect(res?.settings.settingsFieldName).toEqual('Settings field value')
      })
    })
  })

  describe('Editor' /* file */, () => {
    describe('local settings mock' /* function */, () => {
      test('should return a settings object with settingsFieldName', async () => {
        const editor = Editor // should work in local context
        expect(editor.filename).toEqual('thisFileName.txt')
      })
    })
    describe('NP file settings mock' /* function */, () => {
      test('should return a settings object with settingsFieldName', async () => {
        const editor = await NPfile.getEditor() // should come back with the mock
        expect(editor.filename).toEqual('thisFileName.txt')
      })
    })
  })

  describe('NotePlan' /* file */, () => {
    describe('local settings mock' /* function */, () => {
      test('should return a settings object with settingsFieldName', async () => {
        const noteplan = NotePlan // should work in local context
        expect(noteplan.selectedSidebarFolder).toEqual('SelectedFolder')
      })
    })
    describe('NP file settings mock' /* function */, () => {
      test('should return a settings object with settingsFieldName', async () => {
        const noteplan = await NPfile.getNotePlan() // should come back with the mock
        expect(noteplan.selectedSidebarFolder).toEqual('SelectedFolder')
      })
    })
  })
})
