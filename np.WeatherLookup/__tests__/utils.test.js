import * as w from '../src/support/weather-utils'

// Jest docs for matchers: https://jestjs.io/docs/using-matchers

describe('np.WeatherLookup' /* pluginID */, () => {
  describe('utils' /* file */, () => {
    describe('isWeatherKeyValid' /* function */, () => {
      test('should return false on empty string', async () => {
        const result = w.isWeatherKeyValid('')
        expect(result).toEqual(false)
      })
      test('should return false on undefined string', async () => {
        const result = w.isWeatherKeyValid(undefined)
        expect(result).toEqual(false)
      })
      test('should return false on wrong string', async () => {
        const result = w.isWeatherKeyValid(`foo`)
        expect(result).toEqual(false)
      })
      test('should return true on correct string signature', async () => {
        const result = w.isWeatherKeyValid(`11634c5bc8f3ac1aa1442085146b969a`)
        expect(result).toEqual(true)
      })
    })
    //TODO: add test for getWeatherURLLatLong
    //TODO: add test for extractDailyForecastData
  })
})
