/* global describe, expect, test, beforeAll, beforeEach */
import * as p from '../NPParagraph'

import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.Note = Note
  global.Paragraph = Paragraph
  global.NotePlan = NotePlan
})

beforeEach(() => {
  const paragraphs = [
    new Paragraph({ type: 'title', content: 'theTitle', headingLevel: 1, indents: 0, lineIndex: 0 }),
    new Paragraph({ type: 'text', content: 'line 2', headingLevel: 1, indents: 0, lineIndex: 1 }),
    new Paragraph({ type: 'text', content: 'line 3 (child of 2)', headingLevel: 1, indents: 1, lineIndex: 2 }),
    new Paragraph({ type: 'text', content: 'line 4', headingLevel: 1, indents: 0, lineIndex: 3 }),
    new Paragraph({ type: 'empty', content: '', headingLevel: 1, indents: 0, lineIndex: 4 }),
    new Paragraph({ type: 'separator', content: '---', lineIndex: 5 }),
    new Paragraph({ type: 'title', content: 'Done', headingLevel: 2, indents: 0, lineIndex: 6 }),
  ]
  Editor.note = new Note({ paragraphs })
})

/*
 * findHeading()
 */
describe('findHeading()' /* function */, () => {
  test('should return null if no heading', () => {
    const result = p.findHeading(Editor.note, '')
    expect(result).toEqual(null)
  })
  test('should return a paragraph when matched', () => {
    const result = p.findHeading(Editor.note, 'theTitle')
    expect(result).not.toEqual(null)
    expect(result.content).toEqual(`theTitle`)
  })
  test('should return null when not matched', () => {
    const result = p.findHeading(Editor.note, 'NoTitleMatch')
    expect(result).toEqual(null)
  })
  test('should return partial match', () => {
    const result = p.findHeading(Editor.note, 'eTit',true)
    expect(result.content).toEqual(`theTitle`)
  })
})

/*
 * getBlockUnderHeading()
 */
describe('getParagraphBlock()' /* function */, () => {
  test('should return block lineIndex 0-4 from 0/false/false', () => {
    const result = p.getParagraphBlock(Editor.note, 0, false, false)
    expect(result).toEqual(Editor.note.paragraphs.slice(0, 5))
  })
  test('should return block lineIndex 0-3 from 0/false/true', () => {
    const result = p.getParagraphBlock(Editor.note, 0, false, true)
    expect(result).toEqual(Editor.note.paragraphs.slice(0, 4))
  })
  test('should return block lineIndex 0-4 from 0/true/false', () => {
    const result = p.getParagraphBlock(Editor.note, 0, true, false)
    expect(result).toEqual(Editor.note.paragraphs.slice(0, 5))
  })
  test('should return block lineIndex 0-3 from 0/true/true', () => {
    const result = p.getParagraphBlock(Editor.note, 0, true, true)
    expect(result).toEqual(Editor.note.paragraphs.slice(0, 4))
  })

  test('should return block lineIndex 1-4 from 1/false/false', () => {
    const result = p.getParagraphBlock(Editor.note, 1, false, false)
    expect(result).toEqual(Editor.note.paragraphs.slice(1, 5))
  })
  test('should return block lineIndex 1-3 from 1/false/true', () => {
    const result = p.getParagraphBlock(Editor.note, 1, false, true)
    expect(result).toEqual(Editor.note.paragraphs.slice(1, 4))
  })
  test('should return block lineIndex 0-4 from 1/true/false', () => {
    const result = p.getParagraphBlock(Editor.note, 1, true, false)
    expect(result).toEqual(Editor.note.paragraphs.slice(0, 5))
  })
  test('should return block lineIndex 0-3 from 1/true/true', () => {
    const result = p.getParagraphBlock(Editor.note, 1, true, true)
    expect(result).toEqual(Editor.note.paragraphs.slice(0, 4))
  })

  test('should return block lineIndex 2 from 2/false/false', () => {
    const result = p.getParagraphBlock(Editor.note, 2, false, false)
    expect(result).toEqual(Editor.note.paragraphs.slice(2, 3))
  })
  test('should return block lineIndex 2 from 2/false/true', () => {
    const result = p.getParagraphBlock(Editor.note, 2, false, true)
    expect(result).toEqual(Editor.note.paragraphs.slice(2, 3))
  })
  test('should return block lineIndex 0-4 from 2/true/false', () => {
    const result = p.getParagraphBlock(Editor.note, 2, true, false)
    expect(result).toEqual(Editor.note.paragraphs.slice(0, 5))
  })
  test('should return block lineIndex 0-3 from 2/true/true', () => {
    const result = p.getParagraphBlock(Editor.note, 2, true, true)
    expect(result).toEqual(Editor.note.paragraphs.slice(0, 4))
  })
})

