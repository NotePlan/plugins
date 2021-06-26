// @flow strict

import { default as sweepNote } from './sweepCalendarNote'
import { filenameDateString } from './dateHelpers'
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
  { label: 'All Time', value: { num: 99, unit: 'year' } },
  { label: '❌ Cancel', value: { num: 0, unit: 'day' } },
]
const DEFAULT_OPTION: Option1 = { unit: 'day', num: 0 }

export async function sweep7(): Promise<void> {
  sweepAll(false, false, { num: 7, unit: 'day' })
}

/**
 * TODO:
 * 1. Add option to move all tasks silently
 * - Implement sweepOverdue
 * 2. Add option to reschedule instead of move Calendar notes
 * 3. Add option to change target date from "Today" to something you can choose
 *  */
export default async function sweepAll(
  overdueOnly: boolean = false,
  requireUserAction: boolean = true,
  periodToCheck: Option1 = DEFAULT_OPTION,
): Promise<void> {
  let { unit, num } = periodToCheck
  console.log(
    `Starting sweepAll overdueOnly:${String(
      overdueOnly,
    )} requireUserAction:${String(
      requireUserAction,
    )} periodToCheck:${JSON.stringify(periodToCheck)}`,
  )
  if (requireUserAction) {
    const setPeriod = await chooseOption<Option1>(
      '🧹 Reschedule tasks to today from the last...',
      OPTIONS,
      DEFAULT_OPTION,
    )
    if (setPeriod.num === 0) {
      // User canceled, return here, so no additional messages are shown
      await showMessage(`Cancelled! No changes made.`)
      return
    } else {
      unit = setPeriod.unit
      num = setPeriod.num
    }
  }
  let res = {},
    withUserConfirm = requireUserAction

  if (withUserConfirm) {
    res = await CommandBar.showOptions(
      ['✅ Yes', '❌ No (Reschedule Silently)'],
      '📙 Want to approve each note during sweep?',
    )
    withUserConfirm = res.index === 0
  }

  const afterDate = Calendar.addUnitToDate(new Date(), unit, -num)
  const afterDateFileName = filenameDateString(
    Calendar.addUnitToDate(new Date(), unit, -num),
  )

  const count = { files: 0, tasks: 0 }

  const processResult = (res) => {
    if (res.status === 'ok') {
      if (res.tasks) {
        count.files += 1
        count.tasks += res.tasks
      }
    } else {
      console.log(`Error: ${res.msg}`)
    }
  }

  // PROJECT NOTES FIRST

  if (withUserConfirm) {
    res = await CommandBar.showOptions(
      ['✅ OK', '❌ Skip'],
      `📙 Scan for Tasks in Project Notes?`,
    )
  }

  // Narrow project note search to notes edited in last N days
  if (
    !withUserConfirm ||
    (typeof res.index !== 'undefined' && res.index === 0)
  ) {
    const recentProjNotes = DataStore.projectNotes.filter(
      (note) => note.changedDate >= afterDate,
    )
    console.log(`\tProject Notes to search: ${recentProjNotes.length}`)
    for (const note of recentProjNotes) {
      processResult(
        await sweepNote(note, withUserConfirm, false, overdueOnly, true),
      )
    }
  }

  //  CALENDAR NOTES

  if (withUserConfirm) {
    res = await CommandBar.showOptions(
      ['✅ OK', '❌ Skip'],
      `Done. Now Scan Daily Calendar Notes 🗓?`,
    )
  }
  if (
    !withUserConfirm ||
    (typeof res.index !== 'undefined' && res.index === 0)
  ) {
    const todayFileName = filenameDateString(new Date())
    const recentCalNotes = DataStore.calendarNotes.filter(
      (note) =>
        note.filename < todayFileName && note.filename >= afterDateFileName,
    )

    console.log(`\tCalendar Notes to search: ${recentCalNotes.length}`)
    for (const note of recentCalNotes) {
      processResult(await sweepNote(note, withUserConfirm, false))
    }
  }

  const msg =
    count.tasks > 0
      ? `Moved ${count.tasks} tasks from ${count.files} files.`
      : ``
  await showMessage(`All Done! ${msg}`)
  await Editor.openNoteByDate(new Date())
  console.log(`Finished sweepAll`)
}
