// @flow
/* eslint-disable flowtype/require-valid-file-annotation */
/* globals beforeEach, describe, expect, it, jest */

import { getListOfWantedTagsAndMentionsFromAllPerspectives, updateTagMentionCacheDefinitionsFromAllPerspectives } from '../src/tagMentionCache'
import type { TPerspectiveDef } from '../src/types'
import { CommandBar, DataStore } from '@mocks/index'

global.DataStore = DataStore
global.CommandBar = CommandBar
DataStore.settings = DataStore.settings || {}
DataStore.settings._logLevel = 'none'

/** @returns {TPerspectiveDef} */
function perspective(name: string, tagsToShow: string): TPerspectiveDef {
  return {
    name,
    isActive: false,
    isModified: false,
    dashboardSettings: { tagsToShow },
  }
}

describe('getListOfWantedTagsAndMentionsFromAllPerspectives', () => {
  it('returns union of tagsToShow across all perspectives', () => {
    const defs = [
      perspective('-', ''),
      perspective('CCC', '@RP, @JA, @facilities, @treasurer'),
      perspective('home', '@home'),
      perspective('work', '@JGC, @DBW'),
    ]
    const items = getListOfWantedTagsAndMentionsFromAllPerspectives(defs)
    expect(items.sort()).toEqual(
      ['@DBW', '@JA', '@JGC', '@RP', '@facilities', '@home', '@treasurer'].sort(),
    )
  })

  it('dedupes the same tag in multiple perspectives', () => {
    const defs = [perspective('a', '@friend'), perspective('b', '@friend, @work')]
    expect(getListOfWantedTagsAndMentionsFromAllPerspectives(defs).sort()).toEqual(['@friend', '@work'].sort())
  })

  it('returns empty array when no perspective has tagsToShow', () => {
    const defs = [perspective('-', ''), perspective('x', '')]
    expect(getListOfWantedTagsAndMentionsFromAllPerspectives(defs)).toEqual([])
  })

  it('trims whitespace around comma-separated tags', () => {
    const defs = [perspective('one', '  @a , @b  ')]
    expect(getListOfWantedTagsAndMentionsFromAllPerspectives(defs).sort()).toEqual(['@a', '@b'].sort())
  })
})

describe('updateTagMentionCacheDefinitionsFromAllPerspectives', () => {
  const sharedWanted = '../../data/np.Shared/wantedTagMentionsList.json'
  let files: { [string]: string }

  beforeEach(() => {
    files = {
      [sharedWanted]: JSON.stringify({
        registrations: {
          'jgclark.Dashboard': ['@old'],
          'jgclark.Reviews': ['#project'],
        },
      }),
    }
    DataStore.fileExists = jest.fn((f) => f in files)
    DataStore.loadData = jest.fn((f) => files[f] ?? '')
    DataStore.saveData = jest.fn((content, f) => {
      files[f] = content
    })
    DataStore.preference = jest.fn(() => null)
    DataStore.setPreference = jest.fn()
    DataStore.calendarNotes = []
    DataStore.projectNotes = []
    CommandBar.showLoading = jest.fn()
  })

  it('updates only the Dashboard registration slot', () => {
    updateTagMentionCacheDefinitionsFromAllPerspectives([
      perspective('home', '@home'),
      perspective('work', '@JGC'),
    ])
    const saved = JSON.parse(files[sharedWanted])
    expect(saved.registrations['jgclark.Reviews']).toEqual(['#project'])
    expect(saved.registrations['jgclark.Dashboard'].sort()).toEqual(['@JGC', '@home'].sort())
  })
})
