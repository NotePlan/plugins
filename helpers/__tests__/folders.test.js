/* globals describe, expect, test, afterAll, beforeAll */
import * as f from '../folders'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan /*Note, Paragraph*/ } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging, or 'none' to get less
  DataStore.folders = [
    '/',
    '%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919', // Note: assumes b1417+ to make this root present
    '@Archive/CCC Areas/Staff',
    '@Templates',
    'CCC Areas',
    'CCC Areas/Staff',
    'CCC Projects',
    'Home Areas',
    'TEST',
    'TEST/TEST LEVEL 2',
    'TEST/TEST LEVEL 2/TEST LEVEL 3',
  ]
  DataStore.teamspaces = [
    {
      filename: '%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919',
      title: 'Dashboard Plugin',
    },
  ]
})

afterAll(() => {
  delete global.DataStore
})

describe('helpers/folders', () => {
  /**
   * Tests for getFolderDisplayName:
   * Parameters:
   * - {string} folderPath - as returned by DataStore.folders
   */
  describe('getFolderDisplayName tests', () => {
    test('root folder', () => {
      expect(f.getFolderDisplayName('/')).toEqual('/')
    })
    test('subfolder', () => {
      expect(f.getFolderDisplayName('CCC Areas/Staff')).toEqual('CCC Areas/Staff')
    })
    test('Teamspace root folder', () => {
      expect(f.getFolderDisplayName('%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919')).toEqual('[👥 Dashboard Plugin] /')
    })
    test('Teamspace root folder no emoji', () => {
      expect(f.getFolderDisplayName('%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919', false)).toEqual('[Dashboard Plugin] /')
    })
    test('Teamspace subfolder', () => {
      expect(f.getFolderDisplayName('%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919/Dashboard')).toEqual('[👥 Dashboard Plugin] Dashboard')
    })
    test('Teamspace subfolder no emoji', () => {
      expect(f.getFolderDisplayName('%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919/Dashboard', false)).toEqual('[Dashboard Plugin] Dashboard')
    })
  })

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
      expect(folders.length).toBe(9)
    })
    test('no inclusions or exclusions -> all', () => {
      const inclusions = []
      const folders = f.getFoldersMatching(inclusions, false)
      expect(folders.length).toBe(11)
    })
    test('no inclusions or exclusions but exclude teamspaces -> all but one', () => {
      const inclusions = []
      const folders = f.getFoldersMatching(inclusions, false, [], true)
      expect(folders.length).toBe(10)
    })
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
  
    describe('just exclusions', () => {
      test('exclude CCC Areas; include @specials', () => {
        const exclusions = ['CCC Areas']
        const folders = f.getFoldersMatching([], false, exclusions)
        expect(folders.length).toBe(8)
        expect(folders).toEqual(['/', '%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919', 'CCC Projects', 'Home Areas', 'TEST', 'TEST/TEST LEVEL 2', 'TEST/TEST LEVEL 2/TEST LEVEL 3', '@Templates'])
      })
      test('exclude CCC, LEVEL 2; include @specials', () => {
        const exclusions = ['CCC', 'LEVEL 2']
        const folders = f.getFoldersMatching([], false, exclusions)
        expect(folders.length).toBe(5)
        expect(folders).toEqual(['/','%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919', 'Home Areas', 'TEST', '@Templates'])
      })
      test('exclude CCC, LEVEL 2; no @specials', () => {
        const exclusions = ['CCC', 'LEVEL 2']
        const folders = f.getFoldersMatching([], true, exclusions)
        expect(folders.length).toBe(4)
        expect(folders).toEqual(['/', '%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919', 'Home Areas', 'TEST'])
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
    test('teamspace exclusion check', () => {
      const inclusions = []
      const exclusions = []
      const folders = f.getFoldersMatching(inclusions, false, exclusions, true)
      expect(folders.length).toBe(10)
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
      expect(folders.length).toBe(11)
    })
    test('exclude none (other than root) -> 10 left', () => {
      const exclusions = []
      const folders = f.getFolderListMinusExclusions(exclusions, false, true)
      expect(folders.length).toBe(10)
      expect(folders).not.toContain('/')
    })
    test('no exclusions; no specials no root -> 8 left', () => {
      const exclusions = []
      const folders = f.getFolderListMinusExclusions(exclusions, true, true)
      expect(folders.length).toBe(8)
    })
    test('TEST exclusions -> 6 left', () => {
      const exclusions = ['TEST']
      const folders = f.getFolderListMinusExclusions(exclusions)
      expect(folders.length).toBe(6)
    })
    test('TEST+CCC Areas exclusions -> 4 left', () => {
      const exclusions = ['TEST', 'CCC Areas']
      const folders = f.getFolderListMinusExclusions(exclusions)
      expect(folders.length).toBe(4)
    })
    test('Subfolder exclusion -> 7 left', () => {
      const exclusions = ['TEST/TEST LEVEL 2']
      const folders = f.getFolderListMinusExclusions(exclusions)
      expect(folders.length).toBe(7)
    })
    test('Subfolder exclusion (test for different case) -> 7 left', () => {
      const exclusions = ['Test/Test level 2']
      const folders = f.getFolderListMinusExclusions(exclusions)
      expect(folders.length).toBe(7)
    })
    test('Subfolder exclusion not matching -> 9 left', () => {
      const exclusions = ['TEST/NOT IN LIST']
      const folders = f.getFolderListMinusExclusions(exclusions)
      expect(folders.length).toBe(9)
    })
    test('no exclusion, no specials, exclude root -> 8 left', () => {
      const exclusions = []
      const folders = f.getFolderListMinusExclusions(exclusions, true, true)
      expect(folders.length).toBe(8)
    })
    test('no exclusion, no specials, can include root -> 9 left', () => {
      const exclusions = []
      const folders = f.getFolderListMinusExclusions(exclusions, true, false)
      expect(folders.length).toBe(9)
    })
  })

  /**
   * Tests for orderFolders:
   * Parameters:
   * - {Array<string>} folders
   */
  describe('orderFolders tests', () => {
    test('orderFolders test', () => {
      const inputFolders = [
        '/',
        '%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919',
        '@Archive should be at end',
        '@Templates should be at end',
        'CCC Areas',
        'CCC Areas/Staff',
        'CCC Projects',
        'Home Areas',
        'TEST',
        'TEST/TEST LEVEL 2',
        'TEST/TEST LEVEL 2/TEST LEVEL 3',
        '_Should be early',
        '@Meta should be early',
        '100 should be after 20',
        '20 should be after 5',
        '5 should be at start',
      ]
      const outputFolders = f.orderFolders(inputFolders)
      expect(outputFolders.length).toBe(inputFolders.length)
      expect(outputFolders).toEqual([
        '/',
        '5 should be at start',
        '20 should be after 5',
        '100 should be after 20',
        '_Should be early',
        '@Meta should be early',
        '%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919',
        'CCC Areas',
        'CCC Areas/Staff',
        'CCC Projects',
        'Home Areas',
        'TEST',
        'TEST/TEST LEVEL 2',
        'TEST/TEST LEVEL 2/TEST LEVEL 3',
        '@Archive should be at end',
        '@Templates should be at end',
      ])
    })
  })

  /**
   * Tests for getFolderFromFilename:
   * Parameters:
   * - {string} fullFilename - full filename to get folder name part from
   */
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

    // Additional edge case tests, suggesed by Cursor
    test('single folder level', () => {
      expect(f.getFolderFromFilename('folder/file.md')).toEqual('folder')
    })
    test('file without extension', () => {
      expect(f.getFolderFromFilename('folder/subfolder/filename')).toEqual('folder/subfolder')
    })
    test('deeply nested folders', () => {
      expect(f.getFolderFromFilename('a/b/c/d/e/f/g.md')).toEqual('a/b/c/d/e/f')
    })
    test('folder with special characters', () => {
      expect(f.getFolderFromFilename('folder@special/sub$folder/file.md')).toEqual('folder@special/sub$folder')
    })
    test('folder with unicode characters', () => {
      expect(f.getFolderFromFilename('📁 folder/📝 note.md')).toEqual('📁 folder')
    })
    test('empty string input', () => {
      expect(f.getFolderFromFilename('')).toEqual('(error)')
    })
    test('only filename with no path', () => {
      expect(f.getFolderFromFilename('justfilename.txt')).toEqual('/')
    })
    test('filename starting with dot', () => {
      expect(f.getFolderFromFilename('folder/.hidden-file')).toEqual('folder')
    })
    test('multiple dots in filename', () => {
      expect(f.getFolderFromFilename('folder/file.name.with.dots.md')).toEqual('folder')
    })
    test('folder name ending with extension-like pattern', () => {
      expect(f.getFolderFromFilename('folder.name/file.md')).toEqual('folder.name')
    })
    test('filename of regular note in teamspace root folder', () => {
      expect(f.getFolderFromFilename('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/5a31e9ea-732f-45ba-8464-11260522e0de')).toEqual('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1')
    })
    test('filename of calendar note in teamspace subfolder', () => {
      expect(f.getFolderFromFilename('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/20250422.md')).toEqual('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1')
    })
    test('filename of note in teamspace subfolder with leading slash', () => {
      expect(f.getFolderFromFilename('%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919/Dashboard Issues/9972af6a-ec7a-4fe5-87b9-9005aa0d122c')).toEqual('%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919/Dashboard Issues')
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

  // Note: Has to go last as it uses beforeAll.
  describe('getFoldersMatching: bigger real world test', () => {
    beforeAll(() => {
      DataStore.folders = [
        '/',
        '%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1',
        '%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/Dashboard',
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
        'TEST/TEST LEVEL 2',
        'TEST/TEST LEVEL 2/TEST LEVEL 3',
        'TEST/TESTs for DW things',
        'TEST/Window TESTs /',
      ]
    })
    test('real world test -> 13 left', () => {
      const inclusions = ['Home', 'CCC']
      // const exclusions = ['Readwise 📚']
      const result = f.getFoldersMatching(inclusions, false)
      expect(result.length).toBe(14)
    })
    test('real world test -> does not include root folder "/"', () => {
      const inclusions = ['Home', 'CCC']
      const result = f.getFoldersMatching(inclusions, false)
      expect(result).toContain('/')
    })
    test('real world test -> 48 left', () => {
      // const inclusions = ['Home', 'NotePlan']
      const exclusions = ['Readwise 📚']
      expect(f.getFoldersMatching([], false, exclusions).length).toBe(48)
    })
  })

  describe('getJustFilenameFromFullFilename tests', () => {
    describe('without removeExtension parameter (default false)', () => {
      test('file in root folder', () => {
        expect(f.getJustFilenameFromFullFilename('document.md')).toEqual('document.md')
      })

      test('file in single subfolder', () => {
        expect(f.getJustFilenameFromFullFilename('folder/document.md')).toEqual('document.md')
      })

      test('file in deeply nested folders', () => {
        expect(f.getJustFilenameFromFullFilename('one/two/three/four/document.md')).toEqual('document.md')
      })

      test('file with no extension', () => {
        expect(f.getJustFilenameFromFullFilename('folder/filename')).toEqual('filename')
      })

      test('file with multiple extensions', () => {
        expect(f.getJustFilenameFromFullFilename('folder/archive.tar.gz')).toEqual('archive.tar.gz')
      })

      test('hidden file (starting with dot)', () => {
        expect(f.getJustFilenameFromFullFilename('folder/.hidden')).toEqual('.hidden')
      })

      test('hidden file with extension', () => {
        expect(f.getJustFilenameFromFullFilename('folder/.gitignore')).toEqual('.gitignore')
      })

      test('filename with special characters', () => {
        expect(f.getJustFilenameFromFullFilename('folder/file@name$special.md')).toEqual('file@name$special.md')
      })

      test('filename with unicode characters', () => {
        expect(f.getJustFilenameFromFullFilename('folder/📝 note file.md')).toEqual('📝 note file.md')
      })

      test('filename with spaces', () => {
        expect(f.getJustFilenameFromFullFilename('folder/my important note.md')).toEqual('my important note.md')
      })

      test('leading slash in path', () => {
        expect(f.getJustFilenameFromFullFilename('/folder/document.md')).toEqual('document.md')
      })

      test('multiple leading slashes', () => {
        expect(f.getJustFilenameFromFullFilename('//folder//document.md')).toEqual('document.md')
      })
    })

    describe('with removeExtension = true', () => {
      test('file in root folder - remove extension', () => {
        expect(f.getJustFilenameFromFullFilename('document.md', true)).toEqual('document')
      })

      test('file in subfolder - remove extension', () => {
        expect(f.getJustFilenameFromFullFilename('folder/document.md', true)).toEqual('document')
      })

      test('file with multiple extensions - remove only last extension', () => {
        expect(f.getJustFilenameFromFullFilename('folder/archive.tar.gz', true)).toEqual('archive.tar')
      })

      test('file with no extension - return as is', () => {
        expect(f.getJustFilenameFromFullFilename('folder/filename', true)).toEqual('filename')
      })

      test('filename ending with dot - return as is', () => {
        expect(f.getJustFilenameFromFullFilename('folder/filename.', true)).toEqual('filename.')
      })

      test('filename with multiple dots - remove only final extension', () => {
        expect(f.getJustFilenameFromFullFilename('folder/file.name.with.dots.md', true)).toEqual('file.name.with.dots')
      })

      test('deeply nested file - remove extension', () => {
        expect(f.getJustFilenameFromFullFilename('a/b/c/d/e/document.txt', true)).toEqual('document')
      })
    })

    describe('with removeExtension = false (explicit)', () => {
      test('file with extension - keep extension', () => {
        expect(f.getJustFilenameFromFullFilename('folder/document.md', false)).toEqual('document.md')
      })

      test('file without extension - return as is', () => {
        expect(f.getJustFilenameFromFullFilename('folder/filename', false)).toEqual('filename')
      })
    })

    describe('edge cases', () => {
      test('empty string', () => {
        expect(f.getJustFilenameFromFullFilename('')).toEqual('')
      })

      test('only slash', () => {
        expect(f.getJustFilenameFromFullFilename('/')).toEqual('')
      })

      test('multiple slashes only', () => {
        expect(f.getJustFilenameFromFullFilename('///')).toEqual('')
      })

      test('path ending with slash', () => {
        expect(f.getJustFilenameFromFullFilename('folder/subfolder/')).toEqual('')
      })

      test('filename that looks like extension only', () => {
        expect(f.getJustFilenameFromFullFilename('folder/.md')).toEqual('.md')
      })

      test('filename that looks like extension only - remove extension', () => {
        expect(f.getJustFilenameFromFullFilename('folder/.md', true)).toEqual('')
      })

      test('very long filename', () => {
        const longName = 'a'.repeat(200) + '.txt'
        expect(f.getJustFilenameFromFullFilename(`folder/${longName}`)).toEqual(longName)
      })

      test('very long filename - remove extension', () => {
        const longName = 'a'.repeat(200)
        expect(f.getJustFilenameFromFullFilename(`folder/${longName}.txt`, true)).toEqual(longName)
      })
    })

    describe('real-world examples', () => {
      test('markdown note file', () => {
        expect(f.getJustFilenameFromFullFilename('Notes/2024/January/Meeting Notes.md')).toEqual('Meeting Notes.md')
      })

      test('markdown note file - no extension', () => {
        expect(f.getJustFilenameFromFullFilename('Notes/2024/January/Meeting Notes.md', true)).toEqual('Meeting Notes')
      })

      test('backup file with timestamp', () => {
        expect(f.getJustFilenameFromFullFilename('Backups/note-backup-2024-01-15.txt')).toEqual('note-backup-2024-01-15.txt')
      })

      test('image file in subfolder', () => {
        expect(f.getJustFilenameFromFullFilename('Images/Screenshots/screen-capture.png', true)).toEqual('screen-capture')
      })

      test('configuration file', () => {
        expect(f.getJustFilenameFromFullFilename('Config/.npmrc')).toEqual('.npmrc')
      })
    })
  })
})

describe('Folder View Helper Functions', () => {
  const mockFolderYaml = {
    views: [
      '{"dataLevel":"tasks","folderPath":"@Searches","group_by":"note path","group_sort":"ASC","layout":"cards","name":"Search Cards","sort":{"direction":"ASC","field":"line number"}}',
      '{"dataLevel":"tasks","folderPath":"@Searches","group_by":"note path","group_sort":"ASC","isSelected":true,"layout":"list","name":"Search List","sort":{"direction":"ASC","field":"line number"}}',
      '{"dataLevel":"notes","fields":["date"],"folderPath":"@Saved Searches","group_by":"note path","group_sort":"ASC","isSelected":true,"layout":"list","name":"View","sort":{"direction":"ASC","field":"line number"}}',
      '{"dataLevel":"notes","fields":["dateEdited"],"fixedGroups":{},"folderPath":"CTI","group_by":"folder","group_sort":"ASC","isSelected":true,"layout":"cards","name":"View"}',
      '{"dataLevel":"notes","fields":["dateEdited"],"folderPath":"Work","group_by":"folder","group_sort":"ASC","isSelected":true,"layout":"list","name":"Work View"}',
      '{"dataLevel":"notes","fields":["dateEdited"],"folderPath":"Daily","group_by":"folder","group_sort":"ASC","isSelected":true,"layout":"list","name":"Daily View"}'
    ]
  }

  describe('organizeFolderViews', () => {
    it('should organize folder views correctly', () => {
      const result = f.organizeFolderViews(mockFolderYaml)
      
      expect(result).toHaveProperty('@Searches')
      expect(result).toHaveProperty('Work')
      expect(result).toHaveProperty('Daily')
      
      // Should not include folders with only default "View" names
      expect(result).not.toHaveProperty('@Saved Searches')
      expect(result).not.toHaveProperty('CTI')
      
      // Check that named views are properly parsed
      expect(result['@Searches']).toHaveLength(2)
      expect(result['@Searches'][0].name).toBe('Search Cards')
      expect(result['@Searches'][1].name).toBe('Search List')
      
      expect(result['Work']).toHaveLength(1)
      expect(result['Work'][0].name).toBe('Work View')
    })
  })

  describe('getFoldersWithNamedViews', () => {
    it('should return list of folders with named views', () => {
      const result = f.getFoldersWithNamedViews(mockFolderYaml)
      
      expect(result).toContain('@Searches')
      expect(result).toContain('Work')
      expect(result).toContain('Daily')
      expect(result).not.toContain('@Saved Searches')
      expect(result).not.toContain('CTI')
    })
  })

  describe('getNamedViewsForFolder', () => {
    it('should return named views for a specific folder', () => {
      const result = f.getNamedViewsForFolder(mockFolderYaml, '@Searches')
      
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Search Cards')
      expect(result[0].layout).toBe('cards')
      expect(result[1].name).toBe('Search List')
      expect(result[1].layout).toBe('list')
    })

    it('should return empty array for folder with no named views', () => {
      const result = f.getNamedViewsForFolder(mockFolderYaml, 'CTI')
      expect(result).toHaveLength(0)
    })
  })

  describe('getNamedView', () => {
    it('should return specific named view', () => {
      const result = f.getNamedView(mockFolderYaml, '@Searches', 'Search Cards')
      
      expect(result).toBeTruthy()
      expect(result.name).toBe('Search Cards')
      expect(result.layout).toBe('cards')
      expect(result.dataLevel).toBe('tasks')
    })

    it('should return null for non-existent view', () => {
      const result = f.getNamedView(mockFolderYaml, '@Searches', 'Non Existent')
      expect(result).toBeNull()
    })
  })

  describe('getNamedViewsByDataLevel', () => {
    it('should organize views by data level', () => {
      const result = f.getNamedViewsByDataLevel(mockFolderYaml)
      
      expect(result).toHaveProperty('tasks')
      expect(result).toHaveProperty('notes')
      
      expect(result.tasks).toHaveLength(2) // Search Cards and Search List
      expect(result.notes).toHaveLength(2) // Work View and Daily View
    })
  })
})
