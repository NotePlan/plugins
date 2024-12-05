// Jest testing docs: https://jestjs.io/docs/using-matchers
/* global describe, expect, test, beforeAll  */
import { CustomConsole } from '@jest/console' // see note below
import * as helpers from '../src/support/helpers'
import { simpleFormatter, DataStore /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

beforeAll(() => {
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  global.DataStore = DataStore
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
})
describe('shared.AI' /* pluginID */, () => {
  describe('helpers' /* file */, () => {
    describe('calculateCost' /* function */, () => {
      test('should calculate cost correctly', async () => {
        // tests start with "should" to describe the expected behavior
        const result = await helpers.calculateCost('text-davinci-003', 1000)
        expect(result).toEqual(0.02)
      })
      test('should calculate cost correctly for base case', async () => {
        // tests start with "should" to describe the expected behavior
        const result = await helpers.calculateCost('text-davinci-003', 1000)
        expect(result).toEqual(0.02)
      })
      test('should calculate cost correctly', async () => {
        // tests start with "should" to describe the expected behavior
        const result = await helpers.calculateCost('text-davinci-003', 500)
        expect(result).toEqual(0.01)
      })
    })
  })
})
