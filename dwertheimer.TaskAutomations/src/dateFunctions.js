import { hyphenatedDateString } from './dateHelpers'

const nowISO = () => new Date().toISOString()
const dateTime = () => {
  const today = new Date()
  const date = hyphenatedDateString
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
