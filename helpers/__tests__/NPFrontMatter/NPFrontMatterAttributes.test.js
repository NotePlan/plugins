/* global describe, test, expect, beforeAll */

import { CustomConsole } from '@jest/console'
import * as f from '../../NPFrontMatter'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter, Note /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

const PLUGIN_NAME = `helpers`
const FILENAME = `NPFrontMatterAttributes`

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
    describe('getFrontMatterAttributes()', () => {
      test('should return empty object if no frontmatter', () => {
        const result = f.getFrontMatterAttributes(new Note({ content: '' }))
        expect(result).toEqual({})
      })
      test('should return empty object if empty frontmatter', () => {
        const text = '---\n---\n'
        const result = f.getFrontMatterAttributes({ content: text })
        expect(result).toEqual({})
      })
      test('should return object with frontmatter vars and boolean values', () => {
        const text = '---\nfield1: true\nfield2: false\n---\n'
        const result = f.getFrontMatterAttributes(new Note({ content: text }))
        expect(result).toEqual({ field1: true, field2: false })
      })
      test('should return object with frontmatter vars', () => {
        const text = '---\nfield1: true\nfield2: foo\n---\n'
        const result = f.getFrontMatterAttributes(new Note({ content: text }))
        expect(result).toEqual({ field1: true, field2: 'foo' })
      })
    })

    describe('setFrontMatterVars()', () => {
      test('should pass even with no title in varObj', () => {
        const note = new Note({ content: '', paragraphs: [], title: '' })
        const result = f.setFrontMatterVars(note, { foo: 'bar' })
        expect(result).toEqual(true)
      })
      test('should work on an empty note with a title in varObj', () => {
        const note = new Note({ content: '', paragraphs: [], title: '' })
        const result = f.setFrontMatterVars(note, { title: 'bar' })
        expect(result).toEqual(true)
      })
      test('should work on an empty note with a title and empty varObj', () => {
        const note = new Note({ content: '# theTitle', paragraphs: [{ content: 'theTitle', headingLevel: 1, type: 'title' }], title: 'theTitle' })
        const result = f.setFrontMatterVars(note, {})
        expect(result).toEqual(true)
        expect(note.content).toMatch(/title: theTitle/) // added frontmatter
      })
      test('should remove a frontmatter field passed as null', () => {
        const note = new Note({
          content: '---\ntitle: foo\nbar: baz\n---\n',
          paragraphs: [{ content: '---' }, { content: 'title: foo' }, { content: 'bar: baz' }, { content: '---' }],
          title: 'foo',
        })
        const result = f.setFrontMatterVars(note, { bar: null })
        expect(result).toEqual(true)
        expect(note.content).not.toMatch(/bar/)
      })
      test('should set a frontmatter field that existed before', () => {
        const note = new Note({
          content: '---\ntitle: foo\nbar: baz\n---\n',
          paragraphs: [{ type: 'separator', content: '---' }, { content: 'title: foo' }, { content: 'bar: baz' }, { type: 'separator', content: '---' }],
          title: 'foo',
        })
        const result = f.setFrontMatterVars(note, { bar: 'foo' })
        expect(result).toEqual(true)
        expect(note.content).toMatch(/bar: foo/)
      })
      test('should not further set a duplicate frontmatter field', () => {
        const note = new Note({
          content: '---\ntitle: foo\nbar: baz\n---\n',
          paragraphs: [{ type: 'separator', content: '---' }, { content: 'title: foo' }, { content: 'bar: baz' }, { type: 'separator', content: '---' }],
          title: 'foo',
        })
        const result = f.setFrontMatterVars(note, { bar: 'baz' })
        expect(result).toEqual(true)
        expect(note.content).toMatch(/\nbar: baz\n/)
      })
      test('should set a frontmatter field that did not exist before', () => {
        const note = new Note({
          content: '---\ntitle: foo\nbar: baz\n---\n',
          paragraphs: [{ type: 'separator', content: '---' }, { content: 'title: foo' }, { content: 'bar: baz' }, { type: 'separator', content: '---' }],
          title: 'foo',
        })
        const result = f.setFrontMatterVars(note, { sam: 'boy' })
        expect(result).toEqual(true)
        expect(note.content).toMatch(/title: foo/)
        expect(note.content).toMatch(/bar: baz/)
        expect(note.content).toMatch(/sam: boy/)
      })
    })

    describe('determineAttributeChanges()', () => {
      test('should identify keys to add, update, and delete correctly when all types are present and deleteMissingAttributes is true', () => {
        const existingAttributes = { title: 'Old Title', status: 'Pending', priority: 'Medium' }
        const newAttributes = { title: 'New Title', dueDate: '2023-12-31', priority: 'High' }
        const result = f.determineAttributeChanges(existingAttributes, newAttributes, true)
        expect(result.keysToAdd).toEqual(['dueDate'])
        expect(result.keysToUpdate).toEqual(['title', 'priority'])
        expect(result.keysToDelete).toEqual(['status'])
      })

      test('should have empty keysToDelete when deleteMissingAttributes is false', () => {
        const existingAttributes = { title: 'Old Title', status: 'Pending', priority: 'Medium' }
        const newAttributes = { title: 'New Title', dueDate: '2023-12-31', priority: 'High' }
        const result = f.determineAttributeChanges(existingAttributes, newAttributes)
        expect(result.keysToAdd).toEqual(['dueDate'])
        expect(result.keysToUpdate).toEqual(['title', 'priority'])
        expect(result.keysToDelete).toEqual([])
      })

      test('should have empty arrays when there are no changes', () => {
        const existingAttributes = { title: 'Same Title', status: 'Active' }
        const newAttributes = { title: 'Same Title', status: 'Active' }
        const result = f.determineAttributeChanges(existingAttributes, newAttributes)
        expect(result.keysToAdd).toEqual([])
        expect(result.keysToUpdate).toEqual([])
        expect(result.keysToDelete).toEqual([])
      })

      test('should correctly identify only keys to add', () => {
        const existingAttributes = { title: 'Title' }
        const newAttributes = { title: 'Title', status: 'Active' }
        const result = f.determineAttributeChanges(existingAttributes, newAttributes)
        expect(result.keysToAdd).toEqual(['status'])
        expect(result.keysToUpdate).toEqual([])
        expect(result.keysToDelete).toEqual([])
      })

      test('should correctly identify only keys to update', () => {
        const existingAttributes = { title: 'Old Title', status: 'Pending' }
        const newAttributes = { title: 'New Title', status: 'Active' }
        const result = f.determineAttributeChanges(existingAttributes, newAttributes)
        expect(result.keysToAdd).toEqual([])
        expect(result.keysToUpdate).toEqual(['title', 'status'])
        expect(result.keysToDelete).toEqual([])
      })

      test('should correctly identify only keys to delete when deleteMissingAttributes is true', () => {
        const existingAttributes = { title: 'Title', status: 'Inactive', priority: 'Low' }
        const newAttributes = { title: 'Title' }
        const result = f.determineAttributeChanges(existingAttributes, newAttributes, true)
        expect(result.keysToAdd).toEqual([])
        expect(result.keysToUpdate).toEqual([])
        expect(result.keysToDelete).toEqual(['status', 'priority'])
      })

      test('should not delete the title attribute even if not present in newAttributes', () => {
        const existingAttributes = { title: 'Title', status: 'Active', priority: 'Low' }
        const newAttributes = { status: 'Inactive' }
        const result = f.determineAttributeChanges(existingAttributes, newAttributes, true)
        expect(result.keysToAdd).toEqual([])
        expect(result.keysToUpdate).toEqual(['status'])
        // 'title' should not be in keysToDelete
        expect(result.keysToDelete).toEqual(['priority'])
        expect(result.keysToDelete).not.toContain('title')
      })
    })

    describe('normalizeValue()', () => {
      test('should remove double quotes from the beginning and end', () => {
        const value = '"quoted value"'
        const result = f.normalizeValue(value)
        expect(result).toEqual('quoted value')
      })

      test('should remove single quotes from the beginning and end', () => {
        const value = "'single quoted value'"
        const result = f.normalizeValue(value)
        expect(result).toEqual('single quoted value')
      })

      test('should return the same value if there are no surrounding quotes', () => {
        const value = 'unquoted value'
        const result = f.normalizeValue(value)
        expect(result).toEqual('unquoted value')
      })

      test('should handle mixed quotes correctly', () => {
        const value1 = '"mixed\' quotes"'
        const result1 = f.normalizeValue(value1)
        expect(result1).toEqual("mixed' quotes")

        const value2 = "'mixed\" quotes'"
        const result2 = f.normalizeValue(value2)
        expect(result2).toEqual('mixed" quotes')
      })
    })

    describe('createFrontmatterTextArray()', () => {
      test('should create frontmatter lines for simple key-value pairs without quoting', () => {
        const attributes = { title: 'Sample Title', status: 'Active' }
        const quoteNonStandardYaml = false
        const result = f.createFrontmatterTextArray(attributes, quoteNonStandardYaml)
        expect(result).toEqual(['title: Sample Title', 'status: Active'])
      })

      test('should quote values that require non-standard YAML when quoteNonStandardYaml is true', () => {
        const attributes = { description: 'This is a description: with a colon', name: '@username' }
        const quoteNonStandardYaml = true
        const result = f.createFrontmatterTextArray(attributes, quoteNonStandardYaml)
        expect(result).toEqual(['description: "This is a description: with a colon"', 'name: "@username"'])
      })

      test('should handle object values by converting them to multi-line strings', () => {
        const attributes = { tags: ['tag1', 'tag2'], metadata: { author: 'John Doe', version: '1.0' } }
        const quoteNonStandardYaml = false
        const result = f.createFrontmatterTextArray(attributes, quoteNonStandardYaml)
        expect(result).toEqual(['tags:\n  - tag1\n  - tag2', 'metadata:\n  author: John Doe\n  version: 1.0'])
      })

      test('should skip attributes with null values', () => {
        const attributes = { title: 'Title', description: null }
        const quoteNonStandardYaml = false
        const result = f.createFrontmatterTextArray(attributes, quoteNonStandardYaml)
        expect(result).toEqual(['title: Title'])
      })

      test('should handle mixed types of values correctly', () => {
        const attributes = {
          title: 'Complex Title',
          count: 42,
          active: true,
          tags: ['tag1', 'tag2'],
          metadata: { author: 'Jane Doe', version: '2.1' },
        }
        const quoteNonStandardYaml = true
        const result = f.createFrontmatterTextArray(attributes, quoteNonStandardYaml)
        expect(result).toEqual([
          `title: ${f.quoteText('Complex Title')}`,
          'count: 42',
          'active: true',
          'tags:\n  - tag1\n  - tag2',
          'metadata:\n  author: Jane Doe\n  version: 2.1',
        ])
      })
    })

    describe('updateFrontMatterVars()', () => {
      /**
       * Test that updateFrontMatterVars correctly updates existing attributes.
       */
      test('should update existing attribute values', () => {
        const note = new Note({
          content: '---\ntitle: foo\nbar: baz\n---\n',
          paragraphs: [
            { type: 'separator', content: '---', lineIndex: 0 },
            { content: 'title: foo', lineIndex: 1 },
            { content: 'bar: baz', lineIndex: 2 },
            { type: 'separator', content: '---', lineIndex: 3 },
          ],
          title: 'foo',
        })
        // Update the "bar" attribute to a new value 'foo'.
        const result = f.updateFrontMatterVars(note, { title: 'foo', bar: 'foo' })
        expect(result).toEqual(true)
        const barParagraph = note.paragraphs.find((p) => p.content.startsWith('bar:'))
        expect(barParagraph).toBeDefined()
        expect(barParagraph.content).toEqual('bar: foo')
      })

      /**
       * Test that updateFrontMatterVars adds new attributes not present in the original frontmatter.
       */
      test('should add new attributes that did not exist before', () => {
        const note = new Note({
          content: '---\ntitle: foo\nbar: baz\n---\n',
          paragraphs: [
            { type: 'separator', content: '---', lineIndex: 0 },
            { content: 'title: foo', lineIndex: 1 },
            { content: 'bar: baz', lineIndex: 2 },
            { type: 'separator', content: '---', lineIndex: 3 },
          ],
          title: 'foo',
        })
        // Add a new attribute 'sam' along with existing attributes
        const result = f.updateFrontMatterVars(note, { title: 'foo', bar: 'baz', sam: 'boy' })
        expect(result).toEqual(true)
        const samParagraph = note.paragraphs.find((p) => p.content.startsWith('sam:'))
        expect(samParagraph).toBeDefined()
        expect(samParagraph.content).toEqual('sam: boy')
      })

      /**
       * Test that updateFrontMatterVars removes attributes not present in the new set, except for 'title'.
       */
      test('should remove attributes not present in newAttributes (but not title)', () => {
        const note = new Note({
          content: '---\ntitle: foo\nbar: baz\nold: remove_me\n---\n',
          paragraphs: [
            { type: 'separator', content: '---', lineIndex: 0 },
            { content: 'title: foo', lineIndex: 1 },
            { content: 'bar: baz', lineIndex: 2 },
            { content: 'old: remove_me', lineIndex: 3 },
            { type: 'separator', content: '---', lineIndex: 4 },
          ],
          title: 'foo',
        })
        // Update with only 'title' and 'bar' so 'old' should be removed.
        const result = f.updateFrontMatterVars(note, { title: 'foo', bar: 'baz' }, true)
        expect(result).toEqual(true)
        const oldParagraph = note.paragraphs.find((p) => p.content.startsWith('old:'))
        expect(oldParagraph).toBeUndefined()
        const titleParagraph = note.paragraphs.find((p) => p.content.startsWith('title:'))
        expect(titleParagraph).toBeDefined()
        expect(titleParagraph.content).toEqual('title: foo')
      })
    })
  })
})
