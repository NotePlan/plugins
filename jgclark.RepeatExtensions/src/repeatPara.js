// @flow
//-----------------------------------------------------------------------
// Repeat Extensions plugin for NotePlan
// Jonathan Clark
// last updated 2026-03-19, for v1.1.0
//-----------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { generateNewRepeatDate, type RepeatConfig } from './repeatHelpers'
import {
  convertISODateFilenameToNPDayFilename,
  getTodaysDateHyphenated,
  RE_ANY_DUE_DATE_TYPE,
  RE_DONE_DATE_TIME,
  RE_DONE_DATE_TIME_CAPTURES,
  RE_ISO_DATE, // find dates of form YYYY-MM-DD
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logInfo, logWarn, logError } from "@helpers/dev"
import { textWithoutSyncedCopyTag } from '@helpers/syncedCopies'

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
    // logDebug('generateRepeatForPara', `Starting for "${origPara.content}" in ${noteToUse.filename}. noteIsOpenInEditor: ${String(noteIsOpenInEditor)}`)
    const line = origPara.content ?? ''
    let lineWithoutDoneTime = ''
    let completedDate = ''

    // Check if line has datetime to shorten
    if (!RE_DONE_DATE_TIME.test(line)) {
      return null
    }

    // For #672, if the completed task is in a regular/project note, and the sync copy is in a Calendar note, then the new repeated task should appear in the regular note.
    const syncCopyParas: Array<TParagraph> = DataStore.referencedBlocks(origPara)
    const origParaIsSynced = syncCopyParas.length>=1 // this doesn't report itself
    const syncCopiesInRegularNotes = (origParaIsSynced) ? syncCopyParas.filter((p) => p?.note?.type === 'Notes') : []
    logDebug('generateRepeatForPara', `- found ${syncCopiesInRegularNotes.length} syncCopiesInRegularNotes`)

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
    let noteContainingNewPara: TNote = noteToUse

    // Generate the new repeat date
    let newRepeatDateStr = generateNewRepeatDate(noteToUse, origPara.content, completedDate)
    if (newRepeatDateStr === completedDate) {
      logWarn(`generateRepeatForPara`, `newRepeatDateStr ${newRepeatDateStr} is same as completedDate ${completedDate}`)
    }

    // Remove any >date and @done() on the new task
    let newRepeatContent = lineWithoutDoneTime
      .replace(RE_ANY_DUE_DATE_TYPE, '')
      .replace(/@done\(.*\)/, '')
      .replace(/^\* /, '')
    // Also now remove any sync marker, and trim
    newRepeatContent = textWithoutSyncedCopyTag(newRepeatContent).trim()
    logDebug('generateRepeatForPara', `- newRepeatContent: "${newRepeatContent}"`)
    
    // Add the new repeat
    if (syncCopiesInRegularNotes.length > 0) {
      // If the origPara is synced to a regular note, then write to the (first) of those regular note(s)
      const syncSourceNote: ?TNote = syncCopiesInRegularNotes[0]?.note
      if (syncSourceNote == null) {
        throw new Error(`generateRepeatForPara: Cannot get syncSourceNote for origPara: "${origPara.content}" in ${noteToUse.filename}`)
      }
      logDebug('generateRepeatForPara', `- adding repeat to regular note where origPara is synced (${syncSourceNote.filename})`)
      newRepeatContent += ` >${newRepeatDateStr}`
      await syncSourceNote.insertParagraphBeforeParagraph(newRepeatContent, syncCopiesInRegularNotes[0], 'open')
      newPara = syncSourceNote.paragraphs[syncCopiesInRegularNotes[0].lineIndex]
      noteContainingNewPara = syncSourceNote
    } else if (noteToUse.type === 'Notes') {
      // First handle regular/project note. Or now, if the origPara is synced to a regular/project note
      logDebug('generateRepeatForPara', `- adding repeat to regular note ${noteToUse.filename}`)
      newRepeatContent += ` >${newRepeatDateStr}`
      if (noteIsOpenInEditor) {
        await Editor.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
        newPara = Editor.paragraphs[newParaLineIndex]
      } else {
        await noteToUse.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
        newPara = noteToUse.paragraphs[newParaLineIndex]
      }
    } else {
      // Else add the new repeat to the calendar note
      if (newRepeatDateStr.match(RE_ISO_DATE)) {
        newRepeatDateStr = convertISODateFilenameToNPDayFilename(newRepeatDateStr)
      }
      const futureNote = await DataStore.calendarNoteByDateString(newRepeatDateStr)
      if (futureNote != null) {
        logDebug('generateRepeatForPara', `- adding repeat to FUTURE calendar note for ${newRepeatDateStr}`)
        await futureNote.appendTodo(newRepeatContent)
        newPara = futureNote.paragraphs[futureNote.paragraphs.length - 1]
        noteContainingNewPara = futureNote
      } else {
        newRepeatContent += ` >${newRepeatDateStr}`
        if (noteIsOpenInEditor) {
          logDebug('generateRepeatForPara', `- adding repeat to Editor calendar note for ${newRepeatDateStr}`)
          await Editor.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
          newPara = Editor.paragraphs[newParaLineIndex]
        } else {
          logDebug('generateRepeatForPara', `- adding repeat to calendar note for ${newRepeatDateStr} (not open in Editor)`)
          await noteToUse.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
          newPara = noteToUse.paragraphs[newParaLineIndex]
        }
      }
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
