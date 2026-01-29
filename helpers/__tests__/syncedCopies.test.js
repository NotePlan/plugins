// @flow
/* global jest, describe, test, expect, beforeEach */
//-----------------------------------------------------------------------------
// Tests for syncedCopies.js
// Tests the eliminateDuplicateParagraphs function
//-----------------------------------------------------------------------------

import { eliminateDuplicateParagraphs, textWithoutSyncedCopyTag } from '../syncedCopies'
import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'

// Make DataStore and Editor available globally for the source code
global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan

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

    test('should handle tag at end without trailing space', () => {
      expect(textWithoutSyncedCopyTag('Task with ^abc123')).toBe('Task with')
      expect(textWithoutSyncedCopyTag('^abc123')).toBe('')
    })

    test('should handle multiple consecutive tags', () => {
      expect(textWithoutSyncedCopyTag('Task ^abc123 ^def456 ^ghi789 end')).toBe('Task end')
      expect(textWithoutSyncedCopyTag('^abc123 ^def456 start')).toBe('start')
    })

    test('should not match tags with uppercase letters', () => {
      expect(textWithoutSyncedCopyTag('Task with ^ABC123 tag')).toBe('Task with ^ABC123 tag')
      expect(textWithoutSyncedCopyTag('Task with ^Abc123 tag')).toBe('Task with ^Abc123 tag')
    })

    test('should not match tags with wrong length', () => {
      expect(textWithoutSyncedCopyTag('Task with ^abc12 tag')).toBe('Task with ^abc12 tag') // 5 chars - doesn't match
      // Note: regex matches first 6 chars after ^, so ^abc1234 matches ^abc123 and removes it
      expect(textWithoutSyncedCopyTag('Task with ^abc1234 tag')).toBe('Task with4 tag') // 7 chars - matches first 6
    })

    test('should handle tags embedded in words', () => {
      // Regex requires whitespace or start before ^, so Task^abc123 doesn't match (no space before ^)
      expect(textWithoutSyncedCopyTag('Task^abc123embedded')).toBe('Task^abc123embedded') // No match - no space before ^
      // But ^abc123 at start matches, and regex matches first 6 chars, so rest remains
      expect(textWithoutSyncedCopyTag('^abc123embedded')).toBe('embedded') // Matches ^abc123 at start
    })

    test('should trim whitespace from result', () => {
      expect(textWithoutSyncedCopyTag('  ^abc123  ')).toBe('')
      expect(textWithoutSyncedCopyTag('  Task ^abc123  ')).toBe('Task')
      expect(textWithoutSyncedCopyTag('^abc123   ^def456')).toBe('')
    })

    test('should handle tags with numbers', () => {
      expect(textWithoutSyncedCopyTag('Task with ^123456 tag')).toBe('Task with tag')
      expect(textWithoutSyncedCopyTag('Task with ^abc123 tag')).toBe('Task with tag')
      expect(textWithoutSyncedCopyTag('Task with ^a1b2c3 tag')).toBe('Task with tag')
    })

    test('should handle tags at start of line with newlines', () => {
      expect(textWithoutSyncedCopyTag('^abc123\nTask line')).toBe('Task line')
      expect(textWithoutSyncedCopyTag('\n^abc123\nTask line')).toBe('Task line')
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
      const paras = [createMockParagraph('Task 1', 'note1.md', 'block1'), createMockParagraph('Task 1', 'note2.md', 'block1'), createMockParagraph('Task 2', 'note3.md', 'block2')]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras)
      expect(result).toHaveLength(2)
      expect(result[0].content).toBe('Task 1')
      expect(result[0].filename).toBe('note1.md')
      expect(result[1].content).toBe('Task 2')
    })

    test('should keep first occurrence by default', () => {
      const paras = [createMockParagraph('Task 1', 'note2.md', 'block1'), createMockParagraph('Task 1', 'note1.md', 'block1')]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras)
      expect(result).toHaveLength(1)
      expect(result[0].filename).toBe('note2.md')
    })

    test('should keep most recent when keepWhich is most-recent', () => {
      const oldDate = new Date('2023-01-01')
      const newDate = new Date('2023-01-02')
      const paras = [createMockParagraph('Task 1', 'note1.md', 'block1', 'Notes', oldDate), createMockParagraph('Task 1', 'note2.md', 'block1', 'Notes', newDate)]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'most-recent')
      expect(result).toHaveLength(1)
      expect(result[0].filename).toBe('note2.md')
    })

    test('should keep regular notes over calendar notes when keepWhich is regular-notes', () => {
      const paras = [createMockParagraph('Task 1', 'calendar.md', 'abcdef', 'Calendar'), createMockParagraph('Task 1', 'project.md', 'abcdef', 'Notes')]
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
      expect(result.find((p) => p.content === 'Task 1' && p.filename === 'note1.md')).toBeDefined()
      expect(result.find((p) => p.content === 'Task 1' && p.filename === 'note2.md')).toBeDefined()
      expect(result.find((p) => p.content === 'Task 2' && p.filename === 'note3.md')).toBeDefined()
      expect(result.find((p) => p.content === 'Task 2' && p.filename === 'note4.md')).toBeUndefined()
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
      expect(result.find((p) => p.content === 'Task 1')).toBeDefined()
      expect(result.find((p) => p.content === 'Task 2')).toBeDefined()
    })

    test('should handle paragraphs without blockId', () => {
      const paras = [createMockParagraph('Task 1', 'note1.md', undefined), createMockParagraph('Task 1', 'note2.md', undefined)]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'first', false)
      expect(result).toHaveLength(1)
      expect(result[0].filename).toBe('note1.md')
    })

    test('should handle paragraphs with different content but same blockId', () => {
      const paras = [createMockParagraph('Task 1', 'note1.md', 'block1'), createMockParagraph('Task 2', 'note2.md', 'block1')]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras)
      expect(result).toHaveLength(2) // Should keep both since content is different
    })

    test('should handle paragraphs with same filename and content', () => {
      const paras = [createMockParagraph('Task 1', 'note1.md', 'block1'), createMockParagraph('Task 1', 'note1.md', 'block1')]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'first', false)
      expect(result).toHaveLength(1)
    })

    test('should handle paragraphs with same filename but different content', () => {
      const paras = [createMockParagraph('Task 1', 'note1.md', 'block1'), createMockParagraph('Task 2', 'note1.md', 'block2')]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'first', false)
      expect(result).toHaveLength(2) // Should keep both since content is different
    })

    test('should handle empty string blockId vs undefined', () => {
      // Create objects directly to avoid default parameter conversion
      const paras = [
        { content: 'Task 1', filename: 'note1.md', blockId: '', note: { type: 'Notes', changedDate: new Date() } },
        { content: 'Task 1', filename: 'note2.md', blockId: undefined, note: { type: 'Notes', changedDate: new Date() } },
        { content: 'Task 1', filename: 'note3.md', blockId: '', note: { type: 'Notes', changedDate: new Date() } },
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'first', false)
      // Empty string '' is not undefined, so first and third have matching blockIds and are duplicates
      // Second has undefined blockId, so synced check fails, and filename check: note2.md !== note1.md, so kept
      // Result: first (kept), second (kept - different filename), third (eliminated - duplicate of first)
      expect(result).toHaveLength(2)
      expect(result.find((p) => p.filename === 'note1.md')).toBeDefined()
      expect(result.find((p) => p.filename === 'note2.md')).toBeDefined()
    })

    test('should handle paragraphs with empty string blockId', () => {
      const paras = [
        createMockParagraph('Task 1', 'note1.md', ''),
        createMockParagraph('Task 1', 'note1.md', ''),
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'first', false)
      expect(result).toHaveLength(1) // Should eliminate duplicate with same filename
    })

    test('should handle missing note.changedDate when using most-recent', () => {
      const paras = [
        { content: 'Task 1', filename: 'note1.md', blockId: 'block1', note: { type: 'Notes' } },
        { content: 'Task 1', filename: 'note2.md', blockId: 'block1', note: { type: 'Notes', changedDate: new Date('2023-01-02') } },
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'most-recent')
      expect(result).toHaveLength(1)
      expect(result[0].filename).toBe('note2.md') // Should keep the one with date
    })

    test('should handle missing note.type when using regular-notes', () => {
      const paras = [
        { content: 'Task 1', filename: 'note1.md', blockId: 'block1', note: {} },
        { content: 'Task 1', filename: 'note2.md', blockId: 'block1', note: { type: 'Notes' } },
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'regular-notes')
      expect(result).toHaveLength(1)
      expect(result[0].filename).toBe('note2.md') // Should keep the one with type
    })

    test('should handle multiple duplicates of same content', () => {
      const paras = [
        createMockParagraph('Task 1', 'note1.md', 'block1'),
        createMockParagraph('Task 1', 'note2.md', 'block1'),
        createMockParagraph('Task 1', 'note3.md', 'block1'),
        createMockParagraph('Task 2', 'note4.md', 'block2'),
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras)
      expect(result).toHaveLength(2)
      expect(result[0].content).toBe('Task 1')
      expect(result[0].filename).toBe('note1.md')
      expect(result[1].content).toBe('Task 2')
    })

    test('should handle complex scenario with mixed synced and non-synced duplicates', () => {
      const paras = [
        createMockParagraph('Task 1', 'note1.md', 'block1'), // synced
        createMockParagraph('Task 1', 'note2.md', 'block1'), // synced duplicate
        createMockParagraph('Task 2', 'note1.md', undefined), // non-synced
        createMockParagraph('Task 2', 'note1.md', undefined), // non-synced duplicate
        createMockParagraph('Task 3', 'note3.md', 'block3'), // synced unique
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'first', false)
      expect(result).toHaveLength(3)
      expect(result.find((p) => p.content === 'Task 1')).toBeDefined()
      expect(result.find((p) => p.content === 'Task 2')).toBeDefined()
      expect(result.find((p) => p.content === 'Task 3')).toBeDefined()
    })

    test('should handle same blockId but different filenames with syncedLinesOnly true', () => {
      const paras = [
        createMockParagraph('Task 1', 'note1.md', 'block1'),
        createMockParagraph('Task 1', 'note2.md', 'block1'), // Same blockId, different filename
        createMockParagraph('Task 2', 'note3.md', 'block1'), // Same blockId, different content
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'first', true)
      expect(result).toHaveLength(2) // First two have same content+blockId, third has different content
      expect(result.find((p) => p.content === 'Task 1')).toBeDefined()
      expect(result.find((p) => p.content === 'Task 2')).toBeDefined()
    })

    test('should handle same blockId but different filenames with syncedLinesOnly false', () => {
      const paras = [
        createMockParagraph('Task 1', 'note1.md', 'block1'),
        createMockParagraph('Task 1', 'note2.md', 'block1'), // Same blockId, different filename
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'first', false)
      expect(result).toHaveLength(1) // Should eliminate duplicate with same content+blockId
    })

    test('should handle most-recent with same changedDate', () => {
      const sameDate = new Date('2023-01-01')
      const paras = [
        createMockParagraph('Task 1', 'note1.md', 'block1', 'Notes', sameDate),
        createMockParagraph('Task 1', 'note2.md', 'block1', 'Notes', sameDate),
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'most-recent')
      expect(result).toHaveLength(1)
      // When dates are equal, should keep first after sorting
      expect(result[0].filename).toBe('note1.md')
    })

    test('should handle regular-notes with same type', () => {
      const paras = [
        createMockParagraph('Task 1', 'note1.md', 'block1', 'Notes'),
        createMockParagraph('Task 1', 'note2.md', 'block1', 'Notes'),
        createMockParagraph('Task 1', 'note3.md', 'block1', 'Calendar'),
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'regular-notes')
      expect(result).toHaveLength(1)
      expect(result[0].filename).toBe('note1.md') // Should keep first Notes type
    })

    test('should handle error gracefully with malformed paragraph data', () => {
      const paras = [
        { content: 'Task 1', filename: 'note1.md' }, // Missing note property
        createMockParagraph('Task 2', 'note2.md', 'block2'),
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras)
      // Should not throw error, but may return empty array or partial results
      expect(Array.isArray(result)).toBe(true)
    })

    test('should preserve order when no duplicates exist', () => {
      const paras = [
        createMockParagraph('Task 1', 'note1.md', 'block1'),
        createMockParagraph('Task 2', 'note2.md', 'block2'),
        createMockParagraph('Task 3', 'note3.md', 'block3'),
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras)
      expect(result).toHaveLength(3)
      expect(result[0].content).toBe('Task 1')
      expect(result[1].content).toBe('Task 2')
      expect(result[2].content).toBe('Task 3')
    })

    test('should handle syncedLinesOnly true with non-synced duplicates in same file', () => {
      // Create objects directly to ensure undefined blockId (not default '')
      const paras = [
        { content: 'Task 1', filename: 'note1.md', blockId: undefined, note: { type: 'Notes', changedDate: new Date() } },
        { content: 'Task 1', filename: 'note1.md', blockId: undefined, note: { type: 'Notes', changedDate: new Date() } },
      ]
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const result = eliminateDuplicateParagraphs(paras, 'first', true)
      // With syncedLinesOnly=true:
      // - Both have undefined blockId, so synced check (line 41) fails
      // - Goes to else (line 44): if (t.filename === e.filename && !syncedLinesOnly)
      // - With syncedLinesOnly=true, !syncedLinesOnly is false, so condition fails
      // - Duplicates should be kept
      expect(result).toHaveLength(2) // Should keep both since syncedLinesOnly prevents non-synced elimination
    })
  })
})
