/* global jest, describe, test, expect, beforeEach, afterEach */

const mockUnref = jest.fn()
const mockSpawn = jest.fn(() => ({ unref: mockUnref }))

jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process')
  return {
    ...actual,
    spawn: (...args) => mockSpawn(...args),
  }
})

const { notifyWithoutBlocking } = require('../shared')

describe('notifyWithoutBlocking', () => {
  const originalPlatform = process.platform

  beforeEach(() => {
    mockSpawn.mockClear()
    mockUnref.mockClear()
    mockSpawn.mockReturnValue({ unref: mockUnref })
    Object.defineProperty(process, 'platform', { value: 'darwin' })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  test('should spawn a detached, unrefed process so Node does not wait on the notifier', () => {
    notifyWithoutBlocking('NotePlan Plugin Build', 'Daily Journal v1.16.0')

    expect(mockSpawn).toHaveBeenCalledTimes(1)
    const [, args, options] = mockSpawn.mock.calls[0]
    expect(args).toEqual(['-title', 'NotePlan Plugin Build', '-message', 'Daily Journal v1.16.0'])
    expect(options).toEqual({ detached: true, stdio: 'ignore' })
    expect(mockUnref).toHaveBeenCalledTimes(1)
  })

  test('should not spawn when title and message are empty', () => {
    notifyWithoutBlocking('', '')
    expect(mockSpawn).not.toHaveBeenCalled()
  })
})
