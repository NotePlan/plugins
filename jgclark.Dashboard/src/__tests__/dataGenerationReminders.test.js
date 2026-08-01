/* globals describe, expect, test, jest, beforeEach, afterEach */
// Last updated 2026-08-01 for v2.4.0.b60 by @CursorAI

import { CustomConsole } from '@jest/console'
import moment from 'moment/min/moment-with-locales'
import { DataStore, Editor, CommandBar, NotePlan, simpleFormatter } from '@mocks/index'
import { bucketReminderItems, sortReminderSectionItems } from '../reminderBuckets.js'
import { getReminderListsForConfig } from '../reminderMapping.js'
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

      test('parses CSV and matches accessible lists including NotePlan-disabled', () => {
        const result = getReminderListsForConfig({
          includedReminderLists: 'Home, Work, Home, Shopping',
        })
        expect(result.titles).toEqual(['Home', 'Work', 'Shopping'])
        expect(result.colorByTitle).toEqual({
          Home: '#34C759',
          Work: '#007AFF',
          Shopping: '#AF52DE',
        })
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
      test('sorts section items by reminder time, then priority desc, then date', () => {
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
  })
})
