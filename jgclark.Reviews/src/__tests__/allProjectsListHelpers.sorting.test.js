// @flow
/* globals describe, expect, test */
import { buildSortingSpecification, sortProjectsList } from '../allProjectsListHelpers'
import type { ReviewConfig } from '../reviewHelpers'

/**
 * Minimal ReviewConfig for sorting tests (other fields unused by buildSortingSpecification / sortProjectsList).
 * @param {Object} partial
 * @returns {ReviewConfig}
 */
function sortConfig(partial: Object): ReviewConfig {
  return ({
    displayGroupedByFolder: false,
    displayOrder: 'review',
    projectTypeTags: ['#project', '#area'],
    ...partial,
  }: any)
}

describe('buildSortingSpecification', () => {
  test('review: nextReviewDays then title', () => {
    const spec = buildSortingSpecification(sortConfig({ displayOrder: 'review' }))
    expect(spec).toEqual(['nextReviewDays', 'title'])
    expect(spec).not.toContain('isCancelled')
    expect(spec).not.toContain('isCompleted')
    expect(spec).not.toContain('isPaused')
  })

  test('review with folder: folder first', () => {
    const spec = buildSortingSpecification(
      sortConfig({ displayOrder: 'review', displayGroupedByFolder: true }),
    )
    expect(spec).toEqual(['folder', 'nextReviewDays', 'title'])
  })

  test('due: dueDays then title', () => {
    const spec = buildSortingSpecification(sortConfig({ displayOrder: 'due' }))
    expect(spec).toEqual(['dueDays', 'title'])
    expect(spec).not.toContain('isCancelled')
  })

  test('title: title only', () => {
    const spec = buildSortingSpecification(sortConfig({ displayOrder: 'title' }))
    expect(spec).toEqual(['title'])
  })

  test('firstTag: firstProjectTagForSort, nextReviewDays, title', () => {
    const spec = buildSortingSpecification(sortConfig({ displayOrder: 'firstTag' }))
    expect(spec).toEqual(['firstProjectTagForSort', 'nextReviewDays', 'title'])
  })

  test('firstTag with folder: folder first', () => {
    const spec = buildSortingSpecification(
      sortConfig({ displayOrder: 'firstTag', displayGroupedByFolder: true }),
    )
    expect(spec).toEqual(['folder', 'firstProjectTagForSort', 'nextReviewDays', 'title'])
  })
})

describe('sortProjectsList firstTag', () => {
  test('sorts by primary tag then nextReviewDays', () => {
    const config = sortConfig({ displayOrder: 'firstTag' })
    const projects: Array<any> = [
      { allProjectTags: ['#zebra'], nextReviewDays: 5, title: 'Z', folder: '/a' },
      { allProjectTags: ['#apple'], nextReviewDays: 10, title: 'A', folder: '/a' },
      { allProjectTags: ['#apple'], nextReviewDays: 3, title: 'B', folder: '/a' },
    ]
    const sorted = sortProjectsList(projects, config, [])
    expect(sorted.map((p) => p.allProjectTags[0])).toEqual(['#apple', '#apple', '#zebra'])
    expect(sorted.map((p) => p.nextReviewDays)).toEqual([3, 10, 5])
  })
})
