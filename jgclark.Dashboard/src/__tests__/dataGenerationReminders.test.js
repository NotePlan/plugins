/* globals describe, expect, test, jest, beforeEach, afterEach */
// Last updated 2026-08-01 for v2.4.0.b60 by @CursorAI

import { CustomConsole } from '@jest/console'
import moment from 'moment/min/moment-with-locales'
import { DataStore, Editor, CommandBar, NotePlan, simpleFormatter } from '@mocks/index'
import { bucketReminderItems, sortReminderSectionItems } from '../reminderBuckets.js'
import {
  dedupeReminderListTitles,
  getEnabledReminderLists,
  getReminderListsForConfig,
  mapAppleReminderPriorityToDashboard,
  mapCalendarItemToReminderForDashboard,
  mapDashboardPriorityToAppleReminder,
  parseLeadingPriorityFromReminderText,
} from '../reminderMapping.js'
import { getTodaysDateHyphenated } from '@helpers/dateTime'

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

const PLUGIN_NAME = 'jgclark.Dashboard'
const FILENAME = 'dataGenerationReminders'

const ALL_LISTS = [
  { title: 'Reminders', color: '#FF3B30', isEnabled: true },
  { title: 'Work', color: '#007AFF', isEnabled: true },
  { title: 'Home', color: '#34C759', isEnabled: false },
  { title: 'Shopping', color: '#AF52DE', isEnabled: false },
]

/**
 * Build a minimal reminder TSectionItem for bucketing tests.
 * @param {string} id
 * @param {{ date?: string, time?: string, title?: string, priority?: number }} fields
 * @returns {any}
 */
