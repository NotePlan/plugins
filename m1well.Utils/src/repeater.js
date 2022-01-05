// @flow

import {
  addDays,
  addMonths,
  addYears,
  getDay,
  getDaysInMonth,
  getMonth,
  getYear,
  nextFriday,
  nextMonday,
  nextSaturday,
  nextSunday,
  nextThursday,
  nextTuesday,
  nextWednesday,
  setDate
} from 'date-fns'
import { inputInteger } from '../../helpers/userInput'
import { futureDateFromInputOrTomorrow, getDailyNote } from './utilsHelper'

/**
 * creates repetitions for selected lines
 *
 * @returns {Promise<boolean>}
 */
const repeater = async (): Promise<boolean> => {

  const currentOpenNote = Editor.note
  const selectedOpenTasks = Editor.selectedParagraphs
    .filter(para => (para.type === 'open' || para.type === 'list'))
    .map(para => para.content)

  const startDate = await futureDateFromInputOrTomorrow('Future start date? (empty for tomorrow)')
  const unit = await CommandBar.showOptions([ 'Day', 'Week', '2 Weeks', 'Month', '2 Months',
    'Quarter-year', 'Half-year', 'Year', 'Special' ], 'Select unit (every ...)')

  if (unit.value === 'Special') {
    const special = await CommandBar.showOptions([ 'Every special weekday (e.g. \'every Monday\')',
      'Every nth day of month' ], 'Select a special')

    if (special.index === 0) {
      await everySpecialWeekdayRepetition(selectedOpenTasks, startDate)
      if (currentOpenNote) {
        await Editor.openNoteByFilename(currentOpenNote.filename)
      }
      return true
    }
    if (special.index === 1) {
      await everySpecialDayInMonthRepetition(selectedOpenTasks, startDate)
      if (currentOpenNote) {
        await Editor.openNoteByFilename(currentOpenNote.filename)
      }
      return true
    }

  } else {
    // no special
    await standardRepetition(selectedOpenTasks, startDate, unit.value)
    if (currentOpenNote) {
      await Editor.openNoteByFilename(currentOpenNote.filename)
    }
    return true
  }

  return false
}

/**
 * standard repetition - every ...
 *
 * @private
 */
const standardRepetition = async (selectedOpenTasks: string[], startDate: Date, unit: string): Promise<boolean> => {
  const reps = await inputInteger('Select repetitions (incl. first one)')

  let actionDate = startDate
  for (let i = 1; i <= reps; i++) {
    const note = getDailyNote(actionDate)
    selectedOpenTasks.forEach(task => {
      if (note) {
        insertRepeatParagraph(note, task, reps, i)
      }
    })
    switch (unit) {
      case 'Year':
        actionDate = addYears(actionDate, 1)
        break
      case 'Half-year':
        actionDate = addMonths(actionDate, 6)
        break
      case 'Quarter-year':
        actionDate = addMonths(actionDate, 3)
        break
      case '2 Months':
        actionDate = addMonths(actionDate, 2)
        break
      case 'Month':
        actionDate = addMonths(actionDate, 1)
        break
      case '2 Weeks':
        actionDate = addDays(actionDate, 14)
        break
      case 'Week':
        actionDate = addDays(actionDate, 7)
        break
      default:
        actionDate = addDays(actionDate, 1)
        break
    }
  }
  return true
}

/**
 * special repetition for "every weekday"
 *
 * @private
 */
const everySpecialWeekdayRepetition = async (selectedOpenTasks: string[], startDate: Date): Promise<boolean> => {
  const weekday = await CommandBar.showOptions([ 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
    'Friday', 'Saturday', 'Sunday' ], 'Select weekday')
  const reps = await inputInteger('Select repetitions (incl. first one)')

  let actionDate
  switch (weekday.index) {
    case 0:
      actionDate = nextMonday(startDate)
      break
    case 1:
      actionDate = nextTuesday(startDate)
      break
    case 2:
      actionDate = nextWednesday(startDate)
      break
    case 3:
      actionDate = nextThursday(startDate)
      break
    case 4:
      actionDate = nextFriday(startDate)
      break
    case 5:
      actionDate = nextSaturday(startDate)
      break
    case 6:
      actionDate = nextSunday(startDate)
      break
    default:
      actionDate = startDate
  }

  for (let i = 1; i <= reps; i++) {
    const note = getDailyNote(actionDate)
    selectedOpenTasks.forEach(task => {
      if (note) {
        insertRepeatParagraph(note, task, reps, i)
      }
    })
    actionDate = addDays(actionDate, 7)
  }
  return true
}

