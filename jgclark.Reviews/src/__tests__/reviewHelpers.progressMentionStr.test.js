// @flow
/* globals describe, expect, test, jest, beforeEach, afterEach */

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
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-23T12:00:00').getTime())
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

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

    test('returns NaN percent when value has date and comment only', () => {
      const parsed = parseProgressValueString('@20260523 Started')
      expect(parsed.percentComplete).toBeNaN()
      expect(parsed.comment).toBe('Started')
    })
  })

  describe('formatProgressCommentString', () => {
    test('formats comment with percent and today as YYYYMMDD by default', () => {
      expect(formatProgressCommentString('On track', 50)).toBe('50@20260523 On track')
    })

    test('formats comment without percent when omitted', () => {
      expect(formatProgressCommentString('Started')).toBe('@20260523 Started')
    })

    test('normalises ISO override date to YYYYMMDD', () => {
      expect(formatProgressCommentString('Midpoint', 25, '2026-01-15')).toBe('25@20260115 Midpoint')
    })

    test('accepts YYYYMMDD override date unchanged', () => {
      expect(formatProgressCommentString('Done', 100, '20260101')).toBe('100@20260101 Done')
    })
  })
})
