// @flow
/* eslint-disable flowtype/require-valid-file-annotation */
/* globals describe, it, expect */

import { noteHasOpenUnscheduledPriorityItems, noteMayContainPriorityMarkers } from '../src/priorityNoteIndexCache'
import { asTNote } from '@mocks/index'

/**
 * Build a minimal TNote for membership tests.
 * @param {string} content
 * @param {Array<any>} paragraphs
 * @returns {TNote}
 */
function mockNote(content: string, paragraphs: Array<any> = []): TNote {
  return asTNote({
    type: 'Notes',
    filename: 'test.md',
    content,
    paragraphs,
  })
}

/**
 * @param {string} content
 * @param {string} type
 * @returns {any}
 */
function mockPara(content: string, type: string = 'open'): any {
  return {
    type,
    content,
    rawContent: `* ${content}`,
  }
}

describe('noteMayContainPriorityMarkers', () => {
  it('returns true when content has ! or >>', () => {
    expect(noteMayContainPriorityMarkers(mockNote('task ! later'))).toBe(true)
    expect(noteMayContainPriorityMarkers(mockNote('>> win'))).toBe(true)
  })

  it('returns false when content has neither', () => {
    expect(noteMayContainPriorityMarkers(mockNote('plain open task'))).toBe(false)
  })
})

describe('noteHasOpenUnscheduledPriorityItems', () => {
  it('returns true for open unscheduled priority para', () => {
    const note = mockNote('! important', [mockPara('! important', 'open')])
    expect(noteHasOpenUnscheduledPriorityItems(note)).toBe(true)
  })

  it('returns false for done priority para', () => {
    const note = mockNote('! done', [mockPara('! done', 'done')])
    expect(noteHasOpenUnscheduledPriorityItems(note)).toBe(false)
  })

  it('returns false for open para without priority marker', () => {
    const note = mockNote('no marker', [mockPara('no marker', 'open')])
    expect(noteHasOpenUnscheduledPriorityItems(note)).toBe(false)
  })

  it('returns false for scheduled priority para (belongs in Calendar/Overdue)', () => {
    // isOpenNotScheduled rejects paras with >date when type is open
    const note = mockNote('! soon >2024-01-01', [
      {
        type: 'open',
        content: '! soon >2024-01-01',
        rawContent: '* ! soon >2024-01-01',
      },
    ])
    expect(noteHasOpenUnscheduledPriorityItems(note)).toBe(false)
  })
})
