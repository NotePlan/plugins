/* global describe, test, expect, jest, beforeEach */

import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'

global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan
global.Range = {
  create: (start, end) => ({ start, end }),
}

const mockGetRepeatSettings = jest.fn()
const mockGenerateRepeats = jest.fn()
const mockGenerateRepeatForCancelledPara = jest.fn()
const mockMakeBasicParasFromContent = jest.fn()
const mockSelectedLinesIndex = jest.fn()

jest.mock('../src/repeatHelpers', () => ({
  getRepeatSettings: (...args) => mockGetRepeatSettings(...args),
  RE_CANCELLED_TASK: /^\s*[\*\+\-]\s+\[\-\]\s/,
  RE_EXTENDED_REPEAT: /@repeat\(/,
}))

jest.mock('../src/repeatMain', () => ({
  generateRepeats: (...args) => mockGenerateRepeats(...args),
}))

jest.mock('../src/repeatPara', () => ({
  generateRepeatForCancelledPara: (...args) => mockGenerateRepeatForCancelledPara(...args),
}))

jest.mock('@helpers/dateTime', () => ({
  RE_DONE_DATE_TIME: /@done\(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\)/,
}))

jest.mock('@helpers/dev', () => ({
  logDebug: jest.fn(),
  logError: jest.fn(),
}))

jest.mock('@helpers/NPParagraph', () => ({
  makeBasicParasFromContent: (...args) => mockMakeBasicParasFromContent(...args),
  selectedLinesIndex: (...args) => mockSelectedLinesIndex(...args),
}))

describe('repeatTrigger onEditorWillSave', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('generates repeat for newly cancelled extended-repeat task', async () => {
    const { onEditorWillSave } = require('../src/repeatTrigger')

    const previousContent = '- [ ] Task @repeat(1w)'
    const latestContent = '- [-] Task @repeat(1w)'
    const noteReadOnly = {
      versions: [
        {
          content: previousContent,
          date: Date.now() - 5000,
        },
      ],
    }

    Editor.content = latestContent
    Editor.note = noteReadOnly
    Editor.paragraphs = [
      {
        content: 'Task @repeat(1w)',
        rawContent: latestContent,
        lineIndex: 0,
      },
    ]
    NotePlan.stringDiff = jest.fn(() => [{ start: 0, end: latestContent.length }])

    mockGetRepeatSettings.mockResolvedValue({
      allowRepeatsInCancelledParas: true,
    })
    mockSelectedLinesIndex.mockReturnValue([0, 0])
    mockMakeBasicParasFromContent.mockImplementation((content) => {
      if (content === previousContent) {
        return [{ type: 'open', content: 'Task @repeat(1w)', rawContent: previousContent }]
      }
      return [{ type: 'cancelled', content: 'Task @repeat(1w)', rawContent: latestContent }]
    })
    mockGenerateRepeatForCancelledPara.mockResolvedValue({ content: 'Task @repeat(1w) >2026-03-19' })

    await onEditorWillSave()

    expect(mockGenerateRepeatForCancelledPara).toHaveBeenCalledTimes(1)
    expect(mockGenerateRepeatForCancelledPara).toHaveBeenCalledWith(Editor.paragraphs[0], noteReadOnly, true)
    expect(mockGenerateRepeats).not.toHaveBeenCalled()
  })
})
