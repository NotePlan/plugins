/* global describe, test, expect, beforeAll */
/* eslint-disable */

import { CustomConsole } from '@jest/console'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter } from '@mocks/index'
import { foldersToIndex } from '../src/indexFolders'

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

describe('foldersToIndex', () => {
  const allFolders = ['Projects', 'Projects/Active', 'Projects/Archive', 'Home', 'Home Areas']

  test('this folder only ignores the config default of including subfolders', () => {
    const result = foldersToIndex('Projects', false, allFolders)
    expect(result).toEqual(['Projects'])
  })

  test('includeSubfolders true returns the folder and those that start with it', () => {
    const result = foldersToIndex('Projects', true, allFolders)
    expect(result).toEqual(['Projects', 'Projects/Active', 'Projects/Archive'])
  })
})
