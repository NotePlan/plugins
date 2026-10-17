// @flow
/* globals describe, expect, test, beforeEach */

import {
  countClosedTasksAndChecklists,
  getAllStatusHashtags,
  getDefaultHiddenStatusTags,
  getMetadataTermRenames,
  getProjectStatusHashtagForFilter,
  getStatusHashtagForState,
  initialStatusHashtagForNoteParas,
  normalizeMentionTerm,
  noteHasExactFrontmatterKey,
  planPausedHashtagMigrationFromCombined,
  resolveStatusHashtagForFinishReviewWhenMissing,
  replaceBodyMentionTerm,
  replaceOrStripHashtagInCombinedValue,
  resolveDisplayStatusHashtag,
  resolveStatusHashtagToWrite,
  statusValueMatchesHashtag,
} from '../projectStatus'

const preferenceValues: { [string]: any } = {}

/**
 * Minimal paragraph stubs for helpers that only read `type` / `content`.
 * @param {Array<{ type: string, content: string }>} items
 * @returns {Array<TParagraph>}
 */
function stubParas(items: Array<{ type: string, content: string }>): Array<TParagraph> {
  return (items: any)
}

beforeEach(() => {
  // $FlowFixMe[prop-missing] test stub
  global.DataStore = {
    preference: (key: string): any => preferenceValues[key],
    setPreference: (key: string, value: any): void => {
      preferenceValues[key] = value
    },
  }
  Object.keys(preferenceValues).forEach((k) => {
    delete preferenceValues[k]
  })
  preferenceValues['startMentionStr'] = 'started'
  preferenceValues['completedMentionStr'] = 'completed'
  preferenceValues['cancelledMentionStr'] = 'cancelled'
  preferenceValues['pausedMentionStr'] = 'paused'
  preferenceValues['notstartedMentionStr'] = 'notstarted'
  preferenceValues['useProjectStatus'] = true
})

describe('normalizeMentionTerm', () => {
  test('strips @ and # and falls back to default', () => {
    expect(normalizeMentionTerm('@started', 'started')).toBe('started')
    expect(normalizeMentionTerm('#paused', 'paused')).toBe('paused')
    expect(normalizeMentionTerm('', 'notstarted')).toBe('notstarted')
  })
})

describe('getStatusHashtagForState', () => {
  test('builds hashtags from settings', () => {
    expect(getStatusHashtagForState('notstarted')).toBe('#notstarted')
    expect(getStatusHashtagForState('started')).toBe('#started')
    expect(getStatusHashtagForState('paused')).toBe('#paused')
    expect(getStatusHashtagForState('completed')).toBe('#completed')
    expect(getStatusHashtagForState('cancelled')).toBe('#cancelled')
  })

  test('uses custom start term', () => {
    preferenceValues['startMentionStr'] = 'begun'
    expect(getStatusHashtagForState('started')).toBe('#begun')
  })
})

describe('statusValueMatchesHashtag', () => {
  test('matches with or without hash', () => {
    expect(statusValueMatchesHashtag('#started', '#started')).toBe(true)
    expect(statusValueMatchesHashtag('started', '#started')).toBe(true)
    expect(statusValueMatchesHashtag('#paused', '#started')).toBe(false)
  })
})

describe('resolveStatusHashtagToWrite', () => {
  test('completed/cancelled/paused win over explicit state', () => {
    expect(
      resolveStatusHashtagToWrite({ isCompleted: true, isCancelled: false, isPaused: true }, 'started', '#notstarted'),
    ).toBe('#completed')
    expect(
      resolveStatusHashtagToWrite({ isCompleted: false, isCancelled: true, isPaused: false }, 'started', null),
    ).toBe('#cancelled')
    expect(
      resolveStatusHashtagToWrite({ isCompleted: false, isCancelled: false, isPaused: true }, 'started', null),
    ).toBe('#paused')
  })

  test('unpause / explicit started and preserve notstarted', () => {
    expect(
      resolveStatusHashtagToWrite({ isCompleted: false, isCancelled: false, isPaused: false }, 'started', '#paused'),
    ).toBe('#started')
    expect(
      resolveStatusHashtagToWrite({ isCompleted: false, isCancelled: false, isPaused: false }, null, '#notstarted'),
    ).toBe('#notstarted')
  })
})

