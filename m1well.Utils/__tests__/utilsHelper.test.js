/* global describe, expect, test, afterAll */

const { castStringFromMixed, castNumberFromMixed, sortByPrio, sortByType } = require('../src/utilsHelper')

// unsorted paragraphs
global.Editor = {
  note: {
    paragraphs: [
      {
        type: 'open',
        content: 'normal task 1',
      },
      {
        type: 'open',
        content: '!!! prio task with 3 excl.',
      },
      {
        type: 'open',
        content: '! prio task with 1 excl.',
      },
      {
        type: 'list',
        content: 'list line',
      },
      {
        type: 'cancelled',
        content: 'cancelled task',
      },
      {
        type: 'done',
        content: 'done task',
      },
      {
        type: 'scheduled',
        content: 'scheduled task >2022-12-12',
      },
      {
        type: 'open',
        content: '!! prio task with 2 excl.',
      },
      {
        type: 'text',
        content: 'some text',
      },
      {
        type: 'open',
        content: '!!!! prio task with 4 excl.',
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
          "content": "!!!! prio task with 4 excl.",
          "type": "open"
        },
        {
          "content": "!!! prio task with 3 excl.",
          "type": "open"
        },
        {
          "content": "!! prio task with 2 excl.",
          "type": "open"
        },
        {
          "content": "! prio task with 1 excl.",
          "type": "open"
        },
        {
          "content": "normal task 1",
          "type": "open"
        },
        {
          "content": "scheduled task >2022-12-12",
          "type": "scheduled"
        },
        {
          "content": "cancelled task",
          "type": "cancelled"
        },
        {
          "content": "done task",
          "type": "done"
        },
        {
          "content": "list line",
          "type": "list"
        },
        {
          "content": "some text",
          "type": "text"
        }
      ]

      const result = Editor.note.paragraphs.sort(sortByType()).sort(sortByPrio())

      expect(result).toEqual(expected)
    })

  })

})
