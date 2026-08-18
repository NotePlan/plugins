/* global describe, test, expect, beforeAll */
/* eslint-disable */

import { CustomConsole } from '@jest/console'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter } from '@mocks/index'
import { getNoteOpenIdentifier } from '../src/noteNavigation'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'none'
})

describe('getNoteOpenIdentifier', () => {
  test('prefers filename so duplicate titles cannot open the wrong note', () => {
    const note = { filename: 'Projects/Alpha.md', title: 'Alpha' }
    expect(getNoteOpenIdentifier(note)).toEqual({ by: 'filename', value: 'Projects/Alpha.md' })
  })

  test('falls back to title when filename is missing', () => {
    const note = { filename: '', title: 'Alpha' }
    expect(getNoteOpenIdentifier(note)).toEqual({ by: 'title', value: 'Alpha' })
  })

  test('returns null when neither filename nor title is available', () => {
    const note = { filename: '', title: '' }
    expect(getNoteOpenIdentifier(note)).toEqual(null)
  })
})
