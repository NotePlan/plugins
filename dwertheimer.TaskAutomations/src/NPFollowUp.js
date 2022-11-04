// @flow

import { selectedLinesIndex } from '../../helpers/NPParagraph'
import { createPrettyLinkToLine, createWikiLinkToLine } from '../../helpers/NPSyncedCopies'
import { isTask } from '../../helpers/sorting'
import pluginJson from '../plugin.json'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'

/**
 * //FIXME: I am here. have not done any of this yet.
 * Helper function to set tasks and create followups
 * @param {*} incoming
 */

export async function createFollowUps(saveHere: boolean) {
  try {
    const { followUpText, followUpLinkText, followUpLinkIsWikiLink } = DataStore.settings

    logDebug(pluginJson, `createFollowUps running with saveHere=${String(saveHere)}`)
    if (Editor?.selection && Editor?.paragraphs) {
      // const updatedParas = []
      const [startIndex, endIndex] = selectedLinesIndex(Editor.selection, Editor.note.paragraphs)
      if (endIndex >= startIndex) {
        for (let index = startIndex; index <= endIndex; index++) {
          const para = Editor.note?.paragraphs[index] || null
          if (para) {
            // logDebug(pluginJson, `createFollowUps: paragraph[${index}] of ${startIndex} to ${endIndex}: "${para.content || ''}"`)
            if (para && isTask(para)) {
              // clo(para, `createFollowUps: before update paragraph[${index}]`)
              para.type = 'done'
              if (Editor.note) {
                Editor.note.updateParagraph(para)
                const revisedPara = Editor.note?.paragraphs[para.lineIndex] || null
                const fuText = followUpText.length > 0 ? `${followUpText} ` : ''
                const linkInfo = revisedPara ? (followUpLinkIsWikiLink ? createWikiLinkToLine(revisedPara) : createPrettyLinkToLine(revisedPara, followUpLinkText)) : ''
                const content = `${fuText}${revisedPara?.content || ''} ${linkInfo}`
                if (revisedPara) Editor.note?.insertTodoAfterParagraph(content, revisedPara)
                // clo(para, `createFollowUps: para after update paragraph[${index}]`)
                // clo(Editor.note?.paragraphs[para.lineIndex], `createFollowUps: note.paragraphs[${index}]`)
              } else {
                logError(pluginJson, `createFollowUps: no Editor.note`)
              }
            }
          }
        }
      } else {
        logDebug(pluginJson, `createFollowUps: no selection`)
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Create a follow-up task and save it just below the task in question
 * Plugin entrypoint for command: "/Mark done and create follow-up underneath"
 * @param {*} incoming
 */
export async function followUpSaveHere(incoming: string | null = null) {
  try {
    logDebug(pluginJson, `followUpSaveHere running with incoming:${String(incoming)}`)
    createFollowUps(true)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Create a follow-up task in a future note
 * Plugin entrypoint for command: "/Mark done and create follow-up in future note"
 * @param {*} incoming
 */
export async function followUpInFuture(incoming: string | null = null) {
  try {
    logDebug(pluginJson, `followUpInFuture running with incoming:${String(incoming)}`)
    createFollowUps(false)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
