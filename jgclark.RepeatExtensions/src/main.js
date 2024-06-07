// @flow
//-----------------------------------------------------------------------
// Repeat Extensions plugin for NotePlan
// Jonathan Clark
// last updated 7.6.2024 for v0.7.1
//-----------------------------------------------------------------------

// import moment from 'moment'
import pluginJson from "../plugin.json"
import {
  // calcOffsetDate,
  calcOffsetDateStr,
  isWeeklyNote,
  isMonthlyNote,
  isQuarterlyNote,
  isYearlyNote,
  RE_ANY_DUE_DATE_TYPE,
  RE_DATE_INTERVAL,
  RE_DONE_DATE_TIME,
  RE_DONE_DATE_TIME_CAPTURES,
  RE_ISO_DATE, // find dates of form YYYY-MM-DD
  RE_SCHEDULED_DAILY_NOTE_LINK,
  RE_SCHEDULED_WEEK_NOTE_LINK,
  RE_SCHEDULED_MONTH_NOTE_LINK,
  RE_SCHEDULED_QUARTERLY_NOTE_LINK,
  RE_SCHEDULED_YEARLY_NOTE_LINK,
  unhyphenateString,
  hyphenatedDateString,
} from '@helpers/dateTime'
import { logDebug, logInfo, logWarn, logError } from "@helpers/dev"
import { logAllEnvironmentSettings } from "@helpers/NPdev"
import { displayTitle } from '@helpers/general'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { selectedLinesIndex } from '@helpers/NPParagraph'
import { showMessage } from '@helpers/userInput'

//------------------------------------------------------------------
// Regexes

const RE_EXTENDED_REPEAT = `@repeat\\(${RE_DATE_INTERVAL}\\)` // find @repeat()
const RE_EXTENDED_REPEAT_CAPTURE = `@repeat\\((.*?)\\)` // find @repeat() and return part inside brackets

//------------------------------------------------------------------
/**
 * Respond to onEditorWillSave trigger for the currently open note
 */
