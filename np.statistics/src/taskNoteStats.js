// @flow

import {
  displayTitle,
  percent,
} from '../../helpers/general'

//-----------------------------------------------------------------------------

// Show task counts for currently displayed note
export async function showTaskCountForNote() {
  const note = Editor.note
  if (note == null) {
    // No note open.
    return
  }
  const paragraphs = Editor.paragraphs
  const countParagraphs = function (types) {
    return paragraphs.filter((p) => types.includes(p.type)).length
  }

  const total = countParagraphs(["open", "done", "scheduled", "cancelled"])

  const display = [
    `🔢 Total: ${ total}`,
    `✅ Done: ${ percent(countParagraphs(["done"]), total)}`,
    `⚪️ Open: ${ percent(countParagraphs(["open"]), total)}`,
    `🚫 Cancelled: ${ percent(countParagraphs(["cancelled"]), total)}`,
    `📆 Scheduled: ${ percent(countParagraphs(["scheduled"]), total)}`,
    `📤 Closed: ${ 
      percent(countParagraphs(["done", "cancelled"]), total)}`,
  ]

  const re = await CommandBar.showOptions(
    display,
    `Task count for '${displayTitle(note)}'. Select anything to copy.`,
  )
  if (re !== null) {
    Clipboard.string = display.join("\n")
  }
}

// Shows task statistics for all notes, ignoring Templates
export async function showTaskCountForAll(): Promise<void> {
  const projectNotes = DataStore.projectNotes.filter(
    (n) => !n.filename.startsWith("@Templates") // ignore notes in Templates folder
  )
  const calendarNotes = DataStore.calendarNotes.slice()
  const allNotes = projectNotes.concat(calendarNotes)
  const allNotesCount = allNotes.length
  let doneTotal = 0
  let openTotal = 0
  let cancelledTotal = 0
  let scheduledTotal = 0
  const open = new Map() // track the open totals as an object

  // Count task type for a single note
  // The following stopped working for reasons I couldn't understand, so commented out.
  // const countTaskTypeInNote = function (inType) {
  //   return Editor.paragraphs.filter((p) => p.type === inType).length
  // }

  // Iterate over all project notes, counting
  for (let i = 0; i < allNotesCount; i += 1) {
    const n = allNotes[i]
    doneTotal += n.paragraphs.filter((p) => p.type === 'done').length
    openTotal += n.paragraphs.filter((p) => p.type === 'open').length // doesn't include scheduled
    cancelledTotal += n.paragraphs.filter((p) => p.type === 'cancelled').length
    // following is not quite the same as future. TODO: make future
    scheduledTotal += n.paragraphs.filter((p) => p.type === 'scheduled').length
    open.set(n.title, n.paragraphs.filter((p) => p.type === 'open').length)
  }

  const closedTotal = doneTotal + cancelledTotal
  const total = openTotal + closedTotal
  const donePercent = percent(doneTotal, total)
  const cancelledPercent = percent(cancelledTotal, total)
  const display1 = [
    `Task statistics from ${allNotesCount} notes:  (select any to copy)`,
    `\t✅ Done: ${donePercent}\t🚫 Cancelled: ${cancelledPercent}`,
    `\t⚪️ Open: ${percent(openTotal, total)}\t📆 Scheduled: ${percent(scheduledTotal, total)}`,
  ]

  // Now find top 5 project notes by open tasks
  // (spread operator can be used to concisely convert a Map into an array)
  const openSorted = new Map([...open.entries()].sort((a, b) => b[1] - a[1]))
  const openSortedTitle = []
  let i = 0
  const display2 = []
  display2.push('Notes with most open tasks:  (select any to open)')
  for (const elem of openSorted.entries()) {
    i += 1
    display2.push(`\t${elem[0] ?? ''} (${elem[1]} open)`)
    openSortedTitle.push(elem[0])
    if (i >= 5) {
      break
    }
  }
  const display = display1.concat(display2)
  const re = await CommandBar.showOptions(
    display,
    'Task stats.  (Select to open/copy)',
  )
  if (re !== null) {
    if (re.index <= 5) {
      // We want to copy the statistics
      Clipboard.string = display1.join('\n')
    } else {
      // We want to open the relevant note
      const title = openSortedTitle[re.index - 6]
      if (title != null) {
        Editor.openNoteByTitle(title)
      }
    }
  }
}
