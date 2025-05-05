/* globals describe, expect, test, beforeAll */

// Last updated: 6.9.2023 by @jgclark

import colors from 'chalk'
import { CustomConsole } from '@jest/console' // see note below
import * as t from '../teamspace'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /*, Note, Paragraph */ } from '@mocks/index'

beforeAll(() => {
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  DataStore.settings['_logLevel'] = 'none' // change this to DEBUG to get more logging, or 'none' for quiet
})

const PLUGIN_NAME = `📙 ${colors.yellow('helpers/teamspace')}`
// const section = colors.blue

describe(`${PLUGIN_NAME}`, () => {
  /*
  * parseTeamspaceFilename()
  */
  describe('parseTeamspaceFilename()' /* function */, () => {
    test('should parse a non-teamspace calendar filename', () => {
      const result = t.parseTeamspaceFilename('20250422.md')
      expect(result).toEqual({ filename: '20250422.md', isTeamspace: false })
    })
    test('should parse a Teamspace calendar filename', () => {
      const result = t.parseTeamspaceFilename('%%Supabase%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/20250422.md')
      expect(result).toEqual({ filename: '20250422.md', isTeamspace: true, teamspaceID: 'c484b190-77dd-4d40-a05c-e7d7144f24e1' })
    })
  })
})
