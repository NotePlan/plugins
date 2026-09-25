// @flow
/* eslint-disable flowtype/require-valid-file-annotation */
/* globals describe, it, expect */

import {
  buildTagMentionLookupContext,
  getCacheItemsFromNote,
  isWantedItem,
  isWantedMention,
  noteMayContainCacheItems,
  trimMentionSuffix,
} from '../src/tagMentionCache'
import { asTNote, DataStore } from '@mocks/index'

global.DataStore = DataStore
DataStore.settings = DataStore.settings || {}
DataStore.settings._logLevel = 'none'

// NB: the JSDoc `@returns {any}` that used to be here does nothing — Flow reads annotations, not
// JSDoc — so this returned a bare object literal and every call site reported one error per
// missing CoreNoteFields member (392 in this file). asTNote() is the annotation that counts.
function mockNote(content: string, paragraphs: Array<any> = [], frontmatterAttributes: any = {}): TNote {
  return asTNote({
    type: 'Notes',
    filename: 'test.md',
    content,
    paragraphs,
    frontmatterAttributes,
  })
}

describe('buildTagMentionLookupContext', () => {
  it('splits hashtags and mentions and builds wantedLower set', () => {
    const ctx = buildTagMentionLookupContext(['@home', '#project'])
    expect(ctx.wantedHashtags).toEqual(['#project'])
    expect(ctx.wantedMentions).toEqual(['@home'])
    expect(ctx.scanHashtags).toBe(true)
    expect(ctx.scanMentions).toBe(true)
    expect(ctx.wantedLower.has('@home')).toBe(true)
    expect(ctx.wantedLower.has('#project')).toBe(true)
  })

  it('sets scan flags false when list has only mentions', () => {
    const ctx = buildTagMentionLookupContext(['@work'])
    expect(ctx.scanHashtags).toBe(false)
    expect(ctx.scanMentions).toBe(true)
  })
})

describe('isWantedItem / trimMentionSuffix', () => {
  const ctx = buildTagMentionLookupContext(['@Bob', '#tag'])

  it('matches case-insensitively', () => {
    expect(isWantedItem('@bob', ctx)).toBe(true)
    expect(isWantedItem('#TAG', ctx)).toBe(true)
    expect(isWantedItem('@other', ctx)).toBe(false)
  })

  it('trims mention parenthetical suffix before match', () => {
    expect(trimMentionSuffix('@Bob (office)')).toBe('@Bob')
    expect(isWantedMention('@Bob (office)', ctx)).toBe(true)
  })
})

describe('noteMayContainCacheItems', () => {
  const ctx = buildTagMentionLookupContext(['@friend', '#home'])

  it('returns false when content has no wanted tokens', () => {
    expect(noteMayContainCacheItems(mockNote('plain note with no markers'), ctx)).toBe(false)
  })

  it('returns true when wanted mention appears in content', () => {
    expect(noteMayContainCacheItems(mockNote('task for @friend tomorrow'), ctx)).toBe(true)
  })

  it('returns false for empty wanted list', () => {
    expect(noteMayContainCacheItems(mockNote('@friend'), buildTagMentionLookupContext([]))).toBe(false)
  })

  it('returns true when wanted hashtag is only in an arbitrary frontmatter field', () => {
    const note = mockNote('plain body', [{ type: 'open', content: '- task' }], { category: '#home' })
    expect(noteMayContainCacheItems(note, ctx)).toBe(true)
  })
})

describe('getCacheItemsFromNote (open-items fast path)', () => {
  const wanted = ['@wanted', '#tagged']

  it('returns wanted mention only from open paragraph, not done', () => {
    const note = mockNote('body', [
      { type: 'open', content: '- [ ] task @wanted' },
      { type: 'done', content: '- [x] done @wanted' },
    ])
    expect(getCacheItemsFromNote(note, wanted).sort()).toEqual(['@wanted'])
  })

  it('returns wanted hashtag from checklist on open para', () => {
    const note = mockNote('body', [
      { type: 'checklist', content: '+ [ ] item #tagged' },
    ])
    expect(getCacheItemsFromNote(note, wanted)).toEqual(['#tagged'])
  })

  it('returns empty when note fails prefilter', () => {
    const note = mockNote('no tags or mentions here', [{ type: 'open', content: '- nothing' }])
    expect(getCacheItemsFromNote(note, wanted)).toEqual([])
  })

  it('includes wanted note-tag from frontmatter when not in body', () => {
    const note = mockNote(
      'no hash in body',
      [{ type: 'open', content: '- task' }],
      { 'note-tag': '#tagged, other' },
    )
    expect(getCacheItemsFromNote(note, ['#tagged']).sort()).toEqual(['#tagged'])
  })

  it('includes wanted hashtag from project metadata frontmatter', () => {
    const note = mockNote(
      'no hash in body',
      [{ type: 'open', content: '- task' }],
      { project: '#area #goal' },
    )
    expect(getCacheItemsFromNote(note, ['#area']).sort()).toEqual(['#area'])
  })

  it('includes wanted hashtag from any frontmatter field', () => {
    const note = mockNote(
      'no hash in body',
      [{ type: 'open', content: '- task' }],
      { status: 'blocked #tagged' },
    )
    expect(getCacheItemsFromNote(note, ['#tagged'])).toEqual(['#tagged'])
  })

  it('includes wanted mention from any frontmatter field', () => {
    const note = mockNote(
      'no mention in body',
      [{ type: 'open', content: '- task' }],
      { owner: '@wanted (home)' },
    )
    expect(getCacheItemsFromNote(note, ['@wanted'])).toEqual(['@wanted'])
  })
})
