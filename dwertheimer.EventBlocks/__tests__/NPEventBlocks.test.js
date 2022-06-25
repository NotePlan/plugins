// Jest testing docs: https://jestjs.io/docs/using-matchers
/* global describe, test, jest, expect, beforeEach, beforeAll */

import * as mainFile from '../src/NPEventBlocks'
import { copyObject } from '@helpers/dev'

import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
})

beforeEach(() => {
  const paragraphs = [
    new Paragraph({ type: 'title', content: 'theTitle', headingLevel: 1, indents: 0, lineIndex: 0 }),
    new Paragraph({ type: 'text', content: 'line 2', headingLevel: 1, indents: 0, lineIndex: 1 }),
    new Paragraph({ type: 'empty', content: '', headingLevel: 1, indents: 0, lineIndex: 2 }),
    new Paragraph({ type: 'text', content: 'line 3', headingLevel: 1, indents: 0, lineIndex: 3 }),
  ]
  Editor.note = new Note({ paragraphs })
})

describe('dwertheimer.EventBlocks' /* pluginID */, () => {
  describe('NPPluginMain' /* file */, () => {
    describe('createEvents' /* function */, () => {
      test('should create events', () => {
        const ret = mainFile.createEvents('theTitle', 'no')
      })
    })
    /*
     * findHeading()
     */
    describe('findHeading()' /* function */, () => {
      /* template:
      test('should XXX', () => {
        const spy = jest.spyOn(CommandBar, 'prompt')
        const result = mainFile.findHeading()
        expect(result).toEqual(true)
	expect(spy).toHaveBeenCalledWith()
        spy.mockRestore()
      })
      */
      test('should return a paragraph when matched', () => {
        const result = mainFile.findHeading(Editor.note, 'theTitle')
        expect(result).not.toEqual(null)
        expect(result.content).toEqual(`theTitle`)
      })
      test('should return null when not matched', () => {
        const result = mainFile.findHeading(Editor.note, 'NoTitleMatch')
        expect(result).toEqual(null)
      })
    })
    /*
     * getBlockUnderHeading()
     */
    describe('getBlockUnderHeading()' /* function */, () => {
      /* template:
      test('should XXX', () => {
        const spy = jest.spyOn(CommandBar, 'prompt')
        const result = mainFile.getBlockUnderHeading()
        expect(result).toEqual(true)
	expect(spy).toHaveBeenCalledWith()
        spy.mockRestore()
      })
      */
      test('should return block when passed a string', () => {
        const result = mainFile.getBlockUnderHeading(Editor.note, 'theTitle')
        expect(result.length).toEqual(2)
        expect(result[0].content).toEqual(`theTitle`)
        expect(result[1].content).toEqual(`line 2`)
      })
      test('should return block when passed a paragraph', () => {
        const result = mainFile.getBlockUnderHeading(Editor.note, Editor.note.paragraphs[0])
        expect(result.length).toEqual(2)
        expect(result[0].content).toEqual(`theTitle`)
        expect(result[1].content).toEqual(`line 2`)
      })
    })
  })
})
