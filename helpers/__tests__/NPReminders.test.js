/* globals describe, expect, test, jest, beforeEach, afterEach */
// Last updated 2026-08-01 for v2.4.0.b60 by @CursorAI

import { CustomConsole } from '@jest/console'
import { DataStore, Editor, CommandBar, NotePlan, simpleFormatter } from '@mocks/index'
import {
  buildReminderDisplayByIdFromReminders,
  extractReminderIdsFromTaskContent,
  compareRemindersByTimePriorityDate,
  dedupeReminderListTitles,
  filterRemindersWhoseTimeHasBeenReached,
  getEnabledReminderLists,
  getReminderMarkerColors,
  getAllAccessibleReminderLists,
  getReminderLocalDateAndTime,
  mapAppleReminderPriorityToNotePlan,
  mapCalendarItemToReminder,
  mapNotePlanPriorityToAppleReminder,
  parseLeadingPriorityFromReminderText,
  reminderHasTime,
  reminderTimeHasBeenReached,
  resolveReminderListsByNames,
  sortRemindersByTimePriorityDate,
} from '../NPReminders.js'

global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan
global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
DataStore.settings['_logLevel'] = 'none'

jest.mock('@helpers/NPVersions', () => ({
  usersVersionHas: jest.fn(() => true),
}))

const { usersVersionHas } = require('@helpers/NPVersions')

const PLUGIN_NAME = 'helpers'
const FILENAME = 'NPReminders'

const ALL_LISTS = [
  { title: 'Reminders', color: '#FF3B30', isEnabled: true },
  { title: 'Work', color: '#007AFF', isEnabled: true },
  { title: 'Home', color: '#34C759', isEnabled: false },
  { title: 'Shopping', color: '#AF52DE', isEnabled: false },
]

/**
 * @param {string} title
 * @param {{ date?: string, time?: string, priority?: number }} fields
 * @returns {any}
 */
