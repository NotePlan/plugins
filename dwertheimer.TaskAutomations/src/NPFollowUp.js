// @flow

import { selectedLinesIndex } from '../../helpers/NPParagraph'
import { createPrettyLinkToLine, createWikiLinkToLine } from '../../helpers/NPSyncedCopies'
import { isTask } from '../../helpers/sorting'
import pluginJson from '../plugin.json'
import { getInput, chooseOptionWithModifiers, chooseNote } from '../../helpers/userInput'
import { textWithoutSyncedCopyTag } from '@helpers/syncedCopies'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { getDateOptions, convertISODateFilenameToNPDayFilename, RE_ISO_DATE } from '@helpers/dateTime'
import { getWeekOptions } from '@helpers/NPdateTime'
import { removeDateTagsAndToday } from '@helpers/stringTransforms'
import { getNote } from '@helpers/note'

/**
 * Ask user for a future date or week to attach to the follow-up task
 */
export async function getFutureDate(isMultiple: boolean = false, promptString: string | null = null): Promise<string> {
  const skip = [{ label: `➡️ None - Do not add a date`, value: '__skip__' }]
  const dateOpts = [...skip, ...getDateOptions(), ...getWeekOptions()]
  const prompt = `Attach what due date to the follow-up task${isMultiple ? 's' : ''}?`
  const res = await chooseOptionWithModifiers(promptString || prompt, dateOpts)
  logDebug(pluginJson, `getUserActionForThisTask user selection: ${JSP(res)}`)
  if (res && res.value && res.value !== '__skip__') return res.value
  return ''
}

/**
 * Add the task to the top of the future note chosen by the user
 * @param {string} content - the string to save in the future
 * @param {string} futureDate - the date string (with > prefix) or empty string
 */
export async function saveTodoInFuture(content: string, futureDate: string) {
  if (futureDate.length > 0) {
    // chop off first character (>) of futureDate
    let dateStr = futureDate.slice(1)
    if (new RegExp(RE_ISO_DATE).test(dateStr)) {
      dateStr = convertISODateFilenameToNPDayFilename(dateStr)
    }
    logDebug(pluginJson, `saveTodoInFuture futureDate:${dateStr}`)
    const futureNote = DataStore.calendarNoteByDateString(dateStr)
    if (futureNote) {
      const { followUpHeadingTitle } = DataStore.settings
      if (followUpHeadingTitle && followUpHeadingTitle.length > 0) {
        // Use addTodoBelowHeadingTitle if heading title is configured
        futureNote.addTodoBelowHeadingTitle(content, followUpHeadingTitle, false, true)
      } else {
        // Default behavior: prepend to top of note
        futureNote.prependTodo(content)
      }
      await Editor.openNoteByDateString(dateStr)
    } else {
      logDebug(pluginJson, `saveTodoInFuture could not open futureNote for date:${dateStr}`)
    }
  }
}

/**
 * Add the task to the top of a note identified by title
 * @param {string} content - the string to save in the note
 * @param {string} noteTitle - the title of the note to save to
 */
export async function saveTodoInNoteByTitle(content: string, noteTitle: string): Promise<void> {
  if (noteTitle.length > 0) {
    logDebug(pluginJson, `saveTodoInNoteByTitle noteTitle:${noteTitle}`)
    let targetNote = await getNote(noteTitle)
    if (!targetNote) {
      // Fall back to letting user choose the note
      logDebug(pluginJson, `saveTodoInNoteByTitle: getNote failed, falling back to user selection`)
      targetNote = await chooseNote(true, true, [], `Choose note to save follow-up task (could not find "${noteTitle}")`)
    }
    if (targetNote) {
      const { followUpHeadingTitle } = DataStore.settings
      if (followUpHeadingTitle && followUpHeadingTitle.length > 0) {
        // Use addTodoBelowHeadingTitle if heading title is configured
        targetNote.addTodoBelowHeadingTitle(content, followUpHeadingTitle, false, true)
      } else {
        // Default behavior: prepend to top of note
        targetNote.prependTodo(content)
      }
      await Editor.openNoteByFilename(targetNote.filename)
    } else {
      logError(pluginJson, `saveTodoInNoteByTitle could not find or select note for title:${noteTitle}`)
    }
  }
}

/**
 * Helper function that does the work of marking tasks (even multiple selected) done and creating followups
 * @param {boolean} saveHere - whether to save the follow-up in the current note or in a future note
 * @param {TParagraph | null} selectedParagraph (optional) - if passed, only this paragraph will be marked done and a followup created, otherwise, we check for a selection
 * @param {string | null} noteTitle (optional) - if provided, skip the date picker and use this note title instead
 */
