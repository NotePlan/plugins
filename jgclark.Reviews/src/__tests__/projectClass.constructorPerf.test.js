/* globals describe, expect, test, beforeAll, beforeEach, jest */
// @flow
/**
 * Lightweight constructor timing / write-gating checks for the performance work.
 * Medians are printed for local comparison; assertions focus on updateCache gating.
 */

import { Project } from '../projectClass'
import { Note } from '@mocks/index'

const preferenceValues: { [string]: any } = {}

beforeAll(() => {
  global.DataStore = {
    preference: (key: string): any => preferenceValues[key] ?? '',
    updateCache: jest.fn(),
  }
})

beforeEach(() => {
  global.DataStore.updateCache.mockClear()
  preferenceValues['projectMetadataFrontmatterKey'] = 'project'
  preferenceValues['startMentionStr'] = '@start'
  preferenceValues['dueMentionStr'] = '@due'
  preferenceValues['reviewedMentionStr'] = '@reviewed'
  preferenceValues['completedMentionStr'] = '@completed'
  preferenceValues['cancelledMentionStr'] = '@cancelled'
  preferenceValues['reviewIntervalMentionStr'] = '@review'
  preferenceValues['nextReviewMentionStr'] = '@nextReview'
  preferenceValues['progressStr'] = '@progress'
  preferenceValues['ignoreChecklistsInProgress'] = true
  preferenceValues['numberDaysForFutureToIgnore'] = 0
  preferenceValues['_logTimer'] = false
})

function makeContent(bodyLines: Array<string>): string {
  return `---\nproject: #project\n---\n# Bench\n${bodyLines.join('\n')}\n`
}

function median(values: Array<number>): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

describe('Project constructor performance gates', () => {
  test('read-only construct does not call updateCache; migrate path does', () => {
    const body = Array.from({ length: 50 }, (_, i) => `- [ ] task ${i}`)
    const shortNote = () =>
      new Note({
        title: 'Bench',
        filename: 'bench.md',
        content: makeContent(body),
      })

    const roTimes: Array<number> = []
    for (let i = 0; i < 15; i++) {
      const note = shortNote()
      const t0 = Date.now()
      // $FlowFixMe[incompatible-call]
      new Project((note: any), '#project', false, [], '', false)
      roTimes.push(Date.now() - t0)
    }
    expect(global.DataStore.updateCache).not.toHaveBeenCalled()

    global.DataStore.updateCache.mockClear()
    const writeTimes: Array<number> = []
    for (let i = 0; i < 15; i++) {
      const note = shortNote()
      const t0 = Date.now()
      // $FlowFixMe[incompatible-call]
      new Project((note: any), '#project', false, [], '', true)
      writeTimes.push(Date.now() - t0)
    }
    expect(global.DataStore.updateCache).toHaveBeenCalled()

    const longBody = Array.from({ length: 400 }, (_, i) => `- [ ] task ${i}`)
    const longTimes: Array<number> = []
    for (let i = 0; i < 10; i++) {
      const note = new Note({
        title: 'Long',
        filename: `long${i}.md`,
        content: makeContent(longBody),
      })
      const t0 = Date.now()
      // $FlowFixMe[incompatible-call]
      new Project((note: any), '#project', false, [], '', false)
      longTimes.push(Date.now() - t0)
    }

    // eslint-disable-next-line no-console
    console.log(
      `[Project ctor bench] shortRO median=${String(median(roTimes))}ms shortMigrate median=${String(median(writeTimes))}ms longRO median=${String(median(longTimes))}ms`,
    )
    expect(median(roTimes)).toBeGreaterThanOrEqual(0)
  })
})
