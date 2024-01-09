// @flow

import { sortListBy } from '@helpers/sorting'
import { JSP, logDebug, logError } from '@helpers/dev'

// Note: Eduard's regex looks for a trailing space or end of line. I can't use that part because it will remove space we need if
// the sync copy tag is in the middle of the line.
export const textWithoutSyncedCopyTag = (text: string): string => text.replace(new RegExp('(?:^|\\s)(\\^[a-z0-9]{6})', 'mg'), '').trim()

/**
 * Eliminate duplicate paragraphs (especially for synced lines), defined as:
 * - the content is the same
 * - the blockID is the same (multiple notes referencing this one) if 'syncedLinesOnly' is true
 * By default it keeps the first copy it finds ... so this is dependent on the order of paras passed to the function.
 * But you can select the most recently-changed note's version instead, by passing 'most-recent' as second parameter.
 * @author @dwertheimer updated by @jgclark
 * @param {Array<TParagraph>} paras: Array<TParagraph>
 * @param {string} keepWhich = 'first' (default) or 'most-recent'
 * @param {boolean} syncedLinesOnly = false (default) or true - only eliminate duplicates if they are synced lines (plain lines are allowed even when dupes)
 * @returns Array<TParagraph> unduplicated paragraphs
 */
export function eliminateDuplicateSyncedParagraphs(paras: Array<TParagraph>, keepWhich?: string = 'first', syncedLinesOnly?: boolean = false): Array<TParagraph> {
  try {
    // logDebug('eliminateDuplicateSyncedParagraphs', `starting for ${String(paras.length)} paras with ${keepWhich}`)
    const revisedParas = []
    if (paras?.length > 0) {
      const sortedParas = keepWhich === 'most-recent' ? sortListBy(paras, ['-note.changedDate']) : paras

      // keep first in list (either way)
      sortedParas.forEach((e) => {
        const matchingIndex = revisedParas.findIndex((t) => {
          if (t.content === e.content) {
            if (t.blockId !== undefined && e.blockId !== undefined && t.blockId === e.blockId) {
              logDebug('eDSP', `Duplicate sync line eliminated: "${t.content}" in "${t.filename || ''}" and "${e.filename || ''}"`)
              return true
            } else {
              if (t.filename === e.filename && !syncedLinesOnly) {
                logDebug('eDSP', `Duplicate sync line eliminated: "${t.content}" in "${t.filename || ''}" and "${e.filename || ''}"`)
                return true
              } else {
                logDebug('eDSP', `Duplicate sync line allowed: "${t.content}" in "${t.filename || ''}" and "${e.filename || ''}"`)
              }
            }
          }
          return false
        })
        const exists = matchingIndex > -1
        if (!exists) {
          revisedParas.push(e)
        }
      })
    }
    return revisedParas
  } catch (err) {
    logError('eliminateDuplicateSyncedParagraphs', JSP(err))
    return [] // for completeness
  }
}
