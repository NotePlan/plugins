// @flow
//-----------------------------------------------------------------------------
// Project metadata migration: batch command `migrateAllProjects`.
// TSV logging lives in `migrationLog.js` (used by `reviewHelpers` and this file) to avoid a require cycle.
// Last updated 2026-05-02 for v2.0.0.b29 by @Cursor
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { enumerateMatchingProjectNoteTagPairs, writeAllProjectsList } from './allProjectsListHelpers.js'
import {
  appendMigrationLogRow,
  beginSuppressMigrationLogForBatchConstruction,
  endSuppressMigrationLogForBatchConstruction,
} from './migrationLog.js'
import { Project } from './projectClass.js'
import { getReviewSettings } from './reviewHelpers.js'
import { logDebug, logInfo, logTimer, logWarn } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

const SEQUENTIAL_TAG_DEFAULT = '#sequential'

/**
 * Run constructor-driven metadata migration on every project note that matches current Reviews settings (same set as `allProjectsList.json`).
 * Appends rows to `migration_log.tsv`, shows CommandBar progress, then `showMessage` with migrated-ok / issues / no-op / constructor-fail counts.
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
    /** Constructor ran migration helpers and wrote a successful `ok` detail (matches typical “actually migrated” notes). */
    let migrationOkCount = 0
    /** Constructor set a non-ok migration detail (e.g. merge failure); see `migration_log.tsv`. */
    let migrationIssueCount = 0
    /** Constructor succeeded but no metadata migration ran (no TSV row for this pair). */
    let noMigrationNeededCount = 0

    try {
      CommandBar.showLoading(true, `Migrating project notes\n0/${String(total)}`, 0)
      commandBarActive = true
      let index = 0
      for (const { note, projectTypeTag: tag } of pairs) {
        index += 1
        CommandBar.showLoading(true, `Migrating project notes\n${String(index)}/${String(total)}`, index / total)
        let constructionError: ?string = null
        let migratedProject: ?Project = null
        beginSuppressMigrationLogForBatchConstruction()
        try {
          // Constructor performs migrations when migrateInProjectConstructor is true
          migratedProject = new Project(note, tag, false, nextActionTags, sequentialTagResolved, true)
          migratedProjects.push(migratedProject)
          successCount += 1
        } catch (error) {
          failCount += 1
          constructionError =
            error != null && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : String(error)
          logInfo('migrateAllProjects', `FAIL ${note.filename ?? ''}: ${constructionError}`)
        } finally {
          endSuppressMigrationLogForBatchConstruction()
        }
        const batchMigrationDetail = migratedProject?.migrationLogDetailFromConstructor ?? null
        if (constructionError != null) {
          appendMigrationLogRow(note.filename ?? '', note.title ?? '', constructionError)
        } else if (batchMigrationDetail != null) {
          appendMigrationLogRow(note.filename ?? '', note.title ?? '', batchMigrationDetail)
          if (batchMigrationDetail === 'ok') {
            migrationOkCount += 1
          } else {
            migrationIssueCount += 1
          }
        } else {
          noMigrationNeededCount += 1
        }
      }
    } finally {
      if (commandBarActive) {
        CommandBar.showLoading(false)
        commandBarActive = false
      }
    }

    logInfo(
      'migrateAllProjects',
      `Finished. migratedOk=${String(migrationOkCount)} migrationIssues=${String(migrationIssueCount)} noMigrationNeeded=${String(
        noMigrationNeededCount,
      )} constructorFail=${String(failCount)} (pairs processed=${String(successCount + failCount)})`,
    )
    logTimer(
      'migrateAllProjects',
      startTime,
      `ok=${String(migrationOkCount)} issues=${String(migrationIssueCount)} noop=${String(noMigrationNeededCount)} fail=${String(failCount)}`,
    )

    await writeAllProjectsList(migratedProjects)
    logDebug('migrateAllProjects', `And also re-wrote ${String(migratedProjects.length)} projects to the allProjectsList.json file`)

    const summaryLines: Array<string> = ['Migration finished.', '']
    summaryLines.push(`Successfully migrated: ${String(migrationOkCount)} note(s)`)
    if (migrationIssueCount > 0) {
      summaryLines.push(`Migration issues (see migration_log.tsv): ${String(migrationIssueCount)} note(s)`)
    }
    summaryLines.push(`No migration needed: ${String(noMigrationNeededCount)} note(s)`)
    if (failCount > 0) {
      summaryLines.push(`Failed (could not build project): ${String(failCount)} note(s)`)
    }
    summaryLines.push('', 'Details of each migration were appended to migration_log.tsv.')

    await showMessage(summaryLines.join('\n'), 'OK', 'Migrated Project notes')
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

