// @flow

import pluginJson from "../plugin.json"
import {
  generateNewRepeatDate,
  type RepeatConfig,
} from './repeatHelpers'
import {
  RE_ANY_DUE_DATE_TYPE,
  RE_DONE_DATE_TIME,
  RE_DONE_DATE_TIME_CAPTURES,
  RE_ISO_DATE, // find dates of form YYYY-MM-DD
  convertISODateFilenameToNPDayFilename,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logInfo, logWarn, logError } from "@helpers/dev"

/**
 * Generate a repeat task for a single paragraph that contains a completed task with extended @repeat(interval) tag.
 * When interval is of the form '+2w' it will duplicate the task for 2 weeks after the date is was completed.
 * When interval is of the form '2w' it will duplicate the task for 2 weeks after the date the task was last due. If this can't be determined, it uses the note date. If this can't be determined, then default to completed date.
 * Valid intervals are [0-9][bdwmqy].
 * To work it relies on finding @done(YYYY-MM-DD HH:MM) tags that haven't yet been shortened to @done(YYYY-MM-DD).
 * It includes cancelled tasks as well; to remove a repeat entirely, remove the @repeat tag from the task in NotePlan.
 * Note: The new repeat date is by default scheduled to a day (>YYYY-MM-DD). But if the scheduled date is a week date (YYYY-Wnn), or the repeat is in a weekly note, then the new repeat date will be a scheduled week link (>YYYY-Wnn).
 * Note: Runs on the currently open note (using Editor.* funcs) if possible, or now on noteArg too (not using Editor.* funcs)
 * Note: Could add a 'Newer' mode of operation according to GH # 351.
 * @param {TParagraph} origPara - The original paragraph containing the completed task and @repeat(interval) tag
 * @param {TNote} noteToUse - The note containing the paragraph
 * @param {boolean} noteIsOpenInEditor - Whether the note is open in the editor
 * @param {RepeatConfig} config - The repeat configuration settings
 * @returns {Promise<TParagraph | null>} The newly created paragraph, or null if no repeat was generated
 */
export async function generateRepeatForPara(
  origPara: TParagraph,
  noteToUse: TNote,
  noteIsOpenInEditor: boolean,
  config: RepeatConfig
): Promise<TParagraph | null> {
  try {
    const line = origPara.content ?? ''
    let lineWithoutDoneTime = ''
    let completedDate = ''

    // Check if line has datetime to shorten
    if (!RE_DONE_DATE_TIME.test(line)) {
      return null
    }

    // Get completed date and time
    const reReturnArray = line.match(RE_DONE_DATE_TIME_CAPTURES) ?? []
    completedDate = reReturnArray[1]
    const completedTime = reReturnArray[2]
    logDebug('generateRepeatForPara', `- found newly completed task: "${line}"`)

    // Remove time string from completed date-time
    lineWithoutDoneTime = line.replace(completedTime, '')
    origPara.content = lineWithoutDoneTime
    noteToUse.updateParagraph(origPara)

    const newParaLineIndex = origPara.lineIndex
    let newPara: TParagraph

    // Generate the new repeat date
    let newRepeatDateStr = generateNewRepeatDate(noteToUse, origPara.content, completedDate)
    if (newRepeatDateStr === completedDate) {
      logWarn(`generateRepeatForPara`, `newRepeatDateStr ${newRepeatDateStr} is same as completedDate ${completedDate}`)
    }

    // Remove any >date and @done()
    let newRepeatContent = lineWithoutDoneTime.replace(RE_ANY_DUE_DATE_TYPE, '').replace(/@done\(.*\)/, '').trim()

    // Add the new repeat based on note type
    if (noteToUse.type === 'Notes') {
      newRepeatContent += ` >${newRepeatDateStr}`
      if (noteIsOpenInEditor) {
        await Editor.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
        newPara = Editor.paragraphs[newParaLineIndex]
      } else {
        await noteToUse.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
        newPara = noteToUse.paragraphs[newParaLineIndex]
      }
    } else {
      // Handle calendar note case
      if (newRepeatDateStr.match(RE_ISO_DATE)) {
        newRepeatDateStr = convertISODateFilenameToNPDayFilename(newRepeatDateStr)
      }
      const futureNote = await DataStore.calendarNoteByDateString(newRepeatDateStr)
      if (futureNote != null) {
        await futureNote.appendTodo(newRepeatContent)
        newPara = futureNote.paragraphs[futureNote.paragraphs.length - 1]
      } else {
        newRepeatContent += ` >${newRepeatDateStr}`
        if (noteIsOpenInEditor) {
          await Editor.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
          newPara = Editor.paragraphs[newParaLineIndex]
        } else {
          await noteToUse.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
          newPara = noteToUse.paragraphs[newParaLineIndex]
        }
      }
    }

    // Add any indent for this new para
    if (newPara) {
      newPara.indents = origPara.indents
      noteToUse.updateParagraph(newPara)
    }

    // Handle the completed item
    Editor.skipNextRepeatDeletionCheck = true
    if (config.deleteCompletedRepeat) {
      if (noteIsOpenInEditor) {
        Editor.removeParagraphAtIndex(origPara.lineIndex + 1)
      } else {
        noteToUse.removeParagraphAtIndex(origPara.lineIndex + 1)
      }
    } else {
      origPara.content = lineWithoutDoneTime
      if (noteIsOpenInEditor) {
        Editor.updateParagraph(origPara)
      } else {
        noteToUse.updateParagraph(origPara)
      }
    }

    return newPara
  } catch (error) {
    logError(pluginJson, `generateRepeatForPara(): ${JSP(error)}`)
    return null
  }
} 