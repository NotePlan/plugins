import * as fh from '../src/support/fuse-helpers'
import { clo } from '../../helpers/dev'

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
          content: ['the lazy dog', 'jumped over the log'],
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
          content: ['the lazy frog', 'jumped over the log'],
        },
        {
          title: "Old Man's Wag",
          hashtags: ['foo', 'bar'],
          mentions: ['baz', 'yoo'],
          content: ['the lazy dog', 'jumped over the log'],
        },
      ]
      const index = fh.buildIndex(notes, options)
      const config = { options, index }
      const result = fh.searchIndex(notes, `'"dog"`, config)
      expect(result.length).toEqual(1)
      expect(result[0].item.title).toMatch(/Wag/)
      expect(result[0].matches.length).toEqual(1)
    })
  })
})

// initialize Fuse with the index
// const fuse = new Fuse(books, options, myIndex)
