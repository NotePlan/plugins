/*
Fuse docs: https://fusejs.io/examples.html#extended-search
*/

import * as fh from '../src/support/fuse-helpers'
import { clo } from '../../helpers/dev'
import Fuse from 'fuse.js'
/*
Template:
    describe('functionName', () => {
      test('should capitalize string', async () => {
        const result = await dh.uppercase('hello world')
        expect(result).toEqual('HELLO WORLD')
      })
    })
*/
describe('dwertheimer.DataQuerying', () => {
  describe('fuse-helpers', () => {
    describe('buildIndex', () => {
      test('should create basic index per Fuse docs', async () => {
        const options = { keys: ['title', 'author.firstName'] }
        const data = [
          {
            title: "Old Man's War",
            author: {
              firstName: 'John',
              lastName: 'Scalzi',
            },
          },
          {
            title: 'The Lock Artist',
            author: {
              firstName: 'Steve',
              lastName: 'Hamilton',
            },
          },
        ]
        const index = fh.buildIndex(data, options)
        expect(index.docs.length).toEqual(2)
        expect(index.keys.length).toEqual(2)
      })
      test('should create basic note index', async () => {
        const options = { keys: ['title', 'hashtags', 'mentions'] }
        const notes = [
          {
            title: "Old Man's War",
            hashtags: ['foo', 'bar'],
            mentions: ['baz', 'yoo'],
          },
        ]
        const index = fh.buildIndex(notes, options)
        expect(index.docs.length).toEqual(1)
        expect(index.keys.length).toEqual(3)
      })
    })
    describe('searchIndex', () => {
      test('should search basic note index', async () => {
        const options = { keys: ['title', 'hashtags', 'mentions'], includeScore: true, includeMatches: true, useExtendedSearch: true }
        const notes = [
          {
            title: "Old Man's War",
            hashtags: ['foo', 'bar'],
            mentions: ['baz', 'yoo'],
          },
        ]
        const index = fh.buildIndex(notes, options)
        const config = { options, index }
        const result = fh.searchIndex(notes, 'foo', config)
        expect(result.length).toEqual(1)
        expect(result[0].item.title).toEqual(notes[0].title)
        expect(result[0].matches.length).toEqual(2)
      })
      test('should search note index with paragraph and exact search', async () => {
        const options = { keys: ['title', 'hashtags', 'mentions', 'content'], includeScore: true, includeMatches: true, useExtendedSearch: true, shouldSort: true }
        const notes = [
          {
            title: "Old Man's Wag",
            hashtags: ['foo', 'bar'],
            mentions: ['baz', 'yoo'],
            content: 'the lazy dog jumped over the log',
          },
        ]
        const index = fh.buildIndex(notes, options)
        const config = { options, index }
        const result = fh.searchIndex(notes, `'"dog"`, config)
        expect(result.length).toEqual(1)
        expect(result[0].item.title).toEqual(notes[0].title)
        expect(result[0].matches.length).toEqual(1)
      })
      test('should search note index with multiple paragraphs and exact search', async () => {
        const options = { keys: ['title', 'hashtags', 'mentions', 'content'], includeScore: true, includeMatches: true, useExtendedSearch: true, shouldSort: true }
        const notes = [
          {
            title: "Old Man's Boo",
            hashtags: ['sfoo', 'sbar'],
            mentions: ['sbaz', 'syoo'],
            content: 'the lazy frog jumped over the log',
          },
          {
            title: "Old Man's Wag",
            hashtags: ['foo', 'bar'],
            mentions: ['baz', 'yoo'],
            content: 'the lazy dog jumped over the log',
          },
        ]
        const index = fh.buildIndex(notes, options)
        const config = { options, index }
        const result = fh.searchIndex(notes, `'"dog"`, config)
        expect(result.length).toEqual(1)
        expect(result[0].item.title).toMatch(/Wag/)
        expect(result[0].matches.length).toEqual(1)
      })
      describe('Direct Fuse search with paragraph content', () => {
        test('should search with AND and specific word', async () => {
          const options = { keys: ['content'], useExtendedSearch: true }
          const notes = [
            {
              content: 'the #lazy frog jumped over the log',
            },
            {
              content: 'the lazy dog jumped over the banana',
            },
            {
              content: 'the crazy man ate a #lazy frog',
            },
          ]
          const searchExp = { $and: [{ content: `'"jumped over"` }, { content: `'#lazy` }] }
          const fuse = new Fuse(notes, options)
          const result = fuse.search(searchExp)
          expect(result.length).toEqual(1)
          expect(result[0].item.content).toMatch(/lazy frog/)
        })
        test('should search with AND and specific word', async () => {
          const options = { keys: ['content'], useExtendedSearch: true }
          const notes = [
            {
              content: 'the #lazy frog jumped over the log',
            },
            {
              content: 'the lazy dog jumped over the banana',
            },
            {
              content: 'the crazy man ate a #lazy frog',
            },
          ]
          const searchExp = { $or: [{ content: `'"jumped over"` }, { content: `'#lazy` }] }
          const fuse = new Fuse(notes, options)
          const result = fuse.search(searchExp)
          expect(result.length).toEqual(3)
        })
        test('should search with nested OR and AND', async () => {
          const options = { keys: ['content'], useExtendedSearch: true }
          const notes = [
            {
              content: 'the #lazy frog jumped over the log',
            },
            {
              content: 'the lazy dog jumped over the banana',
            },
            {
              content: 'the crazy man ate a #lazy frog',
            },
          ]
          // ("jumped" AND "log") OR "#lazy"
          const searchExp = {
            $or: [{ $and: [{ content: `'"jumped"` }, { content: `'"log"` }] }, { content: `'#lazy` }],
          }
          const fuse = new Fuse(notes, options)
          const result = fuse.search(searchExp)
          expect(result.length).toEqual(2)
        })
      })
      describe('createFuseSearchObjectFromRPN', () => {
        test('should return blank query with empty RPN', async () => {
          const rpn = []
          const result = fh.createFuseSearchObjectFromRPN(rpn)
          expect(result).toEqual({})
        })
        test.skip('should return proper query object given RPN in bqps docs', async () => {
          const rpn = [
            {
              value: 'A',
              type: 'term',
              position: {
                start: 0,
                end: 0,
              },
            },
            {
              value: 'B',
              type: 'term',
              position: {
                start: 6,
                end: 6,
              },
            },
            {
              value: 'AND',
              type: 'operator',
              operation: 'AND',
              position: {
                start: 2,
                end: 4,
              },
            },
          ]
          const result = fh.createFuseSearchObjectFromRPN(rpn)
          expect(result).toEqual({ $and: [{ content: 'A' }, { content: 'B' }] })
        })
      })
    })
    describe('removeExtendedSearchTags', () => {
      test('should do nothing if no tags', async () => {
        const result = await fh.removeExtendedSearchTags('foo')
        expect(result).toEqual('foo')
      })
      test('should remove leading apostrophe', async () => {
        const result = await fh.removeExtendedSearchTags("'foo")
        expect(result).toEqual('foo')
      })
    })
    describe('populateObjectFromArray', () => {
      test('should return empty object from empty array', async () => {
        const result = fh.populateObjectFromArray([])
        expect(result).toEqual({})
      })
      test('should return basic object from array', async () => {
        const result = fh.populateObjectFromArray([{ foo: 'bar' }])
        expect(result).toEqual({ foo: 'bar' })
      })
      test('should return parallel properties at top level (though not sure this happens)', async () => {
        const result = fh.populateObjectFromArray([{ foo: 'bar' }, { boy: 'baz' }])
        expect(result).toEqual({ foo: 'bar', boy: 'baz' })
      })
      test('should return parallel properties at top level (though not sure this happens)', async () => {
        const result = fh.populateObjectFromArray([{ foo: 'bar', boy: 'baz' }])
        expect(result).toEqual({ foo: 'bar', boy: 'baz' })
      })
    })
  })
})

const lorem =
  "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum."

// fh.createFuseSearchObjectFromRPN

// initialize Fuse with the index
// const fuse = new Fuse(books, options, myIndex)
