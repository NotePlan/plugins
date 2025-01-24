// @flow
//-----------------------------------------------------------------------
// Repeat Extensions plugin for NotePlan
// Jonathan Clark
// last updated 2025-01-24, for v0.9.0
//-----------------------------------------------------------------------

// import moment from 'moment'
import pluginJson from "../plugin.json"
import {
  generateNewRepeatDate,
  getRepeatSettings,
  type RepeatConfig,
} from './repeatHelpers'
import {
  RE_ANY_DUE_DATE_TYPE,
  RE_DATE_INTERVAL,
  RE_DONE_DATE_TIME,
  RE_DONE_DATE_TIME_CAPTURES,
  RE_ISO_DATE, // find dates of form YYYY-MM-DD
  unhyphenateString,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logInfo, logWarn, logError } from "@helpers/dev"
import { logAllEnvironmentSettings } from "@helpers/NPdev"
import { displayTitle } from '@helpers/general'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { selectedLinesIndex } from '@helpers/NPParagraph'
import { showMessage } from '@helpers/userInput'

//------------------------------------------------------------------
// Regexes

const RE_EXTENDED_REPEAT = `@repeat\\(${RE_DATE_INTERVAL}\\)` // find @repeat()
// const RE_EXTENDED_REPEAT_CAPTURE = `@repeat\\((.*?)\\)` // find @repeat() and return part inside brackets

//------------------------------------------------------------------
/**
 * Respond to onEditorWillSave trigger for the currently open note. 
 * Will fire generateRepeats() if the a changed text region includes '@done(...) and @repeat(...)'
 */