export async function createFollowUps(saveHere: boolean, selectedParagraph: TParagraph | null = null, noteTitle: string | null = null): Promise<TParagraph | null> {
  try {
    const { followUpText, followUpLinkText, followUpLinkIsWikiLink } = DataStore.settings
    let revisedPara = null
    logDebug(
      pluginJson,
      `createFollowUps running with saveHere=${String(saveHere)}${selectedParagraph ? `, selectedParagraph:"${String(selectedParagraph?.content)}"` : ''}${
        noteTitle ? `, noteTitle:"${noteTitle}"` : ''
      }`,
    )
    if (selectedParagraph?.filename) await Editor.openNoteByFilename(selectedParagraph.filename)
    if (selectedParagraph || (Editor?.selection && Editor?.paragraphs)) {
      // const updatedParas = []
      clo(Editor.selection, `createFollowUps: Editor.selection`)
      if (selectedParagraph || (Editor?.note?.paragraphs && Editor.selection)) {
        let startIndex, endIndex
        if (selectedParagraph) {
          startIndex = selectedParagraph.lineIndex
          endIndex = startIndex
        } else {
          const indexes = Editor.selection && Editor.note?.paragraphs ? selectedLinesIndex(Editor.selection, Editor.note.paragraphs) : [0, -1]
          startIndex = indexes[0]
          endIndex = indexes[1]
        }
        if (endIndex >= startIndex) {
          // If noteTitle is provided, skip the date picker
          let futureDate = ''
          if (!noteTitle) {
            const prompt = saveHere ? `Add a due date to the new task?` : `Create follow-up task on what date?`
            futureDate = await getFutureDate(startIndex !== endIndex, prompt)
          }
          for (let index = startIndex; index <= endIndex; index++) {
            const para = Editor.note?.paragraphs[index] || null
            if (para) {
              logDebug(pluginJson, `createFollowUps: paragraph[${index}] of ${startIndex} to ${endIndex}: "${para.content || ''}"`)
              const origText = removeDateTagsAndToday(textWithoutSyncedCopyTag(para.content))
                .replace(/ *>today/gm, '')
                .replace(/ *\@done\(.*\)/gm, '')
                .replace(new RegExp(`${followUpText} *`), 'gm')
              if (para && isTask(para)) {
                clo(para, `createFollowUps: before update paragraph[${index}]`)
                clo(para.contentRange, `createFollowUps: contentRange for paragraph[${index}]`)
                para.type = 'done'
                if (para.note) {
                  para.note.updateParagraph(para)
                  revisedPara = Editor.note?.paragraphs[para.lineIndex] || null
                  let fuText: string = followUpText.length > 0 ? `${followUpText} ${origText}` : origText
                  const inputResult = await getInput('Edit follow-up text', 'OK', 'Follow up text', fuText)
                  if (typeof inputResult === 'string') {
                    fuText = inputResult
                  }
                  const linkInfo = revisedPara ? (followUpLinkIsWikiLink ? createWikiLinkToLine(revisedPara) : createPrettyLinkToLine(revisedPara, followUpLinkText)) : ''
                  if (revisedPara) {
                    if (saveHere) {
                      const content = `${fuText ? `${fuText} ` : ''} ${linkInfo}${futureDate ? ` ${futureDate}` : ''}`
                      Editor.note?.insertTodoAfterParagraph(content, revisedPara)
                      index++ // increment index to skip the newly inserted paragraph
                      endIndex++
                    } else {
                      const content = `${fuText ? `${fuText} ` : ''} ${linkInfo}`
                      if (noteTitle) {
                        await saveTodoInNoteByTitle(content, noteTitle)
                      } else {
                        await saveTodoInFuture(content, futureDate)
                      }
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
    clo(revisedPara, `createFollowUps: sending back revisedPara`)
    return revisedPara
  } catch (error) {
    logError(pluginJson, JSP(error))
    return null
  }
}

/**
 * Create a follow-up task and save it just below the task in question
 * Plugin entrypoint for command: "/Mark done and create follow-up underneath"
 * @param {*} incoming
 */
export async function followUpSaveHere(selectedParagraph?: ?TParagraph = null): Promise<TParagraph | null> {
  try {
    logDebug(pluginJson, `followUpSaveHere running with selectedParagraph:"${String(selectedParagraph?.content)}"`)
    return await createFollowUps(true, selectedParagraph)
  } catch (error) {
    logError(pluginJson, JSP(error))
    return null
  }
}

/**
 * Create a follow-up task in a future note
 * Plugin entrypoint for command: "/Mark done and create follow-up in future note"
 * @param {TParagraph | null} selectedParagraph (optional) - if passed, only this paragraph will be marked done and a followup created
 * @param {string | null} noteTitle (optional) - if provided, skip the date picker and use this note title instead
 */
export async function followUpInFuture(selectedParagraph?: ?TParagraph = null, noteTitle?: ?string = null): Promise<TParagraph | null> {
  try {
    logDebug(pluginJson, `followUpInFuture running with selectedParagraph:"${String(selectedParagraph?.content)}"${noteTitle ? `, noteTitle:"${noteTitle}"` : ''}`)
    return await createFollowUps(false, selectedParagraph, noteTitle)
  } catch (error) {
    logError(pluginJson, JSP(error))
    return null
  }
}
