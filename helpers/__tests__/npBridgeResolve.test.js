/* eslint-disable no-undef */
/**
 * @jest-environment node
 */
// @flow

import {
  awaitBridgedValue,
  awaitDataStoreBridgeValue,
  awaitDataStoreProp,
  awaitTopLevelApiProp,
  isDataStorePropSyncPlainObject,
  isTopLevelApiPropSyncPlainObject,
} from '../npBridgeResolve'

describe('npBridgeResolve', () => {
  const originalDS = global.DataStore
  const originalCal = global.Calendar

  afterEach(() => {
    global.DataStore = originalDS
    global.Calendar = originalCal
  })

  test('awaitTopLevelApiProp reads plain object from arbitrary namespace', async () => {
    const Calendar = { events: [{ id: '1' }] }
    const e = await awaitTopLevelApiProp(Calendar, 'events')
    expect(e).toEqual([{ id: '1' }])
  })

  test('awaitTopLevelApiProp invokes method with namespace as this', async () => {
    const Calendar = {
      items: function () {
        return this._items
      },
      _items: [1, 2],
    }
    const v = await awaitTopLevelApiProp(Calendar, 'items')
    expect(v).toEqual([1, 2])
  })

  test('awaitDataStoreProp delegates to generic helper', async () => {
    global.DataStore = { settings: { _logLevel: 'DEBUG' } }
    const s = await awaitDataStoreProp('settings')
    expect(s._logLevel).toBe('DEBUG')
  })

  test('awaitDataStoreProp awaits thenable', async () => {
    global.DataStore = {
      folders: Promise.resolve(['a/']),
    }
    const f = await awaitDataStoreProp('folders')
    expect(f).toEqual(['a/'])
  })

  test('awaitDataStoreProp invokes function accessor', async () => {
    global.DataStore = {
      teamspaces: function () {
        return [{ title: 'T1' }]
      },
    }
    const t = await awaitDataStoreProp('teamspaces')
    expect(t).toEqual([{ title: 'T1' }])
  })

  test('awaitBridgedValue passes thisArg for nested function returning promise', async () => {
    global.DataStore = {}
    const api = {
      x: function () {
        return Promise.resolve(42)
      },
    }
    const v = await awaitBridgedValue(api.x, api)
    expect(v).toBe(42)
  })

  test('awaitDataStoreBridgeValue follows function returning promise', async () => {
    global.DataStore = {}
    const v = await awaitDataStoreBridgeValue(() => Promise.resolve(42))
    expect(v).toBe(42)
  })

  test('isTopLevelApiPropSyncPlainObject / DataStore wrapper', () => {
    global.DataStore = { settings: { a: 1 } }
    expect(isDataStorePropSyncPlainObject('settings')).toBe(true)
    expect(isTopLevelApiPropSyncPlainObject(DataStore, 'settings')).toBe(true)
    global.DataStore = { x: Promise.resolve(1) }
    expect(isDataStorePropSyncPlainObject('x')).toBe(false)
  })
})
