// @flow
/* eslint-disable no-unused-vars */
/* global jest, describe, test, expect, beforeAll, beforeEach */
import { CustomConsole } from '@jest/console'
import { Calendar, CommandBar, DataStore, Editor, Note, NotePlan, simpleFormatter } from '@mocks/index'
import { moveParasToNextMonthly, moveParasToNextQuarterly, moveParasToThisMonthly, moveParasToThisQuarterly } from '../src/moveItems'

beforeAll(() => {
  global.Calendar = Calendar
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'none'
  // The shared Calendar mock does not implement this. Only this file needs it.
  Calendar.addUnitToDate = (date: Date, unit: string, num: number) => {
    const shifted = new Date(date.getTime())
    if (unit === 'month') shifted.setMonth(shifted.getMonth() + num)
    if (unit === 'day') shifted.setDate(shifted.getDate() + num)
    return shifted
  }
})

beforeEach(() => {
  const line = {
    lineIndex: 0,
    type: 'text',
    content: 'file this',
    rawContent: 'file this',
    indents: 0,
    headingLevel: 0,
  }
  const note = new Note({
    type: 'Notes',
    filename: 'Projects/Plan.md',
    title: 'Plan',
    content: 'file this',
    paragraphs: [line],
  })
  Editor.note = note
  Editor.content = 'file this'
  Editor.paragraphs = note.paragraphs
  Editor.selectedParagraphs = [line]
  Editor.selection = { start: 0, length: 0 }
  DataStore.loadJSON = jest.fn<$ReadOnlyArray<any>, any>().mockResolvedValue({ whereToAddInSection: 'end' })
  DataStore.calendarNoteByDate = jest.fn<$ReadOnlyArray<any>, any>().mockReturnValue(null)
  CommandBar.prompt = jest.fn<$ReadOnlyArray<any>, number>().mockResolvedValue(0)
})

function periodAskedFor(): string {
  const calls = DataStore.calendarNoteByDate.mock.calls
  expect(calls.length).toBe(1)
  return calls[0][1]
}

function dateAskedFor(): Date {
  return DataStore.calendarNoteByDate.mock.calls[0][0]
}

describe('jgclark.Filer monthly and quarterly quick move', () => {
  test('this month asks for the monthly note of today', async () => {
    const before = new Date()
    await moveParasToThisMonthly()
    const asked = dateAskedFor()
    expect(periodAskedFor()).toBe('month')
    expect(asked.getFullYear()).toBe(before.getFullYear())
    expect(asked.getMonth()).toBe(before.getMonth())
    expect(CommandBar.prompt).toHaveBeenCalledWith('', expect.stringContaining('Monthly note'), ['OK'])
  })

  test('next month asks for the following monthly note', async () => {
    const before = new Date()
    await moveParasToNextMonthly()
    const asked = dateAskedFor()
    const expected = new Date(before.getTime())
    expected.setMonth(expected.getMonth() + 1)
    expect(periodAskedFor()).toBe('month')
    expect(asked.getFullYear()).toBe(expected.getFullYear())
    expect(asked.getMonth()).toBe(expected.getMonth())
  })

  test('this quarter asks for the quarterly note of today', async () => {
    const before = new Date()
    await moveParasToThisQuarterly()
    const asked = dateAskedFor()
    expect(periodAskedFor()).toBe('quarter')
    expect(asked.getFullYear()).toBe(before.getFullYear())
    expect(asked.getMonth()).toBe(before.getMonth())
    expect(CommandBar.prompt).toHaveBeenCalledWith('', expect.stringContaining('Quarterly note'), ['OK'])
  })

  test('next quarter asks for a quarterly note three months ahead', async () => {
    const before = new Date()
    await moveParasToNextQuarterly()
    const asked = dateAskedFor()
    const expected = new Date(before.getTime())
    expected.setMonth(expected.getMonth() + 3)
    expect(periodAskedFor()).toBe('quarter')
    expect(asked.getFullYear()).toBe(expected.getFullYear())
    expect(asked.getMonth()).toBe(expected.getMonth())
  })

  test('an x-callback does not prompt when the monthly note is missing', async () => {
    await moveParasToThisMonthly('')
    expect(DataStore.calendarNoteByDate).toHaveBeenCalled()
    expect(CommandBar.prompt).not.toHaveBeenCalled()
  })
})
