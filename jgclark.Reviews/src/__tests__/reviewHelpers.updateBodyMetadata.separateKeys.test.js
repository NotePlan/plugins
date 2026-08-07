// @flow
/* globals beforeAll, describe, expect, test */

import { updateBodyMetadataInNote, writeCombinedProjectTagAndReviewedMentions } from '../reviewHelpers'
import { Note } from '../../../__mocks__/Note.mock'

const preferenceValues: { [string]: any } = {}

beforeAll(() => {
  // eslint-disable-next-line no-global-assign
  global.DataStore = {
    preference: (key: string): any => preferenceValues[key] ?? '',
  }
})

/**
 * Recreate content + frontmatterAttributes after paragraph mutations that only touch para.content
 * (Note mock's updateParagraph does not call resetLineIndexesAndContent).
 * @param {Note} note
 * @returns {void}
 */
function syncNoteContentFromParagraphs(note: any): void {
  note._content = note.paragraphs.map((p) => p.content).join('\n')
  note.setFrontmatterAttributes()
}

/**
 * Set standard mention-string prefs used by separate-key parsing.
 * @returns {void}
 */
function setDefaultMentionPrefs(): void {
  preferenceValues['projectMetadataFrontmatterKey'] = 'project'
  preferenceValues['reviewedMentionStr'] = 'reviewed'
  preferenceValues['reviewIntervalMentionStr'] = 'review'
  preferenceValues['startMentionStr'] = 'start'
  preferenceValues['dueMentionStr'] = 'due'
  preferenceValues['completedMentionStr'] = 'completed'
  preferenceValues['cancelledMentionStr'] = 'cancelled'
  preferenceValues['nextReviewMentionStr'] = 'nextReview'
  preferenceValues['progressStr'] = 'progress'
}

describe('updateBodyMetadataInNote separate frontmatter keys', () => {
  test('adds reviewed when note only has separate review interval key (no project: line)', () => {
    setDefaultMentionPrefs()

    const note = new Note({
      content: `---
title: Backup Management
review: 2w
---
# Backup Management
Aim: something`,
      type: 'Notes',
      filename: 'Home Projects/Backup Management.md',
      title: 'Backup Management',
    })

    expect(note.frontmatterAttributes.reviewed).toBeUndefined()
    expect(note.frontmatterAttributes.review).toBe('2w')

    updateBodyMetadataInNote((note: any), ['reviewed(2026-08-03)'])
    syncNoteContentFromParagraphs(note)

    // getAttributes may coerce ISO dates to Date; verify the written FM line
    expect(note.content).toMatch(/^reviewed:\s*2026-08-03\s*$/m)
    expect(note.content).toMatch(/^review:\s*2w\s*$/m)
  })

  test('updates existing reviewed separate key without requiring project: line', () => {
    setDefaultMentionPrefs()

    const note = new Note({
      content: `---
title: Existing Reviewed
review: 1m
reviewed: 2026-01-01
---
# Existing Reviewed
Body`,
      type: 'Notes',
      filename: 'Projects/Existing.md',
      title: 'Existing Reviewed',
    })

    updateBodyMetadataInNote((note: any), ['reviewed(2026-08-03)'])
    syncNoteContentFromParagraphs(note)

    expect(note.content).toMatch(/^reviewed:\s*2026-08-03\s*$/m)
    expect(note.content).not.toMatch(/^reviewed:\s*2026-01-01\s*$/m)
  })
})

describe('writeCombinedProjectTagAndReviewedMentions', () => {
  test('writes combined project key and reviewed on a note that only had review interval', () => {
    setDefaultMentionPrefs()

    const note = new Note({
      content: `---
title: Backup Management
review: 2w
---
# Backup Management
Aim: something`,
      type: 'Notes',
      filename: 'Home Projects/Backup Management.md',
      title: 'Backup Management',
    })

    writeCombinedProjectTagAndReviewedMentions((note: any), '#project', ['reviewed(2026-08-03)'])
    syncNoteContentFromParagraphs(note)

    expect(note.content).toMatch(/^project:\s*#project\s*$/m)
    expect(note.content).toMatch(/^reviewed:\s*2026-08-03\s*$/m)
    expect(note.content).toMatch(/^review:\s*2w\s*$/m)
  })
})
