// @flow
// Last updated 30.12.2022 for v0.6.0 by @jgclark

import { isDailyNote } from '@helpers/dateTime'
import { percent } from '@helpers/general'

//-----------------------------------------------------------------------------
// Show note counts
export async function showNoteCount(): Promise<void> {
  // do counts
  const calNotesCount = DataStore.calendarNotes.filter((n) => isDailyNote(n)).length // just count days
  const projNotes = DataStore.projectNotes.filter(
    (n) => !n.filename.startsWith("@Trash") && !n.filename.startsWith("@Archive")) // ignore Trash and Archive
  const templatesCount = DataStore.projectNotes.filter(
    (n) => n.filename.startsWith('@Templates')
  ).length
  const archivedCount = DataStore.projectNotes.filter(
    (n) => n.filename.startsWith('@Archive')
  ).length
  const projNotesCount = projNotes.length - templatesCount
  const total = calNotesCount + projNotes.length
  const createdLastMonth = projNotes.filter(
    (n) => Calendar.unitsAgoFromNow(n.createdDate, 'month') < 1,
  )
  const createdLastQuarter = projNotes.filter(
    (n) => Calendar.unitsAgoFromNow(n.createdDate, 'month') < 3,
  )
  const updatedLastMonth = projNotes.filter(
    (n) => Calendar.unitsAgoFromNow(n.changedDate, 'month') < 1,
  )
  const updatedLastQuarter = projNotes.filter(
    (n) => Calendar.unitsAgoFromNow(n.changedDate, 'month') < 3,
  )

  const display = [
    `🔢 Total: ${total.toLocaleString()}`,
    `📅 Daily Calendar notes: ${calNotesCount.toLocaleString()} (equivalent to ${Math.round(calNotesCount / 36.5) / 10.0} years)`,
    `📝 Project notes: ${projNotesCount.toLocaleString()}`,
    `\t- created in last month: ${percent(
      createdLastMonth.length,
      projNotes.length,
    )}`,
    `\t- created in last quarter: ${percent(
      createdLastQuarter.length,
      projNotes.length,
    )}`,
    `\t- updated in last month: ${percent(
      updatedLastMonth.length,
      projNotes.length,
    )}`,
    `\t- updated in last quarter: ${percent(
      updatedLastQuarter.length,
      projNotes.length,
    )}`,
    `+ 📋 Templates: ${templatesCount}`,
    `+ 📔 Archived notes: ${archivedCount}`,
  ]

  const re = await CommandBar.showOptions(
    display,
    'Notes count. Select anything to copy.',
  )
  if (re !== null) {
    Clipboard.string = display.join('\n')
  }
}
