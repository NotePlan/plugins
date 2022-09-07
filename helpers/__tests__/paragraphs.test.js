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
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging
})

beforeEach(() => {
  const paragraphs = [
    new Paragraph({ type: 'title', content: 'theTitle', headingLevel: 1, indents: 0, lineIndex: 0 }),
    new Paragraph({ type: 'text', content: 'line 2', headingLevel: 1, indents: 0, lineIndex: 1 }),
    new Paragraph({ type: 'empty', content: '', headingLevel: 1, indents: 0, lineIndex: 2 }),
    new Paragraph({ type: 'text', content: 'line 3', headingLevel: 1, indents: 0, lineIndex: 3 }),
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
    test('should find search term in a NotePlan callback', () => {
      const result = p.isTermInURL(
        'callback',
        "<@763430583702519878> I think I may have discovered an issue with the Search Extensions plugin. I'm using '/saveSearchOverNotes' and I'm unable to update the document using the url link. My search terms do have @mentions in them so I thought it might be the issue you identified the other day, but I've noticed that the url uses the plugin command, 'saveSearchResults' rather than 'saveSearchOverNotes'.I think it may be doing this for the other versions of save search too. When I manually change the url, it refreshes fine. See eg: noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=saveSearchResults&arg0=",
      )
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

  describe('calcSmartPrependPoint()', () => {
    const noteA = {
      type: 'notes',
      paragraphs: [
        { type: 'title', lineIndex: 0, content: 'Note title' },
        { type: 'empty', lineIndex: 1, content: '' },
        { type: 'text', lineIndex: 2, content: 'First real content' },
      ],
    }
    test('should return 1 for basic note with title', () => {
      const result = p.calcSmartPrependPoint(noteA)
      expect(result).toEqual(1)
    })
    const noteB = {
      type: 'notes',
      paragraphs: [
        { type: 'separator', lineIndex: 0, content: '---' },
        { type: 'text', lineIndex: 1, content: 'title: Note title' },
        { type: 'text', lineIndex: 2, content: 'field: another' },
        { type: 'separator', lineIndex: 3, content: '---' },
        { type: 'empty', lineIndex: 4, content: '' },
        { type: 'text', lineIndex: 5, content: 'First real content' },
      ],
    }
    test('should return 4 for note with frontmatter', () => {
      const result = p.calcSmartPrependPoint(noteB)
      expect(result).toEqual(4)
    })
    const noteC = {
      type: 'notes',
      paragraphs: [
        { type: 'title', lineIndex: 0, content: 'Note title' },
        { type: 'text', lineIndex: 1, content: '#project metadata' },
        { type: 'empty', lineIndex: 2, content: '' },
        { type: 'text', lineIndex: 3, content: 'First real content' },
      ],
    }
    test('should return 3 for basic note with title, metadata and blank line', () => {
      const result = p.calcSmartPrependPoint(noteC)
      expect(result).toEqual(3)
    })
    const noteE = {
      type: 'Calendar',
      paragraphs: [{ type: 'empty', lineIndex: 0, content: '' }],
    }
    test('should return 0 for single empty para', () => {
      const result = p.calcSmartPrependPoint(noteE)
      expect(result).toEqual(0)
    })
    const noteF = {
      type: 'Calendar',
      paragraphs: [{ type: 'text', lineIndex: 0, content: 'Single line only' }],
    }
    test('should return 0 for single empty para', () => {
      const result = p.calcSmartPrependPoint(noteF)
      expect(result).toEqual(0)
    })
    const noteG = {
      type: 'Calendar',
      paragraphs: [],
    }
    test('should return 0 for no paras at all', () => {
      const result = p.calcSmartPrependPoint(noteG)
      expect(result).toEqual(0)
    })
  })

  describe('findEndOfActivePartOfNote()', () => {
    const noteA = {
      paragraphs: [
        { type: 'title', lineIndex: 0, content: 'NoteA Title', headingLevel: 1 },
        { type: 'empty', lineIndex: 1 },
        { type: 'title', lineIndex: 2, content: 'Section 1', headingLevel: 2 },
        { type: 'open', lineIndex: 3, content: 'task 1' },
        { type: 'text', lineIndex: 4, content: 'some ordinary text' },
        { type: 'empty', lineIndex: 5 },
        { type: 'title', lineIndex: 6, content: 'Done ...', headingLevel: 2 },
        { type: 'done', lineIndex: 7, content: 'task 2 done' },
        { type: 'done', lineIndex: 8, content: 'task 3 done' },
        { type: 'empty', lineIndex: 9 },
        { type: 'title', lineIndex: 10, content: 'Cancelled', headingLevel: 2 },
        { type: 'cancelled', lineIndex: 11, content: 'task 4 not done' },
        { type: 'title', lineIndex: 12, content: 'Done (more)', headingLevel: 2 },
      ],
    }
    test('should find at line 5 (note A)', () => {
      const result = p.findEndOfActivePartOfNote(noteA)
      expect(result).toEqual(5)
    })
    const noteB = {
      paragraphs: [
        { type: 'title', lineIndex: 0, content: 'NoteA Title', headingLevel: 1 },
        { type: 'empty', lineIndex: 1 },
        { type: 'title', lineIndex: 2, content: 'Section 1', headingLevel: 2 },
        { type: 'open', lineIndex: 3, content: 'task 1' },
        { type: 'text', lineIndex: 4, content: 'some ordinary text' },
        { type: 'separator', lineIndex: 5 },
        { type: 'title', lineIndex: 6, content: 'Done ...', headingLevel: 2 },
        { type: 'done', lineIndex: 7, content: 'task 2 done' },
        { type: 'done', lineIndex: 8, content: 'task 3 done' },
        { type: 'empty', lineIndex: 9 },
        { type: 'title', lineIndex: 10, content: 'Cancelled', headingLevel: 2 },
        { type: 'cancelled', lineIndex: 11, content: 'task 4 not done' },
        { type: 'title', lineIndex: 12, content: 'Done (more)', headingLevel: 2 },
      ],
    }
    test('should find at line 4 (note B)', () => {
      const result = p.findEndOfActivePartOfNote(noteB)
      expect(result).toEqual(4)
    })
    const noteC = {
      paragraphs: [
        { type: 'title', lineIndex: 0, content: 'NoteB Title', headingLevel: 1 },
        { type: 'empty', lineIndex: 1 },
        { type: 'title', lineIndex: 2, content: 'Section 1', headingLevel: 2 },
        { type: 'open', lineIndex: 3, content: 'task 1' },
        { type: 'text', lineIndex: 4, content: 'some ordinary text' },
        { type: 'empty', lineIndex: 5 },
        { type: 'title', lineIndex: 6, content: 'Section 2', headingLevel: 3 },
        { type: 'quote', lineIndex: 7, content: 'quotation' },
        { type: 'done', lineIndex: 8, content: 'task 3 done' },
        { type: 'empty', lineIndex: 9 },
        { type: 'title', lineIndex: 10, content: 'Cancelled...', headingLevel: 2 },
        { type: 'cancelled', lineIndex: 11, content: 'task 4 not done' },
      ],
    }
    test('should find at line 9 (note C)', () => {
      const result = p.findEndOfActivePartOfNote(noteC)
      expect(result).toEqual(9)
    })
    const noteD = {
      paragraphs: [
        { type: 'title', lineIndex: 0, content: 'NoteB Title', headingLevel: 1 },
        { type: 'empty', lineIndex: 1, content: '' },
        { type: 'title', lineIndex: 2, content: 'Section 1', headingLevel: 2 },
        { type: 'open', lineIndex: 3, content: 'task 1' },
        { type: 'text', lineIndex: 4, content: 'some ordinary text' },
        { type: 'empty', lineIndex: 5, content: '' },
        { type: 'title', lineIndex: 6, content: 'Section 2', headingLevel: 3 },
        { type: 'quote', lineIndex: 7, content: 'quotation' },
        { type: 'done', lineIndex: 8, content: 'task 3 done' },
        { type: 'empty', lineIndex: 9, content: '' },
        { type: 'title', lineIndex: 10, content: 'Section 3...', headingLevel: 2 },
        { type: 'cancelled', lineIndex: 11, content: 'task 4 not done' },
        { type: 'empty', lineIndex: 12, content: '' },
      ],
    }
    test('should not find either (note D), so do last non-empty lineIndex (11)', () => {
      const result = p.findEndOfActivePartOfNote(noteD)
      expect(result).toEqual(11)
    })
    const noteE = {
      paragraphs: [{ type: 'empty', lineIndex: 0, content: '' }],
    }
    test('should return 0 for single empty para', () => {
      const result = p.findEndOfActivePartOfNote(noteE)
      expect(result).toEqual(0)
    })
    const noteF = {
      paragraphs: [{ type: 'text', lineIndex: 0, content: 'Single line only' }],
    }
    test('should return 0 for single para only', () => {
      const result = p.findEndOfActivePartOfNote(noteF)
      expect(result).toEqual(0)
    })
    const noteG = {
      paragraphs: [],
    }
    test('should return 0 for no paras at all', () => {
      const result = p.findEndOfActivePartOfNote(noteG)
      expect(result).toEqual(0)
    })
  })

  describe('removeDuplicateSyncedLines()', () => {
    test('should pass through unsynced lines with duplicate values', () => {
      const linesBefore = [{ content: 'some ordinary text' }, { content: 'some ordinary text' }]
      expect(p.removeDuplicateSyncedLines(linesBefore)).toEqual(linesBefore)
    })
    test('should undupe duplicate blockIDs', () => {
      const linesBefore = [
        { content: 'some ordinary text', blockId: '^123456' },
        { content: 'some ordinary text', blockId: '^123456' },
      ]
      expect(p.removeDuplicateSyncedLines(linesBefore).length).toEqual(1)
    })
    test('should pass through different blockIDs', () => {
      const linesBefore = [
        { content: 'some ordinary text', blockId: '^aaaaaa' },
        { content: 'some ordinary text', blockId: '^123456' },
      ]
      expect(p.removeDuplicateSyncedLines(linesBefore)).toEqual(linesBefore)
    })
  })

  describe('findHeadingStartsWith()', () => {
    const noteA = {
      paragraphs: [
        { type: 'title', lineIndex: 0, content: 'NoteA Title', headingLevel: 1 },
        { type: 'empty', lineIndex: 1 },
        { type: 'title', lineIndex: 2, content: 'Tasks for 3.4.22', headingLevel: 2 },
        { type: 'open', lineIndex: 3, content: 'task 1' },
        { type: 'title', lineIndex: 4, content: 'Journal for 3.4.22' },
        { type: 'list', lineIndex: 5, content: 'first journal entry' },
        { type: 'list', lineIndex: 6, content: 'second journal entry' },
        { type: 'empty', lineIndex: 7 },
        { type: 'title', lineIndex: 8, content: 'Done ...', headingLevel: 2 },
        { type: 'title', lineIndex: 9, content: 'Cancelled', headingLevel: 2 },
        { type: 'cancelled', lineIndex: 10, content: 'task 4 not done' },
      ],
    }
    test('should not match with empty search term', () => {
      expect(p.findHeadingStartsWith(noteA, '')).toEqual('')
    })
    test("should match 'Journal' with line 'Journal for 3.4.22'", () => {
      expect(p.findHeadingStartsWith(noteA, 'Journal')).toEqual('Journal for 3.4.22')
    })
    test("should match 'JOURNAL' with line 'Journal for 3.4.22'", () => {
      expect(p.findHeadingStartsWith(noteA, 'JOURNAL')).toEqual('Journal for 3.4.22')
    })
    test("should match 'journal' with line 'Journal for 3.4.22'", () => {
      expect(p.findHeadingStartsWith(noteA, 'JOURNAL')).toEqual('Journal for 3.4.22')
    })
    test("should match 'Journal for 3.4.22' to 'Journal for 3.4.22'", () => {
      expect(p.findHeadingStartsWith(noteA, 'Journal')).toEqual('Journal for 3.4.22')
    })
    test("should match 'Journal for 3.4.22' with 'Journal'", () => {
      expect(p.findHeadingStartsWith(noteA, 'Journal')).toEqual('Journal for 3.4.22')
    })
  })
})
