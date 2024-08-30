/* globals describe, expect, test, afterAll, beforeAll */
import * as f from '../folders'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, /*Note, Paragraph*/ } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'DEBUG' //change this to DEBUG to get more logging,
  DataStore.folders = ['@Templates', '/', 'CCC Areas', 'CCC Areas/Staff', 'CCC Projects', 'Home Areas', 'TEST', 'TEST/TEST LEVEL 2', 'TEST/TEST LEVEL 2/TEST LEVEL 3', '@Archive/CCC Areas/Staff']
})

afterAll(() => {
  delete global.DataStore
})

describe('helpers/folders', () => {
  /**
   * Tests for getFoldersMatching:
   * Parameters:
   * - {Array<string>} inclusions
   * - {boolean} excludeSpecialFolders?
   */
  describe('getFoldersMatching tests', () => {
    test('no inclusions -> error', () => {
      const inclusions = []
      const folders = Object.keys(f.getFoldersMatching(inclusions, true))
      expect(folders.length).toBe(0)
    })
    test('just / inclusions -> 1', () => {
      const inclusions = ['/']
      const folders = Object.keys(f.getFoldersMatching(inclusions, true))
      expect(folders.length).toBe(1)
    })
    test('CCC inclusion no @specials -> 3 left', () => {
      const inclusions = ['CCC']
      const folders = Object.keys(f.getFoldersMatching(inclusions, true))
      expect(folders.length).toBe(3)
    })
    test('CCC Areas, / inclusion no @specials -> 3 left', () => {
      const inclusions = ['CCC Areas', '/']
      const folders = Object.keys(f.getFoldersMatching(inclusions, true))
      expect(folders.length).toBe(3)
    })
    test('CCC inclusion with @specials -> 4 left', () => {
      const inclusions = ['CCC']
      const folders = Object.keys(f.getFoldersMatching(inclusions, false))
      expect(folders.length).toBe(4)
    })
    test('CCC, LEVEL 2 inclusion with @specials -> 6 left', () => {
      const inclusions = ['CCC', 'LEVEL 2']
      const folders = Object.keys(f.getFoldersMatching(inclusions, false))
      expect(folders.length).toBe(6)
    })
    test('ccc, Level 2 inclusion with @specials -> 6 left (i.e. check case insensitive matching)', () => {
      const inclusions = ['ccc', 'Level 2']
      const folders = Object.keys(f.getFoldersMatching(inclusions, false))
      expect(folders.length).toBe(6)
    })
  })

  /**
   * Tests for getSubFolders
   */
  describe('getSubFolders tests', () => {
    // Needs to test for error
    test.skip('empty string -> error', () => {
      const subFolders = Object.keys(f.getSubFolders(''))
      expect(subFolders).toEqual([''])
    })
    // Needs to test for error
    test.skip('root -> root', () => {
      const subFolders = Object.keys(f.getSubFolders('/'))
      expect(subFolders).toEqual(['CCC Areas', 'CCC Areas/Staff', 'CCC Projects', 'Home Areas', 'TEST', 'TEST/TEST LEVEL 2', 'TEST/TEST LEVEL 2/TEST LEVEL 3', '@Archive/CCC Areas/Staff'])
    })
    test('a top-level folder -> same', () => {
      const subFolders = f.getSubFolders('CCC Areas')
      expect(subFolders).toEqual(['CCC Areas', 'CCC Areas/Staff'])
    })
    test('three-level folder', () => {
      const subFolders = f.getSubFolders('TEST/TEST LEVEL 2')
      expect(subFolders).toEqual(['TEST/TEST LEVEL 2', 'TEST/TEST LEVEL 2/TEST LEVEL 3'])
    })
  })

  /**
   * Tests for getFolderListMinusExclusions:
   * Parameters:
   * - {Array<string>} exclusions
   * - {boolean} excludeSpecialFolders? (default: true)
   * - {boolean} forceExcludeRootFolder? (default: false)
   */
  describe('getFolderListMinusExclusions tests', () => {
    test('no exclusions; specials false -> should return same list', () => {
      const exclusions = []
      const folders = Object.keys(f.getFolderListMinusExclusions(exclusions, false, false))
      expect(folders.length).toBe(10)
    })
    test("exclude none -> 10 left", () => {
      const exclusions = []
      const folders = Object.keys(f.getFolderListMinusExclusions(exclusions, false, true))
      expect(folders.length).toBe(9)
    })
    test('no exclusions; no specials no root -> 7 left', () => {
      const exclusions = []
      const folders = Object.keys(f.getFolderListMinusExclusions(exclusions, true, true))
      expect(folders.length).toBe(7)
    })
    test('TEST exclusions -> 5 left', () => {
      const exclusions = ['TEST']
      const folders = Object.keys(f.getFolderListMinusExclusions(exclusions))
      expect(folders.length).toBe(5)
    })
    test('TEST+CCC Areas exclusions -> 3 left', () => {
      const exclusions = ['TEST', 'CCC Areas']
      const folders = Object.keys(f.getFolderListMinusExclusions(exclusions))
      expect(folders.length).toBe(3)
    })
    test('Subfolder exclusion -> 6 left', () => {
      const exclusions = ['TEST/TEST LEVEL 2']
      const folders = Object.keys(f.getFolderListMinusExclusions(exclusions))
      expect(folders.length).toBe(6)
    })
    test('Subfolder exclusion (test for different case) -> 6 left', () => {
      const exclusions = ['Test/Test level 2']
      const folders = Object.keys(f.getFolderListMinusExclusions(exclusions))
      expect(folders.length).toBe(6)
    })
    test('Subfolder exclusion not matching -> 8 left', () => {
      const exclusions = ['TEST/NOT IN LIST']
      const folders = Object.keys(f.getFolderListMinusExclusions(exclusions))
      expect(folders.length).toBe(8)
    })
    test("no exclusion, no specials, exclude root -> 7 left", () => {
      const exclusions = []
      const folders = Object.keys(f.getFolderListMinusExclusions(exclusions, true, true))
      expect(folders.length).toBe(7)
    })
    test("no exclusion, no specials, can include root -> 8 left", () => {
      const exclusions = []
      const folders = Object.keys(f.getFolderListMinusExclusions(exclusions, true, false))
      expect(folders.length).toBe(8)
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