function makeReminderItem(id, fields = {}) {
  return {
    ID: id,
    sectionCode: 'REM',
    itemType: 'reminder',
    reminder: {
      title: fields.title || id,
      listname: 'Test',
      flagged: false,
      date: fields.date,
      time: fields.time,
      priority: fields.priority,
    },
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

    describe('getEnabledReminderLists()', () => {
      test('returns only NotePlan-enabled lists with colors', () => {
        const result = getEnabledReminderLists()
        expect(result.titles).toEqual(['Reminders', 'Work'])
        expect(result.colorByTitle).toEqual({
          Reminders: '#FF3B30',
          Work: '#007AFF',
        })
        expect(global.Calendar.availableReminderLists).toHaveBeenCalledWith({ enabledOnly: true })
      })
    })

    describe('getReminderListsForConfig()', () => {
      test('blank includedReminderLists falls back to NotePlan-enabled lists', () => {
        const result = getReminderListsForConfig({ includedReminderLists: '' })
        expect(result.titles).toEqual(['Reminders', 'Work'])
        expect(global.Calendar.availableReminderLists).toHaveBeenCalledWith({ enabledOnly: true })
      })

      test('missing includedReminderLists falls back to NotePlan-enabled lists', () => {
        const result = getReminderListsForConfig({})
        expect(result.titles).toEqual(['Reminders', 'Work'])
      })

      test('parses CSV, dedupes, and matches accessible lists including NotePlan-disabled', () => {
        const result = getReminderListsForConfig({
          includedReminderLists: 'Home, Work, Home, Shopping',
        })
        expect(result.titles).toEqual(['Home', 'Work', 'Shopping'])
        expect(result.colorByTitle).toEqual({
          Home: '#34C759',
          Work: '#007AFF',
          Shopping: '#AF52DE',
        })
        // Override path uses all accessible lists (not enabledOnly)
        expect(global.Calendar.availableReminderLists).toHaveBeenCalledWith()
      })

      test('omits configured names that are not accessible', () => {
        const result = getReminderListsForConfig({
          includedReminderLists: 'Work, NoSuchList',
        })
        expect(result.titles).toEqual(['Work'])
      })
    })

    describe('bucketReminderItems()', () => {
      test('splits today timed/untimed, yesterday, tomorrow, past, undated; drops future', () => {
        const today = getTodaysDateHyphenated()
        const yesterday = moment().subtract(1, 'days').format('YYYY-MM-DD')
        const tomorrow = moment().add(1, 'days').format('YYYY-MM-DD')
        const past = moment().subtract(5, 'days').format('YYYY-MM-DD')
        const future = moment().add(3, 'days').format('YYYY-MM-DD')

        const items = [
          makeReminderItem('timed', { date: today, time: '09:00', title: 'Timed today' }),
          makeReminderItem('untimed', { date: today, title: 'Untimed today' }),
          makeReminderItem('yest', { date: yesterday, title: 'Yesterday' }),
          makeReminderItem('tom', { date: tomorrow, title: 'Tomorrow' }),
          makeReminderItem('past', { date: past, title: 'Past' }),
          makeReminderItem('undated', { title: 'Undated' }),
          makeReminderItem('future', { date: future, title: 'Future' }),
        ]

        const buckets = bucketReminderItems(items)
        expect(buckets.timedTodayItems.map((i) => i.ID)).toEqual(['timed'])
        expect(buckets.untimedTodayItems.map((i) => i.ID)).toEqual(['untimed'])
        expect(buckets.yesterdayItems.map((i) => i.ID)).toEqual(['yest'])
        expect(buckets.tomorrowItems.map((i) => i.ID)).toEqual(['tom'])
        expect(buckets.overdueItems.map((i) => i.ID)).toEqual(['past'])
        expect(buckets.undatedItems.map((i) => i.ID)).toEqual(['undated'])
      })
    })

    describe('sortReminderSectionItems()', () => {
      test('sorts by time, then priority desc, then date', () => {
        const items = [
          makeReminderItem('late-low', { date: '2026-07-20', time: '18:00', priority: 1, title: 'Late low' }),
          makeReminderItem('early-high', { date: '2026-07-22', time: '09:00', priority: 3, title: 'Early high' }),
          makeReminderItem('early-low', { date: '2026-07-21', time: '09:00', priority: 1, title: 'Early low' }),
          makeReminderItem('untimed-med', { date: '2026-07-10', priority: 2, title: 'Untimed med' }),
          makeReminderItem('untimed-high', { date: '2026-07-28', priority: 3, title: 'Untimed high' }),
        ]
        expect(sortReminderSectionItems(items).map((i) => i.ID)).toEqual([
          'early-high',
          'early-low',
          'late-low',
          'untimed-high',
          'untimed-med',
        ])
      })
    })

    describe('mapAppleReminderPriorityToDashboard() / mapCalendarItemToReminderForDashboard()', () => {
      test('maps Apple 0/1/5/9 to Dashboard 0/3/2/1', () => {
        expect(mapAppleReminderPriorityToDashboard(0)).toBe(0)
        expect(mapAppleReminderPriorityToDashboard(1)).toBe(3) // high
        expect(mapAppleReminderPriorityToDashboard(5)).toBe(2) // medium
        expect(mapAppleReminderPriorityToDashboard(9)).toBe(1) // low
        expect(mapAppleReminderPriorityToDashboard(undefined)).toBe(0)
        expect(mapAppleReminderPriorityToDashboard(4)).toBe(0)
      })

      test('mapDashboardPriorityToAppleReminder is the reverse mapping', () => {
        expect(mapDashboardPriorityToAppleReminder(0)).toBe(0)
        expect(mapDashboardPriorityToAppleReminder(3)).toBe(1)
        expect(mapDashboardPriorityToAppleReminder(2)).toBe(5)
        expect(mapDashboardPriorityToAppleReminder(1)).toBe(9)
      })

      test('stores only non-zero Dashboard priority on the reminder', () => {
        const base = {
          title: 'T',
          calendar: 'List',
          isCompleted: false,
          isAllDay: true,
          occurences: [],
        }
        expect(mapCalendarItemToReminderForDashboard({ ...base, priority: 1 }).priority).toBe(3)
        expect(mapCalendarItemToReminderForDashboard({ ...base, priority: 5 }).priority).toBe(2)
        expect(mapCalendarItemToReminderForDashboard({ ...base, priority: 9 }).priority).toBe(1)
        expect(mapCalendarItemToReminderForDashboard({ ...base, priority: 0 }).priority).toBeUndefined()
        expect(mapCalendarItemToReminderForDashboard({ ...base }).priority).toBeUndefined()
      })
    })

    describe('parseLeadingPriorityFromReminderText()', () => {
      test('parses !!! / !! / ! and strips them from the title', () => {
        expect(parseLeadingPriorityFromReminderText('!!! Urgent call')).toEqual({ title: 'Urgent call', dashboardPriority: 3 })
        expect(parseLeadingPriorityFromReminderText('!! Follow up')).toEqual({ title: 'Follow up', dashboardPriority: 2 })
        expect(parseLeadingPriorityFromReminderText('! Buy milk')).toEqual({ title: 'Buy milk', dashboardPriority: 1 })
      })

      test('leaves text unchanged when there is no leading priority marker', () => {
        expect(parseLeadingPriorityFromReminderText('Just a reminder')).toEqual({ title: 'Just a reminder', dashboardPriority: 0 })
        expect(parseLeadingPriorityFromReminderText('Hello !!! world')).toEqual({ title: 'Hello !!! world', dashboardPriority: 0 })
        expect(parseLeadingPriorityFromReminderText('!!!! not four bangs')).toEqual({ title: '!!!! not four bangs', dashboardPriority: 0 })
      })
    })
  })
})
