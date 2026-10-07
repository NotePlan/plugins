// @flow
/* global describe, expect, test, beforeAll, beforeEach, jest */
import { processDateOffsets, shiftDates } from '../src/offsets'
import { CommandBar, DataStore, Editor, Note, NotePlan } from '@mocks/index'

beforeAll(() => {
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  DataStore.settings['_logLevel'] = 'none'
})

beforeEach(() => {
  CommandBar.showInput = jest.fn(() => '1d')
})

/**
 * Build a plain paragraph the offset commands can read.
 * @param {number} lineIndex
 * @param {string} rawContent
 * @param {string} type
 * @param {number} headingLevel
 * @returns {Object} paragraph-like object
 */
function para(lineIndex: number, rawContent: string, content: string, type: string = 'text', headingLevel: number = 0): Object {
  return {
    type,
    content,
    rawContent: rawContent,
    lineIndex,
    headingLevel,
    indents: 0,
  }
}

/**
 * Point Editor at a note made of the given paragraphs, with no selection.
 * @param {Array<Object>} paragraphs
 * @returns {Note}
 */
function useNote(paragraphs: Array<Object>): Note {
  const note = new Note()
  note.filename = 'Project.md'
  note.title = 'Project'
  note.type = 'Notes'
  note.paragraphs = paragraphs
  Editor.note = note
  Editor.paragraphs = paragraphs
  Editor.selection = { start: 0, length: 0 }
  Editor.selectedParagraphs = []
  Editor.highlightByIndex = jest.fn()
  return note
}

describe('offsets.js last active line', () => {
  test('processDateOffsets includes the last line when there is no Done or Cancelled section', async () => {
    const note = useNote([
      para(0, '### Prep >2026-10-01', 'title', 3),
      para(1, '* last task {+1d}', 'open'),
    ])

    await processDateOffsets()

    expect(note.paragraphs[1].content).toContain('>2026-10-02')
    expect(note.paragraphs[1].content).not.toContain('{+1d}')
  })

  test('processDateOffsets includes the last content line when the note ends with a blank line', async () => {
    const note = useNote([
      para(0, '### Prep >2026-10-01', 'title', 3),
      para(1, '* last task {+1d}', 'open'),
      para(2, '', 'empty'),
    ])

    await processDateOffsets()

    expect(note.paragraphs[1].content).toContain('>2026-10-02')
    expect(note.paragraphs[2].content).toBe('')
  })

  test('processDateOffsets does not change lines in a Done section', async () => {
    const note = useNote([
      para(0, '### Prep >2026-10-01', 'title', 3),
      para(1, '* before done {+1d}', 'open'),
      para(2, '## Done', 'title', 2),
      para(3, '* archived {+1d}', 'open'),
    ])

    await processDateOffsets()

    expect(note.paragraphs[1].content).toContain('>2026-10-02')
    expect(note.paragraphs[3].content).toBe('* archived {+1d}')
  })

  test('shiftDates includes the last line when nothing is selected', async () => {
    const note = useNote([
      para(0, '* earlier >2026-10-01', 'open'),
      para(1, '* last >2026-10-01', 'open'),
    ])

    await shiftDates()

    expect(note.paragraphs[0].content).toContain('>2026-10-02')
    expect(note.paragraphs[1].content).toContain('>2026-10-02')
  })

  test('shiftDates includes a one-line note when nothing is selected', async () => {
    const note = useNote([para(0, '* only >2026-10-01', 'open')])

    await shiftDates()

    expect(note.paragraphs[0].content).toContain('>2026-10-02')
  })

  test('shiftDates does not change a date under Done', async () => {
    const note = useNote([
      para(0, '* active >2026-10-01', 'open'),
      para(1, '* last active >2026-10-01', 'open'),
      para(2, '## Done', 'title', 2),
      para(3, '* archived >2026-10-01', 'open'),
    ])

    await shiftDates()

    expect(note.paragraphs[0].content).toContain('>2026-10-02')
    expect(note.paragraphs[1].content).toContain('>2026-10-02')
    expect(note.paragraphs[3].content).toBe('* archived >2026-10-01')
  })
})
