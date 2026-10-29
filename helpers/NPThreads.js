// @flow
//-------------------------------------------------------------------------------
// NotePlan threading helpers (async / main thread)
// Last updated 2026-10-28 by @jgclark + @CursorAI
//-------------------------------------------------------------------------------

import { logInfo, logWarn } from './dev'
import { usersVersionHas } from './NPVersions'

/** Default items per runOnAsyncThread invocation when `options.items` is set. */
export const DEFAULT_ASYNC_THREAD_BATCH_SIZE = 100

/** Default how often callers should refresh CommandBar.showLoading during a batched scan (every N items). */
export const DEFAULT_ASYNC_THREAD_DIALOG_UPDATE_INTERVAL = 20

export type TAsyncThreadBatchCompleteInfo = {
  startIndex: number,
  endIndex: number,
  total: number,
  batchIndex: number,
  batchCount: number,
  /** Resolved dialog refresh cadence (options.dialogUpdateInterval or DEFAULT_ASYNC_THREAD_DIALOG_UPDATE_INTERVAL). */
  dialogUpdateInterval: number,
}

/**
 * Options for `runSyncWorkOnAsyncThread`.
 * When `items` is set, the second argument is treated as a per-batch worker and work is split into
 * short async-thread calls with a main-thread breather between batches (NotePlan/plugins#793).
 */
export type TRunSyncWorkOnAsyncThreadOptions = {
  /** When set, run `work` as `(batch, startIndex, endIndex, dialogUpdateInterval) => mixed` over these items in batches. */
  items?: $ReadOnlyArray<mixed>,
  /** Items per async-thread call when `items` is set (default DEFAULT_ASYNC_THREAD_BATCH_SIZE). */
  batchSize?: number,
  /**
   * How often to refresh progress UI during a batched scan (every N items).
   * Passed to the batch worker as the 4th argument; default DEFAULT_ASYNC_THREAD_DIALOG_UPDATE_INTERVAL.
   */
  dialogUpdateInterval?: number,
  /**
   * Called on the main thread after each batch's await settles (only when `items` is set).
   * Use for CommandBar.showLoading / banners -- not for heavy TNote reads.
   */
  onBatchComplete?: (info: TAsyncThreadBatchCompleteInfo) => Promise<mixed> | mixed,
}

/**
 * Resolve dialog refresh cadence from options (positive override, else default).
 * @param {?TRunSyncWorkOnAsyncThreadOptions} options
 * @returns {number}
 */
export function resolveAsyncThreadDialogUpdateInterval(options: ?TRunSyncWorkOnAsyncThreadOptions): number {
  const raw = options != null ? options.dialogUpdateInterval : null
  return raw != null && raw > 0 ? raw : DEFAULT_ASYNC_THREAD_DIALOG_UPDATE_INTERVAL
}

/**
 * Run one sync callback on the async thread (single-shot):
 *   await runSyncWorkOnAsyncThread(label, () => { ...; return primitive })
 *
 * Or scan a list in short batches with a main-thread breather between them:
 *   await runSyncWorkOnAsyncThread(label, (batch, start, end, dialogUpdateInterval) => { ... }, {
 *     items, batchSize?, dialogUpdateInterval?, onBatchComplete?,
 *   })
 *
 * Feature-gated by `usersVersionHas('runOnAsyncThread')` (API from 3.21.3); falls back to the main
 * thread when the feature is off or the async API rejects / misuse-errors.
 *
 * Rules for the sync callback (from CommandBar.runOnAsyncThread docs):
 * - Must be synchronous (no `async` / `await` inside).
 * - Do not call UI bridge APIs other than `CommandBar.showLoading`; save/prompts/Editor after await.
 *
 * Prefer returning only primitives from the callback. Returning large objects has hung the Promise
 * live (scan finished, await never resumed). Prefer outer side-channel variables for large results.
 *
 * Why batches when `items` is set: long loops that read live `TNote` bridge fields inside a single
 * `runOnAsyncThread` call have left the Promise unresolved forever (NotePlan/plugins#793).
 *
 * API misuse errors are delivered via `.catch()`, not try/catch around await.
 *
 * @param {string} label - short label for logs
 * @param {Function} work - sync single-shot `() => mixed`, or when `options.items` is set:
 *   `(batch, startIndex, endIndex, dialogUpdateInterval) => mixed`
 * @param {TRunSyncWorkOnAsyncThreadOptions} [options]
 * @returns {Promise<any>} single-shot: callback result; batched: void
 */
export async function runSyncWorkOnAsyncThread(
  label: string,
  // Single-shot: () => mixed. Batched (when options.items set): (batch, start, end, dialogUpdateInterval) => mixed.
  // Typed as Function so both call shapes and Jest mocks type-check without overloads.
  work: Function,
  options: ?TRunSyncWorkOnAsyncThreadOptions = null,
): Promise<any> {
  const items = options != null ? options.items : null
  if (items != null) {
    await runSyncWorkOnAsyncThreadBatched(label, items, work, options ?? {})
    return
  }
  return runSyncWorkOnAsyncThreadOnce(label, work)
}

/**
 * Single async-thread (or main-thread fallback) invocation.
 * @param {string} label
 * @param {() => mixed} work
 * @returns {Promise<any>}
 */
async function runSyncWorkOnAsyncThreadOnce(label: string, work: () => mixed): Promise<any> {
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

/**
 * Internal: split `items` across short `runSyncWorkOnAsyncThreadOnce` calls.
 * @param {string} label
 * @param {Array<mixed>} items
 * @param {Function} processBatch
 * @param {TRunSyncWorkOnAsyncThreadOptions} options
 * @returns {Promise<void>}
 */
async function runSyncWorkOnAsyncThreadBatched(
  label: string,
  items: $ReadOnlyArray<mixed>,
  processBatch: (
    batch: $ReadOnlyArray<mixed>,
    startIndex: number,
    endIndex: number,
    dialogUpdateInterval: number,
  ) => mixed,
  options: TRunSyncWorkOnAsyncThreadOptions,
): Promise<void> {
  const total = items.length
  if (total === 0) {
    logInfo('runSyncWorkOnAsyncThread', `${label}: nothing to do (0 items)`)
    return
  }

  const rawBatchSize = options.batchSize != null ? options.batchSize : DEFAULT_ASYNC_THREAD_BATCH_SIZE
  const batchSize = rawBatchSize > 0 ? rawBatchSize : DEFAULT_ASYNC_THREAD_BATCH_SIZE
  const dialogUpdateInterval = resolveAsyncThreadDialogUpdateInterval(options)
  const batchCount = Math.ceil(total / batchSize)
  logInfo(
    'runSyncWorkOnAsyncThread',
    `${label}: ${String(total)} items in ${String(batchCount)} batch(es) of up to ${String(batchSize)} (dialog every ${String(dialogUpdateInterval)})`,
  )

  for (let batchIndex = 0, start = 0; start < total; batchIndex++, start += batchSize) {
    const end = Math.min(start + batchSize, total)
    const slice = items.slice(start, end)
    const batchLabel = `${label} ${String(start + 1)}-${String(end)}/${String(total)}`
    await runSyncWorkOnAsyncThreadOnce(batchLabel, () => {
      processBatch(slice, start, end, dialogUpdateInterval)
      return true
    })
    if (options.onBatchComplete) {
      await options.onBatchComplete({
        startIndex: start,
        endIndex: end,
        total,
        batchIndex,
        batchCount,
        dialogUpdateInterval,
      })
    }
  }
}
