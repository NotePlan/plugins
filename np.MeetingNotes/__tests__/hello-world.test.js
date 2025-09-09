/* eslint-disable */

import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'
import helloWorld from '../src/support/hello-world'

// Make DataStore and Editor available globally for the source code
global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan

describe('np.MeetingNotes', () => {
  describe('hello-world', () => {
    test('uppercase', async () => {
      const result = await helloWorld.uppercase('hello world')

      expect(result).toEqual('HELLO WORLD')
    })
  })
})
