/* eslint-disable */

import helloWorld from '../src/support/hello-world'

describe('{{pluginId}}', () => {
  describe('hello-world', () => {
    test('uppercase', async () => {
      const result = await helloWorld.uppercase('hello world')

      expect(result).toEqual('HELLO WORLD')
    })
  })
})
