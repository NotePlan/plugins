/* global describe, expect, test, beforeAll */

import colors from 'chalk'
import * as h from '../HTMLView'
import * as n from '../NPThemeToCSS'
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

// import { clo, logDebug, logError, logWarn } from '@helpers/dev'

// To test generateCSSFromTheme() run at the moment,
// run '/test:generateCSSFromTheme' command
// TODO: write test for a standard one using generateCSSFromTheme()

const FILE = `${colors.yellow('helpers/NPSyncedCopies')}`

describe(`${FILE}`, () => {
  describe('textDecorationFromNP()', () => {
    test('should return empty from unsupported selector', () => {
      const res = n.textDecorationFromNP('unsupported', 'ignore')
      expect(res).toEqual('')
    })
    test('should return empty from unsupported value', () => {
      const res = n.textDecorationFromNP('underlineStyle', 'bob')
      expect(res).toEqual('')
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('underlineStyle', 1)
      expect(res).toEqual('text-decoration: underline')
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('underlineStyle', 9)
      expect(res).toEqual('text-decoration: underline double')
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('underlineStyle', 513)
      expect(res).toEqual('text-decoration: underline dashed')
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('strikethroughStyle', 1)
      expect(res).toEqual('text-decoration: line-through')
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('strikethroughStyle', 9)
      expect(res).toEqual('text-decoration: line-through double')
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('strikethroughStyle', 513)
      expect(res).toEqual('text-decoration: line-through dashed')
    })
  })

  describe('fontPropertiesFromNP()', () => {
    const defaultAnswer = [`font-family: "sans"`, `font-weight: "regular"`, `font-style: "normal"`]
    test('should return defaults from empty selector', () => {
      const res = n.fontPropertiesFromNP('')
      expect(res).toEqual(defaultAnswer)
      expect(res).toEqual(['font-family: "sans"', 'font-weight: "regular"', 'font-style: "normal"'])
    })
    test('should return defaults from random font name', () => {
      const res = n.fontPropertiesFromNP('Zebra')
      expect(res).toEqual(['font-family: "Zebra"', 'font-weight: "400"', 'font-style: "normal"'])
    })
    test("input 'AvenirNext'", () => {
      const res = n.fontPropertiesFromNP('AvenirNext')
      expect(res).toEqual(['font-family: "Avenir Next"', 'font-weight: "400"', 'font-style: "normal"'])
    })
    test("input 'AvenirNext-Italic'", () => {
      const res = n.fontPropertiesFromNP('AvenirNext-Italic')
      expect(res).toEqual(['font-family: "Avenir Next"', 'font-weight: "400"', 'font-style: "italic"'])
    })
    test("input 'HelveticaNeue'", () => {
      const res = n.fontPropertiesFromNP('HelveticaNeue')
      expect(res).toEqual(['font-family: "Helvetica Neue"', 'font-weight: "400"', 'font-style: "normal"'])
    })
    test("input 'HelveticaNeue-Bold'", () => {
      const res = n.fontPropertiesFromNP('HelveticaNeue-Bold')
      expect(res).toEqual(['font-family: "Helvetica Neue"', 'font-weight: "700"', 'font-style: "normal"'])
    })
    test("input 'Candara'", () => {
      const res = n.fontPropertiesFromNP('Candara')
      expect(res).toEqual(['font-family: "Candara"', 'font-weight: "400"', 'font-style: "normal"'])
    })
    test("input 'Charter-Book'", () => {
      const res = n.fontPropertiesFromNP('Charter-Book')
      expect(res).toEqual(['font-family: "Charter"', 'font-weight: "500"', 'font-style: "normal"'])
    })
  })

  /*
   * generateScriptTags()
   */
  describe('generateScriptTags()' /* function */, () => {
    test('should return empty if scripts is undefined', () => {
      const result = h.generateScriptTags(undefined)
      expect(result).toEqual(``)
    })
    test('should return empty if scripts is null', () => {
      const result = h.generateScriptTags(null)
      expect(result).toEqual(``)
    })
    test('should return empty if scripts is empty string', () => {
      const result = h.generateScriptTags('')
      expect(result).toEqual(``)
    })
    test('should not add <script> tag if STRING already has it', () => {
      const input = '<script>foo</script>'
      const result = h.generateScriptTags(input)
      expect(result).toEqual(`${input}\n`)
    })
    test('should add <script> tag if STRING does not have it', () => {
      const input = 'foo'
      const result = h.generateScriptTags(input)
      expect(result).toEqual(`<script type="text/javascript">\n${input}\n</script>\n`)
    })
    test('should add <script> tag if OBJ does not have it', () => {
      const input = { code: 'foo' }
      const result = h.generateScriptTags(input)
      expect(result).toEqual(`<script type="text/javascript">\nfoo\n</script>\n`)
    })
    test('should not add <script> tag if OBJ does have it', () => {
      const input = { code: '<script>foo</script>' }
      const result = h.generateScriptTags(input)
      expect(result).toEqual('<script>foo</script>\n')
    })
    test('should add <script type="xxx"> tag if OBJ does have it', () => {
      const input = { code: 'foo', type: 'bar' }
      const result = h.generateScriptTags(input)
      expect(result).toEqual('<script type="bar">\nfoo\n</script>\n')
    })
    test('should add multiple mixed types', () => {
      const input = [{ code: 'foo', type: 'bar' }, 'foo']
      const result = h.generateScriptTags(input)
      expect(result).toEqual(`<script type="bar">\nfoo\n</script>\n\n<script type="text/javascript">\nfoo\n</script>\n`)
    })
  })

  /*
   * pruneTheme()
   */
  describe('pruneTheme()' /* function */, () => {
    test('should do nothing if nothing to trim (empty)', () => {
      const orig = {}
      const expected = null
      const result = h.pruneTheme(orig)
      expect(result).toEqual(expected)
    })
    test('should do nothing if nothing to trim 2', () => {
      const orig = { foo: 'bar' }
      const expected = {}
      const result = h.pruneTheme(orig)
      expect(result).toEqual(orig)
    })
    test('should trim a top level item', () => {
      const orig = { __orderedStyles: ['title-mark1', 'title-mark2'] }
      const expected = null
      const result = h.pruneTheme(orig)
      expect(result).toEqual(expected)
    })
    test('should trim a top level item but leave others', () => {
      const orig = { __orderedStyles: ['title-mark1', 'title-mark2'], name: 'foo' }
      const expected = { name: 'foo' }
      const result = h.pruneTheme(orig)
      expect(result).toEqual(expected)
    })
    test('should remove properties inside of a style', () => {
      const orig = {
        styles: {
          'NoteLinks-main-cancelled': {
            font: 'noteplanstate',
            isRevealOnCursorRange: true,
            isMarkdownCharacter: true,
            matchPosition: 1,
            regex: '\\h(-\\[\\[)(.*?)(\\]\\])',
            color: '#C5487A',
          },
        },
      }
      const expected = {
        styles: {
          'NoteLinks-main-cancelled': {
            font: 'noteplanstate',
            color: '#C5487A',
          },
        },
      }
      const result = h.pruneTheme(orig)
      expect(result).toEqual(expected)
    })
    test('should remove property that has empty value', () => {
      const orig = {
        styles: {
          'NoteLinks-main-cancelled': {
            foo: '',
            font: 'noteplanstate',
            isRevealOnCursorRange: true,
            isMarkdownCharacter: true,
            matchPosition: 1,
            regex: '\\h(-\\[\\[)(.*?)(\\]\\])',
            color: '#C5487A',
          },
        },
      }
      const expected = {
        styles: {
          'NoteLinks-main-cancelled': {
            font: 'noteplanstate',
            color: '#C5487A',
          },
        },
      }
      const result = h.pruneTheme(orig)
      expect(result).toEqual(expected)
    })
    test('should remove properties inside of a style', () => {
      const orig = {
        __orderedStyles: ['title-mark1', 'title-mark2'],
        styles: {
          'NoteLinks-main-cancelled': {
            font: 'noteplanstate',
            isRevealOnCursorRange: true,
            isMarkdownCharacter: true,
            matchPosition: 1,
            regex: '\\h(-\\[\\[)(.*?)(\\]\\])',
            color: '#C5487A',
          },
        },
      }
      const expected = {
        styles: {
          'NoteLinks-main-cancelled': {
            font: 'noteplanstate',
            color: '#C5487A',
          },
        },
      }
      const result = h.pruneTheme(orig)
      expect(result).toEqual(expected)
    })
    test('should remove empty objects after removing all props', () => {
      const orig = {
        styles: {
          'NoteLinks-main-cancelled': {
            isRevealOnCursorRange: true,
            isMarkdownCharacter: true,
            matchPosition: 1,
            regex: '\\h(-\\[\\[)(.*?)(\\]\\])',
          },
        },
      }
      const expected = null
      const result = h.pruneTheme(orig)
      expect(result).toEqual(expected)
    })
  })
})

/*
 * replaceMarkdownLinkWithHTMLLink()
 */
describe('replaceMarkdownLinkWithHTMLLink()' /* function */, () => {
  test('should not do anything if no url', () => {
    const orig = 'foo bar'
    const result = h.replaceMarkdownLinkWithHTMLLink(orig)
    expect(result).toEqual(orig)
  })
  test('should replace a url', () => {
    const orig = 'foo [link](http://) bar'
    const result = h.replaceMarkdownLinkWithHTMLLink(orig)
    const expected = 'foo <a href="http://">link</a> bar'
    expect(result).toEqual(expected)
  })
  test('should replace > 1 url', () => {
    const orig = 'foo [link](http://) bar [link2](http://) baz [link3](noteplan://)'
    const result = h.replaceMarkdownLinkWithHTMLLink(orig)
    const expected = 'foo <a href="http://">link</a> bar <a href="http://">link2</a> baz <a href="noteplan://">link3</a>'
    expect(result).toEqual(expected)
  })
})
