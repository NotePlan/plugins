// @flow
//-----------------------------------------------------------------------
// Repeat Extensions plugin for NotePlan
// Jonathan Clark
// last updated 21.12.2022 for v0.4.0-beta
//-----------------------------------------------------------------------

import pluginJson from "../plugin.json"
import {
  calcOffsetDateStr,
  RE_DATE, // find dates of form YYYY-MM-DD
  RE_DATE_INTERVAL,
  RE_DATE_TIME,
  RE_DONE_DATE_TIME,
  RE_DONE_DATE_TIME_CAPTURES,
  RE_TIME, // find '12:23' with optional '[ ][AM|PM|am|pm]'
  unhyphenateString,
} from '@helpers/dateTime'
import { logDebug, logInfo, logWarn, logError } from "@helpers/dev"
import { displayTitle, rangeToString } from '@helpers/general'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { selectedLinesIndex } from '@helpers/NPparagraph'
import { showMessage } from '@helpers/userInput'

//------------------------------------------------------------------
// Regexes

const RE_DUE_DATE_CAPTURE = `\\s+>(${RE_DATE})` // find ' >2021-02-23' and return just date part
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

      // first check to see if this has been called in the last 1000ms: if so don't proceed, as this could be a double call.
      if (timeSinceLastEdit <= 2000) {
        logDebug(pluginJson, `onEditorWillSave fired, but ignored, as it was called only ${String(timeSinceLastEdit)}ms after the last one`)
        return
      }

      // Get changed ranges
      const ranges = NotePlan.stringDiff(previousContent, latestContent)
      if (!ranges || ranges.length === 0) {
        throw new Error(`No ranges returned for some reason. Stopping.`)
      }
      const earliestStart = ranges[0].start
      let latestEnd = ranges[ranges.length - 1].end
      const overallRange: TRange = Range.create(earliestStart, latestEnd)
      logDebug('repeatExtensions/onEditorWillSave', `- overall changed content from ${rangeToString(overallRange)}`)
      // Get changed lineIndexes

      // earlier method for changedExtent based on character region, which didn't seem to always include all the changed parts.
      // const changedExtent = latestContent?.slice(earliestStart, latestEnd)
      // Editor.highlightByIndex(earliestStart, latestEnd - earliestStart)
      // logDebug('repeatExtensions/onEditorWillSave', `Changed content extent: <${changedExtent}>`)

      // Newer method uses changed paragraphs: this will include more than necessary, but that's more useful in this case
      let changedExtent = ''
      const [startParaIndex, endParaIndex] = selectedLinesIndex(overallRange, Editor.paragraphs)
      logDebug('repeatExtensions/onEditorWillSave', `- changed lines ${startParaIndex}-${endParaIndex}`)
      // Editor.highlightByIndex(earliestStart, latestEnd - earliestStart)
      for (let i = startParaIndex; i <= endParaIndex; i++) {
        changedExtent += Editor.paragraphs[i].content
      }
      logDebug('repeatExtensions/onEditorWillSave', `Changed content extent: <${changedExtent}>`)

      // If the changed text includes @done(...) then we may have something to update, so run repeats()
      if (changedExtent.match(RE_DONE_DATE_TIME) && changedExtent.match(RE_EXTENDED_REPEAT)) {
        // Call main repeat() function, but don't show if there are no repeats found
        await repeats(Editor)
      }
    } else {
      throw new Error("Cannot get Editor details. Is there a note open in the Editor?")
    }
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

/**
 * Process any completed (or cancelled) tasks with my extended @repeat(..) tags,
 * and also remove the HH:MM portion of any @done(...) tasks.
 * When interval is of the form '+2w' it will duplicate the task for 2 weeks after the date is was completed.
 * When interval is of the form '2w' it will duplicate the task for 2 weeks after the date the task was last due.If this can't be determined, then default to the first option.
 * Valid intervals are [0-9][bdwmqy].
 * To work it relies on finding @done(YYYY-MM-DD HH:MM) tags that haven't yet been shortened to @done(YYYY-MM-DD).
 * It includes cancelled tasks as well; to remove a repeat entirely, remove the @repeat tag from the task in NotePlan.
 * @author @jgclark
 * @param {CoreNoteFields} noteIn?
 */
