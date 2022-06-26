/* global describe, expect, test, beforeEach */
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
  /* template:
      test('should XXX', () => {
        const spy = jest.spyOn(CommandBar, 'prompt')
        const result = mainFile.findHeading()
        expect(result).toEqual(true)
	expect(spy).toHaveBeenCalledWith()
        spy.mockRestore()
      })
      */

  test('should return a paragraph when matched', () => {
    const result = p.findHeading(Editor.note, 'theTitle')
    expect(result).not.toEqual(null)
    expect(result.content).toEqual(`theTitle`)
  })
  test('should return null when not matched', () => {
    const result = p.findHeading(Editor.note, 'NoTitleMatch')
    expect(result).toEqual(null)
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

describe('summaryHelpers', () => {
  describe('termNotInURL()', () => {
    test('should find search term in a bare URL', () => {
      const result = p.termInURL('tennis', 'Something about tennis in http://www.tennis.org/')
      expect(result).toEqual(true)
    })
    test('should find search term in a markdown link URL', () => {
      const result = p.termInURL('tennis', 'Something about tennis in [tennis](http://www.tennis.org/booster).')
      expect(result).toEqual(true)
    })
    test('should find search term in a file path', () => {
      const result = p.termInURL('tennis', 'Something about tennis in file:/bob/things/tennis/booster.')
      expect(result).toEqual(true)
    })
    test('should not find term in regular text with unrelated URL', () => {
      const result = p.termInURL('tennis', 'And http://www.bbc.co.uk/ and then tennis.org')
      expect(result).toEqual(false)
    })
    test('should not find term in regular text with mixed Caps', () => {
      const result = p.termInURL('Tennis', 'And http://www.tennis.org/')
      expect(result).toEqual(false)
    })
    test('should not find term in regular text with ALL CAPS', () => {
      const result = p.termInURL('TENNIS', 'And http://www.tennis.org/')
      expect(result).toEqual(false)
    })
  })

  describe('termInMarkdownPath()', () => {
    test('should find search term in an markdown link URL', () => {
      const result = p.termInMarkdownPath('tennis', 'Something in [title](http://www.tennis.org/)')
      expect(result).toEqual(true)
    })
    test('should find search term in an markdown image URL', () => {
      const result = p.termInMarkdownPath('tennis', 'Something in ![image](http://www.tennis.org/)')
      expect(result).toEqual(true)
    })
    test('should not find search term in a markdown link title', () => {
      const result = p.termInMarkdownPath('tennis', 'Something about tennis in [tennis](http://www.bbc.org/booster).')
      expect(result).toEqual(false)
    })
    test('should not find search term in a file path', () => {
      const result = p.termInMarkdownPath('tennis', 'Something about tennis in file:/bob/things/tennis/booster.')
      expect(result).toEqual(false)
    })
    test('should find search term with no caps', () => {
      const result = p.termInMarkdownPath('cabbage', 'Something in httpp://example.com/cabbage/patch.')
      expect(result).toEqual(true)
    })
    test('should not find search term with Initial Caps', () => {
      const result = p.termInMarkdownPath('Cabbage', 'Something in httpp://example.com/cabbage/patch.')
      expect(result).toEqual(false)
    })
    test('should not find search term with All CAPS', () => {
      const result = p.termInMarkdownPath('CABBAGE', 'Something in httpp://example.com/cabbage/patch.')
      expect(result).toEqual(false)
    })
  })
})
