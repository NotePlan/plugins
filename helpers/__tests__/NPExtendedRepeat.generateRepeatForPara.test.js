/* global describe, expect, test, beforeAll, beforeEach, jest */
import moment from 'moment'
import { DataStore, Editor, CommandBar, NotePlan, Note, Paragraph } from '@mocks/index'
import { generateRepeatForPara } from '../NPExtendedRepeat'

const repeatConfig = {
  deleteCompletedRepeat: false,
  dontLookForRepeatsInDoneOrArchive: true,
  allowRepeatsInCancelledParas: false,
  runTaskSorter: false,
  taskSortingOrder: '',
  _logLevel: 'none',
}

beforeAll(() => {
  global.DataStore = DataStore
  global.Editor = Editor
  global.CommandBar = CommandBar
  global.NotePlan = { ...NotePlan, editors: [] }
})

beforeEach(() => {
  DataStore.referencedBlocks = jest.fn(() => [])
  DataStore.calendarNoteByDateString = jest.fn(async () => null)
  Editor.skipNextRepeatDeletionCheck = false
})

describe('NPExtendedRepeat generateRepeatForPara', () => {
  test('new repeat line in a project note must not contain any @done(...) mention', async () => {
    const taskLine = '* [x] Water plants @done(2026-05-03 10:30 AM) @repeat(+1d)'
    const origPara = new Paragraph({
      type: 'done',
      content: taskLine.slice(5),
      lineIndex: 1,
      rawContent: taskLine,
    })
    const origNote = new Note({
      type: 'Notes',
      filename: 'Projects/chores.md',
      paragraphs: [
        new Paragraph({ type: 'title', content: 'Chores', headingLevel: 1, lineIndex: 0 }),
        origPara,
      ],
    })
    origPara.note = origNote
    origNote.resetLineIndexesAndContent()

    const newPara = await generateRepeatForPara(origPara, origNote, repeatConfig, false)
    expect(newPara).not.toBeNull()
    const inserted = origNote.paragraphs[1]
    expect(inserted.content).not.toMatch(/@done\(/)
    expect(inserted.content).toContain('@repeat(+1d)')
    expect(inserted.content).toMatch(/2026-05-04/)
  })

  test('daily calendar note: generated repeat must not copy @done(done-date) onto the next occurrence', async () => {
    const taskLine = '* [x] Take bins out @done(2026-05-03 08:00 AM) @repeat(+1d)'
    const origPara = new Paragraph({
      type: 'done',
      content: taskLine.slice(5),
      lineIndex: 1,
      rawContent: taskLine,
    })
    const origNote = new Note({
      type: 'Calendar',
      filename: '20260503.md',
      date: moment('2026-05-03').toDate(),
      paragraphs: [
        new Paragraph({ type: 'empty', content: '', lineIndex: 0 }),
        origPara,
      ],
    })
    origPara.note = origNote
    origNote.resetLineIndexesAndContent()

    const newPara = await generateRepeatForPara(origPara, origNote, repeatConfig, false)
    expect(newPara).not.toBeNull()
    expect(DataStore.calendarNoteByDateString).toHaveBeenCalled()
    const inserted = origNote.paragraphs[1]
    expect(inserted.content).not.toMatch(/@done\(/)
    expect(origNote.paragraphs.find((p) => p.lineIndex === 2)?.content ?? origPara.content).toContain('@done(2026-05-03)')
  })

  test('shortened @done(date) on completed line is preserved; new line has no done tag', async () => {
    const taskLine = '* [x] Call at 09:45 AM @done(2026-05-03 09:45 AM) @repeat(+1d)'
    const origPara = new Paragraph({
      type: 'done',
      content: taskLine.slice(5),
      lineIndex: 0,
      rawContent: taskLine,
    })
    const origNote = new Note({
      type: 'Notes',
      filename: 'Inbox.md',
      paragraphs: [origPara],
    })
    origPara.note = origNote
    origNote.resetLineIndexesAndContent()

    await generateRepeatForPara(origPara, origNote, repeatConfig, false)
    expect(origPara.content).toContain('at 09:45 AM')
    expect(origPara.content).toContain('@done(2026-05-03)')
    expect(origPara.content).not.toMatch(/@done\(2026-05-03 09:45/)
    const inserted = origNote.paragraphs[0]
    expect(inserted.lineIndex).toBe(0)
    expect(inserted.content).not.toMatch(/@done\(/)
  })
})
