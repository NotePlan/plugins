/* eslint-disable import/first */
// @flow
//-----------------------------------------------------------------------------
// Tests for finished-project flag sync (completed / cancelled) on cached project rows
//-----------------------------------------------------------------------------

import { calcReviewFieldsForProject, isProjectFinished, syncProjectFinishedFlagsFromDates } from '../projectClassCalculations.js'

describe('projectClassCalculations finished flags', () => {
  /**
   * @param {any} overrides
   * @returns {any}
   */
  function makeProjectLike(overrides = {}) {
    return {
      filename: 'test.md',
      folder: 'Projects',
      title: 'Test Project',
      isCompleted: false,
      isCancelled: false,
      nextReviewDays: 3,
      reviewInterval: '1w',
      reviewedDate: '2026-01-01',
      ...overrides,
    }
  }

  test('isProjectFinished is true when cancelledDate is set but isCancelled flag is false', () => {
    const project = makeProjectLike({ cancelledDate: '2026-03-01', isCancelled: false })
    expect(isProjectFinished(project)).toBe(true)
  })

  test('syncProjectFinishedFlagsFromDates sets isCancelled from cancelledDate', () => {
    const project = makeProjectLike({ cancelledDate: '2026-03-01', isCancelled: false })
    const synced = syncProjectFinishedFlagsFromDates(project)
    expect(synced.isCancelled).toBe(true)
    expect(synced.isCompleted).toBe(false)
    expect(Number.isNaN(synced.nextReviewDays)).toBe(true)
  })

  test('cancelledDate takes precedence over completedDate for flags', () => {
    const project = makeProjectLike({
      cancelledDate: '2026-03-01',
      completedDate: '2026-02-01',
      isCompleted: true,
      isCancelled: false,
    })
    const synced = syncProjectFinishedFlagsFromDates(project)
    expect(synced.isCancelled).toBe(true)
    expect(synced.isCompleted).toBe(false)
  })

  test('calcReviewFieldsForProject does not recalculate next review for cancelled projects', () => {
    const project = makeProjectLike({
      cancelledDate: '2026-03-01',
      isCancelled: false,
      reviewedDate: '2026-01-01',
      reviewInterval: '1w',
    })
    const result = calcReviewFieldsForProject(project)
    expect(result.isCancelled).toBe(true)
    expect(Number.isNaN(result.nextReviewDays)).toBe(true)
    expect(result.cancelledDuration).toBeTruthy()
  })
})
