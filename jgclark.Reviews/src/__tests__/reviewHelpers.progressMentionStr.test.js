// @flow
/* globals describe, expect, test, jest, beforeEach, afterEach */

import { getTodaysDateHyphenated } from '@helpers/dateTime'
import {
  formatProgressCommentString,
  getProgressFieldNameForBodyLines,
  getProgressFrontmatterKey,
  parseProgressValueString,
} from '../reviewHelpers'

const preferenceValues: { [string]: any } = {}
global.DataStore = {
  preference: (key: string): any => preferenceValues[key] ?? '',
}

describe('reviewHelpers progressStr helpers', () => {
  test('uses default progress key and capitalised body prefix when preference is unset', () => {
    delete preferenceValues.progressStr
    expect(getProgressFieldNameForBodyLines()).toBe('Progress')
  })

  test('uses configured progress key from preference', () => {
    preferenceValues.progressStr = '@fortschritt'
    expect(getProgressFieldNameForBodyLines()).toBe('Fortschritt')
    expect(getProgressFrontmatterKey()).toBe('fortschritt')
  })

  describe('parseProgressValueString', () => {
    test('parses percent, date, and comment from canonical frontmatter value', () => {
      const parsed = parseProgressValueString('30@20260523 Started')
      expect(parsed.percentComplete).toBe(30)
      expect(parsed.comment).toBe('Started')
    })

    test('parses body line content with field prefix', () => {
      const parsed = parseProgressValueString('Progress: 40@20260523 Body comment')
      expect(parsed.percentComplete).toBe(40)
      expect(parsed.comment).toBe('Body comment')
    })

    test('parses body line with ISO date (preferred write form)', () => {
      const parsed = parseProgressValueString('Progress: 40@2026-05-23 Body comment')
      expect(parsed.percentComplete).toBe(40)
      expect(parsed.comment).toBe('Body comment')
    })

    test('returns NaN percent when value has date and comment only', () => {
      const parsed = parseProgressValueString('@20260523 Started')
      expect(parsed.percentComplete).toBeNaN()
      expect(parsed.comment).toBe('Started')
    })
  })

  describe('formatProgressCommentString', () => {
    test('formats comment with percent and today as YYYY-MM-DD by default', () => {
      const today = getTodaysDateHyphenated()
      expect(formatProgressCommentString('On track', 50)).toBe(`50@${today} On track`)
    })

    test('formats comment without percent when omitted', () => {
      const today = getTodaysDateHyphenated()
      expect(formatProgressCommentString('Started')).toBe(`@${today} Started`)
    })

    test('keeps ISO override date unchanged', () => {
      expect(formatProgressCommentString('Midpoint', 25, '2026-01-15')).toBe('25@2026-01-15 Midpoint')
    })

    test('normalises YYYYMMDD override date to ISO', () => {
      expect(formatProgressCommentString('Done', 100, '20260101')).toBe('100@2026-01-01 Done')
    })
  })
})
