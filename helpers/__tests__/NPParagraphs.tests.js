/* global describe, expect, test, beforeAll, beforeEach */
import * as p from '../NPParagraph'

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
    new Paragraph({ type: 'title', content: 'theTitle', headingLevel: 1, indents: 0, lineIndex: 0 }),
    new Paragraph({ type: 'text', content: 'line 2', headingLevel: 1, indents: 0, lineIndex: 1 }),
    new Paragraph({ type: 'empty', content: '', headingLevel: 1, indents: 0, lineIndex: 2 }),
    new Paragraph({ type: 'text', content: 'line 3', headingLevel: 1, indents: 0, lineIndex: 3 }),
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
describe('getBlockUnderHeading()' /* function */, () => {
  test('should return block when passed a string', () => {
    const result = p.getBlockUnderHeading(Editor.note, 'theTitle')
    expect(result.length).toEqual(2)
    expect(result[0].content).toEqual(`theTitle`)
    expect(result[1].content).toEqual(`line 2`)
  })
  test('should return block when passed a paragraph', () => {
    const result = p.getBlockUnderHeading(Editor.note, Editor.note.paragraphs[0])
    expect(result.length).toEqual(2)
    expect(result[0].content).toEqual(`theTitle`)
    expect(result[1].content).toEqual(`line 2`)
  })
})
