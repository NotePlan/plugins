// @flow

import { sortListBy } from '@helpers/sorting'
import { JSP, logDebug, logError } from '@helpers/dev'

// Note: Eduard's regex looks for a trailing space or end of line. I can't use that part because it will remove space we need if
// the sync copy tag is in the middle of the line.
export const textWithoutSyncedCopyTag = (text: string): string => text.replace(new RegExp('(?:^|\\s)(\\^[a-z0-9]{6})', 'mg'), '').trim() // removeSyncedCopyTag removeBlockID

/**
 * Eliminate duplicate paragraphs (especially for synced lines), defined as:
 * - the content is the same
 * - the blockID is the same (multiple notes referencing this one) if 'syncedLinesOnly' is true
 * Parameter 'keepWhich' defines which copy to keep:
 * - 'first' (default) keeps the first copy it finds ... so this is dependent on the order of paras passed to the function.
 * - 'most-recent' keeps the most recently-changed note's version instead.
 * - 'regular-notes' keeps Regular (earlier called 'Project') notes in preference to Calendar notes. If there are multiple Regular notes, it keeps the first of those.
 * @author @dwertheimer updated by @jgclark
 * @param {Array<TParagraph>} paras: Array<TParagraph>
 * @param {string} keepWhich = 'first' (default), 'most-recent' or 'regular-notes'
 * @param {boolean} syncedLinesOnly = false (default) or true - only eliminate duplicates if they are synced lines (plain lines are allowed even when dupes)
 * @returns Array<TParagraph> unduplicated paragraphs
 */
export function eliminateDuplicateParagraphs(paras: Array<TParagraph>, keepWhich?: string = 'first', syncedLinesOnly?: boolean = false): Array<TParagraph> {
  try {
    logDebug('eDSP', `starting for ${String(paras.length)} paras with ${keepWhich}`)
    const revisedParas = []
    if (paras?.length > 0) {
      const sortedParas =
        keepWhich === 'most-recent'
          ? sortListBy(paras, ['-note.changedDate'])
          : keepWhich === 'regular-notes'
            ? sortListBy(paras, ['-note.type'])
            : paras
      // logDebug('eDSP', `sortedParas: ${sortedParas.map((p) => p?.note?.type + ':' + p?.note?.filename).join(' / ')}`)

      // keep first in list (either way)
      sortedParas.forEach((e) => {
        const matchingIndex = revisedParas.findIndex((t) => {
          if (t.content === e.content) {
            if (t.blockId !== undefined && e.blockId !== undefined && t.blockId === e.blockId) {
              logDebug('eDSP', `Duplicate synced line eliminated: "${t.content}" in "${t.filename || ''}" and "${e.filename || ''}"`)
              return true
            } else {
              if (t.filename === e.filename && !syncedLinesOnly) {
                logDebug('eDSP', `Duplicate non-synced line eliminated: "${t.content}" in "${t.filename || ''}" and "${e.filename || ''}"`)
                return true
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
    logError('eliminateDuplicateParagraphs', JSP(err))
    return [] // for completeness
  }
}