describe('getAllStatusHashtags / getDefaultHiddenStatusTags', () => {
  test('returns five status hashtags and default hidden finished pair', () => {
    expect(getAllStatusHashtags()).toEqual(['#notstarted', '#started', '#paused', '#completed', '#cancelled'])
    expect(getDefaultHiddenStatusTags()).toEqual(['#completed', '#cancelled'])
  })
})

describe('resolveDisplayStatusHashtag', () => {
  test('returns empty when status feature off', () => {
    preferenceValues['useProjectStatus'] = false
    expect(resolveDisplayStatusHashtag('#started', { isCompleted: false, isCancelled: false, isPaused: false })).toBe('')
  })

  test('uses matching frontmatter hashtag when feature on', () => {
    expect(resolveDisplayStatusHashtag('#started', { isCompleted: false, isCancelled: false, isPaused: false })).toBe('#started')
    expect(resolveDisplayStatusHashtag('notstarted', { isCompleted: false, isCancelled: false, isPaused: false })).toBe('#notstarted')
  })

  test('infers from flags when frontmatter missing or unknown', () => {
    expect(resolveDisplayStatusHashtag(null, { isCompleted: true, isCancelled: false, isPaused: false })).toBe('#completed')
    expect(resolveDisplayStatusHashtag('#custom', { isCompleted: false, isCancelled: false, isPaused: true })).toBe('#paused')
    expect(resolveDisplayStatusHashtag(null, { isCompleted: false, isCancelled: false, isPaused: false })).toBe('#notstarted')
  })

  test('finished/paused flags override a stale known status: value', () => {
    expect(resolveDisplayStatusHashtag('#started', { isCompleted: true, isCancelled: false, isPaused: false })).toBe('#completed')
    expect(resolveDisplayStatusHashtag('#started', { isCompleted: false, isCancelled: true, isPaused: false })).toBe('#cancelled')
    expect(resolveDisplayStatusHashtag('#notstarted', { isCompleted: false, isCancelled: false, isPaused: true })).toBe('#paused')
  })
})

describe('getProjectStatusHashtagForFilter', () => {
  test('prefers stored statusHashtag when not finished/paused; flags win when finished', () => {
    expect(getProjectStatusHashtagForFilter({ statusHashtag: '#started' })).toBe('#started')
    expect(getProjectStatusHashtagForFilter({ isCompleted: true })).toBe('#completed')
    expect(getProjectStatusHashtagForFilter({ statusHashtag: '#started', isCompleted: true })).toBe('#completed')
    expect(getProjectStatusHashtagForFilter({ isPaused: true })).toBe('#paused')
    expect(getProjectStatusHashtagForFilter({})).toBe('#notstarted')
  })
})

describe('initialStatusHashtagForNoteParas', () => {
  test('notstarted when no closed items; started when ≥1 closed', () => {
    expect(initialStatusHashtagForNoteParas([])).toBe('#notstarted')
    expect(
      initialStatusHashtagForNoteParas(stubParas([
        { type: 'open', content: 'todo' },
      ])),
    ).toBe('#notstarted')
    expect(
      initialStatusHashtagForNoteParas(stubParas([
        { type: 'done', content: 'done task' },
      ])),
    ).toBe('#started')
    expect(
      initialStatusHashtagForNoteParas(stubParas([
        { type: 'checklistDone', content: 'done checklist' },
      ])),
    ).toBe('#started')
  })
})

describe('resolveStatusHashtagForFinishReviewWhenMissing', () => {
  test('paused when project field has #paused, else started/notstarted from closed items', () => {
    expect(
      resolveStatusHashtagForFinishReviewWhenMissing([], '#project #paused @review(2w)'),
    ).toBe('#paused')
    expect(
      resolveStatusHashtagForFinishReviewWhenMissing(
        stubParas([{ type: 'done', content: 'done' }]),
        '#project #paused',
      ),
    ).toBe('#paused')
    expect(
      resolveStatusHashtagForFinishReviewWhenMissing(
        stubParas([{ type: 'done', content: 'done' }]),
        '#project',
      ),
    ).toBe('#started')
    expect(resolveStatusHashtagForFinishReviewWhenMissing([], '#project')).toBe('#notstarted')
  })
})

