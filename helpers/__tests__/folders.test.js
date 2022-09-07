/* globals describe, expect, test, afterAll, beforeAll */
import * as f from '../folders'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging,
  DataStore.folders = ['/', 'CCC Areas', 'CCC Areas/Staff', 'CCC Projects', 'Home Areas', '📋 Templates', 'TEST', 'TEST/TEST LEVEL 2', 'TEST/TEST LEVEL 2/TEST LEVEL 3']
})

afterAll(() => {
  delete global.DataStore
})

describe('helpers/folders', () => {
  describe('filterFolderList tests', () => {
    test('empty exclusions -> should return same list', () => {
      const exclusions = []
      const folders = Object.keys(f.filterFolderList(exclusions))
      expect(folders.length).toBe(9)
    })
    test('TEST exclusions -> 6 left', () => {
      const exclusions = ['TEST']
      const folders = Object.keys(f.filterFolderList(exclusions))
      expect(folders.length).toBe(6)
    })
    test('TEST+CCC Areas exclusions -> 4 left', () => {
      const exclusions = ['TEST', 'CCC Areas']
      const folders = Object.keys(f.filterFolderList(exclusions))
      expect(folders.length).toBe(4)
    })
    test('📋 Templates exclusions -> 8 left', () => {
      const exclusions = ['📋 Templates']
      const folders = Object.keys(f.filterFolderList(exclusions))
      expect(folders.length).toBe(8)
    })
    test('Subfolder exclusion -> 7 left', () => {
      const exclusions = ['TEST/TEST LEVEL 2']
      const folders = Object.keys(f.filterFolderList(exclusions))
      expect(folders.length).toBe(7)
    })
    test('Subfolder exclusion not matching -> 9 left', () => {
      const exclusions = ['TEST/TEST LEVEL 3']
      const folders = Object.keys(f.filterFolderList(exclusions))
      expect(folders.length).toBe(9)
    })
  })

  describe('getFolderFromFilename tests', () => {
    test('root (no folder part) -> empty', () => {
      expect(f.getFolderFromFilename('test-at-root.md')).toEqual('')
    })
    test('subfolder 1', () => {
      expect(f.getFolderFromFilename('one/two/three/four.md')).toEqual('one/two/three')
    })
    test('subfolder 2', () => {
      expect(f.getFolderFromFilename('one/two/three/four and a bit.md')).toEqual('one/two/three')
    })
    test('subfolder 3', () => {
      expect(f.getFolderFromFilename('one/two or three/fifteen.md')).toEqual('one/two or three')
    })
    test('leading slash', () => {
      expect(f.getFolderFromFilename('/sixes and sevenses/calm one.md')).toEqual('sixes and sevenses')
    })
  })
})
