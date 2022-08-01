/* globals describe, expect, test */
import { _ } from 'lodash'
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
        const a = {text:"B"}
        const b = {text:"A"}
        const list = [a,b]
        const result = s.sortListBy(list,"text")
        expect(result).toEqual([b,a])
      })
      test('should sort by alpha field DESC', () => {
        const a = {text:"B"}
        const b = {text:"A"}
        const list = [a,b]
        const result = s.sortListBy(list,"-text")
        expect(result).toEqual([a,b])
      })
      test('should sort by date field ASC', () => {
        const a = {date:new Date("2022-01-01")}
        const b = {date:new Date("2021-01-01")}
        const list = [a,b]
        const result = s.sortListBy(list,"date")
        expect(result).toEqual([b,a])
      })
      test('should sort by date field DESC', () => {
        const a = {date:new Date("2022-01-01")}
        const b = {date:new Date("2021-01-01")}
        const list = [a,b]
        const result = s.sortListBy(list,"-date")
        expect(result).toEqual([a,b])
      })

      // older (basic) tests (need to refactor to use newer test format ^^^)
      test('sorting - sortListBy ', () => {
      const list = [
        { propA: 10, propB: 0 },
        { propA: 0, propB: 4 },
        { propA: 5, propB: 10 },
        { propA: 0, propB: 0 },
        { propA: 6 },
        { propB: 7 },
      ]
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
      expect(taskList['open'][0].rawContent).toEqual(paragraphs[0].corawContentntent)
  })
    test('Should ignore items which are not tasks', () => {
      const paragraphs = [
        {
          type: 'open',
          indents: 0,
          content: 'test content',
          rawContent: '* test content',
        },
        {
          type: 'title',
          indents: 0,
          content: 'test title',
          rawContent: '## test title',
        },
        {
          type: 'scheduled',
          indents: 0,
          content: 'test content',
          rawContent: '* test content',
        },
      ]
      const taskList = s.getTasksByType(paragraphs)
      expect(taskList['title'].length).toEqual(0)
  })
    test('Should add children tasks to parents if indented', () => {
      const paragraphs = [
        {
          type: 'open',
          indents: 0,
          content: 'test content',
          rawContent: '* test content',
        },
        {
          type: 'open',
          indents: 1,
          content: 'underneath',
          rawContent: '\tunderneath',
        },
      ]
      const taskList = s.getTasksByType(paragraphs, false)
      expect(taskList['open'].length).toEqual(1)
      expect(taskList['open'][0].children[0].content).toEqual(`underneath`)
  })
    test('Should add children text content to parents if indented', () => {
      const paragraphs = [
        {
          type: 'open',
          indents: 0,
          content: 'test content',
          rawContent: '* test content',
        },
        {
          type: 'text',
          indents: 1,
          content: 'underneath',
          rawContent: '\tunderneath',
        },
      ]
      const taskList = s.getTasksByType(paragraphs, false)
      expect(taskList['open'].length).toEqual(1)
      expect(taskList['open'][0].children[0].content).toEqual(`underneath`)
  })
    test('Should add children of children tasks if double indented', () => {
      const paragraphs = [
        {
          type: 'open',
          indents: 0,
          content: 'test content',
          rawContent: '* test content',
        },
        {
          type: 'text',
          indents: 1,
          content: 'underneath',
          rawContent: '\tunderneath',
        },
        {
          type: 'open',
          indents: 2,
          content: 'task underneath',
          rawContent: '\t\t* underneath',
        },
      ]
      const taskList = s.getTasksByType(paragraphs, false)
      expect(taskList['open'].length).toEqual(1)
      expect(taskList['open'][0].children[0].children[0].content).toEqual(`task underneath`)
  })
})
})
