/* global describe, test, expect, beforeAll, beforeEach */

import { CustomConsole } from '@jest/console'
import * as f from '../../NPFrontMatter'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter, Note, Paragraph /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

const PLUGIN_NAME = `helpers`
const FILENAME = `NPFrontMatterDetection`

beforeAll(() => {
  // global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
})

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    describe('hasFrontMatter()', () => {
      test('should return true if there is frontmatter', () => {
        const text = '---\nfoo: bar\n---\n'
        const result = f.hasFrontMatter(text)
        expect(result).toEqual(true)
      })
      test('should return false if there is no frontmatter (using text)', () => {
        const text = 'foo: bar'
        const result = f.hasFrontMatter(text)
        expect(result).toEqual(false)
      })
    })

    describe('noteHasFrontMatter()', () => {
      test('should return true for a regular note with non-empty frontmatterAttributes', () => {
        const note = new Note({
          paragraphs: [
            new Paragraph({ type: 'separator', content: '---' }),
            new Paragraph({ content: 'title:  Test Note' }),
            new Paragraph({ content: 'foo:  bar' }),
            new Paragraph({ type: 'separator', content: '---' }),
          ],
          frontmatterAttributes: { title: 'Test Note', foo: 'bar' },
        })
        const result = f.noteHasFrontMatter(note)
        expect(result).toEqual(true)
      })

      test('should return false for a regular note with separators but not frontmatterAttributes', () => {
        const note = new Note({
          type: 'Notes',
          paragraphs: [new Paragraph({ type: 'text', content: 'foo' }), new Paragraph({ type: 'separator', content: '---' }), new Paragraph({ type: 'separator', content: '---' })],
          frontmatterAttributes: {},
        })
        const result = f.noteHasFrontMatter(note)
        expect(result).toEqual(false)
      })

      test('should return false for a calendar note with separators but not frontmatterAttributes', () => {
        const note = new Note({
          type: 'Calendar',
          paragraphs: [new Paragraph({ type: 'text', content: 'foo' }), new Paragraph({ type: 'separator', content: '---' }), new Paragraph({ type: 'separator', content: '---' })],
          frontmatterAttributes: {},
        })
        const result = f.noteHasFrontMatter(note)
        expect(result).toEqual(false)
      })

      test('should return true for a Calendar note with valid frontmatter configuration', () => {
        const content = '---\nfoo: bar\n---\nRest of note content'
        const note = new Note({
          type: 'Calendar',
          content,
          paragraphs: [new Paragraph({ type: 'separator', content: '---' }), new Paragraph({ content: 'foo: bar' }), new Paragraph({ type: 'separator', content: '---' })],
        })
        const result = f.noteHasFrontMatter(note)
        expect(result).toEqual(true)
      })

      test('should return false for a Calendar note with valid frontmatter content', () => {
        const content = '---\nfoo: bar\n---\nRest of note content'
        const note = new Note({
          type: 'Calendar',
          content,
          paragraphs: [new Paragraph({ type: 'separator', content: '---' }), new Paragraph({ content: 'foo: bar' }), new Paragraph({ type: 'separator', content: '---' })],
        })
        const result = f.noteHasFrontMatter(note)
        expect(result).toEqual(true)
      })

      test('should return true for a Calendarnote with separators but no content', () => {
        const note = new Note({
          type: 'Calendar',
          content: '---\n---\n',
          paragraphs: [new Paragraph({ type: 'separator', content: '---' }), new Paragraph({ type: 'separator', content: '---' })],
        })
        const result = f.noteHasFrontMatter(note)
        expect(result).toEqual(true)
      })

      test('should return false for a null note', () => {
        const result = f.noteHasFrontMatter(null)
        expect(result).toEqual(false)
      })

      test('should return true for a regular note with the right separators but empty frontmatterAttributes', () => {
        // Create a regular note with an empty frontmatterAttributes object
        const note = new Note({
          type: 'Notes',
          filename: 'note-missing-fm.md',
          paragraphs: [new Paragraph({ type: 'separator', content: '---' }), new Paragraph({ type: 'separator', content: '---' })],
          frontmatterAttributes: {},
        })
        const result = f.noteHasFrontMatter(note)
        expect(result).toEqual(true)
      })

      test('should return false for a note with null frontmatterAttributes', () => {
        const note = new Note({
          type: 'Notes',
          paragraphs: [new Paragraph({ type: 'separator', content: '---' }), new Paragraph({ content: 'Some content' }), new Paragraph({ type: 'separator', content: '---' })],
          frontmatterAttributes: null,
        })
        const result = f.noteHasFrontMatter(note)
        expect(result).toEqual(false)
      })
    })

    describe('getFrontmatterNotes()', () => {
      /**
       * Reset the DataStore.projectNotes and set the template folder before each test.
       */
      beforeEach(() => {
        DataStore.projectNotes = []
        // Set the template folder environment variable
        NotePlan.environment = { templateFolder: '@Templates' }
      })

      test('should return empty array when no notes have frontmatter attributes', () => {
        const note = new Note({ filename: 'note-empty.md', frontmatterAttributes: {} })
        DataStore.projectNotes.push(note)
        const result = f.getFrontmatterNotes()
        expect(result.length).toBe(0)
      })

      test('should include all non-templatenotes with frontmatter attributes when includeTemplateFolders is false (default)', () => {
        const note1 = new Note({ filename: 'note1.md', frontmatterAttributes: { title: 'Note1', foo: 'bar' } })
        const note2 = new Note({ filename: '@Templates/template1.md', frontmatterAttributes: { title: 'Template Note', foo: 'baz' } })
        const note3 = new Note({ filename: 'note3.md', frontmatterAttributes: {} })
        const note4 = new Note({ filename: 'note4.md', frontmatterAttributes: { title: 'Note4' } })
        DataStore.projectNotes.push(note1, note2, note3, note4)
        const result = f.getFrontmatterNotes()
        expect(result).toContain(note1)
        expect(result).not.toContain(note2)
        expect(result).toContain(note4)
        expect(result).not.toContain(note3)
        expect(result.length).toBe(2)
      })

      test('should include template notes when includeTemplateFolders is true', () => {
        const note1 = new Note({ filename: 'note1.md', frontmatterAttributes: { title: 'Note1', foo: 'bar' } })
        const note2 = new Note({ filename: '@Templates/template1.md', frontmatterAttributes: { title: 'Template Note', foo: 'baz' } })
        const note3 = new Note({ filename: 'note3.md', frontmatterAttributes: { title: 'Note3' } })
        DataStore.projectNotes.push(note1, note2, note3)
        const result = f.getFrontmatterNotes(true)
        expect(result).toContain(note1)
        expect(result).toContain(note2)
        expect(result).toContain(note3)
        expect(result.length).toBe(3)
      })

      test('should return only template notes when onlyTemplateNotes is true', () => {
        const note1 = new Note({ filename: 'note1.md', frontmatterAttributes: { title: 'Note1', foo: 'bar' } })
        const note2 = new Note({ filename: '@Templates/template1.md', frontmatterAttributes: { title: 'Template Note', foo: 'baz' } })
        const note3 = new Note({ filename: '@Templates/template2.md', frontmatterAttributes: { title: 'Template Note2', foo: 'qux' } })
        const note4 = new Note({ filename: 'note4.md', frontmatterAttributes: { title: 'Note4' } })
        DataStore.projectNotes.push(note1, note2, note3, note4)
        const result = f.getFrontmatterNotes(false, true)
        expect(result).toContain(note2)
        expect(result).toContain(note3)
        expect(result).not.toContain(note1)
        expect(result).not.toContain(note4)
        expect(result.length).toBe(2)
      })
    })
  })
})
