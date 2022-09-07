// Jest testing docs: https://jestjs.io/docs/using-matchers
/* global describe, test, beforeEach, beforeAll */

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
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging
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
  })
})
