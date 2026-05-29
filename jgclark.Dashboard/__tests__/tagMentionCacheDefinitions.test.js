// @flow
/* eslint-disable flowtype/require-valid-file-annotation */
/* globals describe, it, expect */

import { getListOfWantedTagsAndMentionsFromAllPerspectives } from '../src/tagMentionCache'
import type { TPerspectiveDef } from '../src/types'

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
