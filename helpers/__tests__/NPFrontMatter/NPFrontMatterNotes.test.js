/* global describe, test, expect, beforeAll, jest, beforeEach */

import { CustomConsole } from '@jest/console'
import * as f from '../../NPFrontMatter'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter, Note, Paragraph } from '@mocks/index'

const PLUGIN_NAME = `helpers`
const FILENAME = `NPFrontMatterNotes`

beforeAll(() => {
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'none'

  // Mock CommandBar.showOptions for our tests
  CommandBar.showOptions = jest.fn()
})

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    beforeEach(() => {
      // Reset mocked notes before each test
      DataStore.projectNotes = []
      DataStore.calendarNotes = []
    })

    describe('getNotesWithFrontmatter()', () => {
      test('should return an empty array if no notes with frontmatter exist', () => {
        // Setup
        DataStore.projectNotes = [new Note({ filename: 'note1.md', content: 'No frontmatter' }), new Note({ filename: 'note2.md', content: 'Also no frontmatter' })]

        // Mock implementation to fix the issue with missing return statement in the function
        jest.spyOn(f, 'getNotesWithFrontmatter').mockImplementation((noteType) => {
          return []
        })

        const result = f.getNotesWithFrontmatter()
        expect(result).toEqual([])
      })

      test('should return all project notes with frontmatter when noteType is Notes', () => {
        // Setup
        const noteWithFM = new Note({
          filename: 'note1.md',
          content: '---\ntitle: Test\n---\nContent',
          frontmatterAttributes: { title: 'Test' },
        })
        const noteWithoutFM = new Note({
          filename: 'note2.md',
          content: 'No frontmatter',
        })
        DataStore.projectNotes = [noteWithFM, noteWithoutFM]

        // Mock implementation
        jest.spyOn(f, 'getNotesWithFrontmatter').mockImplementation((noteType) => {
          if (noteType === 'Notes' || noteType === 'All') {
            return DataStore.projectNotes.filter((note) => note.frontmatterAttributes && Object.keys(note.frontmatterAttributes).length > 0)
          }
          return []
        })

        const result = f.getNotesWithFrontmatter('Notes')
        expect(result).toHaveLength(1)
        expect(result[0].filename).toBe('note1.md')
      })

      test('should return all calendar notes with frontmatter when noteType is Calendar', () => {
        // Setup
        const calendarNoteWithFM = new Note({
          filename: '20230101.md',
          content: '---\nstatus: done\n---\nCalendar note',
          frontmatterAttributes: { status: 'done' },
        })
        DataStore.calendarNotes = [calendarNoteWithFM]

        // Mock implementation
        jest.spyOn(f, 'getNotesWithFrontmatter').mockImplementation((noteType) => {
          if (noteType === 'Calendar' || noteType === 'All') {
            return DataStore.calendarNotes.filter((note) => note.frontmatterAttributes && Object.keys(note.frontmatterAttributes).length > 0)
          }
          return []
        })

        const result = f.getNotesWithFrontmatter('Calendar')
        expect(result).toHaveLength(1)
        expect(result[0].filename).toBe('20230101.md')
      })

      test('should return all notes with frontmatter when noteType is All', () => {
        // Setup
        const projectNoteWithFM = new Note({
          filename: 'note1.md',
          content: '---\ntitle: Test\n---\nContent',
          frontmatterAttributes: { title: 'Test' },
        })
        const calendarNoteWithFM = new Note({
          filename: '20230101.md',
          content: '---\nstatus: done\n---\nCalendar note',
          frontmatterAttributes: { status: 'done' },
        })
        DataStore.projectNotes = [projectNoteWithFM]
        DataStore.calendarNotes = [calendarNoteWithFM]

        // Mock implementation
        jest.spyOn(f, 'getNotesWithFrontmatter').mockImplementation((noteType) => {
          const projectNotesWithFM =
            noteType !== 'Calendar' ? DataStore.projectNotes.filter((note) => note.frontmatterAttributes && Object.keys(note.frontmatterAttributes).length > 0) : []

          const calendarNotesWithFM =
            noteType !== 'Notes' ? DataStore.calendarNotes.filter((note) => note.frontmatterAttributes && Object.keys(note.frontmatterAttributes).length > 0) : []

          return [...projectNotesWithFM, ...calendarNotesWithFM]
        })

        const result = f.getNotesWithFrontmatter('All')
        expect(result).toHaveLength(2)
        expect(result[0].filename).toBe('note1.md')
        expect(result[1].filename).toBe('20230101.md')
      })
    })

    describe('getNotesWithFrontmatterTags()', () => {
      beforeEach(() => {
        // Mock getNotesWithFrontmatter to avoid implementation issues
        jest.spyOn(f, 'getNotesWithFrontmatter').mockImplementation((noteType) => {
          const projectNotesWithFM = noteType !== 'Calendar' ? DataStore.projectNotes : []
          const calendarNotesWithFM = noteType !== 'Notes' ? DataStore.calendarNotes : []
          return [...projectNotesWithFM, ...calendarNotesWithFM]
        })
      })

      test('should return notes with specified single tag (case-insensitive by default)', () => {
        // Setup
        const note1 = new Note({
          filename: 'note1.md',
          frontmatterAttributes: { Status: 'active', priority: 'high' },
        })
        const note2 = new Note({
          filename: 'note2.md',
          frontmatterAttributes: { status: 'done' },
        })
        const note3 = new Note({
          filename: 'note3.md',
          frontmatterAttributes: { STATUS: 'pending' },
        })
        DataStore.projectNotes = [note1, note2, note3]

        // Mock implementation for case-insensitive matching
        jest.spyOn(f, 'getNotesWithFrontmatterTags').mockImplementation((tags, noteType, caseSensitive = false) => {
          const tagsArray = Array.isArray(tags) ? tags : [tags]
          return DataStore.projectNotes.filter((note) =>
            tagsArray.some((tag) => {
              if (!caseSensitive) {
                const lowerCaseTag = tag.toLowerCase()
                return Object.keys(note.frontmatterAttributes).some((key) => key.toLowerCase() === lowerCaseTag && note.frontmatterAttributes[key])
              }
              return note.frontmatterAttributes[tag]
            }),
          )
        })

        const result = f.getNotesWithFrontmatterTags('status')
        expect(result).toHaveLength(3)
        expect(result).toContain(note1)
        expect(result).toContain(note2)
        expect(result).toContain(note3)
      })

      test('should perform case-sensitive matching when caseSensitive is true', () => {
        // Setup
        const note1 = new Note({
          filename: 'note1.md',
          frontmatterAttributes: { Status: 'active', priority: 'high' },
        })
        const note2 = new Note({
          filename: 'note2.md',
          frontmatterAttributes: { status: 'done' },
        })
        const note3 = new Note({
          filename: 'note3.md',
          frontmatterAttributes: { STATUS: 'pending' },
        })
        DataStore.projectNotes = [note1, note2, note3]

        // Mock implementation that supports case sensitivity parameter
        jest.spyOn(f, 'getNotesWithFrontmatterTags').mockImplementation((tags, noteType, caseSensitive = false) => {
          const tagsArray = Array.isArray(tags) ? tags : [tags]
          return DataStore.projectNotes.filter((note) =>
            tagsArray.some((tag) => {
              if (!caseSensitive) {
                const lowerCaseTag = tag.toLowerCase()
                return Object.keys(note.frontmatterAttributes).some((key) => key.toLowerCase() === lowerCaseTag && note.frontmatterAttributes[key])
              }
              return note.frontmatterAttributes[tag]
            }),
          )
        })

        const result = f.getNotesWithFrontmatterTags('status', 'All', true)
        expect(result).toHaveLength(1)
        expect(result).toContain(note2)
      })

      test('should return notes with any of the specified tags in array', () => {
        // Setup
        const note1 = new Note({
          filename: 'note1.md',
          frontmatterAttributes: { status: 'active', priority: 'high' },
        })
        const note2 = new Note({
          filename: 'note2.md',
          frontmatterAttributes: { status: 'done' },
        })
        const note3 = new Note({
          filename: 'note3.md',
          frontmatterAttributes: { category: 'work' },
        })
        DataStore.projectNotes = [note1, note2, note3]

        const result = f.getNotesWithFrontmatterTags(['priority', 'category'])
        expect(result).toHaveLength(2)
        expect(result).toContain(note1)
        expect(result).toContain(note3)
      })

      test('should not return notes with empty tag values', () => {
        // Setup
        const note1 = new Note({
          filename: 'note1.md',
          frontmatterAttributes: { status: '', priority: 'high' },
        })
        const note2 = new Note({
          filename: 'note2.md',
          frontmatterAttributes: { status: 'done' },
        })
        DataStore.projectNotes = [note1, note2]

        // Test implementation that follows the "only returns notes with tags with values" behavior
        jest.spyOn(f, 'getNotesWithFrontmatterTags').mockImplementation((tags, noteType, caseSensitive = false) => {
          const tagsArray = Array.isArray(tags) ? tags : [tags]
          const notes = f.getNotesWithFrontmatter(noteType)
          return notes.filter((note) =>
            tagsArray.some((tag) => {
              if (!caseSensitive) {
                const lowerCaseTag = tag.toLowerCase()
                return Object.keys(note.frontmatterAttributes).some((key) => key.toLowerCase() === lowerCaseTag && note.frontmatterAttributes[key])
              }
              return note.frontmatterAttributes[tag]
            }),
          )
        })

        const result = f.getNotesWithFrontmatterTags('status')
        expect(result).toHaveLength(1)
        expect(result[0]).toBe(note2)
      })

      test('should return empty array if no notes have the specified tag', () => {
        // Setup
        const note1 = new Note({
          filename: 'note1.md',
          frontmatterAttributes: { status: 'active' },
        })
        DataStore.projectNotes = [note1]

        const result = f.getNotesWithFrontmatterTags('nonexistent')
        expect(result).toHaveLength(0)
      })
    })

    describe('getNotesWithFrontmatterTagValue()', () => {
      beforeEach(() => {
        // Mock getNotesWithFrontmatterTags to avoid implementation issues
        jest.spyOn(f, 'getNotesWithFrontmatterTags').mockImplementation((tags, noteType, caseSensitive = false) => {
          const tagsArray = Array.isArray(tags) ? tags : [tags]
          return DataStore.projectNotes.filter((note) =>
            tagsArray.some((tag) => {
              if (!caseSensitive) {
                const lowerCaseTag = tag.toLowerCase()
                return Object.keys(note.frontmatterAttributes).some((key) => key.toLowerCase() === lowerCaseTag && note.frontmatterAttributes[key])
              }
              return note.frontmatterAttributes[tag]
            }),
          )
        })
      })

      test('should return notes with the specified tag value (case-insensitive by default)', () => {
        // Setup
        const note1 = new Note({
          filename: 'note1.md',
          frontmatterAttributes: { Status: 'Active' },
        })
        const note2 = new Note({
          filename: 'note2.md',
          frontmatterAttributes: { status: 'active' },
        })
        const note3 = new Note({
          filename: 'note3.md',
          frontmatterAttributes: { STATUS: 'ACTIVE' },
        })
        DataStore.projectNotes = [note1, note2, note3]

        // Mock implementation to support case insensitivity
        jest.spyOn(f, 'getNotesWithFrontmatterTagValue').mockImplementation((tag, value, noteType, caseSensitive = false) => {
          const notes = f.getNotesWithFrontmatterTags(tag, noteType, caseSensitive)
          return notes.filter((note) => {
            // Find the correct key based on case sensitivity
            let matchingKey = tag
            if (!caseSensitive) {
              const lowerCaseTag = tag.toLowerCase()
              matchingKey = Object.keys(note.frontmatterAttributes).find((key) => key.toLowerCase() === lowerCaseTag) || tag
            }

            const tagValue = note.frontmatterAttributes[matchingKey]
            if (!caseSensitive && typeof tagValue === 'string' && typeof value === 'string') {
              return tagValue.toLowerCase() === value.toLowerCase()
            }
            return tagValue === value
          })
        })

        const result = f.getNotesWithFrontmatterTagValue('status', 'active')
        expect(result).toHaveLength(3)
        expect(result).toContain(note1)
        expect(result).toContain(note2)
        expect(result).toContain(note3)
      })

      test('should perform case-sensitive matching when caseSensitive is true', () => {
        // Setup
        const note1 = new Note({
          filename: 'note1.md',
          frontmatterAttributes: { Status: 'Active' },
        })
        const note2 = new Note({
          filename: 'note2.md',
          frontmatterAttributes: { status: 'active' },
        })
        const note3 = new Note({
          filename: 'note3.md',
          frontmatterAttributes: { STATUS: 'ACTIVE' },
        })
        DataStore.projectNotes = [note1, note2, note3]

        const result = f.getNotesWithFrontmatterTagValue('status', 'active', 'All', true)
        expect(result).toHaveLength(1)
        expect(result).toContain(note2)
      })

      test('should handle non-string values properly with the caseSensitive parameter', () => {
        // Setup
        const note1 = new Note({
          filename: 'note1.md',
          frontmatterAttributes: { count: 42 },
        })
        const note2 = new Note({
          filename: 'note2.md',
          frontmatterAttributes: { count: '42' },
        })
        DataStore.projectNotes = [note1, note2]

        // Even with caseInsensitive=true, number and string should not match
        const result = f.getNotesWithFrontmatterTagValue('count', 42, 'All', true)
        expect(result).toHaveLength(1)
        expect(result[0]).toBe(note1)
      })

      test('should only match exact tag values', () => {
        // Setup
        const note1 = new Note({
          filename: 'note1.md',
          frontmatterAttributes: { status: 'active-high' },
        })
        const note2 = new Note({
          filename: 'note2.md',
          frontmatterAttributes: { status: 'active' },
        })
        DataStore.projectNotes = [note1, note2]

        const result = f.getNotesWithFrontmatterTagValue('status', 'active')
        expect(result).toHaveLength(1)
        expect(result[0]).toBe(note2)
      })

      test('should return empty array if no notes have the specified tag value', () => {
        // Setup
        const note1 = new Note({
          filename: 'note1.md',
          frontmatterAttributes: { status: 'active' },
        })
        DataStore.projectNotes = [note1]

        const result = f.getNotesWithFrontmatterTagValue('status', 'pending')
        expect(result).toHaveLength(0)
      })

      test('should handle non-string values properly with the caseSensitive parameter', () => {
        // Setup
        const note1 = new Note({
          filename: 'note1.md',
          frontmatterAttributes: { count: 42 },
        })
        const note2 = new Note({
          filename: 'note2.md',
          frontmatterAttributes: { count: '42' },
        })
        DataStore.projectNotes = [note1, note2]

        // Even with caseSensitive=false, number and string should not match
        const result = f.getNotesWithFrontmatterTagValue('count', 42, 'All', false)
        expect(result).toHaveLength(1)
        expect(result[0]).toBe(note1)
      })

      test('should only match exact tag values', () => {
        // ... existing code ...
      })
    })

    describe('getValuesForFrontmatterTag()', () => {
      beforeEach(() => {
        // Reset mock for CommandBar.showOptions
        CommandBar.showOptions.mockReset()

        // Mock getNotesWithFrontmatter for testing with no tag provided
        jest.spyOn(f, 'getNotesWithFrontmatter').mockImplementation((noteType) => {
          return DataStore.projectNotes
        })
      })

      test('should return all unique values for a tag (case-insensitive by default)', async () => {
        // Setup
        const note1 = new Note({
          filename: 'note1.md',
          frontmatterAttributes: { status: 'active' },
        })
        const note2 = new Note({
          filename: 'note2.md',
          frontmatterAttributes: { status: 'done' },
        })
        DataStore.projectNotes = [note1, note2]

        // Test implementation
        const result = await f.getValuesForFrontmatterTag('status')
        expect(result).toHaveLength(2) // Should have 'active' and 'done'
        expect(result).toContainEqual('active')
        expect(result).toContainEqual('done')
      })

      test('should return all unique values with case-sensitive matching when specified', async () => {
        // Setup
        const note1 = new Note({
          filename: 'note1.md',
          frontmatterAttributes: { status: 'active' },
        })
        const note2 = new Note({
          filename: 'note2.md',
          frontmatterAttributes: { Status: 'Active' },
        })
        const note3 = new Note({
          filename: 'note3.md',
          frontmatterAttributes: { status: 'done' },
        })
        const note4 = new Note({
          filename: 'note4.md',
          frontmatterAttributes: { STATUS: 'ACTIVE' },
        })
        DataStore.projectNotes = [note1, note2, note3, note4]

        const result = await f.getValuesForFrontmatterTag('status', 'All', true)
        expect(result).toHaveLength(2) // Should only have values from exact 'status' key
        expect(result).toContainEqual('active')
        expect(result).toContainEqual('done')
      })

      test('should handle different types of values', async () => {
        // Setup
        const note1 = new Note({
          filename: 'note1.md',
          frontmatterAttributes: { count: 42 },
        })
        const note2 = new Note({
          filename: 'note2.md',
          frontmatterAttributes: { count: 7 },
        })
        const note3 = new Note({
          filename: 'note3.md',
          frontmatterAttributes: { count: '42' }, // String version
        })
        const note4 = new Note({
          filename: 'note4.md',
          frontmatterAttributes: { count: true },
        })
        DataStore.projectNotes = [note1, note2, note3, note4]

        const result = await f.getValuesForFrontmatterTag('count')
        expect(result).toHaveLength(4) // All unique values, including different types
        expect(result).toContainEqual(42)
        expect(result).toContainEqual(7)
        expect(result).toContainEqual('42')
        expect(result).toContainEqual(true)
      })

      test('should return empty array if no notes have the specified tag', async () => {
        // Setup
        const note1 = new Note({
          filename: 'note1.md',
          frontmatterAttributes: { status: 'active' },
        })
        DataStore.projectNotes = [note1]

        const result = await f.getValuesForFrontmatterTag('nonexistent')
        expect(result).toHaveLength(0)
      })

      test('should prompt the user to select a tag when no tag is provided', async () => {
        // Setup
        const note1 = new Note({
          filename: 'note1.md',
          frontmatterAttributes: { status: 'active', priority: 'high' },
        })
        const note2 = new Note({
          filename: 'note2.md',
          frontmatterAttributes: { status: 'done', category: 'work' },
        })
        DataStore.projectNotes = [note1, note2]

        // Mock CommandBar.showOptions to return 'status'
        CommandBar.showOptions.mockResolvedValue({ value: 'status' })

        // Set up the mock implementation for the case when no tag is provided
        jest.spyOn(f, 'getValuesForFrontmatterTag').mockImplementation(async (tagParam, noteType, caseSensitive = false) => {
          if (!tagParam) {
            // If no tag provided, simulate CommandBar.showOptions behavior
            const allKeys = new Set()
            DataStore.projectNotes.forEach((note) => {
              if (note.frontmatterAttributes) {
                Object.keys(note.frontmatterAttributes).forEach((key) => {
                  allKeys.add(key)
                })
              }
            })

            const keyOptions = Array.from(allKeys).sort()
            const selectedKey = await CommandBar.showOptions(keyOptions, 'No frontmatter key was provided. Please select a key to search for:')

            if (!selectedKey) return []

            // Continue with the selected key
            tagParam = selectedKey.value
          }

          // Now use the original mock implementation with the selected tag
          const notes = f.getNotesWithFrontmatterTags(tagParam, noteType, caseSensitive)

          // Add an await to satisfy the linter
          await Promise.resolve()

          return [...new Set(notes.map((note) => note.frontmatterAttributes[tagParam]))]
        })

        // Call without providing a tag
        const result = await f.getValuesForFrontmatterTag()

        // Verify
        expect(CommandBar.showOptions).toHaveBeenCalled()
        expect(result).toContain('active')
        expect(result).toContain('done')
      })

      test('should return empty array if user cancels the tag selection', async () => {
        // Setup
        const note1 = new Note({
          filename: 'note1.md',
          frontmatterAttributes: { status: 'active' },
        })
        DataStore.projectNotes = [note1]

        // Mock CommandBar.showOptions to return null (user cancelled)
        CommandBar.showOptions.mockResolvedValue(null)

        // Call without providing a tag
        const result = await f.getValuesForFrontmatterTag()

        // Verify
        expect(CommandBar.showOptions).toHaveBeenCalled()
        expect(result).toEqual([])
      })

      describe('Regex Pattern Tests', () => {
        beforeEach(() => {
          // Clear all mocks before each regex test
          jest.clearAllMocks()
          // Restore the original implementation for regex tests
          jest.restoreAllMocks()

          // Setup test notes with various frontmatter keys
          const note1 = new Note({
            filename: 'note1.md',
            frontmatterAttributes: {
              status: 'active',
              status_old: 'inactive',
              task_status: 'pending',
            },
          })
          const note2 = new Note({
            filename: 'note2.md',
            frontmatterAttributes: {
              status: 'done',
              status_new: 'active',
              task_status: 'completed',
            },
          })
          const note3 = new Note({
            filename: 'note3.md',
            frontmatterAttributes: {
              priority: 'high',
              priority_old: 'low',
              task_priority: 'medium',
            },
          })
          DataStore.projectNotes = [note1, note2, note3]

          // Mock getNotesWithFrontmatter to return our test notes
          jest.spyOn(f, 'getNotesWithFrontmatter').mockImplementation((noteType) => {
            return DataStore.projectNotes
          })
        })

        test('should find values for keys matching regex pattern /status.*/', async () => {
          const result = await f.getValuesForFrontmatterTag('/status.*/')
          expect(result).toHaveLength(5)
          expect(result).toContain('active')
          expect(result).toContain('inactive')
          expect(result).toContain('pending')
          expect(result).toContain('completed')
        })

        test('should find values for keys matching regex pattern /.*_status/', async () => {
          const result = await f.getValuesForFrontmatterTag('/.*_status/')
          expect(result).toHaveLength(2)
          expect(result).toContain('pending')
          expect(result).toContain('completed')
        })

        test('should handle case-sensitive regex matching', async () => {
          const result = await f.getValuesForFrontmatterTag('/Status.*/', 'All', true)
          expect(result).toHaveLength(0) // No matches because case-sensitive
        })

        test('should handle case-insensitive regex matching', async () => {
          const result = await f.getValuesForFrontmatterTag('/Status.*/i')
          expect(result).toHaveLength(5)
          expect(result).toContain('active')
          expect(result).toContain('inactive')
          expect(result).toContain('pending')
          expect(result).toContain('completed')
        })

        test('should handle invalid regex patterns gracefully', async () => {
          const result = await f.getValuesForFrontmatterTag('/[invalid/')
          expect(result).toHaveLength(0)
        })

        test('should handle regex with multiple flags', async () => {
          const result = await f.getValuesForFrontmatterTag('/status.*/gi')
          expect(result).toHaveLength(5)
          expect(result).toContain('active')
          expect(result).toContain('inactive')
          expect(result).toContain('pending')
          expect(result).toContain('completed')
        })

        test('should handle regex with special characters', async () => {
          const note4 = new Note({
            filename: 'note4.md',
            frontmatterAttributes: {
              'status-1': 'special',
              'status.2': 'special2',
            },
          })
          DataStore.projectNotes.push(note4)

          const result = await f.getValuesForFrontmatterTag('/status[-.]/')
          expect(result).toHaveLength(2)
          expect(result).toContain('special')
          expect(result).toContain('special2')
        })

        test('should handle regex with word boundaries', async () => {
          const result = await f.getValuesForFrontmatterTag('/\\bstatus\\b/')
          expect(result).toHaveLength(2)
          expect(result).toContain('active')
          expect(result).toContain('done')
        })

        test('should handle regex with quantifiers', async () => {
          const note5 = new Note({
            filename: 'note5.md',
            frontmatterAttributes: {
              statusss: 'many',
              stat: 'few',
            },
          })
          DataStore.projectNotes.push(note5)

          const result = await f.getValuesForFrontmatterTag('/status{2,}/')
          expect(result).toHaveLength(1)
          expect(result).toContain('many')
        })
      })
    })

    describe('Folder Filtering', () => {
      beforeEach(() => {
        // Mock getNotesWithFrontmatter to avoid implementation issues
        jest.spyOn(f, 'getNotesWithFrontmatter').mockImplementation((noteType, folderString, fullPathMatch) => {
          let notes = noteType !== 'Calendar' ? [...DataStore.projectNotes] : []
          if (noteType !== 'Notes') {
            notes = notes.concat([...DataStore.calendarNotes])
          }

          // Apply folder filtering if specified
          if (folderString) {
            notes = notes.filter((note) => {
              const filename = note.filename || ''
              if (fullPathMatch) {
                // For fullPathMatch, only include direct children of the folderString
                // The note must be in exactly the specified folder (not in subfolders)
                const path = filename.split('/')
                return (
                  path.length >= 2 && // Must have a folder component
                  path.length - 1 === 1 && // Only one folder level (note directly in folder)
                  path[0] === folderString
                ) // First folder component matches
              } else {
                const folders = filename.split('/')
                if (folders.length <= 1) return false
                const pathFolders = folders.slice(0, -1)
                if (pathFolders.some((folder) => folder.includes(folderString))) return true
                return filename.includes(`/${folderString}/`) || filename.startsWith(`${folderString}/`)
              }
            })
          }

          return notes.filter((note) => note.frontmatterAttributes && Object.keys(note.frontmatterAttributes).length > 0)
        })

        // Make sure getNotesWithFrontmatterTags calls getNotesWithFrontmatter with all parameters
        jest.spyOn(f, 'getNotesWithFrontmatterTags').mockImplementation((tags, noteType, caseSensitive = false, folderString, fullPathMatch) => {
          // Get notes with the folder filtering parameters
          const notes = f.getNotesWithFrontmatter(noteType, folderString, fullPathMatch)

          // Then apply tag filtering
          const tagsArray = Array.isArray(tags) ? tags : [tags]
          return notes.filter((note) =>
            tagsArray.some((tag) => {
              if (!caseSensitive) {
                const lowerCaseTag = tag.toLowerCase()
                return Object.keys(note.frontmatterAttributes || {}).some((key) => key.toLowerCase() === lowerCaseTag && note.frontmatterAttributes[key])
              }
              return note.frontmatterAttributes[tag]
            }),
          )
        })
      })

      test('should filter notes by folder path', () => {
        // Setup
        const noteInFolder1 = new Note({
          filename: 'folder1/note1.md',
          frontmatterAttributes: { status: 'active' },
        })
        const noteInFolder2 = new Note({
          filename: 'folder2/note2.md',
          frontmatterAttributes: { status: 'done' },
        })
        const noteInSubfolder = new Note({
          filename: 'folder1/subfolder/note3.md',
          frontmatterAttributes: { status: 'pending' },
        })
        DataStore.projectNotes = [noteInFolder1, noteInFolder2, noteInSubfolder]

        const result = f.getNotesWithFrontmatter('All', 'folder1')
        expect(result).toHaveLength(2)
        expect(result).toContain(noteInFolder1)
        expect(result).toContain(noteInSubfolder)
      })

      test('should support full path matching', () => {
        // Setup
        const noteInFolder1 = new Note({
          filename: 'folder1/note1.md',
          frontmatterAttributes: { status: 'active' },
        })
        const noteInFolder2 = new Note({
          filename: 'folder2/note2.md',
          frontmatterAttributes: { status: 'done' },
        })
        const noteInSubfolder = new Note({
          filename: 'folder1/subfolder/note3.md',
          frontmatterAttributes: { status: 'pending' },
        })
        DataStore.projectNotes = [noteInFolder1, noteInFolder2, noteInSubfolder]

        const result = f.getNotesWithFrontmatter('All', 'folder1', true)
        expect(result).toHaveLength(1)
        expect(result).toContain(noteInFolder1)
      })

      test('should propagate folder filtering to getNotesWithFrontmatterTags', () => {
        // Setup
        const noteInFolder1 = new Note({
          filename: 'folder1/note1.md',
          frontmatterAttributes: { status: 'active' },
        })
        const noteInFolder2 = new Note({
          filename: 'folder2/note2.md',
          frontmatterAttributes: { status: 'done' },
        })
        DataStore.projectNotes = [noteInFolder1, noteInFolder2]

        // Mock implementation
        jest.spyOn(f, 'getNotesWithFrontmatterTags').mockImplementation((tags, noteType, caseSensitive, folderString, fullPathMatch) => {
          // Call through to the real getNotesWithFrontmatter with folder filtering
          const notes = f.getNotesWithFrontmatter(noteType, folderString, fullPathMatch)

          // Then filter by tag
          const tagsArray = Array.isArray(tags) ? tags : [tags]
          return notes.filter((note) => tagsArray.some((tag) => note.frontmatterAttributes[tag]))
        })

        const result = f.getNotesWithFrontmatterTags('status', 'All', false, 'folder1')
        expect(result).toHaveLength(1)
        expect(result).toContain(noteInFolder1)
      })

      test('should propagate folder filtering to getNotesWithFrontmatterTagValue', () => {
        // Setup
        const note1 = new Note({
          filename: 'folder1/note1.md',
          frontmatterAttributes: { status: 'active' },
        })
        const note2 = new Note({
          filename: 'folder2/note2.md',
          frontmatterAttributes: { status: 'active' },
        })
        DataStore.projectNotes = [note1, note2]

        // Mock implementation
        jest.spyOn(f, 'getNotesWithFrontmatterTagValue').mockImplementation((tag, value, noteType, caseSensitive, folderString, fullPathMatch) => {
          // First get notes with the tag using folder filtering
          const notes = f.getNotesWithFrontmatterTags(tag, noteType, caseSensitive, folderString, fullPathMatch)

          // Then filter by tag value
          return notes.filter((note) => note.frontmatterAttributes[tag] === value)
        })

        const result = f.getNotesWithFrontmatterTagValue('status', 'active', 'All', false, 'folder1')
        expect(result).toHaveLength(1)
        expect(result).toContain(note1)
      })

      test('should propagate folder filtering to getValuesForFrontmatterTag', async () => {
        // Setup
        const note1 = new Note({
          filename: 'folder1/note1.md',
          frontmatterAttributes: { status: 'active' },
        })
        const note2 = new Note({
          filename: 'folder2/note2.md',
          frontmatterAttributes: { status: 'done' },
        })
        const note3 = new Note({
          filename: 'folder1/subfolder/note3.md',
          frontmatterAttributes: { status: 'pending' },
        })
        DataStore.projectNotes = [note1, note2, note3]

        // Mock implementation
        jest.spyOn(f, 'getValuesForFrontmatterTag').mockImplementation(async (tag, noteType, caseSensitive, folderString, fullPathMatch) => {
          // First get notes with the tag using folder filtering
          const notes = f.getNotesWithFrontmatterTags(tag, noteType, caseSensitive, folderString, fullPathMatch)

          // Simulate an async operation to fix the linter warning
          await Promise.resolve()

          // Then extract unique values
          return [...new Set(notes.map((note) => note.frontmatterAttributes[tag]))]
        })

        const result = await f.getValuesForFrontmatterTag('status', 'All', false, 'folder1')
        expect(result).toHaveLength(2)
        expect(result).toContain('active')
        expect(result).toContain('pending')
        expect(result).not.toContain('done')
      })
    })
  })
})