export async function repeats(noteIn?: CoreNoteFields): Promise<void> {
  try {
    // Get passed note details, or fall back to Editor
    let note: CoreNoteFields
    let showMessages: boolean
    if (noteIn) {
      note = noteIn
      showMessages = false
    } else {
      if (!Editor.note) {
        throw new Error(`repeats: Couldn't get Editor.note to process`)
      }
      note = Editor.note
      showMessages = true
    }
    const { paragraphs, title, type } = note
  if (note === null || paragraphs === null) {
    // No note open, or no paragraphs (perhaps empty note), so don't do anything.
    logError(pluginJson, 'No note open, or empty note.')
    return
  }
  let lineCount = paragraphs.length
    logDebug(pluginJson, `repeats starting for note with ${lineCount} paras and showMessages: ${String(showMessages)}`)

  // check if the last paragraph is undefined, and if so delete it from our copy
  if (paragraphs[lineCount] === null) {
    lineCount--
  }

  // work out where ## Done or ## Cancelled sections start, if present
  // $FlowIgnore[incompatible-call]
  const endOfActive = findEndOfActivePartOfNote(note)

  let repeatCount = 0
  let line = ''
  let updatedLine = ''
  let completedDate = ''
  let completedTime = ''
  let reReturnArray: Array<string> = []

  // Go through each line in the active part of the file
  for (let n = 0; n < endOfActive; n++) {
    const p = paragraphs[n]
    line = p.content
    updatedLine = ''
    completedDate = ''

    // find lines with datetime to shorten, and capture date part of it
    // i.e. @done(YYYY-MM-DD HH:MM[AM|PM])
    // logDebug('repeats', `  [${n}] ${line}`)
    if (p.content.match(RE_DONE_DATE_TIME)) {
      // get completed date and time
      reReturnArray = line.match(RE_DONE_DATE_TIME_CAPTURES) ?? []
      completedDate = reReturnArray[1]
      completedTime = reReturnArray[2]
      logDebug('repeats', `Found completed repeat ${completedDate} ${completedTime} in line ${n}`)
      
      // remove time string from completed date-time
      updatedLine = line.replace(completedTime, '') // couldn't get a regex to work here
      p.content = updatedLine
      // Send the update to the Editor
      Editor.updateParagraph(p)
      logDebug('repeats', `    updated Paragraph ${p.lineIndex}`)

      // Test if this is one of my special extended repeats
      if (updatedLine.match(RE_EXTENDED_REPEAT)) {
        repeatCount++
        let newRepeatDate = ''
        let outputLine = ''
        // get repeat to apply
        reReturnArray = updatedLine.match(RE_EXTENDED_REPEAT_CAPTURE) ?? []
        // $FlowIgnore[incompatible-use]
        let dateIntervalString = (reReturnArray.length > 0) ? reReturnArray[1] : ''
        logDebug('repeats', `  Found EXTENDED @repeat syntax: '${dateIntervalString}'`)

        if (dateIntervalString[0].startsWith('+')) {
          // New repeat date = completed date + interval
          dateIntervalString = dateIntervalString.substring(
            1,
            dateIntervalString.length,
          )
          newRepeatDate = calcOffsetDateStr(completedDate, dateIntervalString)
          logDebug('repeats', `  Adding from completed date --> ${newRepeatDate}`)
          // Remove any >date
          updatedLine = updatedLine.replace(/\s+>\d{4}-[01]\d{1}-\d{2}/, '') // i.e. RE_DUE_DATE, but can't get regex to work with variables like this
          logDebug('repeats', `\tupdatedLine: ${updatedLine}`)

        } else {
          // New repeat date = due date + interval
          // look for the due date(>YYYY-MM-DD)
          let dueDate = ''
          const resArray = updatedLine.match(RE_DUE_DATE_CAPTURE) ?? []
          // logDebug('repeats', resArray.length)
          if (resArray[1] != null) {
            logDebug('repeats', `  match => ${resArray[1]}`)
            dueDate = resArray[1]
            // need to remove the old due date
            updatedLine = updatedLine.replace(`>${dueDate}`, '')
            // logDebug('repeats', updatedLine);
          } else {
            // but if there is no due date then treat that as today
            dueDate = completedDate
            logDebug('repeats', `- no match => use completed date ${dueDate}`)
          }
          newRepeatDate = calcOffsetDateStr(dueDate, dateIntervalString)
          logDebug('repeats', `- Adding from due date --> ${newRepeatDate}`)
        }

        outputLine = updatedLine.replace(/@done\(.*\)/, '').trim()

        // Create and add the new repeat line
        if (type === 'Notes') {
          // ...either in same project note
          outputLine += ` >${newRepeatDate}`
          logDebug('repeats', `- outputLine: ${outputLine}`)
          await Editor.insertParagraphBeforeParagraph(outputLine, p, 'open')
          logDebug('repeats', `- Inserted new para after line ${p.lineIndex}`)
        }
        else {
          // ... or in the future daily note (prepend)
          const newRepeatDateShorter = unhyphenateString(newRepeatDate)
          const newDailyNote = await DataStore.calendarNoteByDateString(newRepeatDateShorter)
          if (newDailyNote?.title != null) {
            logDebug('repeats', newDailyNote.filename)
            await newDailyNote.appendTodo(outputLine)
            logDebug('repeats', `  Inserted new repeat in daily note ${newRepeatDateShorter}`)
          } else {
            // After a fix to future calendar note creation in r635, we shouldn't get here.
            // But just in case, we'll create new repeat in today's daily note
            outputLine += ` >${newRepeatDate}`
            logDebug('repeats', `- outputLine: ${outputLine}`)

            await Editor.insertParagraphAfterParagraph(outputLine, p, 'open')
            logWarn('repeats', 'Inserted new repeat in original daily note')
          }
        }        
      }
    }
  }
  if (repeatCount === 0) {
    logWarn('repeats', 'No suitable completed repeats found')
    if (showMessages) {
    await showMessage('No suitable completed repeats found', 'OK', 'Repeat Extensions')
      }
    }
  } catch (error) {
    logError(`${pluginJson}/repeats`, error.message)
  }
}
