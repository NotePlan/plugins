/* global describe, test, expect, jest, beforeEach */

import { DataStore, Editor, CommandBar } from '@mocks/index'

const mockGenerateRepeatForPara = jest.fn()
const mockSaveEditorIfNecessary = jest.fn(async () => {})
const mockSortTasksUnderHeading = jest.fn()
const mockGetRepeatSettings = jest.fn()
const mockFindEndOfActivePartOfNote = jest.fn()
const mockGetCurrentHeading = jest.fn()

jest.mock('../src/repeatHelpers', () => ({
  getRepeatSettings: (...args) => mockGetRepeatSettings(...args),
  RE_EXTENDED_REPEAT: /@repeat\(/,
}))

jest.mock('../src/repeatPara', () => ({
  generateRepeatForPara: (...args) => mockGenerateRepeatForPara(...args),
  generateRepeatForCancelledPara: jest.fn(),
}))

jest.mock('../../dwertheimer.TaskSorting/src/sortTasks.js', () => ({
  sortTasksUnderHeading: (...args) => mockSortTasksUnderHeading(...args),
}))

jest.mock('@helpers/NPEditorBasics', () => ({
  getOpenEditorFromFilename: jest.fn(() => false),
  saveEditorIfNecessary: (...args) => mockSaveEditorIfNecessary(...args),
}))

jest.mock('@helpers/paragraph', () => ({
  findEndOfActivePartOfNote: (...args) => mockFindEndOfActivePartOfNote(...args),
}))

jest.mock('@helpers/headings', () => ({
  getCurrentHeading: (...args) => mockGetCurrentHeading(...args),
}))

jest.mock('@helpers/dataManipulation', () => ({
  stringListOrArrayToArray: (s) => s.split(',').map((x) => x.trim()),
}))

jest.mock('@helpers/userInput', () => ({
  showMessage: jest.fn(async () => {}),
}))

jest.mock('@helpers/dev', () => ({
  logDebug: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
  clo: jest.fn(),
  JSP: (e) => String(e),
}))

jest.mock('@helpers/NPdev', () => ({
  logAllEnvironmentSettings: jest.fn(),
}))

jest.mock('../plugin.json', () => ({
  'plugin.id': 'jgclark.RepeatExtensions',
}))

/** Four completed @repeat tasks under ### Tasks (last has block ID + @repeat(+2w)). */
function makeTasksSectionParagraphs() {
  const tasksHeading = { type: 'title', content: 'Tasks', headingLevel: 3, lineIndex: 0, heading: '' }
  const doneTasks = [
    '[x] Task-Test-A @done(2026-05-21 10:00 AM) @repeat(+2w) ^6itdjd',
    '[x] Task-Test-B @done(2026-05-21 10:00 AM) @repeat(+1w)',
    '[x] Task-Test-C @done(2026-05-21 10:00 AM) @repeat(+1w)',
    '[x] Task-Test-D @done(2026-05-21 10:00 AM) @repeat(+1w)',
  ]
  return [
    tasksHeading,
    ...doneTasks.map((content, i) => ({
      type: 'done',
      content,
      rawContent: `* ${content}`,
      lineIndex: i + 1,
      heading: 'Tasks',
    })),
  ]
}

describe('generateRepeats batch save (regression)', () => {
  const repeatConfig = {
    dontLookForRepeatsInDoneOrArchive: false,
    runTaskSorter: true,
    taskSortingOrder: 'due,-priority,content',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    global.DataStore = DataStore
    global.Editor = Editor
    global.CommandBar = CommandBar
    Editor.filename = 'Home Areas/Garden.md'
    Editor.note = { content: '' }
    Editor.paragraphs = makeTasksSectionParagraphs()
    DataStore.isPluginInstalledByID = jest.fn(() => true)
    DataStore.updateCache = jest.fn()
    mockGetRepeatSettings.mockResolvedValue(repeatConfig)
    mockFindEndOfActivePartOfNote.mockReturnValue(Editor.paragraphs.length)
    mockGenerateRepeatForPara.mockImplementation(async (origPara) => ({
      content: `${origPara.content.replace(/@done[^@]*/, '').trim()} >2026-06-04`,
    }))
    mockGetCurrentHeading.mockReturnValue({ content: 'Tasks', type: 'title' })
  })

  test('passes skipEditorSave during loop and saves once before task sort', async () => {
    const { generateRepeats } = require('../src/repeatMain')

    const count = await generateRepeats(true)

    expect(count).toBe(4)
    expect(mockGenerateRepeatForPara).toHaveBeenCalledTimes(4)
    for (const call of mockGenerateRepeatForPara.mock.calls) {
      expect(call[3]).toBe(true)
      expect(call[4]).toBe(true)
    }
    expect(mockSaveEditorIfNecessary).toHaveBeenCalledTimes(1)
    expect(mockSortTasksUnderHeading).toHaveBeenCalledWith(
      'Tasks',
      ['due', '-priority', 'content'],
      expect.objectContaining({ filename: 'Home Areas/Garden.md' }),
    )
  })

  test('does not call saveEditorIfNecessary when allowedToUseEditor is false', async () => {
    const { generateRepeats } = require('../src/repeatMain')
    Editor.filename = 'other.md'
    const noteArg = {
      filename: 'Home Areas/Garden.md',
      paragraphs: makeTasksSectionParagraphs(),
    }

    const count = await generateRepeats(true, noteArg, false)

    expect(count).toBe(4)
    for (const call of mockGenerateRepeatForPara.mock.calls) {
      expect(call[3]).toBe(false)
      expect(call[4]).toBe(false)
    }
    expect(mockSaveEditorIfNecessary).not.toHaveBeenCalled()
    expect(mockSortTasksUnderHeading).not.toHaveBeenCalled()
  })
})
