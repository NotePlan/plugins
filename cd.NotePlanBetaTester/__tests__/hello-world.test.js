/* eslint-disable */

import helloWorld from '../src/support/hello-world'

describe('cd.NotePlanBetaTester', () => {
  describe('hello-world', () => {
    test('uppercase', async () => {
      const result = await helloWorld.uppercase('hello world')

      expect(result).toEqual('HELLO WORLD')
    })
  })
})
