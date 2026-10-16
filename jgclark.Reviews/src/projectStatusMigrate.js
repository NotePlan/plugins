// @flow
//-----------------------------------------------------------------------------
// Vault-wide metadata-term rename offer (settings change).
// Kept separate from projectStatus.js to avoid import cycles with allProjectsListHelpers.
// Last updated 2026-10-16 for v2.4.0 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import {
  enumerateMatchingProjectNoteTagPairs,
  getConfigForVaultWideProjectRename,
  tryGetUniqueProjectNotesFromFreshAllProjectsList,
} from './allProjectsListHelpers'
import {
  applyMetadataTermRenameToNote,
  getMetadataTermRenames,
} from './projectStatus'
import type { ReviewConfig } from './reviewSettings'
import { checkString } from '@helpers/checkType'
import { logError, logInfo, logWarn } from '@helpers/dev'
import { showMessage, showMessageYesNo } from '@helpers/userInput'

/** Flip dryRun to false to apply renames for real. Object form avoids Flow constant-condition on a bare true. */
const METADATA_RENAME_OPTIONS: { dryRun: boolean } = { dryRun: false }

/**
 * Resolve unique project notes for vault-wide metadata renames.
 * Prefers every row in a recently written allProjectsList.json (age-fresh only -- does not
 * re-enumerate just because the active perspective differs from the union). Falls back to a
 * full tag enumerate over the all-perspectives union when the list is missing or too old.
 * @param {ReviewConfig} config
 * @returns {Promise<Array<TNote>>}
 */
async function getUniqueProjectNotesForMetadataRename(config: ReviewConfig): Promise<Array<TNote>> {
  const fromList = tryGetUniqueProjectNotesFromFreshAllProjectsList()
  if (fromList != null) {
    logInfo('getUniqueProjectNotesForMetadataRename', `Using ${String(fromList.length)} note(s) from allProjectsList (skipped tag enumerate)`)
    return fromList
  }

  const configForRename = getConfigForVaultWideProjectRename(config)
  if (configForRename.FFlag_UseCacheOfAllPerspectives === true && config.FFlag_UseCacheOfAllPerspectives !== true) {
    logInfo('getUniqueProjectNotesForMetadataRename', 'List missing/too old; enumerating all-perspectives union (not only the active perspective)')
  } else {
    logInfo('getUniqueProjectNotesForMetadataRename', 'allProjectsList missing or too old; falling back to enumerateMatchingProjectNoteTagPairs')
  }
  const pairs = await enumerateMatchingProjectNoteTagPairs(configForRename, true)
  const seen: Set<string> = new Set()
  const uniqueNotes: Array<TNote> = []
  for (const { note } of pairs) {
    if (note == null || note.filename == null) continue
    if (seen.has(note.filename)) continue
    seen.add(note.filename)
    uniqueNotes.push(note)
  }
  return uniqueNotes
}

/**
 * If metadata-term settings changed, offer to rename keys/values across all matching project notes.
 * @param {?{ [string]: any }} previousRaw
 * @param {?{ [string]: any }} currentRaw
 * @param {ReviewConfig} config
 * @returns {Promise<number>} number of notes updated
 */
export async function offerAndRunMetadataTermRenames(
  previousRaw: ?{ [string]: any },
  currentRaw: ?{ [string]: any },
  config: ReviewConfig,
): Promise<number> {
  const renames = getMetadataTermRenames(previousRaw, currentRaw)
  if (renames.length === 0) return 0

  const summary = renames.map((r) => `'${r.oldTerm}' → '${r.newTerm}'`).join(', ')
  const decision = await showMessageYesNo(
    `You changed metadata term(s): ${summary}.\n\nUpdate matching frontmatter keys, status hashtags, and @mentions on all project notes in the vault?`,
    ['Yes', 'No'],
    'Projects + Reviews',
  )
  if (decision !== 'Yes') {
    logInfo('offerAndRunMetadataTermRenames', 'User declined vault-wide metadata term rename')
    return 0
  }

  const hashtagSummary = renames.map((r) => `#${r.oldTerm} → #${r.newTerm}`).join(', ')
  logInfo('offerAndRunMetadataTermRenames', `Starting metadata-term rename: ${hashtagSummary}`)

  try {
    const uniqueNotes = await getUniqueProjectNotesForMetadataRename(config)

    const useStatus = config.useProjectStatus === true
    const combinedKeyName = checkString(config.projectMetadataFrontmatterKey || 'project')
    const dryRun = METADATA_RENAME_OPTIONS.dryRun
    if (dryRun) {
      logInfo('offerAndRunMetadataTermRenames', `DRY_RUN_METADATA_RENAMES is on -- scanning ${String(uniqueNotes.length)} note(s), no writes`)
    }
    let notesChanged = 0
    let notesFailed = 0
    let notesUnchanged = 0
    const progressLabel = dryRun ? 'Dry-run metadata terms' : 'Updating metadata terms'
    CommandBar.showLoading(true, `${progressLabel}\n0/${String(uniqueNotes.length)}`, 0)
    for (let i = 0; i < uniqueNotes.length; i++) {
      CommandBar.showLoading(true, `${progressLabel}\n${String(i + 1)}/${String(uniqueNotes.length)}`, (i + 1) / uniqueNotes.length)
      const note = uniqueNotes[i]
      let noteChanged = false
      let noteFailed = false
      for (const rename of renames) {
        const result = applyMetadataTermRenameToNote(note, rename, useStatus, combinedKeyName, dryRun)
        if (result === 'changed') {
          // Detail of what changed is logged in applyMetadataTermRenameToNote (strip vs rename, etc.)
          noteChanged = true
        } else if (result === 'failed') {
          logWarn('offerAndRunMetadataTermRenames', `Failed to rename ${rename.oldTerm} to ${rename.newTerm} in ${note.filename}`)
          noteFailed = true
        }
        // 'unchanged': note has no matching key/hashtag/@mention for this term -- not a failure
      }
      if (noteChanged) {
        notesChanged += 1
      } else if (noteFailed) {
        notesFailed += 1
      } else {
        notesUnchanged += 1
      }
    }
    CommandBar.showLoading(false)
    if (dryRun) {
      logInfo('offerAndRunMetadataTermRenames', `DRY RUN: ${String(notesChanged)} note(s) would change for ${String(renames.length)} term rename(s) (0 written)`)
      await showMessage(`DRY RUN: ${String(notesChanged)} project note(s) would update for: ${summary}.`, 'OK', 'Projects + Reviews')
      // Callers treat the return as notes actually written -- dry run writes none.
      return 0
    }
    logInfo(
      'offerAndRunMetadataTermRenames',
      `Updated ${String(notesChanged)} note(s) for ${String(renames.length)} term rename(s) (${String(notesUnchanged)} unchanged, ${String(notesFailed)} failed write(s); scanned ${String(uniqueNotes.length)})`,
    )
    await showMessage(`Updated ${String(notesChanged)} project note(s) for: ${summary}.`, 'OK', 'Projects + Reviews')
    return notesChanged
  } catch (error) {
    CommandBar.showLoading(false)
    logError('offerAndRunMetadataTermRenames', error.message)
    await showMessage(`Sorry, updating metadata terms failed: ${error.message}`, 'OK', 'Projects + Reviews')
    return 0
  }
}
