// @flow
/* global describe, expect, test, beforeAll, beforeEach, jest */
import * as Dev from '@helpers/dev'
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
function para(lineIndex: number, rawContent: string, type: string = 'text', headingLevel: number = 0): Object {
  return {
    type,
    content: rawContent,
    rawContent,
    lineIndex,
    headingLevel,
    indents: 0,
  }
}

/**
 * Point Editor at a note made of the given paragraphs, with no selection.
 * @param {Array<Object>} paragraphs
 * @returns {TNote}
 */
function useNote(paragraphs: Array<Object>): TNote {
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
      para(0, '* base >2026-10-01', 'open'),
      para(1, '* last task {+1d}', 'open'),
    ])

    await processDateOffsets()

    expect(note.paragraphs[1].content).toContain('>2026-10-02')
    expect(note.paragraphs[1].content).not.toContain('{+1d}')
  })

  test('processDateOffsets includes the last content line when the note ends with a blank line', async () => {
    const note = useNote([
      para(0, '* base >2026-10-01', 'open'),
      para(1, '* last task {+1d}', 'open'),
      para(2, '', 'empty'),
    ])

    await processDateOffsets()

    expect(note.paragraphs[1].content).toContain('>2026-10-02')
    expect(note.paragraphs[2].content).toBe('')
  })

  test('processDateOffsets does not change lines in a Done section', async () => {
    const note = useNote([
      para(0, '* base >2026-10-01', 'open'),
      para(1, '* before done {+1d}', 'open'),
      para(2, 'Done', 'title', 2),
      para(3, '* archived {+1d}', 'open'),
    ])

    await processDateOffsets()

    expect(note.paragraphs[1].content).toContain('>2026-10-02')
    expect(note.paragraphs[3].content).toBe('* archived {+1d}')
  })

  test('processDateOffsets does not change a line under Done when Done is the second line', async () => {
    const note = useNote([
      para(0, '* before done >2026-10-01 {+1d}', 'open'),
      para(1, 'Done', 'title', 2),
      para(2, '* archived {+1d}', 'open'),
    ])

    await processDateOffsets()

    expect(note.paragraphs[0].content).toContain('>2026-10-02')
    expect(note.paragraphs[2].content).toBe('* archived {+1d}')
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
      para(2, 'Done', 'title', 2),
      para(3, '* archived >2026-10-01', 'open'),
    ])

    await shiftDates()

    expect(note.paragraphs[0].content).toContain('>2026-10-02')
    expect(note.paragraphs[1].content).toContain('>2026-10-02')
    expect(note.paragraphs[3].content).toBe('* archived >2026-10-01')
  })

  test('shiftDates does not change a date under Done when Done is the second line', async () => {
    const note = useNote([
      para(0, '* active >2026-10-01', 'open'),
      para(1, 'Done', 'title', 2),
      para(2, '* archived >2026-10-01', 'open'),
    ])

    await shiftDates()

    expect(note.paragraphs[0].content).toContain('>2026-10-02')
    expect(note.paragraphs[2].content).toBe('* archived >2026-10-01')
  })

  test('shiftDates does not change archive lines when the note paragraphs include frontmatter', async () => {
    const editorParas = [
      para(0, '* active >2026-10-01', 'open'),
      para(1, 'Done', 'title', 2),
      para(2, '* archived >2026-10-01', 'open'),
    ]
    const note = useNote(editorParas)
    note.paragraphs = [
      para(0, '---', 'separator'),
      para(1, 'title: Project', 'text'),
      para(2, '---', 'separator'),
      para(3, '* active >2026-10-01', 'open'),
      para(4, 'Done', 'title', 2),
      para(5, '* archived >2026-10-01', 'open'),
    ]
    Editor.note = note
    Editor.paragraphs = editorParas

    await shiftDates()

    expect(editorParas[0].content).toContain('>2026-10-02')
    expect(editorParas[2].content).toBe('* archived >2026-10-01')
  })
})

describe('processDateOffsets brace groups on non-open tasks', () => {
  test('calculates offsets on open tasks and removes {...} from closed tasks and checklists', async () => {
    const note = useNote([
      para(0, '* base >2026-10-01', 'open'),
      para(1, '* open {+1d} {note}', 'open'),
      para(2, '* done {+1d} {note}', 'done'),
      para(3, '+ done check {placeholder}', 'checklistDone'),
      para(4, '* cancelled {-1d}', 'cancelled'),
      para(5, '* scheduled {later}', 'scheduled'),
      para(6, '+ scheduled check {later}', 'checklistScheduled'),
      para(7, '+ cancelled check {later}', 'checklistCancelled'),
    ])

    await processDateOffsets()

    expect(note.paragraphs[1].content).toContain('>2026-10-02')
    expect(note.paragraphs[1].content).toContain('{note}')
    expect(note.paragraphs[2].content).toBe('* done {note}')
    expect(note.paragraphs[3].content).toBe('+ done check {placeholder}')
    expect(note.paragraphs[4].content).toBe('* cancelled')
    expect(note.paragraphs[5].content).toBe('* scheduled {later}')
    expect(note.paragraphs[6].content).toBe('+ scheduled check {later}')
    expect(note.paragraphs[7].content).toBe('+ cancelled check {later}')
  })

  test('leaves {placeholder} on a closed task when it is not a date offset', async () => {
    const note = useNote([
      para(0, '* finished {placeholder}', 'done'),
      para(1, 'plain {placeholder}', 'text'),
    ])

    await processDateOffsets()

    expect(note.paragraphs[0].content).toBe('* finished {placeholder}')
    expect(note.paragraphs[1].content).toBe('plain {placeholder}')
  })
})

