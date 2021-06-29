// @flow

//-------------------------------------------------------------------------------
// Input functions

// (from @nmn / nmn.sweep)
export type Option<T> = $ReadOnly<{
  label: string,
  value: T,
}>

// (from @nmn / nmn.sweep)
export async function chooseOption<T, TDefault = T>(
  title: string,
  options: $ReadOnlyArray<Option<T>>,
  defaultValue: TDefault,
): Promise<T | TDefault> {
  const { index } = await CommandBar.showOptions(
    options.map((option) => option.label),
    title,
  )
  return options[index]?.value ?? defaultValue
}

// (from @nmn / nmn.sweep)
export async function getInput(
  title: string,
  okLabel: string = 'OK',
): Promise<string> {
  return await CommandBar.showInput(title, okLabel)
}

// Show feedback message using Command Bar (@dwertheimer, updating @nmn)
export async function showMessage(
  message: string,
  confirmTitle: string = 'OK',
): Promise<void> {
  await CommandBar.showOptions([confirmTitle], message)
}

// Show feedback Yes/No Question via Command Bar (@dwertheimer)
export async function showMessageYesNo(
  message: string,
  choicesArray: Array<string> = ['Yes', 'No'],
): Promise<string> {
  const answer = await CommandBar.showOptions(choicesArray, message)
  return choicesArray[answer.index]
}

//-------------------------------------------------------------------------------
// Stats functions
// @jgclark except where shown

// Return string with percentage value appended
// export function percent(value, total) {
// @eduardme
export function percent(value: number, total: number): string {
  return `${value} (${Math.round((value / total) * 100)}%)`
}

//-------------------------------------------------------------------------------
// Date functions
// @jgclark except where shown

export const RE_DATE = '\\d{4}-[01]\\d{1}-\\d{2}' // find dates of form YYYY-MM-DD
export const RE_TIME = '[0-2]\\d{1}:[0-5]\\d{1}\\s?(?:AM|PM|am|pm)?' // find '12:23' with optional '[ ][AM|PM|am|pm]'

export const todaysDateISOString: string = new Date().toISOString().slice(0, 10)
// TODO: make a friendlier string
export const nowShortDateTime: string = new Date().toISOString().slice(0, 16)

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

export function unhyphenateDateString(dateString: string): string {
  return dateString.replace(/-/g, '')
}

export function toISODateString(dateObj: Date): string {
  return dateObj.toISOString().slice(0, 10)
}

export function toISOShortDateTimeString(dateObj: Date): string {
  return dateObj.toISOString().slice(0, 16)
}