export async function onEditorWillSave(): Promise<void> {
  try {
    if (Editor.content && Editor.note) {
      const latestContent = Editor.content ?? ''
      const noteReadOnly: CoreNoteFields = Editor.note
      const previousContent = noteReadOnly.versions[0].content
      const timeSinceLastEdit: number = Date.now() - noteReadOnly.versions[0].date

      logDebug(pluginJson, `onEditorWillSave triggered for '${noteReadOnly.filename}' with ${noteReadOnly.versions.length} versions; last triggered ${String(timeSinceLastEdit)}ms ago`)
      // logDebug(pluginJson, `- previous version: ${String(noteReadOnly.versions[0].date)} [${previousContent}]`)
      // logDebug(pluginJson, `- new version: ${String(Date.now())} [${latestContent}]`)

      // first check to see if this has been called in the last 2000ms: if so don't proceed, as this could be a double call.
      if (timeSinceLastEdit <= 2000) {
        logDebug(pluginJson, `onEditorWillSave fired, but ignored, as it was called only ${String(timeSinceLastEdit)}ms after the last one`)
        return
      }

      // Get changed ranges
      const ranges = NotePlan.stringDiff(previousContent, latestContent)
      if (!ranges || ranges.length === 0) {
        logDebug('repeatExtensions/onEditorWillSave', `No ranges returned, so stopping.`)
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
      logDebug('repeatExtensions/onEditorWillSave', `- changed lines ${startParaIndex}-${endParaIndex}`)
      for (let i = startParaIndex; i <= endParaIndex; i++) {
        changedExtent += Editor.paragraphs[i].content
      }
      // logDebug('repeatExtensions/onEditorWillSave', `Changed content extent: <${changedExtent}>`)

      // If the changed text includes @done(...) then we may have something to update, so run repeats()
      if (changedExtent.match(RE_DONE_DATE_TIME) && changedExtent.match(RE_EXTENDED_REPEAT)) {
        // Call main generateRepeats() function, but don't show if there are no repeats found
        // $FlowIgnore[incompatible-call]
        const res = await generateRepeats(Editor.note, false) // i.e. run silently
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
 * Note: Runs on the currently open note (using Editor.* funcs)
 * Note: Could add a 'Newer' mode of operation according to # 351.
 * TEST: fails to appendTodo to note with same stem?
 * @author @jgclark
 * @param {TNote?} noteArg optional note to process
 * @param {boolean} runSilently?
 * @returns {number} number of generated repeats
 */
export async function generateRepeats(noteArg?: TNote, runSilently: boolean = false): Promise<number> {
  try {
    // Get passed note details, or fall back to Editor. (Note: v0.5.2 changed this to run from 'Editor.note' only)
    let noteToUse: TNote
    let noteIsOpenInEditor = false // means we can use a faster-to-user function when true
    if (noteArg) {
      noteToUse = noteArg
      // logDebug(pluginJson, `noteArg -> ${displayTitle(noteToUse)}`)
    } else if (Editor && Editor.note) {
      noteToUse = Editor.note
      noteIsOpenInEditor = true
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

    // work out where ## Done or ## Cancelled sections start, if present
    const endOfActive = findEndOfActivePartOfNote(noteToUse)
    if (endOfActive === 0) {
      logDebug(pluginJson, `generateRepeats() starting for '${filename}' but no active lines so won't process`)
      return 0
    } else {
      logDebug(pluginJson, `generateRepeats() starting for '${filename}' for ${endOfActive} active lines`)
    }

    let repeatCount = 0
    let line = ''
    // let updatedLine = ''
    let completedDate = ''
    let completedTime = ''
    let reReturnArray: Array<string> = []

    // Go through each line in the active part of the file
    for (let n = 0; n <= endOfActive; n++) {
      const p = paragraphs[n]
      line = p.content
      let lineWithoutDoneTime = ''
      completedDate = ''

      // find lines with datetime to shorten, and capture date part of it
      // i.e. @done(YYYY-MM-DD HH:MM[AM|PM])
      if (line.match(RE_DONE_DATE_TIME)) {
        // get completed date and time
        reReturnArray = line.match(RE_DONE_DATE_TIME_CAPTURES) ?? []
        completedDate = reReturnArray[1]
        completedTime = reReturnArray[2]
        // logDebug('generateRepeats', `- found completed task with date-time ${completedDate} ${completedTime} in line ${n}`)

        // remove time string from completed date-time
        lineWithoutDoneTime = line.replace(completedTime, '') // couldn't get a regex to work here
        p.content = lineWithoutDoneTime
        // Send the update to the Editor
        noteToUse.updateParagraph(p)
        // logDebug('generateRepeats', `- updated para ${p.lineIndex} -> <${lineWithoutDoneTime}>`)

        // Test if this is one of my special extended repeats
        if (lineWithoutDoneTime.match(RE_EXTENDED_REPEAT)) {
          repeatCount++

          // Create and add the new repeat line
          let newRepeatDateStr = generateUpdatedLineContent(noteToUse, p.content, completedDate)
          let outputLine = p.content.replace(/@done\(.*\)/, '').trim()

          if (type === 'Notes') {
            // Add in same project note, including new scheduled date
            outputLine += ` >${newRepeatDateStr}`
            logDebug('generateRepeats', `- outputLine: "${outputLine}"`)
            if (noteIsOpenInEditor) {
              await Editor.insertParagraphBeforeParagraph(outputLine, p, 'open')
            } else {
              await noteToUse.insertParagraphBeforeParagraph(outputLine, p, 'open')
            }
            logInfo('generateRepeats', `- inserted new para after line ${p.lineIndex}`)
          }
          else {
            // Add in the future Calendar note
            // let futureNote
            // let newRepeatDateStr = ''
            // if (isDailyNote(note)) {
            //   // Get YYYY-MM-DD style date
            //   newRepeatDateStr = unhyphenateString(newRepeatDateStr)
            // }
            // else if (isWeeklyNote(note)) {
            //   // Get YYYY-Wnn style date
            //   // older version, but doesn't align with NP user week-start setting
            //   // newRepeatDateStr = getISOWeekString(newRepeatDateStr)
            //   // newer version, using helper that takes week-start into account
            //   // $FlowFixMe[incompatible-type]
            //   const weekInfo: NotePlanWeekInfo = getNPWeekData(newRepeatDateStr)
            //   newRepeatDateStr = weekInfo.weekString
            // }
            logDebug(pluginJson, `- repeat -> ${newRepeatDateStr}`)

            // Get future note (if it exists)
            if (newRepeatDateStr.match(RE_ISO_DATE)) {
              newRepeatDateStr = unhyphenateString(newRepeatDateStr)
              logDebug('generateRepeats', `- changed newRepeatDateStr to ${newRepeatDateStr}`)
            }
            const futureNote = await DataStore.calendarNoteByDateString(newRepeatDateStr)
            // let futureNote = await DataStore.calendarNoteByDate(newRepeatDate, outputTimeframe)
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
              logInfo('generateRepeats', `- couldn't get futureNote, so instead inserted new para after line ${p.lineIndex} in original note`)
            }
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
    logError(pluginJson, `generateRepeats(): ${error.message}`)
    return 0
  }
}

function generateUpdatedLineContent(noteToUse: CoreNoteFields, currentContent: string, completedDate: string): string {
  // get repeat to apply
  const reReturnArray = currentContent.match(RE_EXTENDED_REPEAT_CAPTURE) ?? []
  let dateIntervalString: string = (reReturnArray.length > 0) ? reReturnArray[1] : ''
  logDebug('generateRepeats', `- Found extended @repeat syntax: '${dateIntervalString}'`)

  // decide style of new date: daily / weekly / monthly / etc.link
  let outputTimeframe = 'day'
  if (currentContent.match(RE_SCHEDULED_WEEK_NOTE_LINK) || isWeeklyNote(noteToUse)) {
    outputTimeframe = 'week'
  } else if (currentContent.match(RE_SCHEDULED_MONTH_NOTE_LINK) || isMonthlyNote(noteToUse)) {
    outputTimeframe = 'month'
  } else if (currentContent.match(RE_SCHEDULED_QUARTERLY_NOTE_LINK) || isQuarterlyNote(noteToUse)) {
    outputTimeframe = 'quarter'
  } else if (currentContent.match(RE_SCHEDULED_YEARLY_NOTE_LINK) || isYearlyNote(noteToUse)) {
    outputTimeframe = 'year'
  }
  logDebug('generateRepeats', `- outputTimeframe: ${outputTimeframe}`)

  let newRepeatDateStr = ''
  // let newRepeatDate: Date
  let output = currentContent

  if (dateIntervalString[0].startsWith('+')) {
    // New repeat date = completed date (of form YYYY-MM-DD) + interval
    dateIntervalString = dateIntervalString.substring(
      1,
      dateIntervalString.length,
    )
    // newRepeatDate = calcOffsetDate(completedDate, dateIntervalString) ?? new moment().startOf('day').toDate()
    newRepeatDateStr = calcOffsetDateStr(completedDate, dateIntervalString)
    logDebug('generateRepeats', `- adding from completed date ${newRepeatDateStr}`)
    // Remove any >date
    output = output.replace(RE_ANY_DUE_DATE_TYPE, '')
    logDebug('generateRepeats', `- output: ${output}`)

  } else {
    // New repeat date = due date + interval
    // look for the due date (>YYYY-MM-DD) or other calendar types
    let dueDate = ''
    const dueDateArray = RE_SCHEDULED_DAILY_NOTE_LINK.test(output)
      ? output.match(RE_SCHEDULED_DAILY_NOTE_LINK)
      : RE_SCHEDULED_WEEK_NOTE_LINK.test(output)
        ? output.match(RE_SCHEDULED_WEEK_NOTE_LINK)
        : RE_SCHEDULED_MONTH_NOTE_LINK.test(output)
          ? output.match(RE_SCHEDULED_MONTH_NOTE_LINK)
          : RE_SCHEDULED_QUARTERLY_NOTE_LINK.test(output)
            ? output.match(RE_SCHEDULED_QUARTERLY_NOTE_LINK)
            : RE_SCHEDULED_YEARLY_NOTE_LINK.test(output)
              ? output.match(RE_SCHEDULED_YEARLY_NOTE_LINK)
              : []
    logDebug('generateRepeats', `- dueDateArray: ${String(dueDateArray)}`)
    if (dueDateArray && dueDateArray[0] != null) {
      dueDate = dueDateArray[0].split('>')[1]
      logDebug('generateRepeats', `  due date match = ${dueDate}`)
      // need to remove the old due date
      output = output.replace(` >${dueDate}`, '')
    } else {
      // there is no due date, so try the note date, otherwise use completed date
      dueDate = noteToUse.date ? hyphenatedDateString(noteToUse.date) : completedDate
      logDebug('generateRepeats', `- no match => use note/completed date ${dueDate}`)
    }
    newRepeatDateStr = calcOffsetDateStr(dueDate, dateIntervalString, outputTimeframe)
    logDebug('generateRepeats', `- adding from due date -> ${newRepeatDateStr}`)
  }
  return newRepeatDateStr
}
