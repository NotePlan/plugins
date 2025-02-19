/* global describe, test, expect, beforeAll */

import { CustomConsole } from '@jest/console'
import * as f from '../../NPFrontMatter'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter, Note /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

const PLUGIN_NAME = `helpers`
const FILENAME = `NPFrontMatterManipulation`

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
    describe('ensureFrontmatter()', () => {
      test('should return false if note is null or undefined', () => {
        const note = undefined
        const result = f.ensureFrontmatter(note)
        expect(result).toEqual(false)
      })
      test('should return true if note content is empty and no title param (it will add empty "")', () => {
        const note = new Note({ paragraphs: [], content: '', title: '' })
        const result = f.ensureFrontmatter(note)
        expect(result).toEqual(true)
      })
      test('should return true if already has frontmatter', () => {
        const note = new Note({ content: '---\nfoo: bar\n---\n' })
        const result = f.ensureFrontmatter(note)
        expect(result).toEqual(true)
      })
      test('should return true if already has frontmatter but change title', () => {
        const note = new Note({ content: '---\ntitle: bar\n---\n' })
        const result = f.ensureFrontmatter(note, true, 'baz')
        expect(result).toEqual(true)
        expect(note.content).toMatch(/title: baz/)
      })
      test('should set note title if had no title', () => {
        const note = new Note({ content: '---\nsam: bar\n---\n' })
        const result = f.ensureFrontmatter(note, true, 'baz')
        expect(result).toEqual(true)
        expect(note.content).toMatch(/title: baz/)
      })
      test('should set empty frontmatter if Calendar note', () => {
        const note = new Note({ content: '', type: 'Calendar', paragraphs: [], title: '2022-01-01' })
        const result = f.ensureFrontmatter(note, false)
        expect(result).toEqual(true)
        expect(note.content).toMatch(/---\n---/)
      })
      test('should set note title in frontmatter if had title in document', () => {
        const note = new Note({ paragraphs: [{ content: 'foo', headingLevel: 1, type: 'title' }], content: '# foo', title: 'foo' })
        const result = f.ensureFrontmatter(note)
        expect(result).toEqual(true)
        expect(note.content).toMatch(/title: foo/)
      })
      test('in project note, should gracefully add frontmatter even it does not have title and NP is seeing the ```mermaid', () => {
        const note = new Note({
          paragraphs: [{ content: '```mermaid', headingLevel: 0, type: 'text' }],
          content: '```mermaid',
          title: '```mermaid',
        })
        const result = f.ensureFrontmatter(note)
        expect(result).toEqual(true)
        expect(note.content).toMatch('---\ntitle: mermaid\n---\n```mermaid')
      })
      test('should return true if no content but with title', () => {
        const note = new Note({ paragraphs: [], content: '' })
        const result = f.ensureFrontmatter(note, true, 'baz')
        expect(result).toEqual(true)
        expect(note.content).toMatch(/title: baz/)
      })
      test('should create frontmatter from an empty note with a title in params', () => {
        const note = new Note({ content: '', paragraphs: [], title: '' })
        const result = f.ensureFrontmatter(note, true, 'bar')
        expect(result).toEqual(true)
      })
      test('should not duplicate content in Calendar note (real world data)', () => {
        const editor = {
          title: '2025-01-01',
          filename: '20250101.md',
          type: 'Calendar',
          paragraphs: [
            {
              content: 'Process NW Bills statement for last month @repeat(1m)',
              rawContent: '* Process NW Bills statement for last month @repeat(1m)',
              type: 'open',
              heading: '',
              headingLevel: -1,
              lineIndex: 0,
              isRecurring: false,
              indents: 0,
              noteType: 'Notes',
            },
            {
              content: 'Process NW Everyday statement for last month @repeat(1m)',
              rawContent: '* Process NW Everyday statement for last month @repeat(1m)',
              type: 'open',
              heading: '',
              headingLevel: -1,
              lineIndex: 1,
              isRecurring: false,
              indents: 0,
              noteType: 'Notes',
            },
            {
              content: 'Do work CAF Receipts for last month @repeat(1m)',
              rawContent: '* Do work CAF Receipts for last month @repeat(1m)',
              type: 'open',
              heading: '',
              headingLevel: -1,
              lineIndex: 2,
              isRecurring: false,
              indents: 0,
              noteType: 'Notes',
            },
          ],
        }
        const note = new Note(editor)
        const result = f.ensureFrontmatter(note, true, 'bar')
        expect(result).toEqual(true)
        const matches = note.content.match(/CAF Receipts/)
        expect(matches.length).toEqual(1)
      })
      test('should not duplicate content in Project note (real world data)', () => {
        const editor = {
          title: 'Foo Bar',
          filename: 'foo/20250101.md',
          type: 'Notes',
          paragraphs: [
            {
              content: 'Process NW Bills statement for last month @repeat(1m)',
              rawContent: '* Process NW Bills statement for last month @repeat(1m)',
              type: 'open',
              heading: '',
              headingLevel: -1,
              lineIndex: 0,
              isRecurring: false,
              indents: 0,
              noteType: 'Notes',
            },
            {
              content: 'Process NW Everyday statement for last month @repeat(1m)',
              rawContent: '* Process NW Everyday statement for last month @repeat(1m)',
              type: 'open',
              heading: '',
              headingLevel: -1,
              lineIndex: 1,
              isRecurring: false,
              indents: 0,
              noteType: 'Notes',
            },
            {
              content: 'Do work CAF Receipts for last month @repeat(1m)',
              rawContent: '* Do work CAF Receipts for last month @repeat(1m)',
              type: 'open',
              heading: '',
              headingLevel: -1,
              lineIndex: 2,
              isRecurring: false,
              indents: 0,
              noteType: 'Notes',
            },
          ],
        }
        const note = new Note(editor)
        const result = f.ensureFrontmatter(note, true, 'bar')
        expect(result).toEqual(true)
        const matches = note.content.match(/CAF Receipts/)
        expect(matches.length).toEqual(1)
      })
    })

    describe('writeFrontMatter()', () => {
      test('should return false if there is no frontmatter', () => {
        const note = new Note({ paragraphs: [], content: '', title: null })
        const vars = { foo: 'bar' }
        const result = f.writeFrontMatter(note, vars)
        expect(result).toEqual(false)
      })
      test('should return true if frontmatter is written', () => {
        const note = new Note({
          paragraphs: [{ type: 'separator', content: '---' }, { content: 'title: foo' }, { content: 'bar: baz' }, { type: 'separator', content: '---' }],
          content: '---\ntitle: foo\n---\n',
        })
        const vars = { foo: 'bar' }
        const result = f.writeFrontMatter(note, vars)
        expect(result).toEqual(true)
      })
    })

    describe('removeFrontMatter()', () => {
      test('should return false if there are no paras (and so no frontmatter)', () => {
        const note = new Note({ paragraphs: [], content: '' })
        const result = f.removeFrontMatter(note)
        expect(result).toEqual(false)
      })
      test('should return false if there are paras but no frontmatter', () => {
        const allParas = [{ content: '# note title' }, { content: 'comment 1' }, { content: '+ checklist 1' }]
        const note = new Note({ paragraphs: allParas, content: '' })
        const result = f.removeFrontMatter(note)
        expect(result).toEqual(false)
      })
      test('should return true and delete FM paras (but not --- separators)', () => {
        const allParas = [{ content: '---' }, { content: 'foo' }, { content: '---' }, { content: '# note title' }, { content: 'comment 1' }, { content: '+ checklist 1' }]
        const note = new Note({ paragraphs: allParas, content: '' })
        const result = f.removeFrontMatter(note, false)
        expect(result).toEqual(true)
        expect(note.paragraphs.length).toEqual(5)
        expect(note.paragraphs[0].content).toEqual(allParas[0].content)
        expect(note.paragraphs[1].content).toEqual(allParas[2].content)
        expect(note.paragraphs[2].content).toEqual(allParas[3].content)
        expect(note.paragraphs[3].content).toEqual(allParas[4].content)
        expect(note.paragraphs[4].content).toEqual(allParas[5].content)
      })
      test('should return true and delete FM paras (and --- separators)', () => {
        const allParas = [{ content: '---' }, { content: 'foo' }, { content: '---' }, { content: '# note title' }, { content: 'comment 1' }, { content: '+ checklist 1' }]
        const note = new Note({ paragraphs: allParas })
        const result = f.removeFrontMatter(note, true)
        expect(result).toEqual(true) // test 1
        expect(note.paragraphs.length).toEqual(3) //test2
        expect(note.paragraphs[0].content).toEqual(allParas[3].content) // test 3
        expect(note.paragraphs[1].content).toEqual(allParas[4].content) // test 4
        expect(note.paragraphs[2].content).toEqual(allParas[5].content) // test 5
      })
      test('should change FM title to a normal title)', () => {
        const allParas = [{ content: '---' }, { content: 'title: foo bar' }, { content: '---' }, { content: 'comment 1' }, { content: '+ checklist 1' }]
        const note = new Note({ paragraphs: allParas })
        const result = f.removeFrontMatter(note, true)
        expect(result).toEqual(true)
        expect(note.paragraphs.length).toEqual(3)
        expect(note.paragraphs[0].content).toEqual(`# foo bar`)
        expect(note.paragraphs[1].content).toEqual(allParas[3].content)
      })
    })

    describe('removeFrontMatterField()', () => {
      test('should return false if there is no frontmatter (no paras)', () => {
        const note = new Note({ paragraphs: [], content: '' })
        const result = f.removeFrontMatterField(note, 'fieldName', 'value', false)
        expect(result).toEqual(false)
      })
      test('should return false if there are matching fields but no frontmatter', () => {
        const allParas = [{ content: '# note title' }, { content: 'fieldName: value' }, { content: '+ checklist 1' }]
        const note = new Note({ paragraphs: allParas, content: '' })
        const result = f.removeFrontMatterField(note, 'fieldName', 'value', false)
        expect(result).toEqual(false)
      })
      test('should remove matching field from frontmatter but leave separators', () => {
        const allParas = [
          { type: 'separator', content: '---' },
          { content: 'title: note title' },
          { content: 'fieldName: value' },
          { type: 'separator', content: '---' },
          { content: '+ checklist 1' },
        ]
        const note = new Note({ paragraphs: allParas, content: '' })
        const result = f.removeFrontMatterField(note, 'fieldName', 'value', false)
        expect(result).toEqual(true)
        expect(note.paragraphs.length).toEqual(4)
        expect(note.paragraphs[0].content).toEqual(allParas[0].content)
        expect(note.paragraphs[1].content).toEqual(allParas[1].content)
        expect(note.paragraphs[2].content).toEqual(allParas[3].content)
        expect(note.paragraphs[3].content).toEqual(allParas[4].content)
      })
      test('should remove single matching field from frontmatter and also separators', () => {
        const allParas = [{ type: 'separator', content: '---' }, { content: 'fieldName: value' }, { type: 'separator', content: '---' }, { content: '+ checklist 1' }]
        const note = new Note({ paragraphs: allParas, content: '' })
        const result = f.removeFrontMatterField(note, 'fieldName', 'value', true)
        expect(result).toEqual(true)
        expect(note.paragraphs.length).toEqual(1)
        expect(note.paragraphs[0].content).toEqual(allParas[3].content)
      })
      test('should remove matching field from frontmatter but not separators, converting to Markdown type title', () => {
        const allParas = [
          { type: 'separator', content: '---' },
          { content: 'fieldName: value' },
          { content: 'title: note title' },
          { type: 'separator', content: '---' },
          { content: '+ checklist 1' },
        ]
        const note = new Note({ paragraphs: allParas, content: '' })
        const result = f.removeFrontMatterField(note, 'fieldName', 'value', true)
        expect(result).toEqual(true)
        expect(note.paragraphs.length).toEqual(4)
        expect(note.paragraphs[0].content).toEqual(allParas[0].content) // toEqual(`# note title`) // Note: change back to MD style
        expect(note.paragraphs[1].content).toEqual(allParas[2].content)
        expect(note.paragraphs[2].content).toEqual(allParas[3].content)
        expect(note.paragraphs[3].content).toEqual(allParas[4].content)
      })
      test('should remove matching field with no value, but leave other field, and therefore also separators', () => {
        const allParas = [{ type: 'separator', content: '---' }, { content: 'field_other: value1' }, { content: 'fieldName:' }, { type: 'separator', content: '---' }]
        const note = new Note({ paragraphs: allParas, content: '' })
        const result = f.removeFrontMatterField(note, 'fieldName', '', true)
        expect(result).toEqual(true)
        expect(note.paragraphs.length).toEqual(3)
        expect(note.paragraphs[0].content).toEqual(allParas[0].content)
        expect(note.paragraphs[1].content).toEqual(allParas[1].content)
        expect(note.paragraphs[2].content).toEqual(allParas[3].content)
      })
      test('should remove matching field (with no value test) with different values from frontmatter but leave other field, and therefore also separators', () => {
        const allParas = [
          { type: 'separator', content: '---' },
          { content: 'field_other: value1' },
          { content: 'fieldName: this is, a, longer "value 1"' },
          { type: 'separator', content: '---' },
        ]
        const note = new Note({ paragraphs: allParas, content: '' })
        const result = f.removeFrontMatterField(note, 'fieldName', '', true)
        expect(result).toEqual(true)
        expect(note.paragraphs.length).toEqual(3)
        expect(note.paragraphs[0].content).toEqual(allParas[0].content)
        expect(note.paragraphs[1].content).toEqual(allParas[1].content)
        expect(note.paragraphs[2].content).toEqual(allParas[3].content)
      })
    })
  })
})
