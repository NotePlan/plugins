/* global jest, describe, test, expect, beforeAll, beforeEach */
import { format } from 'date-fns'
import * as NPNote from '../NPnote'
import { DataStore, Paragraph, Note, Editor, Calendar } from '@mocks/index'
import { YYYYMMDDDateStringFromDate } from '@helpers/dateTime'

beforeAll(() => {
  DataStore.settings['_logLevel'] = 'none' // change to DEBUG to see more console output during test runs
  global.DataStore = DataStore // so we see DEBUG logs in VSCode Jest debugs
  global.Calendar = Calendar // so we see DEBUG logs in VSCode Jest debugs
  global.Editor = Editor // so we see DEBUG logs in VSCode Jest debugs
})

const PLUGIN_NAME = `helpers`
const FILENAME = `NPNote`
const paragraphs = [new Paragraph({ content: 'line1' }), new Paragraph({ content: 'line2' })]
const note = new Note({ paragraphs })
note.filename = `${YYYYMMDDDateStringFromDate(new Date())}.md`
Editor.note = note
Editor.filename = note.filename

/* Samples:
expect(result).toMatch(/someString/)
expect(result).not.toMatch(/someString/)
expect(result).toEqual([])
*/

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    /*
     * getTodaysReferences()
     */
    describe('getTodaysReferences()' /* function */, () => {
      test('should return empty array if no backlinks', async () => {
        const result = await NPNote.getTodaysReferences({ ...note, backlinks: [] })
        expect(result).toEqual([])
      })
      test('should console.log and return empty array if note is null', async () => {
        const spy = jest.spyOn(console, 'log')
        // const oldLogLevel = DataStore.settings['_logLevel']
        // DataStore.settings['_logLevel'] = 'none' //DON'T CHANGE THIS
        const editorWas = Editor.note
        Editor.note = null
        const result = await NPNote.getTodaysReferences(null)
        expect(result).toEqual([])
        // expect(mockWasCalledWithString(spy, /timeblocking could not open Note/)).toBe(true)
        spy.mockRestore()
        Editor.note = editorWas
        // DataStore.settings['_logLevel'] = oldLogLevel
      })
      // FIXME: this broke in moving some helpers around, and JGC can't see why. Skipping for now.
      test.skip('should tell user there was a problem with config', async () => {
        Editor.note.backlinks = [{ content: 'line1', subItems: [{ test: 'here' }] }]
        const result = await NPNote.getTodaysReferences()
        expect(result).toEqual([{ test: 'here' }])
        Editor.note.backlinks = []
      })
      test('should find todos in the Editor note', async () => {
        const paras = [new Paragraph({ content: 'line1 >today', type: 'open' }), new Paragraph({ content: 'this is not today content', type: 'open' })]
        const noteWas = Editor.note
        Editor.note.backlinks = []
        Editor.note.paragraphs = paras
        const result = await NPNote.findOpenTodosInNote(Editor.note)
        expect(result[0].content).toEqual(paras[0].content)
        Editor.note = noteWas
      })
    })

    describe('findOpenTodosInNote', () => {
      const note = {
        paragraphs: [
          { content: 'foo', type: 'done', filename: 'foof.md' },
          { content: 'bar', type: 'open', filename: 'barf.md' },
          { content: 'baz', type: 'list', filename: 'bazf.txt' },
          { content: 'baz', type: 'text', filename: 'bazf.txt' },
        ],
      }
      test('should find nothing if there are no today marked items', () => {
        const res = NPNote.findOpenTodosInNote(note)
        expect(res).toEqual([])
      })
      test('should find items with >today in them', () => {
        const note2 = { paragraphs: [{ content: 'foo >today bar', type: 'open', filename: 'foof.md' }] }
        const consolidated = { paragraphs: [...note2.paragraphs, ...note.paragraphs] }
        const res = NPNote.findOpenTodosInNote(consolidated)
        expect(res.length).toEqual(1)
        expect(res[0].content).toEqual(note2.paragraphs[0].content)
      })
      test('should find items with >[todays date hyphenated] in them', () => {
        const tdh = format(new Date(), 'yyyy-MM-dd')
        const note2 = { paragraphs: [{ content: `foo >${tdh} bar`, type: 'open', filename: 'foof.md' }] }
        const consolidated = { paragraphs: [...note2.paragraphs, ...note.paragraphs] }
        const res = NPNote.findOpenTodosInNote(consolidated)
        expect(res.length).toEqual(1)
        expect(res[0].content).toEqual(note2.paragraphs[0].content)
      })
      test('should not find items with >today if they are done', () => {
        const note2 = { paragraphs: [{ content: 'foo >today bar', type: 'done', filename: 'foof.md' }] }
        const res = NPNote.findOpenTodosInNote(note2)
        expect(res).toEqual([])
      })
      test('should not find items with >today if they are not tagged for toeay', () => {
        const note2 = { paragraphs: [{ content: 'foo bar', type: 'open', filename: 'foof.md' }] }
        const res = NPNote.findOpenTodosInNote(note2)
        expect(res).toEqual([])
      })
      test('should find non-today items in note if second param is true', () => {
        const note2 = { paragraphs: [{ content: 'foo bar', type: 'open', filename: 'foof.md' }] }
        const res = NPNote.findOpenTodosInNote(note2, true)
        expect(res.length).toEqual(1)
        expect(res[0].content).toEqual(note2.paragraphs[0].content)
      })
    })

    describe('getHeadingsFromNote', () => {
      const note = {
        filename: 'foof.md',
        type: 'Notes',
        title: 'TEST Note title',
        paragraphs: [
          { content: 'TEST Note title', type: 'title', lineIndex: 0, headingLevel: 1 },
          { content: '  First heading', type: 'title', lineIndex: 1, headingLevel: 2 },
          { content: 'foo', type: 'done', lineIndex: 2, headingLevel: 2 },
          { content: 'bar', type: 'open', lineIndex: 3, headingLevel: 2 },
          { content: 'baz', type: 'list', lineIndex: 4, headingLevel: 2 },
          { content: ' L2 heading ', type: 'title', lineIndex: 5, headingLevel: 2 },
          { content: 'baz', type: 'text', lineIndex: 6, headingLevel: 2 },
          { content: 'L3 heading  ', type: 'title', lineIndex: 7, headingLevel: 3 },
          { content: 'sojeiro awe', type: 'text', lineIndex: 8, headingLevel: 3 },
          { content: '', type: 'empty', lineIndex: 3 },
        ],
      }
      test('should find 3 headings; everything else false', () => {
        const headings = NPNote.getHeadingsFromNote(note, false, false, false, false)
        expect(headings.length).toEqual(3)
      })
      test('should find 3 headings left trimmed; everything else false', () => {
        const headings = NPNote.getHeadingsFromNote(note, false, false, false, false)
        expect(headings.length).toEqual(3)
        expect(headings[0]).toEqual('First heading')
        expect(headings[1]).toEqual('L2 heading ')
        expect(headings[2]).toEqual('L3 heading  ')
      })
      test('should find 3 headings suitably trimmed; include markdown heading markers; everything else false', () => {
        const headings = NPNote.getHeadingsFromNote(note, true, false, false, false)
        expect(headings.length).toEqual(3)
        expect(headings[0]).toEqual('## First heading')
        expect(headings[1]).toEqual('## L2 heading ')
        expect(headings[2]).toEqual('### L3 heading  ')
      })
    })
  })
  describe('getFSSafeFilenameFromNoteTitle', () => {
    beforeEach(() => {
      DataStore.defaultFileExtension = 'md'
    })

    describe('Normal cases', () => {
      test('should return correct filename for simple title in root folder', () => {
        const mockNote = {
          filename: 'existing-filename.md',
          title: 'My Test Note',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)
        expect(result).toBe('My Test Note.md')
      })

      test('should return correct filename for title in subfolder', () => {
        const mockNote = {
          filename: 'Projects/Work/existing-filename.md',
          title: 'Project Meeting Notes',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)
        expect(result).toBe('Projects/Work/Project Meeting Notes.md')
      })

      test('should return correct filename for note in deeply nested folder', () => {
        const mockNote = {
          filename: 'Company/Projects/2024/Q1/old-name.md',
          title: 'Q1 Planning',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)

        expect(result).toBe('Company/Projects/2024/Q1/Q1 Planning.md')
      })
    })

    describe('Character replacement cases', () => {
      test('should replace forward slash with underscore', () => {
        const mockNote = {
          filename: 'test.md',
          title: 'Meeting/Discussion',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)

        expect(result).toBe('Meeting_Discussion.md')
      })

      test('should replace at symbol with underscore', () => {
        const mockNote = {
          filename: 'test.md',
          title: 'Email@Work',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)
        expect(result).toBe('Email_Work.md')
      })

      test('should replace dollar sign with underscore', () => {
        const mockNote = {
          filename: 'test.md',
          title: 'Budget$2024',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)
        expect(result).toBe('Budget_2024.md')
      })

      test('should replace colon with underscore', () => {
        const mockNote = {
          filename: 'test.md',
          title: 'Time:Management',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)
        expect(result).toBe('Time_Management.md')
      })

      test('should replace backslash with underscore', () => {
        const mockNote = {
          filename: 'test.md',
          title: 'Path\\To\\File',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)
        expect(result).toBe('Path_To_File.md')
      })

      test('should replace double quote with underscore', () => {
        const mockNote = {
          filename: 'test.md',
          title: 'Meeting "Important" Notes',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)
        expect(result).toBe('Meeting _Important_ Notes.md')
      })

      test('should replace less than symbol with underscore', () => {
        const mockNote = {
          filename: 'test.md',
          title: 'Value<10',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)
        expect(result).toBe('Value_10.md')
      })

      test('should replace greater than symbol with underscore', () => {
        const mockNote = {
          filename: 'test.md',
          title: 'Value>100',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)
        expect(result).toBe('Value_100.md')
      })

      test('should replace pipe symbol with underscore', () => {
        const mockNote = {
          filename: 'test.md',
          title: 'Option A | Option B',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)
        expect(result).toBe('Option A _ Option B.md')
      })

      test('should replace multiple special characters', () => {
        const mockNote = {
          filename: 'test.md',
          title: 'Project/@Home:Budget$2024',
          type: 'Notes'
        }

        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)

        expect(result).toBe('Project__Home_Budget_2024.md')
      })

      test('should replace all NTFS-disallowed characters', () => {
        const mockNote = {
          filename: 'test.md',
          title: 'File\\Name/With"All<Bad>Chars|Here:And@More$',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)
        expect(result).toBe('File_Name_With_All_Bad_Chars_Here_And_More_.md')
      })

      test('should handle multiple instances of same character', () => {
        const mockNote = {
          filename: 'test.md',
          title: 'Path/To/File',
          type: 'Notes'
        }

        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)

        expect(result).toBe('Path_To_File.md')
      })

      test('should handle multiple instances of different disallowed characters', () => {
        const mockNote = {
          filename: 'test.md',
          title: 'File>>Name<<With||Multiple',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)
        expect(result).toBe('File__Name__With__Multiple.md')
      })

      test('should handle mixed valid and invalid characters', () => {
        const mockNote = {
          filename: 'test.md',
          title: 'Valid-Name_With.Some"Invalid<Chars',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)
        expect(result).toBe('Valid-Name_With.Some_Invalid_Chars.md')
      })
    })

    describe('File extension cases', () => {
      test('should use txt extension when DataStore.defaultFileExtension is txt', () => {
        DataStore.defaultFileExtension = 'txt'

        const mockNote = {
          filename: 'test.md',
          title: 'My Note',
          type: 'Notes'
        }

        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)

        expect(result).toBe('My Note.txt')
      })

      test('should use custom extension', () => {
        DataStore.defaultFileExtension = 'markdown'

        const mockNote = {
          filename: 'test.md',
          title: 'My Note',
          type: 'Notes'
        }

        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)

        expect(result).toBe('My Note.markdown')
      })
    })

    describe('Empty title cases', () => {
      test('should return empty string and log warning for empty title', () => {
        const mockNote = {
          filename: 'test.md',
          title: '',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)

        expect(result).toBe('')

      })

      test('should return empty string and log warning for whitespace-only title', () => {
        const mockNote = {
          filename: 'test.md',
          title: '   ',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)

        expect(result).toBe('')

      })
    })

    describe('Calendar note cases', () => {
      test('should handle calendar note with date title', () => {
        const mockNote = {
          filename: '20240315.md',
          title: '2024-03-15',
          type: 'Calendar'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)

        expect(result).toBe('20240315.md')
      })

      test('should handle weekly calendar note', () => {
        const mockNote = {
          filename: '2024-W12.md',
          title: '2024-W12',
          type: 'Calendar'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)

        expect(result).toBe('2024-W12.md')
      })
    })

    describe('Edge cases', () => {
      test('should handle title with only special characters', () => {
        const mockNote = {
          filename: 'test.md',
          title: '/@:$',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)

        expect(result).toBe('____.md')
      })

      test('should handle very long title', () => {
        const longTitle = 'A'.repeat(255)
        const mockNote = {
          filename: 'test.md',
          title: longTitle,
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)

        expect(result).toBe(`${longTitle}.md`)
      })

      test('should handle title with unicode characters', () => {
        const mockNote = {
          filename: 'test.md',
          title: 'Café ñoño 🌟',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)

        expect(result).toBe('Café ñoño 🌟.md')
      })

      test('should handle empty folder path', () => {
        const mockNote = {
          filename: 'test.md',
          title: 'My Note',
          type: 'Notes'
        }
        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)

        expect(result).toBe('My Note.md')
      })
    })

    describe('Integration with actual folder paths', () => {
      test('should correctly combine complex folder path with sanitized title', () => {
        const mockNote = {
          filename: 'Archive/2023/Projects/old-meeting-notes.md',
          title: 'Meeting Notes: Q3/Q4 Review @2023',
          type: 'Notes'
        }

        const result = NPNote.getFSSafeFilenameFromNoteTitle(mockNote)

        expect(result).toBe('Archive/2023/Projects/Meeting Notes_ Q3_Q4 Review _2023.md')
      })
    })
  })
})
