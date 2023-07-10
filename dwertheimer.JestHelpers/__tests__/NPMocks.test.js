/* global describe, test, expect, beforeAll */
// Jest testing docs: https://jestjs.io/docs/using-matchers

import * as NPfile from '../src/NPPluginMain'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan({ selectedSidebarFolder: `SelectedFolder` })
})

describe('dwertheimer.JestHelpers' /* pluginID */, () => {
  describe('Calendar' /* file */, () => {
    describe('local settings mock' /* function */, () => {
      test('should return mock data: availableCalendarTitles', () => {
        const cal = Calendar // local context
        expect(cal.availableCalendarTitles(true)).toEqual(['cal1'])
      })
    })
    describe('NP file settings mock' /* function */, () => {
      test('should return mock data: availableCalendarTitles', async () => {
        const cal = await NPfile.getCalendar() // should come back with the mock
        expect(cal.availableCalendarTitles(false)).toEqual(['cal1', 'cal2'])
      })
    })
  })

  describe('Clipboard' /* file */, () => {
    describe('local settings mock' /* function */, () => {
      test('should return mock data: string', () => {
        const clip = Clipboard // should work in local context
        expect(clip.string).toEqual('clipString')
      })
    })
    describe('NP file settings mock' /* function */, () => {
      test('should return mock data: string', async () => {
        const clip = await NPfile.getClipboard() // should come back with the mock
        expect(clip.string).toEqual('clipString')
      })
    })
  })

  describe('CommandBar' /* file */, () => {
    describe('local settings mock' /* function */, () => {
      test('should return mock data: placeholder', () => {
        const commandBar = CommandBar //works because DataStore is mocked inside this context
        expect(commandBar.placeholder).toEqual('CommandBar placeholder')
      })
    })
    describe('NP file settings mock' /* function */, () => {
      test('should return mock data: placeholder', async () => {
        const commandBar = await NPfile.getCommandBar() // should come back with the mock
        expect(commandBar.placeholder).toEqual('CommandBar placeholder')
      })
    })
  })

  describe('DataStore' /* file */, () => {
    describe('local settings mock' /* function */, () => {
      test('should return mock data: settings', () => {
        const res = DataStore.settings //works because DataStore is mocked inside this context
        expect(res?.settingsFieldName).toEqual('Settings field value')
      })
    })
    describe('NP file settings mock' /* function */, () => {
      test('should return mock data: settings', async () => {
        const res = await NPfile.getDataStore() // comes back undefined because DataStore is not mocked outside in NP files
        expect(res?.settings.settingsFieldName).toEqual('Settings field value')
      })
    })
  })

  // dbw: Skipping Editor-specific mock tests because I am trying to get the undelying Note methods to override the Editor methods
  // where they exist
  describe('Editor' /* file */, () => {
    describe('Editor mock gets settings from underlying Note' /* function */, () => {
      test('should return mock data: filename', () => {
        const editor = Editor // should work in local context
        expect(editor.filename).toEqual('FILENAME_PLACEHOLDER_FROM_NOTE_MOCK') // gets overwritten by Note mock
      })
    })
    describe('NP file settings mock' /* function */, () => {
      test('should return mock data: filename', async () => {
        const editor = await NPfile.getEditor() // should come back with the mock
        expect(editor.filename).toEqual('FILENAME_PLACEHOLDER_FROM_NOTE_MOCK') // gets overwritten by Note mock
      })
    })
  })

  describe('NotePlan' /* file */, () => {
    describe('local settings mock' /* function */, () => {
      test('should return mock data: selectedSidebarFolder', () => {
        const noteplan = global.NotePlan // should work in local context
        expect(noteplan.selectedSidebarFolder).toEqual('SelectedFolder')
      })
    })
    describe('NP file settings mock' /* function */, () => {
      test('should return mock data: selectedSidebarFolder', async () => {
        const noteplan = await NPfile.getNotePlan() // should come back with the mock
        expect(noteplan.selectedSidebarFolder).toEqual('SelectedFolder')
      })
    })
  })

  describe('Note' /* file */, () => {
    test('should return mocked note', () => {
      const note = new Note({ filename: 'foo' }) // should work in local context
      expect(note.filename).toEqual('foo')
      expect(note.backlinks).toEqual([])
    })
  })

  describe('Paragraph' /* file */, () => {
    test('should return mocked paragraph', () => {
      const para = new Paragraph({ filename: 'foo' }) // should work in local context
      expect(para.filename).toEqual('foo')
      expect(para.linkedNoteTitles).toEqual([])
    })
  })
})
