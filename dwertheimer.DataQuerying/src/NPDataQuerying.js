// @flow

import dh from './support/data-helpers'
import { log, logError, clo, timer } from '../../helpers/dev'
import pluginJson from '../plugin.json'

export async function buildIndex(): Promise<void> {
  const timeStart = new Date()
  const message = dh.uppercase('Hello World from Test Plugin!')

  const projectNotes = getNotes(false)
  const calendarNotes = getNotes(true)
  const notes = [...projectNotes, ...calendarNotes]
  clo(projectNotes[0], 'projectNotes[0]')
  clo(calendarNotes[0], 'calendarNotes[0]')

  log(`Notes.length = ${notes.length}`)

  log(pluginJson, timer(timeStart))
  Editor.insertTextAtCursor(message)
}

function getNotes(isCalendar?: boolean = false): $ReadOnlyArray<TNote> {
  return isCalendar ? DataStore.calendarNotes : DataStore.projectNotes
}
