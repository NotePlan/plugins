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
    test('should not find search term in a URL as it is also in rest of line (1)', () => {
      const result = p.isTermInURL('tennis', 'Something about tennis in http://www.tennis.org/')
      expect(result).toEqual(false)
    })
    test('should not find search term in a URL as it is also in rest of line (2)', () => {
      const result = p.isTermInURL('return', '* TEST  [Returns](https://www.energyavenue.com/returns/)')
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
    test('should find term in regular text with mixed Caps', () => {
      const result = p.isTermInURL('Tennis', 'And http://www.tennis.org/')
      expect(result).toEqual(true)
    })
    test('should find term in regular text with ALL CAPS', () => {
      const result = p.isTermInURL('TENNIS', 'And http://www.tennis.org/')
      expect(result).toEqual(true)
    })
    test('should not find term in string with no URI', () => {
      const result = p.isTermInURL('tennis', 'Lots about tennis, but no URI at all')
      expect(result).toEqual(false)
    })
    test('should not find term in string with several URIs', () => {
      const result = p.isTermInURL('tennis', 'Lots about tennis, but not in this https://example.com/ or this https://example2.com/')
      expect(result).toEqual(false)
    })
    test('should match term #test in string with multiple URIs that contain it', () => {
      const result = p.isTermInURL(
        '#term',
        'The [`test do`](https://rubydoc.brew.sh/Formula#test-class_method) block automatically creates and changes to a temporary directory which is deleted after run. You can access this [`Pathname`](https://rubydoc.brew.sh/Pathname) with the [`testpath`](https://rubydoc.brew.sh/Formula#testpath-instance_method) function. The environment variable `HOME` is set to [`testpath`](https://rubydoc.brew.sh/Formula#testpath-instance_method) within the [`test do`](https://rubydoc.brew.sh/Formula#test-class_method) block.',
      )
      expect(result).toEqual(true)
    })
    test('should match term #test in string with one URI that contains it our of several URIs', () => {
      const result = p.isTermInURL(
        '#term',
        'The [do](https://rubydoc.brew.sh/Formula-test-class_method) block automatically creates and changes to a temporary directory which is deleted after run. You can access this [Pathname](https://rubydoc.brew.sh/Pathname) with the [`testpath`](https://rubydoc.brew.sh/Formula-#test-path-instance_method) function. The environment variable `HOME` is set to [`testpath`](https://rubydoc.brew.sh/Formula#testpath-instance_method) within the [do](https://rubydoc.brew.sh/Formula-test-class_method) block.',
      )
      expect(result).toEqual(true)
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
    test('should find search term with Initial Caps', () => {
      const result = p.isTermInMarkdownPath('Cabbage', 'Something in [this link](http://example.com/cabbage/patch).')
      expect(result).toEqual(true)
    })
    test('should find search term with All CAPS', () => {
      const result = p.isTermInMarkdownPath('CABBAGE', 'Something in [this link](http://example.com/cabbage/patch).')
      expect(result).toEqual(true)
    })
  })

  describe('findStartOfActivePartOfNote()', () => {
    // Note: needs to be created this way to trigger the mock required for the appendParagraph() function
    let paras = [new Paragraph()]
    const noteA = new Note({ paras })
    test('should return 0 (empty note A)', () => {
      const result = p.findStartOfActivePartOfNote(noteA)
      expect(result).toEqual(0)
    })

    // Note: needs to be created this way to trigger the mock required for the appendParagraph() function
    // TODO(@dwertheimer):, I don't understand why lineIndex needs to be set, for it looks like the note mock covers the setting of these?
    paras = [new Paragraph({ type: 'title', lineIndex: 0, content: 'NoteB Title', headingLevel: 1 })]
    const noteB = new Note({ paras })
    test('should find at line 0 (note B)', () => {
      const result = p.findStartOfActivePartOfNote(noteB)
      expect(result).toEqual(0)
    })

    const noteC = {
      paragraphs: [
        { type: 'title', lineIndex: 0, content: 'NoteC Title', headingLevel: 1 },
        { type: 'empty', lineIndex: 1 },
        { type: 'title', lineIndex: 2, content: 'Section 1', headingLevel: 2 },
      ],
    }
    test('should find at line 1 (note C)', () => {
      const result = p.findStartOfActivePartOfNote(noteC)
      expect(result).toEqual(1)
    })

    const noteD = {
      paragraphs: [
        { type: 'separator', lineIndex: 0, content: '---', headingLevel: 0 },
        { type: 'text', lineIndex: 1, content: 'title: NoteD', headingLevel: 0 },
        { type: 'text', lineIndex: 2, content: 'field: value here', headingLevel: 0 },
        { type: 'separator', lineIndex: 3, content: '---', headingLevel: 0 },
        { type: 'title', lineIndex: 4, content: 'Section A heading level 2 ', headingLevel: 2 },
        { type: 'text', lineIndex: 5, content: 'A note line', headingLevel: 2 },
      ],
    }
    test('should find at line 4 (note D)', () => {
      const result = p.findStartOfActivePartOfNote(noteD)
      expect(result).toEqual(4)
    })

    const noteE = {
      paragraphs: [
        { type: 'separator', lineIndex: 0, content: '---', headingLevel: 0 },
        { type: 'text', lineIndex: 1, content: 'title: NoteE', headingLevel: 0 },
        { type: 'text', lineIndex: 2, content: 'field: value here', headingLevel: 0 },
        { type: 'separator', lineIndex: 3, content: '---', headingLevel: 0 },
        { type: 'text', lineIndex: 4, content: '#metadata line', headingLevel: 2 },
        { type: 'empty', lineIndex: 5 },
        { type: 'text', lineIndex: 6, content: 'A note line', headingLevel: 2 },
      ],
    }
    test('should find at line 5 after metadata line (note E)', () => {
      const result = p.findStartOfActivePartOfNote(noteE)
      expect(result).toEqual(6)
    })

    const noteF = {
      paragraphs: [
        { type: 'title', lineIndex: 0, content: 'NoteF Title', headingLevel: 1 },
        { type: 'text', lineIndex: 1, content: '#metadata line', headingLevel: 2 },
        { type: 'title', lineIndex: 2, content: 'Section 1', headingLevel: 2 },
      ],
    }
    test('should find at line 2 after metadata line (note F)', () => {
      const result = p.findStartOfActivePartOfNote(noteF)
      expect(result).toEqual(2)
    })

    const noteG = {
      paragraphs: [
        { type: 'title', lineIndex: 0, content: 'NoteG Title', headingLevel: 1 },
        { type: 'text', lineIndex: 1, content: 'first line of preamble' },
        { type: 'text', lineIndex: 2, content: 'next preamble followed by blank line' },
        { type: 'empty', lineIndex: 3 },
        { type: 'title', lineIndex: 4, content: 'Section 1', headingLevel: 2 },
        { type: 'open', lineIndex: 5, content: 'task 1' },
        { type: 'text', lineIndex: 6, content: 'some ordinary text' },
        { type: 'empty', lineIndex: 7 },
        { type: 'title', lineIndex: 8, content: 'Section 2', headingLevel: 3 },
        { type: 'quote', lineIndex: 9, content: 'quotation' },
        { type: 'done', lineIndex: 10, content: 'task 3 done' },
      ],
    }
    test('note G: with allowPreamble true, find at lineIndex 4', () => {
      const result = p.findStartOfActivePartOfNote(noteG, true)
      expect(result).toEqual(4)
    })
    test('note G: with allowPreamble false, find at lineIndex 1', () => {
      const result = p.findStartOfActivePartOfNote(noteG, false)
      expect(result).toEqual(1)
    })

    const noteH = {
      paragraphs: [
        { type: 'title', lineIndex: 0, content: 'NoteH Title', headingLevel: 1 },
        { type: 'text', lineIndex: 1, content: 'first line of preamble' },
        { type: 'text', lineIndex: 2, content: 'next preamble followed by blank line' },
        { type: 'separator', lineIndex: 3, content: '---' },
        { type: 'title', lineIndex: 4, content: 'Section 1', headingLevel: 2 },
        { type: 'open', lineIndex: 5, content: 'task 1' },
        { type: 'text', lineIndex: 6, content: 'some ordinary text' },
        { type: 'empty', lineIndex: 7 },
        { type: 'title', lineIndex: 8, content: 'Section 2', headingLevel: 3 },
        { type: 'quote', lineIndex: 9, content: 'quotation' },
        { type: 'done', lineIndex: 10, content: 'task 3 done' },
      ],
    }
    test('note H: with allowPreamble true, find at lineIndex 4', () => {
      const result = p.findStartOfActivePartOfNote(noteH, true)
      expect(result).toEqual(4)
    })
    test('note H: with allowPreamble false, find at lineIndex 1', () => {
      const result = p.findStartOfActivePartOfNote(noteH, false)
      expect(result).toEqual(1)
    })
    const noteI = {
      paragraphs: [
        { type: 'title', lineIndex: 0, content: 'NoteI Title', headingLevel: 1 },
        { type: 'text', lineIndex: 1, content: 'first line of preamble' },
        { type: 'text', lineIndex: 2, content: 'next preamble followed by blank line' },
        { type: 'title', lineIndex: 3, content: 'Section 1', headingLevel: 2 },
        { type: 'open', lineIndex: 4, content: 'task 1' },
        { type: 'text', lineIndex: 5, content: 'some ordinary text' },
        { type: 'empty', lineIndex: 6 },
        { type: 'title', lineIndex: 7, content: 'Section 2', headingLevel: 3 },
        { type: 'quote', lineIndex: 8, content: 'quotation' },
        { type: 'done', lineIndex: 9, content: 'task 3 done' },
      ],
    }
    test('note H: with allowPreamble true, find at lineIndex 4', () => {
      const result = p.findStartOfActivePartOfNote(noteI, true)
      expect(result).toEqual(3)
    })
    test('note H: with allowPreamble false, find at lineIndex 1', () => {
      const result = p.findStartOfActivePartOfNote(noteI, false)
      expect(result).toEqual(1)
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
    test("should not match 'second' as there's no title line that starts with that", () => {
      expect(p.findHeadingStartsWith(noteA, 'second')).toEqual('')
    })
  })
})

// TODO: turn into jest tests
// /** tests for above function */
// function testTermInNotelinkOrURI() {
//   logDebug('test1 -> false', String(isTermInNotelinkOrURI('[[link with#tag]] but empty search term', '')))
//   logDebug('test2 -> true', String(isTermInNotelinkOrURI('[[link with#tag]]', '#tag')))
//   logDebug('test3 -> false', String(isTermInNotelinkOrURI('[[link without that tag]]', '#tag')))
//   logDebug('test4 -> false', String(isTermInNotelinkOrURI('string has #tag [[but link without]]', '#tag')))
//   logDebug('test5 -> false', String(isTermInNotelinkOrURI('string has [[but link without]] and  #tag after', '#tag')))
//   logDebug('test6 -> true', String(isTermInNotelinkOrURI('term is in URL http://bob.com/page#tag', '#tag')))
//   logDebug('test7 -> false', String(isTermInNotelinkOrURI('string has http://bob.com/page #tag', '#tag')))
//   logDebug('test8 -> false', String(isTermInNotelinkOrURI('string has #tag before not in http://bob.com/URL', '#tag')))
// }
