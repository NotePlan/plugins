/* eslint-disable */

import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'
import pluginJson from '../plugin.json'

// Make DataStore and Editor available globally for the source code
global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan

describe(`${pluginJson['plugin.id']}`, () => {
  it('should pass', () => {
    // this is stub test to satisfy when running tests across whole repository
    expect(true).toBe(true)
  })
})
