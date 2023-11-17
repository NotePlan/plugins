/* globals describe, expect, test */

// Last updated: 2.2.2023 by @jgclark

import colors from 'chalk'
import * as st from '../stringTransforms'

// TODO: Get following working if its important:
// import { DataStore /*, Note, Paragraph */ } from '@mocks/index'

// beforeAll(() => {
//   // global.Calendar = Calendar
//   // global.Clipboard = Clipboard
//   // global.CommandBar = CommandBar
//   global.DataStore = DataStore
//   // global.Editor = Editor
//   // global.NotePlan = NotePlan
//   DataStore.settings['_logLevel'] = 'DEBUG' //change this to DEBUG to get more logging
// })

const PLUGIN_NAME = `📙 ${colors.yellow('helpers/dateManipulation')}`
// const section = colors.blue

describe(`${PLUGIN_NAME}`, () => {
  /*
   * changeMarkdownLinksToHTMLLink()
   */
  describe('changeMarkdownLinksToHTMLLink()' /* function */, () => {
    test('should be empty from empty', () => {
      const result = st.changeMarkdownLinksToHTMLLink('')
      expect(result).toEqual('')
    })
    test('should be no change if no link found', () => {
      const input = 'this has [text] and (brackets) but not a valid link'
      const result = st.changeMarkdownLinksToHTMLLink(input)
      expect(result).toEqual(input)
    })
    test('should produce HTML link 1 without icon', () => {
      const input = 'this has [text](brackets) with a valid link'
      const result = st.changeMarkdownLinksToHTMLLink(input, false)
      expect(result).toEqual('this has <a class="externalLink" href="brackets">text</a> with a valid link')
    })
    test('should produce HTML link 1 with icon', () => {
      const input = 'this has [text](brackets) with a valid link'
      const result = st.changeMarkdownLinksToHTMLLink(input)
      expect(result).toEqual('this has <a class="externalLink" href="brackets"><i class="fa-regular fa-globe pad-right"></i>text</a> with a valid link')
    })
    test('should produce HTML link 2', () => {
      const input = 'this has [title with spaces](https://www.something.com/with?various&chars%20ok) with a valid link'
      const result = st.changeMarkdownLinksToHTMLLink(input)
      expect(result).toEqual('this has <a class="externalLink" href="https://www.something.com/with?various&chars%20ok"><i class="fa-regular fa-globe pad-right"></i>title with spaces</a> with a valid link')
    })
  })

  /**
   * changeBareLinksToHTMLLink()
   */
  describe('changeBareLinksToHTMLLink()' /* function */, () => {
    test('should be empty from empty', () => {
      const result = st.changeBareLinksToHTMLLink('')
      expect(result).toEqual('')
    })
    test('should be no change if no link found', () => {
      const input = 'this has https a www.domain.com but not together'
      const result = st.changeBareLinksToHTMLLink(input)
      expect(result).toEqual(input)
    })
    test('should not produce HTML link from MD link', () => {
      const input = 'this has [a valid MD link](https://www.something.com/with?various&chars%20ok)'
      const result = st.changeBareLinksToHTMLLink(input)
      expect(result).toEqual('this has [a valid MD link](https://www.something.com/with?various&chars%20ok)')
    })
    test('should produce HTML link 1 with icon and no truncation', () => {
      const input = 'this has a https://www.something.com/with?various&chars%20ok/~/and/yet/more/things-to-make-it-really-quite-long valid bare link'
      const result = st.changeBareLinksToHTMLLink(input, true, false)
      expect(result).toEqual(
        'this has a <a class="externalLink" href="https://www.something.com/with?various&chars%20ok/~/and/yet/more/things-to-make-it-really-quite-long"><i class="fa-regular fa-globe pad-right"></i>https://www.something.com/with?various&chars%20ok/~/and/yet/more/things-to-make-it-really-quite-long</a> valid bare link')
    })
    test('should produce HTML link 1 with icon and truncation', () => {
      const input = 'this has a https://www.something.com/with?various&chars%20ok/~/and/yet/more/things-to-make-it-really-quite-long valid bare link'
      const result = st.changeBareLinksToHTMLLink(input, true, true)
      expect(result).toEqual(
        'this has a <a class="externalLink" href="https://www.something.com/with?various&chars%20ok/~/and/yet/more/things-to-make-it-really-quite-long"><i class="fa-regular fa-globe pad-right"></i>https://www.something.com/with?various&chars%20ok/...</a> valid bare link')
    })
    test('should produce HTML link 1 without icon', () => {
      const input = 'this has a https://www.something.com/with?various&chars%20ok valid bare link'
      const result = st.changeBareLinksToHTMLLink(input, false, false)
      expect(result).toEqual(
        'this has a <a class="externalLink" href="https://www.something.com/with?various&chars%20ok">https://www.something.com/with?various&chars%20ok</a> valid bare link')
    })
    test('should produce HTML link when a link takes up the whole line', () => {
      const input = 'https://www.something.com/with?various&chars%20ok'
      const result = st.changeBareLinksToHTMLLink(input, true, false)
      expect(result).toEqual('<a class="externalLink" href="https://www.something.com/with?various&chars%20ok"><i class="fa-regular fa-globe pad-right"></i>https://www.something.com/with?various&chars%20ok</a>')
    })
    test('should produce HTML link when a link takes up the whole line', () => {
      const input = 'https://www.something.com/with?various&chars%20ok'
      const result = st.changeBareLinksToHTMLLink(input, true, false)
      expect(result).toEqual('<a class="externalLink" href="https://www.something.com/with?various&chars%20ok"><i class="fa-regular fa-globe pad-right"></i>https://www.something.com/with?various&chars%20ok</a>')
    })
  })

  /*
   * stripBackwardsDateRefsFromString()
   */
  describe('stripBackwardsDateRefsFromString()' /* function */, () => {
    test('should be empty from empty', () => {
      const result = st.stripBackwardsDateRefsFromString('')
      expect(result).toEqual('')
    })
    test('should be no change if no date found', () => {
      const input = '- this has a bare ISO date 2023-02-02 to leave alone'
      const result = st.stripBackwardsDateRefsFromString(input)
      expect(result).toEqual(input)
    })
    test('should strip 1 back date', () => {
      const input = '- this has one back date <2023-02-02 OK?'
      const result = st.stripBackwardsDateRefsFromString(input)
      expect(result).toEqual('- this has one back date OK?')
    })
    test('should strip 2 back dates', () => {
      const input = '- this has two <2022-12-15 back dates <2023-02-02 OK?'
      const result = st.stripBackwardsDateRefsFromString(input)
      expect(result).toEqual('- this has two back dates OK?')
    })
  })

  /*
   * stripWikiLinksFromString()
   */
  describe('stripWikiLinksFromString()' /* function */, () => {
    test('should be empty from empty', () => {
      const result = st.stripWikiLinksFromString('')
      expect(result).toEqual('')
    })
    test('should be no change if no wikilinks found', () => {
      const input = '- this has a bare ISO date 2023-02-02 to leave alone'
      const result = st.stripWikiLinksFromString(input)
      expect(result).toEqual(input)
    })
    test('should strip 1 wikilink', () => {
      const input = '- this has [[one title link]] ok?'
      const result = st.stripWikiLinksFromString(input)
      expect(result).toEqual('- this has one title link ok?')
    })
    test('should strip 2 wikilink', () => {
      const input = '- this has [[one title link]] and [[another one with#heading item]] ok?'
      const result = st.stripWikiLinksFromString(input)
      expect(result).toEqual('- this has one title link and another one with#heading item ok?')
    })
  })

  /*
   * stripBlockIDsFromString()
   */
  describe('stripBlockIDsFromString()' /* function */, () => {
    test('should be empty from empty', () => {
      const result = st.stripBlockIDsFromString('')
      expect(result).toEqual('')
    })
    test('should be no change if no blockIDs found', () => {
      const input = '- this has no blockID 2023-02-02 leaves alones'
      const result = st.stripBlockIDsFromString(input)
      expect(result).toEqual(input)
    })
    test('should strip 1 blockID', () => {
      const input = '- this has one ^123def blockID'
      const result = st.stripBlockIDsFromString(input)
      expect(result).toEqual('- this has one blockID')
    })
    test('should strip 2 blockIDs', () => {
      const input = '- this has two ^123def blockIDs for some reason ^abc890'
      const result = st.stripBlockIDsFromString(input)
      expect(result).toEqual('- this has two blockIDs for some reason')
    })
    test('should not strip an invalid blockID', () => {
      const input = '- this has one ^123defa invalid blockID'
      const result = st.stripBlockIDsFromString(input)
      expect(result).toEqual('- this has one ^123defa invalid blockID')
    })

    /*
     * stripDateRefsFromString()
     */
    describe('stripDateRefsFromString()' /* function */, () => {
      test('should not strip anything', () => {
        const before = 'this has no date refs'
        const expected = before
        const result = st.stripDateRefsFromString(before)
        expect(result).toEqual(expected)
      })
      test('should strip a day', () => {
        const before = 'test >2022-01-01'
        const expected = `test`
        const result = st.stripDateRefsFromString(before)
        expect(result).toEqual(expected)
      })
      test('should strip a backwards date', () => {
        const before = 'test <2022-Q2'
        const expected = `test`
        const result = st.stripDateRefsFromString(before)
        expect(result).toEqual(expected)
      })
      test('should strip a week', () => {
        const before = 'test >2022-01 foo'
        const expected = `test foo`
        const result = st.stripDateRefsFromString(before)
        expect(result).toEqual(expected)
      })
      test('should strip a year', () => {
        const before = 'test >2022 foo'
        const expected = `test foo`
        const result = st.stripDateRefsFromString(before)
        expect(result).toEqual(expected)
      })
      test('should strip a quarter', () => {
        const before = 'test >2022-Q2'
        const expected = `test`
        const result = st.stripDateRefsFromString(before)
        expect(result).toEqual(expected)
      })
      test('should strip multiples', () => {
        const before = 'baz >2022-01 >2022-Q1 test >2022-Q2 foo >2022 >2022-01-01'
        const expected = `baz test foo`
        const result = st.stripDateRefsFromString(before)
        expect(result).toEqual(expected)
      })
    })

    /*
     * stripLinksFromString()
     */
    describe('stripLinksFromString()' /* function */, () => {
      test('should not strip anything', () => {
        const input = 'this has no links'
        const expected = input
        const result = st.stripLinksFromString(input)
        expect(result).toEqual(expected)
      })
      test('should strip a markdown link and leave the text', () => {
        const input = 'has a [link](https://example.com)'
        const expected = `has a [link]`
        const result = st.stripLinksFromString(input)
        expect(result).toEqual(expected)
      })
      test('should strip a markdown link and remove the text', () => {
        const input = 'has a [link](https://example.com)'
        const expected = `has a`
        const result = st.stripLinksFromString(input, false)
        expect(result).toEqual(expected)
      })
      test('should strip a bare link', () => {
        const input = 'bare link https://example.com'
        const expected = `bare link`
        const result = st.stripLinksFromString(input)
        expect(result).toEqual(expected)
      })
      test('should strip a np link', () => {
        const input = 'np noteplan://example.com'
        const expected = `np`
        const result = st.stripLinksFromString(input)
        expect(result).toEqual(expected)
      })
    })

    /*
     * encodeRFC3986URIComponent()
     */
    describe('encodeRFC3986URIComponent()', () => {
      test('empty -> empty', () => {
        const input = ''
        const expected = ''
        const result = st.encodeRFC3986URIComponent(input)
        expect(result).toEqual(expected)
      })
      test('should not change A-z 0-9 - _ . ~', () => {
        const input = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~'
        const expected = input
        const result = st.encodeRFC3986URIComponent(input)
        expect(result).toEqual(expected)
      })
      test('should encode standard punctuation', () => {
        const input = '"#%&*+,/:;<=>?@\\^`{|}'
        const expected = '%22%23%25%26%2A%2B%2C%2F%3A%3B%3C%3D%3E%3F%40%5C%5E%60%7B%7C%7D'
        const result = st.encodeRFC3986URIComponent(input)
        expect(result).toEqual(expected)
      })
      test('should encode additional punctuation', () => {
        const input = '!()[]*\''
        const expected = '%21%28%29%5B%5D%2A%27'
        const result = st.encodeRFC3986URIComponent(input)
        expect(result).toEqual(expected)
      })
      test('should deal with innerHTML partial encoding of &amp;', () => {
        const input = ' &amp; %26amp%3B &amp%3B %26amp; &amp; '
        const expected = '%20%26%20%26%20%26%20%26%20%26%20'
        const result = st.encodeRFC3986URIComponent(input)
        expect(result).toEqual(expected)
      })
      test('should encode accents in text', () => {
        const input = 'aàáâäæãåāeèéêëēėęiîíoôölł'
        const expected = 'a%C3%A0%C3%A1%C3%A2%C3%A4%C3%A6%C3%A3%C3%A5%C4%81e%C3%A8%C3%A9%C3%AA%C3%AB%C4%93%C4%97%C4%99i%C3%AE%C3%ADo%C3%B4%C3%B6l%C5%82'
        const result = st.encodeRFC3986URIComponent(input)
        expect(result).toEqual(expected)
      })
    })

    /*
     * decodeRFC3986URIComponent()
     */
    describe('decodeRFC3986URIComponent()', () => {
      test('empty -> empty', () => {
        const input = ''
        const expected = ''
        const result = st.decodeRFC3986URIComponent(input)
        expect(result).toEqual(expected)
      })
      test('should not change A-z 0-9 - _ . ~', () => {
        const input = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~'
        const expected = input
        const result = st.decodeRFC3986URIComponent(input)
        expect(result).toEqual(expected)
      })
      test('should decode standard punctuation', () => {
        const input = '%22%23%25%26%2A%2B%2C%2F%3A%3B%3C%3D%3E%3F%40%5C%5E%60%7B%7C%7D'
        const expected = '"#%&*+,/:;<=>?@\\^`{|}'
        const result = st.decodeRFC3986URIComponent(input)
        expect(result).toEqual(expected)
      })
      test('should decode additional punctuation', () => {
        const input = '%21%28%29%5B%5D%2A%27'
        const expected = '!()[]*\''
        const result = st.decodeRFC3986URIComponent(input)
        expect(result).toEqual(expected)
      })
      test('should decode accents in text', () => {
        const input = 'a%C3%A0%C3%A1%C3%A2%C3%A4%C3%A6%C3%A3%C3%A5%C4%81e%C3%A8%C3%A9%C3%AA%C3%AB%C4%93%C4%97%C4%99i%C3%AE%C3%ADo%C3%B4%C3%B6l%C5%82'
        const expected = 'aàáâäæãåāeèéêëēėęiîíoôölł'
        const result = st.decodeRFC3986URIComponent(input)
        expect(result).toEqual(expected)
      })
    })

    describe('encode...-decode... match tests', () => {
      test('long string from DW', () => {
        const input = `'5m[CommandBar](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=Review%20overdue%20tasks%20%28by%20Task%29) > [React](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=Process%20Overdue%20Items%20in%20a%20Separate%20Window&arg0=Overdue)  !!!!`
        const encoded = st.encodeRFC3986URIComponent(input)
        const decoded = st.decodeRFC3986URIComponent(encoded)
        console.log(input)
        console.log(encoded)
        console.log(decoded)
        expect(decoded).toEqual(input)
      })
    })
  })
})
