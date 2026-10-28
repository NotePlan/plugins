// @flow
/* globals beforeEach, describe, expect, jest, test */

import { CommandBar } from '@mocks/index'
import {
  DEFAULT_ASYNC_THREAD_BATCH_SIZE,
  DEFAULT_ASYNC_THREAD_DIALOG_UPDATE_INTERVAL,
  runSyncWorkOnAsyncThread,
} from '../NPThreads'

jest.mock('../NPVersions', () => ({
  usersVersionHas: jest.fn(() => false),
}))

const { usersVersionHas } = require('../NPVersions')
const mockUsersVersionHas: any = usersVersionHas

global.CommandBar = CommandBar

describe('runSyncWorkOnAsyncThread', () => {
  beforeEach(() => {
    mockUsersVersionHas.mockReset()
    CommandBar.runOnAsyncThread = jest.fn((fn) => Promise.resolve(fn()))
  })

  test('runs on main thread when feature is off', async () => {
    mockUsersVersionHas.mockReturnValue(false)
    const work = jest.fn(() => 42)
    await expect(runSyncWorkOnAsyncThread('test', work)).resolves.toBe(42)
    expect(CommandBar.runOnAsyncThread).not.toHaveBeenCalled()
    expect(work).toHaveBeenCalledTimes(1)
  })

  test('uses runOnAsyncThread when feature is on', async () => {
    mockUsersVersionHas.mockImplementation((feature: string) => feature === 'runOnAsyncThread')
    const work = jest.fn(() => 'ok')
    await expect(runSyncWorkOnAsyncThread('test', work)).resolves.toBe('ok')
    expect(CommandBar.runOnAsyncThread).toHaveBeenCalledTimes(1)
  })

  test('does nothing for an empty items list', async () => {
    mockUsersVersionHas.mockReturnValue(false)
    const processBatch: JestMockFn<Array<mixed>, void> = jest.fn()
    await runSyncWorkOnAsyncThread('empty', processBatch, { items: [] })
    expect(processBatch).not.toHaveBeenCalled()
    expect(CommandBar.runOnAsyncThread).not.toHaveBeenCalled()
  })

  test('chunks items and calls onBatchComplete between batches on main thread', async () => {
    mockUsersVersionHas.mockReturnValue(false)
    const items = Array.from({ length: 250 }, (_, i) => i)
    const seen: Array<Array<number>> = []
    const completes: Array<number> = []
    await runSyncWorkOnAsyncThread(
      'chunk',
      (batch) => {
        // $FlowFixMe[incompatible-call] test accumulates numeric batches
        seen.push([...batch])
      },
      {
        items,
        batchSize: 100,
        onBatchComplete: ({ endIndex }) => {
          completes.push(endIndex)
        },
      },
    )
    expect(seen).toEqual([
      items.slice(0, 100),
      items.slice(100, 200),
      items.slice(200, 250),
    ])
    expect(completes).toEqual([100, 200, 250])
    expect(CommandBar.runOnAsyncThread).not.toHaveBeenCalled()
  })

  test('uses one runOnAsyncThread call per batch when feature is on and items are set', async () => {
    mockUsersVersionHas.mockImplementation((feature: string) => feature === 'runOnAsyncThread')
    const items = Array.from({ length: DEFAULT_ASYNC_THREAD_BATCH_SIZE + 1 }, (_, i) => `n${String(i)}`)
    const processBatch: JestMockFn<Array<mixed>, void> = jest.fn()
    await runSyncWorkOnAsyncThread('async-chunks', processBatch, { items })
    expect(CommandBar.runOnAsyncThread).toHaveBeenCalledTimes(2)
    expect(processBatch).toHaveBeenCalledTimes(2)
  })

  test('passes default dialogUpdateInterval to the batch worker when not specified', async () => {
    mockUsersVersionHas.mockReturnValue(false)
    const seenIntervals: Array<number> = []
    await runSyncWorkOnAsyncThread(
      'dialog-default',
      (_batch, _start, _end, dialogUpdateInterval) => {
        seenIntervals.push(dialogUpdateInterval)
      },
      { items: [1, 2, 3], batchSize: 10 },
    )
    expect(seenIntervals).toEqual([DEFAULT_ASYNC_THREAD_DIALOG_UPDATE_INTERVAL])
  })

  test('passes overridden dialogUpdateInterval to the batch worker', async () => {
    mockUsersVersionHas.mockReturnValue(false)
    const seenIntervals: Array<number> = []
    await runSyncWorkOnAsyncThread(
      'dialog-override',
      (_batch, _start, _end, dialogUpdateInterval) => {
        seenIntervals.push(dialogUpdateInterval)
      },
      { items: ['a'], dialogUpdateInterval: 7 },
    )
    expect(seenIntervals).toEqual([7])
  })
})
