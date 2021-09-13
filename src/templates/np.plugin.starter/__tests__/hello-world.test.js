/* eslint-disable */

import helloWorld from '../src/support/hello-world'

describe('{{pluginId}}: hello-world', () => {
  test('hello-world: uppercase', async () => {
    const result = await helloWorld.uppercase('hello world')

    expect(result).toEqual('HELLO WORLD')
  })
})
