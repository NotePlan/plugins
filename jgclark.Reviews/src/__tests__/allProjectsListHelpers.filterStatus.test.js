// @flow
/* globals describe, expect, test, beforeEach */

import { filterProjectsList } from '../allProjectsListHelpers'
import type { ReviewConfig } from '../reviewSettings'

const preferenceValues: { [string]: any } = {}

beforeEach(() => {
  // $FlowFixMe[prop-missing] test stub
  global.DataStore = {
    preference: (key: string): any => preferenceValues[key],
    setPreference: (key: string, value: any): void => {
      preferenceValues[key] = value
    },
  }
  Object.keys(preferenceValues).forEach((k) => {
    delete preferenceValues[k]
  })
  preferenceValues['startMentionStr'] = 'started'
  preferenceValues['completedMentionStr'] = 'completed'
  preferenceValues['cancelledMentionStr'] = 'cancelled'
  preferenceValues['pausedMentionStr'] = 'paused'
  preferenceValues['notstartedMentionStr'] = 'notstarted'
  preferenceValues['useProjectStatus'] = true
})

/**
 * Minimal ReviewConfig for filterProjectsList tests.
 * @param {Object} partial
 * @returns {ReviewConfig}
 */
function filterConfig(partial: Object): ReviewConfig {
  return ({
    displayFinished: false,
    displayPaused: true,
    displayOnlyDue: false,
    useProjectStatus: false,
    hiddenStatusTags: [],
    ...partial,
  }: any)
}

describe('filterProjectsList with status feature', () => {
  const projects: Array<any> = [
    { title: 'A', statusHashtag: '#notstarted', isCompleted: false, isCancelled: false, isPaused: false, nextReviewDays: 1 },
    { title: 'B', statusHashtag: '#started', isCompleted: false, isCancelled: false, isPaused: false, nextReviewDays: 1 },
    { title: 'C', statusHashtag: '#paused', isCompleted: false, isCancelled: false, isPaused: true, nextReviewDays: NaN },
    { title: 'D', statusHashtag: '#completed', isCompleted: true, isCancelled: false, isPaused: false, nextReviewDays: NaN },
    { title: 'E', statusHashtag: '#cancelled', isCompleted: false, isCancelled: true, isPaused: false, nextReviewDays: NaN },
  ]

  test('when status on, skips finished/paused switches and applies hiddenStatusTags', async () => {
    const config = filterConfig({
      useProjectStatus: true,
      displayFinished: false,
      displayPaused: false,
      hiddenStatusTags: ['#completed', '#cancelled'],
    })
    const filtered = await filterProjectsList(projects, config)
    expect(filtered.map((p) => p.title)).toEqual(['A', 'B', 'C'])
  })

  test('hides completed even when cached statusHashtag is still #started', async () => {
    const config = filterConfig({
      useProjectStatus: true,
      hiddenStatusTags: ['#completed', '#cancelled'],
    })
    const staleComplete = {
      title: 'StaleComplete',
      statusHashtag: '#started',
      isCompleted: true,
      isCancelled: false,
      isPaused: false,
      nextReviewDays: NaN,
    }
    const filtered = await filterProjectsList([...projects, staleComplete], config)
    expect(filtered.map((p) => p.title)).toEqual(['A', 'B', 'C'])
  })

  test('when status on and skipStatusMembershipFilter, keeps all statuses', async () => {
    const config = filterConfig({
      useProjectStatus: true,
      hiddenStatusTags: ['#completed', '#cancelled', '#paused'],
    })
    const filtered = await filterProjectsList(projects, config, false, { skipStatusMembershipFilter: true })
    expect(filtered.map((p) => p.title)).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  test('when status off, uses displayFinished / displayPaused', async () => {
    preferenceValues['useProjectStatus'] = false
    const config = filterConfig({
      useProjectStatus: false,
      displayFinished: false,
      displayPaused: false,
    })
    const filtered = await filterProjectsList(projects, config)
    // finished = completed or cancelled; paused also hidden
    expect(filtered.map((p) => p.title)).toEqual(['A', 'B'])
  })
})
