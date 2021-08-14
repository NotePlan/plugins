// @flow
//-------------------------------------------------------------------------------
// Date functions
// @jgclark except where shown

export const RE_DATE = '\\d{4}-[01]\\d{1}-\\d{2}' // find dates of form YYYY-MM-DD
export const RE_ISO_DATE = '\\d{4}-[01]\\d{1}-\\d{2}' // find dates of form YYYY-MM-DD
export const RE_TIME = '[0-2]\\d{1}:[0-5]\\d{1}\\s?(?:AM|PM|am|pm)?' // find '12:23' with optional '[ ][AM|PM|am|pm]'
export const RE_DATE_INTERVAL = `\\+?\\d+[bdwmqy]`

export const todaysDateISOString: string = new Date().toISOString().slice(0, 10)
// TODO: make a friendlier string
export const nowShortDateTime: string = new Date().toISOString().slice(0, 16)
export const nowLocaleDateTime: string = new Date().toLocaleString()

// @nmn
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

export function unhyphenateString(dateString: string): string {
  return dateString.replace(/-/g, '')
}

export function toISODateString(dateObj: Date): string {
  return dateObj.toISOString().slice(0, 10)
}

export function toLocaleDateString(dateObj: Date): string {
  return dateObj.toLocaleString().slice(0, 10)
}

export function toISOShortDateTimeString(dateObj: Date): string {
  return dateObj.toISOString().slice(0, 16)
}

export function toISOShortTime(dateObj: Date): string {
  return dateObj.toISOString().slice(11, 16)
}

export function toLocaleShortTime(
  dateObj: Date,
  locale: string | Array<string> = [],
  options: Intl$DateTimeFormatOptions = {},
): string {
  return dateObj.toLocaleTimeString(locale, options)
}

export function printDateRange(dr: DateRange) {
  console.log(
    `DateRange <${toISOShortDateTimeString(
      dr.start,
    )} - ${toISOShortDateTimeString(dr.end)}>`,
  )
}

export function unhyphenatedDate(dateObj: Date): string {
  const { year, month, date } = getYearMonthDate(dateObj)
  return `${year}${month < 10 ? '0' : ''}${month}${date < 10 ? '0' : ''}${date}`
}

export function hyphenatedDate(dateObj: Date): string {
  const { year, month, date } = getYearMonthDate(dateObj)
  return `${year}-${month < 10 ? '0' : ''}${month}-${
    date < 10 ? '0' : ''
  }${date}`
}

export function filenameDateString(dateObj: Date): string {
  const { year, month, date } = getYearMonthDate(dateObj)
  return `${year}${month < 10 ? '0' : ''}${month}${date < 10 ? '0' : ''}${date}`
}

export function dateStringFromCalendarFilename(filename: string): string {
  return filename.slice(0, 8)
}

