// @flow
const nowISO = () => new Date().toISOString()
const dateTime = () => {
  const today = new Date()
  const date = hyphenatedDateString()
  const time = `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}`
  return `${date} ${time}`
}

export function insertDate() {
  Editor.insertTextAtCursor(hyphenatedDateString())
}

export function insertISODate() {
  Editor.insertTextAtCursor(nowISO())
}

export function insertDateTime() {
  Editor.insertTextAtCursor(dateTime())
}

export function insertCalendarNoteLink() {
  Editor.insertTextAtCursor(`[[${hyphenatedDateString()}]]`)
}

// From nmn.sweep
export function hyphenatedDateString(dateObj?: Date): string {
  const { year, month, date } = getYearMonthDate(dateObj)
  return `${year}-${month < 10 ? '0' : ''}${month}-${
    date < 10 ? '0' : ''
  }${date}`
}
export function getYearMonthDate(dateObj: Date = new Date()): $ReadOnly<{
  year: number,
  month: number,
  date: number,
}> {
  const year = dateObj.getFullYear()
  const month = dateObj.getMonth() + 1
  const date = dateObj.getDate()
  return { year, month, date }
}
