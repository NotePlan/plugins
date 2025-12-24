/* global jest, describe, test, expect, beforeAll */
// Jest testing docs: https://jestjs.io/docs/using-matchers
/* eslint-disable */

import { CustomConsole, LogType, LogMessage } from '@jest/console'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter, Note, Paragraph } from '@mocks/index'
import { generateCandidateTitleForDuplicate, updateTitleInContentArray } from '../src/duplicateNote'

const PLUGIN_NAME = `{{pluginID}}`
const FILENAME = `NPPluginMain`

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'none'
})

describe('generateCandidateTitleForDuplicate', () => {
  describe('Quarter patterns (Q1-Q4)', () => {
    test('should increment Q1 to Q2', () => {
      const result = generateCandidateTitleForDuplicate('2024Q1 Review')
      expect(result).toBe('2024Q2 Review')
    })

    test('should increment Q2 to Q3', () => {
      const result = generateCandidateTitleForDuplicate('2024Q2 Review')
      expect(result).toBe('2024Q3 Review')
    })

    test('should increment Q3 to Q4', () => {
      const result = generateCandidateTitleForDuplicate('2024Q3 Review')
      expect(result).toBe('2024Q4 Review')
    })

    test('should increment Q4 to next year Q1', () => {
      const result = generateCandidateTitleForDuplicate('2024Q4 Review')
      expect(result).toBe('2025Q1 Review')
    })

    test('should handle quarter at start of title', () => {
      const result = generateCandidateTitleForDuplicate('2024Q1')
      expect(result).toBe('2024Q2')
    })

    test('should handle quarter at end of title', () => {
      const result = generateCandidateTitleForDuplicate('Review 2024Q1')
      expect(result).toBe('Review 2024Q2')
    })
  })

  describe('Half-year patterns (H1-H2)', () => {
    test('should increment H1 to H2', () => {
      const result = generateCandidateTitleForDuplicate('2024H1 Review')
      expect(result).toBe('2024H2 Review')
    })

    test('should increment H2 to next year H1', () => {
      const result = generateCandidateTitleForDuplicate('2024H2 Review')
      expect(result).toBe('2025H1 Review')
    })

    test('should handle half-year at start of title', () => {
      const result = generateCandidateTitleForDuplicate('2024H1')
      expect(result).toBe('2024H2')
    })

    test('should handle half-year at end of title', () => {
      const result = generateCandidateTitleForDuplicate('Review 2024H2')
      expect(result).toBe('Review 2025H1')
    })
  })

  describe('Year-only patterns', () => {
    test('should increment year in simple title', () => {
      const result = generateCandidateTitleForDuplicate('2024 Review')
      expect(result).toBe('2025 Review')
    })

    test('should increment year at start', () => {
      const result = generateCandidateTitleForDuplicate('2024')
      expect(result).toBe('2025')
    })

    test('should increment year at end', () => {
      const result = generateCandidateTitleForDuplicate('Review 2024')
      expect(result).toBe('Review 2025')
    })

    test('should increment year in middle', () => {
      const result = generateCandidateTitleForDuplicate('Review 2024 Summary')
      expect(result).toBe('Review 2025 Summary')
    })
    test('should increment year in brackets', () => {
      const result = generateCandidateTitleForDuplicate('Review (2024)')
      expect(result).toBe('Review (2025)')
    })
    test('should increment year in square brackets', () => {
      const result = generateCandidateTitleForDuplicate('Review [2024]')
      expect(result).toBe('Review [2025]')
    })
    test('should increment year with comma after', () => {
      const result = generateCandidateTitleForDuplicate('Review 2024, OK')
      expect(result).toBe('Review 2025, OK')
    })
  })

  describe('Titles without date patterns', () => {
    test('should append "copy" to simple title', () => {
      const result = generateCandidateTitleForDuplicate('My Note')
      expect(result).toBe('My Note copy')
    })

    test('should append "copy" to empty title', () => {
      const result = generateCandidateTitleForDuplicate('')
      expect(result).toBe(' copy')
    })

    test('should append "copy" to title with numbers but no year pattern', () => {
      const result = generateCandidateTitleForDuplicate('Note 123')
      expect(result).toBe('Note 123 copy')
    })

    test('should append "copy" to title with 3-digit number', () => {
      const result = generateCandidateTitleForDuplicate('Note 999')
      expect(result).toBe('Note 999 copy')
    })
  })

  describe('Edge cases', () => {
    test('should handle null title', () => {
      const result = generateCandidateTitleForDuplicate(null)
      expect(result).toBe(' copy')
    })

    test('should handle undefined title', () => {
      const result = generateCandidateTitleForDuplicate(undefined)
      expect(result).toBe(' copy')
    })

    test('should handle title with multiple years (should match first)', () => {
      const result = generateCandidateTitleForDuplicate('2023 Review 2024')
      expect(result).toBe('2024 Review 2024')
    })

    test('should not change year with no space before', () => {
      const result = generateCandidateTitleForDuplicate('Review2024')
      expect(result).toBe('Review2024 copy')
    })

    test('should not change year with no space after', () => {
      const result = generateCandidateTitleForDuplicate('2024Review')
      expect(result).toBe('2024Review copy')
    })

    test('should not change year in date format', () => {
      const result = generateCandidateTitleForDuplicate('Meeting 2024-12-25')
      expect(result).toBe('Meeting 2024-12-25 copy')
    })
  })

  describe('Priority: Quarter > Half-year > Year', () => {
    test('should prioritize quarter over half-year when both present', () => {
      const result = generateCandidateTitleForDuplicate('2024Q1H1')
      // Should match quarter pattern, not half-year
      expect(result).toContain('Q')
    })

    test('should prioritize quarter over year when both present', () => {
      const result = generateCandidateTitleForDuplicate('2024Q1 Review')
      expect(result).toBe('2024Q2 Review')
    })

    test('should prioritize half-year over year when both present', () => {
      const result = generateCandidateTitleForDuplicate('2024H1 Review')
      expect(result).toBe('2024H2 Review')
    })
  })
})

