/* eslint-disable no-unused-vars */
/* global jest, describe, test, expect, beforeAll */
import { CustomConsole } from '@jest/console'
import * as h from '@helpers/headings'
import { clo, JSP } from '@helpers/dev'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, simpleFormatter } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'DEBUG' // DEBUG or none
})

describe('helpers/headings', () => {
  describe('getCurrentHeading', () => {
    test('returns nearest heading above a paragraph', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Doc Title', lineIndex: 0, rawContent: '# Doc Title', headingLevel: 1 },
          { type: 'text', content: 'intro', lineIndex: 1, rawContent: 'intro' },
          { type: 'title', content: 'Section A', lineIndex: 2, rawContent: '## Section A', headingLevel: 2 },
          { type: 'open', content: 'Task A1', lineIndex: 3, rawContent: '* [ ] Task A1' },
        ],
      })
      let targetPara = note.paragraphs[1]
      let parent = h.getCurrentHeading(note, targetPara)
      expect(parent).toBeDefined()
      expect(parent?.content).toBe('Doc Title')

      targetPara = note.paragraphs[2]
      parent = h.getCurrentHeading(note, targetPara)
      expect(parent).toBeDefined()
      expect(parent?.content).toBe('Doc Title')

      targetPara = note.paragraphs[3]
      parent = h.getCurrentHeading(note, targetPara)
      expect(parent).toBeDefined()
      expect(parent?.content).toBe('Section A')
    })

    test('returns null when there is no heading above', () => {
      const note = new Note({
        paragraphs: [
          { type: 'text', content: 'no heading', lineIndex: 0, rawContent: 'no heading' },
          { type: 'open', content: 'Task 1', lineIndex: 1, rawContent: '* [ ] Task 1' },
        ],
      })
      const parent = h.getCurrentHeading(note, note.paragraphs[1])
      expect(parent).toBeNull()
    })

    test('returns null when para.lineIndex is null', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Doc Title', lineIndex: 0, rawContent: '# Doc Title', headingLevel: 1 },
          { type: 'text', content: 'intro', lineIndex: 1, rawContent: 'intro' },
        ],
      })
      const para = { ...note.paragraphs[1], lineIndex: null }
      const parent = h.getCurrentHeading(note, para)
      expect(parent).toBeNull()
    })

    test('returns null when para.lineIndex is undefined', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Doc Title', lineIndex: 0, rawContent: '# Doc Title', headingLevel: 1 },
          { type: 'text', content: 'intro', lineIndex: 1, rawContent: 'intro' },
        ],
      })
      const para = { ...note.paragraphs[1] }
      delete para.lineIndex
      const parent = h.getCurrentHeading(note, para)
      expect(parent).toBeNull()
    })

    test('returns previous heading when paragraph itself is a heading', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'H1 Title', lineIndex: 0, rawContent: '# H1 Title', headingLevel: 1 },
          { type: 'title', content: 'H2 Section', lineIndex: 1, rawContent: '## H2 Section', headingLevel: 2 },
          { type: 'title', content: 'H3 Subsection', lineIndex: 2, rawContent: '### H3 Subsection', headingLevel: 3 },
        ],
      })
      // When asking for heading of H2, should return H1 (not H2 itself)
      const parent = h.getCurrentHeading(note, note.paragraphs[1])
      expect(parent).toBeDefined()
      expect(parent?.content).toBe('H1 Title')
      
      // When asking for heading of H3, should return H2 (not H3 itself)
      const parent2 = h.getCurrentHeading(note, note.paragraphs[2])
      expect(parent2).toBeDefined()
      expect(parent2?.content).toBe('H2 Section')
    })

    test('returns null when paragraph is the first heading in document', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'First Heading', lineIndex: 0, rawContent: '# First Heading', headingLevel: 1 },
          { type: 'text', content: 'content', lineIndex: 1, rawContent: 'content' },
        ],
      })
      const parent = h.getCurrentHeading(note, note.paragraphs[0])
      expect(parent).toBeNull()
    })

    test('returns null when paragraph is at index 0 and not a heading', () => {
      const note = new Note({
        paragraphs: [
          { type: 'text', content: 'first line', lineIndex: 0, rawContent: 'first line' },
        ],
      })
      const parent = h.getCurrentHeading(note, note.paragraphs[0])
      expect(parent).toBeNull()
    })

    test('finds immediate heading with nested heading structure', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Chapter 1', lineIndex: 0, rawContent: '# Chapter 1', headingLevel: 1 },
          { type: 'text', content: 'intro text', lineIndex: 1, rawContent: 'intro text' },
          { type: 'title', content: 'Section 1.1', lineIndex: 2, rawContent: '## Section 1.1', headingLevel: 2 },
          { type: 'text', content: 'section text', lineIndex: 3, rawContent: 'section text' },
          { type: 'title', content: 'Subsection 1.1.1', lineIndex: 4, rawContent: '### Subsection 1.1.1', headingLevel: 3 },
          { type: 'open', content: 'Task under subsection', lineIndex: 5, rawContent: '* [ ] Task under subsection' },
        ],
      })
      // Task should find immediate heading (Subsection 1.1.1)
      const parent = h.getCurrentHeading(note, note.paragraphs[5])
      expect(parent).toBeDefined()
      expect(parent?.content).toBe('Subsection 1.1.1')
      
      // Text under subsection should find Subsection 1.1.1
      const parent2 = h.getCurrentHeading(note, note.paragraphs[4])
      expect(parent2).toBeDefined()
      expect(parent2?.content).toBe('Section 1.1')
    })

    test('handles note with only headings', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'H1', lineIndex: 0, rawContent: '# H1', headingLevel: 1 },
          { type: 'title', content: 'H2', lineIndex: 1, rawContent: '## H2', headingLevel: 2 },
          { type: 'title', content: 'H3', lineIndex: 2, rawContent: '### H3', headingLevel: 3 },
        ],
      })
      const parent = h.getCurrentHeading(note, note.paragraphs[2])
      expect(parent).toBeDefined()
      expect(parent?.content).toBe('H2')
    })

    test('handles empty paragraphs array', () => {
      const note = new Note({
        paragraphs: [],
      })
      const para = { type: 'text', content: 'test', lineIndex: 0, rawContent: 'test' }
      const parent = h.getCurrentHeading(note, para)
      expect(parent).toBeNull()
    })

    test('searches backwards correctly through multiple non-heading paragraphs', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Main Heading', lineIndex: 0, rawContent: '# Main Heading', headingLevel: 1 },
          { type: 'text', content: 'para 1', lineIndex: 1, rawContent: 'para 1' },
          { type: 'text', content: 'para 2', lineIndex: 2, rawContent: 'para 2' },
          { type: 'text', content: 'para 3', lineIndex: 3, rawContent: 'para 3' },
          { type: 'open', content: 'Task at end', lineIndex: 4, rawContent: '* [ ] Task at end' },
        ],
      })
      const parent = h.getCurrentHeading(note, note.paragraphs[4])
      expect(parent).toBeDefined()
      expect(parent?.content).toBe('Main Heading')
    })
  })

  describe('isTitleWithEqualOrLowerHeadingLevel', () => {
    test('should return true for title with lower heading level', () => {
      const item = { type: 'title', headingLevel: 2 }
      const prevLowestLevel = 3
      expect(h.isTitleWithEqualOrLowerHeadingLevel(item, prevLowestLevel)).toBe(true)
    })

    test('should return false for title with equal heading level', () => {
      const item = { type: 'title', headingLevel: 3 }
      const prevLowestLevel = 3
      expect(h.isTitleWithEqualOrLowerHeadingLevel(item, prevLowestLevel)).toBe(true)
    })

    test('should return false for title with higher heading level', () => {
      const item = { type: 'title', headingLevel: 3 }
      const prevLowestLevel = 2
      expect(h.isTitleWithEqualOrLowerHeadingLevel(item, prevLowestLevel)).toBe(false)
    })

    test('should return false for non-title item', () => {
      const item = { type: 'text' }
      const prevLowestLevel = 2
      expect(h.isTitleWithEqualOrLowerHeadingLevel(item, prevLowestLevel)).toBe(false)
    })
  })

})