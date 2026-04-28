// @flow
//-----------------------------------------------------------------------
// Repeat Extensions plugin for NotePlan
// Jonathan Clark
// last updated 2026-04-28, for v1.1.2
//-----------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { generateNewRepeatDate, type RepeatConfig } from './repeatHelpers'
import {
  generateNewRepeatDate, RE_EXTENDED_REPEAT,
  type RepeatConfig,
} from './repeatHelpers'
import {
  // RE_ANY_DUE_DATE_TYPE,
  RE_DONE_DATE_TIME,
  RE_DONE_DATE_TIME_CAPTURES,
  RE_ISO_DATE, // find dates of form YYYY-MM-DD
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logInfo, logWarn, logError } from "@helpers/dev"
import { getOpenEditorFromFilename, saveEditorIfNecessary } from '@helpers/NPEditor'
import { stripDoneDateTimeMentions } from '@helpers/paragraph'
import { removeDateTagsAndToday, stripTaskMarkersFromString } from '@helpers/stringTransforms'
import { textWithoutSyncedCopyTag } from '@helpers/syncedCopies'

/**
 * Generate a repeat task for a single paragraph that contains a completed task with extended @repeat(interval) tag.
 * When interval is of the form '+2w' it will duplicate the task for 2 weeks after the date is was completed.
 * When interval is of the form '2w' it will duplicate the task for 2 weeks after the date the task was last due. If this can't be determined, it uses the note date. If this can't be determined, then default to completed date.
 * Valid intervals are [0-9][bdwmqy].
 * To work it relies on finding @done(YYYY-MM-DD HH:MM) tags that haven't yet been shortened to @done(YYYY-MM-DD).
 * It includes cancelled tasks as well; to remove a repeat entirely, remove the @repeat tag from the task in NotePlan.
 * Note: The new repeat date is by default scheduled to a day (>YYYY-MM-DD). But if the scheduled date is a week date (YYYY-Wnn), or the repeat is in a weekly note, then the new repeat date will be a scheduled week link (>YYYY-Wnn).
 * Note: Could add a 'Newer' mode of operation according to GH # 351; @asktru suggests just removing the @repeat tag when it has been repeated.
 * @param {TParagraph} origPara - The original paragraph containing the completed task and @repeat(interval) tag
 * @param {CoreNoteFields} origNote - The note containing the paragraph
 * @param {RepeatConfig} config - The repeat configuration settings
 * @param {boolean} allowedToUseEditor - If false, never use Editor.* funcs to edit the note. This is required for running onAsyncThread from Tidy Up plugin. (Default: true)
 * @returns {Promise<TParagraph | null>} The newly created paragraph, or null if no repeat was generated
 */
