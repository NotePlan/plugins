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
  /**
   * isTeamspaceNoteFromFilename()
   */
  describe('isTeamspaceNoteFromFilename()' /* function */, () => {
    test('should return true for a Teamspace calendar filename', () => {
      const result = t.isTeamspaceNoteFromFilename('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/20250422.md')
      expect(result).toEqual(true)
    })
    test('should return false for a non-Teamspace calendar filename', () => {
      const result = t.isTeamspaceNoteFromFilename('20250422.md')
      expect(result).toEqual(false)
    })
    test('should return false for a non-Teamspace filename', () => {
      const result = t.isTeamspaceNoteFromFilename('TEST/teamspace testing.md')
      expect(result).toEqual(false)
    })
    test('should return true for a Teamspace regular note filename', () => {
      const result = t.isTeamspaceNoteFromFilename('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/5a31e9ea-732f-45ba-8464-11260522e0de')
      expect(result).toEqual(true)
    })
    test('should return true for a Teamspace sub-folder regular note filename', () => {
      const result = t.isTeamspaceNoteFromFilename('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/test folder/5a31e9ea-732f-45ba-8464-11260522e0de')
      expect(result).toEqual(true)
    })
  })

  /**
   * parseTeamspaceFilename()
   */
  describe('parseTeamspaceFilename()' /* function */, () => {
    test('should parse a non-teamspace calendar filename', () => {
      const result = t.parseTeamspaceFilename('20250422.md')
      expect(result.isTeamspace).toEqual(false)
      expect(result.filename).toEqual('20250422.md')
      expect(result.filepath).toEqual('/')
      expect(result.teamspaceID).toEqual(undefined)
    })
    test('should parse a non-teamspace filename', () => {
      const result = t.parseTeamspaceFilename('TEST/teamspace testing.md')
      expect(result.isTeamspace).toEqual(false)
      expect(result.filename).toEqual('TEST/teamspace testing.md')
      expect(result.filepath).toEqual('TEST')
      expect(result.teamspaceID).toEqual(undefined)
    })
    test('should parse a Teamspace calendar filename', () => {
      const result = t.parseTeamspaceFilename('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/20250422.md')
      expect(result.isTeamspace).toEqual(true)
      expect(result.filename).toEqual('20250422.md')
      expect(result.filepath).toEqual('')
      expect(result.teamspaceID).toEqual('c484b190-77dd-4d40-a05c-e7d7144f24e1')
    })
    test('should parse a Teamspace top-level regular note filename', () => {
      const result = t.parseTeamspaceFilename('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/5a31e9ea-732f-45ba-8464-11260522e0de')
      expect(result.isTeamspace).toEqual(true)
      expect(result.filename).toEqual('5a31e9ea-732f-45ba-8464-11260522e0de')
      expect(result.filepath).toEqual('/')
      expect(result.teamspaceID).toEqual('c484b190-77dd-4d40-a05c-e7d7144f24e1')
    })
    test('should parse a Teamspace regular note filename in a folder', () => {
      const result = t.parseTeamspaceFilename('%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919/Dashboard Issues/9972af6a-ec7a-4fe5-87b9-9005aa0d122c')
      expect(result.isTeamspace).toEqual(true)
      expect(result.filename).toEqual('Dashboard Issues/9972af6a-ec7a-4fe5-87b9-9005aa0d122c')
      expect(result.filepath).toEqual('Dashboard Issues')
      expect(result.teamspaceID).toEqual('1b91b194-4c76-4a48-8d4d-4c499d64a919')
    })
    test('should parse a Teamspace folder path', () => {
      const result = t.parseTeamspaceFilename('%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919/Dashboard Issues')
      expect(result.isTeamspace).toEqual(true)
      expect(result.filename).toEqual('Dashboard Issues')
      expect(result.filepath).toEqual('Dashboard Issues')
      expect(result.teamspaceID).toEqual('1b91b194-4c76-4a48-8d4d-4c499d64a919')
    })
  })

  /*
   * getFilenameWithoutTeamspaceID()
   */
  describe('getFilenameWithoutTeamspaceID()' /* function */, () => {
    test('should parse a non-teamspace calendar filename', () => {
      const result = t.getFilenameWithoutTeamspaceID('20250422.md')
      expect(result).toEqual('20250422.md')
    })
    test('should parse a non-teamspace filename', () => {
      const result = t.getFilenameWithoutTeamspaceID('TEST/teamspace testing.md')
      expect(result).toEqual('TEST/teamspace testing.md')
    })
    test('should parse a Teamspace calendar filename', () => {
      const result = t.getFilenameWithoutTeamspaceID('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/20250422.md')
      expect(result).toEqual('20250422.md')
    })
    test('should parse a Teamspace top-level regular note filename', () => {
      const result = t.getFilenameWithoutTeamspaceID('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/5a31e9ea-732f-45ba-8464-11260522e0de')
      expect(result).toEqual('5a31e9ea-732f-45ba-8464-11260522e0de')
    })
    test('should parse a Teamspace regular note filename in a folder', () => {
      const result = t.getFilenameWithoutTeamspaceID('%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919/Dashboard Issues/9972af6a-ec7a-4fe5-87b9-9005aa0d122c')
      expect(result).toEqual('Dashboard Issues/9972af6a-ec7a-4fe5-87b9-9005aa0d122c')
    })
  })

  /*
   * getTeamspaceIDFromFilename()
   */
  describe('getTeamspaceIDFromFilename()' /* function */, () => {
    test('should parse a non-teamspace calendar filename', () => {
      const result = t.getTeamspaceIDFromFilename('20250422.md')
      expect(result).toEqual('')
    })
    test('should parse a non-teamspace filename', () => {
      const result = t.getTeamspaceIDFromFilename('TEST/teamspace testing.md')
      expect(result).toEqual('')
    })
    test('should parse a Teamspace calendar filename', () => {
      const result = t.getTeamspaceIDFromFilename('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/20250422.md')
      expect(result).toEqual('c484b190-77dd-4d40-a05c-e7d7144f24e1')
    })
  })
})