/**
 * special repetition for "nth day in month"
 *
 * @private
 */
const everySpecialDayInMonthRepetition = async (selectedOpenTasks: string[], startDate: Date): Promise<boolean> => {
  const dayInMonth = await CommandBar.showOptions([ 'First', 'Second', 'Third', '5.', '10.', '15.', '20.',
    '25.', 'penultimate', 'last' ], 'Select day in month')
  const reps = await inputInteger('Select repetitions (incl. first one)')

  let actionDate = startDate
  for (let i = 1; i <= reps; i++) {
    const year = getYear(actionDate)
    const month = getMonth(actionDate)
    switch (dayInMonth.index) {
      case 0:
        actionDate = dayInMonthActionDate(actionDate, year, month, 1)
        break
      case 1:
        actionDate = dayInMonthActionDate(actionDate, year, month, 2)
        break
      case 2:
        actionDate = dayInMonthActionDate(actionDate, year, month, 3)
        break
      case 3:
        actionDate = dayInMonthActionDate(actionDate, year, month, 5)
        break
      case 4:
        actionDate = dayInMonthActionDate(actionDate, year, month, 10)
        break
      case 5:
        actionDate = dayInMonthActionDate(actionDate, year, month, 15)
        break
      case 6:
        actionDate = dayInMonthActionDate(actionDate, year, month, 20)
        break
      case 7:
        actionDate = dayInMonthActionDate(actionDate, year, month, 25)
        break
      case 8:
        actionDate = dayInMonthActionDate(actionDate, year, month, -10)
        break
      case 9:
        actionDate = dayInMonthActionDate(actionDate, year, month, -100)
        break
    }

    const note = getDailyNote(actionDate)
    selectedOpenTasks.forEach(task => {
      if (note) {
        insertRepeatParagraph(note, task, reps, i)
      }
    })
    actionDate = setDate(addMonths(actionDate, 1), 1)
  }

  return true
}

/**
 * get the new action date of the month (-10 for "penultimate" and -100 for "last")
 *
 * @private
 */
const dayInMonthActionDate = (checkDate: Date, year: number, month: number, day: number): Date => {
  if (day === -10) {
    if (getDay(checkDate) <= getDaysInMonth(checkDate) - 1) {
      return new Date(year, month, getDaysInMonth(checkDate) - 1)
    } else {
      const withNewMonth = addMonths(checkDate, 1)
      return setDate(withNewMonth, getDaysInMonth(checkDate) - 1)
    }
  }
  if (day === -100) {
    if (getDay(checkDate) <= getDaysInMonth(checkDate)) {
      return new Date(year, month, getDaysInMonth(checkDate))
    } else {
      const withNewMonth = addMonths(checkDate, 1)
      return setDate(withNewMonth, getDaysInMonth(checkDate))
    }
  }
  if (getDay(checkDate) <= day - 1) {
    return new Date(year, month, day)
  } else {
    return setDate(addMonths(checkDate, 1), day)
  }
}

/**
 * inserts the repeat paragraph - the numbers of the last one are **bold**
 *
 * @private
 */
const insertRepeatParagraph = (note: TNote, task: string, reps: number, i: number) => {
  if (i === reps) {
    note.insertParagraph(`${task} @repeat(**!!${i}/${String(reps)}!!**)`, 0, 'open')
  } else {
    note.insertParagraph(`${task} @repeat(${i}/${String(reps)})`, 0, 'open')
  }
}

export { repeater }
