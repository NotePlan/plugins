// @flow
/* eslint-disable flowtype/require-valid-file-annotation */
/* globals describe, it, expect */

import moment from 'moment/min/moment-with-locales'
import { parseTagMentionCacheTimestamp, serializeTagMentionCacheTimestamp } from '../src/tagMentionCache'

describe('tagMentionCache timestamps', () => {
  it('serializeTagMentionCacheTimestamp writes ISO UTC', () => {
    const when = new Date('2026-05-31T20:07:41.123Z')
    expect(serializeTagMentionCacheTimestamp(when)).toBe('2026-05-31T20:07:41.123Z')
  })

  it('parseTagMentionCacheTimestamp reads ISO string and Date to the same instant', () => {
    const iso = '2026-05-31T20:07:41.123Z'
    const fromString = parseTagMentionCacheTimestamp(iso)
    const fromDate = parseTagMentionCacheTimestamp(new Date(iso))
    expect(fromString).not.toBeNull()
    expect(fromDate).not.toBeNull()
    expect(fromString?.getTime()).toBe(fromDate?.getTime())
    expect(fromString?.getTime()).toBe(Date.parse(iso))
  })

  it('parseTagMentionCacheTimestamp returns null for invalid values', () => {
    expect(parseTagMentionCacheTimestamp(null)).toBeNull()
    expect(parseTagMentionCacheTimestamp('')).toBeNull()
    expect(parseTagMentionCacheTimestamp('not-a-date')).toBeNull()
  })

  it('age in minutes is timezone-independent for ISO file timestamp vs local now', () => {
    const start = new Date('2026-05-31T20:07:41.000Z')
    const iso = serializeTagMentionCacheTimestamp(start)
    const parsed = parseTagMentionCacheTimestamp(iso)
    const now = moment('2026-05-31T23:08:01+03:00')
    const ageMins = now.diff(moment(parsed), 'minutes', true)
    expect(ageMins).toBeCloseTo(0.33, 1)
  })
})
