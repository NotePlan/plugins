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

/** @returns {any} */
function mockNote(content, paragraphs = [], frontmatterAttributes = {}) {
  return {
    type: 'Notes',
    filename: 'test.md',
    content,
    paragraphs,
    frontmatterAttributes,
  }
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
})
