/* global jest, describe, test, expect, beforeAll */
import * as f from '../src/support/externalFileInteractions'
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

const PLUGIN_NAME = `shared.AI`
const FILENAME = `externalFileInteractions`

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'DEBUG' //change this to DEBUG to get more logging (or 'none' for none)
})

/* Samples:
expect(result).toMatch(/someString/)
expect(result).not.toMatch(/someString/)
expect(result).toEqual([])
import { mockWasCalledWith } from '@mocks/mockHelpers'
      const spy = jest.spyOn(console, 'log')
      const result = mainFile.getConfig()
      expect(mockWasCalledWith(spy, /config was empty/)).toBe(true)
      spy.mockRestore()

      test('should return the command object', () => {
        const result = f.getPluginCommands({ 'plugin.commands': [{ a: 'foo' }] })
        expect(result).toEqual([{ a: 'foo' }])
      })
*/

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    //functions go here using jfunc command
    /*
     * saveClickedLink()
     */
    describe('saveClickedLink()' /* function */, () => {
      test('should move a basic item (base case)', () => {
        const before = {
          unclickedLinks: ['Caterpillar Development', 'Camouflage', 'Predator-Prey Relationships', 'Migration', 'Macro-Moths'],
          initialSubject: 'Moths',
          clickedLinks: [],
          remixes: [],
        }
        const after = {
          unclickedLinks: ['Camouflage', 'Predator-Prey Relationships', 'Migration', 'Macro-Moths'],
          initialSubject: 'Moths',
          clickedLinks: ['Caterpillar Development'],
          remixes: [],
        }
        const result = f.saveClickedLink(before, 'Caterpillar Development')
        expect(result).toEqual(after)
      })
      test('should remove an item from the middle', () => {
        const before = {
          unclickedLinks: ['Camouflage', 'Predator-Prey Relationships', 'Migration', 'Macro-Moths'],
          initialSubject: 'Moths',
          clickedLinks: ['Caterpillar Development'],
          remixes: [],
        }
        const after = {
          unclickedLinks: ['Predator-Prey Relationships', 'Migration', 'Macro-Moths'],
          initialSubject: 'Moths',
          clickedLinks: ['Caterpillar Development', 'Camouflage'],
          remixes: [],
        }
        const result = f.saveClickedLink(before, 'Camouflage')
        expect(result).toEqual(after)
      })
    })
  })
})
