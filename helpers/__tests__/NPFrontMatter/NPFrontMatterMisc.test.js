/* global describe, test, expect, beforeAll */

import { CustomConsole } from '@jest/console'
import * as f from '../../NPFrontMatter'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter, Note, Paragraph } from '@mocks/index'

const PLUGIN_NAME = `helpers`
const FILENAME = `NPFrontMatterMisc`

beforeAll(() => {
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'none'
})

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    describe('getFrontmatterParagraphs()', () => {
      test('should return false if no frontmatter', () => {
        const note = new Note({ paragraphs: [{ content: 'No frontmatter here' }] })
        const result = f.getFrontmatterParagraphs(note)
        expect(result).toEqual(false)
      })

      test('should return frontmatter paragraphs', () => {
        const note = new Note({
          paragraphs: [
            { type: 'separator', content: '---' },
            { content: 'title: Test' },
            { content: 'author: John Doe' },
            { type: 'separator', content: '---' },
            { content: 'Body content' },
          ],
        })
        const result = f.getFrontmatterParagraphs(note, true)
        expect(result.length).toEqual(4)
        expect(result[0].content).toEqual('---')
        expect(result[1].content).toEqual('title: Test')
        expect(result[2].content).toEqual('author: John Doe')
        expect(result[3].content).toEqual('---')
      })
    })

    describe('endOfFrontmatterLineIndex()', () => {
      test('should return false if no frontmatter', () => {
        const note = new Note({ paragraphs: [{ content: 'No frontmatter here' }] })
        const result = f.endOfFrontmatterLineIndex(note)
        expect(result).toEqual(false)
      })

      test('should return the index of the closing separator', () => {
        const note = new Note({
          paragraphs: [
            { type: 'separator', content: '---' },
            { content: 'title: Test' },
            { content: 'author: John Doe' },
            { type: 'separator', content: '---' },
            { content: 'Body content' },
          ],
        })
        const result = f.endOfFrontmatterLineIndex(note)
        expect(result).toEqual(3)
      })
    })

    describe('isTriggerLoop()', () => {
      test('should return false if no recent update', () => {
        const note = new Note({ versions: [] })
        const result = f.isTriggerLoop(note)
        expect(result).toEqual(false)
      })

      test('should return true if the time since the last document write is less than the minimum time required', () => {
        const note = new Note({ versions: [{ date: Date.now() - 1000 }] })
        const result = f.isTriggerLoop(note, 2000)
        expect(result).toEqual(true)
      })
    })

    describe('getBody()', () => {
      test('should return the body of the note without frontmatter', () => {
        const text = '---\ntitle: Test\n---\nBody content'
        const result = f.getBody(text)
        expect(result).toEqual('Body content')
      })

      test('should return the full text if no frontmatter', () => {
        const text = 'No frontmatter here'
        const result = f.getBody(text)
        expect(result).toEqual('No frontmatter here')
      })
    })

    describe('isValidYamlContent()', () => {
      test('should return false for empty content', () => {
        const result = f.isValidYamlContent('')
        expect(result).toBe(false)
      })

      test('should return false for whitespace only content', () => {
        const result = f.isValidYamlContent('   \n  \t  \n')
        expect(result).toBe(false)
      })

      test('should return true for simple key-value pairs', () => {
        const result = f.isValidYamlContent('title: My Note')
        expect(result).toBe(true)
      })

      test('should return true for keys with hyphens', () => {
        const result = f.isValidYamlContent('note-tag: #CTI')
        expect(result).toBe(true)
      })

      test('should return true for keys with spaces', () => {
        const result = f.isValidYamlContent('my key: value')
        expect(result).toBe(true)
      })

      test('should return true for keys with hyphens and spaces', () => {
        const result = f.isValidYamlContent('note-tag with spaces: #CTI')
        expect(result).toBe(true)
      })

      test('should return true for keys with blank values', () => {
        const result = f.isValidYamlContent('title:')
        expect(result).toBe(true)
      })

      test('should return true for keys with blank values and spaces', () => {
        const result = f.isValidYamlContent('title: ')
        expect(result).toBe(true)
      })

      test('should return true for list items', () => {
        const result = f.isValidYamlContent('- item 1\n- item 2')
        expect(result).toBe(true)
      })

      test('should return true for mixed content', () => {
        const result = f.isValidYamlContent('title: My Note\nnote-tag: #CTI\n- item 1')
        expect(result).toBe(true)
      })

      test('should return false for invalid content', () => {
        const result = f.isValidYamlContent('**bold text**')
        expect(result).toBe(false)
      })

      test('should return false for content without colons', () => {
        const result = f.isValidYamlContent('just some text')
        expect(result).toBe(false)
      })

      test('should return false for content with colon but no key', () => {
        const result = f.isValidYamlContent(': value')
        expect(result).toBe(false)
      })

      test('should return true for complex real-world examples', () => {
        const yamlContent = `title: Meeting Note
note-tag: #meeting
my key: value
empty-field:
list-items:
  - item 1
  - item 2`
        const result = f.isValidYamlContent(yamlContent)
        expect(result).toBe(true)
      })
    })

    describe('hasTemplateTagsInFM()', () => {
      test('should return true if frontmatter contains template tags', () => {
        const fmText = '---\ntitle: <% template %>\n---'
        const result = f.hasTemplateTagsInFM(fmText)
        expect(result).toEqual(true)
      })

      test('should return false if frontmatter does not contain template tags', () => {
        const fmText = '---\ntitle: Test\n---'
        const result = f.hasTemplateTagsInFM(fmText)
        expect(result).toEqual(false)
      })
    })
  })
})
