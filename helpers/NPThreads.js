// @flow
//-------------------------------------------------------------------------------
// NotePlan threading helpers (async / main thread)
// Last updated 2026-09-15 by @jgclark + @CursorAI
//-------------------------------------------------------------------------------

import { logDebug, logWarn } from './dev'
import { usersVersionHas } from './NPVersions'

/**
 * Run synchronous heavy work on a background thread when NotePlan supports it (v3.21.3+).
 * Falls back to the main thread on older NotePlan, or if the async call fails / returns null.
 * API misuse errors are delivered via `.catch()`, not try/catch around await.
 * The callback must be synchronous (no `async` / `await` inside). Do not call UI bridge APIs
 * other than `CommandBar.showLoading` inside `work`; save/prompts/Editor updates belong after await.
 *
 * **WARNING: (2026-09-15):** For the Shared tag/mention cache full scan, `CommandBar.runOnAsyncThread()`
 * appeared to run the callback (showLoading progress reached ~100%) but the returned Promise never resolved,
 * so code after `await` (save, hide loading) never ran. Do not use this helper for that workload until
 * confirmed fixed upstream.
 *
 * @param {string} label - short label for logs
 * @param {() => mixed} work - must be synchronous (no async/await inside)
 * @returns {Promise<any>}
 */
export async function runSyncWorkOnAsyncThread(label: string, work: () => mixed): Promise<any> {
  if (!usersVersionHas('runOnAsyncThread')) {
    logDebug('runSyncWorkOnAsyncThread', `${label}: main thread (NotePlan < 3.21.3)`)
    return work()
  }

  // Note: API misuse errors are delivered via `.catch()`, not try/catch around await.
  let apiError: mixed = null
  const result: mixed = await CommandBar.runOnAsyncThread(work).catch((err: mixed) => {
    apiError = err
    return null
  })
  if (apiError != null || result == null) {
    const errText = apiError != null ? (apiError instanceof Error ? apiError.message : String(apiError)) : 'null result'
    logWarn('runSyncWorkOnAsyncThread', `${label}: async path failed (${errText}); falling back to main thread`)
    return work()
  }
  logDebug('runSyncWorkOnAsyncThread', `${label}: completed on async thread`)
  return result
}
