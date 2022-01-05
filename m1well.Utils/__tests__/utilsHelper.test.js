/* global describe, expect, test, afterAll */

const { castStringFromMixed, castNumberFromMixed, sortByPrio, sortByType } = require('../src/utilsHelper')

// unsorted paragraphs
global.Editor = {
  note: {
    paragraphs: [
      {
        type: 'open',
        content: 'aaaaa',
      },
      {
        type: 'text',
        content: 'bbbbb',
      },
      {
        type: 'cancelled',
        content: 'ccccc',
      },
      {
        type: 'list',
        content: 'ddddd',
      },
      {
        type: 'scheduled',
        content: 'eeeee',
      },
      {
        type: 'open',
        content: '! fffff',
      },
      {
        type: 'open',
        content: '!! ggggg',
      },
      {
        type: 'list',
        content: '! hhhhh',
      },
    ]
  }
}

const simpleConfig = {
  autoArchiveTag: '#scratch',
  autoArchiveLifeInDays: 7,
}

afterAll(() => {
  delete global.Editor
})

describe('utilsHelper', () => {

  describe('utilsHelper.js', () => {

    test('should cast string from mixed config', () => {
      const expected = '#scratch'

      const result = castStringFromMixed(simpleConfig, 'autoArchiveTag')

      expect(result).toEqual(expected)
    })

    test('should cast number from mixed config', () => {
      const expected = 7

      const result = castNumberFromMixed(simpleConfig, 'autoArchiveLifeInDays')

      expect(result).toEqual(expected)
    })

    test('should sort by type and prio', () => {
      const expected = [
        {
          type: 'open',
          content: '!! ggggg',
        },
        {
          type: 'open',
          content: '! fffff',
        },
        {
          type: 'open',
          content: 'aaaaa',
        },
        {
          type: 'scheduled',
          content: 'eeeee',
        },
        {
          type: 'cancelled',
          content: 'ccccc',
        },
        {
          type: 'list',
          content: '! hhhhh',
        },
        {
          type: 'list',
          content: 'ddddd',
        },
        {
          type: 'text',
          content: 'bbbbb',
        },
      ]

      const result = Editor.note.paragraphs.sort(sortByType()).sort(sortByPrio())

      expect(result).toEqual(expected)
    })

  })

})
