// @flow strict

import { filenameDateString, hyphenatedDateString } from './dateHelpers'
import sweepCalendarNote from './sweepCalendarNote'
import sweepProjectNote from './sweepProjectNote'
import { chooseOption, showMessage } from './userInput'

type Option1 = $ReadOnly<{
  num: number,
  unit: 'day' | 'month' | 'year',
}>

const OPTIONS = [
  { label: '7 days', value: { num: 7, unit: 'day' } },
  { label: '14 days', value: { num: 14, unit: 'day' } },
  { label: '21 days', value: { num: 21, unit: 'day' } },
  { label: '1 month', value: { num: 1, unit: 'month' } },
  { label: '3 months', value: { num: 3, unit: 'month' } },
  { label: '6 months', value: { num: 6, unit: 'month' } },
  { label: '1 year', value: { num: 1, unit: 'year' } },
  { label: '❌ Cancel', value: { num: 0, unit: 'day' } },
]
const DEFAULT_OPTION: Option1 = { unit: 'day', num: 0 }

/**
 * TODO:
 * 1. Add option to move all tasks silently
 * 2. Add option to reschedule instead of move Calendar notes
 * 3. Add option to change target date from "Today" to something you can choose
 *  */
export default async function sweepAll(): Promise<void> {
  const { unit, num } = await chooseOption<Option1>(
    '🧹 Reschedule tasks to today of the last...',
    OPTIONS,
    DEFAULT_OPTION,
  )

  if (num == 0) {
    // User canceled, return here, so no additional messages are shown
    await showMessage(`Cancelled! No changes made.`)
    return
  }

  const afterDate = Calendar.addUnitToDate(new Date(), unit, -num)
  const afterDateFileName = filenameDateString(
    Calendar.addUnitToDate(new Date(), unit, -num),
  )

  const re1 = await CommandBar.showOptions(
    ['✅ OK', '❌ Skip'],
    '📙 Processing with your Project Notes first...',
  )
  // Narrow project note search to notes edited in last N days
  if (re1.index === 0) {
    const recentProjNotes = DataStore.projectNotes.filter(
      (note) => note.changedDate > afterDate,
    )
    console.log(`Project Notes to search: ${recentProjNotes.length}`)
    for (const note of recentProjNotes) {
      await sweepProjectNote(note, true, hyphenatedDateString(afterDate), false)
    }
  }

  const re2 = await CommandBar.showOptions(
    ['✅ OK', '❌ Skip'],
    '🗓 Now processing your Daily Notes...',
  )

  if (re2.index === 0) {
    const todayFileName = filenameDateString(new Date())
    const recentCalNotes = DataStore.calendarNotes.filter(
      (note) =>
        note.filename < todayFileName && note.filename >= afterDateFileName,
    )

    console.log(`Calendar Notes to search: ${recentCalNotes.length}`)
    for (const note of recentCalNotes) {
      await sweepCalendarNote(note, true, false)
    }
  }

  await showMessage(`All Done!`)
  await Editor.openNoteByDate(date(new Date()))
}
