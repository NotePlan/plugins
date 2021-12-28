/* globals describe, expect, it, test */
import * as f from '../folders'

const DataStore = {
  folders: ["/",
    "CCC Areas",
    "CCC Areas/Staff",
    "CCC Projects",
    "Home Areas",
    "📋 Templates",
    "TEST",
    "TEST/TEST LEVEL 2",
    "TEST/TEST LEVEL 2/TEST LEVEL 3",]
}

describe('helpers/folders', () => {
  describe('filterFolderList tests', () => {
    test('empty exclusions -> should return same list', () => {
      const exclusions = []
      const folders = Object.keys(f.filterFolderList(exclusions))
      expect(folders.length).toBe(9)
    })
    test('TEST exclusions -> 6', () => {
      const exclusions = ['TEST']
      const folders = Object.keys(f.filterFolderList(exclusions))
      expect(folders.length).toBe(6)
    })
    test("📋 Templates exclusions -> 8", () => {
      const exclusions = ["📋 Templates"]
      const folders = Object.keys(f.filterFolderList(exclusions))
      expect(folders.length).toBe(8)
    })
  })
  describe('getFolderFromFilename tests', () => {
    test('root (no folder part) -> empty', () => {
      expect(f.getFolderFromFilename('test-at-root.md').toEqual(''))
    })
    test('subfolder 1', () => {
      expect(f.getFolderFromFilename('one/two/three/four.md').toEqual('one/two/three'))
    })
    test('subfolder 2', () => {
      expect(f.getFolderFromFilename('one/two/three/four and a bit.md').toEqual('one/two/three'))
    })
    test('subfolder 3', () => {
      expect(f.getFolderFromFilename('one/two or three/fifteen.md').toEqual('one/two or three'))
    })
    test('leading slash', () => {
      expect(f.getFolderFromFilename('/sixes and sevenses/calm one.md').toEqual('/sixes and sevenses'))
    })
  })
})
