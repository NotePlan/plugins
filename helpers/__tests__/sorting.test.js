/* globals describe, expect, test */
import { _ } from 'lodash'
import { Paragraph } from '../../__mocks__/Paragraph.mock'
import * as s from '../sorting'

// Jest suite
describe('sorting.js', () => {
  describe('caseInsensitiveCompare()', () => {
    test('should sorted default (caps first)', () => {
      const unsorted = ['ee', 'B', 'a', 'c', 'F', 'cc', 'D']
      const sortedCapsFirst = ['B', 'D', 'F', 'a', 'c', 'cc', 'ee']
      expect(unsorted.sort()).toEqual(sortedCapsFirst)
    })
    test('should sorted default (caps first)', () => {
      const unsorted = ['ee', 'B', 'a', 'c', 'F', 'cc', 'D']
      const sortedIgnoreCaps = ['a', 'B', 'c', 'cc', 'D', 'ee', 'F']
      expect(unsorted.sort(s.caseInsensitiveCompare)).toEqual(sortedIgnoreCaps)
    })
  })

  describe('firstValue()', () => {
    test('sorting - firstValue ', () => {
      expect(s.firstValue('string')).toEqual('string')
    })
    test('sorting - firstValue ', () => {
      expect(s.firstValue('StrinG')).toEqual('string')
    })
    test('sorting - firstValue ', () => {
      expect(s.firstValue(['StrinG', 'foo'])).toEqual('string')
    })
    test('sorting - firstValue ', () => {
      expect(s.firstValue(99)).toEqual(99)
    })
  })

  /*
     * fieldSorter()
       (indirectly testing fieldSorter which is hard to
        test because it returns a function - so it is getting exercised in sortListBy)
     */
  describe('fieldSorter()' /* function */, () => {
    test.skip('should do something', () => {
      const result = s.fieldSorter()
      expect(result).toEqual(true)
    })
  })

  /*
   * sortListBy()
   */
  describe('sortListBy()' /* function */, () => {
    test('should sort by alpha field ASC', () => {
      const a = { text: 'B' }
      const b = { text: 'A' }
      const list = [a, b]
      const result = s.sortListBy(list, 'text')
      expect(result).toEqual([b, a])
    })
    test('should sort by alpha field DESC', () => {
      const a = { text: 'B' }
      const b = { text: 'A' }
      const list = [a, b]
      const result = s.sortListBy(list, '-text')
      expect(result).toEqual([a, b])
    })
    test('should sort by object property n levels down', () => {
      const a = { text: 'B', level1: { level2: '3' } }
      const b = { text: 'C', level1: { level2: '5' } }
      const c = { text: 'A', level1: { level2: '1' } }
      const list = [a, b, c]
      const result = s.sortListBy(list, 'level1.level2')
      expect(result).toEqual([c, a, b])
    })
    test('should sort by object property n levels down in reverse', () => {
      const a = { text: 'B', level1: { level2: '3' } }
      const b = { text: 'C', level1: { level2: '5' } }
      const c = { text: 'A', level1: { level2: '1' } }
      const list = [a, b, c]
      const result = s.sortListBy(list, '-level1.level2')
      expect(result).toEqual([b, a, c])
    })
    test('should sort by numeric field DESC', () => {
      const a = { num: 2 }
      const b = { num: 1 }
      const list = [a, b]
      const result = s.sortListBy(list, '-num')
      expect(result).toEqual([a, b])
    })
    test('should sort by numeric field ASC', () => {
      const a = { num: 1 }
      const b = { num: 2 }
      const list = [a, b]
      const result = s.sortListBy(list, 'num')
      expect(result).toEqual([a, b])
    })
    test('should sort by numeric decimal field ASC', () => {
      const a = { num: 1.2 }
      const b = { num: 1.1 }
      const list = [a, b]
      const result = s.sortListBy(list, 'num')
      expect(result).toEqual([b, a])
    })
    test('should sort by numeric decimal field DESC', () => {
      const a = { num: 1.2 }
      const b = { num: 1.1 }
      const list = [a, b]
      const result = s.sortListBy(list, '-num')
      expect(result).toEqual([a, b])
    })
    test('should sort by negative numbers too', () => {
      const a = { num: 1 }
      const b = { num: 0 }
      const c = { num: -1 }
      const d = { num: -10 }
      const list = [a, b, c, d]
      const result = s.sortListBy(list, 'num')
      expect(result).toEqual([d, c, b, a])
    })
    test('should sort by negative numbers that *look* like strings!', () => {
      const a = { num: '1' }
      const b = { num: '0' }
      const c = { num: '-1' }
      const list = [a, b, c]
      const result = s.sortListBy(list, 'num')
      expect(result).toEqual([c, b, a])
    })
    test('should sort by multi-digit negative numbers that *look* like strings!', () => {
      const a = { num: '1' }
      const b = { num: '0' }
      const c = { num: '-100' }
      const d = { num: '-10' }
      const e = { num: '-1' }
      const list = [a, b, c, d, e]
      const result = s.sortListBy(list, 'num')
      expect(result).toEqual([c, d, e, b, a])
    })
    test('should sort by date field ASC', () => {
      const a = { date: new Date('2022-01-01') }
      const b = { date: new Date('2021-01-01') }
      const list = [a, b]
      const result = s.sortListBy(list, 'date')
      expect(result).toEqual([b, a])
    })
    test('should sort by date field DESC', () => {
      const a = { date: new Date('2022-01-01') }
      const b = { date: new Date('2021-01-01') }
      const list = [a, b]
      const result = s.sortListBy(list, '-date')
      expect(result).toEqual([a, b])
    })
    test('should sort by date field with empty', () => {
      const a = { date: new Date('2022-01-01') }
      const b = { date: new Date('2021-01-01') }
      const c = { date: null }
      const list = [a, b, c]
      const result = s.sortListBy(list, 'date')
      expect(result).toEqual([b, a, c])
    })
    test('should sort list of arrays instead of object (using number keys)', () => {
      const a = ['a', 'h', 'x']
      const b = ['b', 'f', 'x']
      const c = ['c', 'g', 'x']
      const list = [a, b, c]
      const result = s.sortListBy(list, '1')
      expect(result).toEqual([b, c, a])
    })
    test('should sort list of arrays instead of object (using number keys) DESC', () => {
      const a = ['a', 'h', 'x']
      const b = ['b', 'f', 'x']
      const c = ['c', 'g', 'x']
      const list = [a, b, c]
      const result = s.sortListBy(list, '-1')
      expect(result).toEqual([a, c, b])
    })
    test('should sort list of arrays instead of object (using number keys) multiple keys', () => {
      const a = ['a', 'h', 'x']
      const b = ['b', 'f', 'x']
      const c = ['c', 'g', 'a']
      const list = [a, b, c]
      const result = s.sortListBy(list, ['2', '-0'])
      expect(result).toEqual([c, b, a])
    })
    // older (basic) tests (need to refactor to use newer test format ^^^)
    test('sorting - sortListBy ', () => {
      const list = [{ propA: 10, propB: 0 }, { propA: 0, propB: 4 }, { propA: 5, propB: 10 }, { propA: 0, propB: 0 }, { propA: 6 }, { propB: 7 }]
      const immutableOrigList = _.cloneDeep(list)
      // sort by propA (string, not array)
      let sorted = s.sortListBy(list, 'propA')
      expect(sorted[0]).toEqual(immutableOrigList[1])
      expect(sorted[2]).toEqual(immutableOrigList[2])
      // sort by propA (array)
      sorted = s.sortListBy(list, ['propA'])
      expect(sorted[0]).toEqual(immutableOrigList[1])
      expect(sorted[2]).toEqual(immutableOrigList[2])
      // sort by propB
      sorted = s.sortListBy(list, ['propB', 'propA'])
      expect(sorted[0].propB).toEqual(0)
      expect(sorted[3]).toEqual(immutableOrigList[5])
      expect(sorted[0]).toEqual(immutableOrigList[3])
      // undefined should be last
      expect(sorted[5]).toEqual(immutableOrigList[4])
      // sort in reverse/DESC by propB
      sorted = s.sortListBy(list, '-propB')
      expect(sorted[0]).toEqual(immutableOrigList[2])
      expect(sorted[1]).toEqual(immutableOrigList[5])
      // undefined should be last in DESC sort also
      expect(sorted[5]).toEqual(immutableOrigList[4])
    })

    // @jgclark's tests, to support SearchExtensions
    test('should sort by alpha field ASC then lineIndex', () => {
      const unsortedList = [
        { title: 'Title B', lineIndex: 20 },
        { title: 'Title B', lineIndex: 200 },
        { title: 'Title B', lineIndex: 2 },
        { title: 'Title AA', lineIndex: 30 },
        { title: 'Title AA', lineIndex: 300 },
        { title: 'Title AA', lineIndex: 3 },
        { title: 'Title CCC', lineIndex: 10 },
        { title: 'Title CCC', lineIndex: 100 },
        { title: 'Title CCC', lineIndex: 1 },
        { title: 'Title CCC', lineIndex: 11 },
      ]
      const sortedList = [
        { title: 'Title AA', lineIndex: 3 },
        { title: 'Title AA', lineIndex: 30 },
        { title: 'Title AA', lineIndex: 300 },
        { title: 'Title B', lineIndex: 2 },
        { title: 'Title B', lineIndex: 20 },
        { title: 'Title B', lineIndex: 200 },
        { title: 'Title CCC', lineIndex: 1 },
        { title: 'Title CCC', lineIndex: 10 },
        { title: 'Title CCC', lineIndex: 11 },
        { title: 'Title CCC', lineIndex: 100 },
      ]
      const result = s.sortListBy(unsortedList, ['title', 'lineIndex'])
      expect(result).toEqual(sortedList)
    })
  })

  /**
   * getTasksByType()
   */
  describe('getTasksByType()', () => {
    test('Should group tasks by type', () => {
      const paragraphs = [
        {
          type: 'open',
          indents: 0,
          content: 'test content',
          rawContent: '* test content',
        },
        {
          type: 'scheduled',
          indents: 0,
          content: 'test content',
          rawContent: '* test content',
        },
      ]
      const taskList = s.getTasksByType(paragraphs)
      expect(taskList['open'].length).toEqual(1)
      expect(taskList['scheduled'].length).toEqual(1)
      expect(taskList['open'][0].content).toEqual(paragraphs[0].content)
    })
    test('Should include checklists by type', () => {
      const paragraphs = [
        {
          type: 'open',
          indents: 0,
          content: 'test content',
          rawContent: '* test content',
        },
        {
          type: 'open',
          indents: 0,
          content: 'test content >2022-01-01',
          rawContent: '* test content',
        },
        {
          type: 'checklistDone',
          indents: 0,
          content: 'test content',
          rawContent: '+ [x] test content',
        },
        {
          type: 'checklist',
          indents: 0,
          content: 'test content',
          rawContent: '+ [>] test content',
        },
        {
          type: 'checklistCancelled',
          indents: 0,
          content: 'test content',
          rawContent: '+ [-] test content',
        },
        {
          type: 'checklist',
          indents: 0,
          content: 'test content',
          rawContent: '+ test content',
        },
      ]
      const taskList = s.getTasksByType(paragraphs)
      expect(taskList['open'].length).toEqual(1)
      expect(taskList['scheduled'].length).toEqual(1)
      expect(taskList['checklist'].length).toEqual(1)
      expect(taskList['checklistDone'].length).toEqual(1)
      expect(taskList['checklistScheduled'].length).toEqual(1)
      expect(taskList['checklistCancelled'].length).toEqual(1)
      expect(taskList['done']).toEqual([])
    })
  })
  /*
   * calculateParagraphType()
   */
  describe('calculateParagraphType()' /* function */, () => {
    test('should return a standard type', () => {
      const paragraph = new Paragraph({ type: 'open', content: 'test content' })
      const result = s.calculateParagraphType(paragraph)
      expect(result).toEqual('open')
    })
    test('should return a checklistScheduled type', () => {
      const paragraph = new Paragraph({ type: 'checklist', content: 'test content >2022' })
      const result = s.calculateParagraphType(paragraph)
      expect(result).toEqual('checklistScheduled')
    })
    test('should return a scheduled type', () => {
      const paragraph = new Paragraph({ type: 'open', content: 'test content >2022-10' })
      const result = s.calculateParagraphType(paragraph)
      expect(result).toEqual('scheduled')
    })
  })
})
