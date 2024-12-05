/* global jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */

import * as c from '../src/config'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

beforeAll(() => {
  global.DataStore = DataStore
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
})

describe('dwertheimer.EventAutomations AutoTimeBlocking', () => {
  describe('config', () => {
    describe('getTimeBlockingDefaults', () => {
      test('should return timeblocks config', () => {
        const keys = Object.keys(c.getTimeBlockingDefaults())
        expect(keys.length).toBeGreaterThan(1)
      })
    })
    describe('validateAutoTimeBlockingConfig', () => {
      test('should be a function', () => {
        const config = c.getTimeBlockingDefaults()
        expect(c.validateAutoTimeBlockingConfig(config)).toEqual(config)
      })
      test('should throw an error on a bad config', () => {
        const config = c.getTimeBlockingDefaults()
        config.timeBlockTag = false
        expect(() => c.validateAutoTimeBlockingConfig(config)).toThrow(/timeBlockTag/)
      })
    })
    describe('arrayToCSV', () => {
      test('should convert an array to a CSV string', () => {
        const arr = ['a', 'b', 'c']
        const csv = c.arrayToCSV(arr)
        expect(csv).toEqual('a, b, c')
      })
      test('should pass through a string as a string', () => {
        const string = 'abc'
        const csv = c.arrayToCSV(string)
        expect(csv).toEqual('abc')
      })
    })
  })
})
