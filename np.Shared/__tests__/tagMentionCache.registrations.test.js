// @flow
/* globals beforeEach, describe, expect, jest, test */
// Tests for Shared tag-mention cache registration and prune

import {
  getRegularNoteFilenamesFromTagMentionCache,
  getTagMentionCacheDefinitions,
  getUnionOfTagMentionCacheRegistrations,
  parseTagMentionCacheRegistrationsJson,
  pruneTagMentionCacheToUnion,
  registerTagMentionCacheItems,
  unregisterTagMentionCacheItems,
} from '../src/tagMentionCache'
import { CommandBar, DataStore } from '@mocks/index'

global.DataStore = DataStore
global.CommandBar = CommandBar
DataStore.settings = DataStore.settings || {}
DataStore.settings._logLevel = 'none'

const SHARED_WANTED = '../../data/np.Shared/wantedTagMentionsList.json'
const SHARED_CACHE = '../../data/np.Shared/tagMentionCache.json'

describe('parseTagMentionCacheRegistrationsJson', () => {
  test('parses registrations map', () => {
    const raw = JSON.stringify({
      registrations: {
        'jgclark.Dashboard': ['@home', '#work'],
        'jgclark.Reviews': ['#project'],
      },
    })
    expect(parseTagMentionCacheRegistrationsJson(raw)).toEqual({
      'jgclark.Dashboard': ['@home', '#work'],
      'jgclark.Reviews': ['#project'],
    })
  })

  test('attributes legacy items array to Dashboard', () => {
    const raw = JSON.stringify({ items: ['@Alice', ' #goal '] })
    expect(parseTagMentionCacheRegistrationsJson(raw)).toEqual({
      'jgclark.Dashboard': ['@Alice', '#goal'],
    })
  })

  test('returns empty object for invalid JSON', () => {
    expect(parseTagMentionCacheRegistrationsJson('not-json')).toEqual({})
  })
})

describe('getUnionOfTagMentionCacheRegistrations', () => {
  test('unions and dedupes case-insensitively, keeping first spelling', () => {
    const union = getUnionOfTagMentionCacheRegistrations({
      'jgclark.Dashboard': ['#Work', '@alice'],
      'jgclark.Reviews': ['#work', '#project'],
    })
    expect(union).toEqual(['#Work', '@alice', '#project'])
  })

  test('returns empty array for empty registrations', () => {
    expect(getUnionOfTagMentionCacheRegistrations({})).toEqual([])
  })
})

describe('pruneTagMentionCacheToUnion', () => {
  test('drops items and empty notes that left the union', () => {
    const cache = {
      wantedItems: ['#project', '@alice', '#old'],
      regularNotes: [
        { filename: 'keep.md', items: ['#project', '#old'] },
        { filename: 'gone.md', items: ['#old'] },
      ],
      calendarNotes: [{ filename: '20260101.md', items: ['@alice'] }],
    }
    const pruned = pruneTagMentionCacheToUnion(cache, ['#project', '@alice'])
    expect(pruned.wantedItems).toEqual(['#project', '@alice'])
    expect(pruned.regularNotes).toEqual([{ filename: 'keep.md', items: ['#project'] }])
    expect(pruned.calendarNotes).toEqual([{ filename: '20260101.md', items: ['@alice'] }])
  })
})

describe('register / unregister', () => {
  let files: { [string]: string }
  let prefs: { [string]: any }

  beforeEach(() => {
    files = {}
    prefs = {}
    DataStore.fileExists = jest.fn((f) => f in files)
    DataStore.loadData = jest.fn((f) => files[f] ?? '')
    DataStore.saveData = jest.fn((content, f) => {
      files[f] = content
    })
    DataStore.preference = jest.fn((key) => prefs[key])
    DataStore.setPreference = jest.fn((key, value) => {
      prefs[key] = value
    })
    DataStore.calendarNotes = []
    DataStore.projectNotes = []
    CommandBar.showLoading = jest.fn()
  })

  test('register replaces only that plugin slot', () => {
    files[SHARED_WANTED] = JSON.stringify({
      registrations: {
        'jgclark.Dashboard': ['@home'],
        'jgclark.Reviews': ['#project'],
      },
    })
    const result = registerTagMentionCacheItems('jgclark.Reviews', ['#area', '#goal'])
    expect(result.union.sort()).toEqual(['#area', '#goal', '@home'].sort())
    expect(result.addedToUnion.sort()).toEqual(['#area', '#goal'].sort())
    expect(result.removedFromUnion).toEqual(['#project'])
    const saved = JSON.parse(files[SHARED_WANTED])
    expect(saved.registrations['jgclark.Dashboard']).toEqual(['@home'])
    expect(saved.registrations['jgclark.Reviews']).toEqual(['#area', '#goal'])
  })

  test('unregister drops items only when no other plugin wants them', () => {
    files[SHARED_WANTED] = JSON.stringify({
      registrations: {
        'jgclark.Dashboard': ['#shared', '@onlyDash'],
        'jgclark.Reviews': ['#shared', '#onlyReviews'],
      },
    })
    const result = unregisterTagMentionCacheItems('jgclark.Reviews')
    expect(result.union.sort()).toEqual(['#shared', '@onlyDash'].sort())
    expect(result.removedFromUnion).toEqual(['#onlyReviews'])
    const saved = JSON.parse(files[SHARED_WANTED])
    expect(saved.registrations['jgclark.Reviews']).toBeUndefined()
    expect(saved.registrations['jgclark.Dashboard']).toEqual(['#shared', '@onlyDash'])
  })

  test('getTagMentionCacheDefinitions returns the union', () => {
    files[SHARED_WANTED] = JSON.stringify({
      registrations: {
        a: ['#one'],
        b: ['#two'],
      },
    })
    expect(getTagMentionCacheDefinitions().sort()).toEqual(['#one', '#two'].sort())
  })
})

describe('getRegularNoteFilenamesFromTagMentionCache', () => {
  beforeEach(() => {
    DataStore.fileExists = jest.fn((f) => f === SHARED_CACHE)
    DataStore.loadData = jest.fn(() =>
      JSON.stringify({
        regularNotes: [
          { filename: 'proj.md', items: ['#project'] },
          { filename: 'other.md', items: ['@alice'] },
        ],
        calendarNotes: [{ filename: '20260101.md', items: ['#project'] }],
      }),
    )
    DataStore.preference = jest.fn(() => null)
    DataStore.setPreference = jest.fn()
  })

  test('returns only regular notes matching the tags', () => {
    expect(getRegularNoteFilenamesFromTagMentionCache(['#project'])).toEqual(['proj.md'])
  })

  test('returns empty when cache is missing', () => {
    DataStore.fileExists = jest.fn(() => false)
    expect(getRegularNoteFilenamesFromTagMentionCache(['#project'])).toEqual([])
  })
})
