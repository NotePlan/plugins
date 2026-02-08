// @flow
/**
 * Promise polyfill for NotePlan's JSContext
 * NotePlan's JavaScript environment may not have Promise.resolve(), Promise.all(), or Promise.race()
 * This module provides polyfills for these methods if they don't exist
 */

/**
 * Polyfill for Promise.resolve() if it doesn't exist
 * @param {any} value - The value to resolve
 * @returns {Promise<any>}
 */
export function promiseResolve(value: any): Promise<any> {
  if (typeof Promise !== 'undefined' && typeof Promise.resolve === 'function') {
    return Promise.resolve(value)
  }
  // Fallback: create a new promise that resolves immediately
  return new Promise((resolve) => {
    resolve(value)
  })
}

/**
 * Polyfill for Promise.race() if it doesn't exist
 * Returns a promise that settles with the value/reason of the first promise to settle.
 * @param {Array<Promise<any>>} promises - Array of promises to race
 * @returns {Promise<any>}
 */
export function promiseRace(promises: Array<Promise<any>>): Promise<any> {
  if (typeof Promise !== 'undefined' && typeof Promise.race === 'function') {
    return Promise.race(promises)
  }
  return new Promise((resolve, reject) => {
    if (!Array.isArray(promises) || promises.length === 0) {
      return // Per spec, Promise.race([]) stays pending forever
    }
    let settled = false
    const onFulfill = (v: any) => {
      if (!settled) {
        settled = true
        resolve(v)
      }
    }
    const onReject = (e: any) => {
      if (!settled) {
        settled = true
        reject(e)
      }
    }
    for (let i = 0; i < promises.length; i++) {
      const p = promises[i]
      // $FlowFixMe[method-unbinding] - typeof/.then used for thenable check and subscribe; thenable contract does not use this
      if (p != null && typeof p.then === 'function') {
        p.then(onFulfill, onReject)
      } else {
        onFulfill(p)
      }
    }
  })
}

/**
 * Polyfill for Promise.all() if it doesn't exist
 * @param {Array<Promise<any>>} promises - Array of promises to wait for
 * @returns {Promise<Array<any>>}
 */
export function promiseAll(promises: Array<Promise<any>>): Promise<Array<any>> {
  if (typeof Promise !== 'undefined' && typeof Promise.all === 'function') {
    return Promise.all(promises)
  }
  // Fallback: manually resolve all promises
  return new Promise((resolve, reject) => {
    if (!Array.isArray(promises) || promises.length === 0) {
      resolve([])
      return
    }
    const results = []
    let completed = 0
    let hasError = false
    promises.forEach((promise, index) => {
      promise
        .then((value) => {
          if (!hasError) {
            results[index] = value
            completed++
            if (completed === promises.length) {
              resolve(results)
            }
          }
        })
        .catch((error) => {
          if (!hasError) {
            hasError = true
            reject(error)
          }
        })
    })
  })
}

/**
 * Yield to the event loop - allows other operations to proceed
 * This is a simple way to yield control without blocking the UI thread
 * @returns {Promise<void>}
 */
function yieldToEventLoop(): Promise<void> {
  return promiseResolve(undefined)
}

/**
 * Polyfill for setTimeout() using async/await and yield
 * NotePlan's JSContext doesn't have setTimeout, so we use a yield-based approach
 * This doesn't provide exact timing but allows other operations to proceed
 * @param {Function} callback - Function to call after delay
 * @param {number} delayMs - Delay in milliseconds (approximate)
 * @returns {Promise<void>}
 */
export async function setTimeoutPolyfill(callback: () => void | Promise<void>, delayMs: number): Promise<void> {
  // For very short delays, just yield once
  if (delayMs < 10) {
    await yieldToEventLoop()
    await callback()
    return
  }

  // For longer delays, yield multiple times
  // Each yield is approximately 1-5ms, so we'll do multiple yields
  const iterations = Math.max(1, Math.floor(delayMs / 5))
  for (let i = 0; i < iterations; i++) {
    await yieldToEventLoop()
  }
  await callback()
}

/**
 * Simple delay that resolves after ms. Uses setTimeout when available, otherwise setTimeoutPolyfill.
 * Use before/after LBB logs to yield so the log buffer has time to flush before a crash.
 * @param {number} ms - Delay in milliseconds
 * @returns {Promise<void>}
 */
export function delayMs(ms: number): Promise<void> {
  if (typeof setTimeout !== 'undefined') {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
  return setTimeoutPolyfill(() => {}, ms)
}

/**
 * Wait for a condition to be true, checking periodically
 * @param {Function} condition - Function that returns true when condition is met
 * @param {Object} options - Options for waiting
 * @param {number} options.maxWaitMs - Maximum time to wait in milliseconds (default: 2000)
 * @param {number} options.checkIntervalMs - How often to check in milliseconds (default: 50)
 * @returns {Promise<boolean>} - True if condition was met, false if timeout
 */
export async function waitForCondition(condition: () => boolean | Promise<boolean>, options: { maxWaitMs?: number, checkIntervalMs?: number } = {}): Promise<boolean> {
  const maxWaitMs = options.maxWaitMs || 2000
  const checkIntervalMs = options.checkIntervalMs || 50
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const result = await condition()
    if (result) {
      return true
    }
    await setTimeoutPolyfill(() => {}, checkIntervalMs)
  }
  return false
}

/**
 * Initialize Promise polyfills if needed
 * This should be called early in plugin initialization
 */
export function initPromisePolyfills(): void {
  if (typeof Promise !== 'undefined') {
    // Add Promise.resolve if it doesn't exist
    if (typeof Promise.resolve !== 'function') {
      // $FlowIgnore - we're adding a polyfill
      Promise.resolve = promiseResolve
    }
    // Add Promise.all if it doesn't exist
    if (typeof Promise.all !== 'function') {
      // $FlowIgnore - we're adding a polyfill
      Promise.all = promiseAll
    }
    // Add Promise.race if it doesn't exist
    if (typeof Promise.race !== 'function') {
      // $FlowIgnore - we're adding a polyfill
      Promise.race = promiseRace
    }
  }
}
