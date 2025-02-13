/* global describe, test, expect, beforeAll */

import { CustomConsole } from '@jest/console'
import * as f from '../../NPFrontMatter'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter, Note /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

const PLUGIN_NAME = `helpers`
const FILENAME = `NPFrontMatterTriggers`

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
    describe('getTriggersByCommand()', () => {
      test('should return empty object when no triggers', () => {
        const result = f.getTriggersByCommand([])
        expect(result).toEqual({})
      })
      test('should return single trigger', () => {
        const single = ['onEditorWillSave => np.test.onEditorWillSaveFunc']
        const result = f.getTriggersByCommand(single)
        expect(result).toEqual({ onEditorWillSave: [{ pluginID: 'np.test', commandName: 'onEditorWillSaveFunc' }] })
      })
      test('should return two different triggers', () => {
        const two = ['onEditorWillSave => np.test.onEditorWillSaveFunc', 'onOpen => np.test.onOpenFunc']
        const result = f.getTriggersByCommand(two)
        expect(result).toEqual({ onEditorWillSave: [{ pluginID: 'np.test', commandName: 'onEditorWillSaveFunc' }], onOpen: [{ pluginID: 'np.test', commandName: 'onOpenFunc' }] })
      })
      test('should work with plugin id with no periods', () => {
        const single = ['onEditorWillSave => test.onEditorWillSaveFunc']
        const result = f.getTriggersByCommand(single)
        expect(result).toEqual({ onEditorWillSave: [{ pluginID: 'test', commandName: 'onEditorWillSaveFunc' }] })
      })
    })

    describe('addTrigger()', () => {
      test('should throw an error if you tried to create not a legal trigger', () => {
        const note = new Note({ content: '', paragraphs: [], title: '' })
        expect(f.addTrigger(note, 'wrongFunction', 'foo', 'bar')).toEqual(false)
      })
      test('should add a single trigger to existing FM', () => {
        const note = new Note({
          content: '---\ntitle: foo\nbar: baz\n---\n',
          paragraphs: [{ type: 'separator', content: '---' }, { content: 'title: foo' }, { content: 'bar: baz' }, { type: 'separator', content: '---' }],
          title: 'foo',
        })
        const result = f.addTrigger(note, 'onOpen', 'foo', 'bar')
        expect(result).toEqual(true)
        expect(note.content).toMatch(/triggers: onOpen => foo.bar/)
      })
      test('should not add a trigger where it already exists in FM', () => {
        const note = new Note({
          content: '---\ntitle: foo\ntriggers: onOpen => foo.bar\nauthor: baz\n---\n',
          paragraphs: [
            { type: 'separator', content: '---' },
            { content: 'title: foo' },
            { content: 'triggers: onOpen => foo.bar' },
            { content: 'author: baz' },
            { type: 'separator', content: '---' },
          ],
          title: 'foo',
        })
        const result = f.addTrigger(note, 'onOpen', 'foo', 'bar')
        expect(result).toEqual(true)
        expect(note.paragraphs[2].content).toEqual('triggers: onOpen => foo.bar')
      })
      test('should deal gracefully adding trigger', () => {
        const note = new Note({
          type: 'Calendar',
          content: '* task on first line\n+ checklist on line two',
          paragraphs: [
            { type: 'todo', content: '* task on first line' },
            { type: 'checklist', content: '+ checklist on line two' },
          ],
          title: '',
        })
        const result = f.addTrigger(note, 'onEditorWillSave', 'jgclark.Dashboard', 'decideWhetherToUpdateDashboard')
        expect(result).toEqual(true)
        expect(note.paragraphs[0].content).toEqual('---')
        expect(note.paragraphs[1].content).toEqual('triggers: onEditorWillSave => jgclark.Dashboard.decideWhetherToUpdateDashboard')
        expect(note.paragraphs[2].content).toEqual('---')
      })
    })

    describe('formatTriggerString()', () => {
      test('should send back empty string if there is no trigger', () => {
        const result = f.formatTriggerString({})
        expect(result).toEqual('')
      })
      test('should work for one trigger', () => {
        const obj = { onEditorWillSave: [{ pluginID: 'np.test', commandName: 'onEditorWillSaveFunc' }] }
        const result = f.formatTriggerString(obj)
        expect(result).toEqual('onEditorWillSave => np.test.onEditorWillSaveFunc')
      })
      test('should work for two different triggers', () => {
        const obj = { onEditorWillSave: [{ pluginID: 'np.test', commandName: 'onEditorWillSaveFunc' }], onOpen: [{ pluginID: 'np.test', commandName: 'onOpenFunc' }] }
        const result = f.formatTriggerString(obj)
        expect(result).toEqual('onEditorWillSave => np.test.onEditorWillSaveFunc, onOpen => np.test.onOpenFunc')
      })
      test('should work for two different triggers of same type', () => {
        const obj = {
          onEditorWillSave: [
            { pluginID: 'np.test', commandName: 'onEditorWillSaveFunc' },
            { pluginID: 'np.test2', commandName: 'onEditorWillSaveFunc2' },
          ],
        }
        const result = f.formatTriggerString(obj)
        expect(result).toEqual('onEditorWillSave => np.test.onEditorWillSaveFunc, onEditorWillSave => np.test2.onEditorWillSaveFunc2')
      })
    })
  })
})
