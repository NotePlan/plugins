/* es lint-disable */

import rs from '../src/support/runSearch-helpers.test'

/*
Template:
    describe('functionName', () => {
      test('should capitalize string', async () => {
        const result = await dh.uppercase('hello world')
        expect(result).toEqual('HELLO WORLD')
      })
    })
*/

describe('dwertheimer.DataQuerying', () => {
  //plugin
  describe('data-helpers', () => {
    // file
    describe('uppercase', () => {
      // function
      test('should capitalize string', async () => {
        // test, starts with should
        const result = await dh.uppercase('hello world')
        expect(result).toEqual('HELLO WORLD')
      })
    })
  })
})
