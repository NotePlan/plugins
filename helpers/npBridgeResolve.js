// @flow
//--------------------------------------------------------------------------
// npBridgeResolve.js — resolve top-level NotePlan API members (DataStore,
// Calendar, …) across plugin JSContext and HTML WebView. In WebView, many
// properties are awaitable (Thenable) or function accessors; in plugin code
// they are often plain values.
//
// Prefer: await awaitTopLevelApiProp(DataStore, 'folders')
//     or: await awaitTopLevelApiProp(Calendar, 'someProp')
//
// Thin wrappers `awaitDataStoreProp` / `isDataStorePropSyncPlainObject` remain
// for call sites that only touch DataStore.
//
// Do not long-cache results for data that changes during the session unless you
// own invalidation.
//--------------------------------------------------------------------------

/**
 * Normalize a value from an NP bridge (or nested result after invocation).
 * - null / undefined: as-is
 * - Thenable: awaited once
 * - function: invoked as `fn.call(thisArg)` when thisArg is defined; else `fn()`
 * - other: returned as-is
 *
 * @param {*} raw
 * @param {*} [thisArg] - `this` for bridged methods (e.g. pass `DataStore` when resolving `DataStore.settings`).
 * @returns {Promise<*>}
 */
export async function awaitBridgedValue(raw: any, thisArg?: any): Promise<any> {
  if (raw == null) {
    return raw
  }
  if (typeof raw === 'object' && typeof raw.then === 'function') {
    return await raw
  }
  if (typeof raw === 'function') {
    try {
      const invoked = thisArg !== undefined ? raw.call(thisArg) : raw()
      return await awaitBridgedValue(invoked, undefined)
    } catch (_e) {
      return raw
    }
  }
  return raw
}

/**
 * Read `api[prop]` and resolve it for plugin and WebView (Thenable / function accessor).
 *
 * @example
 *   const settings = await awaitTopLevelApiProp(DataStore, 'settings')
 *   const events = await awaitTopLevelApiProp(Calendar, 'someCollectionOrMethod')
 *
 * @param {*} api - Top-level namespace (DataStore, Calendar, …)
 * @param {string} prop - Property name on that namespace
 * @returns {Promise<*>}
 */
export async function awaitTopLevelApiProp(api: any, prop: string): Promise<any> {
  if (api == null) {
    return undefined
  }
  const host: any = api
  const raw = host[prop]
  return await awaitBridgedValue(raw, api)
}

/**
 * True when `api[prop]` looks like a plain synchronous object (not a function, not a Thenable).
 * Arrays qualify as objects. Use on plugin-only paths to skip an async hop.
 *
 * @param {*} api
 * @param {string} prop
 * @returns {boolean}
 */
export function isTopLevelApiPropSyncPlainObject(api: any, prop: string): boolean {
  if (api == null) {
    return false
  }
  const host: any = api
  const raw = host[prop]
  if (raw == null) {
    return false
  }
  if (typeof raw === 'function') {
    return false
  }
  if (typeof raw === 'object' && typeof raw.then === 'function') {
    return false
  }
  return typeof raw === 'object'
}

// ---- DataStore-specific conveniences (global DataStore) ----

/**
 * @param {*} raw - Value read from DataStore (or nested); uses global `DataStore` as call `this` when defined.
 * @returns {Promise<*>}
 */
export async function awaitDataStoreBridgeValue(raw: any): Promise<any> {
  if (typeof DataStore === 'undefined') {
    if (typeof raw === 'function') {
      return raw
    }
    return await awaitBridgedValue(raw, undefined)
  }
  return await awaitBridgedValue(raw, DataStore)
}

/**
 * @param {string} prop - e.g. 'settings', 'folders', 'teamspaces'
 * @returns {Promise<*>}
 */
export async function awaitDataStoreProp(prop: string): Promise<any> {
  if (typeof DataStore === 'undefined') {
    return undefined
  }
  return await awaitTopLevelApiProp(DataStore, prop)
}

/**
 * @param {string} prop
 * @returns {boolean}
 */
export function isDataStorePropSyncPlainObject(prop: string): boolean {
  if (typeof DataStore === 'undefined') {
    return false
  }
  return isTopLevelApiPropSyncPlainObject(DataStore, prop)
}
