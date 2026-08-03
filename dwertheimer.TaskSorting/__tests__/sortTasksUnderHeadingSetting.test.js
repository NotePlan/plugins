/* global describe, test, expect, beforeAll, afterEach, jest */
// @flow
// Regression tests for sortTasksUnderHeading()'s handling of the "Combine Related Task Types?" setting.
//
// Background: the `_interleaveTaskTypes` parameter defaulted to `true`, and the function never consulted
// DataStore.settings.interleaveTaskTypes. Running the command from the menu passes no argument, so the
// default always won and the user's setting was silently ignored -- while /ts (sortTasks) honoured it.
// The two commands therefore disagreed about the same setting.

import * as f from '../src/sortTasks'
import { DataStore, Editor, Note, Paragraph, CommandBar } from '@mocks/index'

beforeAll(() => {
  global.DataStore = DataStore
  global.Editor = Editor
  global.Note = Note
  global.Paragraph = Paragraph
  global.CommandBar = CommandBar
  DataStore.settings['_logLevel'] = 'none'
})

/** A note whose heading holds one open and one checklist task, so interleaving is observable. */
function makeNote() {
  return new Note({
    paragraphs: [
      { type: 'title', content: 'Test', rawContent: '# Test', lineIndex: 0, headingLevel: 1, indents: 0 },
      { type: 'title', content: 'Active Tasks', rawContent: '## Active Tasks', lineIndex: 1, headingLevel: 2, indents: 0 },
      { type: 'open', content: 'zzz open task', rawContent: '* zzz open task', lineIndex: 2, heading: 'Active Tasks', indents: 0 },
      { type: 'checklist', content: 'aaa checklist item', rawContent: '+ aaa checklist item', lineIndex: 3, heading: 'Active Tasks', indents: 0 },
    ],
  })
}

/**
 * Run sortTasksUnderHeading and report which write path writeOutTasks took, by watching the
 * interleaved-vs-grouped branch. Interleaved combines open+checklist into one sorted run;
 * grouped keeps each type in its own block.
 */
async function runWith(settingValue: mixed, explicitArg: mixed): Promise<Array<string>> {
  const note = makeNote()
  global.Editor = note
  global.Editor.note = note
  DataStore.settings.interleaveTaskTypes = settingValue
  DataStore.settings.tasksToTop = true
  if (explicitArg === undefined) {
    await f.sortTasksUnderHeading('Active Tasks', ['content'], note)
  } else {
    await f.sortTasksUnderHeading('Active Tasks', ['content'], note, (explicitArg: any))
  }
  return global.Editor.paragraphs.map((p) => p.content)
}

afterEach(() => {
  delete DataStore.settings.interleaveTaskTypes
})

describe('sortTasksUnderHeading() honours the "Combine Related Task Types?" setting', () => {
  test('with no argument, interleaving OFF in settings sorts each type separately', async () => {
    const contents = await runWith(false, undefined)
    // Grouped: the open task and the checklist item stay in separate runs, so the alphabetically
    // earlier checklist item does NOT lead.
    expect(contents).toContain('zzz open task')
    expect(contents).toContain('aaa checklist item')
    const openIdx = contents.indexOf('zzz open task')
    const checklistIdx = contents.indexOf('aaa checklist item')
    expect(openIdx).toBeLessThan(checklistIdx)
  })

  test('with no argument, interleaving ON in settings combines the types', async () => {
    const contents = await runWith(true, undefined)
    const openIdx = contents.indexOf('zzz open task')
    const checklistIdx = contents.indexOf('aaa checklist item')
    // Interleaved and sorted by content: 'aaa...' sorts ahead of 'zzz...' despite being a checklist.
    expect(checklistIdx).toBeLessThan(openIdx)
  })

  test('an explicit argument still overrides the setting (templates / x-callbacks)', async () => {
    const contents = await runWith(true, false) // setting says combine, caller says do not
    const openIdx = contents.indexOf('zzz open task')
    const checklistIdx = contents.indexOf('aaa checklist item')
    expect(openIdx).toBeLessThan(checklistIdx)
  })

  test('an explicit string argument is still coerced (x-callback args arrive as strings)', async () => {
    const contents = await runWith(true, 'false')
    const openIdx = contents.indexOf('zzz open task')
    const checklistIdx = contents.indexOf('aaa checklist item')
    expect(openIdx).toBeLessThan(checklistIdx)
  })

  test('an unset setting falls back to combining, preserving the previous default', async () => {
    const contents = await runWith(undefined, undefined)
    const openIdx = contents.indexOf('zzz open task')
    const checklistIdx = contents.indexOf('aaa checklist item')
    expect(checklistIdx).toBeLessThan(openIdx)
  })
})
