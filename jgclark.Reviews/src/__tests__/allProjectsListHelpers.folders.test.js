// @flow
/* eslint-disable */
/* globals describe, expect, test, beforeAll, afterAll */

import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan } from '@mocks/index'
import { getFolderListMinusExclusions, getFoldersMatching } from '@helpers/folders'
import {
  ALWAYS_EXCLUDED_PROJECT_FOLDERS,
  getEffectiveFoldersToIgnore,
} from '../allProjectsListHelpers'

/**
 * Mirrors getFilteredFolderList when foldersToInclude is set (excludeSpecialFolders false,
 * but always exclude @Archive/@Templates/@Trash).
 * @param {Array<string>} foldersToInclude
 * @returns {Array<string>}
 */
function filteredFolderListFromIncludes(foldersToInclude: Array<string>): Array<string> {
  return getFoldersMatching(foldersToInclude, false, ALWAYS_EXCLUDED_PROJECT_FOLDERS).sort()
}

/**
 * Mirrors getFilteredFolderList when foldersToIgnore is used (no foldersToInclude).
 * @param {Array<string>} foldersToIgnore
 * @returns {Array<string>}
 */
function filteredFolderListFromIgnores(foldersToIgnore: Array<string>): Array<string> {
  return getFolderListMinusExclusions(getEffectiveFoldersToIgnore(foldersToIgnore), false, false).sort()
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
    '@Archive/Old Projects',
    '@Demo',
    '@Searches',
    '@Templates',
    '@Trash',
    'CCC Projects',
    'Home Areas',
  ]
})

afterAll(() => {
  delete global.DataStore
})

describe('getEffectiveFoldersToIgnore', () => {
  test('always includes @Archive, @Templates and @Trash', () => {
    expect(getEffectiveFoldersToIgnore([])).toEqual(['@Archive', '@Templates', '@Trash'])
  })

  test('merges user ignores without duplicating always-excluded folders', () => {
    expect(getEffectiveFoldersToIgnore(['Home Areas', '@Archive'])).toEqual([
      '@Archive',
      '@Templates',
      '@Trash',
      'Home Areas',
    ])
  })
})

describe('Reviews folder include list (enumerateMatchingProjectNoteTagPairs pattern)', () => {
  test('foldersToInclude @Demo still allows @Demo while excluding always-excluded specials', () => {
    expect(filteredFolderListFromIncludes(['@Demo'])).toEqual(['/', '@Demo'])
  })

  test('empty foldersToIgnore still excludes @Archive, @Templates and @Trash', () => {
    const result = filteredFolderListFromIgnores([])
    expect(result).not.toContain('@Archive')
    expect(result).not.toContain('@Archive/Old Projects')
    expect(result).not.toContain('@Templates')
    expect(result).not.toContain('@Trash')
    expect(result).toContain('@Demo')
    expect(result).toContain('CCC Projects')
  })

  test('user foldersToIgnore are applied in addition to always-excluded folders', () => {
    const result = filteredFolderListFromIgnores(['Home Areas'])
    expect(result).not.toContain('@Archive')
    expect(result).not.toContain('Home Areas')
    expect(result).toContain('CCC Projects')
  })
})
