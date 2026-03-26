// @flow
/* globals describe, expect, test */

import { parseProjectFrontmatterValue, readRawFrontmatterField } from '../projectClass'

type MockParagraph = {
  content: string,
}

type MockNote = {
  paragraphs: Array<MockParagraph>,
}

function makeNote(frontmatterLines: Array<string>): MockNote {
  const paragraphs = frontmatterLines.map((line) => ({ content: line }))
  return { paragraphs }
}

describe('projectClass frontmatter parsing helpers', () => {
  describe('readRawFrontmatterField', () => {
    test('distinguishes missing key from present key with empty value', () => {
      const note = makeNote([
        '---',
        'title: Example',
        'due:',
        'review: @review()',
        '---',
        '# Note title',
      ])

      const missing = readRawFrontmatterField((note: any), 'start')
      const presentEmpty = readRawFrontmatterField((note: any), 'due')
      const presentInvalid = readRawFrontmatterField((note: any), 'review')

      expect(missing).toEqual({ exists: false, value: undefined })
      expect(presentEmpty).toEqual({ exists: true, value: '' })
      expect(presentInvalid).toEqual({ exists: true, value: '@review()' })
    })
  })

  describe('parseProjectFrontmatterValue', () => {
    test('returns empty string for malformed empty mention values', () => {
      expect(parseProjectFrontmatterValue('@due()')).toBe('')
      expect(parseProjectFrontmatterValue('@review()')).toBe('')
    })

    test('returns unwrapped mention content for valid values', () => {
      expect(parseProjectFrontmatterValue('@due(2026-03-26)')).toBe('2026-03-26')
      expect(parseProjectFrontmatterValue('@review(2w)')).toBe('2w')
    })
  })
})
