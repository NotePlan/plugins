// @flow
/* global jest, describe, test, expect, beforeEach */
//-----------------------------------------------------------------------------
// Tests for syncedCopies.js
// Tests the eliminateDuplicateParagraphs function
//-----------------------------------------------------------------------------

import { eliminateDuplicateParagraphs, textWithoutSyncedCopyTag } from '../syncedCopies'

describe('syncedCopies', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('textWithoutSyncedCopyTag', () => {
    test('should remove synced copy tags from text', () => {
      expect(textWithoutSyncedCopyTag('Task with ^abc123 tag')).toBe('Task with tag')
      expect(textWithoutSyncedCopyTag('^abc123 Task at start')).toBe('Task at start')
      expect(textWithoutSyncedCopyTag('Task ^abc123 in middle')).toBe('Task in middle')
      expect(textWithoutSyncedCopyTag('Task with ^abc123')).toBe('Task with')
    })

    test('should handle multiple tags', () => {
      expect(textWithoutSyncedCopyTag('Task ^abc123 with ^def456 tags')).toBe('Task with tags')
    })

    test('should handle text without tags', () => {
      expect(textWithoutSyncedCopyTag('Task without tags')).toBe('Task without tags')
      expect(textWithoutSyncedCopyTag('')).toBe('')
    })
  })

  // ---------------------------------------------------

  describe('eliminateDuplicateParagraphs', () => {
    // $FlowFixMe[missing-local-annot] - Test helper function
    const createMockParagraph = (content: string, filename: string, blockId: ?string = '', noteType: string = 'Notes', changedDate: Date = new Date()) => ({
      content,
      filename,
      blockId,
      note: {
        type: noteType,
        changedDate,
      },
    })

    test('should return empty array for empty input', () => {
      const result = eliminateDuplicateParagraphs([])
      expect(result).toEqual([])
    })

    test('should return empty array for null/undefined input', () => {
      // $FlowIgnore[incompatible-call] - Testing null input
      const result = eliminateDuplicateParagraphs(null)
      expect(result).toEqual([])
    })

    test('should return single paragraph unchanged', () => {
      // $FlowIgnore[incompatible-call] - Test mock objects
      const paras = [createMockParagraph('Task 1', 'note1.md', 'block1')]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras)
      expect(result).toEqual(paras)
    })

    test('should eliminate duplicates with same content and blockId (default behavior)', () => {
      const paras = [
        createMockParagraph('Task 1', 'note1.md', 'block1'),
        createMockParagraph('Task 1', 'note2.md', 'block1'),
        createMockParagraph('Task 2', 'note3.md', 'block2'),
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras)
      expect(result).toHaveLength(2)
      expect(result[0].content).toBe('Task 1')
      expect(result[0].filename).toBe('note1.md')
      expect(result[1].content).toBe('Task 2')
    })

    test('should keep first occurrence by default', () => {
      const paras = [
        createMockParagraph('Task 1', 'note2.md', 'block1'),
        createMockParagraph('Task 1', 'note1.md', 'block1'),
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras)
      expect(result).toHaveLength(1)
      expect(result[0].filename).toBe('note2.md')
    })

    test('should keep most recent when keepWhich is most-recent', () => {
      const oldDate = new Date('2023-01-01')
      const newDate = new Date('2023-01-02')
      const paras = [
        createMockParagraph('Task 1', 'note1.md', 'block1', 'Notes', oldDate),
        createMockParagraph('Task 1', 'note2.md', 'block1', 'Notes', newDate),
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'most-recent')
      expect(result).toHaveLength(1)
      expect(result[0].filename).toBe('note2.md')
    })

    test('should keep regular notes over calendar notes when keepWhich is regular-notes', () => {
      const paras = [
        createMockParagraph('Task 1', 'calendar.md', 'abcdef', 'Calendar'),
        createMockParagraph('Task 1', 'project.md', 'abcdef', 'Notes'),
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'regular-notes')
      expect(result).toHaveLength(1)
      expect(result[0].filename).toBe('project.md')
    })

    test('should keep first regular note when multiple regular notes exist', () => {
      const paras = [
        createMockParagraph('Task 1', 'project2.md', 'abcdef', 'Notes'),
        createMockParagraph('Task 1', 'project1.md', 'abcdef', 'Notes'),
        createMockParagraph('Task 1', 'calendar.md', 'abcdef', 'Calendar'),
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'regular-notes')
      expect(result).toHaveLength(1)
      expect(result[0].filename).toBe('project2.md')
    })

    test('should only eliminate synced lines when syncedLinesOnly is true', () => {
      const paras = [
        createMockParagraph('Task 1', 'note1.md', 'block1'),
        createMockParagraph('Task 1', 'note2.md', 'block2'), // Different blockId
        createMockParagraph('Task 2', 'note3.md', 'block3'),
        createMockParagraph('Task 2', 'note4.md', 'block3'), // Same blockId
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'first', true)
      expect(result).toHaveLength(3) // Only the last duplicate should be eliminated
      expect(result.find(p => p.content === 'Task 1' && p.filename === 'note1.md')).toBeDefined()
      expect(result.find(p => p.content === 'Task 1' && p.filename === 'note2.md')).toBeDefined()
      expect(result.find(p => p.content === 'Task 2' && p.filename === 'note3.md')).toBeDefined()
      expect(result.find(p => p.content === 'Task 2' && p.filename === 'note4.md')).toBeUndefined()
    })

    test('should eliminate all duplicates when syncedLinesOnly is false', () => {
      const paras = [
        createMockParagraph('Task 1', 'note1.md', 'block1'),
        createMockParagraph('Task 1', 'note1.md', 'block2'), // Different blockId but same content
        createMockParagraph('Task 2', 'note2.md', 'block3'),
        createMockParagraph('Task 2', 'note3.md', 'block3'), // Same blockId
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'first', false)
      expect(result).toHaveLength(2) // Both duplicates should be eliminated
      expect(result.find(p => p.content === 'Task 1')).toBeDefined()
      expect(result.find(p => p.content === 'Task 2')).toBeDefined()
    })

    test('should handle paragraphs without blockId', () => {
      const paras = [
        createMockParagraph('Task 1', 'note1.md', undefined),
        createMockParagraph('Task 1', 'note2.md', undefined),
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'first', false)
      expect(result).toHaveLength(1)
      expect(result[0].filename).toBe('note1.md')
    })

    test('should handle paragraphs with different content but same blockId', () => {
      const paras = [
        createMockParagraph('Task 1', 'note1.md', 'block1'),
        createMockParagraph('Task 2', 'note2.md', 'block1'),
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras)
      expect(result).toHaveLength(2) // Should keep both since content is different
    })

    test('should handle paragraphs with same filename and content', () => {
      const paras = [
        createMockParagraph('Task 1', 'note1.md', 'block1'),
        createMockParagraph('Task 1', 'note1.md', 'block1'),
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'first', false)
      expect(result).toHaveLength(1)
    })

    test('should handle paragraphs with same filename but different content', () => {
      const paras = [
        createMockParagraph('Task 1', 'note1.md', 'block1'),
        createMockParagraph('Task 2', 'note1.md', 'block2'),
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'first', false)
      expect(result).toHaveLength(2) // Should keep both since content is different
    })
  })
})
