// @flow
/* eslint-disable no-unused-vars */
/* global jest, describe, test, expect, beforeAll, beforeEach */
import { CustomConsole } from '@jest/console'
import { moveParaBlock } from '../src/moveItems'
import { CommandBar, DataStore, Editor, Note, NotePlan, simpleFormatter } from '@mocks/index'

const LOOSE_MESSAGE = 'Moving the block that starts with the title line will empty the whole note. Do you wish to continue?'
const TIGHT_MESSAGE = 'Moving the block (starting with the title line until the next blank line or H1 heading) will change the title of the note as well. Do you wish to continue?'

beforeAll(() => {
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'none'
})

function openNote(content: string, selectedLine: number) {
  const note = new Note({
    type: 'Notes',
    filename: 'Projects/Plan.md',
    title: 'Plan',
    content,
  })
  const selected = note.paragraphs[selectedLine]
  Editor.note = note
  Editor.content = content
  Editor.paragraphs = note.paragraphs
  Editor.selectedParagraphs = [selected]
  Editor.selection = { start: 0, length: 0 }
  return note
}

function filerSettings(useTightBlockDefinition: boolean) {
  return {
    useTightBlockDefinition,
    includeFromStartOfSection: false,
    whereToAddInSection: 'end',
    allowNotePreambleBeforeHeading: true,
    addDateBacklink: false,
  }
}

beforeEach(() => {
  CommandBar.prompt = jest.fn<$ReadOnlyArray<any>, number>().mockResolvedValue(1)
  CommandBar.showOptions = jest.fn<$ReadOnlyArray<any>, any>().mockResolvedValue({ index: 0 })
  CommandBar.showInput = jest.fn<$ReadOnlyArray<any>, string>().mockResolvedValue('')
  DataStore.projectNotes = []
  DataStore.calendarNotes = []
})

describe('move paragraph block on the note title', () => {
  test('asks before emptying the note, and stops when the answer is No', async () => {
    DataStore.loadJSON = jest.fn<$ReadOnlyArray<any>, any>().mockResolvedValue(filerSettings(false))
    const note = openNote('# Plan\nkeep this line', 0)
    const removeParagraphs = jest.spyOn(note, 'removeParagraphs')
    await moveParaBlock()
    expect(CommandBar.prompt).toHaveBeenCalledWith('Filer: Move block', LOOSE_MESSAGE, ['Yes', 'No'])
    expect(CommandBar.showOptions).not.toHaveBeenCalled()
    expect(removeParagraphs).not.toHaveBeenCalled()
  })

  test('uses the tighter warning when a block stops at a blank line', async () => {
    DataStore.loadJSON = jest.fn<$ReadOnlyArray<any>, any>().mockResolvedValue(filerSettings(true))
    openNote('# Plan\n\nstays behind', 0)
    await moveParaBlock()
    expect(CommandBar.prompt).toHaveBeenCalledWith('Filer: Move block', TIGHT_MESSAGE, ['Yes', 'No'])
    expect(CommandBar.showOptions).not.toHaveBeenCalled()
  })

  test('does not ask when the cursor is below the title', async () => {
    DataStore.loadJSON = jest.fn<$ReadOnlyArray<any>, any>().mockResolvedValue(filerSettings(false))
    openNote('# Plan\nmove this line', 1)
    await moveParaBlock()
    expect(CommandBar.prompt).not.toHaveBeenCalled()
    expect(CommandBar.showOptions).toHaveBeenCalled()
  })
})
