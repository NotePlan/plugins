// @flow
//-----------------------------------------------------------------------------
// TSV migration log (migration_log.tsv) — leaf module with no plugin-internal imports.
// Used by reviewHelpers (body migration) and migration.js (batch migrate). Breaks require cycle:
// reviewHelpers <-> migration.js.
// Last updated 2026-05-02 for v2.0.0.b29, @Cursor
//-----------------------------------------------------------------------------

import { logWarn } from '@helpers/dev'

const pluginID = 'jgclark.Reviews'
const migrationLogFilename = `../${pluginID}/migration_log.tsv`
const MIGRATION_TSV_HEADER = 'filename\ttitle\tdate\tdetail'

/** When > 0, `appendMigrationLogRow` is a no-op unless `force` is true (used during `/migrate all projects` so only one row is written per note). */
let migrationLogSuppressDepth = 0

/**
 * Begin suppressing TSV writes from nested migration helpers while a batch `Project` construction runs.
 * @returns {void}
 */
export function beginSuppressMigrationLogForBatchConstruction(): void {
  migrationLogSuppressDepth += 1
}

/**
 * End suppression started by `beginSuppressMigrationLogForBatchConstruction`.
 * @returns {void}
 */
export function endSuppressMigrationLogForBatchConstruction(): void {
  migrationLogSuppressDepth = Math.max(0, migrationLogSuppressDepth - 1)
}

/**
 * Replace characters that would break a TSV row.
 * @param {string} value
 * @returns {string}
 */
function sanitizeTsvCell(value: string): string {
  return String(value).replace(/[\t\n\r]/g, ' ')
}

/**
 * Append a single migration event row to migration_log.tsv.
 * The `date` column is always the current datetime in full ISO format.
 * @param { string } filename noteLike
 * @param { string } title noteLike
 * @param { string } detail
 * @param {{ force?: boolean }?} options - If `force` is true, write even while batch construction suppression is active (not used by default).
 * @returns {void}
 */
export function appendMigrationLogRow(
  filenameIn: string,
  titleIn: string,
  detail: string,
  options?: { force?: boolean },
): void {
  if (migrationLogSuppressDepth > 0 && options?.force !== true) {
    return
  }
  const filename = sanitizeTsvCell(filenameIn ?? '')
  const title = sanitizeTsvCell(titleIn ?? '')
  const dateIso = new Date().toISOString()
  const detailSafe = sanitizeTsvCell(detail)
  const newLine = `${filename}\t${title}\t${dateIso}\t${detailSafe}`

  let existing: ?string = null
  if (DataStore.fileExists(migrationLogFilename)) {
    existing = DataStore.loadData(migrationLogFilename, true)
  }

  let out: string
  if (existing == null || existing === '') {
    out = `${MIGRATION_TSV_HEADER}\n${newLine}`
  } else {
    const trimmed = String(existing).replace(/\s+$/, '')
    out = `${trimmed}\n${newLine}`
  }
  const ok = DataStore.saveData(out, migrationLogFilename, true)
  if (!ok) {
    logWarn('appendMigrationLogRow', `Could not write ${migrationLogFilename}`)
  }
}
