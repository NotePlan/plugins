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
  Editor.save = jest.fn(async () => {})
  Editor.note = { content: '' }
  Editor.content = ''
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

  test('synced block with open Editor: inserts in Editor, not sync source note', async () => {
    const taskLine = '* [x] Task-Test-A @done(2026-05-21 10:00 AM) @repeat(+2w) ^6itdjd'
    const origPara = new Paragraph({
      type: 'done',
      content: taskLine.slice(5),
      lineIndex: 2,
      rawContent: taskLine,
    })
    const origNote = new Note({
      type: 'Notes',
      filename: 'TEST/Repeat TESTs/TEST Repeats.md',
      paragraphs: [
        new Paragraph({ type: 'title', content: 'Tasks', headingLevel: 3, lineIndex: 0 }),
        new Paragraph({ type: 'done', content: 'other', lineIndex: 1 }),
        origPara,
      ],
    })
    origPara.note = origNote
    origNote.resetLineIndexesAndContent()

    const syncCopyPara = new Paragraph({
      type: 'open',
      content: 'Task-Test-A @repeat(+2w) ^6itdjd',
      lineIndex: 5,
      rawContent: '* [ ] Task-Test-A @repeat(+2w) ^6itdjd',
    })
    const syncSourceNote = new Note({
      type: 'Notes',
      filename: 'Home Areas/Garden.md',
      paragraphs: [syncCopyPara],
    })
    syncCopyPara.note = syncSourceNote
    syncSourceNote.insertParagraphBeforeParagraph = jest.fn(async () => {})
    DataStore.referencedBlocks = jest.fn(() => [syncCopyPara])

    global.NotePlan.editors = [Editor]
    Editor.filename = origNote.filename
    Editor.note = { content: 'stale' }
    Editor.content = origNote.content
    Editor.paragraphs = origNote.paragraphs
    Editor.updateParagraph = jest.fn()
    Editor.insertParagraphBeforeParagraph = jest.fn(async () => {})
    Editor.save = jest.fn(async () => {})

    await generateRepeatForPara(origPara, origNote, repeatConfig, true, true)

    expect(Editor.insertParagraphBeforeParagraph).toHaveBeenCalled()
    expect(syncSourceNote.insertParagraphBeforeParagraph).not.toHaveBeenCalled()
    expect(Editor.save).not.toHaveBeenCalled()
  })

  test('synced block without open Editor: inserts in sync source note only', async () => {
    const taskLine = '* [x] Task-Test-A @done(2026-05-21 10:00 AM) @repeat(+2w) ^6itdjd'
    const origPara = new Paragraph({
      type: 'done',
      content: taskLine.slice(5),
      lineIndex: 1,
      rawContent: taskLine,
    })
    const origNote = new Note({
      type: 'Notes',
      filename: 'TEST/Repeat TESTs/TEST Repeats.md',
      paragraphs: [origPara],
    })
    origPara.note = origNote
    origNote.resetLineIndexesAndContent()

    const syncCopyPara = new Paragraph({
      type: 'open',
      content: 'Task-Test-A @repeat(+2w) ^6itdjd',
      lineIndex: 3,
      rawContent: '* [ ] Task-Test-A @repeat(+2w) ^6itdjd',
    })
    const syncSourceNote = new Note({
      type: 'Notes',
      filename: 'Home Areas/Garden.md',
      paragraphs: [syncCopyPara],
    })
    syncCopyPara.note = syncSourceNote
    syncSourceNote.insertParagraphBeforeParagraph = jest.fn(async () => {})
    DataStore.referencedBlocks = jest.fn(() => [syncCopyPara])

    global.NotePlan.editors = []
    Editor.filename = 'other.md'
    Editor.save = jest.fn(async () => {})

    await generateRepeatForPara(origPara, origNote, repeatConfig, true, false)

    expect(syncSourceNote.insertParagraphBeforeParagraph).toHaveBeenCalled()
    expect(Editor.save).not.toHaveBeenCalled()
  })

  test('skipEditorSave: does not call Editor.save (onEditorWillSave trigger path)', async () => {
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

    global.NotePlan.editors = [Editor]
    Editor.filename = origNote.filename
    Editor.note = { content: 'stale saved content' }
    Editor.content = origNote.content
    Editor.paragraphs = origNote.paragraphs
    Editor.updateParagraph = jest.fn()
    Editor.insertParagraphBeforeParagraph = jest.fn(async () => {})
    Editor.save = jest.fn(async () => {})

    await generateRepeatForPara(origPara, origNote, repeatConfig, true, true)
    expect(Editor.save).not.toHaveBeenCalled()
  })
})
