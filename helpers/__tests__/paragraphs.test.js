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
      const result = p.termInURL('tennis', 'Something about http://www.tennis.org/')
      expect(result).toEqual(true)
    })
    test('should not find search term in a URL as it is also in rest of line', () => {
      const result = p.termInURL('tennis', 'Something about tennis in http://www.tennis.org/')
      expect(result).toEqual(false)
    })
    test('should find search term in a markdown link URL', () => {
      const result = p.termInURL('tennis', 'Something about [title](http://www.tennis.org/booster).')
      expect(result).toEqual(true)
    })
    test('should not find search term in a file path as in rest of line as well', () => {
      const result = p.termInURL('tennis', 'Something about [tennis](http://www.tennis.org/booster).')
      expect(result).toEqual(false)
    })
    test('should find search term in a file path', () => {
      const result = p.termInURL('tennis', 'Something about file://bob/things/tennis/booster.')
      expect(result).toEqual(true)
    })
    test('should not find search term in a file path as it is in rest of line', () => {
      const result = p.termInURL('tennis', 'Something about tennis in file://bob/things/tennis/booster.')
      expect(result).toEqual(false)
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
    test('should not find term in string with no URI', () => {
      const result = p.termInURL('tennis', 'Lots about tennis, but no URI at all')
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
    test('should not find search term in a markdown link URL as it is in rest of line', () => {
      const result = p.termInMarkdownPath('tennis', 'Something about tennis in [file title](http://www.bbc.org/booster).')
      expect(result).toEqual(false)
    })
    test('should not find search term in a markdown link title', () => {
      const result = p.termInMarkdownPath('tennis', 'Something about [tennis](http://www.bbc.org/booster).')
      expect(result).toEqual(false)
    })
    test('should find search term in a file path', () => {
      const result = p.termInMarkdownPath('tennis', 'Something about Bob in [Bob link](file://bob/things/tennis/booster) here.')
      expect(result).toEqual(true)
    })
    test('should not find search term in a file path as it is in rest of line', () => {
      const result = p.termInMarkdownPath('tennis', 'Something about tennis in file://bob/things/tennis/booster.')
      expect(result).toEqual(false)
    })
    test('should find search term with no caps', () => {
      const result = p.termInMarkdownPath('cabbage', 'Something in [this link](http://example.com/cabbage/patch).')
      expect(result).toEqual(true)
    })
    test('should not find search term with Initial Caps', () => {
      const result = p.termInMarkdownPath('Cabbage', 'Something in [this link](http://example.com/cabbage/patch).')
      expect(result).toEqual(false)
    })
    test('should not find search term with All CAPS', () => {
      const result = p.termInMarkdownPath('CABBAGE', 'Something in [this link](http://example.com/cabbage/patch).')
      expect(result).toEqual(false)
    })
  })

  /** 
   * This will be rather fiddly to test fully, but here's some to get started. 
   * Will not test inside of URIs or [MD](links) because if present they're not significant.
  */
  describe('trimAndHighlightSearchResult()', () => {
    test('should return same as input', () => {
      const output = p.trimAndHighlightSearchResult('Something in [tennis title](http://www.random-rubbish.org/)', 'tennis', false, 100)
      expect(output).toEqual('Something in [tennis title](http://www.random-rubbish.org/)')
    })
    test('should return same as input + highlight', () => {
      const output = p.trimAndHighlightSearchResult('Something in [tennis title](http://www.random-rubbish.org/)', 'tennis', true, 100)
      expect(output).toEqual('Something in [==tennis== title](http://www.random-rubbish.org/)')
    })
    test('should return same as input (no term included at all)', () => {
      const output = p.trimAndHighlightSearchResult('Something in [link title](http://www.random-rubbish.org/)', 'cabbage', true, 100)
      expect(output).toEqual('Something in [link title](http://www.random-rubbish.org/)')
    })
    test('should return 3 highlights', () => {
      const output = p.trimAndHighlightSearchResult("There's Tennis and tennis.org and unTENNISlike behaviour!", 'tennis', true, 100)
      expect(output).toEqual("There's ==Tennis== and ==tennis==.org and un==TENNIS==like behaviour!")
    })
    test('should return 2 highlight and no trimming', () => {
      const output = p.trimAndHighlightSearchResult("Lorem ipsum dolor sit amet, sed consectetur adipisicing elit, sed do eiusmod tempor incididunt", 'sed', true, 100)
      expect(output).toEqual("Lorem ipsum dolor sit amet, ==sed== consectetur adipisicing elit, ==sed== do eiusmod tempor incididunt")
    })
    test('should return 1 highlight and end trimmng', () => {
      const output = p.trimAndHighlightSearchResult("Lorem ipsum dolor sit amet, sed consectetur adipisicing elit, sed do eiusmod tempor incididunt", 'sed', false, 86)
      expect(output).toEqual("Lorem ipsum dolor sit amet, sed consectetur adipisicing elit, sed do eiusmod ...")
    })
    test('should return 1 highlight and front and end trimming', () => {
      const output = p.trimAndHighlightSearchResult("Lorem ipsum dolor sit amet, sed consectetur adipisicing elit, sed do eiusmod tempor incididunt", 'sed', false, 70)
      expect(output).toEqual("Lorem ipsum dolor sit amet, sed consectetur adipisicing elit, sed ...")
    })
    // Run out of energy to do the detail on this ...
    test.skip('should return 1 highlight and front and end trimming', () => {
      const output = p.trimAndHighlightSearchResult("Lorem ipsum dolor sit amet, sed consectetur adipisicing elit, sed do eiusmod tempor incididunt", 'sed', false, 48)
      expect(output).toEqual("... ipsum dolor sit amet, sed consectetur adipisicing elit, ...")
    })
  })
})