export function isoDateStringFromCalendarFilename(filename: string): string {
  return `${filename.slice(0, 4)}-${filename.slice(4, 6)}-${filename.slice(
    6,
    8,
  )}`
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

export function withinDateRange(
  testDate: string,
  fromDate: string,
  toDate: string,
): boolean {
  return testDate >= fromDate && testDate <= toDate
}

// Tests for the above
// console.log(withinDateRange(unhyphenateDate('2021-04-24'), '20210501', '20210531')) // false
// console.log(withinDateRange(unhyphenateDate('2021-05-01'), '20210501', '20210531')) // true
// console.log(withinDateRange(unhyphenateDate('2021-05-24'), '20210501', '20210531')) // true
// console.log(withinDateRange(unhyphenateDate('2021-05-31'), '20210501', '20210531')) // true
// console.log(withinDateRange(unhyphenateDate('2021-06-24'), '20210501', '20210531')) // false

// Calculate an offset date, returning ISO datestring
export function calcOffsetDateStr(
  oldDateISO: string,
  interval: string,
): string {
  // Calculate an offset date, assuming:
  // - oldDateISO is type ISO Date (i.e. YYYY-MM-DD) - NB: different from JavaScript's Date type
  // - interval is string of form nn[bdwmq], and could be negative
  // - where 'b' is weekday (i.e. Monday - Friday in English)
  // Return new date also in ISO Date format
  // v2 method, using built-in NotePlan function 'Calendar.addUnitToDate(date, type, num)'

  const newDate = calcOffsetDate(oldDateISO, interval)
  return toISODateString(newDate)
}

// Calculate an offset date, returning Date object
export function calcOffsetDate(oldDateISO: string, interval: string): Date {
  // Calculate an offset date, assuming:
  // - oldDateISO is type ISO Date (i.e. YYYY-MM-DD) - NB: different from JavaScript's Date type
  // - interval is string of form nn[bdwmq], and could be negative
  // - where 'b' is weekday (i.e. Monday - Friday in English)
  // Return new date as a JS Date
  // v2 method, using built-in NotePlan function 'Calendar.addUnitToDate(date, type, num)'

  const oldDate = new Date(oldDateISO)
  let daysToAdd = 0
  let monthsToAdd = 0
  let yearsToAdd = 0
  const unit = interval.charAt(interval.length - 1) // get last character
  let num = Number(interval.substr(0, interval.length - 1)) // return all but last character
  // console.log("    c_o_d: old = " + oldDate + " / "  + num + " / " + unit)

  switch (unit) {
    case 'b': {
      // week days
      // Method from Arjen at https://stackoverflow.com/questions/279296/adding-days-to-a-date-but-excluding-weekends
      // Avoids looping, and copes with negative intervals too
      const currentDayOfWeek = oldDate.getUTCDay() // = day of week with Sunday = 0, ..Saturday = 6
      let dayOfWeek
      if (num < 0) {
        dayOfWeek = (currentDayOfWeek - 12) % 7
      } else {
        dayOfWeek = (currentDayOfWeek + 6) % 7 // % = modulo operator in JSON
      }
      if (dayOfWeek === 6) {
        num--
      }
      if (dayOfWeek === -6) {
        num++
      }
      // console.log("    c_o_d b: " + currentDayOfWeek + " / " + num + " / " + dayOfWeek)
      const numWeekends = Math.trunc((num + dayOfWeek) / 5)
      daysToAdd = num + numWeekends * 2
      break
    }
    case 'd':
      daysToAdd = num // need *1 otherwise treated as a string for some reason
      break
    case 'w':
      daysToAdd = num * 7
      break
    case 'm':
      monthsToAdd = num
      break
    case 'q':
      monthsToAdd = num * 3
      break
    case 'y':
      yearsToAdd = num
      break
    default:
      console.log(`\tInvalid date interval: '${interval}'`)
      break
  }

  const newDate =
    daysToAdd > 0
      ? Calendar.addUnitToDate(oldDate, 'day', daysToAdd)
      : monthsToAdd > 0
      ? Calendar.addUnitToDate(oldDate, 'month', monthsToAdd)
      : yearsToAdd > 0
      ? Calendar.addUnitToDate(oldDate, 'year', yearsToAdd)
      : oldDate // if nothing else, leave date the same

  return newDate
}

/**
 * Return rough relative string version of difference between date and today.
 * Don't return all the detail, but just the most significant unit (year, month, week, day)
 * If date is in the past then adds 'ago'.
 * @param {number} diffIn - number of days difference (positive or negative)
 * @return {string} - relative date string (e.g. today, 3w ago, 2m, 4y ago.)
 */
export function relativeDateFromNumber(diffIn: number): string {
  let output = ''
  let diff = diffIn
  let isPast = false
  // console.log(`original diff = ${diff}`)
  if (diff < 0) {
    diff = Math.abs(diff)
    isPast = true
  }
  if (diff === 1) {
    output = `${diff} day`
  } else if (diff < 9) {
    output = `${diff} days`
  } else if (diff < 12) {
    output = `${Math.round(diff / 7.0)} wk`
  } else if (diff < 29) {
    output = `${Math.round(diff / 7.0)} wks`
  } else if (diff < 550) {
    output = `${Math.round(diff / 30.4)} mon`
  } else {
    output = `${Math.round(diff / 365.0)} yrs`
  }
  if (diff === 0) {
    output = `today`
  } else if (isPast) {
    output += ` ago`
  } else {
    output = `in ${output}`
  }
  // console.log(`--> ${output}`)
  return output
}

/**
 * Return rough relative string version of difference between date and today.
 * Don't return all the detail, but just the most significant unit (year, month, week, day)
 * If date is in the past then adds 'ago'.
 * @param {Date} date - calculate difference between this date and today
 * @return {string} - relative date string (e.g. today, 3w ago, 2m, 4y ago.)
 */
export function relativeDateFromDate(date: Date): string {
  // Wrapper to relativeDateFromNumber(), accepting JS date instead of number
  const diff = Calendar.unitsBetween(date, new Date(), 'day')
  return relativeDateFromNumber(diff)
}
// Code to test above functions
// console.log(`\ntesting relativeDate`)
// console.log(`-14 -> ${relativeDateFromNumber(-14)}`)
// console.log(`-7 -> ${relativeDateFromNumber(-7)}`)
// console.log(`-2 -> ${relativeDateFromNumber(-2)}`)
// console.log(`-1 -> ${relativeDateFromNumber(-1)}`)
// console.log(`0 -> ${relativeDateFromNumber(0)}`)
// console.log(`1 -> ${relativeDateFromNumber(1)}`)
// console.log(`2 -> ${relativeDateFromNumber(2)}`)
// console.log(`7 -> ${relativeDateFromNumber(7)}`)
// console.log(`14 -> ${relativeDateFromNumber(14)}`)
// console.log(`29 -> ${relativeDateFromNumber(29)}`)
// console.log(`30 -> ${relativeDateFromNumber(30)}`)
// console.log(`31 -> ${relativeDateFromNumber(31)}`)
// console.log(`123 -> ${relativeDateFromNumber(123)}`)
// console.log(`264 -> ${relativeDateFromNumber(264)}`)
// console.log(`364 -> ${relativeDateFromNumber(364)}`)
// console.log(`365 -> ${relativeDateFromNumber(365)}`)
// console.log(`366 -> ${relativeDateFromNumber(366)}`)
