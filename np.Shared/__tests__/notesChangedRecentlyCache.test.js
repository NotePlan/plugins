// @flow
/* globals beforeEach, describe, expect, jest, test */
// Tests for Shared notes-changed-recently cache (Phase A)

import moment from 'moment/min/moment-with-locales'
import {
  filterNotesChangedRecentlyEntries,
  getFilenamesChangedRecently,
  getFilenamesChangedSince,
  getFilenamesChangedToday,
  getNotesChangedRecently,
  getNotesChangedRecentlyWindowStart,
  isNotesChangedRecentlyCacheAvailable,
  isNotesChangedRecentlyCacheGenerationScheduled,
  NOTES_CHANGED_RECENTLY_CACHE_FILE,
  NOTES_CHANGED_RECENTLY_WINDOW_DAYS,
  noteToNotesChangedRecentlyEntry,
  parseNotesChangedRecentlyCacheJson,
  pruneNotesChangedRecentlyEntries,
  scheduleNotesChangedRecentlyCacheGeneration,
  clearNotesChangedRecentlyGenerationSchedule,
  updateNotesChangedRecentlyCache,
  generateNotesChangedRecentlyCache,
} from '../src/notesChangedRecentlyCache'
import { DataStore, NotePlan } from '@mocks/index'

jest.mock('@helpers/NPnote', () => ({
  getNotesChangedInLastCalendarDays: jest.fn(() => []),
}))

jest.mock('@helpers/NPVersions', () => ({
  usersVersionHas: jest.fn(() => false),
}))

const { getNotesChangedInLastCalendarDays } = require('@helpers/NPnote')
const mockGetNotesChangedInLastCalendarDays: any = getNotesChangedInLastCalendarDays

global.DataStore = DataStore
global.NotePlan = NotePlan
DataStore.settings = DataStore.settings || {}
DataStore.settings._logLevel = 'none'

describe('getNotesChangedRecentlyWindowStart', () => {
  test('7 calendar days means start of day 6 days before today', () => {
    const now = new Date('2026-09-18T15:00:00')
    const start = getNotesChangedRecentlyWindowStart(7, now)
    expect(moment(start).format('YYYY-MM-DD')).toBe('2026-09-12')
  })

  test('1 calendar day is start of today', () => {
    const now = new Date('2026-09-18T15:00:00')
    const start = getNotesChangedRecentlyWindowStart(1, now)
    expect(moment(start).format('YYYY-MM-DD')).toBe('2026-09-18')
  })
})

describe('pruneNotesChangedRecentlyEntries', () => {
  test('drops entries before window start', () => {
    const windowStart = moment('2026-09-12').startOf('day').toDate()
    const notes = [
      {
        filename: 'old.md',
        noteType: 'Notes',
        changedAt: moment(windowStart).subtract(1, 'hour').toISOString(),
      },
      {
        filename: 'keep.md',
        noteType: 'Notes',
        changedAt: moment(windowStart).add(1, 'hour').toISOString(),
      },
      {
        filename: 'today.md',
        noteType: 'Calendar',
        changedAt: moment('2026-09-18').startOf('day').add(10, 'hours').toISOString(),
      },
    ]
    const pruned = pruneNotesChangedRecentlyEntries(notes, windowStart)
    expect(pruned.map((n) => n.filename)).toEqual(['keep.md', 'today.md'])
  })
})

describe('filterNotesChangedRecentlyEntries', () => {
  const notes = [
    { filename: 'a.md', noteType: 'Notes', changedAt: '2026-09-18T10:00:00.000Z' },
    { filename: '20260918.md', noteType: 'Calendar', changedAt: '2026-09-18T10:00:00.000Z' },
  ]

  test('returns all when noteTypes omitted', () => {
    expect(filterNotesChangedRecentlyEntries(notes, {})).toHaveLength(2)
  })

  test('filters to Notes only', () => {
    expect(filterNotesChangedRecentlyEntries(notes, { noteTypes: ['Notes'] }).map((n) => n.filename)).toEqual(['a.md'])
  })

  test('filters to Calendar only', () => {
    expect(filterNotesChangedRecentlyEntries(notes, { noteTypes: ['Calendar'] }).map((n) => n.filename)).toEqual([
      '20260918.md',
    ])
  })
})

describe('parseNotesChangedRecentlyCacheJson', () => {
  test('parses valid body', () => {
    const raw = JSON.stringify({
      generatedAt: '2026-09-18T14:00:00.000Z',
      lastUpdated: '2026-09-18T15:00:00.000Z',
      windowDays: 7,
      notes: [{ filename: 'x.md', noteType: 'Notes', changedAt: '2026-09-18T12:00:00.000Z' }],
    })
    const parsed = parseNotesChangedRecentlyCacheJson(raw)
    expect(parsed).not.toBeNull()
    expect(parsed && parsed.notes).toHaveLength(1)
    expect(parsed && parsed.windowDays).toBe(7)
  })

  test('returns null for invalid JSON', () => {
    expect(parseNotesChangedRecentlyCacheJson('not-json')).toBeNull()
  })

  test('returns null when notes is not an array', () => {
    expect(parseNotesChangedRecentlyCacheJson(JSON.stringify({ notes: {} }))).toBeNull()
  })
})