export async function generateRepeatForPara(
  origPara: TParagraph,
  origNote: CoreNoteFields,
  config: RepeatConfig,
  allowedToUseEditor: boolean = true
): Promise<TParagraph | null> {
  try {
    // Initial double-checks -- should be already checked by calling functions, but just in case
    if (!origPara) {
      throw new Error(`generateRepeatForPara: passed origPara is null`)
    }
    if (!origNote) {
      throw new Error(`generateRepeatForPara: passed origNote is null`)
    }
    const line = origPara.content ?? ''
    if (!RE_EXTENDED_REPEAT.test(line)) {
      throw new Error(`generateRepeatForPara: passed line '${line}' does not contain an extended @repeat(...)`)
    }
    if (!RE_DONE_DATE_TIME.test(line)) {
      throw new Error(`generateRepeatForPara: passed line '${line}' does not contain a datetime to shorten`)
    }

    let noteIsOpenInEditor = false
    if (allowedToUseEditor) {
      // Find the right Editor note (if any) to use as there can be more than one open.
      const possibleEditorNote: TEditor | false = getOpenEditorFromFilename(origNote.filename)
      noteIsOpenInEditor = possibleEditorNote !== false &&
        possibleEditorNote.filename === origNote.filename
      logDebug('generateRepeatForPara', `Starting for "${origPara.content}" in ${origNote.filename}. noteIsOpenInEditor: ${String(noteIsOpenInEditor)}`)
    } else {
      logDebug('generateRepeatForPara', `Starting for "${origPara.content}" in ${origNote.filename}, and will NOT use Editor.* funcs.`)
    }
    let lineWithoutDoneTime = ''
    let completedDate = ''
    let noteContainingNewPara: CoreNoteFields

    // If the completed task is in a regular note, and the sync copy is in a Calendar note, then the new repeated task should appear in the regular note. (For #672)
    const syncCopyParas: Array<TParagraph> = DataStore.referencedBlocks(origPara)
    const origParaIsSynced = syncCopyParas.length >= 1 // this doesn't report itself as being synced
    const syncCopiesInRegularNotes = (origParaIsSynced) ? syncCopyParas.filter((p) => p?.note?.type === 'Notes') : []
    logDebug('generateRepeatForPara', `- found ${syncCopiesInRegularNotes.length} syncCopiesInRegularNotes`)

    // Get completed date and time
    const reReturnArray = line.match(RE_DONE_DATE_TIME_CAPTURES) ?? []
    completedDate = reReturnArray[1]
    const completedTime = reReturnArray[2]
    logDebug('generateRepeatForPara', `- found newly completed task: "${line}"`)

    // Remove time string from completed date-time
    lineWithoutDoneTime = line.replace(completedTime, '')
    logDebug('generateRepeatForPara', `- lineWithoutDoneTime: "${lineWithoutDoneTime}"`)
    origPara.content = lineWithoutDoneTime
    if (noteIsOpenInEditor) {
      Editor.updateParagraph(origPara)
      logDebug('generateRepeatForPara', `- after change origPara.content in Editor: "${origPara.content}"`)
      saveEditorIfNecessary()
    } else {
      origNote.updateParagraph(origPara)
    }

    const newParaLineIndex = origPara.lineIndex
    let newPara: TParagraph
    let noteContainingNewPara: TNote = noteToUse

    // Generate the new repeat date
    let newRepeatDateStr = generateNewRepeatDate(origNote, origPara.content, completedDate)
    if (newRepeatDateStr === completedDate) {
      logWarn(`generateRepeatForPara`, `newRepeatDateStr ${newRepeatDateStr} is same as completedDate ${completedDate}`)
    }

    // Remove any >date, @done(), or task marker on the new task
    // v1:
    // let newRepeatContent = lineWithoutDoneTime
    //   .replace(RE_ANY_DUE_DATE_TYPE, '')
    //   .replace(/@done\(.*\)/, '')
    //   .replace(/^\* /, '')
    // v2:
    let newRepeatContent = removeDateTagsAndToday(lineWithoutDoneTime, true)
    newRepeatContent = stripDoneDateTimeMentions(newRepeatContent)
    newRepeatContent = stripTaskMarkersFromString(newRepeatContent)

    // Remove any sync marker, and trim
    newRepeatContent = textWithoutSyncedCopyTag(newRepeatContent).trim()
    logDebug('generateRepeatForPara', `- newRepeatContent: "${newRepeatContent}"`)
    
    // Add the new repeat
    if (syncCopiesInRegularNotes.length > 0) {
      // If the origPara is synced to a regular note, then write to the (first) of those regular note(s)
      const syncSourceNote: ?TNote = syncCopiesInRegularNotes[0]?.note
      if (syncSourceNote == null) {
        throw new Error(`generateRepeatForPara: Cannot get syncSourceNote for origPara: "${origPara.content}" in ${origNote.filename}`)
      }
      logDebug('generateRepeatForPara', `- adding repeat to regular note where origPara is synced (${syncSourceNote.filename})`)
      newRepeatContent += ` >${newRepeatDateStr}`
      await syncSourceNote.insertParagraphBeforeParagraph(newRepeatContent, syncCopiesInRegularNotes[0], 'open')
      newPara = syncSourceNote.paragraphs[newParaLineIndex]
      noteContainingNewPara = syncSourceNote
    }
    else if (origNote.type === 'Notes') {
      // First handle regular/project note. Or now, if the origPara is synced to a regular/project note
      logDebug('generateRepeatForPara', `- adding repeat to regular note ${origNote.filename}`)
      newRepeatContent += ` >${newRepeatDateStr}`
      if (noteIsOpenInEditor) {
        noteContainingNewPara = Editor
        await Editor.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
        newPara = Editor.paragraphs[newParaLineIndex]
      } else {
        noteContainingNewPara = origNote
        await origNote.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
        newPara = origNote.paragraphs[newParaLineIndex]
      }
    } else {
      // Else add the new repeat to the calendar note
      if (newRepeatDateStr.match(RE_ISO_DATE)) {
        newRepeatDateStr = convertISODateFilenameToNPDayFilename(newRepeatDateStr)
      }
      // $FlowIgnore[incompatible-type] TNote vs CoreNoteFields
      noteContainingNewPara = await DataStore.calendarNoteByDateString(newRepeatDateStr)
      if (noteContainingNewPara != null) {
        logDebug('generateRepeatForPara', `- adding repeat to FUTURE calendar note for ${newRepeatDateStr}`)
        await noteContainingNewPara.appendTodo(newRepeatContent)
        newPara = noteContainingNewPara.paragraphs[noteContainingNewPara.paragraphs.length - 1]
      } else {
        newRepeatContent += ` >${newRepeatDateStr}`
        if (noteIsOpenInEditor) {
          logDebug('generateRepeatForPara', `- adding repeat to Editor calendar note for ${newRepeatDateStr}`)
          await Editor.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
          newPara = Editor.paragraphs[newParaLineIndex]
        } else {
          logDebug('generateRepeatForPara', `- adding repeat to calendar note for ${newRepeatDateStr} (not open in Editor)`)
          await origNote.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
          newPara = origNote.paragraphs[newParaLineIndex]
        }
      }
    }

    if (!noteContainingNewPara) {
      throw new Error(`generateRepeatForPara: Couldn't get noteContainingNewPara for newRepeatContent: "${newRepeatContent}" in ${newRepeatDateStr}`)
    }

    // Add any indent for this new para
    if (newPara) {
      newPara.indents = origPara.indents
      noteContainingNewPara.updateParagraph(newPara)
    }

    // Delete the completed item (if wanted)
    // Note: next line uses API introduced in NP 3.15 build 1284/1230
    Editor.skipNextRepeatDeletionCheck = true
    if (config.deleteCompletedRepeat) {
      if (noteIsOpenInEditor) {
        Editor.removeParagraphAtIndex(origPara.lineIndex + 1)
      } else {
        origNote.removeParagraphAtIndex(origPara.lineIndex + 1)
      }
    } else {
      origPara.content = lineWithoutDoneTime
      if (noteIsOpenInEditor) {
        Editor.updateParagraph(origPara)
      } else {
        origNote.updateParagraph(origPara)
      }
    }

    return newPara
  } catch (error) {
    logError(pluginJson, `generateRepeatForPara(): ${JSP(error)}`)
    return null
  }
} 

