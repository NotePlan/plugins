/* global describe, expect, test, beforeAll */
import colors from 'chalk'
import * as sc from '../NPSyncedCopies'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan /*, Note, Paragraph */ } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging
})

const FILE = `${colors.yellow('helpers/NPSyncedCopies')}`

describe(`${FILE}`, () => {
  // TODO: need to add tests for: getSyncedCopiesAsList with mocks
  describe('getSyncedCopiesAsList', () => {
    test('should return empty list if no paragraphs', () => {
      const res = sc.getSyncedCopiesAsList([])
      expect(res).toEqual([])
    })
    test('should return a single synced copy', () => {
      const res = sc.getSyncedCopiesAsList([])
      expect(res).toEqual([])
    })
  })
})
