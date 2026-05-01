// @flow
//-----------------------------------------------------------------------------
// Batch migration: run Project constructor with migrateInProjectConstructor on all notes that match list settings.
// Last updated 2026-05-01 for v2.0.0.b28 by @Cursor
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { enumerateMatchingProjectNoteTagPairs, writeAllProjectsList } from './allProjectsListHelpers.js'
import { Project } from './projectClass.js'
import { getReviewSettings } from './reviewHelpers.js'
import { logDebug, logInfo, logTimer, logWarn } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

const pluginID = 'jgclark.Reviews'
const migrationLogFilename = `../${pluginID}/migration_log.tsv`
const MIGRATION_TSV_HEADER = 'filename\ttitle\tdate\tdetail'
const SEQUENTIAL_TAG_DEFAULT = '#sequential'

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

/**
 * Run constructor-driven metadata migration on every project note that matches current Reviews settings (same set as `allProjectsList.json`).
 * Appends rows to `migration_log.tsv`, shows CommandBar progress, then `showMessage` with counts.
 * @returns {Promise<void>}
 */
export async function migrateAllProjects(): Promise<void> {
  const startTime = moment().toDate()
  let commandBarActive = false
  try {
    const config = await getReviewSettings()
    if (!config) {
      await showMessage('No Projects & Reviews settings found. Stopping.', 'OK', 'Reviews')
      return
    }
    if (config.useDemoData === true) {
      logWarn('migrateAllProjects', 'useDemoData is on; skipping migration of live project notes.')
      return
    }

    logInfo('migrateAllProjects', 'Starting batch migration (constructor migrate flag) …')
    const pairs = await enumerateMatchingProjectNoteTagPairs(config, false)
    const total = pairs.length
    logInfo('migrateAllProjects', `Found ${String(total)} note/tag pair(s) to process.`)

    if (total === 0) {
      logTimer('migrateAllProjects', startTime, '- no pairs')
      await showMessage('No project notes matched current settings. Nothing to migrate.', 'OK', 'Reviews')
      return
    }

    const sequentialTagResolved = config.sequentialTag ? config.sequentialTag : SEQUENTIAL_TAG_DEFAULT
    const nextActionTags = config.nextActionTags ?? []
    const migratedProjects: Array<Project> = []
    let successCount = 0
    let failCount = 0

    try {
      CommandBar.showLoading(true, `Migrating project notes\n0/${String(total)}`, 0)
      commandBarActive = true
      let index = 0
      for (const { note, projectTypeTag: tag } of pairs) {
        index += 1
        CommandBar.showLoading(true, `Migrating project notes\n${String(index)}/${String(total)}`, index / total)
        try {
          // Constructor performs migrations when migrateInProjectConstructor is true
          const migratedProject = new Project(note, tag, false, nextActionTags, sequentialTagResolved, true)
          migratedProjects.push(migratedProject)
          successCount += 1
        } catch (error) {
          failCount += 1
          const msg = error != null && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : String(error)
          appendMigrationLogRow(note, msg)
          logInfo('migrateAllProjects', `FAIL ${note.filename ?? ''}: ${msg}`)
        }
      }
    } finally {
      if (commandBarActive) {
        CommandBar.showLoading(false)
        commandBarActive = false
      }
    }

    logInfo('migrateAllProjects', `Finished. Migrated successfully: ${String(successCount)} notes, failed: ${String(failCount)} notes.`)
    logTimer('migrateAllProjects', startTime, `success=${String(successCount)} fail=${String(failCount)}`)

    await writeAllProjectsList(migratedProjects)
    logDebug('migrateAllProjects', `And also re-wrote ${String(migratedProjects.length)} projects to the allProjectsList.json file`)

    await showMessage(
      `Migration finished.\n\nMigrated successfully: ${String(successCount)} notes\nFailed: ${String(failCount)} notes.\n\nDetails were appended to migration_log.tsv where migrations/errors occurred.`,
      'OK',
      'Migrated Project notes',
    )
  } catch (error) {
    const msg = error != null && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : String(error)
    logWarn('migrateAllProjects', `Stopped with error: ${msg}`)
    logTimer('migrateAllProjects', startTime, `error: ${msg}`)
    await showMessage(`Migration stopped with an error:\n\n${msg}`, 'OK', 'Migrated Project notes')
  } finally {
    if (commandBarActive) {
      CommandBar.showLoading(false)
    }
  }
}

