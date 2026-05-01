// @flow
//-----------------------------------------------------------------------------
// Shared migration logging to migration_log.tsv
// by @jgclark / @Cursor
//-----------------------------------------------------------------------------

import { logWarn } from '@helpers/dev'

const pluginID = 'jgclark.Reviews'
const migrationLogFilename = `../${pluginID}/migration_log.tsv`
const MIGRATION_TSV_HEADER = 'filename\ttitle\tdate\tdetail'

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
 * @param {{ filename?: string, title?: string }} noteLike
 * @param {string} detail
 * @returns {void}
 */
export function appendMigrationLogRow(
  noteLike: { filename?: string, title?: string },
  detail: string,
): void {
  const filename = sanitizeTsvCell(noteLike?.filename ?? '')
  const title = sanitizeTsvCell(noteLike?.title ?? '')
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