export function printDateRange(drs: Array<DateRange>) {
  const dr = drs[0]
  console.log(
    `${toISOShortDateTimeString(dr.start)}-${toISOShortDateTimeString(dr.end)}`,
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

//-------------------------------------------------------------------------------
// Misc functions for NP

// Pretty print range information (@EduardMe)
export function rangeToString(r: Range): string {
  if (r == null) {
    return 'Range is undefined!'
  }
  return `range: ${r.start}-${r.end}`
}

// return title of note useful for display, even for calendar notes (the YYYYMMDD)
// (@jgclark)
export function displayTitle(n: TNote): string {
  if (n.type === 'Calendar' && n.date != null) {
    return hyphenatedDate(n.date)
  } else {
    return n.title ?? ''
  }
}

// Print out all data for a paragraph (@EduardMe)
export function printParagraph(p: TParagraph) {
  if (p === null) {
    console.log('ERROR: paragraph is undefined')
    return
  }

  const {
    content,
    type,
    prefix,
    contentRange,
    lineIndex,
    date,
    heading,
    headingRange,
    headingLevel,
    isRecurring,
    indents,
    filename,
    noteType,
    linkedNoteTitles,
  } = p

  const logObject = {
    content,
    type,
    prefix,
    contentRange,
    lineIndex,
    date,
    heading,
    headingRange,
    headingLevel,
    isRecurring,
    indents,
    filename,
    noteType,
    linkedNoteTitles,
  }

  console.log(JSON.stringify(logObject, null, 2))
}

export function printNote(note: TNote) {
  if (note == null) {
    console.log('Note not found!')
    return
  }

  if (note.type === 'Notes') {
    console.log(
      `title: ${note.title ?? ''}\n\tfilename: ${
        note.filename ?? ''
      }\n\tcreated: ${String(note.createdDate) ?? ''}\n\tchanged: ${
        String(note.changedDate) ?? ''
      }\n\thashtags: ${note.hashtags?.join(',') ?? ''}\n\tmentions: ${
        note.mentions?.join(',') ?? ''
      }`,
    )
  } else {
    console.log(
      `filename: ${note.filename ?? ''}\n\tcreated: ${
        String(note.createdDate) ?? ''}\n\tchanged: ${
      String(note.changedDate) ?? ''}\n\thashtags: ${note.hashtags?.join(',') ?? ''}\n\tmentions: ${
        note.mentions?.join(',') ?? ''}`,
    )
  }
}

// (@dwertheimer)
export async function noteOpener(
  fullPath: string,
  desc: string,
  useProjNoteByFilename: boolean = true,
): Promise<?TNote> {
  console.log(
    `\tAbout to open filename: "${fullPath}" (${desc}) using ${
      useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'
    }`,
  )
  const newNote = useProjNoteByFilename
    ? await DataStore.projectNoteByFilename(fullPath)
    : await DataStore.noteByFilename(fullPath, 'Notes')
  if (newNote != null) {
    console.log(`\t\tOpened ${fullPath} (${desc} version) `)
    return newNote
  } else {
    console.log(
      `\t\tDidn't work! ${
        useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'
      } returned ${(newNote: any)}`,
    )
  }
}

// Find a unique note title/filename so backlinks can work properly (@dwertheimer)
// Keep adding numbers to the end of a filename (if already taken) until it works
export function getUniqueNoteTitle(title: string): string {
  let i = 0,
    res = [],
    newTitle = title
  while (++i === 1 || res.length > 0) {
    newTitle = i === 1 ? title : `${title} ${i}`
    res = DataStore.projectNoteByTitle(newTitle, true, false)
  }
  return newTitle
}

// Return user's pick from list of available folders (or return / if none) (@jgclark)
export async function chooseFolder(msg: string): Promise<string> {
  let folder: string
  const folders = DataStore.folders // excludes Trash and Archive
  if (folders.length > 0) {
    const re = await CommandBar.showOptions(folders, msg)
    folder = folders[re.index]
  } else {
    // no Folders so go to root
    folder = '/'
  }
  console.log(`\tfolder=${folder}`)
  return folder
}

// Return list of all notes, sorted by changed date (newest to oldest)
export function allNotesSortedByChanged(): Array<TNote> {
  const projectNotes = DataStore.projectNotes.slice()
  const calendarNotes = DataStore.calendarNotes.slice()
  const allNotes = projectNotes.concat(calendarNotes)
  const allNotesSorted = allNotes.sort(
    (first, second) => second.changedDate - first.changedDate,
  ) // most recent first
  return allNotesSorted
}

// Return list of project notes, sorted by changed date (newest to oldest)
export function projectNotesSortedByChanged(): Array<TNote> {
  const projectNotes = DataStore.projectNotes.slice()
  const notesSorted = projectNotes.sort(
    (first, second) => second.changedDate - first.changedDate,
  ) // most recent first
  return notesSorted
}

// Return list of project notes, sorted by title (ascending)
export function projectNotesSortedByTitle(): Array<TNote> {
  const projectNotes = DataStore.projectNotes.slice()
  const notesSorted = projectNotes.sort(function (first, second) {
    const a = first.title?.toUpperCase() ?? '' // ignore upper and lowercase
    const b = second.title?.toUpperCase() ?? '' // ignore upper and lowercase
    if (a < b) {
      return -1 //a comes first
    }
    if (a > b) {
      return 1 // b comes first
    }
    return 0 // names must be equal
  })
  return notesSorted
}

// Convert paragraph(s) to single raw text string
export function parasToText(paras: Array<TParagraph>): string {
  // console.log('parasToText: starting with ' + paras.length + ' paragraphs')
  let text = ''
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i]
    // paraDetails(p)
    text += `${p.rawContent}\n`
  }
  const parasAsText = text.trimEnd() // remove extra newline not wanted after last line
  return parasAsText
}
