/* global jest, describe, test, expect, beforeAll, beforeEach */
/* eslint-disable */

import { CustomConsole } from '@jest/console'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter } from '@mocks/index'
import { getRegularNotesInFolder } from '@helpers/folders'
import { getSettings } from '../src/noteHelpers'
import { findInconsistentNames } from '../src/helpers/findInconsistentNames'

jest.mock('@helpers/folders', () => ({
  getRegularNotesInFolder: jest.fn(() => []),
}))

jest.mock('../src/noteHelpers', () => ({
  getSettings: jest.fn(async () => ({ foldersToIgnore: '' })),
}))

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

describe('findInconsistentNames foldersToIgnore', () => {
  beforeEach(() => {
    getRegularNotesInFolder.mockClear()
    getSettings.mockClear()
  })

  test('passes an empty ignore list when the setting is blank', async () => {
    getSettings.mockResolvedValue({ foldersToIgnore: '' })
    await findInconsistentNames('Projects', true)
    expect(getRegularNotesInFolder).toHaveBeenCalledWith('Projects', true, [])
  })

  test('passes parsed folder names when the setting has entries', async () => {
    getSettings.mockResolvedValue({ foldersToIgnore: 'Readwise 📚, Archive' })
    await findInconsistentNames('/', true)
    expect(getRegularNotesInFolder).toHaveBeenCalledWith('/', true, ['Readwise 📚', 'Archive'])
  })
})
