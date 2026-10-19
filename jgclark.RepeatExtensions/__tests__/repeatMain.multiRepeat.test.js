/* global describe, test, expect, jest, beforeEach */

import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'

jest.mock('../../dwertheimer.TaskSorting/src/sortTasks.js', () => ({
  sortTasksUnderHeading: jest.fn(),
}))

const repeatConfig = {
  deleteCompletedRepeat: false,
  dontLookForRepeatsInDoneOrArchive: false,
  allowRepeatsInCancelledParas: false,
  runTaskSorter: false,
  taskSortingOrder: '',
  _logLevel: 'none',
}

/**
 * NotePlan does not recalculate paragraph.lineIndex after an insert.
 * This stand-in does the same, so a top-down walk inserts the second repeat in the wrong place.
 */
function makeNoteWithStaleLineIndexes() {
  const paragraphs = [
    { type: 'title', content: 'Chores', rawContent: '# Chores', lineIndex: 0, heading: '', indents: 0 },
    {
      type: 'done',
      content: 'First @done(2026-05-20 09:00 AM) @repeat(+1d)',
      rawContent: '* [x] First @done(2026-05-20 09:00 AM) @repeat(+1d)',
      lineIndex: 1,
      heading: 'Chores',
      indents: 0,
    },
    {
      type: 'done',
      content: 'Second @done(2026-05-20 09:00 AM) @repeat(+1d)',
      rawContent: '* [x] Second @done(2026-05-20 09:00 AM) @repeat(+1d)',
      lineIndex: 2,
      heading: 'Chores',
      indents: 0,
    },
  ]
  const note = {
    type: 'Notes',
    filename: 'Projects/chores.md',
    paragraphs,
    async insertParagraphBeforeParagraph(content, otherParagraph, type) {
      paragraphs.splice(otherParagraph.lineIndex, 0, {
        type,
        content,
        rawContent: content,
        lineIndex: otherParagraph.lineIndex,
        heading: otherParagraph.heading,
        indents: 0,
      })
    },
    updateParagraph() {},
  }
  paragraphs.forEach((p) => {
    p.note = note
  })
  return note
}

describe('generateRepeats with two completed tasks and stale lineIndex', () => {
  beforeEach(() => {
    global.DataStore = DataStore
    global.Editor = Editor
    global.CommandBar = CommandBar
    global.NotePlan = NotePlan
    DataStore.referencedBlocks = jest.fn(() => [])
    DataStore.loadJSON = jest.fn(async () => repeatConfig)
    DataStore.calendarNoteByDateString = jest.fn(async () => null)
    Editor.filename = null
    Editor.note = null
    Editor.paragraphs = []
    NotePlan.editors = []
  })

  test('inserts each next task immediately before its own completed line', async () => {
    const { generateRepeats } = require('../src/repeatMain')
    const note = makeNoteWithStaleLineIndexes()

    const count = await generateRepeats(true, note, false)

    expect(count).toBe(2)
    const contents = note.paragraphs.map((p) => p.content)
    const newFirst = contents.findIndex((c) => c.includes('First') && c.includes('>'))
    const doneFirst = contents.findIndex((c) => c.includes('First') && c.includes('@done'))
    const newSecond = contents.findIndex((c) => c.includes('Second') && c.includes('>'))
    const doneSecond = contents.findIndex((c) => c.includes('Second') && c.includes('@done'))
    expect(newFirst).toBeGreaterThanOrEqual(0)
    expect(newSecond).toBeGreaterThanOrEqual(0)
    expect(newFirst).toBe(doneFirst - 1)
    expect(newSecond).toBe(doneSecond - 1)
  })
})
