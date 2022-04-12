/* eslint-disable */

import helloWorld from '../src/support/hello-world'

describe('np.MeetingNotes', () => {
  describe('hello-world', () => {
    test('uppercase', async () => {
      const result = await helloWorld.uppercase('hello world')

      expect(result).toEqual('HELLO WORLD')
    })
  })
})
