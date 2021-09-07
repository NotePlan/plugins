// @flow strict

import { getTagParamsFromString } from '../../helpers/general'
import { filenameDateString } from '../../helpers/dateTime'
import { chooseOption, showMessage } from '../../helpers/userInput'
import { default as sweepNote } from './sweepNote'

type Option1 = $ReadOnly<{
  num: number,
  unit: 'day' | 'month' | 'year',
}>

type NoteTypes = 'calendar' | 'note'

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
  await sweepAll(false, false, { num: 7, unit: 'day' })
}

export async function sweepTemplate(paramStr: string = ''): Promise<string> {
  if (paramStr === '') {
    return String(await sweepAll(false, true, undefined, true))
  } else {
    // const limit: Option1 = JSON.parse(getTagParams(paramStr, 'limit'))
    // const includeHeadings: boolean = Boolean(
    //   getTagParams(paramStr, 'includeHeadings'),
    // )
    // $FlowFixMe
    const limit: Option1 = await getTagParamsFromString(paramStr, 'limit', {})
    // $FlowIgnore
    const includeHeadings: boolean = await getTagParamsFromString(paramStr, 'includeHeadings', false)
    //
    const requireConfirmation: boolean = Boolean(await getTagParamsFromString(paramStr, 'requireConfirmation', false))
    // $FlowFixMe
    const noteTypes: NoteTypes[] = await getTagParamsFromString(paramStr, 'noteTypes', ['note', 'calendar'])
    // $FlowFixMe
    const ignoreFolders: string[] = await getTagParamsFromString(paramStr, 'ignoreFolders', ['📋 Templates'])

    console.log(
      `Running template command sweepAll with params: limit=${JSON.stringify(limit)} includeHeadings=${String(
        includeHeadings,
      )} noteTypes=${JSON.stringify(noteTypes)} ignoreFolders:${JSON.stringify(ignoreFolders)}`,
    )
    // let paramObj
    // try {
    //   paramObj = JSON.parse(paramStr)
    // } catch (e) {
    //   console.log(`Error: ${e}`)
    //   return `Could not parse template parameter: ${paramStr}. Check the documentation. Error: ${e}`
    // }
    const retVal = await sweepAll(false, requireConfirmation, limit, true, includeHeadings, noteTypes, ignoreFolders)
    return String(retVal ?? '')
  }
}

/**
 * TODO:
 * 1. Add option to move all tasks silently
 * - Implement sweepOverdue
 * 2. Add option to reschedule instead of move Calendar notes
 * 3. Add option to change target date from "Today" to something you can choose
 *  */
/**
 * returnValue is true if you should return the value (string) for insertion rather than putting in the note directly
 */
export default async function sweepAll(
  overdueOnly: boolean = false,
  requireUserAction: boolean = true,
  periodToCheck: Option1 = DEFAULT_OPTION,
  returnValue: boolean = false,
  includeHeadings: boolean = false,
  noteTypes: NoteTypes[] = ['calendar', 'note'],
  ignoreFolders: string[] = ['📋 Templates'],
): Promise<void | string> {
  let { unit, num } = periodToCheck
  let foundTasks: Array<TParagraph> = []
  console.log(
    `Starting sweepAll overdueOnly:${String(overdueOnly)} requireUserAction:${String(
      requireUserAction,
    )} periodToCheck:${JSON.stringify(periodToCheck)} noteTypes: ${JSON.stringify(noteTypes)} returnValue:${String(
      returnValue,
    )} ignoreFolders: ${JSON.stringify(ignoreFolders)}`,
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
  const afterDateFileName = filenameDateString(Calendar.addUnitToDate(new Date(), unit, -num))

  const count = { files: 0, tasks: 0 }

  // type Result = {
  //   ids: Array<string>,
  //   tasks: Array<>,
  //   count: { files: number, tasks: number },
  //   status: 'ok' | 'error',
  //   msg: string,
  //   taskArray: Array<TParagraph>,
  // }
  const processResult = (res, _title) => {
    if (res.status === 'ok') {
      if (res.tasks) {
        count.files += 1
        count.tasks += res.tasks
      }
      foundTasks = [...foundTasks, ...(res.taskArray ?? [])]
    } else {
      console.log(`Error: ${res.msg}`)
    }

    // console.log(
    //   `[${String(title)}]: ${JSON.stringify(res)}; total foundTasks is now:${
    //     foundTasks.length
    //   }`,
    // )
  }

  // PROJECT NOTES FIRST

  if (withUserConfirm) {
    res = await CommandBar.showOptions(['✅ OK', '❌ Skip'], `📙 Scan for Tasks in Project Notes?`)
  }

  const includeProjectNotes =
    noteTypes.includes('note') || (withUserConfirm && typeof res.index !== 'undefined' && res.index === 0)

  // Narrow project note search to notes edited in last N days
  if (includeProjectNotes) {
    const recentProjNotes = DataStore.projectNotes.filter((note) => note.changedDate >= afterDate)
    console.log(`\tProject Notes to search: ${recentProjNotes.length}`)
    for (const note of recentProjNotes) {
      const ignoreThisFolder =
        ignoreFolders.length && !!ignoreFolders.filter((folder) => note.filename.includes(`${folder}/`)).length
      if (!ignoreThisFolder) {
        // console.log(`About to sweep Project Note: ${note.title || note.filename}`)
        const result = await sweepNote(note, withUserConfirm, false, overdueOnly, true, returnValue, includeHeadings)
        processResult(result, note.title)
      } else {
        console.log(`Skipping note "${note.filename}" due to ignoreFolders param: ${JSON.stringify(ignoreFolders)}`)
      }
    }
  }

  //  CALENDAR NOTES
  if (withUserConfirm) {
    res = await CommandBar.showOptions(['✅ OK', '❌ Skip'], `Done. Now Scan Daily Calendar Notes 🗓?`)
  }

  // Resolve whether calendar notes task sweeping is requested
  const includeCalendarNotes =
    noteTypes.includes('calendar') || (withUserConfirm && typeof res.index !== 'undefined' && res.index === 0)

  if (includeCalendarNotes) {
    const todayFileName = `${filenameDateString(new Date())}.${DataStore.defaultFileExtension}`
    const recentCalNotes = DataStore.calendarNotes.filter(
      (note) => note.filename < todayFileName && note.filename >= afterDateFileName,
    )

    console.log(`\tCalendar Notes to search: ${recentCalNotes.length}`)
    for (const note of recentCalNotes) {
      const ignoreThisFolder =
        ignoreFolders.length && !!ignoreFolders.filter((folder) => note.filename.includes(`${folder}/`)).length
      if (!ignoreThisFolder) {
        if (note.filename !== todayFileName) {
          console.log(`Calling sweepNote ${note.filename} | Today is: ${todayFileName}`)
          const result = await sweepNote(note, withUserConfirm, false, overdueOnly, false, returnValue, includeHeadings)
          processResult(result, note.title)
        } else {
          console.log(`...Skipping today's note ${todayFileName}`)
        }
      } else {
        console.log(`Skipping note "${note.filename}" due to ignoreFolders param: ${JSON.stringify(ignoreFolders)}`)
      }
    }
  }

  const msg = count.tasks > 0 ? `Moved ${count.tasks} tasks from ${count.files} files.` : ``
  if (withUserConfirm) await showMessage(`sweepAll: Done! ${msg}`)
  console.log(`Finished sweepAll`)
  if (foundTasks.length) {
    return foundTasks.map((t) => t.rawContent).join('\n')
  } else {
    await Editor.openNoteByDate(new Date())
    return ''
  }
}
