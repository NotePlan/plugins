/* global describe, expect, test */
import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'
import * as w from '../src/support/weather-utils'

// Make DataStore and Editor available globally for the source code
global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan

// Jest docs for matchers: https://jestjs.io/docs/using-matchers

describe('np.WeatherLookup' /* pluginID */, () => {
  describe('utils' /* file */, () => {
    describe('isWeatherKeyValid' /* function */, () => {
      test('should return false on empty string', () => {
        const result = w.isWeatherKeyValid('')
        expect(result).toEqual(false)
      })
      test('should return false on undefined string', () => {
        const result = w.isWeatherKeyValid(undefined)
        expect(result).toEqual(false)
      })
      test('should return false on wrong string', () => {
        const result = w.isWeatherKeyValid(`foo`)
        expect(result).toEqual(false)
      })
      test('should return true on correct string signature', () => {
        const result = w.isWeatherKeyValid(`11634c5bc8f3ac1aa1442085146b969a`)
        expect(result).toEqual(true)
      })
    })
    //TODO: add test for getWeatherURLLatLong
    //TODO: add test for extractDailyForecastData
  })
})
