// @flow

import {
  chooseOption as _chooseOption,
  showMessage as _showMessage,
  getInput as _getInput,
  type Option as _Option,
} from '../../nmn.sweep/src/userInput'

export const chooseOption = _chooseOption
export const showMessage = _showMessage
export const getInput = _getInput
export type Option<T> = _Option<T>

// Return string with percentage value appended
// export function percent(value, total) {
export function percent(value: number, total: number): string {
  return `${value} (${Math.round((value / total) * 100)}%)`
}

export const todaysDateISOString: string = new Date().toISOString().slice(0, 10)

export function getYearMonthDate(dateObj: Date): $ReadOnly<{
  year: number,
  month: number,
  date: number,
}> {
  const year = dateObj.getFullYear()
  const month = dateObj.getMonth() + 1
  const date = dateObj.getDate()
  return {
    year,
    month,
    date,
  }
}

export const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
export const monthsAbbrev = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export function monthNameAbbrev(m: number): string {
  return monthsAbbrev[m - 1]
}

export function unhyphenateDateString(dateString: string): string {
  return dateString.replace(/-/g, '')
}

export function hyphenatedDateString(dateObj: Date): string {
  const { year, month, date } = getYearMonthDate(dateObj)
  return `${year}-${month < 10 ? '0' : ''}${month}-${
    date < 10 ? '0' : ''
  }${date}`
}

export function filenameDateString(dateObj: Date): string {
  const { year, month, date } = getYearMonthDate(dateObj)
  return `${year}${month < 10 ? '0' : ''}${month}${date < 10 ? '0' : ''}${date}`
}

export function withinDateRange(
  testDate: string,
  fromDate: string,
  toDate: string,
): boolean {
  return testDate >= fromDate && testDate <= toDate
}

// Tests for the above
// console.log(withinDateRange(unhyphenateDateString('2021-04-24'), '20210501', '20210531')) // false
// console.log(withinDateRange(unhyphenateDateString('2021-05-01'), '20210501', '20210531')) // true
// console.log(withinDateRange(unhyphenateDateString('2021-05-24'), '20210501', '20210531')) // true
// console.log(withinDateRange(unhyphenateDateString('2021-05-31'), '20210501', '20210531')) // true
// console.log(withinDateRange(unhyphenateDateString('2021-06-24'), '20210501', '20210531')) // false

export function dateStringFromCalendarFilename(filename: string): string {
  return filename.slice(0, 8)
}
