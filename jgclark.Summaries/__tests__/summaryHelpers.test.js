/* global describe, expect, test, toEqual */
import * as s from '../src/summaryHelpers'

describe('summaryHelpers.js tests', () => {

  describe('caseInsensitiveMatch', () => {
    test('should not match ABC to ABCDEFG', () => {
      const result = s.caseInsensitiveMatch('ABC', 'ABCDEFG')
      expect(result).toEqual(false)
    })
    test('should match ABC to ABC', () => {
      const result = s.caseInsensitiveMatch('ABC', 'ABC')
      expect(result).toEqual(true)
    })
    test('should match ABC to abc', () => {
      const result = s.caseInsensitiveMatch('ABC', 'abc')
      expect(result).toEqual(true)
    })
    test('should match ABC to AbcDefg', () => {
      const result = s.caseInsensitiveMatch('ABC', 'AbcDefg')
      expect(result).toEqual(false)
    })
    test('should not match ABC to AB', () => {
      const result = s.caseInsensitiveMatch('ABC', 'AB')
      expect(result).toEqual(false)
    })
    test('should not match ABC to <blank>', () => {
      const result = s.caseInsensitiveMatch('ABC', '')
      expect(result).toEqual(false)
    })
  })

  describe('caseInsensitiveStartsWith', () => {
    test('should match ABC to ABCDEFG', () => {
      const result = s.caseInsensitiveStartsWith('ABC', 'ABCDEFG')
      expect(result).toEqual(true)
    })
    test('should match ABC to ABC', () => {
      const result = s.caseInsensitiveStartsWith('ABC', 'ABC')
      expect(result).toEqual(false) // there should be more to match
    })
    test('should match ABC to abc', () => {
      const result = s.caseInsensitiveStartsWith('ABC', 'abc')
      expect(result).toEqual(false)
    })
    test('should match ABC to abc', () => {
      const result = s.caseInsensitiveStartsWith('ABC', 'abc/two/three')
      expect(result).toEqual(true)
    })
    test('should match ABC to AbcDefg', () => {
      const result = s.caseInsensitiveStartsWith('ABC', 'AbcDefg')
      expect(result).toEqual(true)
    })
    test('should not match ABC to AB', () => {
      const result = s.caseInsensitiveStartsWith('ABC', 'AB')
      expect(result).toEqual(false)
    })
    test('should not match ABC to <blank>', () => {
      const result = s.caseInsensitiveStartsWith('ABC', '')
      expect(result).toEqual(false)
    })
  })

  describe('isHashtagWanted', () => {
    const wantedSet1 = ['#TeStInG', '#Programming']
    const excludedSet1 = ['#odd']
    test('should want #TESTING from set1', () => {
      const result = s.isHashtagWanted('#TESTING', wantedSet1, excludedSet1)
      expect(result).toEqual(true)
    })
    test('should want #testing from set1', () => {
      const result = s.isHashtagWanted('#testing', wantedSet1, excludedSet1)
      expect(result).toEqual(true)
    })
    test('should want #TeStInG from set1', () => {
      const result = s.isHashtagWanted('#TeStInG', wantedSet1, excludedSet1)
      expect(result).toEqual(true)
    })
    test('should want #Programming from set1', () => {
      const result = s.isHashtagWanted('#Programming', wantedSet1, excludedSet1)
      expect(result).toEqual(true)
    })
    test('should want #programming from set1', () => {
      const result = s.isHashtagWanted('#programming', wantedSet1, excludedSet1)
      expect(result).toEqual(true)
    })
    test('should want #programMING from set1', () => {
      const result = s.isHashtagWanted('#programMING', wantedSet1, excludedSet1)
      expect(result).toEqual(true)
    })
    test('should not want #ODD from set1', () => {
      const result = s.isHashtagWanted('#ODD', wantedSet1, excludedSet1)
      expect(result).toEqual(false)
    })
  })

  // Identical logic is found in isMentionWanted
})
