/* global describe, test, expect, beforeAll */
// @author @dwertheimer

import { CustomConsole } from '@jest/console' // see note below
import * as f from '../NPFrontMatter'
import {
  // Calendar,
  Clipboard,
  CommandBar,
  DataStore,
  Editor,
  NotePlan,
  simpleFormatter,
  Note,
  Paragraph,
  // mockWasCalledWithString,
} from '@mocks/index'

const PLUGIN_NAME = `helpers`
const FILENAME = `NPFrontMatter`

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

/* Samples:
expect(result).toMatch(/someString/)
expect(result).not.toMatch(/someString/)
expect(result).toEqual([])
import { mockWasCalledWith } from '@mocks/mockHelpers'
      const spy = jest.spyOn(console, 'log')
      const result = mainFile.getConfig()
      expect(mockWasCalledWith(spy, /config was empty/)).toBe(true)
      spy.mockRestore()

      test('should return the command object', () => {
        const result = f.getPluginCommands({ 'plugin.commands': [{ a: 'foo' }] })
        expect(result).toEqual([{ a: 'foo' }])
      })
*/

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    /*
     * hasFrontMatter()
     */
    describe('hasFrontMatter()' /* function */, () => {
      test('should return true if there is frontmatter', () => {
        const text = '---\nfoo: bar\n---\n'
        const result = f.hasFrontMatter(text)
        expect(result).toEqual(true)
      })
      test('should return false if there is nofrontmatter', () => {
        const text = 'foo: bar'
        const result = f.hasFrontMatter(text)
        expect(result).toEqual(false)
      })
    })

    /*
     * noteHasFrontMatter()
     */
    describe('noteHasFrontMatter()' /* function */, () => {
      test('should return true if there is frontmatter', () => {
        const note = new Note({
          paragraphs: [new Paragraph({ type: 'separator', content: '---' }), new Paragraph({ content: 'bar' }), new Paragraph({ type: 'separator', content: '---' })],
        })
        const result = f.noteHasFrontMatter(note)
        expect(result).toEqual(true)
      })
      test('should return false if there is nofrontmatter', () => {
        const note = new Note({ content: 'foo: bar' })
        const result = f.noteHasFrontMatter(note)
        expect(result).toEqual(false)
      })
    })
    /*
     * getFrontMatterAttributes()
     */
    describe('getFrontMatterAttributes()' /* function */, () => {
      test('should return false if no frontmatter', () => {
        const result = f.getFrontMatterAttributes({ content: '' })
        expect(result).toEqual(false)
      })
      test('should return empty object if empty frontmatter', () => {
        const text = '---\n---\n'
        const result = f.getFrontMatterAttributes({ content: text })
        expect(result).toEqual({})
      })
      test('should return object with frontmatter vars and boolean values', () => {
        const text = '---\nfield1: true\nfield2: false\n---\n'
        const result = f.getFrontMatterAttributes({ content: text })
        expect(result).toEqual({ field1: true, field2: false })
      })
      test('should return object with frontmatter vars', () => {
        const text = '---\nfield1: true\nfield2: foo\n---\n'
        const result = f.getFrontMatterAttributes({ content: text })
        expect(result).toEqual({ field1: true, field2: 'foo' })
      })
    })

    /*
     * ensureFrontmatter()
     */
    describe('ensureFrontmatter()' /* function */, () => {
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
        const note = { content: '---\nfoo: bar\n---\n' }
        const result = f.ensureFrontmatter(note)
        expect(result).toEqual(true)
      })
      test('should return true if already has frontmatter but change title', () => {
        const note = { content: '---\ntitle: bar\n---\n' }
        const result = f.ensureFrontmatter(note, true, 'baz')
        expect(result).toEqual(true)
        expect(note.content).toMatch(/title: baz/)
      })
      test('should set note title if had no title', () => {
        const note = { content: '---\nsam: bar\n---\n' }
        const result = f.ensureFrontmatter(note, true, 'baz')
        expect(result).toEqual(true)
        expect(note.content).toMatch(/title: baz/)
      })
      test('should set empty frontmatter if Calendar note', () => {
        const note = new Note({ content: '', type: 'Calendar', paragraphs: [], title: '2022-01-01' })
        const result = f.ensureFrontmatter(note, false)
        expect(result).toEqual(true)
        expect(note.content).toMatch(/---\n---\n/)
      })
      test('should set note title in frontmatter if had title in document', () => {
        const note = new Note({ paragraphs: [{ content: 'foo', headingLevel: 1, type: 'title' }], content: '# foo' })
        const result = f.ensureFrontmatter(note)
        expect(result).toEqual(true)
        expect(note.content).toMatch(/title: foo/)
      })
      test('in project note, should gracefully add frontmatter even it does not have title and NP is seeing the ```mermaid', () => {
        const note = new Note({
          paragraphs: [{ content: '```mermaid', headingLevel: 0, type: 'text' }],
          content: 'foo\nbar',
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
    })

    /*
     * quoteText()
     */
    describe('quoteText()' /* function */, () => {
      test('should pass through text that should not be quoted', () => {
        const result = f.quoteText('foo')
        expect(result).toEqual('foo')
      })
      test('should pass through colons without spaces (e.g. url)', () => {
        const result = f.quoteText('http://www.google.com')
        expect(result).toEqual('http://www.google.com')
      })
      test('should pass through text already quoted', () => {
        const result = f.quoteText('"foo bar"')
        expect(result).toEqual('"foo bar"')
      })
      test('should quote text with colon+space', () => {
        const result = f.quoteText('foo: bar')
        expect(result).toEqual('"foo: bar"')
      })
      test('should quote text with empty string value', () => {
        const result = f.quoteText('')
        expect(result).toEqual('""')
      })
      test('should quote text with leading hashtag', () => {
        const result = f.quoteText('#foo')
        expect(result).toEqual('"#foo"')
      })
      test('should not quote text with hashtag in the middle', () => {
        const result = f.quoteText('bar #foo')
        expect(result).toEqual('bar #foo')
      })
      test('should not quote hash with whitespace following (e.g. a comment that will get wiped out)', () => {
        const result = f.quoteText('# comment')
        expect(result).toEqual('# comment')
      })
    })
    /*
     * writeFrontMatter()
     */
    describe('writeFrontMatter()' /* function */, () => {
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
    /*
     * getFrontMatterParagraphs()
     */
    describe('getFrontMatterParagraphs()' /* function */, () => {
      test('should return false if there is no frontmatter (no paras)', () => {
        const note = new Note({ paragraphs: [], content: '' })
        const result = f.getFrontMatterParagraphs(note)
        expect(result).toEqual(false)
      })
      test('should return false if there is no frontmatter (first para not separator)', () => {
        const note = new Note({ paragraphs: [{ content: 'foo' }], content: '' })
        const result = f.getFrontMatterParagraphs(note)
        expect(result).toEqual(false)
      })
      test('should return false if frontmatter never closes', () => {
        const note = new Note({ paragraphs: [{ content: '---' }, { content: 'foo' }], content: '' })
        const result = f.getFrontMatterParagraphs(note)
        expect(result).toEqual(false)
      })
      test('should return a line of frontmatter', () => {
        const note = new Note({ paragraphs: [{ content: '---' }, { content: 'foo' }, { content: '---' }], content: '' })
        const result = f.getFrontMatterParagraphs(note)
        expect(result).toEqual([expect.objectContaining({ content: 'foo' })])
      })
      test('should return a line of frontmatter with separators', () => {
        const allParas = [{ content: '---' }, { content: 'foo' }, { content: '---' }]
        const note = new Note({ paragraphs: allParas, content: '' })
        const result = f.getFrontMatterParagraphs(note, true)
        expect(result).toEqual(allParas)
      })
    })

    /*
     * removeFrontMatter()
     */
    describe('removeFrontMatter()' /* function */, () => {
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

    /*
     * removeFrontMatterField()
     */
    describe('removeFrontMatterField()' /* function */, () => {
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

    /*
     * unsetFrontMatterFields()
     * Note: turning off these tests, as removing its function
     */
    // describe('unsetFrontMatterFields()' /* function */, () => {
    //   test('should return false if there is no frontmatter (no paras)', () => {
    //     const note = new Note({ paragraphs: [], content: '' })
    //     const result = f.unsetFrontMatterFields(note, 'fieldName') //, false)
    //     expect(result).toEqual(false)
    //   })
    //   test('should return false if there are matching fields but no frontmatter', () => {
    //     const allParas = [{ content: '# note title' }, { content: 'fieldName: value' }, { content: '+ checklist 1' }]
    //     let note = new Note({ paragraphs: allParas, content: '' })
    //     const result = f.unsetFrontMatterFields(note, 'fieldName') //, false)
    //     expect(result).toEqual(false)
    //   })
    //   test('should remove matching field from frontmatter but leave separators', () => {
    //     const allParas = [{ content: '---' }, { content: 'title: note title' }, { content: 'fieldName: value' }, { content: '---' }, { content: '+ checklist 1' }]
    //     let note = new Note({ paragraphs: allParas, content: '' })
    //     const result = f.unsetFrontMatterFields(note, 'fieldName') //, false)
    //     expect(result).toEqual(true)
    //     expect(note.paragraphs.length).toEqual(4)
    //     expect(note.paragraphs[0].content).toEqual(allParas[0].content)
    //     expect(note.paragraphs[1].content).toEqual(allParas[1].content)
    //     expect(note.paragraphs[2].content).toEqual(allParas[3].content)
    //     expect(note.paragraphs[3].content).toEqual(allParas[4].content)
    //   })
    //   test('should remove single matching field from frontmatter and also separators', () => {
    //     const allParas = [{ content: '---' }, { content: 'fieldName: value' }, { content: '---' }, { content: '+ checklist 1' }]
    //     let note = new Note({ paragraphs: allParas, content: '' })
    //     const result = f.unsetFrontMatterFields(note, 'fieldName') //, true)
    //     expect(result).toEqual(true)
    //     expect(note.paragraphs.length).toEqual(1)
    //     expect(note.paragraphs[0].content).toEqual(allParas[3].content)
    //   })
    //   test('should remove matching field from frontmatter and also separators, converting to Markdown type title', () => {
    //     const allParas = [{ content: '---' }, { content: 'fieldName: value' }, { content: 'title: note title' }, { content: '---' }, { content: '+ checklist 1' }]
    //     let note = new Note({ paragraphs: allParas, content: '' })
    //     const result = f.unsetFrontMatterFields(note, 'fieldName') //, true)
    //     expect(result).toEqual(true)
    //     expect(note.paragraphs.length).toEqual(2)
    //     expect(note.paragraphs[0].content).toEqual(`# note title`) // Note: change back to MD style
    //     expect(note.paragraphs[1].content).toEqual(allParas[4].content)
    //   })
    //   test('should remove three matching fields with different values from frontmatter but leave other field', () => {
    //     const allParas = [{ content: '---' }, { content: 'field_other: value1' }, { content: 'fieldName: this is, a, longer "value 1"' }, { content: '---' }]
    //     let note = new Note({ paragraphs: allParas, content: '' })
    //     const result = f.unsetFrontMatterFields(note, 'fieldName') //, true)
    //     expect(result).toEqual(true)
    //     expect(note.paragraphs.length).toEqual(3)
    //     expect(note.paragraphs[0]).toEqual(allParas[0].content)
    //     expect(note.paragraphs[1]).toEqual(allParas[2].content)
    //     expect(note.paragraphs[2]).toEqual(allParas[3].content)
    //   })
    // })

    /*
     * setFrontMatterVars()
     */
    describe('setFrontMatterVars()' /* function */, () => {
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

    /*
     * getTriggersByCommand()
     */
    describe('getTriggersByCommand()' /* function */, () => {
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

    /*
     * addTrigger()
     */
    describe('addTrigger()' /* function */, () => {
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

    /*
     * _getFMText()
     */
    describe('_getFMText()' /* function */, () => {
      test('should return blank string if blank note', () => {
        const result = f._getFMText('')
        expect(result).toEqual('')
      })
      test('should return blank string if no frontmatter', () => {
        const result = f._getFMText('this\nis\na test')
        expect(result).toEqual('')
      })
      test('should return blank string if incomplete frontmatter', () => {
        const result = f._getFMText('---\nis\na test')
        expect(result).toEqual('')
      })
      test('should return blank string if incomplete frontmatter2', () => {
        const result = f._getFMText('--\nis\na test\n--')
        expect(result).toEqual('')
      })
      test('should return frontmatter text even if blank', () => {
        const result = f._getFMText('---\n---\n')
        expect(result).toEqual('---\n---\n')
      })
      test('should return frontmatter text', () => {
        const result = f._getFMText('---\nfoo: bar\n---\n')
        expect(result).toEqual('---\nfoo: bar\n---\n')
      })
    })

    /*
     * _fixFrontmatter()
     */
    describe('_fixFrontmatter()' /* function */, () => {
      test('should not change text with no issues', () => {
        const before = `---\nfoo: bar\n---\n`
        const result = f._fixFrontmatter(before)
        expect(result).toEqual(before)
      })
      test('should not change text with no issues', () => {
        const before = `---\nfoo: bar\n---\n`
        const result = f._fixFrontmatter(before)
        expect(result).toEqual(before)
      })
      test('should change text with colon at end', () => {
        const before = `---\nfoo: bar:\n---\n`
        const result = f._fixFrontmatter(before)
        expect(result).toEqual(`---\nfoo: "bar:"\n---\n`)
      })
      test('should change text with colon space', () => {
        const before = `---\nfoo: bar: baz\n---\n`
        const result = f._fixFrontmatter(before)
        expect(result).toEqual(`---\nfoo: "bar: baz"\n---\n`)
      })
      test('should change text with hashtag', () => {
        const before = `---\nfoo: #bar\n---\n`
        const result = f._fixFrontmatter(before)
        expect(result).toEqual(`---\nfoo: "#bar"\n---\n`)
      })
      test('should change text with hashtag', () => {
        const before = `---\nfoo: @bar\n---\n`
        const result = f._fixFrontmatter(before)
        expect(result).toEqual(`---\nfoo: "@bar"\n---\n`)
      })
      test('should not touch indented text', () => {
        const indented = `---\ntitle: indented\nkey:\n - value1\n - value2\n---\n`
        const before = indented
        const result = f._fixFrontmatter(before)
        expect(result).toEqual(before)
      })
    })

    /*
     * _sanitizeFrontmatterText()
     */
    describe('_sanitizeFrontmatterText()' /* function */, () => {
      test('should do nothing if no frontmatter', () => {
        const result = f._sanitizeFrontmatterText('')
        expect(result).toEqual('')
      })
      test('should change text with colon at end', () => {
        const before = `---\nfoo: bar:\n---\n`
        const result = f._sanitizeFrontmatterText(before)
        expect(result).toEqual(`---\nfoo: "bar:"\n---\n`)
      })
      test('should change text with colon in middle of value', () => {
        const before = `---\nfoo: bar: bizzle\n---\n`
        const result = f._sanitizeFrontmatterText(before)
        expect(result).toEqual(`---\nfoo: "bar: bizzle"\n---\n`)
      })
      test('should change text with attag', () => {
        const before = `---\nfoo: @bar\n---\n`
        const result = f._sanitizeFrontmatterText(before)
        expect(result).toEqual(`---\nfoo: "@bar"\n---\n`)
      })
      test('should change text with hashtag', () => {
        const before = `---\nfoo: #bar\n---\n`
        const result = f._sanitizeFrontmatterText(before)
        expect(result).toEqual(`---\nfoo: "#bar"\n---\n`)
      })
      test('should not change comments (space after #) which will be wiped out later by fm()', () => {
        const before = `---\nfoo: # bar\n---\n`
        const result = f._sanitizeFrontmatterText(before)
        expect(result).toEqual(`---\nfoo: # bar\n---\n`)
      })
      // all other tests are done in _fixFrontmatter()
    })

    /*
     * getSanitizedFmParts()
     */
    describe('getSanitizedFmParts()' /* function */, () => {
      test('should make no changes if none are necessary', () => {
        const before = `---\nfoo: bar\n---\nbaz`
        const result = f.getSanitizedFmParts(before)
        const expected = { attributes: { foo: 'bar' }, body: 'baz', bodyBegin: 4, frontmatter: 'foo: bar' }
        expect(result).toEqual(expected)
      })
      test('should make change to sanitized @text and return legal value', () => {
        const before = `---\nfoo: @bar\n---\nbaz`
        const result = f.getSanitizedFmParts(before)
        const expected = { attributes: { foo: '@bar' }, body: 'baz', bodyBegin: 4, frontmatter: 'foo: "@bar"' }
        expect(result).toEqual(expected)
      })
      test('should make change to sanitized #text and return legal value', () => {
        const before = `---\nfoo: #bar\n---\nbaz`
        const result = f.getSanitizedFmParts(before)
        const expected = { attributes: { foo: '#bar' }, body: 'baz', bodyBegin: 4, frontmatter: 'foo: "#bar"' }
        expect(result).toEqual(expected)
      })
      // the other tests should be well covered by the underlying functions
    })

    /*
     * sanitizeFrontmatterInNote()
     */
    describe('sanitizeFrontmatterInNote()' /* function */, () => {
      test.skip('should do nothing if none are necesary', () => {
        const note = new Note({ content: 'baz' })
        const result = f.getSanitizedFrontmatterInNote(note)
        expect(result).toEqual(true)
      })
      test.skip('should do nothing if none are necesary', () => {
        const note = new Note({ content: '---\nfoo: bar\n---\nbaz' })
        const result = f.getSanitizedFrontmatterInNote(note)
        expect(result).toEqual(true)
      })
    })
    /*
     * formatTriggerString()
     */
    describe('formatTriggerString()' /* function */, () => {
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
    // moved from FrontMatterModule. Needs to be updated here
    describe('Frontmatter helpers', () => {
      test(`getAttributes(): should return attributes using getAttributes()`, () => {
        const data = `---\ntitle: Test Sample\nname: Mike Erickson\n---\n<%= name %>`
        const result = f.getAttributes(data)
        expect(typeof result).toEqual('object')
        expect(result?.title).toEqual('Test Sample')
        expect(result?.name).toEqual('Mike Erickson')
      })
      test(`getAttributes(): should return only non-template code when second param is true`, () => {
        const data = `---\ntitle: Test Sample\n<%- foo\nname: Mike Erickson\n---\n<%= name %>`
        const result = f.getAttributes(data, true)
        expect(typeof result).toEqual('object')
        expect(Object.keys(result).length).toEqual(2)
        expect(result?.title).toEqual('Test Sample')
        expect(result?.name).toEqual('Mike Erickson')
      })
      // moved from FrontMatterModule
      test(`getBody(): should return attributes using getBody()`, () => {
        const data = `---\ntitle: Test Sample\nname: Mike Erickson\n---\n<%= name %>`
        const result = f.getBody(data)
        expect(typeof result).toEqual('string')
        expect(result).toContain('<%= name %>')
        expect(result).not.toContain('title: Test Sample')
      })
    })
  })
})
