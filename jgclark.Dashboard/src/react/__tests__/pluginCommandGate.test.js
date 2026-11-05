// @flow
/* globals describe, expect, test */

import {
  isOpenNoteCommand,
  isQueueableUserMutationCommand,
  isQueueableWhilePluginBusy,
  pluginDataLooksBusy,
} from '../pluginCommandGate.js'

describe('pluginCommandGate', () => {
  test('queues open-note clicks while the plugin is busy', () => {
    expect(isOpenNoteCommand('showLineInEditorFromFilename')).toBe(true)
    expect(isOpenNoteCommand('showNoteInEditorFromFilename')).toBe(true)
    expect(isOpenNoteCommand('showNoteInEditorFromTitle')).toBe(true)
    expect(isOpenNoteCommand('openURL')).toBe(true)
    expect(isQueueableWhilePluginBusy('showLineInEditorFromFilename')).toBe(true)
  })

  test('still queues row mutations and does not treat them as open-note', () => {
    expect(isQueueableUserMutationCommand('completeTask')).toBe(true)
    expect(isOpenNoteCommand('completeTask')).toBe(false)
    expect(isQueueableWhilePluginBusy('completeReminder')).toBe(true)
  })

  test('does not queue refresh or search commands', () => {
    expect(isQueueableWhilePluginBusy('startSearch')).toBe(false)
    expect(isQueueableWhilePluginBusy('refreshEnabledSections')).toBe(false)
  })

  test('pluginDataLooksBusy treats a section-code refresh list as busy', () => {
    expect(pluginDataLooksBusy({ refreshing: ['SEARCH'] })).toBe(true)
    expect(pluginDataLooksBusy({ refreshing: true })).toBe(true)
    expect(pluginDataLooksBusy({ refreshing: false })).toBe(false)
    expect(pluginDataLooksBusy({ refreshing: [] })).toBe(false)
    expect(pluginDataLooksBusy(null)).toBe(false)
  })
})