function makeReminder(title, fields = {}) {
  return {
    title,
    listname: 'Test',
    flagged: false,
    date: fields.date,
    time: fields.time,
    priority: fields.priority,
  }
}

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    beforeEach(() => {
      jest.restoreAllMocks()
      usersVersionHas.mockImplementation(() => true)
      global.Calendar = {
        availableReminderLists: jest.fn((options) => {
          if (options && options.enabledOnly) {
            return ALL_LISTS.filter((l) => l.isEnabled)
          }
          return ALL_LISTS
        }),
        availableReminderListTitles: jest.fn(() => ALL_LISTS.map((l) => l.title)),
        remindersByLists: jest.fn(async () => []),
      }
    })

    afterEach(() => {
      delete global.Calendar
    })

    describe('dedupeReminderListTitles()', () => {
      test('trims, skips blanks, and preserves first-seen order', () => {
        expect(dedupeReminderListTitles([' Work ', '', 'Home', 'Work', '  '])).toEqual(['Work', 'Home'])
      })
    })

    describe('getEnabledReminderLists() / getAllAccessibleReminderLists()', () => {
      test('getEnabledReminderLists returns only NotePlan-enabled lists with colors', () => {
        const result = getEnabledReminderLists()
        expect(result.titles).toEqual(['Reminders', 'Work'])
        expect(result.colorByTitle).toEqual({
          Reminders: '#FF3B30',
          Work: '#007AFF',
        })
        expect(global.Calendar.availableReminderLists).toHaveBeenCalledWith({ enabledOnly: true })
      })

      test('getAllAccessibleReminderLists returns all lists including disabled', () => {
        const result = getAllAccessibleReminderLists()
        expect(result.titles).toEqual(['Reminders', 'Work', 'Home', 'Shopping'])
        expect(result.colorByTitle.Home).toBe('#34C759')
        expect(global.Calendar.availableReminderLists).toHaveBeenCalledWith()
      })
    })

    describe('resolveReminderListsByNames()', () => {
      test('matches accessible lists including NotePlan-disabled; omits unknown names', () => {
        const result = resolveReminderListsByNames(['Home', 'Work', 'Home', 'NoSuchList'])
        expect(result.titles).toEqual(['Home', 'Work'])
        expect(result.colorByTitle).toEqual({
          Home: '#34C759',
          Work: '#007AFF',
        })
      })
    })

    describe('mapAppleReminderPriorityToNotePlan() / mapNotePlanPriorityToAppleReminder()', () => {
      test('maps Apple 0/1/5/9 to NotePlan 0/3/2/1', () => {
        expect(mapAppleReminderPriorityToNotePlan(0)).toBe(0)
        expect(mapAppleReminderPriorityToNotePlan(1)).toBe(3)
        expect(mapAppleReminderPriorityToNotePlan(5)).toBe(2)
        expect(mapAppleReminderPriorityToNotePlan(9)).toBe(1)
        expect(mapAppleReminderPriorityToNotePlan(undefined)).toBe(0)
        expect(mapAppleReminderPriorityToNotePlan(4)).toBe(0)
      })

      test('mapNotePlanPriorityToAppleReminder is the reverse mapping', () => {
        expect(mapNotePlanPriorityToAppleReminder(0)).toBe(0)
        expect(mapNotePlanPriorityToAppleReminder(3)).toBe(1)
        expect(mapNotePlanPriorityToAppleReminder(2)).toBe(5)
        expect(mapNotePlanPriorityToAppleReminder(1)).toBe(9)
      })
    })

    describe('parseLeadingPriorityFromReminderText()', () => {
      test('parses !!! / !! / ! and strips them from the title', () => {
        expect(parseLeadingPriorityFromReminderText('!!! Urgent call')).toEqual({ title: 'Urgent call', notePlanPriority: 3 })
        expect(parseLeadingPriorityFromReminderText('!! Follow up')).toEqual({ title: 'Follow up', notePlanPriority: 2 })
        expect(parseLeadingPriorityFromReminderText('! Buy milk')).toEqual({ title: 'Buy milk', notePlanPriority: 1 })
      })

      test('leaves text unchanged when there is no leading priority marker', () => {
        expect(parseLeadingPriorityFromReminderText('Just a reminder')).toEqual({ title: 'Just a reminder', notePlanPriority: 0 })
        expect(parseLeadingPriorityFromReminderText('Hello !!! world')).toEqual({ title: 'Hello !!! world', notePlanPriority: 0 })
        expect(parseLeadingPriorityFromReminderText('!!!! not four bangs')).toEqual({ title: '!!!! not four bangs', notePlanPriority: 0 })
      })
    })

    describe('getReminderLocalDateAndTime() / mapCalendarItemToReminder()', () => {
      test('stores only non-zero NotePlan priority on the reminder', () => {
        const base = {
          title: 'T',
          calendar: 'List',
          isCompleted: false,
          isAllDay: true,
          occurences: [],
        }
        expect(mapCalendarItemToReminder({ ...base, priority: 1 }).priority).toBe(3)
        expect(mapCalendarItemToReminder({ ...base, priority: 5 }).priority).toBe(2)
        expect(mapCalendarItemToReminder({ ...base, priority: 9 }).priority).toBe(1)
        expect(mapCalendarItemToReminder({ ...base, priority: 0 }).priority).toBeUndefined()
        expect(mapCalendarItemToReminder({ ...base }).priority).toBeUndefined()
      })

      test('returns empty date/time for undated (no occurences) or epoch dates', () => {
        expect(
          getReminderLocalDateAndTime({
            title: 'U',
            calendar: 'L',
            isCompleted: false,
            isAllDay: true,
            date: new Date('1970-01-01T00:00:00.000Z'),
            occurences: [{ startDate: new Date() }],
          }),
        ).toEqual({})
        expect(
          getReminderLocalDateAndTime({
            title: 'U',
            calendar: 'L',
            isCompleted: false,
            isAllDay: true,
            date: new Date('2026-08-01T12:00:00.000Z'),
            occurences: [],
          }),
        ).toEqual({})
      })

      test('returns local date and time for a dated timed reminder', () => {
        const dateObj = new Date(2026, 7, 1, 14, 30, 0) // local Aug 1 2026 14:30
        const result = getReminderLocalDateAndTime({
          title: 'Timed',
          calendar: 'L',
          isCompleted: false,
          isAllDay: false,
          date: dateObj,
          occurences: [{ startDate: dateObj }],
        })
        expect(result.date).toBe('2026-08-01')
        expect(result.time).toBe('14:30')
      })
    })

    describe('reminderHasTime() / reminderTimeHasBeenReached() / filterRemindersWhoseTimeHasBeenReached()', () => {
      test('reminderHasTime requires non-empty time', () => {
        expect(reminderHasTime({ time: '09:00' })).toBe(true)
        expect(reminderHasTime({ time: '  ' })).toBe(false)
        expect(reminderHasTime({})).toBe(false)
      })

      test('reminderTimeHasBeenReached compares HH:mm to now', () => {
        expect(reminderTimeHasBeenReached({ time: '00:01' })).toBe(true)
        expect(reminderTimeHasBeenReached({ time: '23:59' })).toBe(false)
        expect(reminderTimeHasBeenReached({})).toBe(false)
      })

      test('filterRemindersWhoseTimeHasBeenReached keeps only due-now timed reminders', () => {
        const reminders = [makeReminder('past', { time: '00:01' }), makeReminder('future', { time: '23:59' }), makeReminder('untimed')]
        expect(filterRemindersWhoseTimeHasBeenReached(reminders).map((r) => r.title)).toEqual(['past'])
      })
    })

    describe('sortRemindersByTimePriorityDate() / compareRemindersByTimePriorityDate()', () => {
      test('sorts by time, then priority desc, then date', () => {
        const reminders = [
          makeReminder('Late low', { date: '2026-07-20', time: '18:00', priority: 1 }),
          makeReminder('Early high', { date: '2026-07-22', time: '09:00', priority: 3 }),
          makeReminder('Early low', { date: '2026-07-21', time: '09:00', priority: 1 }),
          makeReminder('Untimed med', { date: '2026-07-10', priority: 2 }),
          makeReminder('Untimed high', { date: '2026-07-28', priority: 3 }),
        ]
        expect(sortRemindersByTimePriorityDate(reminders).map((r) => r.title)).toEqual([
          'Early high',
          'Early low',
          'Late low',
          'Untimed high',
          'Untimed med',
        ])
        expect(compareRemindersByTimePriorityDate(reminders[1], reminders[2])).toBeLessThan(0)
      })
    })
  })

  describe('getReminderMarkerColors() / buildReminderDisplayByIdFromReminders()', () => {
    test('getReminderMarkerColors uses list colour when provided', () => {
      const { color, backgroundColor } = getReminderMarkerColors('#FF3B30')
      expect(color).toBe('#FF3B30')
      expect(backgroundColor).toContain('255')
    })

    test('getReminderMarkerColors falls back to theme CSS vars without list colour', () => {
      const { color, backgroundColor } = getReminderMarkerColors()
      expect(color).toContain('--fg-reminderMarker')
      expect(backgroundColor).toContain('--bg-reminderMarker')
    })

    test('buildReminderDisplayByIdFromReminders maps id to colour and time', () => {
      const map = buildReminderDisplayByIdFromReminders([
        { id: 'abc', title: 'One', listname: 'Home', color: '#34C759', time: '10:00' },
        { title: 'No id', listname: 'Home' },
      ])
      expect(map.abc).toEqual({ color: '#34C759', time: '10:00' })
      expect(Object.keys(map)).toHaveLength(1)
    })

    test('extractReminderIdsFromTaskContent finds strict @remind(UUID) tokens', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000'
      expect(extractReminderIdsFromTaskContent(`Buy milk @remind(:::${uuid})`)).toEqual([uuid])
      expect(extractReminderIdsFromTaskContent('No reminder link')).toEqual([])
    })
  })
})
