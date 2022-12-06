// Jest testing docs: https://jestjs.io/docs/using-matchers
/* global describe, expect, test  */

import * as helpers from '../src/support/helpers'

describe('dwertheimer.AI' /* pluginID */, () => {
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
