/* global describe, expect, test, beforeAll */
import colors from 'chalk'
import * as sc from '../NPSyncedCopies'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph } from '@mocks/index'

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

  /*
   * createURLToLine()
   */

  describe('createURLToLine()' /* function */, () => {
    test('should Create link to line that already has a blockId', () => {
      const n = new Note()
      const p = new Paragraph({ content: 'This is a test ^223344', note: n, rawContent: 'This is a test ^223344', blockId: '^223344' })
      n.paragraphs = [p]
      const result = sc.createURLToLine(p)
      expect(result).toEqual('noteplan://x-callback-url/openNote?noteTitle=PLACEHOLDER%5E223344')
    })
    test('should Create link to line that does not have a blockId', () => {
      const n = new Note()
      const p = new Paragraph({ content: 'This is a test', note: n, rawContent: 'This is a test' })
      n.paragraphs = [p]
      const result = sc.createURLToLine(p)
      expect(result).toEqual('noteplan://x-callback-url/openNote?noteTitle=PLACEHOLDER%5E123456')
    })
  })

  /*
   * createWikiLinkToLine()
   */

  describe('createWikiLinkToLine()' /* function */, () => {
    test('should Create link to line that already has a blockId', () => {
      const n = new Note()
      const p = new Paragraph({ content: 'This is a test ^223344', note: n, rawContent: 'This is a test ^223344', blockId: '^223344' })
      n.paragraphs = [p]
      const result = sc.createWikiLinkToLine(p)
      expect(result).toEqual('[[PLACEHOLDER^223344]]')
    })
    test('should Create link to line that does not have a blockId', () => {
      const n = new Note()
      const p = new Paragraph({ content: 'This is a test', note: n, rawContent: 'This is a test' })
      n.paragraphs = [p]
      const result = sc.createWikiLinkToLine(p)
      expect(result).toEqual('[[PLACEHOLDER^123456]]')
    })
  })

  /*
   * createPrettyLinkToLine()
   */

  describe('createPrettyLinkToLine()' /* function */, () => {
    test('should Create link to line that already has a blockId', () => {
      const n = new Note()
      const p = new Paragraph({ content: 'This is a test ^223344', note: n, rawContent: 'This is a test ^223344', blockId: '^223344' })
      n.paragraphs = [p]
      const result = sc.createPrettyLinkToLine(p, 'foo bar')
      expect(result).toEqual('[foo bar](noteplan://x-callback-url/openNote?noteTitle=PLACEHOLDER%5E223344)')
    })
    test('should Create link to line that does not have a blockId', () => {
      const n = new Note()
      const p = new Paragraph({ content: 'This is a test', note: n, rawContent: 'This is a test' })
      n.paragraphs = [p]
      const result = sc.createPrettyLinkToLine(p, 'foo bar')
      expect(result).toEqual('[foo bar](noteplan://x-callback-url/openNote?noteTitle=PLACEHOLDER%5E123456)')
    })
  })
})
