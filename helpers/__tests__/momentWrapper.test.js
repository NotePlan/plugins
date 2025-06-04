/**
 * Tests for the moment wrapper that handles NotePlan's custom week numbering
 * @author @dwertheimer
 */
/* global describe, it, expect, jest, beforeEach */

import { momentWrapper } from '../momentWrapper'

// Mock Calendar.weekNumber to return a predictable value for testing
global.Calendar = {
  weekNumber: jest.fn((_date) => {
    // For testing, return week 42 for any date
    return 42
  }),
}

describe('momentWrapper', () => {
  beforeEach(() => {
    global.Calendar.weekNumber.mockClear()
  })

  describe('NotePlan week tokens (lowercase w/ww) - SHOULD be replaced', () => {
    it('should replace "w" token with NotePlan week number', () => {
      const moment = momentWrapper('2023-10-15')
      const result = moment.format('w')
      expect(result).toBe('42')
      expect(global.Calendar.weekNumber).toHaveBeenCalledWith(expect.any(Date))
    })

    it('should replace "ww" token with zero-padded NotePlan week number', () => {
      global.Calendar.weekNumber.mockReturnValue(5)
      const moment = momentWrapper('2023-02-05')
      const result = moment.format('ww')
      expect(result).toBe('05')
    })

    it('should replace "w" when embedded in middle of format string', () => {
      global.Calendar.weekNumber.mockReturnValue(25)
      const moment = momentWrapper('2023-06-15')
      const result = moment.format('YYYYwMM')
      expect(result).toBe('20232506') // 2023 + 25 + 06
    })

    it('should replace "ww" when embedded in middle of format string', () => {
      global.Calendar.weekNumber.mockReturnValue(8)
      const moment = momentWrapper('2023-02-20')
      const result = moment.format('DDwwYYYY')
      expect(result).toBe('20082023') // 20 + 08 + 2023
    })

    it('should handle mixed format strings with week tokens and other tokens', () => {
      global.Calendar.weekNumber.mockReturnValue(25)
      const moment = momentWrapper('2023-06-15')
      const result = moment.format('YYYY-[W]ww')
      expect(result).toBe('2023-W25')
    })

    it('should handle multiple lowercase week tokens in the same format string', () => {
      global.Calendar.weekNumber.mockReturnValue(8)
      const moment = momentWrapper('2023-02-20')
      const result = moment.format('w-ww')
      expect(result).toBe('8-08')
    })
  })

  describe('ISO week tokens (uppercase W/WW) - should NOT be replaced', () => {
    it('should NOT replace "W" token - should use moment ISO week', () => {
      global.Calendar.weekNumber.mockReturnValue(99) // Use a value that's unlikely to match
      const moment = momentWrapper('2023-06-15')
      const result = moment.format('W')
      // Should use moment's ISO week, not our mocked value of 99
      expect(result).not.toBe('99')
      expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
    })

    it('should NOT replace "WW" token - should use moment ISO week', () => {
      global.Calendar.weekNumber.mockReturnValue(99) // Use a value that's unlikely to match
      const moment = momentWrapper('2023-08-15') // Use a different date
      const result = moment.format('WW')
      // Should use moment's zero-padded ISO week, not our mocked value
      expect(result).not.toBe('99')
      expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
    })

    it('should NOT replace "W" when embedded in format string', () => {
      global.Calendar.weekNumber.mockReturnValue(99) // Use a value that's unlikely to match
      const moment = momentWrapper('2023-06-15')
      const result = moment.format('YYYYWMM')
      // Should contain moment's ISO week, not our mocked value
      expect(result).not.toContain('99')
      expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
    })
  })

  describe('Other week-related tokens - should NOT be replaced', () => {
    it('should NOT replace "wo" token (ordinal week)', () => {
      global.Calendar.weekNumber.mockReturnValue(25) // This should be ignored
      const moment = momentWrapper('2023-06-15')
      const result = moment.format('wo')
      // Should be ordinal format like "24th", not our mocked value
      expect(result).toMatch(/\d+(st|nd|rd|th)/)
      expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
    })

    it('should NOT replace "www" token (weekday abbreviation)', () => {
      global.Calendar.weekNumber.mockReturnValue(25) // This should be ignored
      const moment = momentWrapper('2023-06-15') // Thursday
      const result = moment.format('www')
      // Should be weekday abbreviation like "Thu", not our mocked value
      expect(result).toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/)
      expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
    })

    it('should NOT replace "wwww" token (full weekday name)', () => {
      global.Calendar.weekNumber.mockReturnValue(25) // This should be ignored
      const moment = momentWrapper('2023-06-15') // Thursday
      const result = moment.format('wwww')
      // Should be full weekday name like "Thursday", not our mocked value
      expect(result).toMatch(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/)
      expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
    })
  })

  describe('Mixed token scenarios', () => {
    it('should replace lowercase w but not uppercase W in same string', () => {
      global.Calendar.weekNumber.mockReturnValue(25)
      const moment = momentWrapper('2023-06-15')
      const result = moment.format('w-W')
      // Should contain our NotePlan week (25) and moment's ISO week (different)
      expect(result).toMatch(/^25-\d+$/)
      expect(result).not.toBe('25-25') // ISO week should be different
      expect(global.Calendar.weekNumber).toHaveBeenCalledTimes(1)
    })

    it('should replace ww but not wo in same string', () => {
      global.Calendar.weekNumber.mockReturnValue(8)
      const moment = momentWrapper('2023-02-20')
      const result = moment.format('ww-wo')
      // Should contain our zero-padded week (08) and moment's ordinal week
      expect(result).toMatch(/^08-\d+(st|nd|rd|th)$/)
      expect(global.Calendar.weekNumber).toHaveBeenCalledTimes(1)
    })

    it('should handle complex format with multiple token types', () => {
      global.Calendar.weekNumber.mockReturnValue(25)
      const moment = momentWrapper('2023-06-15')
      const result = moment.format('YYYY-[Week ]w[ (ISO ]W[) ]www')
      // Should be like "2023-Week 25 (ISO 24) Thu"
      expect(result).toContain('2023-Week 25')
      expect(result).toMatch(/\(ISO \d+\)/)
      expect(result).toMatch(/(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/)
      expect(global.Calendar.weekNumber).toHaveBeenCalledTimes(1)
    })
  })

  describe('passthrough functionality', () => {
    it('should pass through non-week format strings unchanged', () => {
      const moment = momentWrapper('2023-10-15')
      const result = moment.format('YYYY-MM-DD')
      expect(result).toBe('2023-10-15')
      expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
    })

    it('should return default format when no format string provided', () => {
      const moment = momentWrapper('2023-10-15T14:30:00')
      const result = moment.format()
      // Should return ISO format by default
      expect(result).toMatch(/2023-10-15T14:30:00/)
      expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
    })

    it('should pass through add method and return wrapped moment', () => {
      const moment = momentWrapper('2023-10-15')
      const result = moment.add(1, 'day')
      expect(result).toBeInstanceOf(Object)
      expect(result.format('YYYY-MM-DD')).toBe('2023-10-16')
    })

    it('should pass through subtract method and return wrapped moment', () => {
      const moment = momentWrapper('2023-10-15')
      const result = moment.subtract(1, 'day')
      expect(result.format('YYYY-MM-DD')).toBe('2023-10-14')
    })

    it('should pass through toDate method', () => {
      const moment = momentWrapper('2023-10-15')
      const result = moment.toDate()
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2023)
      expect(result.getMonth()).toBe(9) // October is month 9 (0-indexed)
      expect(result.getDate()).toBe(15)
    })

    it('should pass through isValid method', () => {
      const validMoment = momentWrapper('2023-10-15')
      const invalidMoment = momentWrapper('invalid-date')
      expect(validMoment.isValid()).toBe(true)
      expect(invalidMoment.isValid()).toBe(false)
    })
  })

  describe('static methods', () => {
    it('should provide utc static method', () => {
      const utcMoment = momentWrapper.utc('2023-10-15')
      expect(utcMoment).toBeInstanceOf(Object)
      const result = utcMoment.format('YYYY-MM-DD')
      expect(result).toBe('2023-10-15')
    })

    it('should provide locale static method', () => {
      expect(typeof momentWrapper.locale).toBe('function')
    })
  })

  describe('edge cases', () => {
    it('should handle empty format string', () => {
      const moment = momentWrapper('2023-10-15')
      const result = moment.format('')
      expect(result).toBe('')
      expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
    })

    it('should handle format strings with no tokens', () => {
      const moment = momentWrapper('2023-10-15')
      const result = moment.format('Hello World')
      // Moment.js treats any string as format tokens, so this will be formatted
      expect(result).not.toBe('Hello World')
      expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
    })

    it('should handle tokens in brackets (moment escaping)', () => {
      global.Calendar.weekNumber.mockReturnValue(25)
      const moment = momentWrapper('2023-06-15')
      const result = moment.format('[Week] w')
      expect(result).toBe('Week 25')
      expect(global.Calendar.weekNumber).toHaveBeenCalledTimes(1)
    })
  })
})

describe('integration with existing dateTime functions', () => {
  it('should be compatible with existing moment usage patterns', () => {
    // Test that the wrapper works with common patterns found in the codebase
    const moment = momentWrapper()

    // Pattern: moment().format('YYYY-MM-DD')
    const dateStr = moment.format('YYYY-MM-DD')
    expect(dateStr).toMatch(/\d{4}-\d{2}-\d{2}/)

    // Pattern: moment().startOf('day')
    const startOfDay = moment.startOf('day')
    expect(startOfDay.format('HH:mm:ss')).toBe('00:00:00')

    // Pattern: moment().add(1, 'days') - need to create new instance for comparison
    const originalMoment = momentWrapper()
    const tomorrow = momentWrapper().add(1, 'days')
    expect(tomorrow.toDate().getTime()).toBeGreaterThan(originalMoment.toDate().getTime())
  })
})
