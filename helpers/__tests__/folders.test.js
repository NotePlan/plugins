/* globals describe, expect, test, afterAll, beforeAll */
import * as f from '../folders'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan /*Note, Paragraph*/ } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging,
  DataStore.folders = [
    '@Templates',
    '/',
    'CCC Areas',
    'CCC Areas/Staff',
    'CCC Projects',
    'Home Areas',
    'TEST',
    'TEST/TEST LEVEL 2',
    'TEST/TEST LEVEL 2/TEST LEVEL 3',
    '@Archive/CCC Areas/Staff',
  ]
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
    test('no inclusions or exclusions (excludeSpecialFolders) -> all', () => {
      const inclusions = []
      const folders = f.getFoldersMatching(inclusions)
      expect(folders.length).toBe(8)
    })
    test('no inclusions or exclusions -> all', () => {
      const inclusions = []
      const folders = f.getFoldersMatching(inclusions, false)
      expect(folders.length).toBe(10)
    })
    describe('just inclusions, no @specials', () => {
      test('/ inclusion -> 1', () => {
        const inclusions = ['/']
        const folders = f.getFoldersMatching(inclusions)
        expect(folders.length).toBe(1)
      })
      test('CCC inclusion no @specials', () => {
        const inclusions = ['CCC']
        const folders = f.getFoldersMatching(inclusions)
        expect(folders.length).toBe(4)
      })
      test('CCC inclusion with @specials', () => {
        const inclusions = ['CCC']
        const folders = f.getFoldersMatching(inclusions, false)
        expect(folders.length).toBe(5)
      })
      test('CCC Areas + / inclusion no @specials', () => {
        // Note: slightly redundant now
        const inclusions = ['CCC Areas', '/']
        const folders = f.getFoldersMatching(inclusions)
        expect(folders.length).toBe(3)
      })
      test('CCC + LEVEL 2 inclusion with @specials', () => {
        const inclusions = ['CCC', 'LEVEL 2']
        const folders = f.getFoldersMatching(inclusions, false)
        expect(folders.length).toBe(7)
      })
      test('CCC + LEVEL 2 inclusion with @specials and explicit empty exclusions', () => {
        const inclusions = ['CCC', 'LEVEL 2']
        const folders = f.getFoldersMatching(inclusions, false, [])
        expect(folders.length).toBe(7)
      })
    })
    describe('just exclusions', () => {
      test('exclude CCC Areas; include @specials', () => {
        const exclusions = ['CCC Areas']
        const folders = f.getFoldersMatching([], false, exclusions)
        expect(folders.length).toBe(7)
        expect(folders).toEqual(['/', '@Templates', 'CCC Projects', 'Home Areas', 'TEST', 'TEST/TEST LEVEL 2', 'TEST/TEST LEVEL 2/TEST LEVEL 3'])
      })
      test('exclude CCC, LEVEL 2; include @specials', () => {
        const exclusions = ['CCC', 'LEVEL 2']
        const folders = f.getFoldersMatching([], false, exclusions)
        expect(folders.length).toBe(4)
        expect(folders).toEqual(['/', '@Templates', 'Home Areas', 'TEST'])
      })
      test('exclude CCC, LEVEL 2; no @specials', () => {
        const exclusions = ['CCC', 'LEVEL 2']
        const folders = f.getFoldersMatching([], true, exclusions)
        expect(folders.length).toBe(3)
        expect(folders).toEqual(['/', 'Home Areas', 'TEST'])
      })
    })
    describe('both inclusions + exclusions', () => {
      test('TEST + CCC minus LEVEL; include @specials', () => {
        const inclusions = ['TEST', 'CCC']
        const exclusions = ['LEVEL']
        const folders = f.getFoldersMatching(inclusions, false, exclusions)
        expect(folders.length).toBe(6)
      })
      test('exclude CCC Areas; exclude @specials', () => {
        const inclusions = ['TEST', 'CCC']
        const exclusions = ['LEVEL']
        const folders = f.getFoldersMatching(inclusions, true, exclusions)
        expect(folders.length).toBe(5)
      })
      test('include CCC; exclude Areas', () => {
        const inclusions = ['CCC']
        const exclusions = ['Areas']
        const folders = f.getFoldersMatching(inclusions, false, exclusions)
        expect(folders.length).toBe(2)
      })
      test('include CCC, Home; exclude CCC', () => {
        const inclusions = ['CCC', 'Home']
        const exclusions = ['CCC']
        const folders = f.getFoldersMatching(inclusions, false, exclusions)
        expect(folders.length).toBe(2)
      })
    })
    describe('case insensitive check', () => {
      test('test + cCc minus Level; include @specials', () => {
        const inclusions = ['test', 'cCc']
        const exclusions = ['Level']
        const folders = f.getFoldersMatching(inclusions, false, exclusions)
        expect(folders.length).toBe(6)
      })
    })

    // See also bigger real world test at end
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
      const folders = f.getFolderListMinusExclusions(exclusions, false, false)
      expect(folders.length).toBe(10)
    })
    test('exclude none -> 10 left', () => {
      const exclusions = []
      const folders = f.getFolderListMinusExclusions(exclusions, false, true)
      expect(folders.length).toBe(9)
    })
    test('no exclusions; no specials no root -> 7 left', () => {
      const exclusions = []
      const folders = f.getFolderListMinusExclusions(exclusions, true, true)
      expect(folders.length).toBe(7)
    })
    test('TEST exclusions -> 5 left', () => {
      const exclusions = ['TEST']
      const folders = f.getFolderListMinusExclusions(exclusions)
      expect(folders.length).toBe(5)
    })
    test('TEST+CCC Areas exclusions -> 3 left', () => {
      const exclusions = ['TEST', 'CCC Areas']
      const folders = f.getFolderListMinusExclusions(exclusions)
      expect(folders.length).toBe(3)
    })
    test('Subfolder exclusion -> 6 left', () => {
      const exclusions = ['TEST/TEST LEVEL 2']
      const folders = f.getFolderListMinusExclusions(exclusions)
      expect(folders.length).toBe(6)
    })
    test('Subfolder exclusion (test for different case) -> 6 left', () => {
      const exclusions = ['Test/Test level 2']
      const folders = f.getFolderListMinusExclusions(exclusions)
      expect(folders.length).toBe(6)
    })
    test('Subfolder exclusion not matching -> 8 left', () => {
      const exclusions = ['TEST/NOT IN LIST']
      const folders = f.getFolderListMinusExclusions(exclusions)
      expect(folders.length).toBe(8)
    })
    test('no exclusion, no specials, exclude root -> 7 left', () => {
      const exclusions = []
      const folders = f.getFolderListMinusExclusions(exclusions, true, true)
      expect(folders.length).toBe(7)
    })
    test('no exclusion, no specials, can include root -> 8 left', () => {
      const exclusions = []
      const folders = f.getFolderListMinusExclusions(exclusions, true, false)
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

  // Note: Has to go last as it uses beforeAll
  describe('getFoldersMatching: bigger real world test', () => {
    beforeAll(() => {
      DataStore.folders = [
        '/',
        'CCC Areas',
        'CCC Areas/Facilities',
        'CCC Areas/Staff',
        'CCC Meetings',
        'CCC Meetings/2023',
        'CCC Meetings/2023/01',
        'CCC Meetings/2023 /02',
        'CCC Notes',
        'CCC Projects',
        'CCC Projects/Facilities',
        'Home 🏠 Areas',
        'Home 🏠 Notes',
        'Home 🏠 Projects',
        'Ministry Areas',
        'Ministry Meetings',
        'Ministry Notes',
        'Ministry Notes/Gather Movement',
        'Ministry Notes/Magic - Conjuring',
        'Ministry Projects',
        'NotePlan Notes',
        'NotePlan Projects',
        'NotePlan Projects/Plugins',
        'Readwise 📚',
        'Readwise 📚/articles',
        'Readwise 📚/books',
        'Readwise 📚/podcasts',
        'Readwise 📚/tweets',
        'Reviews',
        'Saved Searches',
        'Summaries',
        'TEST',
        'TEST/BUG TEST',
        'TEST/BUG TEST/George65',
        'TEST/BUG hunting for others',
        'TEST/BUG hunting for others/George65',
        'TEST/Conflict Testing',
        'TEST/DEMOs',
        'TEST/Dashboard TESTs',
        'TEST/Date TESTs',
        'TEST/Duplicate Testing',
        'TEST/Event TESTs',
        'TEST/Filer TESTs',
        'TEST/MOC TESTs',
        'TEST/Progress Log tests for Jord8on',
        'TEST/Repeat TESTs',
        'TEST/Review TESTs',
        'TEST/Review TESTs/Test Completed Goal.md',
        'TEST/Review TESTs/Test Completed Goal.md/Gather Movement',
        'TEST/Review TESTs/Test Completed Goal.md/Magic - Conjuring',
        'TEST/Search TESTs',
        'TEST/Summary TESTs',
        'TEST/TEST LEVEL 2',
        'TEST/TEST LEVEL 2/TEST LEVEL 3',
        'TEST/TESTs for DW things',
        'TEST/Window TESTs /',
      ]
    })
    test('real world test -> 6 left', () => {
      const inclusions = ['Home', 'NotePlan']
      const exclusions = ['Readwise 📚']
      const folders = f.getFoldersMatching(inclusions, false, exclusions)
      expect(folders.length).toBe(7)
    })
  })
})
