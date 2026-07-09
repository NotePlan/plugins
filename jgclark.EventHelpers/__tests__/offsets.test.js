// @flow
/* global describe, expect, test, beforeAll */
import { calcOffsetDateStr } from '@helpers/NPdateTime'

/**
 * Mirror applyOffsetInLine date calculation (offsets.js uses calcOffsetDateStr with 'offset' adapt mode).
 * @param {string} dateOffsetString
 * @param {string} baseDate
 * @param {string} lastCalcDate
 * @returns {string}
 */
function calcDateForOffset(dateOffsetString: string, baseDate: string, lastCalcDate: string): string {
  if (dateOffsetString.startsWith('^')) {
    return calcOffsetDateStr(lastCalcDate, dateOffsetString.slice(1), 'offset')
  }
  return calcOffsetDateStr(baseDate, dateOffsetString, 'offset')
}

beforeAll(() => {
  DataStore.settings['_logLevel'] = 'none'
})

describe('process date offsets output format', () => {
  describe('calcDateForOffset (applyOffsetInLine logic)', () => {
    test('day base + 2w -> week output', () => {
      expect(calcDateForOffset('2w', '2026-07-20', '')).toEqual('2026-W32')
    })

    test('day base + -10d -> day output', () => {
      expect(calcDateForOffset('-10d', '2021-12-25', '')).toEqual('2021-12-15')
    })

    test('day base + 3m -> month output', () => {
      expect(calcDateForOffset('3m', '2022-01-01', '')).toEqual('2022-04')
    })

    test('day base + 0w -> week output', () => {
      expect(calcDateForOffset('0w', '2023-07-24', '')).toEqual('2023-W30')
    })

    test('relative ^+3d after week offset -> day output', () => {
      const lastCalcDate = calcDateForOffset('2w', '2026-07-20', '')
      expect(calcDateForOffset('^+3d', '2026-07-20', lastCalcDate)).toEqual('2026-08-06')
    })
  })

  describe('Easter chain from README (offset-unit output)', () => {
    test('relative offset chain produces correct calendar types', () => {
      const baseDate = '2022-03-01'
      let lastCalcDate = ''

      lastCalcDate = calcDateForOffset('0d', baseDate, lastCalcDate)
      expect(lastCalcDate).toEqual('2022-03-01')

      lastCalcDate = calcDateForOffset('^+1d', baseDate, lastCalcDate)
      expect(lastCalcDate).toEqual('2022-03-02')

      lastCalcDate = calcDateForOffset('^+42d', baseDate, lastCalcDate)
      expect(lastCalcDate).toEqual('2022-04-13')

      lastCalcDate = calcDateForOffset('^+1d', baseDate, lastCalcDate)
      expect(lastCalcDate).toEqual('2022-04-14')

      lastCalcDate = calcDateForOffset('^+1d', baseDate, lastCalcDate)
      expect(lastCalcDate).toEqual('2022-04-15')

      lastCalcDate = calcDateForOffset('^+2d', baseDate, lastCalcDate)
      expect(lastCalcDate).toEqual('2022-04-17')
    })
  })
})