export async function onEditorWillSave(): Promise<void> {
  try {
    if (Editor.content && Editor.note) {
      const latestContent = Editor.content ?? ''
      const noteReadOnly: CoreNoteFields = Editor.note
      const previousContent = noteReadOnly.versions[0].content
      const timeSinceLastEdit: number = Date.now() - noteReadOnly.versions[0].date

      // logDebug(pluginJson, `onEditorWillSave triggered for '${noteReadOnly.filename}' with ${noteReadOnly.versions.length} versions; last triggered ${String(timeSinceLastEdit)}ms ago`)
      // logDebug(pluginJson, `- previous version: ${String(noteReadOnly.versions[0].date)} [${previousContent}]`)
      // logDebug(pluginJson, `- new version: ${String(Date.now())} [${latestContent}]`)

      // first check to see if this has been called in the last 2000ms: if so don't proceed, as this could be a double call.
      if (timeSinceLastEdit <= 2000) {
        // logDebug(pluginJson, `onEditorWillSave fired, but ignored, as it was called only ${String(timeSinceLastEdit)}ms after the last one`)
        return
      }

      // Get changed ranges
      const ranges = NotePlan.stringDiff(previousContent, latestContent)
      if (!ranges || ranges.length === 0) {
        // logDebug('repeatExtensions/onEditorWillSave', `No ranges returned, so stopping.`)
        return
      }
      const earliestStart = ranges[0].start
      const latestEnd = ranges[ranges.length - 1].end
      const overallRange: TRange = Range.create(earliestStart, latestEnd)
      // logDebug('repeatExtensions/onEditorWillSave', `- overall changed content from ${rangeToString(overallRange)}`)

      // Get changed lineIndexes
      // earlier method for changedExtent based on character region, which didn't seem to always include all the changed parts.
      // const changedExtent = latestContent?.slice(earliestStart, latestEnd)
      // Editor.highlightByIndex(earliestStart, latestEnd - earliestStart)
      // logDebug('repeatExtensions/onEditorWillSave', `Changed content extent: <${changedExtent}>`)
      // Newer method uses changed paragraphs: this will include more than necessary, but that's more useful in this case
      let changedExtent = ''
      const [startParaIndex, endParaIndex] = selectedLinesIndex(overallRange, Editor.paragraphs)
      // logDebug('repeatExtensions/onEditorWillSave', `- changed lines ${startParaIndex}-${endParaIndex}`)
      for (let i = startParaIndex; i <= endParaIndex; i++) {
        changedExtent += Editor.paragraphs[i].content
      }
      // logDebug('repeatExtensions/onEditorWillSave', `Changed content extent:\n<${changedExtent}>`)

      // If the changed text includes @done(...) then we may have something to update, so run repeats()
      if (changedExtent.match(RE_DONE_DATE_TIME) && changedExtent.match(RE_EXTENDED_REPEAT)) {
        logDebug('repeatExtensions/onEditorWillSave', `Found @done(...) so will call generatedRepeats ...`)
        // Call main generateRepeats() function, but don't show if there are no repeats found
        // $FlowIgnore[incompatible-call]
        const res = await generateRepeats(true) // i.e. run loudly on the Editor
      }
    } else {
      throw new Error("Cannot get Editor details. Is there a note open in the Editor?")
    }
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

/**
 * Process any completed (or cancelled) tasks with my extended @repeat(..) tags, and also remove the HH:MM portion of any @done(...) tasks.
 * Runs on the currently open note (using Editor.* funcs),
 * or (since v0.7.1) on a passed TNote.
 * When interval is of the form '+2w' it will duplicate the task for 2 weeks after the date is was completed.
 * When interval is of the form '2w' it will duplicate the task for 2 weeks after the date the task was last due. If this can't be determined, it uses the note date. If this can't be determined, then default to completed date.
 * Valid intervals are [0-9][bdwmqy].
 * To work it relies on finding @done(YYYY-MM-DD HH:MM) tags that haven't yet been shortened to @done(YYYY-MM-DD).
 * It includes cancelled tasks as well; to remove a repeat entirely, remove the @repeat tag from the task in NotePlan.
 * Note: The new repeat date is by default scheduled to a day (>YYYY-MM-DD). But if the scheduled date is a week date (YYYY-Wnn), or the repeat is in a weekly note, then the new repeat date will be a scheduled week link (>YYYY-Wnn).
 * Note: Runs on the currently open note (using Editor.* funcs) if possible, or now on noteArg too (not using Editor.* funcs)
 * Note: Could add a 'Newer' mode of operation according to GH # 351.
 * TEST: fails to appendTodo to note with same stem?
 * @author @jgclark
 * @param {boolean} runSilently? [default: false]
 * @param {TNote?} noteArg optional note to process
 * @returns {number} number of generated repeats
 */
export async function generateRepeats(
  runSilently: boolean = false,
  noteArg?: TNote
): Promise<number> {
  try {
    // Get passed note details, or fall back to Editor
    let noteToUse: TNote
    let noteIsOpenInEditor = false // when true we can use a faster-to-user function
    if (noteArg) {
      noteToUse = noteArg
      logDebug(pluginJson, `generateRepeats() starting with noteArg -> ${noteToUse.filename}`)
    } else if (Editor && Editor.note) {
      noteToUse = Editor
      noteIsOpenInEditor = true
      logDebug(pluginJson, `generateRepeats() starting with EDITOR -> ${noteToUse.filename}`)
    } else {
      throw new Error(`Couldn't get either passed Note argument or Editor.note: stopping`)
    }
    const { paragraphs, type, filename } = noteToUse
    if (paragraphs === null) {
      // No note open, or no paragraphs (perhaps empty note), so don't do anything.
      logInfo(pluginJson, 'No note open, or empty note.')
      return 0
    }
    let lineCount = paragraphs.length

    // check if the last paragraph is undefined, and if so delete it from our copy
    if (paragraphs[lineCount] === null) {
      lineCount--
    }

    const config: RepeatConfig = await getRepeatSettings()

    // Work out where to stop looking: default to whole note, but if desired can stop where ## Done or ## Cancelled sections start, if present
    const lastLineIndexToCheck = (config.dontLookForRepeatsInDoneOrArchive)
      ? findEndOfActivePartOfNote(noteToUse)
      : lineCount - 1
    if (lastLineIndexToCheck === 0) {
      logDebug(pluginJson, `generateRepeats() starting for '${filename}' but no active lines so won't process`)
      return 0
    } else {
      logDebug(pluginJson, `generateRepeats() starting for '${filename}' for ${config.dontLookForRepeatsInDoneOrArchive ? 'ACTIVE' : 'ALL'} ${lastLineIndexToCheck} lines`)
    }

    let repeatCount = 0
    let line = ''
    let completedDate = ''
    let completedTime = ''
    let reReturnArray: Array<string> = []

    // Go through each line in the active part of the file
    for (let n = 0; n <= lastLineIndexToCheck; n++) {
      const p = paragraphs[n]
      line = p.content ?? ''
      let lineWithoutDoneTime = ''
      completedDate = ''

      // find lines with datetime to shorten, and capture date part of it. i.e. @done(YYYY-MM-DD HH:MM[AM|PM])
      if (RE_DONE_DATE_TIME.test(line)) {
        // get completed date and time
        reReturnArray = line.match(RE_DONE_DATE_TIME_CAPTURES) ?? []
        completedDate = reReturnArray[1]
        completedTime = reReturnArray[2]
        logDebug('generateRepeats', `- found newly completed task in line ${n}: "${line}"`)

        // remove time string from completed date-time
        lineWithoutDoneTime = line.replace(completedTime, '') // couldn't get a regex to work here
        p.content = lineWithoutDoneTime
        // Send the update to the note
        noteToUse.updateParagraph(p)
        // logDebug('generateRepeats', `- updated para ${p.lineIndex} -> <${lineWithoutDoneTime}>`)

        // Test if this is one of my special extended repeats
        if (lineWithoutDoneTime.match(RE_EXTENDED_REPEAT)) {
          repeatCount++

          // Generate the new repeat date
          let newRepeatDateStr = generateNewRepeatDate(noteToUse, p.content, completedDate)
          logDebug('generateRepeats', `- newRepeatDateStr: "${newRepeatDateStr}"`)
          if (newRepeatDateStr === completedDate) {
            logWarn(`generateRepeats`, `newRepeatDateStr ${newRepeatDateStr} is same as completedDate ${completedDate}`)
          }
          // Remove any >date and @done()
          let outputLine = lineWithoutDoneTime.replace(RE_ANY_DUE_DATE_TYPE, '').replace(/@done\(.*\)/, '').trim()
          // logDebug('generateRepeats', `- outputLine: ${outputLine}`)

          // Add the new date
          if (type === 'Notes') {
            // Add in same project note, including new scheduled date
            outputLine += ` >${newRepeatDateStr}`
            logDebug('generateRepeats', `- outputLine: "${outputLine}"`)
            if (noteIsOpenInEditor) {
              await Editor.insertParagraphBeforeParagraph(outputLine, p, 'open')
              logInfo('generateRepeats', `- inserted new repeat at line ${p.lineIndex} in Editor`)
            } else {
              await noteToUse.insertParagraphBeforeParagraph(outputLine, p, 'open')
              logInfo('generateRepeats', `- inserted new repeat at line ${p.lineIndex} in '${noteToUse.filename}'`)
            }
          }
          else {
            // Add in the future Calendar note

            // Get future note (if it exists)
            if (newRepeatDateStr.match(RE_ISO_DATE)) {
              newRepeatDateStr = unhyphenateString(newRepeatDateStr)
              logDebug('generateRepeats', `- changed newRepeatDateStr to ${newRepeatDateStr}`)
            }
            const futureNote = await DataStore.calendarNoteByDateString(newRepeatDateStr)
            if (futureNote != null) {
              // Add todo to future note
              await futureNote.appendTodo(outputLine)
              logInfo('generateRepeats', `- appended new repeat in calendar note ${displayTitle(futureNote)}`)
            } else {
              // After a fix to future calendar note creation in r635, we shouldn't get here.
              // But just in case, we'll insert new repeat into the open note
              outputLine += ` >${newRepeatDateStr}`
              logDebug('generateRepeats', `- outputLine: ${outputLine}`)
              if (noteIsOpenInEditor) {
                await Editor.insertParagraphBeforeParagraph(outputLine, p, 'open')
              } else {
                await noteToUse.insertParagraphBeforeParagraph(outputLine, p, 'open')
              }
              logWarn('generateRepeats', `- couldn't get futureNote, so instead inserted new para after line ${p.lineIndex} in original note`)
            }
          }

          // delete or update the completed item line (depending on 'deleteCompletedRepeat')
          // but first turn off the repeat delete warning for this next operation (only effective from 3.15+ b1284/1230)
          Editor.skipNextRepeatDeletionCheck = true
          if (config.deleteCompletedRepeat) {
            // delete the completed line entirely
            logInfo('generateRepeats', `- removing para ${String(n + 1)}`)
            // Remove para from the mote
            // noteToUse.removeParagraph(p)
            if (noteIsOpenInEditor) {
              Editor.removeParagraphAtIndex(n + 1)
            } else {
              noteToUse.removeParagraphAtIndex(n + 1)
            }
            logDebug('generateRepeats', `- after removal, ${String(noteToUse.paragraphs.length)} lines`)
          } else {
            // update the line in place
            p.content = lineWithoutDoneTime
            if (noteIsOpenInEditor) {
              Editor.updateParagraph(p)
            } else {
              noteToUse.updateParagraph(p)
            }
            logDebug('generateRepeats', `- updated line ${p.lineIndex}`)
          }
        }
      }
    }
    if (repeatCount === 0) {
      logDebug('generateRepeats', 'No suitable completed repeats were found')
      if (!runSilently) {
        await showMessage('No suitable completed repeats were found', 'OK', 'Repeat Extensions')
      }
    }
    return repeatCount
  } catch (error) {
    logError(pluginJson, `generateRepeats(): ${JSP(error)}`)
    return 0
  }
}
