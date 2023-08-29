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
  DataStore.settings['_logLevel'] = 'DEBUG' //change this to DEBUG to get more logging,
  DataStore.folders = ['@Templates', '/', 'CCC Areas', 'CCC Areas/Staff', 'CCC Projects', 'Home Areas', 'TEST', 'TEST/TEST LEVEL 2', 'TEST/TEST LEVEL 2/TEST LEVEL 3']
})

afterAll(() => {
  delete global.DataStore
})

/**
 * Tests for filteredFolderList:
 * Parameters:
 * - {Array<string>} exclusions
 * - {boolean} excludeSpecialFolders? [default true]
 * - {Array<string>} inclusions? [default empty array]
 * - {boolean} includeRootFolder? (default: true)
 */
describe('helpers/folders', () => {
  describe('getFilteredFolderList tests', () => {
    test('no exclusions; specials false -> should return same list', () => {
      const exclusions = []
      const folders = Object.keys(f.getFilteredFolderList(exclusions, false))
      expect(folders.length).toBe(9)
    })
    test("exclude none -> 9 left", () => {
      const exclusions = []
      const inclusions = []
      const folders = Object.keys(f.getFilteredFolderList(exclusions, false, inclusions, true))
      expect(folders.length).toBe(9)
    })
    test("exclude none but root -> 8 left", () => {
      const exclusions = []
      const inclusions = []
      const folders = Object.keys(f.getFilteredFolderList(exclusions, false, inclusions, false))
      expect(folders.length).toBe(8)
    })
    test('no exclusions; specials false -> 8 left', () => {
      const exclusions = []
      const folders = Object.keys(f.getFilteredFolderList(exclusions, true))
      expect(folders.length).toBe(8)
    })
    test('TEST exclusions -> 5 left', () => {
      const exclusions = ['TEST']
      const folders = Object.keys(f.getFilteredFolderList(exclusions))
      expect(folders.length).toBe(5)
    })
    test('TEST+CCC Areas exclusions -> 3 left', () => {
      const exclusions = ['TEST', 'CCC Areas']
      const folders = Object.keys(f.getFilteredFolderList(exclusions))
      expect(folders.length).toBe(3)
    })
    test('Subfolder exclusion -> 6 left', () => {
      const exclusions = ['TEST/TEST LEVEL 2']
      const folders = Object.keys(f.getFilteredFolderList(exclusions))
      expect(folders.length).toBe(6)
    })
    test('Subfolder exclusion not matching -> 8 left', () => {
      const exclusions = ['TEST/NOT IN LIST']
      const folders = Object.keys(f.getFilteredFolderList(exclusions))
      expect(folders.length).toBe(8)
    })
    test('no exclusions; CCC inclusion -> 4 left', () => {
      const exclusions = []
      const inclusions = ['CCC']
      const folders = Object.keys(f.getFilteredFolderList(exclusions, true, inclusions))
      expect(folders.length).toBe(4)
    })
    test('no exclusions; CCC, LEVEL 2 inclusion -> 6 left', () => {
      const exclusions = []
      const inclusions = ['CCC', 'LEVEL 2']
      const folders = Object.keys(f.getFilteredFolderList(exclusions, true, inclusions))
      expect(folders.length).toBe(6)
    })
    test("'CCC Projects' exclusion; 'CCC', 'LEVEL 2' inclusion -> 5 left", () => {
      const exclusions = ['CCC Projects']
      const inclusions = ['CCC', 'LEVEL 2']
      const folders = Object.keys(f.getFilteredFolderList(exclusions, true, inclusions))
      expect(folders.length).toBe(5)
    })
    test("'LEVEL 3' exclusion; 'CCC', 'LEVEL 2' inclusion -> 6 left", () => {
      const exclusions = ['LEVEL 3']
      const inclusions = ['CCC', 'LEVEL 2']
      const folders = Object.keys(f.getFilteredFolderList(exclusions, true, inclusions))
      expect(folders.length).toBe(6)
    })
  })

  describe('getFolderFromFilename tests', () => {
    test('root (no folder part) -> empty', () => {
      expect(f.getFolderFromFilename('test-at-root.md')).toEqual('/')
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

  describe('getLowestLevelFolderFromFilename tests', () => {
    test('root (no folder part) -> empty', () => {
      expect(f.getLowestLevelFolderFromFilename('test-at-root.md')).toEqual('')
    })
    test('single folder level', () => {
      expect(f.getLowestLevelFolderFromFilename('folder one/note.md')).toEqual('folder one')
    })
    test('subfolder 2', () => {
      expect(f.getLowestLevelFolderFromFilename('one/two/three/four and a bit.md')).toEqual('three')
    })
    test('subfolder 3', () => {
      expect(f.getLowestLevelFolderFromFilename('one/two or three/fifteen.md')).toEqual('two or three')
    })
    test('leading slash', () => {
      expect(f.getLowestLevelFolderFromFilename('/sixes and sevenses/calm one.md')).toEqual('sixes and sevenses')
    })
  })
})
