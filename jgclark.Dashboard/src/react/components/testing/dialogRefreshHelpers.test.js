/* globals describe, expect, test, jest */

import { resolveSectionCodesToRefresh } from '../dialogRefreshHelpers.js'

describe('dialogRefreshHelpers', () => {
  describe('resolveSectionCodesToRefresh', () => {
    test('expands ITEM_ORIG_SECTION to the item section code', () => {
      expect(resolveSectionCodesToRefresh(['ITEM_ORIG_SECTION', 'DT'], 'OVERDUE')).toEqual(['OVERDUE', 'DT'])
    })

    test('dedupes when ITEM_ORIG_SECTION matches a listed destination', () => {
      expect(resolveSectionCodesToRefresh(['ITEM_ORIG_SECTION', 'DT', 'TB'], 'DT')).toEqual(['DT', 'TB'])
    })

    test('preserves empty list (no implicit source prepend)', () => {
      expect(resolveSectionCodesToRefresh([], 'REM')).toEqual([])
    })

    test('skips ITEM_ORIG_SECTION when item section is empty', () => {
      const warnSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
      expect(resolveSectionCodesToRefresh(['ITEM_ORIG_SECTION', 'DT'], '')).toEqual(['DT'])
      warnSpy.mockRestore()
    })

    test('dedupes repeated real codes', () => {
      expect(resolveSectionCodesToRefresh(['DT', 'DT', 'TB'], 'REM')).toEqual(['DT', 'TB'])
    })
  })
})
