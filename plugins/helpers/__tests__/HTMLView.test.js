/* global describe, expect, test, beforeAll */

import colors from 'chalk'
import * as h from '../HTMLView'
import * as n from '../NPThemeToCSS'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, /*Note, Paragraph*/ } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'DEBUG' //change this to DEBUG to get more logging
})

// import { clo, logDebug, logError, logWarn } from '@helpers/dev'

const FILE = `${colors.yellow('helpers/NPSyncedCopies')}`

describe(`${FILE}`, () => {
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
      // const expected = {}
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

/*
 * convertBoldAndItalicToHTML()
 */
describe('convertBoldAndItalicToHTML()' /* function */, () => {
  test('with no url or bold/italic', () => {
    const orig = 'foo bar and nothing else'
    const result = h.convertBoldAndItalicToHTML(orig)
    expect(result).toEqual(orig)
  })
  test('with url', () => {
    const orig = 'Has a URL [NP Help](http://help.noteplan.co/) and nothing else'
    const result = h.convertBoldAndItalicToHTML(orig)
    expect(result).toEqual(orig)
  })
  test('with bold-italic and bold', () => {
    const orig = 'foo **bar** and ***nothing else*** ok?'
    const result = h.convertBoldAndItalicToHTML(orig)
    const expected = 'foo <b>bar</b> and <b><em>nothing else</em></b> ok?'
    expect(result).toEqual(expected)
  })
  test('with bold', () => {
    const orig = 'foo **bar** and __nothing else__ ok?'
    const result = h.convertBoldAndItalicToHTML(orig)
    const expected = 'foo <b>bar</b> and <b>nothing else</b> ok?'
    expect(result).toEqual(expected)
  })
  test('with bold and some in a URL', () => {
    const orig = 'foo **bar** and http://help.noteplan.co/something/this__and__that a more complex URL'
    const result = h.convertBoldAndItalicToHTML(orig)
    const expected = 'foo <b>bar</b> and http://help.noteplan.co/something/this__and__that a more complex URL'
    expect(result).toEqual(expected)
  })
  test('with bold and some in a URL', () => {
    const orig = 'foo **bar** and http://help.noteplan.co/something/this__end with a later__ to ignore'
    const result = h.convertBoldAndItalicToHTML(orig)
    const expected = 'foo <b>bar</b> and http://help.noteplan.co/something/this__end with a later__ to ignore'
    expect(result).toEqual(expected)
  })

  test('with italic', () => {
    const orig = 'foo *bar* and _nothing else_ ok?'
    const result = h.convertBoldAndItalicToHTML(orig)
    const expected = 'foo <em>bar</em> and <em>nothing else</em> ok?'
    expect(result).toEqual(expected)
  })
  test('with italic and some in a URL', () => {
    const orig = 'foo *bar* and http://help.noteplan.co/something/this_and_that a more complex URL'
    const result = h.convertBoldAndItalicToHTML(orig)
    const expected = 'foo <em>bar</em> and http://help.noteplan.co/something/this_and_that a more complex URL'
    expect(result).toEqual(expected)
  })
  test('with italic and some in a URL', () => {
    const orig = 'foo *bar* and http://help.noteplan.co/something/this_end with a later_ to ignore'
    const result = h.convertBoldAndItalicToHTML(orig)
    const expected = 'foo <em>bar</em> and http://help.noteplan.co/something/this_end with a later_ to ignore'
    expect(result).toEqual(expected)
  })
})
