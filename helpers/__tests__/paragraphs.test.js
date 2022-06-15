/* global describe, expect, test */
import * as p from '../paragraph'

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
