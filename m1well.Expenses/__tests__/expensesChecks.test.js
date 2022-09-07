/* global describe, expect, test, jest, beforeAll */

import { amountOk, categoryOk, logError, logMessage, validateConfig } from '../src/expensesChecks'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging
})

const SIMPLE_CONFIG = {
  folderPath: 'folder',
  delimiter: '%',
  dateFormat: 'yyyy-MM-dd',
  amountFormat: 'short',
  columnOrder: ['date', 'category', 'text', 'amount'],
  categories: ['Living', 'Media'],
  shortcutExpenses: [
    {
      category: 'Fun',
      text: 'Coffee',
      amount: 8,
    },
  ],
  fixedExpenses: [
    {
      category: 'Living',
      text: 'Flat Rent',
      amount: 600,
      active: true,
    },
    {
      category: 'Media',
      text: 'Spotify',
      amount: 10,
      active: true,
    },
  ],
}

const ALLOWED_DELIMTER = [';', '%', 'TAB']

const CONSOLE_SPY = jest.spyOn(console, 'log')

describe('expensesChecks', () => {
  describe('expensesChecks.js', () => {
    test('should check amount', () => {
      expect(amountOk(999999)).toBeTruthy()
      expect(amountOk(-999999)).toBeTruthy()
      expect(amountOk(null)).toBeFalsy()
      expect(amountOk(0)).toBeFalsy()
      expect(amountOk('test')).toBeFalsy()
      expect(amountOk(3000000)).toBeFalsy()
      expect(amountOk(-3000000)).toBeFalsy()
    })

    test('should check category', () => {
      const categories = ['Living', 'Media']
      expect(categoryOk('Living', categories)).toBeTruthy()
      expect(categoryOk('Insurances', categories)).toBeFalsy()
      expect(categoryOk(null, categories)).toBeFalsy()
    })

    test('should check complete config', () => {
      const defaultDelimiter = ';'

      const result = validateConfig(SIMPLE_CONFIG, new Date(), defaultDelimiter, ALLOWED_DELIMTER)

      expect(result).toEqual(SIMPLE_CONFIG)
    })

    test('should check incomplete config and add default delimiter', () => {
      const defaultDelimiter = ';'
      delete SIMPLE_CONFIG.delimiter

      const result = validateConfig(SIMPLE_CONFIG, new Date(), defaultDelimiter, ALLOWED_DELIMTER)

      expect(result).toEqual(SIMPLE_CONFIG)
      // expect(CONSOLE_SPY).toHaveBeenCalledWith("\texpenses log: no delimiter configured - set default to ';'")
    })

    test('should check incomplete config and throw error because no folder path', () => {
      const defaultDelimiter = ';'
      delete SIMPLE_CONFIG.folderPath

      const result = validateConfig(SIMPLE_CONFIG, new Date(), defaultDelimiter, ALLOWED_DELIMTER)

      expect(result.folderPath).toBeFalsy()
      expect(result.delimiter).toBeFalsy()
      expect(result.dateFormat).toBeFalsy()
      expect(result.columnOrder).toHaveLength(0)
      expect(result.categories).toHaveLength(0)
      expect(result.shortcutExpenses).toHaveLength(0)
      expect(result.fixedExpenses).toHaveLength(0)
      // expect(CONSOLE_SPY).toHaveBeenCalledWith('\texpenses error: no folder path configured')
    })

    test.skip(`should log message '\texpenses log: hello world'`, () => {
      logMessage('hello world')

      // expect(CONSOLE_SPY).toHaveBeenCalledWith('\texpenses log: hello world')
    })

    test.skip(`should log error message '\texpenses error: could not parse string'`, () => {
      logError('could not parse string').then(() => {
        // expect(CONSOLE_SPY).toHaveBeenCalledWith('\texpenses error: could not parse string')
      })
    })
  })
})