/*
 * getBlockUnderHeading()
 */
describe('getBlockUnderHeading()' /* function */, () => {
  test('should return block (with heading) when passed a heading string', () => {
    const result = p.getBlockUnderHeading(Editor.note, 'theTitle', true)
    expect(result).toEqual(Editor.note.paragraphs.slice(0, 5))
    // expect(result.length).toEqual(2)
    // expect(result[0].content).toEqual(`theTitle`)
    // expect(result[1].content).toEqual(`line 2`)
  })
  test('should return block (without heading) when passed a heading string', () => {
    const result = p.getBlockUnderHeading(Editor.note, 'theTitle', false)
    expect(result).toEqual(Editor.note.paragraphs.slice(1, 5))
    // expect(result.length).toEqual(1)
    // expect(result[0].content).toEqual(`line 2`)
  })
  test('should return block (with heading) when passed a heading paragraph', () => {
    const result = p.getBlockUnderHeading(Editor.note, Editor.note.paragraphs[0], true)
    expect(result).toEqual(Editor.note.paragraphs.slice(0, 5))
    // expect(result.length).toEqual(2)
    // expect(result[0].content).toEqual(`theTitle`)
    // expect(result[1].content).toEqual(`line 2`)
  })
  test('should return block (without heading) when passed a heading paragraph', () => {
    const result = p.getBlockUnderHeading(Editor.note, Editor.note.paragraphs[0], false)
    expect(result).toEqual(Editor.note.paragraphs.slice(1, 5))
    // expect(result.length).toEqual(1)
    // expect(result[0].content).toEqual(`line 2`)
  })
})

// Note: commented out, as I don't know how to get the mocks working for
// .insertParagraph and .appendParagraph
// despite the imports at the beginning.

// describe('getOrMakeMetadataLine()', () => {
//   const noteA = {
//     paragraphs: [
//       { type: 'title', lineIndex: 0, content: 'NoteA Title', headingLevel: 1 },
//       { type: 'empty', lineIndex: 1, content: '' },
//       { type: 'title', lineIndex: 2, content: 'Tasks for 3.4.22', headingLevel: 2 },
//       { type: 'open', lineIndex: 3, content: 'task 1' },
//       { type: 'title', lineIndex: 4, content: 'Journal for 3.4.22' },
//       { type: 'list', lineIndex: 5, content: 'first journal entry' },
//       { type: 'list', lineIndex: 6, content: 'second journal entry' },
//       { type: 'empty', lineIndex: 7, content: '' },
//       { type: 'title', lineIndex: 8, content: 'Done ...', headingLevel: 2 },
//       { type: 'title', lineIndex: 9, content: 'Cancelled', headingLevel: 2 },
//       { type: 'cancelled', lineIndex: 10, content: 'task 4 not done' },
//     ],
//   }
//   test("should return blank line after title", () => {
//     expect(p.getOrMakeMetadataLine(noteA)).toEqual(1)
//   })
//   test("should return metadata line style 1", () => {
//     const noteB = {
//       paragraphs: [
//         { type: 'title', lineIndex: 0, content: 'NoteA Title', headingLevel: 1 },
//         { type: 'text', lineIndex: 1, content: '@due(2023-01-01) @review(2m)' },
//       ],
//     }
//     expect(p.getOrMakeMetadataLine(noteB)).toEqual(1)
//   })
//   test("should return metadata line style 2", () => {
//     const noteC = {
//       paragraphs: [
//         { type: 'title', lineIndex: 0, content: 'NoteA Title', headingLevel: 1 },
//         { type: 'text', lineIndex: 1, content: '#project @due(2023-01-01) @reviewed(2022-08-01)' },
//       ],
//     }
//     expect(p.getOrMakeMetadataLine(noteC)).toEqual(1)
//   })
//   test('should return line after single empty para', () => {
//     const noteE = {
//       paragraphs: [
//         { type: 'empty', lineIndex: 0, content: '' },
//       ],
//     }
//     const result = p.getOrMakeMetadataLine(noteE)
//     expect(result).toEqual(1)
//   })
//   test('should return line after single para', () => {
//     const noteF = {
//       paragraphs: [
//         { type: 'text', lineIndex: 0, content: 'Single line only' },
//       ],
//     }
//     const result = p.getOrMakeMetadataLine(noteF)
//     expect(result).toEqual(1)
//   })
//   test('should return 1 for no paras at all', () => {
//     const noteG = {
//       paragraphs: [],
//     }
//     const result = p.getOrMakeMetadataLine(noteG)
//     expect(result).toEqual(1)
//   })
// })