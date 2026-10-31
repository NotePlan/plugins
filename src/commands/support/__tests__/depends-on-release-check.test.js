// @flow
/* eslint-disable */

const { findDependsOnBelowPublished, versionMeetsMinimum } = require('../depends-on-release-check')

describe('versionMeetsMinimum', () => {
  test('same version meets the minimum', () => {
    expect(versionMeetsMinimum('1.3.2', '1.3.2')).toBe(true)
  })

  test('a greater version meets the minimum', () => {
    expect(versionMeetsMinimum('1.3.10', '1.3.2')).toBe(true)
    expect(versionMeetsMinimum('1.4.0', '1.3.2')).toBe(true)
  })

  test('a lower version does not meet the minimum', () => {
    expect(versionMeetsMinimum('1.3.1', '1.3.2')).toBe(false)
  })

  test('pre-release suffixes do not lower the numeric version', () => {
    expect(versionMeetsMinimum('1.3.2-beta', '1.3.2')).toBe(true)
    expect(versionMeetsMinimum('2.6.0.b6-beta', '2.6.0')).toBe(true)
    expect(versionMeetsMinimum('1.3.1-beta', '1.3.2')).toBe(false)
  })
})

describe('findDependsOnBelowPublished', () => {
  const releasesById = (byId: { [string]: Array<{ version: string }> | null }) => {
    return async (id: string) => {
      if (!Object.keys(byId).includes(id)) return []
      return byId[id]
    }
  }

  test('does nothing when dependsOn is missing', async () => {
    const problems = await findDependsOnBelowPublished(undefined, releasesById({}))
    expect(problems).toEqual([])
  })

  test('skips entries that have no minVersion', async () => {
    const fetchReleases = jest.fn(async () => [])
    const problems = await findDependsOnBelowPublished([{ id: 'np.Shared', name: 'Shared Resources' }], fetchReleases)
    expect(problems).toEqual([])
    expect(fetchReleases).not.toHaveBeenCalled()
  })

  test('passes when a published release is the minVersion or greater', async () => {
    const dependsOn = [{ id: 'np.Shared', name: 'Shared Resources', minVersion: '1.3.2' }]
    const problems = await findDependsOnBelowPublished(dependsOn, releasesById({ 'np.Shared': [{ version: '1.3.0' }, { version: '1.3.2' }] }))
    expect(problems).toEqual([])
  })

  test('reports the latest published release when minVersion is not published', async () => {
    const dependsOn = [{ id: 'np.Shared', name: 'Shared Resources', minVersion: '1.3.2' }]
    const problems = await findDependsOnBelowPublished(dependsOn, releasesById({ 'np.Shared': [{ version: '1.3.0' }, { version: '1.2.9' }] }))
    expect(problems).toEqual([
      {
        id: 'np.Shared',
        name: 'Shared Resources',
        minVersion: '1.3.2',
        latest: '1.3.0',
        fetchFailed: false,
      },
    ])
  })

  test('reports a missing plugin when nothing has been published', async () => {
    const dependsOn = { id: 'np.Shared', minVersion: '1.3.2' }
    const problems = await findDependsOnBelowPublished(dependsOn, releasesById({}))
    expect(problems).toEqual([
      {
        id: 'np.Shared',
        name: '',
        minVersion: '1.3.2',
        latest: null,
        fetchFailed: false,
      },
    ])
  })

  test('reports a fetch failure separately from an empty release list', async () => {
    const dependsOn = [{ id: 'np.Shared', name: 'Shared Resources', minVersion: '1.3.2' }]
    const problems = await findDependsOnBelowPublished(dependsOn, releasesById({ 'np.Shared': null }))
    expect(problems[0].fetchFailed).toBe(true)
    expect(problems[0].latest).toBe(null)
  })

  test('returns only the dependencies that are not published', async () => {
    const dependsOn = [
      { id: 'np.Shared', name: 'Shared Resources', minVersion: '1.3.2' },
      { id: 'jgclark.Reviews', name: 'Projects + Reviews', minVersion: '2.0.0' },
    ]
    const problems = await findDependsOnBelowPublished(
      dependsOn,
      releasesById({
        'np.Shared': [{ version: '1.3.2' }],
        'jgclark.Reviews': [{ version: '1.9.0' }],
      }),
    )
    expect(problems.map((problem) => problem.id)).toEqual(['jgclark.Reviews'])
  })
})
