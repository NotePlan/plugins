// @flow
/* globals describe, expect, test */

import { clearNextReviewFrontmatterField } from '../reviewHelpers'
import { Note } from '../../../__mocks__/Note.mock'

describe('clearNextReviewFrontmatterField', () => {
  test('removes nextReview from both note and editor frontmatter attributes', () => {
    global.DataStore = {
      preference: (key: string): string => (key === 'nextReviewMentionStr' ? '@nextReview' : ''),
    }

    const note = new Note({
      content: `---
title: Project
project: #project
review: 1m
nextReview: 2026-05-01
reviewed: 2026-04-01
---
# Project`,
      type: 'Notes',
      filename: 'Projects/Test.md',
      title: 'Project',
    })

    const editor: any = {
      note,
      paragraphs: note.paragraphs,
      frontmatterAttributes: { ...note.frontmatterAttributes, nextReview: '2026-05-01' },
    }

    clearNextReviewFrontmatterField(editor)

    expect(editor.frontmatterAttributes.nextReview).toBeUndefined()
    expect(note.frontmatterAttributes.nextReview).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(note.frontmatterAttributes, 'reviewed')).toBe(true)
  })
})
