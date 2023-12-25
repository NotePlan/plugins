/* globals describe, expect, test */
import colors from 'chalk'
import * as g from '../general'

const FILE = `${colors.yellow('helpers/general')}`
const section = colors.blue

describe(`${FILE}`, () => {
  describe(section('class CaseInsensitiveMap'), () => {
    // Set up some data
    const ciCounts = new g.CaseInsensitiveMap() // < number >
    ciCounts.set('tesTING', 1) // this first example of capitalization should be kept
    ciCounts.set('testing', 2)
    ciCounts.set('TESTING', 3)
    ciCounts.set('BOB', 10) // this first example of capitalization should be kept
    ciCounts.set('bob', 4)

    // Simple test to make sure correct values are returned
    test('ciCounts map for "TESTING" -> 3', () => {
      expect(ciCounts.get('TESTING')).toEqual(3)
    })
    test('ciCounts map for "bob" -> 4', () => {
      expect(ciCounts.get('bob')).toEqual(4)
    })

    // More complex tests to make sure correct keys are returned
    const kvArray = []
    for (const [key, value] of ciCounts.entries()) {
      kvArray.push(`${key}:${value}`)
    }
    test('ciCounts map for "TESTING" -> "tesTING:3"', () => {
      expect(kvArray[0]).toEqual('tesTING:3')
    })
    test('ciCounts map for "BOB" -> "BOB:4"', () => {
      expect(kvArray[1]).toEqual('BOB:4')
    })
  })

  describe(section('returnNoteLink()'), () => {
    test('should create a link with a heading', () => {
      expect(g.returnNoteLink('foo', 'bar')).toEqual('[[foo#bar]]')
    })
    test('should create a link if heading is missing', () => {
      expect(g.returnNoteLink('foo')).toEqual('[[foo]]')
    })
    test('should create a link with heading passed as null', () => {
      expect(g.returnNoteLink('foo', null)).toEqual('[[foo]]')
    })
    test('should create a link with heading passed as empty string', () => {
      expect(g.returnNoteLink('foo', '')).toEqual('[[foo]]')
    })
  })
  describe(section('createOpenOrDeleteNoteCallbackUrl()'), () => {
    describe('using noteTitle', () => {
      test('should create a link with a heading', () => {
        expect(g.createOpenOrDeleteNoteCallbackUrl('foo', 'title', 'bar')).toEqual('noteplan://x-callback-url/openNote?noteTitle=foo%23bar')
      })
      test('should create a link with a heading and a hashtag in the heading', () => {
        expect(g.createOpenOrDeleteNoteCallbackUrl('TEST Headings', 'title', 'DoSome#HealthyHabits')).toEqual(
          'noteplan://x-callback-url/openNote?noteTitle=TEST%20Headings%23DoSomeHealthyHabits',
        )
      })
      test('should create a link with a heading with parens in it', () => {
        expect(g.createOpenOrDeleteNoteCallbackUrl('TEST Headings', 'title', 'title (with parens)')).toEqual(
          'noteplan://x-callback-url/openNote?noteTitle=TEST%20Headings%23title%20%28with%20parens%29',
        )
      })
      test('should create a link if heading is missing', () => {
        expect(g.createOpenOrDeleteNoteCallbackUrl('foo')).toEqual('noteplan://x-callback-url/openNote?noteTitle=foo')
      })
      test('should create a link with heading passed as null', () => {
        expect(g.createOpenOrDeleteNoteCallbackUrl('foo', 'title', null)).toEqual('noteplan://x-callback-url/openNote?noteTitle=foo')
      })
      test('should create a link with heading passed as empty string', () => {
        expect(g.createOpenOrDeleteNoteCallbackUrl('foo', 'title', '')).toEqual('noteplan://x-callback-url/openNote?noteTitle=foo')
      })
    })
    describe('using note filename', () => {
      // Note the following is the proper test for how it should work for filename with a heading
      // re-enable this test when @eduard fixes API bug
      // should also add a test for a filename with parentheses
      test('should create a link with filename with parentheses', () => {
        expect(g.createOpenOrDeleteNoteCallbackUrl('foo/bar(xx)', 'filename')).toEqual('noteplan://x-callback-url/openNote?filename=foo%2Fbar%28xx%29')
      })
      test('should create a urlencoded link for spaces', () => {
        expect(g.createOpenOrDeleteNoteCallbackUrl('foo bar', 'filename')).toEqual('noteplan://x-callback-url/openNote?filename=foo%20bar')
      })
      test('should create a link with a heading', () => {
        expect(g.createOpenOrDeleteNoteCallbackUrl('foo', 'filename', 'bar')).toEqual('noteplan://x-callback-url/openNote?filename=foo&heading=bar')
      })
      test('should create a link with a heading', () => {
        expect(g.createOpenOrDeleteNoteCallbackUrl('foo', 'filename', 'bar')).toEqual('noteplan://x-callback-url/openNote?filename=foo&heading=bar')
      })
    })
    describe('using date', () => {
      test('should create a link stripping the heading for the API bug workaround', () => {
        expect(g.createOpenOrDeleteNoteCallbackUrl('yesterday', 'date')).toEqual('noteplan://x-callback-url/openNote?noteDate=yesterday')
      })
    })
    describe('using openTypes', () => {
      test('should create a link in a floating window', () => {
        const res = g.createOpenOrDeleteNoteCallbackUrl('foo', 'filename', 'bar', 'subWindow')
        expect(res).toEqual('noteplan://x-callback-url/openNote?filename=foo&heading=bar&subWindow=yes')
      })
      test('should create a link in an existing floating window', () => {
        const res = g.createOpenOrDeleteNoteCallbackUrl('foo', 'filename', '', 'useExistingSubWindow')
        expect(res).toEqual('noteplan://x-callback-url/openNote?filename=foo&useExistingSubWindow=yes')
      })
      test('should create a link in split view', () => {
        const res = g.createOpenOrDeleteNoteCallbackUrl('foo', 'filename', null, 'splitView')
        expect(res).toEqual('noteplan://x-callback-url/openNote?filename=foo&splitView=yes')
      })
      test('should ignore illegal openType', () => {
        const res = g.createOpenOrDeleteNoteCallbackUrl('foo', 'filename', '', 'baz')
        expect(res).toEqual('noteplan://x-callback-url/openNote?filename=foo')
      })
    })
    describe('using blockID (for line link)', () => {
      test('should create a link with a blockID and title', () => {
        const res = g.createOpenOrDeleteNoteCallbackUrl('foo', 'title', null, null, false, '^123456')
        expect(res).toEqual('noteplan://x-callback-url/openNote?noteTitle=foo%5E123456')
      })
      // blockid by filename is not supported by NotePlan yet
      test.skip('should create a link with a blockID and filename', () => {
        const res = g.createOpenOrDeleteNoteCallbackUrl('foo', 'filename', null, null, false, '^123456')
        expect(res).toEqual('noteplan://x-callback-url/openNote?filename=foo&blockID=%5E123456')
      })
    })
  })

  describe(section(`createRunPluginCallbackUrl`), () => {
    test('should create a link with 1 arg', () => {
      const expected = 'noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.DataQuerying&command=runSearch&arg0=New%20Note%20-%2043.9400'
      expect(g.createRunPluginCallbackUrl(`dwertheimer.DataQuerying`, `runSearch`, [`New Note - 43.9400`])).toEqual(expected)
    })
    test('should create a link with 2 args', () => {
      const expected = 'noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=saveSearch&arg0=search%20terms&arg1=Notes'
      expect(g.createRunPluginCallbackUrl(`jgclark.SearchExtensions`, `saveSearch`, ['search terms', 'Notes'])).toEqual(expected)
    })
    test('should create a link with 3 args passed as JSON string', () => {
      const expected =
        'noteplan://x-callback-url/runPlugin?pluginID=jgclark.Summaries&command=appendProgressUpdate&arg0=%7B%22excludeToday%22%3Afalse%2C%22progressHeading%22%3A%22Test%20Heading%22%2C%22progressYesNo%22%3A%22%23readbook%2C%23theology%22%7D'
      expect(
        g.createRunPluginCallbackUrl(`jgclark.Summaries`, `appendProgressUpdate`, `{"excludeToday":false,"progressHeading":"Test Heading","progressYesNo":"#readbook,#theology"}`),
      ).toEqual(expected)
    })
  })

  describe(section(`createAddTextCallbackUrl`), () => {
    test('should create an addText URL for a note', () => {
      const opts = { text: 'bar', mode: 'prepend', openNote: 'yes' }
      const exp = 'noteplan://x-callback-url/addText?filename=foof&mode=prepend&openNote=yes&text=bar'
      expect(g.createAddTextCallbackUrl({ filename: 'foof' }, opts)).toEqual(exp)
    })
    test('should create an addText URL for a string (date string)', () => {
      const opts = { text: 'bar', mode: 'prepend', openNote: 'yes' }
      const exp = 'noteplan://x-callback-url/addText?noteDate=today&mode=prepend&openNote=yes&text=bar'
      expect(g.createAddTextCallbackUrl('today', opts)).toEqual(exp)
    })
  })

  describe(section('createPrettyOpenNoteLink()'), () => {
    describe('using noteTitle', () => {
      const xcb = `noteplan://x-callback-url/openNote?noteTitle=`
      test('should create a link with a heading', () => {
        expect(g.createPrettyOpenNoteLink('baz', 'foo', false, 'bar')).toEqual(`[baz](${xcb}foo%23bar)`)
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

      test('should create a link with a heading', () => {
        expect(g.createPrettyOpenNoteLink('baz', 'foo', true, 'bar')).toEqual('[baz](noteplan://x-callback-url/openNote?filename=foo&heading=bar)')
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
    /*
     * createCallbackUrl()
     */
    describe('createCallbackUrl()' /* function */, () => {
      const base = 'noteplan://x-callback-url/'
      /* template:
      test('should XXX', () => {
        const spy = jest.spyOn(CommandBar, 'prompt')
        const result = g.createCallbackUrl()
        expect(result).toEqual(true)
	expect(spy).toHaveBeenCalledWith()
        spy.mockRestore()
      })
      */
      test('should create callback with no params', () => {
        const result = g.createCallbackUrl('text')
        expect(result).toEqual(`${base}text`)
      })
      test('should create callback with empty params', () => {
        const result = g.createCallbackUrl('text', {})
        expect(result).toEqual(`${base}text`)
      })
      test('should create callback with one param (urlencoded)', () => {
        const result = g.createCallbackUrl('text', { foo: 'bar baz' })
        expect(result).toEqual(`${base}text?foo=bar%20baz`)
      })
      test('should create callback with more than one param (urlencoded)', () => {
        const result = g.createCallbackUrl('text', { foo: 'bar baz', quux: 'quuz' })
        expect(result).toEqual(`${base}text?foo=bar%20baz&quux=quuz`)
      })
      test('should create urlencoded callback with more than one param passed as string', () => {
        const result = g.createCallbackUrl('text', `{"excludeToday":false,"progressHeading":"Test Heading","progressYesNo":"#readbook,#theology"}`)
        expect(result).toEqual(
          `${base}text?arg0=%7B%22excludeToday%22%3Afalse%2C%22progressHeading%22%3A%22Test%20Heading%22%2C%22progressYesNo%22%3A%22%23readbook%2C%23theology%22%7D`,
        )
      })
    })
    /*
     * forceLeadingSlash()
     */
    describe('forceLeadingSlash()' /* function */, () => {
      test("should force slash when there's not one", () => {
        const result = g.forceLeadingSlash('foo')
        expect(result).toEqual('/foo')
      })
      test("should force slash when there's not one", () => {
        const result = g.forceLeadingSlash('f/oo')
        expect(result).toEqual('/f/oo')
      })
      test('should not force slash if there is one', () => {
        const result = g.forceLeadingSlash('/foo')
        expect(result).toEqual('/foo')
      })
    })
    /*
     * inFolderList()
     */
    describe('inFolderList()' /* function */, () => {
      test('should work for case mismatch', () => {
        const filename = 'FOO/bar.md'
        const folderList = ['foo']
        const result = g.inFolderList(filename, folderList, false)
        expect(result).toEqual(true)
      })
      test('should work for lowercase', () => {
        const filename = 'FOO/bar.md'
        const folderList = ['foo']
        const result = g.inFolderList(filename, folderList, false)
        expect(result).toEqual(true)
      })
      test('should work for slashed filename', () => {
        const filename = '/FOO/bar.md'
        const folderList = ['foo']
        const result = g.inFolderList(filename, folderList, false)
        expect(result).toEqual(true)
      })
      test('same test should fail for case sensitive filename', () => {
        const filename = '/FOO/bar.md'
        const folderList = ['foo']
        const result = g.inFolderList(filename, folderList, true)
        expect(result).toEqual(false)
      })
      test('should work for full matches', () => {
        const filename = '_TEST/foo/bar.md'
        const folderList = ['_TEST']
        const result = g.inFolderList(filename, folderList, true)
        expect(result).toEqual(true)
      })
      test('should work for intermediate folder matches', () => {
        const filename = '_TEST/foo/bar.md'
        const folderList = ['foo']
        const result = g.inFolderList(filename, folderList, true)
        expect(result).toEqual(true)
      })
      test('should not be true for partial matches', () => {
        const filename = '_TEST/foo/bar.md'
        const folderList = ['TEST']
        const result = g.inFolderList(filename, folderList, true)
        expect(result).toEqual(false)
      })
      test('should work for root folder', () => {
        const filename = 'nofolder.md'
        const folderList = ['/']
        const result = g.inFolderList(filename, folderList, false)
        expect(result).toEqual(true)
      })
    })

    /*
     * formatWithFields()
     */
    describe('formatWithFields()' /* function */, () => {
      test('should not replace anything with empty object', () => {
        const template = `Sample {{foo}}`
        const result = g.formatWithFields(template, {})
        expect(result).toEqual(template)
      })
      test('should not replace anything with empty object', () => {
        const template = `Sample {{foo}}`
        const result = g.formatWithFields(template, { foo: 'bar' })
        expect(result).toEqual(`Sample bar`)
      })
      test('should replace multiple copies of the same string', () => {
        const template = `{{foo}} Sample {{foo}}`
        const result = g.formatWithFields(template, { foo: 'bar' })
        expect(result).toEqual(`bar Sample bar`)
      })
      test('should replace multiple strings', () => {
        const template = `{{sam}} Sample {{foo}}`
        const result = g.formatWithFields(template, { foo: 'bar', sam: 'baz' })
        expect(result).toEqual(`baz Sample bar`)
      })
      test('should work with a boolean replacement value (ignore it)', () => {
        const template = `{{sam}} Sample {{foo}}`
        const result = g.formatWithFields(template, { foo: 'bar', sam: 'baz', quux: true })
        expect(result).toEqual(`baz Sample bar`)
      })
      test('should work with a boolean template', () => {
        const template = true
        const result = g.formatWithFields(template, { foo: 'bar', sam: 'baz', quux: true })
        expect(result).toEqual(template)
      })
    })
  })

  /*
   * getTagParamsFromString()
   * NB: an async function
   */
  describe('getTagParamsFromString()' /* function */, () => {
    test('should error with empty paramString', async () => {
      const result = await g.getTagParamsFromString('', 'bob', 'default')
      expect(result).toEqual('default')
    })
    test('should error with empty wantedParam', async () => {
      const result = await g.getTagParamsFromString('bob', '', 'default')
      expect(result).toEqual('❗️error')
    })
    test('should return default', async () => {
      const result = await g.getTagParamsFromString('{}', 'uncle', 'default')
      expect(result).toEqual('default')
    })
    test('should return FOO (less strict JSON5)', async () => {
      const result = await g.getTagParamsFromString('{area:"FOO", template:"BAR"}', 'area', 'default')
      expect(result).toEqual('FOO')
    })
    test('should return FOO (strict JSON)', async () => {
      const result = await g.getTagParamsFromString('{"area":"FOO", "template":"BAR"}', 'area', 'default')
      expect(result).toEqual('FOO')
    })
    test('should return BAR (strict JSON)', async () => {
      const result = await g.getTagParamsFromString('{"area":"FOO", "template":"BAR"}', 'template', 'default')
      expect(result).toEqual('BAR')
    })
    test('should return 42.15 (less strict JSON5)', async () => {
      const result = await g.getTagParamsFromString('{area:42.15, template:"BAR",}', 'area', 'default')
      expect(result).toEqual(42.15)
    })
    test('should return NaN (requires less strict JSON5)', async () => {
      const result = await g.getTagParamsFromString('{area:NaN, template:"BAR",}', 'area', 'default')
      expect(result).toEqual(NaN)
    })
  })
})
