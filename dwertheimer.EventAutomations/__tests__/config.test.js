/* globals describe, expect, it, test */
import * as c from '../src/config'

describe('dwertheimer.EventAutomations AutoTimeBlocking', () => {
  describe('config', () => {
    describe('getTimeBlockingDefaults', () => {
      test('should return timeblocks config', () => {
        const keys = Object.keys(c.getTimeBlockingDefaults())
        expect(keys.length).toBeGreaterThan(1)
      })
    })
    describe('validateTimeBlockConfig', () => {
      test('should be a function', () => {
        const config = c.getTimeBlockingDefaults()
        expect(c.validateTimeBlockConfig(config)).toEqual(config)
      })
      test('should throw an error on a bad config', () => {
        const config = c.getTimeBlockingDefaults()
        config.timeBlockTag = false
        expect(() => c.validateTimeBlockConfig(config)).toThrow(/timeBlockTag/)
      })
    })
  })
})
