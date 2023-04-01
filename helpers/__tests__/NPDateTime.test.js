/* global jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
import * as f from '../NPDateTime'
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

// const PLUGIN_NAME = `helpers`
const FILENAME = `NPDateTime`

function isValidDate(date) {
  return date && Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date)
}

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
})

/* Samples:
expect(result).toMatch(/someString/)
expect(result).not.toMatch(/someString/)
expect(result).toEqual([])
import { mockWasCalledWith } from '@mocks/mockHelpers'
      const spy = jest.spyOn(console, 'log')
      const result = mainFile.getConfig()
      expect(mockWasCalledWith(spy, /config was empty/)).toBe(true)
      spy.mockRestore()

      test('should return the command object', () => {
        const result = f.getPluginCommands({ 'plugin.commands': [{ a: 'foo' }] })
        expect(result).toEqual([{ a: 'foo' }])
      })
*/

describe(`${FILENAME}`, () => {
  /*
   * getMonthData()
   */
  describe('getMonthData()' /* function */, () => {
    test('should return today info with no params', () => {
      const result = f.getMonthData()
      expect(typeof result.monthIndex).toEqual('number')
      expect(typeof result.monthString).toEqual('string')
      expect(isValidDate(result.startDate)).toEqual(true)
      expect(isValidDate(result.endDate)).toEqual(true)
    })
    test('should work for string passed in ISO format', () => {
      const result = f.getMonthData('2020-01-01')
      expect(result.monthIndex).toEqual(0)
      expect(result.monthString).toEqual('2020-01')
    })
    test('should work for string passed in NP format', () => {
      const result = f.getMonthData('20200101')
      expect(result.monthIndex).toEqual(0)
      expect(result.monthString).toEqual('2020-01')
    })
    test('should work for date obj passed', () => {
      const result = f.getMonthData(new Date('2020-01-15'))
      expect(result.monthIndex).toEqual(0)
      expect(result.monthString).toEqual('2020-01')
    })
  })
  /*
   * getYearData()
   */
  describe('getYearData()' /* function */, () => {
    test('should return today info with no params', () => {
      const result = f.getYearData()
      expect(typeof result.yearString).toEqual('string')
      expect(isValidDate(result.startDate)).toEqual(true)
      expect(isValidDate(result.endDate)).toEqual(true)
    })
    test('should work for string passed full ISO', () => {
      const result = f.getYearData('2020-01-01')
      expect(result.yearString).toEqual('2020')
    })
    test('should work for string passed just month', () => {
      const result = f.getYearData('2020-01')
      expect(result.yearString).toEqual('2020')
    })
    test('should work for string passed in NP format', () => {
      const result = f.getYearData('20200101')
      expect(result.yearString).toEqual('2020')
    })
    test('should work for date obj passed', () => {
      const result = f.getYearData(new Date('2020-01-15'))
      expect(result.yearString).toEqual('2020')
    })
  })
  /*
   * getQuarterData()
   */
  describe('getQuarterData()' /* function */, () => {
    test('should return today info with no params', () => {
      const result = f.getQuarterData()
      expect(result.quarterIndex).toBeGreaterThanOrEqual(0)
      expect(result.quarterIndex).toBeLessThanOrEqual(3)
      expect(typeof result.quarterString).toEqual('string')
      expect(isValidDate(result.startDate)).toEqual(true)
      expect(isValidDate(result.endDate)).toEqual(true)
    })
    test('should work for string passed full ISO', () => {
      const result = f.getQuarterData('2020-01-01')
      expect(result).not.toBeNull()
      expect(result.quarterString).toEqual('2020-Q1')
    })
    test('should work for string passed just quarter', () => {
      const result = f.getQuarterData('2020-Q1')
      expect(result.quarterString).toEqual('2020-Q1')
    })
    test('should work for string passed in NP format', () => {
      const result = f.getQuarterData('20200101')
      expect(result.quarterString).toEqual('2020-Q1')
    })
    test('should work for date obj passed', () => {
      const result = f.getQuarterData(new Date('2020-01-15'))
      expect(result.quarterString).toEqual('2020-Q1')
    })
  })
})
