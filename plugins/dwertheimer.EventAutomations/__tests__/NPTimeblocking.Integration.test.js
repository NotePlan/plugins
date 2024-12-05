// @flow
// Jest testing docs: https://jestjs.io/docs/using-matchers
/* global describe, test, jest, expect, beforeAll */

// Note: expect(spy).toHaveBeenNthCalledWith(2, expect.stringMatching(/ERROR/))

import moment from 'moment'
import * as mainFile from '../src/NPTimeblocking'
import * as configFile from '../src/config'
import { filenameDateString, unhyphenatedDate } from '@helpers/dateTime'

import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph /*, mockWasCalledWithString */ } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = {
    log: jest.fn(),
    // eslint-disable-next-line no-console
    debug: console.debug, //these will pass through
    // eslint-disable-next-line no-console
    trace: console.trace,
    // map other methods that you want to use like console.table
  }
  DataStore.settings['_logLevel'] = 'none' // change to DEBUG to see more output
  DataStore.preference = () => '🕑' // 'timeblockTextMustContainString'
})

const ISOToday = moment().format('YYYY-MM-DD')
const filenameToday = `${filenameDateString(new Date())}.md`

const paragraphs = [new Paragraph({ content: 'line1' }), new Paragraph({ content: 'line2' })]
const note = new Note({ paragraphs })
note.filename = `${unhyphenatedDate(new Date())}.md`
Editor.note = note
Editor.filename = note.filename

describe('dwertheimer.EventAutomations' /* pluginID */, () => {
  /*
   * insertTodosAsTimeblocks()
   */
  describe('insertTodosAsTimeblocks() Integration Test' /* function */, () => {
    // INTEGRATION TEST
    test('should pe', async () => {
      const oldSettings = DataStore.settings
      let config = configFile.getTimeBlockingDefaults()
      config = {
        ...config,
        nowStrOverride: '00:00',
        workDayStart: '00:00',
        intervalMins: 5,
        defaultDuration: 5,
        mode: 'BY_TIMEBLOCK_TAG',
        timeblockTextMustContainString: '🕑',
        includeLinks: 'OFF',
        _logLevel: 'DEBUG',
      }
      const editorNote = new Note({
        title: ISOToday,
        filename: filenameToday,
        type: 'Calendar',
        paragraphs: [
          {
            content: '---',
            rawContent: '---',
            type: 'separator',
            heading: '',
            headingLevel: -1,
            lineIndex: 0,
            isRecurring: false,
            indents: 0,
            noteType: 'Calendar',
          },
          {
            content: 'triggers: onEditorWillSave => dwertheimer.EventAutomations.onEditorWillSave',
            rawContent: 'triggers: onEditorWillSave => dwertheimer.EventAutomations.onEditorWillSave',
            type: 'text',
            heading: '',
            headingLevel: -1,
            lineIndex: 1,
            isRecurring: false,
            indents: 0,
            noteType: 'Calendar',
          },
          {
            content: '---',
            rawContent: '---',
            type: 'separator',
            heading: '',
            headingLevel: -1,
            lineIndex: 2,
            isRecurring: false,
            indents: 0,
            noteType: 'Calendar',
          },
          {
            content: '',
            rawContent: '',
            type: 'empty',
            heading: '',
            headingLevel: -1,
            lineIndex: 3,
            isRecurring: false,
            indents: 0,
            noteType: 'Calendar',
          },
          {
            content: 'Do something #home ',
            rawContent: '* Do something #home ',
            type: 'open',
            heading: '',
            headingLevel: -1,
            lineIndex: 4,
            isRecurring: false,
            indents: 0,
            noteType: 'Calendar',
          },
          {
            content: '5-6:30pm #home 🕑',
            rawContent: '+ 5-6:30pm #home 🕑',
            type: 'checklist',
            heading: '',
            headingLevel: -1,
            lineIndex: 5,
            isRecurring: false,
            indents: 0,
            noteType: 'Calendar',
          },
          {
            content: '',
            rawContent: '',
            type: 'empty',
            heading: '',
            headingLevel: -1,
            lineIndex: 6,
            isRecurring: false,
            indents: 0,
            noteType: 'Calendar',
          },
        ],
      })
      global.Editor = { ...global.Editor, ...editorNote }
      DataStore.settings = config
      global.Editor.note = global.Editor
      const backlinksNote = new Note({
        type: 'note',
        content: '20230516.md',
        rawContent: '20230516.md',
        prefix: '',
        lineIndex: 0,
        date: '2023-05-16T07:00:00.000Z',
        heading: '',
        headingLevel: 0,
        isRecurring: false,
        indents: 0,
        filename: '20230516.md',
        noteType: 'Calendar',
        linkedNoteTitles: [],
        subItems: [
          {
            type: 'title',
            content: '>⭐️ Tasks<',
            rawContent: '# >⭐️ Tasks<',
            prefix: '# ',
            contentRange: {},
            lineIndex: 6,
            date: `${ISOToday}T07:00:00.000Z`,
            heading: '',
            headingLevel: 0,
            isRecurring: false,
            indents: 0,
            filename: '20230516.md',
            noteType: 'Calendar',
            linkedNoteTitles: [],
            subItems: [],
            referencedBlocks: [],
            note: {},
          },
          {
            type: 'open',
            content: `Make bible video samples >${ISOToday} ^0v7523`,
            blockId: '^0v7523',
            rawContent: `* Make bible video samples >${ISOToday} ^0v7523`,
            prefix: '* ',
            contentRange: {},
            lineIndex: 7,
            date: `${ISOToday}T07:00:00.000Z`,
            heading: '>⭐️ Tasks<',
            headingRange: {},
            headingLevel: 2,
            isRecurring: false,
            indents: 0,
            filename: '20230516.md',
            noteType: 'Calendar',
            linkedNoteTitles: [],
            subItems: [],
            referencedBlocks: [],
            note: {},
          },
        ],
        referencedBlocks: [],
      })
      backlinksNote.note = backlinksNote
      global.Editor.note.backlinks = [backlinksNote]
      // const spy = jest.spyOn(global.Editor, 'insertParagraph')
      await mainFile.insertTodosAsTimeblocks()
      // insertParagraph doesn't work properly because it happens in the mock
      // $FlowIgnore - jest doesn't know about this param
      // expect(spy.mock.lastCall[1]).toEqual(`No todos/references marked for this day!`)
      // spy.mockRestore()
      DataStore.settings = oldSettings
    })
  })
})
