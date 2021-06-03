// @flow

import { percent } from './statsHelpers'

//-----------------------------------------------------------------------------
// Show note counts
export default async function showNoteCount() {
  const calNotes = DataStore.calendarNotes
  const projNotes = DataStore.projectNotes
  const total = calNotes.length + projNotes.length
  const createdLastMonth = projNotes.filter(
    (n) => Calendar.unitsAgoFromNow(n.createdDate, "month") < 1,
  )
  const createdLastQuarter = projNotes.filter(
    (n) => Calendar.unitsAgoFromNow(n.createdDate, "month") < 3,
  )
  const updatedLastMonth = projNotes.filter(
    (n) => Calendar.unitsAgoFromNow(n.changedDate, "month") < 1,
  )
  const updatedLastQuarter = projNotes.filter(
    (n) => Calendar.unitsAgoFromNow(n.changedDate, "month") < 3,
  )

  const display = [
    `🔢 Total: ${  total}`,
    `📅 Calendar notes: ${  calNotes.length 
    } (equivalent to ${  Math.round(calNotes.length / 36.5) / 10.0  } years)`,
    `🛠 Project notes: ${  projNotes.length}`,
    `    - created in last month: ${  percent(createdLastMonth.length, projNotes.length)}`,
    `    - created in last quarter: ${  percent(createdLastQuarter.length, projNotes.length)}`,
    `    - updated in last month: ${  percent(updatedLastMonth.length, projNotes.length)}`,
    `    - updated in last quarter: ${  percent(updatedLastQuarter.length, projNotes.length)}`,
  ]

  const re = await CommandBar.showOptions(
    display,
    "Notes count. Select anything to copy.",
  )
  if (re !== null) {
    Clipboard.string = display.join("\n")
  }
}
