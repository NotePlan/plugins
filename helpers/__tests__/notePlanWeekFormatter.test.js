/**
 * Tests for the NotePlan week formatting utility
 * @author @dwertheimer
 */
/* global describe, test, it, expect, jest, beforeEach, afterEach */
// @flow

import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'
import moment from 'moment/min/moment-with-locales'
import { formatWithNotePlanWeeks } from '../notePlanWeekFormatter'

// Make DataStore and Editor available globally for the source code
global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan

describe('NotePlan Week Formatter', () => {
  beforeEach(() => {
    // Mock Calendar.weekNumber for consistent test results
    global.Calendar = {
      weekNumber: jest.fn((date) => {
        // For '2023-06-15' (Thursday), return week 25
        // For '2023-02-05' (Sunday), return week 6
        // For '2023-01-01' (Sunday), return week 1
        if (date.getFullYear() === 2023) {
          if (date.getMonth() === 5 && date.getDate() === 15) return 25 // June 15
          if (date.getMonth() === 1 && date.getDate() === 5) return 6 // Feb 5
          if (date.getMonth() === 0 && date.getDate() === 1) return 1 // Jan 1
        }
        return 42 // Default fallback for other dates
      }),
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic functionality', () => {
    it('should return default format when no format provided', () => {
      const result = formatWithNotePlanWeeks('2023-06-15')
      expect(result).toBe('2023-06-15') // Should use default YYYY-MM-DD format
    })

    it('should return empty string when empty format provided', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', '')
      expect(result).toBe('')
    })

    it('should passthrough formats without week tokens', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', 'YYYY-MM-DD')
      expect(result).toBe('2023-06-15')
      expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
    })

    it('should use today when null dateInput provided', () => {
      const result = formatWithNotePlanWeeks(null, 'YYYY-MM-DD')
      const todayStr = moment().format('YYYY-MM-DD')
      expect(result).toBe(todayStr)
    })

    it('should use today when undefined dateInput provided', () => {
      const result = formatWithNotePlanWeeks(undefined, 'YYYY-MM-DD')
      const todayStr = moment().format('YYYY-MM-DD')
      expect(result).toBe(todayStr)
    })

    it('should use today when empty string dateInput provided', () => {
      const result = formatWithNotePlanWeeks('', 'YYYY-MM-DD')
      const todayStr = moment().format('YYYY-MM-DD')
      expect(result).toBe(todayStr)
    })

    it('should use today when whitespace-only string dateInput provided', () => {
      const result = formatWithNotePlanWeeks('   ', 'YYYY-MM-DD')
      const todayStr = moment().format('YYYY-MM-DD')
      expect(result).toBe(todayStr)
    })

    it('should still accept moment instances for backward compatibility', () => {
      const momentInstance = moment('2023-06-15')
      const result = formatWithNotePlanWeeks(momentInstance, 'YYYY-MM-DD')
      expect(result).toBe('2023-06-15')
    })

    it('should handle different date string formats', () => {
      // Test various input formats that moment can parse
      expect(formatWithNotePlanWeeks('2023/06/15', 'YYYY-MM-DD')).toBe('2023-06-15')
      expect(formatWithNotePlanWeeks('June 15, 2023', 'YYYY-MM-DD')).toBe('2023-06-15')
      expect(formatWithNotePlanWeeks('2023-06-15T10:30:00', 'YYYY-MM-DD')).toBe('2023-06-15')
    })

    it('should use default format when null format provided', () => {
      // $FlowFixMe[incompatible-call] - Testing edge case with null format
      const result = formatWithNotePlanWeeks('2023-06-15', null)
      expect(result).toBe('2023-06-15') // Should use default YYYY-MM-DD format
    })

    it('should use default format when undefined format provided', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', undefined)
      expect(result).toBe('2023-06-15') // Should use default YYYY-MM-DD format
    })
  })

  describe('NotePlan week tokens (lowercase w/ww) - SHOULD be replaced', () => {
    it('should replace "w" token with NotePlan week number', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', 'w')
      expect(result).toBe('25')
      expect(global.Calendar.weekNumber).toHaveBeenCalledWith(expect.any(Date))
    })

    it('should replace "ww" token with zero-padded NotePlan week number', () => {
      const result = formatWithNotePlanWeeks('2023-02-05', 'ww')
      expect(result).toBe('06')
      expect(global.Calendar.weekNumber).toHaveBeenCalledWith(expect.any(Date))
    })

    it('should replace "w" when embedded in middle of format string', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', 'YYYYwMM')
      expect(result).toBe('20232506') // 2023 + 25 + 06
    })

    it('should replace "ww" when embedded in middle of format string', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', 'YYYYwwMM')
      expect(result).toBe('20232506') // 2023 + 25 + 06
    })

    it('should handle mixed format strings with week tokens and other tokens', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', 'YYYY-[W]ww')
      expect(result).toBe('2023-W25')
    })

    it('should handle multiple lowercase week tokens in the same format string', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', 'w-ww')
      expect(result).toBe('25-25')
      // Should only call Calendar.weekNumber once (efficient implementation)
      expect(global.Calendar.weekNumber).toHaveBeenCalledTimes(1)
    })
  })

  describe('ISO week tokens (uppercase W/WW) - should NOT be replaced', () => {
    it('should NOT replace "W" token (ISO week)', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', 'W')
      // Should be ISO week number, not our mocked value
      expect(result).not.toBe('25')
      expect(result).toMatch(/^\d+$/) // Should be a number
      expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
    })

    it('should NOT replace "WW" token (zero-padded ISO week)', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', 'WW')
      // Should be zero-padded ISO week, not our mocked value
      expect(result).not.toBe('25')
      expect(result).toMatch(/^\d{2}$/) // Should be 2-digit number
      expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
    })
  })

  describe('Weekday tokens (www/wwww) - should be converted to moment equivalents', () => {
    it('should convert "www" to weekday abbreviation', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', 'www') // Thursday
      expect(result).toBe('Thu')
      expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
    })

    it('should convert "wwww" to full weekday name', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', 'wwww') // Thursday
      expect(result).toBe('Thursday')
      expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
    })
  })

  describe('Other week-related tokens - should NOT be replaced', () => {
    it('should NOT replace "wo" token (ordinal week)', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', 'wo')
      // Should be ordinal like "24th", not our mocked value
      expect(result).toMatch(/^\d+(st|nd|rd|th)$/)
      expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
    })
  })

  describe('Mixed token scenarios', () => {
    it('should replace lowercase w but not uppercase W in same string', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', 'w-W')
      // Should contain our NotePlan week (25) and moment's ISO week (different)
      expect(result).toMatch(/^25-\d+$/)
      expect(result).not.toBe('25-25') // ISO week should be different
      expect(global.Calendar.weekNumber).toHaveBeenCalledTimes(1)
    })

    it('should replace ww but not wo in same string', () => {
      const result = formatWithNotePlanWeeks('2023-02-05', 'ww-wo')
      // Should contain our zero-padded week (06) and moment's ordinal week
      expect(result).toMatch(/^06-\d+(st|nd|rd|th)$/)
      expect(global.Calendar.weekNumber).toHaveBeenCalledTimes(1)
    })

    it('should handle complex format with multiple token types', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', 'YYYY-[Week ]w[ (ISO ]W[) ]www')
      // Should be like "2023-Week 25 (ISO 24) Thu"
      expect(result).toContain('2023-Week 25')
      expect(result).toMatch(/\(ISO \d+\)/)
      expect(result).toMatch(/(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/)
      expect(global.Calendar.weekNumber).toHaveBeenCalledTimes(1)
    })
  })

  describe('Literal block handling', () => {
    it('should not replace tokens inside literal blocks', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', '[w] w')
      expect(result).toBe('w 25')
      expect(global.Calendar.weekNumber).toHaveBeenCalledTimes(1)
    })

    it('should handle nested and complex literal blocks', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', '[Week] w [contains w and ww]')
      expect(result).toBe('Week 25 contains w and ww')
      expect(global.Calendar.weekNumber).toHaveBeenCalledTimes(1)
    })

    it('should handle tokens in brackets (moment escaping)', () => {
      const result = formatWithNotePlanWeeks('2023-06-15', '[Week] w')
      expect(result).toBe('Week 25')
      expect(global.Calendar.weekNumber).toHaveBeenCalledTimes(1)
    })
  })

  describe('Fallback behavior (when Calendar.weekNumber not available)', () => {
    it('should use ISO week with Sunday adjustment when Calendar not available', () => {
      // Temporarily remove Calendar to test fallback
      delete global.Calendar

      const result = formatWithNotePlanWeeks('2023-01-01', 'w') // Sunday

      // Should be ISO week + 1 for Sunday (since Sunday is day 0)
      const momentInstance = moment('2023-01-01')
      const isoWeek = parseInt(momentInstance.format('W'))
      const expectedWeek = isoWeek + 1
      expect(result).toBe(expectedWeek.toString())
    })

    it('should use ISO week unchanged for non-Sunday dates when Calendar not available', () => {
      // Temporarily remove Calendar to test fallback
      delete global.Calendar

      const result = formatWithNotePlanWeeks('2023-06-15', 'w') // Thursday

      // Should be ISO week unchanged for non-Sunday
      const momentInstance = moment('2023-06-15')
      const isoWeek = parseInt(momentInstance.format('W'))
      expect(result).toBe(isoWeek.toString())
    })
  })
})