describe('noteToNotesChangedRecentlyEntry', () => {
  test('maps note fields', () => {
    const entry = noteToNotesChangedRecentlyEntry({
      filename: 'Projects/A.md',
      type: 'Notes',
      changedDate: new Date('2026-09-18T12:00:00.000Z'),
    })
    expect(entry).toEqual({
      filename: 'Projects/A.md',
      noteType: 'Notes',
      changedAt: '2026-09-18T12:00:00.000Z',
    })
  })

  test('returns null without filename or changedDate', () => {
    expect(noteToNotesChangedRecentlyEntry({ filename: '', type: 'Notes', changedDate: new Date() })).toBeNull()
    expect(noteToNotesChangedRecentlyEntry({ filename: 'a.md', type: 'Notes', changedDate: null })).toBeNull()
  })
})

describe('sync reads and schedule prefs', () => {
  let files: { [string]: string }
  let prefs: { [string]: any }

  beforeEach(() => {
    files = {}
    prefs = {}
    DataStore.fileExists = jest.fn((f) => f in files)
    DataStore.loadData = jest.fn((f) => files[f] ?? '')
    DataStore.saveData = jest.fn((content, f) => {
      files[f] = content
    })
    DataStore.preference = jest.fn((key) => prefs[key])
    DataStore.setPreference = jest.fn((key, value) => {
      if (value == null) {
        delete prefs[key]
      } else {
        prefs[key] = value
      }
    })
    mockGetNotesChangedInLastCalendarDays.mockReset()
    mockGetNotesChangedInLastCalendarDays.mockReturnValue([])
  })

  test('isNotesChangedRecentlyCacheAvailable false when missing', () => {
    expect(isNotesChangedRecentlyCacheAvailable()).toBe(false)
  })

  test('getNotesChangedRecently returns [] when missing', () => {
    expect(getNotesChangedRecently()).toEqual([])
    expect(getFilenamesChangedRecently()).toEqual([])
    expect(getFilenamesChangedToday()).toEqual([])
  })

  test('reads and filters from disk', () => {
    const todayIso = moment().startOf('day').add(2, 'hours').toISOString()
    const yesterdayIso = moment().startOf('day').subtract(1, 'day').add(3, 'hours').toISOString()
    files[NOTES_CHANGED_RECENTLY_CACHE_FILE] = JSON.stringify({
      generatedAt: todayIso,
      lastUpdated: todayIso,
      windowDays: NOTES_CHANGED_RECENTLY_WINDOW_DAYS,
      notes: [
        { filename: 'proj.md', noteType: 'Notes', changedAt: todayIso },
        { filename: '20260101.md', noteType: 'Calendar', changedAt: yesterdayIso },
      ],
    })
    expect(isNotesChangedRecentlyCacheAvailable()).toBe(true)
    expect(getFilenamesChangedRecently({ noteTypes: ['Notes'] })).toEqual(['proj.md'])
    expect(getFilenamesChangedToday()).toEqual(['proj.md'])
    expect(getFilenamesChangedSince(moment().startOf('day').subtract(2, 'days').toDate()).sort()).toEqual(
      ['20260101.md', 'proj.md'].sort(),
    )
  })

  test('schedule / clear generation pref', () => {
    expect(isNotesChangedRecentlyCacheGenerationScheduled()).toBe(false)
    scheduleNotesChangedRecentlyCacheGeneration()
    expect(isNotesChangedRecentlyCacheGenerationScheduled()).toBe(true)
    clearNotesChangedRecentlyGenerationSchedule()
    expect(isNotesChangedRecentlyCacheGenerationScheduled()).toBe(false)
  })

  test('update with missing cache generates immediately', async () => {
    const changedAt = new Date()
    mockGetNotesChangedInLastCalendarDays.mockReturnValue([
      { filename: 'Areas/Finance.md', type: 'Notes', changedDate: changedAt },
    ])
    await updateNotesChangedRecentlyCache()
    expect(NOTES_CHANGED_RECENTLY_CACHE_FILE in files).toBe(true)
    expect(isNotesChangedRecentlyCacheGenerationScheduled()).toBe(false)
    const parsed = parseNotesChangedRecentlyCacheJson(files[NOTES_CHANGED_RECENTLY_CACHE_FILE])
    expect(parsed && parsed.notes.map((n) => n.filename)).toEqual(['Areas/Finance.md'])
  })

  test('generate writes cache from scan results', async () => {
    const changedAt = new Date()
    mockGetNotesChangedInLastCalendarDays.mockReturnValue([
      { filename: 'Areas/Finance.md', type: 'Notes', changedDate: changedAt },
      { filename: '20260918.md', type: 'Calendar', changedDate: changedAt },
    ])
    await generateNotesChangedRecentlyCache('test')
    expect(NOTES_CHANGED_RECENTLY_CACHE_FILE in files).toBe(true)
    const parsed = parseNotesChangedRecentlyCacheJson(files[NOTES_CHANGED_RECENTLY_CACHE_FILE])
    expect(parsed).not.toBeNull()
    expect(parsed && parsed.notes.map((n) => n.filename).sort()).toEqual(['20260918.md', 'Areas/Finance.md'])
    expect(parsed && parsed.windowDays).toBe(7)
    expect(isNotesChangedRecentlyCacheGenerationScheduled()).toBe(false)
  })
})
