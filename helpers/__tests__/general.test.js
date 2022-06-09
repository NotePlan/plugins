/* globals describe, expect, test, DataStore, afterAll */
import * as g from '../general'

import colors from 'chalk'
import * as c from '../config'

const FILE = `${colors.yellow('helpers/general')}`
const section = colors.blue

describe(`${FILE}`, () => {
  describe(section('createLink()'), () => {
    test('should create a link with a heading', () => {
      expect(g.createLink('foo', 'bar')).toEqual('[[foo#bar]]')
    })
    test('should create a link if heading is missing', () => {
      expect(g.createLink('foo')).toEqual('[[foo]]')
    })
    test('should create a link with heading passed as null', () => {
      expect(g.createLink('foo', null)).toEqual('[[foo]]')
    })
    test('should create a link with heading passed as empty string', () => {
      expect(g.createLink('foo', '')).toEqual('[[foo]]')
    })
  })
  describe(section('createOpenNoteCallbackUrl()'), () => {
    describe('using noteTitle', () => {
      test('should create a link with a heading', () => {
        expect(g.createOpenNoteCallbackUrl('foo', 'title', 'bar')).toEqual('noteplan://x-callback-url/openNote?noteTitle=foo#bar')
      })
      test('should create a link if heading is missing', () => {
        expect(g.createOpenNoteCallbackUrl('foo')).toEqual('noteplan://x-callback-url/openNote?noteTitle=foo')
      })
      test('should create a link with heading passed as null', () => {
        expect(g.createOpenNoteCallbackUrl('foo', 'title', null)).toEqual('noteplan://x-callback-url/openNote?noteTitle=foo')
      })
      test('should create a link with heading passed as empty string', () => {
        expect(g.createOpenNoteCallbackUrl('foo', 'title', '')).toEqual('noteplan://x-callback-url/openNote?noteTitle=foo')
      })
    })
    describe('using note filename', () => {
      // Note the following is the proper test for how it should work for filename with a heading
      // re-enable this test when @eduard fixes API bug
      // should also add a test for a filename with parentheses
      test('should create a link with filename with parentheses', () => {
        expect(g.createOpenNoteCallbackUrl('foo/bar(xx)', 'filename', 'bar')).toEqual('noteplan://x-callback-url/openNote?filename=foo%2Fbar%28xx%29')
      })
      test('should create a urlencoded link for spaces', () => {
        expect(g.createOpenNoteCallbackUrl('foo bar', 'filename', 'bar')).toEqual('noteplan://x-callback-url/openNote?filename=foo%20bar')
      })
      test.skip('should create a link with a heading', () => {
        expect(g.createOpenNoteCallbackUrl('foo', 'filename', 'bar')).toEqual('noteplan://x-callback-url/openNote?filename=foo#bar')
      })
      test('should create a link stripping the heading for the API bug workaround', () => {
        expect(g.createOpenNoteCallbackUrl('foo', 'filename', 'bar')).toEqual('noteplan://x-callback-url/openNote?filename=foo')
      })
    })
    describe('using date', () => {
      test('should create a link stripping the heading for the API bug workaround', () => {
        expect(g.createOpenNoteCallbackUrl('yesterday', 'date')).toEqual('noteplan://x-callback-url/openNote?noteDate=yesterday')
      })
    })
    describe('using openTypes', () => {
      test('should create a link in a floating window', () => {
        const res = g.createOpenNoteCallbackUrl('foo', 'filename', 'bar', 'subWindow')
        expect(res).toEqual('noteplan://x-callback-url/openNote?filename=foo&subWindow=yes')
      })
      test('should create a link in an existing floating window', () => {
        const res = g.createOpenNoteCallbackUrl('foo', 'filename', 'bar', 'useExistingSubWindow')
        expect(res).toEqual('noteplan://x-callback-url/openNote?filename=foo&useExistingSubWindow=yes')
      })
      test('should create a link in split view', () => {
        const res = g.createOpenNoteCallbackUrl('foo', 'filename', 'bar', 'splitView')
        expect(res).toEqual('noteplan://x-callback-url/openNote?filename=foo&splitView=yes')
      })
      test('should ignore illegal openType', () => {
        const res = g.createOpenNoteCallbackUrl('foo', 'filename', 'bar', 'baz')
        expect(res).toEqual('noteplan://x-callback-url/openNote?filename=foo')
      })
    })
  })

  describe(section(`createRunPluginCallbackUrl`), () => {
    test('should create a link with a heading', () => {
      const expected = 'noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.DataQuerying&command=runSearch&arg0=New%20Note%20-%2043.9400'
      expect(g.createRunPluginCallbackUrl(`dwertheimer.DataQuerying`, `runSearch`, [`New Note - 43.9400`])).toEqual(expected)
    })
  })

  describe(section(`createAddTextCallbackUrl`), () => {
    test('should create an addText URL for a note', () => {
      const opts = { text: 'bar', mode: 'prepend', openNote: 'yes' }
      const exp = 'noteplan://x-callback-url/addText?filename=foof&mode=prepend&text=bar&openNote=yes'
      expect(g.createAddTextCallbackUrl({ filename: 'foof' }, opts)).toEqual(exp)
    })
    test('should create an addText URL for a string (date string)', () => {
      const opts = { text: 'bar', mode: 'prepend', openNote: 'yes' }
      const exp = 'noteplan://x-callback-url/addText?noteDate=today&mode=prepend&text=bar&openNote=yes'
      expect(g.createAddTextCallbackUrl('today', opts)).toEqual(exp)
    })
  })

  describe(section('createPrettyOpenNoteLink()'), () => {
    describe('using noteTitle', () => {
      const xcb = `noteplan://x-callback-url/openNote?noteTitle=`
      test('should create a link with a heading', () => {
        expect(g.createPrettyOpenNoteLink('baz', 'foo', false, 'bar')).toEqual(`[baz](${xcb}foo#bar)`)
      })
      test('should create a link if heading is missing', () => {
        expect(g.createPrettyOpenNoteLink('baz', 'foo')).toEqual(`[baz](${xcb}foo)`)
      })
      test('should create a link with heading passed as null', () => {
        expect(g.createPrettyOpenNoteLink('baz', 'foo', false, null)).toEqual(`[baz](${xcb}foo)`)
      })
    })
    describe('using note filename', () => {
      // Note the following is the proper test for how it should work for filename with a heading
      // re-enable this test when @eduard fixes API bug

      test.skip('should create a link with a heading', () => {
        expect(g.createPrettyOpenNoteLink('baz', 'foo', true, 'bar')).toEqual('[baz](noteplan://x-callback-url/openNote?filename=foo#bar)')
      })
    })
    describe(section('stripLinkFromString()'), () => {
      describe('using internal wikilinks', () => {
        test('should strip a link from a string', () => {
          expect(g.stripLinkFromString('foo [[bar]] baz')).toEqual('foo baz')
        })
        test('should strip a link from a string with a heading', () => {
          expect(g.stripLinkFromString('foo [[bar#heading]] baz')).toEqual('foo baz')
        })
        test('should strip a link from a string with a heading and trailing text', () => {
          expect(g.stripLinkFromString('foo [[bar#heading]] baz quux')).toEqual('foo baz quux')
        })
        test('should strip a link from a string with a heading and trailing text and multiple links', () => {
          expect(g.stripLinkFromString('foo [[bar#heading]] baz [[quux]] quux')).toEqual('foo baz quux')
        })
        test('should strip a link from a string with a heading and trailing text and multiple links and multiple headings', () => {
          expect(g.stripLinkFromString('foo [[bar#heading]] baz [[quux#heading]] quux')).toEqual('foo baz quux')
        })
        test('should strip a link from a string with a heading and trailing text and multiple links and multiple headings and multiple links', () => {
          expect(g.stripLinkFromString('foo [[bar#heading]] baz [[quux#heading]] quux [[foo#heading]]')).toEqual('foo baz quux')
        })
        test('should strip a link from a string with a heading and trailing text and multiple links and multiple headings and multiple links and multiple headings', () => {
          expect(g.stripLinkFromString('foo [[bar#heading]] baz [[quux#heading]] quux [[foo#heading]] [[bar#heading]]')).toEqual('foo baz quux')
        })
      })
      describe('using full urls', () => {
        test('should strip a link from a string', () => {
          expect(g.stripLinkFromString('foo [bar](http://www.google.com) baz')).toEqual('foo baz')
        })
        test('should strip a link from a string with a heading', () => {
          expect(g.stripLinkFromString('foo [bar](http://www.google.com#heading) baz')).toEqual('foo baz')
        })
        test('should strip a link from a string with a heading and trailing text', () => {
          expect(g.stripLinkFromString('foo [bar](http://www.google.com#heading) baz quux')).toEqual('foo baz quux')
        })
        test('should strip a link from a string with a heading and trailing text and multiple links', () => {
          expect(g.stripLinkFromString('foo [bar](http://www.google.com#heading) baz [bar](http://www.google.com#heading) quux')).toEqual('foo baz quux')
        })
        test('should strip a link from a string with a heading and trailing text and multiple links and multiple headings', () => {
          expect(g.stripLinkFromString('foo [bar](http://www.google.com#heading) baz [bar](http://www.google.com#heading) quux')).toEqual('foo baz quux')
        })
        test('should strip a link from a string with a heading and trailing text and multiple links and multiple headings and multiple links', () => {
          expect(g.stripLinkFromString('foo [bar](http://www.google.com#heading) baz [bar](http://www.google.com#heading) quux [bar](http://www.google.com#heading)')).toEqual(
            'foo baz quux',
          )
        })
        test('should strip a link from a string with a heading and trailing text and multiple links and multiple headings and multiple links and multiple headings', () => {
          expect(
            g.stripLinkFromString(
              'foo [bar](http://www.google.com#heading) baz [bar](http://www.google.com#heading) quux [bar](http://www.google.com#heading) [bar](http://www.google.com#heading)',
            ),
          ).toEqual('foo baz quux')
        })
      })
    })
  })
})
