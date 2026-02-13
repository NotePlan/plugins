/* globals describe, expect, test, jest, beforeEach */
/**
 * Unit tests for chart stats total and average calculations.
 * Ensures total is always >= average (for same tag data) and totals match sum of values.
 */

import {
  getRecentAverage,
  getLastPeriodAverage,
  computeTagDisplayStats
} from '../chartStats.js'

describe('chartStats display statistics', () => {
  describe('getRecentAverage()', () => {
    test('returns 0 for null or non-array', () => {
      expect(getRecentAverage(null)).toBe(0)
      expect(getRecentAverage(undefined)).toBe(0)
      expect(getRecentAverage('not an array')).toBe(0)
    })

    test('returns 0 for empty array', () => {
      expect(getRecentAverage([])).toBe(0)
    })

    test('returns 0 when all values in last N days are zero', () => {
      expect(getRecentAverage([0, 0, 0], 3)).toBe(0)
      expect(getRecentAverage([1, 2, 0, 0, 0], 3)).toBe(0)
    })

    test('averages only non-zero values in the last N days', () => {
      expect(getRecentAverage([10, 20], 2)).toBe(15)
      expect(getRecentAverage([0, 10, 20, 0], 4)).toBe(15)
    })

    test('uses last 7 days by default', () => {
      const data = [0, 0, 0, 0, 0, 0, 10, 20]
      expect(getRecentAverage(data)).toBe(15)
    })

    test('respects custom days parameter', () => {
      const data = [1, 2, 3, 4, 5]
      expect(getRecentAverage(data, 3)).toBe(4)
      expect(getRecentAverage(data, 5)).toBe(3)
    })
  })

  describe('getLastPeriodAverage()', () => {
    test('returns 0 for null, non-array, or empty array', () => {
      expect(getLastPeriodAverage(null)).toBe(0)
      expect(getLastPeriodAverage(undefined)).toBe(0)
      expect(getLastPeriodAverage([])).toBe(0)
    })

    test('averages the last period chunk including zeros', () => {
      const data = [10, 20, 30, 40, 50, 60, 70]
      expect(getLastPeriodAverage(data, 7)).toBe(40)
    })

    test('last period can be shorter than periodSize', () => {
      const data = [10, 20, 30]
      const lastPeriodStart = Math.floor((3 - 1) / 7) * 7
      expect(lastPeriodStart).toBe(0)
      expect(getLastPeriodAverage(data, 7)).toBe(20)
    })
  })

  describe('computeTagDisplayStats()', () => {
    const defaultConfig = {
      chartSignificantFigures: 3,
      chartAverageType: 'moving',
      chartTimeTags: [],
      progressHashtagsTotal: [],
      progressMentionsTotal: [],
      progressHashtags: [],
      progressMentions: [],
      progressHashtagsAverage: [],
      progressMentionsAverage: []
    }

    test('returns one stat per tag', () => {
      const tagData = { counts: { '@sleep': [7, 8, 0, 6] }, rawDates: [], timeTags: [] }
      const tags = ['@sleep']
      const result = computeTagDisplayStats(tagData, tags, defaultConfig)
      expect(result).toHaveLength(1)
      expect(result[0]).toHaveProperty('totalDisplay')
      expect(result[0]).toHaveProperty('avgDisplay')
      expect(result[0]).toHaveProperty('avgLineText')
    })

    test('total equals sum of all values in counts for that tag', () => {
      const data = [7, 8, 0, 6, 5]
      const tagData = { counts: { '@sleep': data }, rawDates: [], timeTags: [] }
      const tags = ['@sleep']
      const result = computeTagDisplayStats(tagData, tags, defaultConfig)
      const totalNum = 7 + 8 + 0 + 6 + 5
      expect(Number(result[0].totalDisplay.replace(/,/g, ''))).toBe(totalNum)
    })

    test('average is over non-zero days only and must not exceed total', () => {
      const data = [10, 20, 0, 30]
      const tagData = { counts: { '@steps': data }, rawDates: [], timeTags: [] }
      const tags = ['@steps']
      const result = computeTagDisplayStats(tagData, tags, defaultConfig)
      const totalNum = 60
      const avgNum = Number(result[0].avgDisplay.replace(/,/g, ''))
      expect(avgNum).toBe(20)
      expect(totalNum).toBeGreaterThanOrEqual(avgNum)
    })

    test('invariant: totalDisplay numeric value >= avgDisplay numeric value for same tag', () => {
      const data = [1, 2, 3, 0, 4, 5]
      const tagData = { counts: { '@x': data }, rawDates: [], timeTags: [] }
      const tags = ['@x']
      const result = computeTagDisplayStats(tagData, tags, defaultConfig)
      const totalNum = Number(result[0].totalDisplay.replace(/,/g, ''))
      const avgNum = Number(result[0].avgDisplay.replace(/,/g, ''))
      expect(totalNum).toBeGreaterThanOrEqual(avgNum)
    })

    test('multiple tags: each total is sum of that tag’s counts', () => {
      const tagData = {
        counts: {
          '@a': [1, 2, 3],
          '@b': [10, 20]
        },
        rawDates: [],
        timeTags: []
      }
      const tags = ['@a', '@b']
      const result = computeTagDisplayStats(tagData, tags, defaultConfig)
      expect(Number(result[0].totalDisplay.replace(/,/g, ''))).toBe(6)
      expect(Number(result[1].totalDisplay.replace(/,/g, ''))).toBe(30)
    })

    test('missing tag in counts yields zero total and zero average', () => {
      const tagData = { counts: { '@other': [1, 2, 3] }, rawDates: [], timeTags: [] }
      const tags = ['@missing']
      const result = computeTagDisplayStats(tagData, tags, defaultConfig)
      expect(result[0].totalDisplay).toBe('0')
      expect(result[0].avgDisplay).toBe('0')
    })

    test('total and average use same data source (no mismatch)', () => {
      const data = [5, 10, 15, 20, 25]
      const tagData = { counts: { '@m': data }, rawDates: [], timeTags: [] }
      const tags = ['@m']
      const result = computeTagDisplayStats(tagData, tags, defaultConfig)
      const totalFromSum = data.reduce((s, v) => s + v, 0)
      const totalDisplayed = Number(result[0].totalDisplay.replace(/,/g, ''))
      expect(totalDisplayed).toBe(totalFromSum)
      const validData = data.filter((v) => Number(v) > 0)
      const expectedAvg = validData.reduce((s, v) => s + v, 0) / validData.length
      const avgDisplayed = Number(result[0].avgDisplay.replace(/,/g, ''))
      expect(avgDisplayed).toBe(expectedAvg)
      expect(totalDisplayed).toBeGreaterThanOrEqual(avgDisplayed)
    })

    describe('time-based data (e.g. @sleep(7:20), @sleep(7:30), @sleep(7:40))', () => {
      const timeConfig = {
        ...defaultConfig,
        chartTimeTags: ['@sleep']
      }

      test('average of 7:20, 7:30, 7:40 is displayed as 7:30', () => {
        const hours7_20 = 7 + 20 / 60
        const hours7_30 = 7.5
        const hours7_40 = 7 + 40 / 60
        const tagData = {
          counts: { '@sleep': [hours7_20, hours7_30, hours7_40] },
          rawDates: [],
          timeTags: ['@sleep']
        }
        const tags = ['@sleep']
        const result = computeTagDisplayStats(tagData, tags, timeConfig)
        expect(result[0].avgDisplay).toBe('7:30')
      })

      test('total of 7:20, 7:30, 7:40 is displayed as 22:30 (sum of decimal hours)', () => {
        const hours7_20 = 7 + 20 / 60
        const hours7_30 = 7.5
        const hours7_40 = 7 + 40 / 60
        const tagData = {
          counts: { '@sleep': [hours7_20, hours7_30, hours7_40] },
          rawDates: [],
          timeTags: ['@sleep']
        }
        const tags = ['@sleep']
        const result = computeTagDisplayStats(tagData, tags, timeConfig)
        expect(result[0].totalDisplay).toBe('22:30')
      })

      test('time tag with zero in data: average and total exclude zero from average count', () => {
        const hours7 = 7 + 0 / 60
        const hours8 = 8 + 0 / 60
        const tagData = {
          counts: { '@sleep': [hours7, 0, hours8] },
          rawDates: [],
          timeTags: ['@sleep']
        }
        const tags = ['@sleep']
        const result = computeTagDisplayStats(tagData, tags, timeConfig)
        expect(result[0].avgDisplay).toBe('7:30')
        expect(result[0].totalDisplay).toBe('15:00')
      })

      test('time tag with no data shows --:-- for average and 0 for total', () => {
        const tagData = {
          counts: { '@sleep': [0, 0, 0] },
          rawDates: [],
          timeTags: ['@sleep']
        }
        const tags = ['@sleep']
        const result = computeTagDisplayStats(tagData, tags, timeConfig)
        expect(result[0].avgDisplay).toBe('--:--')
        expect(result[0].totalDisplay).toBe('0')
      })

      test('time tag can be provided via config.chartTimeTags only', () => {
        const tagData = {
          counts: { '@sleep': [7.5] },
          rawDates: [],
          timeTags: []
        }
        const configTimeTagsOnly = { ...defaultConfig, chartTimeTags: ['@sleep'] }
        const tags = ['@sleep']
        const result = computeTagDisplayStats(tagData, tags, configTimeTagsOnly)
        expect(result[0].avgDisplay).toBe('7:30')
        expect(result[0].totalDisplay).toBe('7:30')
      })
    })
  })
})
