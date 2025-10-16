/* eslint-disable max-len */
/* globals describe, expect, test, beforeAll */

import colors from 'chalk'
import { getNPWeekStr, getTodaysDateHyphenated } from '../dateTime'
import * as st from '../stringTransforms'
import { DataStore } from '@mocks/index'

beforeAll(() => {
  // global.Calendar = Calendar
  // global.Clipboard = Clipboard
  // global.CommandBar = CommandBar
  global.DataStore = DataStore
  // global.Editor = Editor
  // global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging
})

const PLUGIN_NAME = `📙 ${colors.yellow('helpers/stringTransforms')}`
// const section = colors.blue

describe(`${PLUGIN_NAME}`, () => {
  describe('truncateHTML', () => {
    test('no change as maxLength is 0', () => {
      const htmlIn = '<p>This is a <strong>bold</strong> paragraph of text.</p>'
      const maxLength = 0
      expect(st.truncateHTML(htmlIn, maxLength)).toBe(htmlIn)
    })
    test('no change as maxLength is larger than htmlIn length', () => {
      const htmlIn = '<p>This is a <strong>bold</strong> paragraph of text.</p>'
      const maxLength = 100
      expect(st.truncateHTML(htmlIn, maxLength)).toBe(htmlIn)
    })
    test('truncates HTML string to specified length', () => {
      const htmlIn = '<p>This is a long paragraph of text that needs to be truncated.</p>'
      const maxLength = 20
      const expectedOutput = '<p>This is a long parag…</p>'
      expect(st.truncateHTML(htmlIn, maxLength)).toBe(expectedOutput)
    })
    test('preserves markdown links', () => {
      const htmlIn = '<p>This is a [link](http://example.com) to a website.</p>'
      const maxLength = 15
      const expectedOutput = '<p>This is a [link](http://example.com) to a…</p>'
      expect(st.truncateHTML(htmlIn, maxLength)).toBe(expectedOutput)
    })
    test('preserves long markdown link for sparkmail', () => {
      const htmlIn =
        '#jgcDR Fix email links for @SavageBeginnings - e.g. [Open in Spark](readdle-spark://bl=QTptaWNoYWVsLmJ1aWx0Ynlzbm93bWFuQGdtYWlsLmNvbTtJRDozNmJhZDNjMi1j%0D%0AOTZlLTQ4ZjMtOGY0My0yYWUxZDEzNzk2NDVAU3Bhcms7Z0lEOjE4MzMyMjE5Mjg3%0D%0AMjMwMzU2MzA7Mzk4ODg0MjIzMw%3D%3D)'
      const maxLength = 40
      const htmlOut = st.truncateHTML(htmlIn, maxLength)
      expect(htmlOut).toMatch(/^#jgcDR Fix email links for @Savage/)
      // eslint-disable-next-line max-len
      expect(htmlOut).toMatch(
        /\]\(readdle-spark:\/\/bl=QTptaWNoYWVsLmJ1aWx0Ynlzbm93bWFuQGdtYWlsLmNvbTtJRDozNmJhZDNjMi1j%0D%0AOTZlLTQ4ZjMtOGY0My0yYWUxZDEzNzk2NDVAU3Bhcms7Z0lEOjE4MzMyMjE5Mjg3%0D%0AMjMwMzU2MzA7Mzk4ODg0MjIzMw%3D%3D\)/,
      )
    })
    test('preserves long markdown link for zoe', () => {
      const htmlIn =
        'Listen to <a class="externalLink" href="https://clicks.zoe.com/f/a/ZUR-0srQ-voOYivE4-3Cbg~~/AAAHahA~/fH9o0ZGdoctxiA8NAti-k_kpEV5DfcBrJIeeam2Wljd6UlF32coJF72IbaXEqXuz2Rc3802HgSB89r9AF3WTETv_oTnTmiMO1PJUB6L0lyl4zgV0wIeqN-cN7UCKE-w9ae9gwDezk5Le3Ki1PnFnKakfEhdrxfgAgdX28SS8PyM~"><i class="fa-regular fa-globe pad-right"></i>Protein on a plant-based diet | Prof. Tim Spector and Dr. Rupy Aujla ~ ZOE</a>$'
      const maxLength = 30
      const htmlOut = st.truncateHTML(htmlIn, maxLength)
      // eslint-disable-next-line max-len
      expect(htmlOut).toMatch(
        /^Listen to <a class="externalLink" href="https:\/\/clicks\.zoe\.com\/f\/a\/ZUR-0srQ-voOYivE4-3Cbg~~\/AAAHahA~\/fH9o0ZGdoctxiA8NAti-k_kpEV5DfcBrJIeeam2Wljd6UlF32coJF72IbaXEqXuz2Rc3802HgSB89r9AF3WTETv_oTnTmiMO1PJUB6L0lyl4zgV0wIeqN-cN7UCKE-w9ae9gwDezk5Le3Ki1PnFnKakfEhdrxfgAgdX28SS8PyM~"><i class="fa-regular fa-globe pad-right"><\/i>Protein on a plant-b…<\/a>$/,
      )
    })
    test('should add ellipsis if dots is true', () => {
      const htmlIn = '<p>This is a long paragraph of text that needs to be truncated.</p>'
      const maxLength = 20
      const expectedOutput = '<p>This is a long parag…</p>'
      expect(st.truncateHTML(htmlIn, maxLength, true)).toBe(expectedOutput)
    })
    test('should not add ellipsis if dots is false', () => {
      const htmlIn = '<p>This is a long paragraph of text that needs to be truncated.</p>'
      const maxLength = 20
      const expectedOutput = '<p>This is a long parag</p>'
      expect(st.truncateHTML(htmlIn, maxLength, false)).toBe(expectedOutput)
    })
    test('should not do any truncating', () => {
      const htmlIn = '!!! buy epic passes <a class="externalLink" href="www.beavercreek.com"><i class="fa-regular fa-globe pad-right"></i>www.beavercreek.com</a> for family (breakeven at 4 days of skiing) for family (breakeven at 4 days of skiing) <span class="attag">@repeat(2/7)</span> <i class="fa-solid fa-asterisk" style="color: var(--block-id-color);"></i>>2025-10-12'
      expect(st.truncateHTML(htmlIn, 0, false)).toBe(htmlIn)
    })
    test('should not truncate www link, but truncate line', () => {
      const htmlIn = '!!! buy epic passes <a class="externalLink" href="www.beavercreek.com"><i class="fa-regular fa-globe pad-right"></i>www.beavercreek.com</a> for family (breakeven at 4 days of skiing) for family (breakeven at 4 days of skiing) <span class="attag">@repeat(2/7)</span> <i class="fa-solid fa-asterisk" style="color: var(--block-id-color);"></i>>2025-10-12'
      const maxLength = 140
      const expectedOutput = '!!! buy epic passes <a class="externalLink" href="www.beavercreek.com"><i class="fa-regular fa-globe pad-right"></i>www.beavercreek.com</a> for family (breakeven at 4 days of skiing) for family (breakeven at 4 days of skiing) <span class="attag">@repeat(2/7)</span> <i class="fa-solid fa-asterisk" style="color: var(--block-id-color);"></i>>…'
      expect(st.truncateHTML(htmlIn, maxLength, true)).toBe(expectedOutput)
    })
  })

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
      expect(result).toEqual(
        'this has <a class="externalLink" href="https://www.something.com/with?various&chars%20ok"><i class="fa-regular fa-globe pad-right"></i>title with spaces</a> with a valid link',
      )
    })
    test('should produce HTML link for sparkmail', () => {
      const input =
        '#jgcDR Fix email links for @SavageBeginnings - e.g. [Open in Spark](readdle-spark://bl=QTptaWNoYWVsLmJ1aWx0Ynlzbm93bWFuQGdtYWlsLmNvbTtJRDozNmJhZDNjMi1j%0D%0AOTZlLTQ4ZjMtOGY0My0yYWUxZDEzNzk2NDVAU3Bhcms7Z0lEOjE4MzMyMjE5Mjg3%0D%0AMjMwMzU2MzA7Mzk4ODg0MjIzMw%3D%3D)'
      const result = st.changeMarkdownLinksToHTMLLink(input)
      expect(result).toEqual(
        '#jgcDR Fix email links for @SavageBeginnings - e.g. <a class="externalLink" href="readdle-spark://bl=QTptaWNoYWVsLmJ1aWx0Ynlzbm93bWFuQGdtYWlsLmNvbTtJRDozNmJhZDNjMi1j%0D%0AOTZlLTQ4ZjMtOGY0My0yYWUxZDEzNzk2NDVAU3Bhcms7Z0lEOjE4MzMyMjE5Mjg3%0D%0AMjMwMzU2MzA7Mzk4ODg0MjIzMw%3D%3D"><i class="fa-regular fa-globe pad-right"></i>Open in Spark</a>',
      )
    })
    test('should produce HTML link for long link', () => {
      const input =
        'Listen to [Protein on a plant-based diet | Prof. Tim Spector and Dr. Rupy Aujla ~ ZOE](https://clicks.zoe.com/f/a/ZUR-0srQ-voOYivE4-3Cbg~~/AAAHahA~/fH9o0ZGdoctxiA8NAti-k_kpEV5DfcBrJIeeam2Wljd6UlF32coJF72IbaXEqXuz2Rc3802HgSB89r9AF3WTETv_oTnTmiMO1PJUB6L0lyl4zgV0wIeqN-cN7UCKE-w9ae9gwDezk5Le3Ki1PnFnKakfEhdrxfgAgdX28SS8PyM~)'
      const result = st.changeMarkdownLinksToHTMLLink(input)
      expect(result).toEqual(
        'Listen to <a class="externalLink" href="https://clicks.zoe.com/f/a/ZUR-0srQ-voOYivE4-3Cbg~~/AAAHahA~/fH9o0ZGdoctxiA8NAti-k_kpEV5DfcBrJIeeam2Wljd6UlF32coJF72IbaXEqXuz2Rc3802HgSB89r9AF3WTETv_oTnTmiMO1PJUB6L0lyl4zgV0wIeqN-cN7UCKE-w9ae9gwDezk5Le3Ki1PnFnKakfEhdrxfgAgdX28SS8PyM~"><i class="fa-regular fa-globe pad-right"></i>Protein on a plant-based diet | Prof. Tim Spector and Dr. Rupy Aujla ~ ZOE</a>',
      )
    })
    test('should produce HTML link for long link', () => {
      const input =
        'Listen to [Low-carb diets and sugar spikes | Prof. Tim Spector ~ ZOE](https://clicks.zoe.com/f/a/dAgKh6AB8eEXtAsfVZAruQ~~/AAAHahA~/fH9o0ZGdoctxiA8NAti-k_kpEV5DfcBrJIeeam2Wljfzbxj0fcKOfK3AYKbmVevONgJ47zckYA_4vS_pNxs7JgRkrShVwPCAhgMGMHCRYPhB_HHOjoSolH6GF-1WvM08xMcWon8sQI9tDzxayAenpO0u1CJCyUeKVsDziwbA6RY~)'
      const result = st.changeMarkdownLinksToHTMLLink(input)
      expect(result).toEqual(
        'Listen to <a class="externalLink" href="https://clicks.zoe.com/f/a/dAgKh6AB8eEXtAsfVZAruQ~~/AAAHahA~/fH9o0ZGdoctxiA8NAti-k_kpEV5DfcBrJIeeam2Wljfzbxj0fcKOfK3AYKbmVevONgJ47zckYA_4vS_pNxs7JgRkrShVwPCAhgMGMHCRYPhB_HHOjoSolH6GF-1WvM08xMcWon8sQI9tDzxayAenpO0u1CJCyUeKVsDziwbA6RY~"><i class="fa-regular fa-globe pad-right"></i>Low-carb diets and sugar spikes | Prof. Tim Spector ~ ZOE</a>',
      )
    })
  })

  /*
   * getLinkDisplayTextFromBareURL()
   */
  describe('getLinkDisplayTextFromBareURL()' /* function */, () => {
    test('should return domain name for valid URI', () => {
      const input = 'https://www.something.com/with?various&chars%20ok'
      const result = st.getLinkDisplayTextFromBareURL(input)
      expect(result).toEqual('www.something.com')
    })

    test('should return domain name for valid URI with non-ASCII characters', () => {
      const input = 'https://sömething.com/with/more/parts'
      const result = st.getLinkDisplayTextFromBareURL(input)
      expect(result).toEqual('sömething.com')
    })

    test('should return IP/port for valid URI', () => {
      const input = 'https://127.0.0.1:1234/with/more/parts'
      const result = st.getLinkDisplayTextFromBareURL(input)
      expect(result).toEqual('127.0.0.1:1234')
    })

    test('should return full mailto: URI for mailto: URI', () => {
      const input = 'mailto:jgclark@example.com'
      const result = st.getLinkDisplayTextFromBareURL(input)
      expect(result).toEqual('mailto:jgclark@example.com')
    })

    test('should return full tel: URI for tel: URI', () => {
      const input = 'tel:+1234567890'
      const result = st.getLinkDisplayTextFromBareURL(input)
      expect(result).toEqual('tel:+1234567890')
    })

    test('should return just protocol… for spark-mail: protocol', () => {
      const input =
        'spark-mail://bl=QTptaWNoYWVsLmJ1aWx0Ynlzbm93bWFuQGdtYWlsLmNvbTtJRDozNmJhZDNjMi1j%0D%0AOTZlLTQ4ZjMtOGY0My0yYWUxZDEzNzk2NDVAU3Bhcms7Z0lEOjE4MzMyMjE5Mjg3%0D%0AMjMwMzU2MzA7Mzk4ODg0MjIzMw%3D%3D'
      const result = st.getLinkDisplayTextFromBareURL(input)
      expect(result).toEqual('spark-mail://…')
    })

    test('should return just protocol… for noteplan: protocol', () => {
      const input = 'noteplan://doSomething?param=value'
      const result = st.getLinkDisplayTextFromBareURL(input)
      expect(result).toEqual('noteplan://…')
    })

    test('should return domain name for long link 1', () => {
      const input =
        'https://clicks.zoe.com/f/a/ZUR-0srQ-voOYivE4-3Cbg~~/AAAHahA~/fH9o0ZGdoctxiA8NAti-k_kpEV5DfcBrJIeeam2Wljd6UlF32coJF72IbaXEqXuz2Rc3802HgSB89r9AF3WTETv_oTnTmiMO1PJUB6L0lyl4zgV0wIeqN-cN7UCKE-w9ae9gwDezk5Le3Ki1PnFnKakfEhdrxfgAgdX28SS8PyM~'
      const result = st.getLinkDisplayTextFromBareURL(input)
      expect(result).toEqual('clicks.zoe.com')
    })
    test('should return domain name for long link 2', () => {
      const input =
        'https://clicks.zoe.com/f/a/dAgKh6AB8eEXtAsfVZAruQ~~/AAAHahA~/fH9o0ZGdoctxiA8NAti-k_kpEV5DfcBrJIeeam2Wljfzbxj0fcKOfK3AYKbmVevONgJ47zckYA_4vS_pNxs7JgRkrShVwPCAhgMGMHCRYPhB_HHOjoSolH6GF-1WvM08xMcWon8sQI9tDzxayAenpO0u1CJCyUeKVsDziwbA6RY~'
      const result = st.getLinkDisplayTextFromBareURL(input)
      expect(result).toEqual('clicks.zoe.com')
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
      const input = 'this has https www domain com but not together'
      const result = st.changeBareLinksToHTMLLink(input)
      expect(result).toEqual(input)
    })
    test('should find www link without http:// protocol 1', () => {
      const input = 'this has www.domain.com to find'
      const result = st.changeBareLinksToHTMLLink(input)
      expect(result).toEqual('this has <a class="externalLink" href="www.domain.com"><i class="fa-regular fa-globe pad-right"></i>www.domain.com</a> to find')
    })
    test('should find www link without http:// protocol 2', () => {
      const input = '* !!! buy epic passes www.beavercreek.com for family (breakeven at 4 days of skiing) for family (breakeven at 4 days of skiing) @repeat(2/7) ^sleu9a >2025-10-07'
      const result = st.changeBareLinksToHTMLLink(input)
      expect(result).toEqual('* !!! buy epic passes <a class="externalLink" href="www.beavercreek.com"><i class="fa-regular fa-globe pad-right"></i>www.beavercreek.com</a> for family (breakeven at 4 days of skiing) for family (breakeven at 4 days of skiing) @repeat(2/7) ^sleu9a >2025-10-07')
    })
    test('should not touch markdown link (shorter)', () => {
      const input = 'this has [a valid MD link](https://www.something.com/with?various&chars%20ok)'
      const result = st.changeBareLinksToHTMLLink(input)
      expect(result).toEqual(input)
    })
    test('should not touch markdown link (longer for sparkmail)', () => {
      const input =
        '#jgcDR Fix email links for @SavageBeginnings - e.g. [Open in Spark](readdle-spark://bl=QTptaWNoYWVsLmJ1aWx0Ynlzbm93bWFuQGdtYWlsLmNvbTtJRDozNmJhZDNjMi1j%0D%0AOTZlLTQ4ZjMtOGY0My0yYWUxZDEzNzk2NDVAU3Bhcms7Z0lEOjE4MzMyMjE5Mjg3%0D%0AMjMwMzU2MzA7Mzk4ODg0MjIzMw%3D%3D)'
      const result = st.changeBareLinksToHTMLLink(input, true)
      expect(result).toEqual(input)
    })

    test('should produce HTML link 1 with icon and truncation', () => {
      const input = 'this has a https://www.something.com/with?various&chars%20ok/~/and/yet/more/things-to-make-it-really-quite-long valid bare link'
      const result = st.changeBareLinksToHTMLLink(input, true)
      expect(result).toEqual(
        'this has a <a class="externalLink" href="https://www.something.com/with?various&chars%20ok/~/and/yet/more/things-to-make-it-really-quite-long"><i class="fa-regular fa-globe pad-right"></i>www.something.com</a> valid bare link',
      )
    })
    test('should produce HTML link 1 without icon', () => {
      const input = 'this has a https://www.something.com/with?various&chars%20ok valid bare link'
      const result = st.changeBareLinksToHTMLLink(input, false)
      expect(result).toEqual('this has a <a class="externalLink" href="https://www.something.com/with?various&chars%20ok">www.something.com</a> valid bare link')
    })

    test('should produce HTML link when a link takes up the whole line with icon', () => {
      const input = 'https://www.something.com/with?various&chars%20ok'
      const result = st.changeBareLinksToHTMLLink(input, true)
      expect(result).toEqual('<a class="externalLink" href="https://www.something.com/with?various&chars%20ok"><i class="fa-regular fa-globe pad-right"></i>www.something.com</a>')
    })

    test('should produce truncated HTML link with a very long bare link', () => {
      const input =
        'https://validation.poweredbypercent.com/validate/validationinvite_eb574173-f781-4946-b0be-9a06f838289e?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXJ0bmVyUHVibGljS2V5IjoicGtfM2YzNzFmMmYtYjQ3MC00M2Q1LTk2MDUtZGMxYTU4YjhjY2IzIiwiaWF0IjoxNzI1NjA5MTkyfQ.GM5ITBbgUHd5Qsyq-d_lkOFIqmTuYJH4Kc4DNIoibE0'
      const result = st.changeBareLinksToHTMLLink(input, false)
      expect(result).toEqual(
        '<a class="externalLink" href="https://validation.poweredbypercent.com/validate/validationinvite_eb574173-f781-4946-b0be-9a06f838289e?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXJ0bmVyUHVibGljS2V5IjoicGtfM2YzNzFmMmYtYjQ3MC00M2Q1LTk2MDUtZGMxYTU4YjhjY2IzIiwiaWF0IjoxNzI1NjA5MTkyfQ.GM5ITBbgUHd5Qsyq-d_lkOFIqmTuYJH4Kc4DNIoibE0">validation.poweredbypercent.com</a>',
      )
    })
    test('should produce HTML link for bare spark-mail:// URI', () => {
      const input =
        '#jgcDR Fix email links for @SavageBeginnings - e.g. readdle-spark://bl=QTptaWNoYWVsLmJ1aWx0Ynlzbm93bWFuQGdtYWlsLmNvbTtJRDozNmJhZDNjMi1j%0D%0AOTZlLTQ4ZjMtOGY0My0yYWUxZDEzNzk2NDVAU3Bhcms7Z0lEOjE4MzMyMjE5Mjg3%0D%0AMjMwMzU2MzA7Mzk4ODg0MjIzMw%3D%3D'
      const result = st.changeBareLinksToHTMLLink(input, true)
      expect(result).toEqual(
        '#jgcDR Fix email links for @SavageBeginnings - e.g. <a class="externalLink" href="readdle-spark://bl=QTptaWNoYWVsLmJ1aWx0Ynlzbm93bWFuQGdtYWlsLmNvbTtJRDozNmJhZDNjMi1j%0D%0AOTZlLTQ4ZjMtOGY0My0yYWUxZDEzNzk2NDVAU3Bhcms7Z0lEOjE4MzMyMjE5Mjg3%0D%0AMjMwMzU2MzA7Mzk4ODg0MjIzMw%3D%3D"><i class="fa-regular fa-globe pad-right"></i>readdle-spark://…</a>',
      )
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
    test('should strip 1 blockID at end of line', () => {
      const input = '+ Offset 0d {0d} ^135931'
      const result = st.stripBlockIDsFromString(input)
      expect(result).toEqual('+ Offset 0d {0d}')
    })
    test('should strip 1 blockID at end of line', () => {
      const input = '+ Offset 0d >2024-02-06 ^135931'
      const result = st.stripBlockIDsFromString(input)
      expect(result).toEqual('+ Offset 0d >2024-02-06')
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
     * stripTodaysDateRefsFromString()
     */
    describe('stripTodaysDateRefsFromString()' /* function */, () => {
      test('should not strip anything', () => {
        const before = 'this has no date refs'
        const expected = before
        const result = st.stripTodaysDateRefsFromString(before)
        expect(result).toEqual(expected)
      })
      test('should strip >today', () => {
        const before = 'test >today stuff'
        const expected = `test stuff`
        const result = st.stripTodaysDateRefsFromString(before)
        expect(result).toEqual(expected)
      })
      test('should strip todays date as scheduled ISO', () => {
        const today_ISO = getTodaysDateHyphenated()
        const before = `test >${today_ISO} stuff`
        const expected = `test stuff`
        const result = st.stripTodaysDateRefsFromString(before)
        expect(result).toEqual(expected)
      })
      test('should not strip a different ISO date', () => {
        const before = `test >2020-01-01 stuff`
        const expected = `test >2020-01-01 stuff`
        const result = st.stripTodaysDateRefsFromString(before)
        expect(result).toEqual(expected)
      })
    })

    /*
     * stripThisWeeksDateRefsFromString()
     */
    describe('stripThisWeeksDateRefsFromString()' /* function */, () => {
      test('should not strip anything', () => {
        const before = 'this has no date refs'
        const expected = before
        const result = st.stripThisWeeksDateRefsFromString(before)
        expect(result).toEqual(expected)
      })
      test('should not strip >today', () => {
        const before = 'test >today stuff'
        const expected = 'test >today stuff'
        const result = st.stripThisWeeksDateRefsFromString(before)
        expect(result).toEqual(expected)
      })
      test('should not strip an ISO date', () => {
        const before = `test >2020-01-01 stuff`
        const expected = `test >2020-01-01 stuff`
        const result = st.stripThisWeeksDateRefsFromString(before)
        expect(result).toEqual(expected)
      })
      test('should strip todays date as scheduled ISO', () => {
        const thisWeekStr = getNPWeekStr(new Date())
        const before = `test >${thisWeekStr} stuff`
        const expected = `test stuff`
        const result = st.stripThisWeeksDateRefsFromString(before)
        expect(result).toEqual(expected)
      })
      test('should not strip a different week ref', () => {
        const before = `test >2020-13 stuff`
        const expected = `test >2020-13 stuff`
        const result = st.stripThisWeeksDateRefsFromString(before)
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
        const input = "!()[]*'"
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
        const expected = "!()[]*'"
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
        expect(decoded).toEqual(input)
      })
    })
  })

  describe('removeDateTagsAndToday', () => {
    test('should remove ">today at end" ', () => {
      expect(st.removeDateTagsAndToday(`test >today`)).toEqual('test')
    })
    test('should remove ">today at beginning" ', () => {
      expect(st.removeDateTagsAndToday(`>today test`)).toEqual(' test')
    })
    test('should remove ">today in middle" ', () => {
      expect(st.removeDateTagsAndToday(`this is a >today test`)).toEqual('this is a test')
    })
    test('should remove >YYYY-MM-DD date', () => {
      expect(st.removeDateTagsAndToday(`test >2021-11-09 `)).toEqual('test')
    })
    test('should remove nothing if no date tag ', () => {
      expect(st.removeDateTagsAndToday(`test no date`)).toEqual('test no date')
    })
    test('should work for single >week also ', () => {
      expect(st.removeDateTagsAndToday(`test >2000-W02`, true)).toEqual('test')
    })
    test('should work for many items in a line ', () => {
      expect(st.removeDateTagsAndToday(`test >2000-W02 >2020-01-01 <2020-02-02 >2020-09-28`, true)).toEqual('test')
    })
  })
})
