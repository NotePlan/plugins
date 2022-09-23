// @flow

/**
 * Make copies of all supplied paragraphs as Synced Lines and return them as an array of strings
 * @param {Array<TParagraph>} allTodayParagraphs
 * @param {Array<string>} taskTypesToInclude - default is ['open']
 * @returns array of strings with the sync codes attached
 */
import type { ExtendedParagraph } from '../dwertheimer.EventAutomations/src/timeblocking-flow-types'
import { log, logDebug, clo } from '@helpers/dev'

export function getSyncedCopiesAsList(allTodayParagraphs: Array<TParagraph | ExtendedParagraph> = [], taskTypesToInclude: Array<string> = ['open']): Array<string> {
  const syncedLinesList = []
  allTodayParagraphs.forEach((p) => {
    if (taskTypesToInclude.indexOf(p.type) > -1) {
      logDebug(
        `NPSyncedCopies::getSyncedCopiesAsList`,
        `noteType:"${p.note?.type || ''}" noteFilename:"${p.note?.filename || ''}" noteTitle: "${p.note?.title || ''}" paraContent: "${p.content || ''}"`,
      )
      clo(p, `NPSyncedCopies::getSyncedCopiesAsList paragraph=`)
      p.note?.addBlockID(p)
      p.note?.updateParagraph(p)
      syncedLinesList.push(p.rawContent)
    }
  })
  logDebug(`getSyncedCopiesAsList:`, `${allTodayParagraphs.length} items`)
  return syncedLinesList
}
