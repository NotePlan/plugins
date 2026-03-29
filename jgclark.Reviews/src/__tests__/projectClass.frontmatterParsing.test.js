// @flow
/* globals describe, expect, test */

import { parseProjectFrontmatterValue, Project, readRawFrontmatterField } from '../projectClass'

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

const preferenceValues: { [string]: any } = {}
global.DataStore = {
  preference: (key: string): any => preferenceValues[key] ?? '',
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

  describe('generateMetadataOutputLine', () => {
    test('omits date mentions by default but keeps review interval', () => {
      preferenceValues['writeDateMentionsInCombinedMetadata'] = false
      preferenceValues['startMentionStr'] = '@start'
      preferenceValues['dueMentionStr'] = '@due'
      preferenceValues['reviewedMentionStr'] = '@reviewed'
      preferenceValues['completedMentionStr'] = '@completed'
      preferenceValues['cancelledMentionStr'] = '@cancelled'
      preferenceValues['reviewIntervalMentionStr'] = '@review'

      const project: any = Object.create(Project.prototype)
      project.allProjectTags = ['#project']
      project.isPaused = false
      project.startDate = '2026-03-01'
      project.dueDate = '2026-03-22'
      project.reviewInterval = '1w'
      project.reviewedDate = '2026-03-20'
      project.completedDate = undefined
      project.cancelledDate = undefined

      expect(project.generateMetadataOutputLine(false)).toBe('#project @review(1w)')
    })

    test('includes date mentions when explicitly enabled', () => {
      preferenceValues['writeDateMentionsInCombinedMetadata'] = true
      preferenceValues['startMentionStr'] = '@start'
      preferenceValues['dueMentionStr'] = '@due'
      preferenceValues['reviewedMentionStr'] = '@reviewed'
      preferenceValues['completedMentionStr'] = '@completed'
      preferenceValues['cancelledMentionStr'] = '@cancelled'
      preferenceValues['reviewIntervalMentionStr'] = '@review'

      const project: any = Object.create(Project.prototype)
      project.allProjectTags = ['#project']
      project.isPaused = false
      project.startDate = '2026-03-01'
      project.dueDate = '2026-03-22'
      project.reviewInterval = '1w'
      project.reviewedDate = '2026-03-20'
      project.completedDate = undefined
      project.cancelledDate = undefined

      expect(project.generateMetadataOutputLine(true)).toBe('#project @review(1w) @start(2026-03-01) @due(2026-03-22) @reviewed(2026-03-20)')
    })
  })
})
