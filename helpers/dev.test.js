/* global describe, expect, test, jest */

import { getRandomElementFromArray } from './dev'

describe('helpers', () => {

  describe('dev.js', () => {
    test('should get one random element of a given array', () => {
      const array = [ 'One', 'Two', 'Three' ]

      const result = getRandomElementFromArray(array)

      expect(array).toContain(result)
    })
  })

})
