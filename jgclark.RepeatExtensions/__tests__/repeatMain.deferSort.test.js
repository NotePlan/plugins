/* global describe, test, expect, jest, beforeEach */

import { DataStore, Editor, CommandBar } from '@mocks/index'

const mockSortTasksUnderHeading = jest.fn()
const mockGetRepeatSettings = jest.fn()
const mockGetOpenEditorFromFilename = jest.fn()
const mockGetCurrentHeading = jest.fn()

jest.mock('../../dwertheimer.TaskSorting/src/sortTasks.js', () => ({
  sortTasksUnderHeading: (...args) => mockSortTasksUnderHeading(...args),
}))

jest.mock('../src/repeatHelpers', () => ({
  getRepeatSettings: (...args) => mockGetRepeatSettings(...args),
  RE_EXTENDED_REPEAT: /@repeat\(/,
}))

jest.mock('@helpers/NPEditorBasics', () => ({
  getOpenEditorFromFilename: (...args) => mockGetOpenEditorFromFilename(...args),
  saveEditorIfNecessary: jest.fn(async () => {}),
}))

jest.mock('@helpers/headings', () => ({
  getCurrentHeading: (...args) => mockGetCurrentHeading(...args),
}))

jest.mock('@helpers/dataManipulation', () => ({
  stringListOrArrayToArray: (s) => s.split(',').map((x) => x.trim()),
}))

jest.mock('@helpers/dev', () => ({
  logDebug: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
  JSP: (e) => String(e),
}))

jest.mock('../plugin.json', () => ({
  'plugin.id': 'jgclark.RepeatExtensions',
}))

describe('repeatMain deferred task sort', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.DataStore = DataStore
    global.Editor = Editor
    global.CommandBar = CommandBar
    CommandBar.onMainThread = jest.fn(async () => {})
    Editor.filename = 'Home Areas/Garden.md'
    Editor.focus = jest.fn()
    DataStore.isPluginInstalledByID = jest.fn(() => true)
    DataStore.updateCache = jest.fn()
    DataStore.invokePluginCommandByName = jest.fn()
    mockGetRepeatSettings.mockResolvedValue({
      runTaskSorter: true,
      taskSortingOrder: 'due,-priority,content',
    })
    mockGetCurrentHeading.mockReturnValue({ content: 'Front', type: 'title' })
  })

  test('getRepeatSectionHeading uses getCurrentHeading when para.heading is empty', () => {
    const { getRepeatSectionHeading } = require('../src/repeatMain')
    const note = { paragraphs: [] }
    const para = { lineIndex: 5, heading: '' }

    expect(getRepeatSectionHeading(note, para)).toBe('Front')
    expect(mockGetCurrentHeading).toHaveBeenCalledWith(note, para)
  })

  test('runTaskSorterAfterRepeats(defer) invokes sort repeats after save command', async () => {
    const { runTaskSorterAfterRepeats } = require('../src/repeatMain')
    const note = { filename: 'Home Areas/Garden.md' }

    await runTaskSorterAfterRepeats(['Front'], note, { runTaskSorter: true }, true)

    expect(DataStore.invokePluginCommandByName).toHaveBeenCalledWith(
      'sort repeats after save',
      'jgclark.RepeatExtensions',
      ['Home Areas/Garden.md', JSON.stringify(['Front'])],
    )
    expect(mockSortTasksUnderHeading).not.toHaveBeenCalled()
  })

  test('runTaskSorterAfterRepeats logs INFO when heading list is empty', async () => {
    const { runTaskSorterAfterRepeats } = require('../src/repeatMain')
    const { logInfo } = require('@helpers/dev')
    const note = { filename: 'Home Areas/Garden.md' }

    await runTaskSorterAfterRepeats([], note, { runTaskSorter: true }, true)

    expect(logInfo).toHaveBeenCalledWith(
      'runTaskSorterAfterRepeats',
      expect.stringContaining('no section heading above it'),
    )
  })

  test('focusEditorForFilename calls focus when global Editor is a different file', () => {
    const { focusEditorForFilename } = require('../src/repeatMain')
    const otherEditor = {
      filename: 'Home Areas/Garden.md',
      focus: jest.fn(() => {
        Editor.filename = 'Home Areas/Garden.md'
      }),
    }
    Editor.filename = 'other.md'
    mockGetOpenEditorFromFilename.mockReturnValue(otherEditor)

    const result = focusEditorForFilename('Home Areas/Garden.md')

    expect(otherEditor.focus).toHaveBeenCalled()
    expect(result).toBe(Editor)
    expect(Editor.filename).toBe('Home Areas/Garden.md')
  })

  test('sortRepeatsAfterSave sorts via global Editor after onMainThread', async () => {
    const { sortRepeatsAfterSave } = require('../src/repeatMain')
    Editor.filename = 'Home Areas/Garden.md'
    mockGetOpenEditorFromFilename.mockReturnValue(Editor)

    await sortRepeatsAfterSave('Home Areas/Garden.md', JSON.stringify(['Front']))

    expect(CommandBar.onMainThread).toHaveBeenCalled()
    expect(mockSortTasksUnderHeading).toHaveBeenCalledWith('Front', ['due', '-priority', 'content'], Editor)
  })
})