describe('countClosedTasksAndChecklists', () => {
  test('counts done and cancelled tasks and checklists', () => {
    expect(
      countClosedTasksAndChecklists(stubParas([
        { type: 'done', content: 'a' },
        { type: 'cancelled', content: 'b' },
        { type: 'checklistDone', content: 'c' },
        { type: 'checklistCancelled', content: 'd' },
        { type: 'open', content: 'e' },
      ])),
    ).toBe(4)
  })
})

describe('getMetadataTermRenames', () => {
  test('detects start and paused renames', () => {
    const renames = getMetadataTermRenames(
      { startMentionStr: 'start', pausedMentionStr: 'paused' },
      { startMentionStr: 'started', pausedMentionStr: 'onhold' },
    )
    expect(renames).toEqual([
      { settingKey: 'startMentionStr', oldTerm: 'start', newTerm: 'started' },
      { settingKey: 'pausedMentionStr', oldTerm: 'paused', newTerm: 'onhold' },
    ])
  })
})

describe('replaceBodyMentionTerm', () => {
  test('renames @start( to @started(', () => {
    expect(replaceBodyMentionTerm('x @start(2020-01-01) y', 'start', 'started')).toBe('x @started(2020-01-01) y')
  })
})

describe('noteHasExactFrontmatterKey', () => {
  test('requires an exact frontmatter key line, not a hashtag or similar key name', () => {
    const note: any = {
      paragraphs: [
        { content: '---' },
        { content: 'title: Test' },
        { content: 'project: #project #started' },
        { content: 'started: 2020-01-01' },
        { content: '---' },
      ],
    }
    expect(noteHasExactFrontmatterKey(note, 'started')).toBe(true)
    expect(noteHasExactFrontmatterKey(note, 'start')).toBe(false)
    expect(noteHasExactFrontmatterKey(note, 'project')).toBe(true)
  })
})

describe('replaceOrStripHashtagInCombinedValue', () => {
  test('renames or strips paused from combined tags', () => {
    expect(replaceOrStripHashtagInCombinedValue('#project #paused', 'paused', 'onhold', false)).toBe('#project #onhold')
    expect(replaceOrStripHashtagInCombinedValue('#project #paused', 'paused', 'onhold', true)).toBe('#project')
  })

  test('leaves combined value unchanged when target hashtag is absent (preserves @mentions)', () => {
    const withMentions = '#area @reviewed(2023-09-25) @nextReview(2024-01-28) @review(3m)'
    expect(replaceOrStripHashtagInCombinedValue(withMentions, 'paused', '__paused', true)).toBe(withMentions)
    expect(replaceOrStripHashtagInCombinedValue(withMentions, 'paused', '__paused', false)).toBe(withMentions)
  })

  test('strips paused hashtag but keeps surrounding @mentions', () => {
    expect(
      replaceOrStripHashtagInCombinedValue('#project #paused @review(2m) @reviewed(2020-10-14)', 'paused', 'onhold', true),
    ).toBe('#project @review(2m) @reviewed(2020-10-14)')
  })
})

describe('planPausedHashtagMigrationFromCombined', () => {
  test('moves paused hashtag off project field onto status hashtag (new term)', () => {
    expect(
      planPausedHashtagMigrationFromCombined(
        '#project #paused @started(2022-09-03) @review(2w)',
        'paused',
        '_paused',
      ),
    ).toEqual({
      nextCombined: '#project @started(2022-09-03) @review(2w)',
      statusHashtag: '#_paused',
    })
  })

  test('returns null when combined field has no paused hashtag', () => {
    expect(
      planPausedHashtagMigrationFromCombined('#project @started(2022-09-03)', 'paused', '_paused'),
    ).toBeNull()
  })
})
