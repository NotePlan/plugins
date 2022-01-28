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

})
