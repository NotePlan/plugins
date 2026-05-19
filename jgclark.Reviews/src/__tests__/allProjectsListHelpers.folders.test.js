// @flow
/* eslint-disable */
/* globals describe, expect, test, beforeAll, afterAll */

import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan } from '@mocks/index'
import { getFoldersMatching } from '@helpers/folders'

/**
 * Mirrors enumerateMatchingProjectNoteTagPairs folder list when foldersToInclude is set.
 * @param {Array<string>} foldersToInclude
 * @param {boolean} excludeSpecialFolders
 * @returns {Array<string>}
 */
function filteredFolderListFromIncludes(foldersToInclude: Array<string>, excludeSpecialFolders: boolean): Array<string> {
  return getFoldersMatching(foldersToInclude, excludeSpecialFolders).sort()
}

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  DataStore.settings['_logLevel'] = 'none'
  DataStore.folders = [
    '/',
    '@Archive',
    '@Demo',
    '@Searches',
    '@Templates',
    'CCC Projects',
    'Home Areas',
  ]
})

afterAll(() => {
  delete global.DataStore
})

describe('Reviews folder include list (enumerateMatchingProjectNoteTagPairs pattern)', () => {
  test('foldersToInclude @Demo with excludeSpecialFolders true returns only / (bug)', () => {
    expect(filteredFolderListFromIncludes(['@Demo'], true)).toEqual(['/'])
  })

  test('foldersToInclude @Demo with excludeSpecialFolders false returns / and @Demo', () => {
    expect(filteredFolderListFromIncludes(['@Demo'], false)).toEqual(['/', '@Demo'])
  })
})
