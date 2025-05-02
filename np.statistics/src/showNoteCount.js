// @flow
// Last updated 2025-04-22 for v0.7.0 by @jgclark

import { isDailyNote } from '@helpers/dateTime'
import { percent } from '@helpers/general'
import moment from 'moment'

//-----------------------------------------------------------------------------
// Show note counts
export async function showNoteCount(): Promise<void> {
  try {
    // do counts
    const calNotesCount = DataStore.calendarNotes.length // all calendar duractions
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
    const allDailyCalendarNotes = DataStore.calendarNotes.filter((n) => isDailyNote(n))
    const allDailyCalendarNotesSorted = allDailyCalendarNotes.sort((a, b) => a.createdDate - b.createdDate)
    const firstDailyCalendarNote = allDailyCalendarNotesSorted[0]
    const daysSinceFirstDailyCalendarNote = moment().diff(moment(firstDailyCalendarNote.createdDate), 'days')

    const display = [
      `🔢 Total: ${total.toLocaleString()}`,
      `📅 Calendar notes: ${calNotesCount.toLocaleString()} (starting ${Math.round(daysSinceFirstDailyCalendarNote / 36.5) / 10.0} years ago)`,
      `📝 Regular notes: ${projNotesCount.toLocaleString()}`,
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

    const teamspaces = DataStore.teamspaces
    if (teamspaces.length > 0) {
      // TODO: List count of Teamspaces + # notes in each
      const teamspaceCalendarNotes = DataStore.calendarNotes.filter((n) => n.isTeamspaceNote)
      const teamspaceRegularNotes = DataStore.projectNotes.filter((n) => n.isTeamspaceNote)

      display.push(`🧑‍🤝‍🧑 Teamspaces: include ${teamspaceCalendarNotes.length} calendar notes and ${teamspaceRegularNotes.length} regular notes`)
      for (const teamspace of teamspaces) {
        display.push(`\t- '${teamspace.title}'`)
      }
    }
    console.log(`# Note Stats:\n${display.join('\n')}`)

    const res = await CommandBar.showOptions(
      display,
      'Notes count. Select anything to copy. Escape to close.',
    )
    if (res !== null) {
      Clipboard.string = display.join('\n')
    }
  } catch (error) {
    logError('showNoteCount', error)
  }
}
