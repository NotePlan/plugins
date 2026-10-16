// @flow
/* eslint-disable */
/* globals describe, expect, test */

import { mapReviewDaysToStatus, reviewIntervalToDays, reviewStatusLimits } from '../projectsHTMLGenerator'

describe('reviewIntervalToDays', () => {
  test('uses nominal day lengths', () => {
    expect(reviewIntervalToDays('3d')).toBe(3)
    expect(reviewIntervalToDays('1w')).toBe(7)
    expect(reviewIntervalToDays('2w')).toBe(14)
    expect(reviewIntervalToDays('1m')).toBe(30)
    expect(reviewIntervalToDays('3m')).toBe(90)
    expect(reviewIntervalToDays('1q')).toBe(91)
    expect(reviewIntervalToDays('1y')).toBe(365)
    expect(reviewIntervalToDays('5b')).toBe(5)
  })

  test('returns NaN for a missing or invalid interval', () => {
    expect(reviewIntervalToDays('')).toBeNaN()
    expect(reviewIntervalToDays('weekly')).toBeNaN()
  })
})

describe('reviewStatusLimits', () => {
  test('tightens a few-day interval and caps a long one at 7 / 2 / 5 days', () => {
    expect(reviewStatusLimits('3d')).toEqual({ soonLimit: 1, nowLimit: 1, lateLimit: 0 })
    expect(reviewStatusLimits('1w')).toEqual({ soonLimit: 2, nowLimit: 1, lateLimit: 1 })
    expect(reviewStatusLimits('2w')).toEqual({ soonLimit: 4, nowLimit: 1, lateLimit: 1 })
    expect(reviewStatusLimits('1m')).toEqual({ soonLimit: 7, nowLimit: 1, lateLimit: 3 })
    expect(reviewStatusLimits('3m')).toEqual({ soonLimit: 7, nowLimit: 2, lateLimit: 5 })
    expect(reviewStatusLimits('1y')).toEqual({ soonLimit: 7, nowLimit: 2, lateLimit: 5 })
  })

  test('an unparseable interval uses the caps', () => {
    expect(reviewStatusLimits('')).toEqual({ soonLimit: 7, nowLimit: 2, lateLimit: 5 })
  })
})

describe('mapReviewDaysToStatus', () => {
  test('a 3-day review is now today and overdue from the next day', () => {
    expect(mapReviewDaysToStatus(1, '3d').text).toBe('')
    expect(mapReviewDaysToStatus(0, '3d').text).toBe('review now')
    expect(mapReviewDaysToStatus(-1, '3d').text).toBe('overdue')
  })

  test('a weekly review is soon tomorrow, now today or 1 day late, and overdue when 2 days late', () => {
    expect(mapReviewDaysToStatus(2, '1w').text).toBe('')
    expect(mapReviewDaysToStatus(1, '1w').text).toBe('review soon')
    expect(mapReviewDaysToStatus(0, '1w').text).toBe('review now')
    expect(mapReviewDaysToStatus(-1, '1w').text).toBe('review now')
    expect(mapReviewDaysToStatus(-2, '1w').text).toBe('overdue')
  })

  test('a 3-month review uses the 7 / 2 / 5 day caps', () => {
    expect(mapReviewDaysToStatus(7, '3m').text).toBe('')
    expect(mapReviewDaysToStatus(6, '3m').text).toBe('review soon')
    expect(mapReviewDaysToStatus(2, '3m').text).toBe('review soon')
    expect(mapReviewDaysToStatus(1, '3m').text).toBe('review now')
    expect(mapReviewDaysToStatus(-5, '3m').text).toBe('review now')
    expect(mapReviewDaysToStatus(-6, '3m').text).toBe('overdue')
  })
})
