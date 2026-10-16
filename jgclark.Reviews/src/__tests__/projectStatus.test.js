// @flow
/* globals describe, expect, test, beforeEach */

import {
  countClosedTasksAndChecklists,
  getMetadataTermRenames,
  getStatusHashtagForState,
  initialStatusHashtagForNoteParas,
  normalizeMentionTerm,
  replaceBodyMentionTerm,
  replaceOrStripHashtagInCombinedValue,
  resolveStatusHashtagToWrite,
  statusValueMatchesHashtag,
} from '../projectStatus'

const preferenceValues: { [string]: any } = {}

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

describe('initialStatusHashtagForNoteParas', () => {
  test('notstarted when no closed items; started when ≥1 closed', () => {
    expect(initialStatusHashtagForNoteParas([])).toBe('#notstarted')
    expect(
      initialStatusHashtagForNoteParas([
        // $FlowFixMe[prop-missing]
        { type: 'open', content: 'todo' },
      ]),
    ).toBe('#notstarted')
    expect(
      initialStatusHashtagForNoteParas([
        // $FlowFixMe[prop-missing]
        { type: 'done', content: 'done task' },
      ]),
    ).toBe('#started')
    expect(
      initialStatusHashtagForNoteParas([
        // $FlowFixMe[prop-missing]
        { type: 'checklistDone', content: 'done checklist' },
      ]),
    ).toBe('#started')
  })
})

describe('countClosedTasksAndChecklists', () => {
  test('counts done and cancelled tasks and checklists', () => {
    expect(
      countClosedTasksAndChecklists([
        // $FlowFixMe[prop-missing]
        { type: 'done', content: 'a' },
        // $FlowFixMe[prop-missing]
        { type: 'cancelled', content: 'b' },
        // $FlowFixMe[prop-missing]
        { type: 'checklistDone', content: 'c' },
        // $FlowFixMe[prop-missing]
        { type: 'checklistCancelled', content: 'd' },
        // $FlowFixMe[prop-missing]
        { type: 'open', content: 'e' },
      ]),
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

describe('replaceOrStripHashtagInCombinedValue', () => {
  test('renames or strips paused from combined tags', () => {
    expect(replaceOrStripHashtagInCombinedValue('#project #paused', 'paused', 'onhold', false)).toBe('#project #onhold')
    expect(replaceOrStripHashtagInCombinedValue('#project #paused', 'paused', 'onhold', true)).toBe('#project')
  })
})
