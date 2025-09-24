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
    describe('removeEmptyElements', () => {
      it('should remove empty list items', async () => {
        Editor.note = globalNote
        await f.removeEmptyElements()
        const result = Editor.note.content
        expect(result).not.toMatch(/^\s*\*\s*$/)
      })

      it('should remove empty quotations', async () => {
        Editor.note = globalNote
        await f.removeEmptyElements()
        const result = Editor.note.content
        expect(result).not.toMatch(/^\s*>\s*$/)
      })

      it('should remove empty headings', async () => {
        Editor.note = globalNote
        await f.removeEmptyElements()
        const result = Editor.note.content
        expect(result).not.toMatch(/^\s*#+\s*$/)
      })

      it('should reduce multiple empty lines to a single empty line when stripAllEmptyLines is false', async () => {
        Editor.note = globalNote
        await f.removeEmptyElements('Editor', false)
        const result = Editor.note.content
        expect(result).not.toMatch(/\n\s*\n\s*\n/)
        // Should still have some empty lines (single ones)
        expect(result).toMatch(/\n\s*\n/)
      })

      it('should remove all empty lines when stripAllEmptyLines is true', async () => {
        Editor.note = globalNote
        await f.removeEmptyElements('Editor', true)
        const result = Editor.note.content
        // Should not have any empty lines at all
        expect(result).not.toMatch(/\n\s*\n/)
      })

      it('should handle no note being open', async () => {
        Editor.note = null
        const spy = jest.spyOn(CommandBar, 'showOptions')
        await f.removeEmptyElements()
        expect(spy).toHaveBeenCalledWith(['OK'], 'Please open a note first')
        spy.mockRestore()
      })

      it('should handle empty note', async () => {
        Editor.note = new Note({ paragraphs: [] })
        await f.removeEmptyElements()
        expect(Editor.note.content).toBe('')
      })

      it('should preserve non-empty content', async () => {
        Editor.note = globalNote
        await f.removeEmptyElements()
        const result = Editor.note.content
        expect(result).toMatch(/Normal text line/)
        expect(result).toMatch(/Final text line/)
      })

      it('should handle multiple consecutive empty lines correctly', async () => {
        // Create a note with multiple consecutive empty lines
        const testParagraphs = [
          {
            content: 'Line 1',
            rawContent: 'Line 1',
            type: 'text',
            headingLevel: 0,
            lineIndex: 0,
            indents: 0,
            noteType: 'Notes',
          },
          {
            content: '',
            rawContent: '',
            type: 'empty',
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
            rawContent: '',
            type: 'empty',
            headingLevel: 0,
            lineIndex: 3,
            indents: 0,
            noteType: 'Notes',
          },
          {
            content: 'Line 5',
            rawContent: 'Line 5',
            type: 'text',
            headingLevel: 0,
            lineIndex: 4,
            indents: 0,
            noteType: 'Notes',
          },
        ]
        Editor.note = new Note({ paragraphs: testParagraphs })

        await f.removeEmptyElements('Editor', false)
        const result = Editor.note.content

        // Should have only one empty line between Line 1 and Line 5
        expect(result).toMatch(/Line 1\n\nLine 5/)
        // Should not have more than 2 consecutive newlines
        expect(result).not.toMatch(/\n\n\n/)
      })

      it('should handle empty lines at the beginning and end of note', async () => {
        const testParagraphs = [
          {
            content: '',
            rawContent: '',
            type: 'empty',
            headingLevel: 0,
            lineIndex: 0,
            indents: 0,
            noteType: 'Notes',
          },
          {
            content: '',
            rawContent: '',
            type: 'empty',
            headingLevel: 0,
            lineIndex: 1,
            indents: 0,
            noteType: 'Notes',
          },
          {
            content: 'Content',
            rawContent: 'Content',
            type: 'text',
            headingLevel: 0,
            lineIndex: 2,
            indents: 0,
            noteType: 'Notes',
          },
          {
            content: '',
            rawContent: '',
            type: 'empty',
            headingLevel: 0,
            lineIndex: 3,
            indents: 0,
            noteType: 'Notes',
          },
          {
            content: '',
            rawContent: '',
            type: 'empty',
            headingLevel: 0,
            lineIndex: 4,
            indents: 0,
            noteType: 'Notes',
          },
        ]
        Editor.note = new Note({ paragraphs: testParagraphs })

        await f.removeEmptyElements('Editor', false)
        const result = Editor.note.content

        // Should have one empty line at start and one at end
        expect(result).toMatch(/^\nContent\n$/)
      })

      it('should preserve parent heading if subheading has content', async () => {
        const testParagraphs = [
          {
            content: 'Main Section',
            rawContent: '# Main Section',
            type: 'title',
            headingLevel: 1,
            lineIndex: 0,
            indents: 0,
            noteType: 'Notes',
          },
          {
            content: '',
            rawContent: '',
            type: 'empty',
            headingLevel: 0,
            lineIndex: 1,
            indents: 0,
            noteType: 'Notes',
          },
          {
            content: 'Subsection',
            rawContent: '## Subsection',
            type: 'title',
            headingLevel: 2,
            lineIndex: 2,
            indents: 0,
            noteType: 'Notes',
          },
          {
            content: 'Some content under subsection',
            rawContent: 'Some content under subsection',
            type: 'text',
            headingLevel: 0,
            lineIndex: 3,
            indents: 0,
            noteType: 'Notes',
          },
          {
            content: 'Another Section',
            rawContent: '# Another Section',
            type: 'title',
            headingLevel: 1,
            lineIndex: 4,
            indents: 0,
            noteType: 'Notes',
          },
        ]
        Editor.note = new Note({ paragraphs: testParagraphs })

        await f.removeEmptyElements('Editor', false)
        const result = Editor.note.content

        // Main Section should be preserved because its subheading has content
        expect(result).toMatch(/Main Section/)
        expect(result).toMatch(/Subsection/)
        expect(result).toMatch(/Some content under subsection/)
        // Another Section should be removed because it has no content and no subheadings
        expect(result).not.toMatch(/Another Section/)
      })

      it('should remove parent heading if no subheading has content', async () => {
        const testParagraphs = [
          {
            content: 'Empty Main Section',
            rawContent: '# Empty Main Section',
            type: 'title',
            headingLevel: 1,
            lineIndex: 0,
            indents: 0,
            noteType: 'Notes',
          },
          {
            content: '',
            rawContent: '',
            type: 'empty',
            headingLevel: 0,
            lineIndex: 1,
            indents: 0,
            noteType: 'Notes',
          },
          {
            content: 'Empty Subsection',
            rawContent: '## Empty Subsection',
            type: 'title',
            headingLevel: 2,
            lineIndex: 2,
            indents: 0,
            noteType: 'Notes',
          },
          {
            content: '',
            rawContent: '',
            type: 'empty',
            headingLevel: 0,
            lineIndex: 3,
            indents: 0,
            noteType: 'Notes',
          },
          {
            content: 'Another Section',
            rawContent: '# Another Section',
            type: 'title',
            headingLevel: 1,
            lineIndex: 4,
            indents: 0,
            noteType: 'Notes',
          },
        ]
        Editor.note = new Note({ paragraphs: testParagraphs })

        await f.removeEmptyElements('Editor', false)
        const result = Editor.note.content

        // Empty Main Section and Empty Subsection should be removed
        // Another Section should also be removed because it has no content and no subheadings
        expect(result).not.toMatch(/Empty Main Section/)
        expect(result).not.toMatch(/Empty Subsection/)
        expect(result).not.toMatch(/Another Section/)
      })
    })
  })
})
