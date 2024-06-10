// @flow
// ----------------------------------------------------------------------------
// Helper functions for Repeat Extensions plugin.
// Jonathan Clark
// last updated 9.6.2024, for v0.8.0
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import {
  // calcOffsetDate,
  calcOffsetDateStr,
  isDailyNote,
  isWeeklyNote,
  isMonthlyNote,
  isQuarterlyNote,
  isYearlyNote,
  RE_SCHEDULED_DAILY_NOTE_LINK,
  RE_SCHEDULED_WEEK_NOTE_LINK,
  RE_SCHEDULED_MONTH_NOTE_LINK,
  RE_SCHEDULED_QUARTERLY_NOTE_LINK,
  RE_SCHEDULED_YEARLY_NOTE_LINK,
  hyphenatedDateString,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

//------------------------------------------------------------------
// Constants + Types

const RE_EXTENDED_REPEAT_CAPTURE = `@repeat\\((.*?)\\)` // find @repeat() and return part inside brackets

const pluginID = pluginJson['plugin.id'] // was 'jgclark.Filer'

export type RepeatConfig = {
  deleteCompletedRepeat: boolean,
  _logLevel: string,
}

//-----------------------------------------------------------------------------

export async function getRepeatSettings(): Promise<any> {
  try {
    // Get settings using Config system
    const config: RepeatConfig = await DataStore.loadJSON(`../${pluginID}/settings.json`)

    if (config == null || Object.keys(config).length === 0) {
      logError(pluginJson, `getRepeatSettings() cannot find '${pluginID}' plugin settings. Stopping.`)
      await showMessage(`Cannot find settings for the '${pluginID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
      return
    } else {
      // clo(config, `${pluginID} settings:`)
      return config
    }
  } catch (err) {
    logError(pluginJson, `GetRepeatSettings(): ${err.name}: ${err.message}`)
    await showMessage(`Error: ${err.message}`)
  }
}

export function generateUpdatedLineContent(noteToUse: CoreNoteFields, currentContent: string, completedDate: string): string {
  // get repeat to apply
  const reReturnArray = currentContent.match(RE_EXTENDED_REPEAT_CAPTURE) ?? []
  let dateIntervalString: string = (reReturnArray.length > 0) ? reReturnArray[1] : ''
  logDebug('generateUpdatedLineContent', `- Found extended @repeat syntax: '${dateIntervalString}' with completedDate ${completedDate} in "${currentContent}" in ${noteToUse.filename}`)

  // decide style of new date: daily / weekly / monthly / etc.link
  let outputTimeframe = ''
  if (currentContent.match(RE_SCHEDULED_DAILY_NOTE_LINK) || isDailyNote(noteToUse)) {
    outputTimeframe = 'day'
  } else if (currentContent.match(RE_SCHEDULED_WEEK_NOTE_LINK) || isWeeklyNote(noteToUse)) {
    outputTimeframe = 'week'
  } else if (currentContent.match(RE_SCHEDULED_MONTH_NOTE_LINK) || isMonthlyNote(noteToUse)) {
    outputTimeframe = 'month'
  } else if (currentContent.match(RE_SCHEDULED_QUARTERLY_NOTE_LINK) || isQuarterlyNote(noteToUse)) {
    outputTimeframe = 'quarter'
  } else if (currentContent.match(RE_SCHEDULED_YEARLY_NOTE_LINK) || isYearlyNote(noteToUse)) {
    outputTimeframe = 'year'
  }
  logDebug('generateUpdatedLineContent', `- outputTimeframe: ${outputTimeframe}`)

  let newRepeatDateStr = ''
  // let newRepeatDate: Date
  const output = currentContent

  if (dateIntervalString[0].startsWith('+')) {
    // New repeat date = completed date (of form YYYY-MM-DD) + interval
    dateIntervalString = dateIntervalString.substring(
      1,
      dateIntervalString.length,
    )
    // newRepeatDate = calcOffsetDate(completedDate, dateIntervalString) ?? new moment().startOf('day').toDate()
    newRepeatDateStr = calcOffsetDateStr(completedDate, dateIntervalString)
    logDebug('generateUpdatedLineContent', `- adding from completed date -> ${newRepeatDateStr}`)
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
    if (dueDateArray && dueDateArray[0] != null) {
      dueDate = dueDateArray[0].split('>')[1]
      logDebug('generateUpdatedLineContent', `  due date match = ${dueDate}`)
    } else {
      // there is no due date, so try the note date, otherwise use completed date
      dueDate = noteToUse.date ? hyphenatedDateString(noteToUse.date) : completedDate
      logDebug('generateUpdatedLineContent', `- no match => use note/completed date ${dueDate}`)
    }
    newRepeatDateStr = calcOffsetDateStr(dueDate, dateIntervalString, outputTimeframe)
    logDebug('generateUpdatedLineContent', `- adding from due date -> ${newRepeatDateStr}`)
  }
  return newRepeatDateStr
}