describe('shiftDates one pass per date', () => {
  test('shifts each day date on a line once when one shifted date matches a later date', async () => {
    const note = useNote([para(0, 'from 2026-01-01 to 2026-01-02 then 2026-01-03', 'text')])

    await shiftDates()

    expect(note.paragraphs[0].content).toBe('from 2026-01-02 to 2026-01-03 then 2026-01-04')
  })

  test('shifts repeated copies of the same day date', async () => {
    const note = useNote([para(0, '2026-01-01 and 2026-01-01', 'text')])

    await shiftDates()

    expect(note.paragraphs[0].content).toBe('2026-01-02 and 2026-01-02')
  })

  test('leaves a week date unchanged when the week calculation fails', async () => {
    const previousCalendar = global.Calendar
    global.Calendar = {
      weekNumber() {
        throw new Error('week api down')
      },
      startOfWeek() {
        return new Date(2026, 2, 2)
      },
      endOfWeek() {
        return new Date(2026, 2, 8)
      },
    }
    CommandBar.showInput = jest.fn(() => '1w')
    const note = useNote([para(0, 'meet >2026-W10 and >2026-W11', 'text')])

    try {
      await shiftDates()
    } finally {
      global.Calendar = previousCalendar
    }

    expect(note.paragraphs[0].content).toBe('meet >2026-W10 and >2026-W11')
  })
})

describe('processDateOffsets failed calculations', () => {
  test('leaves a relative offset in place when there is no previous calculated date', async () => {
    const prompt = jest.spyOn(CommandBar, 'prompt')
    const warn = jest.spyOn(Dev, 'logWarn')
    const note = useNote([
      para(0, '* base >2026-10-01', 'open'),
      para(1, '* relative {^1d}', 'open'),
      para(2, '* absolute {+1d}', 'open'),
    ])
    const warning = "Warning: I couldn't calculate new dates for 1 of 2 offsets found"

    try {
      await processDateOffsets()

      expect(note.paragraphs[1].content).toBe('* relative {^1d}')
      expect(note.paragraphs[1].content).not.toContain('(error)')
      expect(note.paragraphs[2].content).toContain('>2026-10-02')
      expect(prompt).toHaveBeenCalledWith('Process Date Offsets', warning, ['OK'])
      expect(warn).toHaveBeenCalledWith('processDateOffsets', warning)
    } finally {
      prompt.mockRestore()
      warn.mockRestore()
    }
  })

  test('chains a relative offset from the previous calculated date', async () => {
    const prompt = jest.spyOn(CommandBar, 'prompt')
    const note = useNote([
      para(0, '* base >2026-10-01', 'open'),
      para(1, '* first {+1d}', 'open'),
      para(2, '* next {^1d}', 'open'),
    ])

    try {
      await processDateOffsets()

      expect(note.paragraphs[1].content).toContain('>2026-10-02')
      expect(note.paragraphs[2].content).toContain('>2026-10-03')
      expect(note.paragraphs[2].content).not.toContain('(error)')
      const warningCalls = prompt.mock.calls.filter((call) => String(call[1]).includes("couldn't calculate"))
      expect(warningCalls).toHaveLength(0)
    } finally {
      prompt.mockRestore()
    }
  })
})

describe('processDateOffsets computed final date', () => {
  /**
   * Run processDateOffsets with addComputedFinalDate turned on.
   * @param {() => Promise<void>} run
   * @returns {Promise<void>}
   */
  async function withFinalDate(run: () => Promise<void>): Promise<void> {
    const originalLoadJSON = DataStore.loadJSON
    DataStore.loadJSON = jest.fn(async () => ({ addComputedFinalDate: true }))
    try {
      await run()
    } finally {
      DataStore.loadJSON = originalLoadJSON
    }
  }

  test('appends the final date to a heading section that ends at the end of the note', async () => {
    const note = useNote([
      para(0, '### Prep >2026-10-01', 'title', 3),
      para(1, '* task {+1d}', 'open'),
    ])
    await withFinalDate(async () => {
      await processDateOffsets()
      expect(note.paragraphs[0].content).toBe('### Prep >2026-10-01 to 2026-10-02')
      expect(note.paragraphs[1].content).toContain('>2026-10-02')
    })
  })

  test('appends the final date when the section runs up to a Done heading', async () => {
    const note = useNote([
      para(0, '### Prep >2026-10-01', 'title', 3),
      para(1, '* task {+1d}', 'open'),
      para(2, 'Done', 'title', 2),
      para(3, '* archived {+1d}', 'open'),
    ])
    await withFinalDate(async () => {
      await processDateOffsets()
      expect(note.paragraphs[0].content).toBe('### Prep >2026-10-01 to 2026-10-02')
      expect(note.paragraphs[1].content).toContain('>2026-10-02')
      expect(note.paragraphs[3].content).toBe('* archived {+1d}')
    })
  })
})
