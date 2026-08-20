// @flow
/* global describe, test, expect, beforeAll */
/* eslint-disable */

import { CustomConsole } from '@jest/console'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter } from '@mocks/index'
import { parseFoldersToIgnore } from '../src/helpers/parseFoldersToIgnore'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'none'
})

describe('parseFoldersToIgnore', () => {
  test('blank setting means ignore no folders', () => {
    expect(parseFoldersToIgnore('')).toEqual([])
    expect(parseFoldersToIgnore('   ')).toEqual([])
    expect(parseFoldersToIgnore(null)).toEqual([])
    expect(parseFoldersToIgnore(undefined)).toEqual([])
  })

  test('keeps a single folder name', () => {
    expect(parseFoldersToIgnore('Readwise 📚')).toEqual(['Readwise 📚'])
  })

  test('splits, trims, and drops empty entries', () => {
    expect(parseFoldersToIgnore('A, , B')).toEqual(['A', 'B'])
    expect(parseFoldersToIgnore('A, B,')).toEqual(['A', 'B'])
  })
})
