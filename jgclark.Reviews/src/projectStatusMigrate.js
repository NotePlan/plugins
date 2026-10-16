// @flow
//-----------------------------------------------------------------------------
// Vault-wide metadata-term rename offer (settings change).
// Kept separate from projectStatus.js to avoid import cycles with allProjectsListHelpers.
// Last updated 2026-10-15 for v2.4.0 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import { enumerateMatchingProjectNoteTagPairs } from './allProjectsListHelpers'
import {
  applyMetadataTermRenameToNote,
  getMetadataTermRenames,
} from './projectStatus'
import type { ReviewConfig } from './reviewSettings'
import { checkString } from '@helpers/checkType'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { showMessage, showMessageYesNo } from '@helpers/userInput'

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

  try {
    const pairs = await enumerateMatchingProjectNoteTagPairs(config, false)
    const seen: Set<string> = new Set()
    const uniqueNotes: Array<TNote> = []
    for (const { note } of pairs) {
      if (note == null || note.filename == null) continue
      if (seen.has(note.filename)) continue
      seen.add(note.filename)
      uniqueNotes.push(note)
    }

    const useStatus = config.useProjectStatus === true
    const combinedKeyName = checkString(config.projectMetadataFrontmatterKey || 'project')
    let notesChanged = 0
    CommandBar.showLoading(true, `Updating metadata terms\n0/${String(uniqueNotes.length)}`, 0)
    for (let i = 0; i < uniqueNotes.length; i++) {
      CommandBar.showLoading(true, `Updating metadata terms\n${String(i + 1)}/${String(uniqueNotes.length)}`, (i + 1) / uniqueNotes.length)
      const note = uniqueNotes[i]
      let noteChanged = false
      for (const rename of renames) {
        if (applyMetadataTermRenameToNote(note, rename, useStatus, combinedKeyName)) {
          logDebug('offerAndRunMetadataTermRenames', `Renamed ${rename.oldTerm} to ${rename.newTerm} in ${note.filename}`)
          noteChanged = true
        } else {
          logWarn('offerAndRunMetadataTermRenames', `Failed to rename ${rename.oldTerm} to ${rename.newTerm} in ${note.filename}`)
        }
      }
      if (noteChanged) notesChanged += 1
    }
    CommandBar.showLoading(false)
    logInfo('offerAndRunMetadataTermRenames', `Updated ${String(notesChanged)} note(s) for ${String(renames.length)} term rename(s)`)
    await showMessage(`Updated ${String(notesChanged)} project note(s) for: ${summary}.`, 'OK', 'Projects + Reviews')
    return notesChanged
  } catch (error) {
    CommandBar.showLoading(false)
    logError('offerAndRunMetadataTermRenames', error.message)
    await showMessage(`Sorry, updating metadata terms failed: ${error.message}`, 'OK', 'Projects + Reviews')
    return 0
  }
}
