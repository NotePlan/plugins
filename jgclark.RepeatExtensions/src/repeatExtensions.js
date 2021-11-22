//--------------------------------------------------------------------------------------------------------------------
// Repeat Extensions plugin for NotePlan
// Jonathan Clark
// last updated v0.3.0+, 18.11.2021
//--------------------------------------------------------------------------------------------------------------------

import {
  unhyphenateString,
  RE_DATE, // find dates of form YYYY-MM-DD
  RE_TIME, // find '12:23' with optional '[ ][AM|PM|am|pm]'
  RE_DATE_INTERVAL,
  calcOffsetDateStr,
  // toISODateString,
  // rangeToString,
} from '../../helpers/dateTime'
import { showMessage } from '../../helpers/userInput'
import { findEndOfActivePartOfNote } from '../../helpers/paragraph'

//------------------------------------------------------------------
// Process any completed(or cancelled) tasks with my extended @repeat(..) tags,
// and also remove the HH: MM portion of any @done(...) tasks.
export async function repeats() {
  // When interval is of the form '+2w' it will duplicate the task for 2 weeks
  // after the date is was completed.
  // When interval is of the form '2w' it will duplicate the task for 2 weeks
  // after the date the task was last due.If this can't be determined,
  // then default to the first option.
  // Valid intervals are [0-9][bdwmqy].
  // To work it relies on finding @done(YYYY-MM-DD HH:MM) tags that haven't yet been
  // shortened to @done(YYYY-MM-DD).
  // It includes cancelled tasks as well; to remove a repeat entirely, remoce
  // the @repeat tag from the task in NotePlan.

  // const RE_DUE_DATE = '\\s+>' + RE_DATE; // find ' >2021-02-23' etc.
  const RE_DUE_DATE_CAPTURE = `\\s+>(${RE_DATE})` // find ' >2021-02-23' and return just date part
  const RE_DATE_TIME = `${RE_DATE} ${RE_TIME}` // YYYY-MM-DD HH:MM[AM|PM]
  const RE_DONE_DATE_TIME = `@done\\(${RE_DATE_TIME}\\)` // find @done(...) and return date-time part
  const RE_DONE_DATE_CAPTURE = `@done\\((${RE_DATE})( ${RE_TIME})\\)` // find @done(...) and return date-time part
  const RE_EXTENDED_REPEAT = `@repeat\\(${RE_DATE_INTERVAL}\\)` // find @repeat()
  const RE_EXTENDED_REPEAT_CAPTURE = `@repeat\\((.*?)\\)` // find @repeat() and return part inside brackets

  // Get current note details
  const { paragraphs, title } = Editor
  if (paragraphs === null) {
    // No note open, or no paragraphs (perhaps empty note), so don't do anything.
    console.log('repeat: warning: No note open, or empty note.')
    return
  }
  let lineCount = paragraphs.length
  console.log(`\nrepeats: from note '${title}'`)

  // check if the last paragraph is undefined, and if so delete it from our copy
  if (paragraphs[lineCount] === null) {
    lineCount--
  }

  // work out where ## Done or ## Cancelled sections start, if present
  const endOfActive = findEndOfActivePartOfNote(Editor.note)

  let repeatCount = 0
  let line = ''
  let updatedLine = ''
  let completedDate = ''
  let completedTime = ''
  let reReturnArray = []

  // Go through each line in the active part of the file
  for (let n = 0; n < endOfActive; n++) {
    const p = paragraphs[n]
    // line = p.content
    line = p.content
    updatedLine = ''
    completedDate = ''

    // find lines with datetime to shorten, and capture date part of it
    // i.e. @done(YYYY-MM-DD HH:MM[AM|PM])
    // console.log(`  [${n}] ${line}`)
    if (p.content.match(RE_DONE_DATE_TIME)) {
      // get completed date and time
      reReturnArray = line.match(RE_DONE_DATE_CAPTURE)
      completedDate = reReturnArray[1]
      completedTime = reReturnArray[2]
      console.log(`  Found completed repeat ${completedDate} /${completedTime} in line ${n}`)
      
      // remove time string from completed date-time
      updatedLine = line.replace(completedTime, '') // couldn't get a regex to work here
      p.content = updatedLine
      // Send the update to the Editor
      await Editor.updateParagraph(p)
      // console.log(`    updated Paragraph ${p.lineIndex}`)

      // Test if this is one of my special extended repeats
      if (updatedLine.match(RE_EXTENDED_REPEAT)) {
        repeatCount++
        let newRepeatDate = ''
        let outline = ''
        // get repeat to apply
        reReturnArray = updatedLine.match(RE_EXTENDED_REPEAT_CAPTURE)
        let dateIntervalString = reReturnArray[1]
        console.log(`\tFound EXTENDED @repeat syntax: ${dateIntervalString}`)

        if (dateIntervalString[0] === '+') {
          // New repeat date = completed date + interval
          dateIntervalString = dateIntervalString.substring(
            1,
            dateIntervalString.length,
          )
          newRepeatDate = calcOffsetDateStr(completedDate, dateIntervalString)
          console.log(`\tAdding from completed date --> ${newRepeatDate}`)
          // Remove any >date
          updatedLine = updatedLine.replace(/\s+>\d{4}-[01]\d{1}-\d{2}/, '') // i.e. RE_DUE_DATE, but can't get regex to work with variables like this
          // console.log(`\tupdatedLine: ${updatedLine}`)

        } else {
          // New repeat date = due date + interval
          // look for the due date(>YYYY-MM-DD)
          let dueDate = ''
          const resArray = updatedLine.match(RE_DUE_DATE_CAPTURE) ?? []
          // console.log(resArray.length)
          if (resArray[1] != null) {
            console.log(`\tmatch => ${resArray[1]}`)
            dueDate = resArray[1]
            // need to remove the old due date
            updatedLine = updatedLine.replace(`>${dueDate}`, '')
            // console.log(updatedLine);
          } else {
            // but if there is no due date then treat that as today
            dueDate = completedDate
            // console.log(`\tno match => use completed date ${dueDate}`)
          }
          newRepeatDate = calcOffsetDateStr(dueDate, dateIntervalString)
          console.log(`\tAdding from due date --> ${newRepeatDate}`)
        }

        outline = updatedLine.replace(/@done\(.*\)/, '').trim()

        // Create and add the new repeat line ...
        if (Editor.type === 'Notes') {
          // ...either in same project note
          outline += ` >${newRepeatDate}`
          // console.log(`\toutline: ${outline}`)
          await Editor.insertParagraphAfterParagraph(outline, p, 'open')
          console.log(`\tInserted new para after line ${p.lineIndex}`)
        } else {
          // ... or in the future daily note (prepend)
          // console.log('    -> ' + outline)
          const newRepeatDateShorter = unhyphenateString(newRepeatDate)
          const newDailyNote =
            await DataStore.calendarNoteByDateString(newRepeatDateShorter)
          if (newDailyNote.title != null) {
            // console.log(newDailyNote.filename)
            await newDailyNote.appendTodo(outline)
            console.log(`\tInserted new repeat in daily note ${newRepeatDateShorter}`)
          } else {
            // After a fix to future calendar note creation in r635, we shouldn't get here.
            // But just in case, we'll create new repeat in today's daily note
            outline += ` >${newRepeatDate}`
            console.log(`\toutline: ${outline}`)

            await Editor.insertParagraphAfterParagraph(outline, p, 'open')
            console.log('\tInserted new repeat in original daily note')
          }
        }        
      }
    }
  }
  if (repeatCount === 0) {
    await showMessage('No suitable completed repeats found')
    console.log('\tNote: no suitable completed repeats found')
  }
}
