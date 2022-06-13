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
    // Can't figure out why this does match.
    // Both https://regex101.com/ and Expressions app say it doesn't.
    test('should not find term in regular URL', () => {
      const result = p.termInMarkdownPath('tennis', 'And http://www.tennis.co.uk/ and then tennis.org')
      expect(result).toEqual(false)
    })

  })

})
