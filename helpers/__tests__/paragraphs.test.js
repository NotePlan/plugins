/* global describe, expect, test, beforeAll, beforeEach */
import * as p from '../paragraph'

import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
})

beforeEach(() => {
  const paragraphs = [
    new Paragraph({ type: 'title', lineIndex: 1, content: 'theTitle', headingLevel: 1, indents: 0, lineIndex: 0 }),
    new Paragraph({ type: 'text', lineIndex: 1, content: 'line 2', headingLevel: 1, indents: 0, lineIndex: 1 }),
    new Paragraph({ type: 'empty', lineIndex: 1, content: '', headingLevel: 1, indents: 0, lineIndex: 2 }),
    new Paragraph({ type: 'text', lineIndex: 1, content: 'line 3', headingLevel: 1, indents: 0, lineIndex: 3 }),
  ]
  Editor.note = new Note({ paragraphs })
})

describe('paragraph.js', () => {
  describe('termNotInURL()', () => {
    test('should find search term in a URL', () => {
      const result = p.isTermInURL('tennis', 'Something about http://www.tennis.org/')
      expect(result).toEqual(true)
    })
    test('should not find search term in a URL as it is also in rest of line', () => {
      const result = p.isTermInURL('tennis', 'Something about tennis in http://www.tennis.org/')
      expect(result).toEqual(false)
    })
    test('should find search term in a markdown link URL', () => {
      const result = p.isTermInURL('tennis', 'Something about [title](http://www.tennis.org/booster).')
      expect(result).toEqual(true)
    })
    test('should not find search term in a file path as in rest of line as well', () => {
      const result = p.isTermInURL('tennis', 'Something about [tennis](http://www.tennis.org/booster).')
      expect(result).toEqual(false)
    })
    test('should find search term in a file path', () => {
      const result = p.isTermInURL('tennis', 'Something about file://bob/things/tennis/booster.')
      expect(result).toEqual(true)
    })
    test('should not find search term in a file path as it is in rest of line', () => {
      const result = p.isTermInURL('tennis', 'Something about tennis in file://bob/things/tennis/booster.')
      expect(result).toEqual(false)
    })
    test('should not find term in regular text with unrelated URL', () => {
      const result = p.isTermInURL('tennis', 'And http://www.bbc.co.uk/ and then tennis.org')
      expect(result).toEqual(false)
    })
    test('should not find term in regular text with mixed Caps', () => {
      const result = p.isTermInURL('Tennis', 'And http://www.tennis.org/')
      expect(result).toEqual(false)
    })
    test('should not find term in regular text with ALL CAPS', () => {
      const result = p.isTermInURL('TENNIS', 'And http://www.tennis.org/')
      expect(result).toEqual(false)
    })
    test('should not find term in string with no URI', () => {
      const result = p.isTermInURL('tennis', 'Lots about tennis, but no URI at all')
      expect(result).toEqual(false)
    })
  })

  describe('isTermInMarkdownPath()', () => {
    test('should find search term in an markdown link URL', () => {
      const result = p.isTermInMarkdownPath('tennis', 'Something in [title](http://www.tennis.org/)')
      expect(result).toEqual(true)
    })
    test('should find search term in an markdown image URL', () => {
      const result = p.isTermInMarkdownPath('tennis', 'Something in ![image](http://www.tennis.org/)')
      expect(result).toEqual(true)
    })
    test('should not find search term in a markdown link URL as it is in rest of line', () => {
      const result = p.isTermInMarkdownPath('tennis', 'Something about tennis in [file title](http://www.bbc.org/booster).')
      expect(result).toEqual(false)
    })
    test('should not find search term in a markdown link title', () => {
      const result = p.isTermInMarkdownPath('tennis', 'Something about [tennis](http://www.bbc.org/booster).')
      expect(result).toEqual(false)
    })
    test('should find search term in a file path', () => {
      const result = p.isTermInMarkdownPath('tennis', 'Something about Bob in [Bob link](file://bob/things/tennis/booster) here.')
      expect(result).toEqual(true)
    })
    test('should not find search term in a file path as it is in rest of line', () => {
      const result = p.isTermInMarkdownPath('tennis', 'Something about tennis in file://bob/things/tennis/booster.')
      expect(result).toEqual(false)
    })
    test('should find search term with no caps', () => {
      const result = p.isTermInMarkdownPath('cabbage', 'Something in [this link](http://example.com/cabbage/patch).')
      expect(result).toEqual(true)
    })
    test('should not find search term with Initial Caps', () => {
      const result = p.isTermInMarkdownPath('Cabbage', 'Something in [this link](http://example.com/cabbage/patch).')
      expect(result).toEqual(false)
    })
    test('should not find search term with All CAPS', () => {
      const result = p.isTermInMarkdownPath('CABBAGE', 'Something in [this link](http://example.com/cabbage/patch).')
      expect(result).toEqual(false)
    })
  })

  describe('findEndOfActivePartOfNote()', () => {
    const noteA = {
      paragraphs: [
        { type: "title", lineIndex: 0, content: "NoteA Title", headingLevel: 1 },
        { type: "empty", lineIndex: 1 },
        { type: "title", lineIndex: 2, content: "Section 1", headingLevel: 2 },
        { type: "open", lineIndex: 3, content: "task 1" },
        { type: "text", lineIndex: 4, content: "some ordinary text" },
        { type: "empty", lineIndex: 5 },
        { type: "title", lineIndex: 6, content: "Done ...", headingLevel: 2 },
        { type: "done", lineIndex: 7, content: "task 2 done" },
        { type: "done", lineIndex: 8, content: "task 3 done" },
        { type: "empty", lineIndex: 9 },
        { type: "title", lineIndex: 10, content: "Cancelled", headingLevel: 2 },
        { type: "cancelled", lineIndex: 11, content: "task 4 not done" },
        { type: "title", lineIndex: 12, content: "Done (more)", headingLevel: 2 },
      ]
    }
    test('should find at line 6 (note A)', () => {
      const result = p.findEndOfActivePartOfNote(noteA)
      expect(result).toEqual(6)
    })
    const noteB = {
      paragraphs: [
        { type: "title", lineIndex: 0, content: "NoteA Title", headingLevel: 1 },
        { type: "empty", lineIndex: 1 },
        { type: "title", lineIndex: 2, content: "Section 1", headingLevel: 2 },
        { type: "open", lineIndex: 3, content: "task 1" },
        { type: "text", lineIndex: 4, content: "some ordinary text" },
        { type: "separator", lineIndex: 5 },
        { type: "title", lineIndex: 6, content: "Done ...", headingLevel: 2 },
        { type: "done", lineIndex: 7, content: "task 2 done" },
        { type: "done", lineIndex: 8, content: "task 3 done" },
        { type: "empty", lineIndex: 9 },
        { type: "title", lineIndex: 10, content: "Cancelled", headingLevel: 2 },
        { type: "cancelled", lineIndex: 11, content: "task 4 not done" },
        { type: "title", lineIndex: 12, content: "Done (more)", headingLevel: 2 },
      ]
    }
    test('should find at line 5 (note B)', () => {
      const result = p.findEndOfActivePartOfNote(noteB)
      expect(result).toEqual(5)
    })
    const noteC = {
      paragraphs: [
        { type: "title", lineIndex: 0, content: "NoteB Title", headingLevel: 1 },
        { type: "empty", lineIndex: 1 },
        { type: "title", lineIndex: 2, content: "Section 1", headingLevel: 2 },
        { type: "open", lineIndex: 3, content: "task 1" },
        { type: "text", lineIndex: 4, content: "some ordinary text" },
        { type: "empty", lineIndex: 5 },
        { type: "title", lineIndex: 6, content: "Section 2", headingLevel: 3 },
        { type: "quote", lineIndex: 7, content: "quotation" },
        { type: "done", lineIndex: 8, content: "task 3 done" },
        { type: "empty", lineIndex: 9 },
        { type: "title", lineIndex: 10, content: "Cancelled...", headingLevel: 2 },
        { type: "cancelled", lineIndex: 11, content: "task 4 not done" },
      ]
    }
    test('should find at line 10 (note C)', () => {
      const result = p.findEndOfActivePartOfNote(noteC)
      expect(result).toEqual(10)
    })
    const noteD = {
      paragraphs: [
        { type: "title", lineIndex: 0, content: "NoteB Title", headingLevel: 1 },
        { type: "empty", lineIndex: 1 },
        { type: "title", lineIndex: 2, content: "Section 1", headingLevel: 2 },
        { type: "open", lineIndex: 3, content: "task 1" },
        { type: "text", lineIndex: 4, content: "some ordinary text" },
        { type: "empty", lineIndex: 5 },
        { type: "title", lineIndex: 6, content: "Section 2", headingLevel: 3 },
        { type: "quote", lineIndex: 7, content: "quotation" },
        { type: "done", lineIndex: 8, content: "task 3 done" },
        { type: "empty", lineIndex: 9 },
        { type: "title", lineIndex: 10, content: "Section 3...", headingLevel: 2 },
        { type: "cancelled", lineIndex: 11, content: "task 4 not done" },
      ]
    }
    test('should not find either (note D), so do paras length', () => {
      const result = p.findEndOfActivePartOfNote(noteD)
      expect(result).toEqual(12)
    })
  })
})
