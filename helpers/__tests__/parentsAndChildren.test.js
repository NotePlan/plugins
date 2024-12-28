/* global describe, expect, test, beforeAll, beforeEach, it */
// import moment from 'moment'
import { CustomConsole } from '@jest/console' // see note below
import * as pac from '../parentsAndChildren'
import { clo, logDebug, logInfo } from '../dev'
// import { paragraphMatches } from '../NPParagraph'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph, simpleFormatter } from '@mocks/index'

let globalNote // use this to test with semi-real Note+paragraphs

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.Note = Note
  global.Paragraph = Paragraph
  global.NotePlan = new NotePlan()
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging | none for quiet
})

beforeEach(() => {
  const paragraphs = [
    {
      content: 'Call Allianz 1-800-334-7525',
      rawContent: '* Call Allianz 1-800-334-7525',
      type: 'open',
      heading: '',
      headingLevel: -1,
      lineIndex: 0,
      isRecurring: false,
      indents: 0,
      noteType: 'Calendar',
    },
    {
      content: 'Change healthplan',
      rawContent: '* Change healthplan',
      type: 'open',
      heading: '',
      headingLevel: -1,
      lineIndex: 1,
      isRecurring: false,
      indents: 0,
      noteType: 'Calendar',
    },
    {
      content: '1This is a top task',
      rawContent: '* 1This is a top task',
      type: 'open',
      heading: '',
      headingLevel: -1,
      lineIndex: 2,
      isRecurring: false,
      indents: 0,
      noteType: 'Calendar',
    },
    {
      content: '2This is indented under it',
      rawContent: '\t* 2This is indented under it',
      type: 'open',
      heading: '',
      headingLevel: -1,
      lineIndex: 3,
      isRecurring: false,
      indents: 1,
      noteType: 'Calendar',
    },
    {
      content: '3 text under the 1 top task',
      rawContent: '\t\t3 text under the 1 top task',
      type: 'text',
      heading: '',
      headingLevel: -1,
      lineIndex: 4,
      isRecurring: false,
      indents: 2,
      noteType: 'Calendar',
    },
    {
      content: '4 this is under 2 also (last line)',
      rawContent: '\t\t* 4 this is under 2 also (last line)',
      type: 'open',
      heading: '',
      headingLevel: -1,
      lineIndex: 5,
      isRecurring: false,
      indents: 2,
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
  ]
  paragraphs[0].children = () => []
  paragraphs[1].children = () => []
  paragraphs[2].children = () => [paragraphs[3], paragraphs[4], paragraphs[5]]
  paragraphs[3].children = () => [paragraphs[4], paragraphs[5]]
  paragraphs[4].children = () => []
  paragraphs[5].children = () => []
  paragraphs[6].children = () => []
  globalNote = new Note({ paragraphs })
})

// mimicking a project note
let paragraphs = [
  new Paragraph({ type: 'title', content: 'theTitle', headingLevel: 1, indents: 0, lineIndex: 0 }),
  new Paragraph({ type: 'text', content: 'line 2', headingLevel: 1, indents: 0, lineIndex: 1 }),
  new Paragraph({ type: 'text', content: 'line 3 (child of 2)', headingLevel: 1, indents: 1, lineIndex: 2 }),
  new Paragraph({ type: 'open', content: 'task on line 4', headingLevel: 1, indents: 0, lineIndex: 3 }),
  new Paragraph({ type: 'empty', content: '', headingLevel: 1, indents: 0, lineIndex: 4 }),
  new Paragraph({ type: 'separator', content: '---', lineIndex: 5 }),
  new Paragraph({ type: 'title', content: 'Done', headingLevel: 2, indents: 0, lineIndex: 6 }),
  new Paragraph({ type: 'done', content: 'done task on line 7', headingLevel: 2, indents: 0, lineIndex: 7 }),
  new Paragraph({ type: 'done', content: 'done task on line 8', headingLevel: 2, indents: 0, lineIndex: 8 }),
  new Paragraph({ type: 'empty', content: '', headingLevel: 2, indents: 0, lineIndex: 9 }),
  new Paragraph({ type: 'title', content: 'Cancelled', headingLevel: 2, indents: 0, lineIndex: 10 }),
  new Paragraph({ type: 'cancelled', content: 'cancelled task under Cancelled', headingLevel: 2, indents: 0, lineIndex: 11 }),
  new Paragraph({ type: 'text', content: 'line under Cancelled', headingLevel: 2, indents: 0, lineIndex: 12 }),
  new Paragraph({ type: 'empty', content: '', headingLevel: 2, indents: 0, lineIndex: 13 }),
]
Editor.note = new Note({ paragraphs, type: 'Notes' })
// Note: This used to be set in a
//   beforeEach(() => {
//     ...
//   })
// block, but now need to override it for some tests.

/*
 * getParagraphParentsOnly()
 */
describe('getParagraphParentsOnly', () => {
  it('should return an array of parent paragraphs with their children - Test case 1', () => {
    const paragraphs1 = [
      { lineIndex: 0, indents: 0, children: () => [] },
      { lineIndex: 1, indents: 1, children: () => [] },
      { lineIndex: 2, indents: 1, children: () => [] },
      { lineIndex: 3, indents: 0, children: () => [] },
    ]
    paragraphs1[0].children = () => [paragraphs1[1], paragraphs1[2]]
    const result1 = pac.getParagraphParentsOnly(paragraphs1)
    expect(result1.length).toEqual(4)
    expect(result1[0].parent.lineIndex).toEqual(0)
    expect(result1[0].children.length).toEqual(2)
    expect(result1[0].children[0].lineIndex).toEqual(1)
    expect(result1[0].children[1].lineIndex).toEqual(2)
    expect(result1[3].parent.lineIndex).toEqual(3)
    expect(result1[1].children.length).toEqual(0)
  })
  it('should return the same number of items it received', () => {
    const result = pac.getParagraphParentsOnly(globalNote.paragraphs)
    expect(result.length).toEqual(globalNote.paragraphs.length) // one result for each paragraph
  })
  it('should deal properly with multiple indents', () => {
    const result = pac.getParagraphParentsOnly(globalNote.paragraphs)
    expect(result[0].children.length).toEqual(0)
    expect(result[1].children.length).toEqual(0)
    expect(result[2].children.length).toEqual(1)
    expect(result[3].children.length).toEqual(2)
    expect(result[4].children.length).toEqual(0)
    expect(result[5].children.length).toEqual(0)
  })
  it('should include text under tasks', () => {
    const result = pac.getParagraphParentsOnly(globalNote.paragraphs)
    expect(result[3].children[0].type).toEqual('text') // one result for each paragraph
  })
  it('should include text under tasks one parent only', () => {
    const result = pac.getParagraphParentsOnly([globalNote.paragraphs[3]])
    expect(result[0].children[0].type).toEqual('text') // one result for each paragraph
  })
})

/*
 * removeParentsWhoAreChildren()
 */
describe('removeParentsWhoAreChildren()' /* function */, () => {
  test('base case - should remove child from parents and return an array of only parents', () => {
    const parents = [
      { parent: { lineIndex: 0, indents: 0, children: () => [] }, children: [] },
      { parent: { lineIndex: 1, indents: 1, children: () => [] }, children: [] },
    ]
    parents[0].children = [parents[1].parent]

    const result = pac.removeParentsWhoAreChildren(parents)
    expect(result.length).toEqual(1)
    expect(result[0].parent.lineIndex).toEqual(0)
  })
  test('deal with real-world paragraph cases', () => {
    const parents = pac.getParagraphParentsOnly(globalNote.paragraphs) // this is tested above
    const result = pac.removeParentsWhoAreChildren(parents)
    expect(result.length).toEqual(globalNote.paragraphs.length - 3) // remove two parents and one empty
  })
})

/*
 * getChildParas()
 */
describe('getChildParas', () => {
  it('should return an array of children paragraphs - Test case 1: No children', () => {
    const para1 = { lineIndex: 1, indents: 0, children: () => [] }
    const paragraphs1 = [para1]
    const result1 = pac.getChildParas(para1, paragraphs1)
    expect(result1).toEqual(expect.objectContaining([]))
  })

  it('should return an array of children paragraphs - Test case 2: One child with removeChildrenFromTopLevel as false', () => {
    const para2 = { lineIndex: 1, indents: 0, type: 'open', children: () => [{ lineIndex: 2, indents: 1, type: 'text', children: () => [] }] }
    const paragraphs2 = [para2, { lineIndex: 2, indents: 1, children: () => [], type: 'text' }]
    const result2 = pac.getChildParas(para2, paragraphs2)
    expect(result2.length).toEqual(1)
    expect(result2[0].lineIndex).toEqual(2)
  })

  it('should return an array of children paragraphs - Test case 4: Multiple children', () => {
    const para4 = {
      lineIndex: 1,
      indents: 0,
      children: () => [
        { lineIndex: 2, indents: 1, children: () => [] },
        { lineIndex: 3, indents: 1, children: () => [] },
      ],
    }
    const paragraphs4 = [para4, { lineIndex: 2, indents: 1, children: () => [] }, { lineIndex: 3, indents: 1, children: () => [] }]
    const result4 = pac.getChildParas(para4, paragraphs4)
    expect(result4.length).toEqual(2)
    expect(result4[0].lineIndex).toEqual(2)
    // Add similar it() statements for other test cases
  })

  it('should work for complex multi-indent case', () => {
    const para = globalNote.paragraphs[2]
    const result = pac.getChildParas(para, globalNote.paragraphs)
    expect(result.length).toEqual(1)
    expect(result[0].lineIndex).toEqual(3)
  })

  it('should return an array of children paragraphs - Test case 5: Multiple children with removeChildrenFromTopLevel as true', () => {
    const paras5 = [
      {
        type: 'done',
        content: '5 done',
        rawContent: '\t* [x] 5 done',
        prefix: '* [x] ',
        contentRange: {},
        lineIndex: 4,
        heading: '',
        headingLevel: -1,
        isRecurring: false,
        indents: 1,
        filename: '20231202.md',
        noteType: 'Calendar',
        linkedNoteTitles: [],
        subItems: [],
        referencedBlocks: [],
        note: {},
        children: () => [],
      },
      {
        type: 'checklist',
        content: '6further indented checkbox',
        rawContent: '\t\t+ 6further indented checkbox',
        prefix: '+ ',
        contentRange: {},
        lineIndex: 5,
        heading: '',
        headingLevel: -1,
        isRecurring: false,
        indents: 2,
        filename: '20231202.md',
        noteType: 'Calendar',
        linkedNoteTitles: [],
        subItems: [],
        referencedBlocks: [],
        note: {},
        children: () => [],
      },
      {
        type: 'text',
        content: "7 ok final - this is the problem cuz it's not a task",
        rawContent: "\t\t7 ok final - this is the problem cuz it's not a task",
        prefix: '',
        contentRange: {},
        lineIndex: 6,
        heading: '',
        headingLevel: -1,
        isRecurring: false,
        indents: 2,
        filename: '20231202.md',
        noteType: 'Calendar',
        linkedNoteTitles: [],
        subItems: [],
        referencedBlocks: [],
        note: {},
        children: () => [],
      },
      {
        type: 'text',
        content: '8 double final',
        rawContent: '\t\t\t8 double final',
        prefix: '',
        contentRange: {},
        lineIndex: 7,
        heading: '',
        headingLevel: -1,
        isRecurring: false,
        indents: 3,
        filename: '20231202.md',
        noteType: 'Calendar',
        linkedNoteTitles: [],
        subItems: [],
        referencedBlocks: [],
        note: {},
        children: () => [],
      },
    ]
    paras5[0].children = () => paras5.slice(1)
    const result5 = pac.getChildParas(paras5[0], paras5, false)
    expect(result5.length).toEqual(2)
    expect(result5[0].lineIndex).toEqual(5)
    const result6 = pac.getChildParas(paras5[2], paras5, false)
    expect(result6.length).toEqual(1)
    expect(result6[0].lineIndex).toEqual(7)
  })

  describe('getIndentedNonTaskLinesUnderPara', () => {
    // Mock data
    const mockParagraphs = [
      { lineIndex: 1, indents: 0, type: 'text' },
      { lineIndex: 2, indents: 1, type: 'text' },
      { lineIndex: 3, indents: 1, type: 'open' },
      { lineIndex: 4, indents: 2, type: 'text' },
      { lineIndex: 5, indents: 2, type: 'text' },
      { lineIndex: 6, indents: 3, type: 'text' },
    ]
    it('should return an array of indented paragraphs underneath the given paragraph', () => {
      const para = { lineIndex: 3, indents: 1 }
      const result = pac.getIndentedNonTaskLinesUnderPara(para, mockParagraphs)
      expect(result).toEqual([
        { lineIndex: 4, indents: 2, type: 'text' },
        { lineIndex: 5, indents: 2, type: 'text' },
        { lineIndex: 6, indents: 3, type: 'text' },
      ])
    })

    it('should return an empty array if no indented paragraphs are found', () => {
      const para = { lineIndex: 6, indents: 3 }
      const result = pac.getIndentedNonTaskLinesUnderPara(para, mockParagraphs)
      expect(result).toEqual([])
    })

    it('should handle the case where the given paragraph is the last one in the array', () => {
      const para = { lineIndex: 6, indents: 3 }
      const result = pac.getIndentedNonTaskLinesUnderPara(para, mockParagraphs)
      expect(result).toEqual([])
    })

    it('should handle the case where the given paragraph is the last one in the array', () => {
      const para = { lineIndex: 6, indents: 3 }
      const result = pac.getIndentedNonTaskLinesUnderPara(para, mockParagraphs)
      expect(result).toEqual([])
    })

    it('should handle the case where the given paragraph has no indented paragraphs underneath', () => {
      const para = { lineIndex: 4, indents: 2 }
      const result = pac.getIndentedNonTaskLinesUnderPara(para, mockParagraphs)
      expect(result).toEqual([])
    })

    it('should handle complex real-world data', () => {
      const para = globalNote.paragraphs[3]
      const result = pac.getIndentedNonTaskLinesUnderPara(para, globalNote.paragraphs)
      expect(result).toEqual([globalNote.paragraphs[4]])
    })
  })
})
