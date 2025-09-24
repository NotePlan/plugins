// @flow
/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* global jest, it, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
import * as f from '../src/emptyElements.js'
import { CustomConsole, LogType, LogMessage } from '@jest/console'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, Note, NotePlan, simpleFormatter } from '@mocks/index'
import * as NPParagraph from '@helpers/NPParagraph'

const PLUGIN_NAME = `np.Tidy`
const FILENAME = `emptyBlocks.js`
let globalNote // use this to test with semi-real Note+paragraphs

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'none'
})

beforeEach(() => {
  const paragraphs = [
    {
      content: 'Note Title',
      rawContent: '# Note Title',
      type: 'title',
      headingLevel: 1,
      lineIndex: 0,
      indents: 0,
      noteType: 'Notes',
    },
    {
      content: 'Normal text line',
      rawContent: 'Normal text line',
      type: 'text',
      headingLevel: 0,
      lineIndex: 1,
      indents: 0,
      noteType: 'Notes',
    },
    {
      content: '',
      rawContent: '',
      type: 'empty',
      headingLevel: 0,
      lineIndex: 2,
      indents: 0,
      noteType: 'Notes',
    },
    {
      content: '',
      rawContent: ' ',
      type: 'empty',
      headingLevel: 0,
      lineIndex: 3,
      indents: 1,
      noteType: 'Notes',
    },
    {
      content: 'A list item',
      rawContent: '- A list item',
      type: 'list',
      headingLevel: 0,
      lineIndex: 4,
      indents: 0,
      noteType: 'Notes',
    },
    {
      content: '',
      rawContent: '',
      type: 'list',
      headingLevel: 0,
      lineIndex: 5,
      indents: 0,
      noteType: 'Notes',
    },
    {
      content: '> Empty quote',
      rawContent: '> Empty quote',
      type: 'quote',
      headingLevel: 0,
      lineIndex: 6,
      indents: 0,
      noteType: 'Notes',
    },
    {
      content: '',
      rawContent: '',
      type: 'quote',
      headingLevel: 0,
      lineIndex: 7,
      indents: 0,
      noteType: 'Notes',
    },
    {
      content: '',
      rawContent: '## ',
      type: 'title',
      headingLevel: 2,
      lineIndex: 8,
      indents: 0,
      noteType: 'Notes',
    },
    {
      content: '',
      rawContent: '',
      type: 'title',
      headingLevel: 1,
      lineIndex: 9,
      indents: 0,
      noteType: 'Notes',
    },
    {
      content: 'Final text line',
      rawContent: 'Final text line',
      type: 'text',
      headingLevel: 0,
      lineIndex: 10,
      indents: 0,
      noteType: 'Notes',
    },
  ]
  globalNote = new Note({ paragraphs })
})

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    describe('removeEmptyBlocks', () => {
      it('should remove empty list items', async () => {
        Editor.note = globalNote
        await f.removeEmptyBlocks()
        const result = Editor.note.content
        expect(result).not.toMatch(/^\s*\*\s*$/)
      })

      it('should remove empty quotations', async () => {
        Editor.note = globalNote
        await f.removeEmptyBlocks()
        const result = Editor.note.content
        expect(result).not.toMatch(/^\s*>\s*$/)
      })

      it('should remove empty headings', async () => {
        Editor.note = globalNote
        await f.removeEmptyBlocks()
        const result = Editor.note.content
        expect(result).not.toMatch(/^\s*#+\s*$/)
      })

      it('should reduce multiple empty lines to a single empty line', async () => {
        Editor.note = globalNote
        await f.removeEmptyBlocks()
        const result = Editor.note.content
        expect(result).not.toMatch(/\n\s*\n\s*\n/)
      })

      it('should handle no note being open', async () => {
        Editor.note = null
        const spy = jest.spyOn(CommandBar, 'showOptions')
        await f.removeEmptyBlocks()
        expect(spy).toHaveBeenCalledWith(['OK'], 'Please open a note first')
        spy.mockRestore()
      })

      it('should handle empty note', async () => {
        Editor.note = new Note({ paragraphs: [] })
        await f.removeEmptyBlocks()
        expect(Editor.note.content).toBe('')
      })

      it('should preserve non-empty content', async () => {
        Editor.note = globalNote
        await f.removeEmptyBlocks()
        const result = Editor.note.content
        expect(result).toMatch(/Normal text line/)
        expect(result).toMatch(/Final text line/)
      })
    })
  })
}) 