/* globals describe, expect, test, jest, beforeEach, afterEach */
// Last updated 2026-08-01 for v2.4.0.b60 by @CursorAI

import { CustomConsole } from '@jest/console'
import { DataStore, Editor, CommandBar, NotePlan, simpleFormatter } from '@mocks/index'
import { placeReminderBuckets } from '../reminderPlacement.js'

global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan
global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
DataStore.settings['_logLevel'] = 'none'

const PLUGIN_NAME = 'jgclark.Dashboard'
const FILENAME = 'reminderPlacement'

/**
 * Build a minimal reminder TSectionItem for placement tests.
 * @param {string} id
 * @param {{ date?: string, time?: string, title?: string }} fields
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
    },
  }
}

/**
 * Empty bucket set with optional overrides.
 * @param {Object} overrides
 * @returns {any}
 */
function makeBuckets(overrides = {}) {
  return {
    timedTodayItems: [],
    untimedTodayItems: [],
    yesterdayItems: [],
    tomorrowItems: [],
    overdueItems: [],
    undatedItems: [],
    ...overrides,
  }
}

/**
 * Base config with reminders and common day sections on.
 * @param {Object} overrides
 * @returns {any}
 */
function makeConfig(overrides = {}) {
  return {
    showRemindersSection: true,
    showCurrentReminders: true,
    showUndatedOverdueReminders: true,
    showTodaySection: true,
    showYesterdaySection: true,
    showTomorrowSection: true,
    showOverdueSection: true,
    hideTimedRemindersUntilDue: true,
    ...overrides,
  }
}

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    describe('placeReminderBuckets()', () => {
      test('routes each bucket to its primary host when all sections are on', () => {
        const timed = makeReminderItem('timed', { date: '2026-08-01', time: '00:01' })
        const untimed = makeReminderItem('untimed', { date: '2026-08-01' })
        const yest = makeReminderItem('yest', { date: '2026-07-31' })
        const tom = makeReminderItem('tom', { date: '2026-08-02' })
        const past = makeReminderItem('past', { date: '2026-07-20' })
        const undated = makeReminderItem('undated')

        const placement = placeReminderBuckets(
          makeBuckets({
            timedTodayItems: [timed],
            untimedTodayItems: [untimed],
            yesterdayItems: [yest],
            tomorrowItems: [tom],
            overdueItems: [past],
            undatedItems: [undated],
          }),
          makeConfig({ hideTimedRemindersUntilDue: false }),
        )

        expect(placement.forDT.map((i) => i.ID)).toEqual(['untimed'])
        expect(placement.forTB.map((i) => i.ID)).toEqual(['timed'])
        expect(placement.forDY.map((i) => i.ID)).toEqual(['yest'])
        expect(placement.forDO.map((i) => i.ID)).toEqual(['tom'])
        expect(placement.forOVERDUE.map((i) => i.ID)).toEqual(['past'])
        expect(placement.forREM.map((i) => i.ID)).toEqual(['undated'])
        expect(placement.remBucketsLabel).toBe('undated')
        expect(placement.homeless).toEqual([])
      })

      test('spills yesterday into OVERDUE when Yesterday is off and Overdue is on', () => {
        const yest = makeReminderItem('yest')
        const past = makeReminderItem('past')
        const placement = placeReminderBuckets(
          makeBuckets({ yesterdayItems: [yest], overdueItems: [past] }),
          makeConfig({ showYesterdaySection: false, showOverdueSection: true }),
        )
        expect(placement.forDY).toEqual([])
        expect(placement.forOVERDUE.map((i) => i.ID)).toEqual(['past', 'yest'])
        expect(placement.forREM.map((i) => i.ID)).toEqual([])
        expect(placement.remBucketsLabel).toBe('undated')
      })

      test('falls back yesterday and overdue to REM when their hosts are off', () => {
        const yest = makeReminderItem('yest')
        const past = makeReminderItem('past')
        const undated = makeReminderItem('undated')
        const placement = placeReminderBuckets(
          makeBuckets({ yesterdayItems: [yest], overdueItems: [past], undatedItems: [undated] }),
          makeConfig({ showYesterdaySection: false, showOverdueSection: false }),
        )
        expect(placement.forDY).toEqual([])
        expect(placement.forOVERDUE).toEqual([])
        expect(placement.forREM.map((i) => i.ID).sort()).toEqual(['past', 'undated', 'yest'])
        expect(placement.remBucketsLabel).toBe('undated + yesterday + overdue')
        expect(placement.homeless).toEqual([])
      })

      test('falls back untimed today to REM when Today is off', () => {
        const untimed = makeReminderItem('untimed')
        const placement = placeReminderBuckets(
          makeBuckets({ untimedTodayItems: [untimed] }),
          makeConfig({ showTodaySection: false }),
        )
        expect(placement.forDT).toEqual([])
        expect(placement.forREM.map((i) => i.ID)).toEqual(['untimed'])
        expect(placement.remBucketsLabel).toBe('undated + today')
      })

      test('tomorrow has no fallback when Tomorrow section is off', () => {
        const tom = makeReminderItem('tom')
        const placement = placeReminderBuckets(
          makeBuckets({ tomorrowItems: [tom] }),
          makeConfig({ showTomorrowSection: false }),
        )
        expect(placement.forDO).toEqual([])
        expect(placement.forREM).toEqual([])
        expect(placement.homeless).toEqual([{ label: 'tomorrow (no fallback: Tomorrow section off)', count: 1 }])
      })

      test('hides future-timed today reminders when hideTimedRemindersUntilDue is on', () => {
        const futureTimed = makeReminderItem('future', { time: '23:59' })
        const pastTimed = makeReminderItem('past', { time: '00:01' })
        const placement = placeReminderBuckets(
          makeBuckets({ timedTodayItems: [futureTimed, pastTimed] }),
          makeConfig({ hideTimedRemindersUntilDue: true }),
        )
        expect(placement.forTB.map((i) => i.ID)).toEqual(['past'])
        expect(placement.forREM).toEqual([])
      })

      test('shows all timed today reminders in TB when hideTimedRemindersUntilDue is off', () => {
        const futureTimed = makeReminderItem('future', { time: '23:59' })
        const pastTimed = makeReminderItem('past', { time: '00:01' })
        const placement = placeReminderBuckets(
          makeBuckets({ timedTodayItems: [futureTimed, pastTimed] }),
          makeConfig({ hideTimedRemindersUntilDue: false }),
        )
        expect(placement.forTB.map((i) => i.ID)).toEqual(['future', 'past'])
      })

      test('empties day buckets when Current Reminders is off; keeps undated/overdue for REM/OVERDUE', () => {
        const untimed = makeReminderItem('untimed')
        const past = makeReminderItem('past')
        const undated = makeReminderItem('undated')
        const placement = placeReminderBuckets(
          makeBuckets({
            untimedTodayItems: [untimed],
            overdueItems: [past],
            undatedItems: [undated],
          }),
          makeConfig({ showCurrentReminders: false }),
        )
        expect(placement.forDT).toEqual([])
        expect(placement.forOVERDUE.map((i) => i.ID)).toEqual(['past'])
        expect(placement.forREM.map((i) => i.ID)).toEqual(['undated'])
      })

      test('returns empty placement when both reminder toggles are off', () => {
        const undated = makeReminderItem('undated')
        const placement = placeReminderBuckets(
          makeBuckets({ undatedItems: [undated] }),
          makeConfig({ showRemindersSection: false }),
        )
        expect(placement.forREM).toEqual([])
        expect(placement.forOVERDUE).toEqual([])
        expect(placement.homeless).toEqual([])
      })

      test('marks yesterday homeless when DY, OVERDUE, and REM cannot host', () => {
        const yest = makeReminderItem('yest')
        const placement = placeReminderBuckets(
          makeBuckets({ yesterdayItems: [yest] }),
          makeConfig({
            showYesterdaySection: false,
            showOverdueSection: false,
            showUndatedOverdueReminders: false,
          }),
        )
        expect(placement.forDY).toEqual([])
        expect(placement.forOVERDUE).toEqual([])
        expect(placement.forREM).toEqual([])
        expect(placement.homeless).toEqual([{ label: 'yesterday', count: 1 }])
      })
    })
  })
})
