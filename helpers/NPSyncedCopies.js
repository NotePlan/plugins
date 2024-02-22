// @flow

import type { SortableParagraphSubset } from './sorting'

import { log, logDebug, clo, clof, JSP } from '@helpers/dev'
import { createOpenOrDeleteNoteCallbackUrl } from '@helpers/general'

/**
 * Make copies of all supplied paragraphs as Synced Lines and return them as an array of strings
 * @param {Array<TParagraph>} parasToSync
 * @param {Array<string>} taskTypesToInclude - default is ['open']
 * @returns array of strings with the sync codes attached
 */
export function getSyncedCopiesAsList(parasToSync: Array<SortableParagraphSubset>, taskTypesToInclude: Array<string> = ['open']): Array<string> {
  clof(parasToSync, `NPSyncedCopies::getSyncedCopiesAsList parasToSync=`, ['lineIndex', 'content'], true)
  clof(taskTypesToInclude, `NPSyncedCopies::getSyncedCopiesAsList taskTypesToInclude=`, ['lineIndex', 'content'], true)
  const syncedLinesList = []
  parasToSync.forEach((p) => {
    if (taskTypesToInclude.indexOf(p.type) > -1) {
      logDebug(
        `NPSyncedCopies::getSyncedCopiesAsList`,
        `noteType:"${p.note?.type || ''}" noteFilename:"${p.note?.filename || ''}" noteTitle: "${p.note?.title || ''}" paraContent: "${p.content || ''}"`,
      )
      // clo(p, `NPSyncedCopies::getSyncedCopiesAsList paragraph=`)
      p.note?.addBlockID(p)
      p.note?.updateParagraph(p)
      syncedLinesList.push(p.rawContent)
    }
  })
  logDebug(`getSyncedCopiesAsList:`, `Input length:${parasToSync.length} items | output length:${syncedLinesList.length} items`)
  return syncedLinesList
}

/**
 * Create a link to a note and a specific line (like synced copy but just a link to that line)
 * @param {TParagraph} paragraph
 * @returns string with the link (or empty string if it does not work) -- e.g. noteplan://x-callback-url/openNote?noteTitle=2022-10-24%5Eywtytx
 */
export function createURLToLine(paragraph: TParagraph): string {
  paragraph.note?.addBlockID(paragraph)
  paragraph.note?.updateParagraph(paragraph)
  if (paragraph.note?.title && paragraph?.blockId) {
    return `${createOpenOrDeleteNoteCallbackUrl(`${paragraph.note.title}`, 'title', null, null, false)}${(paragraph?.blockId || '').replace('^', '%5E')}`
  } else {
    logDebug(`createURLToLine Could not create URL for title:"${paragraph.note?.title || ''}" blockId:"${paragraph?.blockId || ''}" paragraph:${JSP(paragraph)}`)
    return ''
  }
}

/**
 * Create a wiki link to a note and a specific line (like synced copy but just a link to that line)
 * @param {TParagraph} paragraph
 * @returns string with the wikilink (or empty string if it does not work) -- e.g. [[2022-10-24^ywtytx]]
 */
export function createWikiLinkToLine(paragraph: TParagraph): string {
  if (paragraph.note && !paragraph.blockId) {
    paragraph.note?.addBlockID(paragraph)
    paragraph.note?.updateParagraph(paragraph)
  }
  if (paragraph.note?.title && paragraph?.blockId) {
    return `[[${paragraph.note.title}${paragraph?.blockId || ''}]]`
  } else {
    logDebug(`createWikiLinkToLine Could not create wiki link for title:"${paragraph.note?.title || ''}" blockId:"${paragraph?.blockId || ''}" paragraph:${JSP(paragraph)}`)
    return ''
  }
}

/**
 * Create a pretty url [txt](url) to a note and a specific line (like synced copy but just a link to that line)
 * @param {TParagraph} paragraph
 * @param {string} text - text to display in the link
 * @returns {string} - the result string or empty string if it does not work
 */
export function createPrettyLinkToLine(paragraph: TParagraph, text: string): string {
  const link = createURLToLine(paragraph)
  if (link && text) {
    return `[${text}](${link})`
  } else {
    logDebug(
      `createPrettyLinkToLine Could not create pretty link for text:"${text}" title:"${paragraph.note?.title || ''}" blockId:"${paragraph?.blockId || ''}" paragraph:${JSP(
        paragraph,
      )}`,
    )
    return ''
  }
}
