// @flow
/* eslint-disable */
/* globals describe, expect, test, beforeAll */

import { buildProjectLineForStyle, formatFinishedProjectRef } from '../projectsHTMLGenerator'
import { formatDurationString } from '../projectClassHelpers'

beforeAll(() => {
  global.DataStore = {
    preference: (key: string): any => (key === 'ignoreChecklistsInProgress' ? false : ''),
  }
})

/**
 * @param {any} overrides
 * @returns {any}
 */
function makeFinishedProject(overrides: any = {}): any {
  return {
    title: 'Shelved launch',
    folder: 'Projects',
    filename: 'Projects/Shelved launch.md',
    isCancelled: false,
    isCompleted: false,
    isPaused: false,
    lastProgressComment: '',
    nextActionsRawContent: [],
    percentComplete: NaN,
    numTotalItems: 0,
    numCompletedItems: 0,
    numOpenItems: 0,
    allProjectTags: ['#project'],
    ...overrides,
  }
}

const listConfig = {
  displayDates: true,
  displayProgress: true,
  displayNextActions: false,
  showFolderName: true,
}

describe('formatFinishedProjectRef', () => {
  test('prefers "after …" duration over a finish date', () => {
    expect(formatFinishedProjectRef('after 3 months', '2026-09-10', 'cancelled')).toBe('after 3 months')
  })

  test('skips a relative duration such as "a day ago" and uses the finish month', () => {
    expect(formatFinishedProjectRef('a day ago', '2026-09-10', 'cancelled')).toBe('in Sep')
  })

  test('uses the short finish month when there is no start-based duration', () => {
    expect(formatFinishedProjectRef('', '2026-11-04', 'cancelled')).toBe('in Nov')
  })

  test('falls back to the short word when duration and date are missing', () => {
    expect(formatFinishedProjectRef(null, '', 'cancelled')).toBe('cancelled')
  })
})

describe('formatDurationString', () => {
  test('returns "after …" from start to finish', () => {
    expect(formatDurationString('2026-04-01', '2026-01-01')).toBe('after 3 months')
  })

  test('returns empty when there is no start date (does not use "a day ago")', () => {
    expect(formatDurationString('2026-09-10')).toBe('')
    expect(formatDurationString('2026-09-10', '')).toBe('')
  })
})

describe('buildProjectLineForStyle list lines for finished projects', () => {
  test('cancelled summary line uses "after …" duration', () => {
    const line = buildProjectLineForStyle(
      makeFinishedProject({
        isCancelled: true,
        cancelledDate: '2026-09-10',
        cancelledDuration: 'after 3 months',
      }),
      listConfig,
      'list',
    )
    expect(line).toContain('(Cancelled after 3 months)')
    expect(line).not.toContain('a day ago')
  })

  test('cancelled summary line with no start date uses the finish month', () => {
    const line = buildProjectLineForStyle(
      makeFinishedProject({
        isCancelled: true,
        cancelledDate: '2026-11-04',
        cancelledDuration: '',
      }),
      listConfig,
      'list',
    )
    expect(line).toContain('(Cancelled in Nov)')
    expect(line).not.toContain('a day ago')
  })

  test('completed summary line uses "after …" duration', () => {
    const line = buildProjectLineForStyle(
      makeFinishedProject({
        isCompleted: true,
        completedDate: '2026-09-10',
        completedDuration: 'after 3 months',
      }),
      listConfig,
      'list',
    )
    expect(line).toContain('(Completed after 3 months)')
    expect(line).not.toContain('a day ago')
  })
})
