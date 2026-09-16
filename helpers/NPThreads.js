// @flow
//-------------------------------------------------------------------------------
// NotePlan threading helpers (async / main thread)
// Last updated 2026-09-15 by @jgclark + @CursorAI
//-------------------------------------------------------------------------------

import { logInfo, logWarn } from './dev'
import { usersVersionHas } from './NPVersions'

/**
 * Run synchronous heavy work on a background thread when `usersVersionHas('runOnAsyncThread')`.
 * That feature is gated in `NPVersions.js` (API call available from 3.21.3).
 * Falls back to the main thread when the feature is off, or if the async API rejects / misuse-errors.
 *
 * Rules for `work` (from CommandBar.runOnAsyncThread docs):
 * - Must be synchronous (no `async` / `await` inside).
 * - Do not call UI bridge APIs other than `CommandBar.showLoading`; save/prompts/Editor after await.
 *
 * API misuse errors are delivered via `.catch()`, not try/catch around await.
 *
 * @param {string} label - short label for logs
 * @param {() => mixed} work - must be synchronous (no async/await inside)
 * @returns {Promise<any>}
 */
export async function runSyncWorkOnAsyncThread(label: string, work: () => mixed): Promise<any> {
  if (!usersVersionHas('runOnAsyncThread')) {
    logInfo('runSyncWorkOnAsyncThread', `${label}: main thread (runOnAsyncThread feature not available)`)
    return work()
  }

  logInfo('runSyncWorkOnAsyncThread', `${label}: starting on async thread`)
  // Note: API misuse errors are delivered via `.catch()`, not try/catch around await. But the catch can't be chained to the await, so we need to store the error in a variable and check it after await.
  let apiError: mixed = null
  const pending = CommandBar.runOnAsyncThread(work)
  pending.catch((err: mixed) => {
    apiError = err
  })

  const result: mixed = await pending

  if (apiError != null) {
    const errText = apiError instanceof Error ? apiError.message : String(apiError)
    logWarn('runSyncWorkOnAsyncThread', `${label}: async API error (${errText}); falling back to main thread`)
    return work()
  }
  logInfo('runSyncWorkOnAsyncThread', `${label}: async thread finished (typeof result=${typeof result})`)
  return result
}
