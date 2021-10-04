// @flow

import { percent } from '../../helpers/general'

//-----------------------------------------------------------------------------
// Show note counts
export default async function showNoteCount(): Promise<void> {
  const calNotes = DataStore.calendarNotes
  const projNotes = DataStore.projectNotes
  const templates = DataStore.projectNotes.filter(
    (n) => n.filename.startsWith('📋 Templates')
  )
  const projNotesLen = projNotes.length - templates.length
  const total = calNotes.length + projNotes.length
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

  // Test code to track down where there's an error in the data reported 
  // by the API. Seems not; the problems are elsewhere in NP, according to 
  // what the OS says about the underlying files.

  // console.log('\nCreated last Quarter')
  // for (let i = 0; i < createdLastQuarter.length; i++) {
  //   const n=createdLastQuarter[i]
  //   printNote(n)
  //   console.log(`  ${Calendar.unitsAgoFromNow(n.createdDate, 'Quarter')}`)
  // }

  // console.log('\nUpdated last Quarter')
  // for (let i = 0; i < updatedLastQuarter.length; i++) {
  //   const n=updatedLastQuarter[i]
  //   printNote(n)
  //   console.log(`  ${Calendar.unitsAgoFromNow(n.updatedDate, 'Quarter')}`)
  // }

  const display = [
    `🔢 Total: ${total}`,
    `📅 Calendar notes: ${calNotes.length} (equivalent to ${
      Math.round(calNotes.length / 36.5) / 10.0
    } years)`,
    `🛠 Project notes: ${projNotesLen}`,
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
    `📋 Templates: ${templates.length}`,
  ]

  const re = await CommandBar.showOptions(
    display,
    'Notes count. Select anything to copy.',
  )
  if (re !== null) {
    Clipboard.string = display.join('\n')
  }
}
