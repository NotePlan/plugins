// @flow

import { showMessage } from '@helpers/userInput'

/**
 * Append a human readable number of days to/from the date given in the bullet points in a list
 */
export async function countAndAddDays(): Promise<void> {
  const note = Editor.note
  if (!note) {
    await showMessage('No Note Open')
    return
  }

  //   let insertedCharacters = 0
  let matches = 0
  const paragraphs = note.paragraphs
  for (let para of paragraphs) {
    if (para.type !== 'list') {
      continue
    }
    if (!para.content.trim().match(/\[\[[0-9]{4}\-[0-9]{2}\-[0-9]{2}\]\]:$/)) {
      continue
    }

    const match = para.content.trim().match(/\[\[([0-9]{4})\-([0-9]{2})\-([0-9]{2})\]\]:$/)
    if (!match) {
      continue
    }

    const [_, year, month, date] = match
    const days = daysUntil(parseInt(year, 10), parseInt(month, 10), parseInt(date, 10))
    const insertAtIndex = para.contentRange?.end
    if (insertAtIndex == null) {
      continue
    }
    matches++
    const stringToInsert = days > 0 ? ` **${days}** days to go!` : days < 0 ? ` **${-days}** ago!` : ` **today!**`
    para.content = para.content + stringToInsert
    // Editor.insertTextAtCharacterIndex(` **${days}** days to go!`, insertAtIndex + insertedCharacters)
  }
  note.paragraphs = paragraphs
  await showMessage(`Added ${matches} dates`)
}

// function to get msSinceEpoch of given date
function getMsSinceEpoch(year: number, month: number, date: number): number {
  const dateObj = new Date(year, month - 1, date)
  return dateObj.getTime()
}

// function to get the year, month, and date of today
function getToday(): [number, number, number] {
  const dateObj = new Date()
  return [dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate()]
}

// function to count days until given date
function daysUntil(year: number, month: number, date: number): number {
  const today = getMsSinceEpoch(...getToday())
  const target = getMsSinceEpoch(year, month, date)
  const diff = target - today
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