describe('updateTitleInContentArray', () => {
  describe('Frontmatter title updates', () => {
    test('should update title in frontmatter when present', () => {
      const mockNote = new Note({
        paragraphs: [
          new Paragraph({ type: 'separator', rawContent: '---', lineIndex: 0 }),
          new Paragraph({ type: 'text', rawContent: 'title: Original Title', lineIndex: 1 }),
          new Paragraph({ type: 'text', rawContent: 'status: active', lineIndex: 2 }),
          new Paragraph({ type: 'separator', rawContent: '---', lineIndex: 3 }),
          new Paragraph({ type: 'title', rawContent: '# Original Title', lineIndex: 4 }),
          new Paragraph({ type: 'text', rawContent: 'Content here', lineIndex: 5 }),
        ],
      })

      const result = updateTitleInContentArray(mockNote, 'New Title', 4, 6)
      expect(result[1]).toBe('title: New Title')
      expect(result).toHaveLength(6)
    })

    test('should update both frontmatter title and H1 when both are present', () => {
      const mockNote = new Note({
        paragraphs: [
          new Paragraph({ type: 'separator', rawContent: '---', lineIndex: 0 }),
          new Paragraph({ type: 'text', rawContent: 'title: Old Title', lineIndex: 1 }),
          new Paragraph({ type: 'separator', rawContent: '---', lineIndex: 2 }),
          new Paragraph({ type: 'empty', rawContent: '', lineIndex: 3 }),
          new Paragraph({ type: 'title', rawContent: '# Old Title', lineIndex: 4 }),
          new Paragraph({ type: 'text', rawContent: 'Body content', lineIndex: 5 }),
        ],
      })

      const result = updateTitleInContentArray(mockNote, 'Updated Title', 3, 5)
      expect(result[1]).toBe('title: Updated Title')
      expect(result[4]).toBe('# Updated Title')
      expect(result[5]).toBe('Body content')
    })
  })

  describe('H1 title updates', () => {
    test('should replace existing H1 title', () => {
      const mockNote = new Note({
        paragraphs: [
          new Paragraph({ type: 'title', rawContent: '# Old Title', lineIndex: 0 }),
          new Paragraph({ type: 'text', rawContent: 'Content line 1', lineIndex: 1 }),
          new Paragraph({ type: 'text', rawContent: 'Content line 2', lineIndex: 2 }),
        ],
      })

      const result = updateTitleInContentArray(mockNote, 'New Title', 0, 3)
      expect(result[0]).toBe('# New Title')
      expect(result[1]).toBe('Content line 1')
      expect(result[2]).toBe('Content line 2')
      expect(result).toHaveLength(3)
    })

    test('should replace H1 when it has content after it', () => {
      const mockNote = new Note({
        paragraphs: [
          new Paragraph({ type: 'title', rawContent: '# Original', lineIndex: 0 }),
          new Paragraph({ type: 'text', rawContent: 'Some text', lineIndex: 1 }),
        ],
      })

      const result = updateTitleInContentArray(mockNote, 'Replaced', 0, 2)
      expect(result[0]).toBe('# Replaced')
      expect(result[1]).toBe('Some text')
    })
  })

  describe('Adding H1 when no title exists', () => {
    test('should add H1 when no frontmatter title exists', () => {
      const mockNote = new Note({
        paragraphs: [
          new Paragraph({ type: 'text', rawContent: 'Content without title', lineIndex: 0 }),
          new Paragraph({ type: 'text', rawContent: 'More content', lineIndex: 1 }),
        ],
      })

      const result = updateTitleInContentArray(mockNote, 'New Title', 0, 2)
      expect(result[0]).toBe('# New Title')
      expect(result[1]).toBe('Content without title')
      expect(result[2]).toBe('More content')
      expect(result).toHaveLength(3)
    })

    test('should not add when frontmatter title exists and H1 does not exist', () => {
      const mockNote = new Note({
        paragraphs: [
          new Paragraph({ type: 'separator', rawContent: '---', lineIndex: 0 }),
          new Paragraph({ type: 'text', rawContent: 'title: FM Title', lineIndex: 1 }),
          new Paragraph({ type: 'separator', rawContent: '---', lineIndex: 2 }),
          new Paragraph({ type: 'text', rawContent: 'Content without H1', lineIndex: 3 }),
        ],
      })

      const result = updateTitleInContentArray(mockNote, 'New Title', 3, 4)
      expect(result).toHaveLength(4)
      // Should not have added H1 or frontmatter title
      expect(result[0]).toBe('---')
      expect(result[1]).toBe('title: New Title')
      expect(result[2]).toBe('---')
      expect(result[3]).toBe('Content without H1')
    })
  })

  describe('Content slicing', () => {
    test('should only include content up to endOfActivePartOfNote', () => {
      const mockNote = new Note({
        paragraphs: [
          new Paragraph({ type: 'title', rawContent: '# Title', lineIndex: 0 }),
          new Paragraph({ type: 'text', rawContent: 'Line 1', lineIndex: 1 }),
          new Paragraph({ type: 'text', rawContent: 'Line 2', lineIndex: 2 }),
          new Paragraph({ type: 'title', rawContent: '## Done', lineIndex: 3 }),
          new Paragraph({ type: 'text', rawContent: 'Done item', lineIndex: 4 }),
        ],
      })

      // endOfActivePartOfNote = 2 to exclude "## Done" and "Done item"
      const result = updateTitleInContentArray(mockNote, 'New Title', 0, 2)
      expect(result).toHaveLength(3)
      expect(result[0]).toBe('# New Title')
      expect(result[1]).toBe('Line 1')
      expect(result[2]).toBe('Line 2')
    })
  })
})
