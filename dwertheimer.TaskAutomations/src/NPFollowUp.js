// @flow

import { selectedLinesIndex } from '../../helpers/NPParagraph'
import { createPrettyLinkToLine, createWikiLinkToLine } from '../../helpers/NPSyncedCopies'
import { isTask } from '../../helpers/sorting'
import pluginJson from '../plugin.json'
import { textWithoutSyncedCopyTag } from '@helpers/syncedCopies'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { getDateOptions, unhyphenateString, RE_ISO_DATE, removeDateTagsAndToday } from '@helpers/dateTime'
import { chooseOptionWithModifiers } from '@helpers/userInput'
import { getWeekOptions } from '@helpers/NPdateTime'

/**
 * Ask user for a future date or week to attach to the follow-up task
 */
export async function getFutureDate(isMultiple: boolean = false): Promise<string> {
  const skip = [{ label: `➡️ None - Do not add a date`, value: '__skip__' }]
  const dateOpts = [...skip, ...getDateOptions(), ...getWeekOptions()]
  const prompt = `Attach what due date to the follow-up task${isMultiple ? 's' : ''}?`
  const res = await chooseOptionWithModifiers(prompt, dateOpts)
  logDebug(pluginJson, `promptUserToActOnLine user selection: ${JSP(res)}`)
  if (res && res.value && res.value !== '__skip__') return res.value
  return ''
}

/**
 * Add the task to the top of the future note chosen by the user
 * @param {string} content - the string to save in the future
 */
export async function saveTodoInFuture(content: string, futureDate: string) {
  if (futureDate.length > 0) {
    // chop off first character (>) of futureDate
    let dateStr = futureDate.slice(1)
    if (new RegExp(RE_ISO_DATE).test(dateStr)) {
      dateStr = unhyphenateString(dateStr)
    }
    logDebug(pluginJson, `saveTodoInFuture futureDate:${dateStr}`)
    const futureNote = DataStore.calendarNoteByDateString(dateStr)
    if (futureNote) {
      futureNote.prependTodo(content)
      await Editor.openNoteByDateString(dateStr)
    } else {
      logDebug(pluginJson, `saveTodoInFuture could not open futureNote for date:${dateStr}`)
    }
  }
}

/**
 * Helper function that does the work of marking tasks done and creating followups
 * @param {*} incoming
 */

export async function createFollowUps(saveHere: boolean) {
  try {
    const { followUpText, followUpLinkText, followUpLinkIsWikiLink } = DataStore.settings

    logDebug(pluginJson, `createFollowUps running with saveHere=${String(saveHere)}`)
    if (Editor?.selection && Editor?.paragraphs) {
      // const updatedParas = []
      clo(Editor.selection, `createFollowUps: Editor.selection`)
      if (Editor?.note?.paragraphs && Editor.selection) {
        const indexes = selectedLinesIndex(Editor.selection, Editor.note.paragraphs)
        const [startIndex] = indexes
        let [, endIndex] = indexes
        if (endIndex >= startIndex) {
          const futureDate = await getFutureDate(startIndex !== endIndex)
          for (let index = startIndex; index <= endIndex; index++) {
            const para = Editor.note?.paragraphs[index] || null
            if (para) {
              logDebug(pluginJson, `createFollowUps: paragraph[${index}] of ${startIndex} to ${endIndex}: "${para.content || ''}"`)
              const origText = removeDateTagsAndToday(textWithoutSyncedCopyTag(para.content))
                .replace(/ *>today/gm, '')
                .replace(/ *\@done\(.*\)/gm, '')
              if (para && isTask(para)) {
                clo(para, `createFollowUps: before update paragraph[${index}]`)
                clo(para.contentRange, `createFollowUps: contentRange for paragraph[${index}]`)
                para.type = 'done'
                if (Editor.note) {
                  Editor.note.updateParagraph(para)
                  const revisedPara = Editor.note?.paragraphs[para.lineIndex] || null
                  const fuText = followUpText.length > 0 ? `${followUpText} ` : ''
                  const linkInfo = revisedPara ? (followUpLinkIsWikiLink ? createWikiLinkToLine(revisedPara) : createPrettyLinkToLine(revisedPara, followUpLinkText)) : ''
                  if (revisedPara) {
                    if (saveHere) {
                      const content = `${fuText}${origText} ${linkInfo}${futureDate ? ` ${futureDate}` : ''}`
                      Editor.note?.insertTodoAfterParagraph(content, revisedPara)
                      index++ // increment index to skip the newly inserted paragraph
                      endIndex++
                    } else {
                      const content = `${fuText}${origText} ${linkInfo}`
                      await saveTodoInFuture(content, futureDate)
                    }
                  }
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
      } else {
        logDebug(pluginJson, `createFollowUps: no Editor.note.paragraphs || no selection`)
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
    await createFollowUps(true)
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
    await createFollowUps(false)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
