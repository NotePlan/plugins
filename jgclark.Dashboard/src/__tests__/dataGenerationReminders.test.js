/* globals describe, expect, test, jest, beforeEach, afterEach */
// Last updated 2026-07-18 for v2.4.0.b52 by @CursorAI

import { CustomConsole } from '@jest/console'
import { DataStore, Editor, CommandBar, NotePlan, simpleFormatter } from '@mocks/index'
import {
  dedupeReminderListTitles,
  getEnabledReminderLists,
  getReminderListsForConfig,
} from '../dataGenerationReminders.js'

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
  })
})
