/* global describe, test, expect, beforeAll */

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
      test('should return false if there is no frontmatter', () => {
        const text = 'foo: bar'
        const result = f.hasFrontMatter(text)
        expect(result).toEqual(false)
      })
    })

    describe('noteHasFrontMatter()', () => {
      test('should return true if there is frontmatter', () => {
        const note = new Note({
          paragraphs: [new Paragraph({ type: 'separator', content: '---' }), new Paragraph({ content: 'bar' }), new Paragraph({ type: 'separator', content: '---' })],
        })
        const result = f.noteHasFrontMatter(note)
        expect(result).toEqual(true)
      })
      test('should return false if there is no frontmatter', () => {
        const note = new Note({ content: 'foo: bar' })
        const result = f.noteHasFrontMatter(note)
        expect(result).toEqual(false)
      })
    })
  })
})