/**
 * Generate a repeat task for a cancelled paragraph that contains an extended @repeat(interval) tag.
 * Note: this is intended to be called from a trigger, as it relies on detecting "newly cancelled" lines.
 * Unlike generateRepeatForPara(), this does not shorten an @done(...) datetime tag, because cancelled tasks don't have one.
 * The repeat date is computed using today's date as the "completedDate" anchor for '+...' intervals.
 * @author @jgclark
 * @param {TParagraph} origPara - The original cancelled paragraph containing the @repeat(interval) tag
 * @param {CoreNoteFields} noteToUse - The note containing the paragraph
 * @param {boolean} noteIsOpenInEditor - Whether the note is open in the editor
 * @returns {Promise<TParagraph | null>} The newly created paragraph, or null if no repeat was generated
 */
export async function generateRepeatForCancelledPara(
  origPara: TParagraph,
  noteToUse: CoreNoteFields,
  noteIsOpenInEditor: boolean,
): Promise<TParagraph | null> {
  try {
    const line = origPara.content ?? ''
    if (line === '') {
      return null
    }

    const cancelledDate = getTodaysDateHyphenated() // today
    const newRepeatDateStr = generateNewRepeatDate(noteToUse, line, cancelledDate)

    // Remove any >date and any @done() (defensive), and strip task/checklist cancelled markers if present
    let newRepeatContent = line
      .replace(RE_ANY_DUE_DATE_TYPE, '')
      .replace(/@done\(.*\)/, '')
      .replace(/^\s*?\*\s\[\-\]\s/, '')
      .replace(/^\s*?\-\s\[-\]\s/, '')
      .replace(/^\s*?\+\s\[+\]\s/, '')
    newRepeatContent = textWithoutSyncedCopyTag(newRepeatContent).trim()

    let newPara: TParagraph
    if (noteIsOpenInEditor) {
      await Editor.insertParagraphBeforeParagraph(`${newRepeatContent} >${newRepeatDateStr}`, origPara, 'open')
      newPara = Editor.paragraphs[origPara.lineIndex]
    } else {
      // $FlowIgnore[prop-missing] noteToUse is a TNote when not using Editor
      await noteToUse.insertParagraphBeforeParagraph(`${newRepeatContent} >${newRepeatDateStr}`, origPara, 'open')
      // $FlowIgnore[prop-missing] noteToUse is a TNote when not using Editor
      newPara = noteToUse.paragraphs[origPara.lineIndex]
    }

    if (newPara) {
      newPara.indents = origPara.indents
      if (noteIsOpenInEditor) {
        Editor.updateParagraph(newPara)
      } else {
        // $FlowIgnore[prop-missing] noteToUse is a TNote when not using Editor
        noteToUse.updateParagraph(newPara)
      }
    }

    return newPara
  } catch (error) {
    logError(pluginJson, `generateRepeatForCancelledPara(): ${JSP(error)}`)
    return null
  }
}
