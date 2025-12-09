// @flow
/* globals describe, expect, test */
import { filterProjectNotesByFolders } from '../allProjectsListHelpers'

  // Mock TNote type - simplified for testing
  // $FlowFixMe[prop-missing] - MockNote only needs filename property for testing
type MockNote = {
  filename: string,
  title: string,
}

describe('filterProjectNotesByFolders', () => {
  // Create mock project notes for testing
  const createMockNote = (filename: string, title: string = ''): MockNote => ({
    filename,
    title: title || filename.split('/').pop() || filename,
  })

  const mockProjectNotes: Array<MockNote> = [
    // Root folder notes
    createMockNote('root-note.md', 'Root Note'),
    createMockNote('another-root.md', 'Another Root'),
    
    // Single-level folder notes
    createMockNote('Projects/project1.md', 'Project 1'),
    createMockNote('Projects/project2.md', 'Project 2'),
    createMockNote('Areas/area1.md', 'Area 1'),
    createMockNote('Areas/area2.md', 'Area 2'),
    
    // Nested folder notes
    createMockNote('Projects/Research/research1.md', 'Research 1'),
    createMockNote('Projects/Research/research2.md', 'Research 2'),
    createMockNote('Projects/Research/Deep/deep1.md', 'Deep 1'),
    createMockNote('Areas/Personal/personal1.md', 'Personal 1'),
    
    // Ignored folder notes
    createMockNote('Archive/old1.md', 'Old 1'),
    createMockNote('Archive/old2.md', 'Old 2'),
    createMockNote('Projects/Archive/archived-project.md', 'Archived Project'),
    
    // Special cases
    createMockNote('Projects/Testing/test.md', 'Test'),
    createMockNote('Testing/project.md', 'Test Project'),
  ]

  describe('root folder matching', () => {
    test('should match only root folder notes when "/" is included', () => {
      const filteredFolders = ['/']
      const foldersToIgnore: Array<string> = []
      const result = filterProjectNotesByFolders(mockProjectNotes, filteredFolders, foldersToIgnore)
      
      expect(result).toHaveLength(2)
      expect(result.map(n => n.filename)).toEqual(['root-note.md', 'another-root.md'])
    })

    test('should match root folder notes even with ignore folders', () => {
      const filteredFolders = ['/']
      const foldersToIgnore = ['Archive']
      const result = filterProjectNotesByFolders(mockProjectNotes, filteredFolders, foldersToIgnore)
      
      expect(result).toHaveLength(2)
      expect(result.map(n => n.filename)).toEqual(['root-note.md', 'another-root.md'])
    })
  })

  describe('single folder matching', () => {
    test('should match notes in Projects folder', () => {
      const filteredFolders = ['Projects']
      const foldersToIgnore: Array<string> = []
      const result = filterProjectNotesByFolders(mockProjectNotes, filteredFolders, foldersToIgnore)
      
      expect(result).toHaveLength(7) // project1, project2, research1, research2, deep1, archived-project, Testing/test
      expect(result.map(n => n.filename)).toEqual([
        'Projects/project1.md',
        'Projects/project2.md',
        'Projects/Research/research1.md',
        'Projects/Research/research2.md',
        'Projects/Research/Deep/deep1.md',
        'Projects/Archive/archived-project.md',
        'Projects/Testing/test.md',
      ])
    })

    test('should match notes in Areas folder', () => {
      const filteredFolders = ['Areas']
      const foldersToIgnore: Array<string> = []
      const result = filterProjectNotesByFolders(mockProjectNotes, filteredFolders, foldersToIgnore)
      
      expect(result).toHaveLength(3) // area1, area2, personal1
      expect(result.map(n => n.filename)).toEqual([
        'Areas/area1.md',
        'Areas/area2.md',
        'Areas/Personal/personal1.md',
      ])
    })

    test('should not match root folder notes when specific folder is specified', () => {
      const filteredFolders = ['Projects']
      const foldersToIgnore = []
      const result = filterProjectNotesByFolders(mockProjectNotes, filteredFolders, foldersToIgnore)
      
      expect(result.every(n => n.filename.startsWith('Projects/'))).toBe(true)
      expect(result.some(n => n.filename === 'root-note.md')).toBe(false)
    })
  })

  describe('nested folder matching', () => {
    test('should not match notes in nested folders when just a sub-folder is included', () => {
      const filteredFolders = ['Research']
      const foldersToIgnore = []
      const result = filterProjectNotesByFolders(mockProjectNotes, filteredFolders, foldersToIgnore)
      
      expect(result).toHaveLength(0) // no matches
    })

    test('should match exact folder name', () => {
      const filteredFolders = ['Projects/Research']
      const foldersToIgnore = []
      const result = filterProjectNotesByFolders(mockProjectNotes, filteredFolders, foldersToIgnore)
      
      // Should include files directly in Projects/Research and its subfolders
      expect(result.some(n => n.filename === 'Projects/Research/research1.md')).toBe(true)
      expect(result.some(n => n.filename === 'Projects/Research/Deep/deep1.md')).toBe(true)
    })
  })

  describe('multiple folder matching', () => {
    test('should match notes from multiple folders', () => {
      const filteredFolders = ['Projects', 'Areas']
      const foldersToIgnore = []
      const result = filterProjectNotesByFolders(mockProjectNotes, filteredFolders, foldersToIgnore)
      
      expect(result).toHaveLength(10)
      expect(result.some(n => n.filename.startsWith('Projects/'))).toBe(true)
      expect(result.some(n => n.filename.startsWith('Areas/'))).toBe(true)
    })

    test('should match notes from root and specific folders', () => {
      const filteredFolders = ['/', 'Projects']
      const foldersToIgnore = []
      const result = filterProjectNotesByFolders(mockProjectNotes, filteredFolders, foldersToIgnore)
      
      // Should match both root files and Projects files
      expect(result.some(n => n.filename === 'root-note.md')).toBe(true)
      expect(result.some(n => n.filename.startsWith('Projects/'))).toBe(true)
    })
  })

  describe('ignore folder functionality', () => {
    test('should exclude notes in ignored Archive folders', () => {
      const filteredFolders = ['Projects']
      const foldersToIgnore = ['Archive']
      const result = filterProjectNotesByFolders(mockProjectNotes, filteredFolders, foldersToIgnore)
      
      // Should exclude Projects/Archive/archived-project.md and Archive/old1.md, Archive/old2.md
      // But Projects/Testing/test.md should still be included (6 items total)
      expect(result).toHaveLength(6) // project1, project2, research1, research2, deep1, Testing/test
      expect(result.some(n => n.filename === 'Projects/Archive/archived-project.md')).toBe(false)
      expect(result.some(n => n.filename === 'Projects/project1.md')).toBe(true)
      expect(result.some(n => n.filename === 'Projects/Testing/test.md')).toBe(true)
    })

    test('should include only root and exclude notes in root Archive folder', () => {
      const filteredFolders = ['/']
      const foldersToIgnore = ['Archive']
      const result = filterProjectNotesByFolders(mockProjectNotes, filteredFolders, foldersToIgnore)
      
      expect(result).toHaveLength(2) // Only root notes, Archive is ignored
      expect(result.some(n => n.filename.startsWith('Archive/'))).toBe(false)
    })

    test('should exclude nested ignored folders', () => {
      const filteredFolders = ['Projects']
      const foldersToIgnore = ['Projects/Archive']
      const result = filterProjectNotesByFolders(mockProjectNotes, filteredFolders, foldersToIgnore)
      
      expect(result.some(n => n.filename === 'Projects/Archive/archived-project.md')).toBe(false)
      expect(result.some(n => n.filename === 'Projects/project1.md')).toBe(true)
    })

    test('should handle multiple ignore folders', () => {
      const filteredFolders = ['Projects', 'Areas']
      const foldersToIgnore = ['Archive', 'Projects/Research']
      const result = filterProjectNotesByFolders(mockProjectNotes, filteredFolders, foldersToIgnore)
      
      expect(result.some(n => n.filename.startsWith('Archive/'))).toBe(false)
      expect(result.some(n => n.filename.startsWith('Projects/Research'))).toBe(false)
      expect(result.some(n => n.filename === 'Projects/project1.md')).toBe(true)
      expect(result.some(n => n.filename === 'Areas/area1.md')).toBe(true)
    })
  })

  describe('edge cases', () => {
    test('should handle empty project notes array', () => {
      const result = filterProjectNotesByFolders([], ['Projects'], [])
      expect(result).toEqual([])
    })

    test('should handle empty filtered folders array', () => {
      const result = filterProjectNotesByFolders(mockProjectNotes, [], [])
      expect(result).toEqual([])
    })

    test('should handle empty ignore folders array', () => {
      const filteredFolders = ['Projects']
      const result = filterProjectNotesByFolders(mockProjectNotes, filteredFolders, [])
      
      expect(result.length).toBeGreaterThan(0)
      expect(result.some(n => n.filename.startsWith('Projects/'))).toBe(true)
    })

    test('should handle folder name that matches part of another folder', () => {
      const filteredFolders = ['Testing']
      const foldersToIgnore = []
      const result = filterProjectNotesByFolders(mockProjectNotes, filteredFolders, foldersToIgnore)
      
      // Should match 'Testing/project.md' but not 'Projects/Testing/test.md'
      expect(result).toHaveLength(1)
      expect(result[0].filename).toBe('Testing/project.md')
    })

    test('should handle ignore folder that matches part of filename', () => {
      const filteredFolders = ['Projects']
      const foldersToIgnore = ['Testing']
      const result = filterProjectNotesByFolders(mockProjectNotes, filteredFolders, foldersToIgnore)
      
      // Should exclude 'Projects/Testing/test.md' because it includes 'Testing'
      expect(result.some(n => n.filename === 'Projects/Testing/test.md')).toBe(false)
      expect(result.some(n => n.filename === 'Projects/project1.md')).toBe(true)
    })

    test('should handle folder with trailing slash in ignore list', () => {
      const filteredFolders = ['Projects']
      const foldersToIgnore = ['Archive/'] // Note: function adds slash, but test with it too
      const result = filterProjectNotesByFolders(mockProjectNotes, filteredFolders, foldersToIgnore)
      
      expect(result.some(n => n.filename === 'Projects/Archive/archived-project.md')).toBe(false)
    })
  })
})

