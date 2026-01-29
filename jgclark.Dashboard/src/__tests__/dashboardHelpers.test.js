/* globals describe, expect, test, jest, beforeEach */
// Tests written by Cursor, 2026-01-25, directed by JGC.

import { CustomConsole } from '@jest/console'
import { filterToOpenParagraphs, filterBySchedulingRules, filterParasByIgnoreTerms, filterParasByIncludedCalendarSections, filterParasByCalendarHeadingSections, getStartTimeFromPara } from '../dashboardHelpers.js'
import { DataStore, Editor, CommandBar, NotePlan, Paragraph, Note, simpleFormatter } from '@mocks/index'
import * as timeblocks from '@helpers/timeblocks'
import * as dateTime from '@helpers/dateTime'
import * as dev from '@helpers/dev'
import * as headings from '@helpers/headings'
import { clo, logDebug } from '@helpers/dev'

// Make DataStore and Editor available globally for the source code
global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan
global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
DataStore.settings['_logLevel'] = 'none'

// tests start here

const PLUGIN_NAME = `jgclark.Dashboard`
const FILENAME = `dashboardHelpers`

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    beforeEach(() => {
      // Restore all mocks before each test
      jest.restoreAllMocks()

      // Mock logTimer and logDebug to avoid console output during tests
      jest.spyOn(dev, 'logTimer').mockImplementation(() => { })
      jest.spyOn(dev, 'logDebug').mockImplementation(() => { })
    })

    describe('filterToOpenParagraphs()', () => {
      test('should return empty array when input is empty', () => {
        const result = filterToOpenParagraphs([], false, '')
        expect(result).toEqual([])
      })

      test('should filter to only open paragraphs when alsoReturnTimeblockLines is false', () => {
        // Setup
        const openPara = new Paragraph({ type: 'open', content: 'Open task' })
        const checklistPara = new Paragraph({ type: 'checklist', content: 'Checklist item' })
        const donePara = new Paragraph({ type: 'done', content: 'Done task' })
        const textPara = new Paragraph({ type: 'text', content: 'Text paragraph' })
        const paras = [openPara, checklistPara, donePara, textPara]

        const result = filterToOpenParagraphs(paras, false, '')
        expect(result).toHaveLength(2)
        expect(result).toContain(openPara)
        expect(result).toContain(checklistPara)
        expect(result).not.toContain(donePara)
        expect(result).not.toContain(textPara)
      })

      test('should exclude blank open paragraphs', () => {
        // Setup
        const openPara = new Paragraph({ type: 'open', content: 'Open task' })
        const blankOpenPara = new Paragraph({ type: 'open', content: '   ' })
        const paras = [openPara, blankOpenPara]

        const result = filterToOpenParagraphs(paras, false, '')
        expect(result).toHaveLength(1)
        expect(result).toContain(openPara)
        expect(result).not.toContain(blankOpenPara)
      })

      test('should include open paragraphs when alsoReturnTimeblockLines is true', () => {
        // Setup
        const openPara = new Paragraph({ type: 'open', content: 'Open task' })
        const checklistPara = new Paragraph({ type: 'checklist', content: 'Checklist item' })
        const donePara = new Paragraph({ type: 'done', content: 'Done task' })
        const paras = [openPara, checklistPara, donePara]

        // Mock isActiveOrFutureTimeBlockPara to return false for all
        jest.spyOn(timeblocks, 'isActiveOrFutureTimeBlockPara').mockReturnValue(false)

        const result = filterToOpenParagraphs(paras, true, '')
        expect(result).toHaveLength(2)
        expect(result).toContain(openPara)
        expect(result).toContain(checklistPara)
        expect(result).not.toContain(donePara)
      })

      test('should include active/future timeblock paragraphs when alsoReturnTimeblockLines is true', () => {
        // Setup
        const openPara = new Paragraph({ type: 'open', content: 'Open task' })
        const timeblockPara = new Paragraph({ type: 'text', content: '10:00-11:00 Meeting' })
        const donePara = new Paragraph({ type: 'done', content: 'Done task' })
        const paras = [openPara, timeblockPara, donePara]

        // Mock isActiveOrFutureTimeBlockPara to return true for timeblockPara
        jest.spyOn(timeblocks, 'isActiveOrFutureTimeBlockPara').mockImplementation((p) => {
          return p === timeblockPara && p.content.includes('10:00')
        })

        const result = filterToOpenParagraphs(paras, true, '')
        expect(result).toHaveLength(2)
        expect(result).toContain(openPara)
        expect(result).toContain(timeblockPara)
        expect(result).not.toContain(donePara)
      })

      test('should use mustContainString parameter when checking timeblocks', () => {
        // Setup
        const timeblockWithString = new Paragraph({ type: 'text', content: '10:00-11:00 Meeting @work' })
        const timeblockWithoutString = new Paragraph({ type: 'text', content: '10:00-11:00 Meeting' })
        const paras = [timeblockWithString, timeblockWithoutString]

        // Mock isActiveOrFutureTimeBlockPara to check mustContainString
        jest.spyOn(timeblocks, 'isActiveOrFutureTimeBlockPara').mockImplementation((p, mustContainString) => {
          return p.content.includes(mustContainString) && p.content.includes('10:00')
        })

        const result = filterToOpenParagraphs(paras, true, '@work')
        expect(result).toHaveLength(1)
        expect(result).toContain(timeblockWithString)
        expect(result).not.toContain(timeblockWithoutString)
      })

      test('should return paragraphs that are either open OR active timeblocks', () => {
        // Setup
        const openPara = new Paragraph({ type: 'open', content: 'Open task' })
        const timeblockPara = new Paragraph({ type: 'text', content: '10:00-11:00 Meeting @work' })
        const donePara = new Paragraph({ type: 'done', content: 'Done task' })
        const paras = [openPara, timeblockPara, donePara]

        // Mock isActiveOrFutureTimeBlockPara
        jest.spyOn(timeblocks, 'isActiveOrFutureTimeBlockPara').mockImplementation((p, mustContainString) => {
          return p === timeblockPara && p.content.includes(mustContainString)
        })

        const result = filterToOpenParagraphs(paras, true, '@work')
        expect(result).toHaveLength(2)
        expect(result).toContain(openPara)
        expect(result).toContain(timeblockPara)
        expect(result).not.toContain(donePara)
      })

      test('should handle mixed paragraph types correctly', () => {
        // Setup
        const openPara = new Paragraph({ type: 'open', content: 'Open task' })
        const checklistPara = new Paragraph({ type: 'checklist', content: 'Checklist item' })
        const scheduledPara = new Paragraph({ type: 'scheduled', content: 'Scheduled task' })
        const donePara = new Paragraph({ type: 'done', content: 'Done task' })
        const cancelledPara = new Paragraph({ type: 'cancelled', content: 'Cancelled task' })
        const textPara = new Paragraph({ type: 'text', content: 'Text paragraph' })
        const paras = [openPara, checklistPara, scheduledPara, donePara, cancelledPara, textPara]

        // Mock isActiveOrFutureTimeBlockPara to return false for all
        jest.spyOn(timeblocks, 'isActiveOrFutureTimeBlockPara').mockReturnValue(false)

        const result = filterToOpenParagraphs(paras, false, '')
        expect(result).toHaveLength(2)
        expect(result).toContain(openPara)
        expect(result).toContain(checklistPara)
        expect(result).not.toContain(scheduledPara)
        expect(result).not.toContain(donePara)
        expect(result).not.toContain(cancelledPara)
        expect(result).not.toContain(textPara)
      })

      test('should preserve order of filtered paragraphs', () => {
        // Setup
        const para1 = new Paragraph({ type: 'open', content: 'First task' })
        const para2 = new Paragraph({ type: 'done', content: 'Done task' })
        const para3 = new Paragraph({ type: 'checklist', content: 'Checklist item' })
        const para4 = new Paragraph({ type: 'text', content: 'Text paragraph' })
        const para5 = new Paragraph({ type: 'open', content: 'Second task' })
        const paras = [para1, para2, para3, para4, para5]

        const result = filterToOpenParagraphs(paras, false, '')
        expect(result).toHaveLength(3)
        expect(result[0]).toBe(para1)
        expect(result[1]).toBe(para3)
        expect(result[2]).toBe(para5)
      })
    })

    describe('filterBySchedulingRules()', () => {
      test('should return empty array when input is empty', () => {
        jest.spyOn(dateTime, 'getTodaysDateHyphenated').mockReturnValue('2025-01-25')
        jest.spyOn(dateTime, 'includesScheduledFutureDate').mockReturnValue(false)

        const result = filterBySchedulingRules([], '2025-01-25', '2025-01-25')
        expect(result).toEqual([])
      })

      test('should keep open paragraphs without scheduled dates', () => {
        // Setup
        const today = '2025-01-25'
        const openPara = new Paragraph({ type: 'open', content: 'Open task without date' })
        const checklistPara = new Paragraph({ type: 'checklist', content: 'Checklist item' })
        const paras = [openPara, checklistPara]

        jest.spyOn(dateTime, 'getTodaysDateHyphenated').mockReturnValue(today)
        jest.spyOn(dateTime, 'includesScheduledFutureDate').mockReturnValue(false)

        const result = filterBySchedulingRules(paras, today, today)
        expect(result).toHaveLength(2)
        expect(result).toContain(openPara)
        expect(result).toContain(checklistPara)
      })

      test('should keep paragraphs scheduled for the note date', () => {
        // Setup
        const noteDate = '2025-01-25'
        const today = '2025-01-25'
        const scheduledPara = new Paragraph({ type: 'open', content: 'Task scheduled >2025-01-25' })
        const unscheduledPara = new Paragraph({ type: 'open', content: 'Task without date' })
        const paras = [scheduledPara, unscheduledPara]

        jest.spyOn(dateTime, 'getTodaysDateHyphenated').mockReturnValue(today)
        jest.spyOn(dateTime, 'includesScheduledFutureDate').mockReturnValue(false)

        const result = filterBySchedulingRules(paras, noteDate, today)
        expect(result).toHaveLength(2)
        expect(result).toContain(scheduledPara)
        expect(result).toContain(unscheduledPara)
      })

      test('should keep paragraphs with >today when note date is today', () => {
        // Setup
        const today = '2025-01-25'
        const todayPara = new Paragraph({ type: 'open', content: 'Task scheduled >today' })
        const otherPara = new Paragraph({ type: 'open', content: 'Task without date' })
        const paras = [todayPara, otherPara]

        jest.spyOn(dateTime, 'getTodaysDateHyphenated').mockReturnValue(today)
        jest.spyOn(dateTime, 'includesScheduledFutureDate').mockReturnValue(false)

        const result = filterBySchedulingRules(paras, today, today)
        expect(result).toHaveLength(2)
        expect(result).toContain(todayPara)
        expect(result).toContain(otherPara)
      })

      test('should not keep paragraphs with >today when note date is not today', () => {
        // Setup
        const today = '2025-01-25'
        const noteDate = '2025-01-24'
        const todayPara = new Paragraph({ type: 'open', content: 'Task scheduled >today' })
        const unscheduledPara = new Paragraph({ type: 'open', content: 'Task without date' })
        const paras = [todayPara, unscheduledPara]

        jest.spyOn(dateTime, 'getTodaysDateHyphenated').mockReturnValue(today)
        jest.spyOn(dateTime, 'includesScheduledFutureDate').mockReturnValue(false)

        const result = filterBySchedulingRules(paras, noteDate, today)
        expect(result).toHaveLength(1)
        expect(result).toContain(unscheduledPara)
        expect(result).not.toContain(todayPara)
      })

      test('should filter out future scheduled paragraphs', () => {
        // Setup
        const today = '2025-01-25'
        const noteDate = '2025-01-25'
        const futurePara = new Paragraph({ type: 'open', content: 'Task scheduled >2025-01-26' })
        const todayPara = new Paragraph({ type: 'open', content: 'Task scheduled >2025-01-25' })
        const unscheduledPara = new Paragraph({ type: 'open', content: 'Task without date' })
        const paras = [futurePara, todayPara, unscheduledPara]

        jest.spyOn(dateTime, 'getTodaysDateHyphenated').mockReturnValue(today)
        jest.spyOn(dateTime, 'includesScheduledFutureDate').mockImplementation((content, _latestDate) => {
          return content.includes('>2025-01-26')
        })

        const result = filterBySchedulingRules(paras, noteDate, today)
        expect(result).toHaveLength(2)
        expect(result).toContain(todayPara)
        expect(result).toContain(unscheduledPara)
        expect(result).not.toContain(futurePara)
      })

      test('should filter out scheduled paragraphs that are not open', () => {
        // Setup
        const today = '2025-01-25'
        // Note: Paragraphs scheduled for the note date will pass the first filter even if not open
        // But paragraphs that are not open and not scheduled for the note date should be filtered out
        const scheduledPara = new Paragraph({ type: 'scheduled', content: 'Scheduled task >2025-01-26' }) // Different date
        const donePara = new Paragraph({ type: 'done', content: 'Done task >2025-01-26' }) // Different date
        const openPara = new Paragraph({ type: 'open', content: 'Open task' })
        const paras = [scheduledPara, donePara, openPara]

        jest.spyOn(dateTime, 'getTodaysDateHyphenated').mockReturnValue(today)
        jest.spyOn(dateTime, 'includesScheduledFutureDate').mockReturnValue(false)

        const result = filterBySchedulingRules(paras, today, today)
        expect(result).toHaveLength(1)
        expect(result).toContain(openPara)
        expect(result).not.toContain(scheduledPara)
        expect(result).not.toContain(donePara)
      })

      test('should handle mixed scenarios correctly', () => {
        // Setup
        const today = '2025-01-25'
        const noteDate = '2025-01-25'
        const openUnscheduled = new Paragraph({ type: 'open', content: 'Open task' })
        const openToday = new Paragraph({ type: 'open', content: 'Task >today' })
        const openNoteDate = new Paragraph({ type: 'open', content: 'Task >2025-01-25' })
        const openFuture = new Paragraph({ type: 'open', content: 'Task >2025-01-26' })
        // Note: scheduledPara has the note date in content, so it will pass the first filter
        // even though it's not open, because the function keeps paragraphs scheduled for the note date
        const scheduledPara = new Paragraph({ type: 'scheduled', content: 'Scheduled >2025-01-25' })
        const paras = [openUnscheduled, openToday, openNoteDate, openFuture, scheduledPara]

        jest.spyOn(dateTime, 'getTodaysDateHyphenated').mockReturnValue(today)
        jest.spyOn(dateTime, 'includesScheduledFutureDate').mockImplementation((content, _latestDate) => {
          return content.includes('>2025-01-26')
        })

        const result = filterBySchedulingRules(paras, noteDate, today)
        // scheduledPara will be kept because it has the note date in content
        expect(result).toHaveLength(4)
        expect(result).toContain(openUnscheduled)
        expect(result).toContain(openToday)
        expect(result).toContain(openNoteDate)
        expect(result).toContain(scheduledPara)
        expect(result).not.toContain(openFuture)
      })

      test('should use latestDate parameter for future date filtering', () => {
        // Setup
        const today = '2025-01-25'
        const noteDate = '2025-01-24'
        const latestDate = '2025-01-24' // Use note date as latest
        const futurePara = new Paragraph({ type: 'open', content: 'Task >2025-01-25' })
        const unscheduledPara = new Paragraph({ type: 'open', content: 'Task without date' })
        const paras = [futurePara, unscheduledPara]

        jest.spyOn(dateTime, 'getTodaysDateHyphenated').mockReturnValue(today)
        jest.spyOn(dateTime, 'includesScheduledFutureDate').mockImplementation((content, _latestDateParam) => {
          // Should use latestDate parameter (2025-01-24), so >2025-01-25 is future
          return content.includes('>2025-01-25')
        })

        const result = filterBySchedulingRules(paras, noteDate, latestDate)
        expect(result).toHaveLength(1)
        expect(result).toContain(unscheduledPara)
        expect(result).not.toContain(futurePara)
      })

      test('should preserve order of filtered paragraphs', () => {
        // Setup
        const today = '2025-01-25'
        const para1 = new Paragraph({ type: 'open', content: 'First task' })
        const para2 = new Paragraph({ type: 'scheduled', content: 'Scheduled task' })
        const para3 = new Paragraph({ type: 'open', content: 'Second task >2025-01-25' })
        const para4 = new Paragraph({ type: 'done', content: 'Done task' })
        const para5 = new Paragraph({ type: 'open', content: 'Third task' })
        const paras = [para1, para2, para3, para4, para5]

        jest.spyOn(dateTime, 'getTodaysDateHyphenated').mockReturnValue(today)
        jest.spyOn(dateTime, 'includesScheduledFutureDate').mockReturnValue(false)

        const result = filterBySchedulingRules(paras, today, today)
        expect(result).toHaveLength(3)
        expect(result[0]).toBe(para1)
        expect(result[1]).toBe(para3)
        expect(result[2]).toBe(para5)
      })
    })

    describe('filterParasByIgnoreTerms()', () => {
      test('should return all paragraphs when ignoreItemsWithTerms is not set', () => {
        // Setup
        const para1 = new Paragraph({ type: 'open', content: 'Task with @work' })
        const para2 = new Paragraph({ type: 'open', content: 'Task with #project' })
        const paras = [para1, para2]
        const dashboardSettings = {}
        const startTime = new Date()
        const functionName = 'testFunction'

        const result = filterParasByIgnoreTerms(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(2)
        expect(result).toContain(para1)
        expect(result).toContain(para2)
      })

      test('should return all paragraphs when ignoreItemsWithTerms is empty string', () => {
        // Setup
        const para1 = new Paragraph({ type: 'open', content: 'Task with @work' })
        const para2 = new Paragraph({ type: 'open', content: 'Task with #project' })
        const paras = [para1, para2]
        const dashboardSettings = { ignoreItemsWithTerms: '' }
        const startTime = new Date()
        const functionName = 'testFunction'

        const result = filterParasByIgnoreTerms(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(2)
        expect(result).toContain(para1)
        expect(result).toContain(para2)
      })

      test('should filter out paragraphs containing ignore term (case-insensitive)', () => {
        // Setup
        const para1 = new Paragraph({ type: 'open', content: 'Task with @work' })
        const para2 = new Paragraph({ type: 'open', content: 'Task with @HOME' })
        const para3 = new Paragraph({ type: 'open', content: 'Task without ignore term' })
        const paras = [para1, para2, para3]
        const dashboardSettings = { ignoreItemsWithTerms: '@work' }
        const startTime = new Date()
        const functionName = 'testFunction'

        const result = filterParasByIgnoreTerms(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(2)
        expect(result).toContain(para2)
        expect(result).toContain(para3)
        expect(result).not.toContain(para1)
      })

      test('should filter out paragraphs containing any of multiple ignore terms', () => {
        // Setup
        const para1 = new Paragraph({ type: 'open', content: 'Task with @work' })
        const para2 = new Paragraph({ type: 'open', content: 'Task with #project' })
        const para3 = new Paragraph({ type: 'open', content: 'Task with @home' })
        const para4 = new Paragraph({ type: 'open', content: 'Task without ignore terms' })
        const paras = [para1, para2, para3, para4]
        const dashboardSettings = { ignoreItemsWithTerms: '@work,#project' }
        const startTime = new Date()
        const functionName = 'testFunction'

        const result = filterParasByIgnoreTerms(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(2)
        expect(result).toContain(para3)
        expect(result).toContain(para4)
        expect(result).not.toContain(para1)
        expect(result).not.toContain(para2)
      })

      test('should handle case-insensitive matching', () => {
        // Setup
        const para1 = new Paragraph({ type: 'open', content: 'Task with @WORK' })
        const para2 = new Paragraph({ type: 'open', content: 'Task with @Work' })
        const para3 = new Paragraph({ type: 'open', content: 'Task with @work' })
        const para4 = new Paragraph({ type: 'open', content: 'Task without term' })
        const paras = [para1, para2, para3, para4]
        const dashboardSettings = { ignoreItemsWithTerms: '@work' }
        const startTime = new Date()
        const functionName = 'testFunction'

        const result = filterParasByIgnoreTerms(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(1)
        expect(result).toContain(para4)
        expect(result).not.toContain(para1)
        expect(result).not.toContain(para2)
        expect(result).not.toContain(para3)
      })

      test('should filter out paragraphs with partial matches', () => {
        // Setup
        const para1 = new Paragraph({ type: 'open', content: 'Task with @workmeeting' })
        const para2 = new Paragraph({ type: 'open', content: 'Task with my@work tag' })
        const para3 = new Paragraph({ type: 'open', content: 'Task without term' })
        const paras = [para1, para2, para3]
        const dashboardSettings = { ignoreItemsWithTerms: '@work' }
        const startTime = new Date()
        const functionName = 'testFunction'

        const result = filterParasByIgnoreTerms(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(1)
        expect(result).toContain(para3)
        expect(result).not.toContain(para1)
        expect(result).not.toContain(para2)
      })

      test('should handle hashtags and mentions', () => {
        // Setup
        const para1 = new Paragraph({ type: 'open', content: 'Task with #project tag' })
        const para2 = new Paragraph({ type: 'open', content: 'Task with @john mention' })
        const para3 = new Paragraph({ type: 'open', content: 'Task without special terms' })
        const paras = [para1, para2, para3]
        const dashboardSettings = { ignoreItemsWithTerms: '#project,@john' }
        const startTime = new Date()
        const functionName = 'testFunction'

        const result = filterParasByIgnoreTerms(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(1)
        expect(result).toContain(para3)
        expect(result).not.toContain(para1)
        expect(result).not.toContain(para2)
      })

      test('should preserve order of filtered paragraphs', () => {
        // Setup
        const para1 = new Paragraph({ type: 'open', content: 'First task' })
        const para2 = new Paragraph({ type: 'open', content: 'Task with @work' })
        const para3 = new Paragraph({ type: 'open', content: 'Third task' })
        const para4 = new Paragraph({ type: 'open', content: 'Task with @work again' })
        const para5 = new Paragraph({ type: 'open', content: 'Fifth task' })
        const paras = [para1, para2, para3, para4, para5]
        const dashboardSettings = { ignoreItemsWithTerms: '@work' }
        const startTime = new Date()
        const functionName = 'testFunction'

        const result = filterParasByIgnoreTerms(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(3)
        expect(result[0]).toBe(para1)
        expect(result[1]).toBe(para3)
        expect(result[2]).toBe(para5)
      })

      test('should handle empty paragraphs array', () => {
        // Setup
        const paras = []
        const dashboardSettings = { ignoreItemsWithTerms: '@work' }
        const startTime = new Date()
        const functionName = 'testFunction'

        const result = filterParasByIgnoreTerms(paras, dashboardSettings, startTime, functionName)
        expect(result).toEqual([])
      })

      test('should handle whitespace in ignore terms', () => {
        // Setup
        const para1 = new Paragraph({ type: 'open', content: 'Task with @work' })
        const para2 = new Paragraph({ type: 'open', content: 'Task without term' })
        const paras = [para1, para2]
        const dashboardSettings = { ignoreItemsWithTerms: ' @work , #project ' }
        const startTime = new Date()
        const functionName = 'testFunction'

        const result = filterParasByIgnoreTerms(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(1)
        expect(result).toContain(para2)
        expect(result).not.toContain(para1)
      })
    })

    describe('filterParasByIncludedCalendarSections()', () => {
      test('should return all paragraphs when includedCalendarSections is not set', () => {
        // Setup
        const calendarNote = new Note({ filename: '2025-01-25.md', type: 'Calendar' })
        const para1 = new Paragraph({ type: 'open', content: 'Task 1', note: calendarNote })
        const para2 = new Paragraph({ type: 'open', content: 'Task 2', note: calendarNote })
        const paras = [para1, para2]
        const dashboardSettings = {}
        const startTime = new Date()
        const functionName = 'testFunction'

        const result = filterParasByIncludedCalendarSections(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(2)
        expect(result).toContain(para1)
        expect(result).toContain(para2)
      })

      test('should return all paragraphs when includedCalendarSections is empty string', () => {
        // Setup
        const calendarNote = new Note({ filename: '2025-01-25.md', type: 'Calendar' })
        const para1 = new Paragraph({ type: 'open', content: 'Task 1', note: calendarNote })
        const para2 = new Paragraph({ type: 'open', content: 'Task 2', note: calendarNote })
        const paras = [para1, para2]
        const dashboardSettings = { includedCalendarSections: '' }
        const startTime = new Date()
        const functionName = 'testFunction'

        const result = filterParasByIncludedCalendarSections(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(2)
        expect(result).toContain(para1)
        expect(result).toContain(para2)
      })

      test('should keep paragraphs from included calendar sections', () => {
        // Setup
        const calendarNote = new Note({ filename: '2025-01-25.md', type: 'Calendar' })
        const para1 = new Paragraph({ type: 'open', content: 'Task 1', note: calendarNote })
        const para2 = new Paragraph({ type: 'open', content: 'Task 2', note: calendarNote })
        const paras = [para1, para2]
        const dashboardSettings = { includedCalendarSections: 'Work,Personal' }
        const startTime = new Date()
        const functionName = 'testFunction'

        // Mock getHeadingHierarchyForThisPara to return headings
        jest.spyOn(headings, 'getHeadingHierarchyForThisPara').mockImplementation((p) => {
          if (p === para1) return ['Work']
          if (p === para2) return ['Personal']
          return []
        })

        const result = filterParasByIncludedCalendarSections(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(2)
        expect(result).toContain(para1)
        expect(result).toContain(para2)
      })

      test('should filter out paragraphs not from included calendar sections', () => {
        // Setup
        const calendarNote = new Note({ filename: '2025-01-25.md', type: 'Calendar' })
        const para1 = new Paragraph({ type: 'open', content: 'Task 1', note: calendarNote })
        const para2 = new Paragraph({ type: 'open', content: 'Task 2', note: calendarNote })
        const para3 = new Paragraph({ type: 'open', content: 'Task 3', note: calendarNote })
        const paras = [para1, para2, para3]
        const dashboardSettings = { includedCalendarSections: 'Work' }
        const startTime = new Date()
        const functionName = 'testFunction'

        // Mock getHeadingHierarchyForThisPara to return headings
        jest.spyOn(headings, 'getHeadingHierarchyForThisPara').mockImplementation((p) => {
          if (p === para1) return ['Work']
          if (p === para2) return ['Personal']
          if (p === para3) return ['Other']
          return []
        })

        const result = filterParasByIncludedCalendarSections(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(1)
        expect(result).toContain(para1)
        expect(result).not.toContain(para2)
        expect(result).not.toContain(para3)
      })

      test('should keep paragraphs if any heading matches included sections', () => {
        // Setup
        const calendarNote = new Note({ filename: '2025-01-25.md', type: 'Calendar' })
        const para1 = new Paragraph({ type: 'open', content: 'Task 1', note: calendarNote })
        const paras = [para1]
        const dashboardSettings = { includedCalendarSections: 'Work,Personal' }
        const startTime = new Date()
        const functionName = 'testFunction'

        // Mock getHeadingHierarchyForThisPara to return multiple headings
        jest.spyOn(headings, 'getHeadingHierarchyForThisPara').mockImplementation((p) => {
          if (p === para1) return ['Work', 'Project A']
          return []
        })

        const result = filterParasByIncludedCalendarSections(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(1)
        expect(result).toContain(para1)
      })

      test('should keep non-calendar note paragraphs regardless of settings', () => {
        // Setup
        const projectNote = new Note({ filename: 'project.md', type: 'Notes' })
        const calendarNote = new Note({ filename: '2025-01-25.md', type: 'Calendar' })
        const para1 = new Paragraph({ type: 'open', content: 'Project task', note: projectNote })
        const para2 = new Paragraph({ type: 'open', content: 'Calendar task', note: calendarNote })
        const paras = [para1, para2]
        const dashboardSettings = { includedCalendarSections: 'Work' }
        const startTime = new Date()
        const functionName = 'testFunction'

        // Mock getHeadingHierarchyForThisPara
        jest.spyOn(headings, 'getHeadingHierarchyForThisPara').mockImplementation((p) => {
          if (p === para2) return ['Personal']
          return []
        })

        const result = filterParasByIncludedCalendarSections(paras, dashboardSettings, startTime, functionName)
        // para1 should be kept (non-calendar), para2 should be filtered out (calendar, not in included sections)
        expect(result).toHaveLength(1)
        expect(result).toContain(para1)
        expect(result).not.toContain(para2)
      })

      test('should handle paragraphs with no headings', () => {
        // Setup
        const calendarNote = new Note({ filename: '2025-01-25.md', type: 'Calendar' })
        const para1 = new Paragraph({ type: 'open', content: 'Task 1', note: calendarNote })
        const paras = [para1]
        const dashboardSettings = { includedCalendarSections: 'Work' }
        const startTime = new Date()
        const functionName = 'testFunction'

        // Mock getHeadingHierarchyForThisPara to return empty array
        jest.spyOn(headings, 'getHeadingHierarchyForThisPara').mockReturnValue([])

        const result = filterParasByIncludedCalendarSections(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(0)
      })

      test('should preserve order of filtered paragraphs', () => {
        // Setup
        const calendarNote = new Note({ filename: '2025-01-25.md', type: 'Calendar' })
        const para1 = new Paragraph({ type: 'open', content: 'Task 1', note: calendarNote })
        const para2 = new Paragraph({ type: 'open', content: 'Task 2', note: calendarNote })
        const para3 = new Paragraph({ type: 'open', content: 'Task 3', note: calendarNote })
        const paras = [para1, para2, para3]
        const dashboardSettings = { includedCalendarSections: 'Work' }
        const startTime = new Date()
        const functionName = 'testFunction'

        // Mock getHeadingHierarchyForThisPara
        jest.spyOn(headings, 'getHeadingHierarchyForThisPara').mockImplementation((p) => {
          if (p === para1) return ['Work']
          if (p === para2) return ['Personal']
          if (p === para3) return ['Work']
          return []
        })

        const result = filterParasByIncludedCalendarSections(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(2)
        expect(result[0]).toBe(para1)
        expect(result[1]).toBe(para3)
      })
    })

    describe('filterParasByCalendarHeadingSections()', () => {
      test('should return all paragraphs when ignoreItemsWithTerms is not set', () => {
        // Setup
        const calendarNote = new Note({ filename: '2025-01-25.md', type: 'Calendar' })
        const para1 = new Paragraph({ type: 'open', content: 'Task with @work', note: calendarNote })
        const paras = [para1]
        const dashboardSettings = {}
        const startTime = new Date()
        const functionName = 'testFunction'

        const result = filterParasByCalendarHeadingSections(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(1)
        expect(result).toContain(para1)
      })

      test('should return all paragraphs when applyIgnoreTermsToCalendarHeadingSections is false', () => {
        // Setup
        const calendarNote = new Note({ filename: '2025-01-25.md', type: 'Calendar' })
        const para1 = new Paragraph({ type: 'open', content: 'Task with @work', note: calendarNote })
        const paras = [para1]
        const dashboardSettings = {
          ignoreItemsWithTerms: '@work',
          applyIgnoreTermsToCalendarHeadingSections: false,
        }
        const startTime = new Date()
        const functionName = 'testFunction'

        const result = filterParasByCalendarHeadingSections(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(1)
        expect(result).toContain(para1)
      })

      test('should filter out paragraphs with disallowed terms in headings', () => {
        // Setup
        const calendarNote = new Note({ filename: '2025-01-25.md', type: 'Calendar' })
        const para1 = new Paragraph({ type: 'open', content: 'Task 1', note: calendarNote })
        const para2 = new Paragraph({ type: 'open', content: 'Task 2', note: calendarNote })
        const paras = [para1, para2]
        const dashboardSettings = {
          ignoreItemsWithTerms: '@work',
          applyIgnoreTermsToCalendarHeadingSections: true,
        }
        const startTime = new Date()
        const functionName = 'testFunction'

        // Mock getHeadingHierarchyForThisPara to return headings
        jest.spyOn(headings, 'getHeadingHierarchyForThisPara').mockImplementation((p) => {
          if (p === para1) return ['Work @work']
          if (p === para2) return ['Personal']
          return []
        })

        const result = filterParasByCalendarHeadingSections(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(1)
        expect(result).toContain(para2)
        expect(result).not.toContain(para1)
      })

      test('should keep paragraphs if no headings contain disallowed terms', () => {
        // Setup
        const calendarNote = new Note({ filename: '2025-01-25.md', type: 'Calendar' })
        const para1 = new Paragraph({ type: 'open', content: 'Task 1', note: calendarNote })
        const para2 = new Paragraph({ type: 'open', content: 'Task 2', note: calendarNote })
        const paras = [para1, para2]
        const dashboardSettings = {
          ignoreItemsWithTerms: '@work',
          applyIgnoreTermsToCalendarHeadingSections: true,
        }
        const startTime = new Date()
        const functionName = 'testFunction'

        // Mock getHeadingHierarchyForThisPara to return headings without disallowed terms
        jest.spyOn(headings, 'getHeadingHierarchyForThisPara').mockImplementation((p) => {
          if (p === para1) return ['Work']
          if (p === para2) return ['Personal']
          return []
        })

        const result = filterParasByCalendarHeadingSections(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(2)
        expect(result).toContain(para1)
        expect(result).toContain(para2)
      })

      test('should check all headings in hierarchy', () => {
        // Setup
        const calendarNote = new Note({ filename: '2025-01-25.md', type: 'Calendar' })
        const para1 = new Paragraph({ type: 'open', content: 'Task 1', note: calendarNote })
        const para2 = new Paragraph({ type: 'open', content: 'Task 2', note: calendarNote })
        const paras = [para1, para2]
        const dashboardSettings = {
          ignoreItemsWithTerms: '@work',
          applyIgnoreTermsToCalendarHeadingSections: true,
        }
        const startTime = new Date()
        const functionName = 'testFunction'

        // Mock getHeadingHierarchyForThisPara to return multiple headings
        jest.spyOn(headings, 'getHeadingHierarchyForThisPara').mockImplementation((p) => {
          if (p === para1) return ['Work', 'Project A'] // No @work
          if (p === para2) return ['Work', 'Project @work'] // Has @work in second heading
          return []
        })

        const result = filterParasByCalendarHeadingSections(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(1)
        expect(result).toContain(para1)
        expect(result).not.toContain(para2)
      })

      test('should keep non-calendar note paragraphs regardless of settings', () => {
        // Setup
        const projectNote = new Note({ filename: 'project.md', type: 'Notes' })
        const calendarNote = new Note({ filename: '2025-01-25.md', type: 'Calendar' })
        const para1 = new Paragraph({ type: 'open', content: 'Project task', note: projectNote })
        const para2 = new Paragraph({ type: 'open', content: 'Calendar task', note: calendarNote })
        const paras = [para1, para2]
        const dashboardSettings = {
          ignoreItemsWithTerms: '@work',
          applyIgnoreTermsToCalendarHeadingSections: true,
        }
        const startTime = new Date()
        const functionName = 'testFunction'

        // Mock getHeadingHierarchyForThisPara
        jest.spyOn(headings, 'getHeadingHierarchyForThisPara').mockImplementation((p) => {
          if (p === para2) return ['Work @work']
          return []
        })

        const result = filterParasByCalendarHeadingSections(paras, dashboardSettings, startTime, functionName)
        // para1 should be kept (non-calendar), para2 should be filtered out (calendar, heading has @work)
        expect(result).toHaveLength(1)
        expect(result).toContain(para1)
        expect(result).not.toContain(para2)
      })

      test('should handle paragraphs with no headings', () => {
        // Setup
        const calendarNote = new Note({ filename: '2025-01-25.md', type: 'Calendar' })
        const para1 = new Paragraph({ type: 'open', content: 'Task 1', note: calendarNote })
        const paras = [para1]
        const dashboardSettings = {
          ignoreItemsWithTerms: '@work',
          applyIgnoreTermsToCalendarHeadingSections: true,
        }
        const startTime = new Date()
        const functionName = 'testFunction'

        // Mock getHeadingHierarchyForThisPara to return empty array
        jest.spyOn(headings, 'getHeadingHierarchyForThisPara').mockReturnValue([])

        const result = filterParasByCalendarHeadingSections(paras, dashboardSettings, startTime, functionName)
        // Paragraphs with no headings should be kept (no headings to check)
        expect(result).toHaveLength(1)
        expect(result).toContain(para1)
      })

      test('should handle case-insensitive matching in headings', () => {
        // Setup
        const calendarNote = new Note({ filename: '2025-01-25.md', type: 'Calendar' })
        const para1 = new Paragraph({ type: 'open', content: 'Task 1', note: calendarNote })
        const para2 = new Paragraph({ type: 'open', content: 'Task 2', note: calendarNote })
        const paras = [para1, para2]
        const dashboardSettings = {
          ignoreItemsWithTerms: '@work',
          applyIgnoreTermsToCalendarHeadingSections: true,
        }
        const startTime = new Date()
        const functionName = 'testFunction'

        // Mock getHeadingHierarchyForThisPara
        jest.spyOn(headings, 'getHeadingHierarchyForThisPara').mockImplementation((p) => {
          if (p === para1) return ['Work @WORK']
          if (p === para2) return ['Personal']
          return []
        })

        const result = filterParasByCalendarHeadingSections(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(1)
        expect(result).toContain(para2)
        expect(result).not.toContain(para1)
      })

      test('should preserve order of filtered paragraphs', () => {
        // Setup
        const calendarNote = new Note({ filename: '2025-01-25.md', type: 'Calendar' })
        const para1 = new Paragraph({ type: 'open', content: 'Task 1', note: calendarNote })
        const para2 = new Paragraph({ type: 'open', content: 'Task 2', note: calendarNote })
        const para3 = new Paragraph({ type: 'open', content: 'Task 3', note: calendarNote })
        const paras = [para1, para2, para3]
        const dashboardSettings = {
          ignoreItemsWithTerms: '@work',
          applyIgnoreTermsToCalendarHeadingSections: true,
        }
        const startTime = new Date()
        const functionName = 'testFunction'

        // Mock getHeadingHierarchyForThisPara
        jest.spyOn(headings, 'getHeadingHierarchyForThisPara').mockImplementation((p) => {
          if (p === para1) return ['Work']
          if (p === para2) return ['Work @work']
          if (p === para3) return ['Personal']
          return []
        })

        const result = filterParasByCalendarHeadingSections(paras, dashboardSettings, startTime, functionName)
        expect(result).toHaveLength(2)
        expect(result[0]).toBe(para1)
        expect(result[1]).toBe(para3)
      })
    })

    describe('getStartTimeFromPara() tests', () => {
      test('should return 10:00 from 10:00-11:00', () => {
        const para = {
          content: 'just a time range 10:00-11:00',
        }
        const startTime = getStartTimeFromPara(para)
        expect(startTime).toBe('10:00')
      })
      test('should return 10:00 from 10:00', () => {
        const para = {
          content: 'just a time 10:00',
        }
        const startTime = getStartTimeFromPara(para)
        expect(startTime).toBe('10:00')
      })
      test('should return 10:00 from 10:00AM-11:00PM', () => {
        const para = {
          content: '2025-05-09 10:00AM-11:00PM',
        }
        const startTime = getStartTimeFromPara(para)
        expect(startTime).toBe('10:00')
      })
      test('should return 10:00 from 10:00AM', () => {
        const para = {
          content: '2025-05-09 10:00AM',
        }
        const startTime = getStartTimeFromPara(para)
        expect(startTime).toBe('10:00')
      })
      test('should return 10:00', () => {
        const para = {
          content: 'other text 10:00 AM',
        }
        const startTime = getStartTimeFromPara(para)
        expect(startTime).toBe('10:00')
      })
      test('should return 23:00', () => {
        const para = {
          content: 'other text 11:00 PM',
        }
        const startTime = getStartTimeFromPara(para)
        expect(startTime).toBe('23:00')
      })
      test('should return "none" if the para does not have a valid time', () => {
        const para = {
          content: '2025-05-09 10-11',
        }
        const startTime = getStartTimeFromPara(para)
        expect(startTime).toBe('none')
      })
    })
  })
})
