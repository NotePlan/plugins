// @flow
// Last updated 30.12.2022 for v0.6.0 by @jgclark

import pluginJson from '../plugin.json'
import { logDebug, logWarn } from '@helpers/dev'
import { displayTitle, percent } from '@helpers/general'

//-----------------------------------------------------------------------------

// Show task counts for currently displayed note
export async function showTaskCountForNote() {
  const note = Editor.note
  if (note == null) {
    // No note open.
    logWarn(pluginJson, "No note open, so nothing to count.")
    return
  }
  const paragraphs = Editor.paragraphs
  const countParagraphsOfType = function (types) {
    return paragraphs.filter((p) => types.includes(p.type)).length
  }
  // for (let p of paragraphs) {
  //   logDebug(pluginJson, `${p.type}:\t${p.content}`)
  // }

  const tasksTotal = countParagraphsOfType(["open", "done", "scheduled", "cancelled"])
  const checklistsTotal = countParagraphsOfType(["checklist", "checklistDone", "checklistScheduled", "checklistCancelled"])

  const display = [
    `🔢 Total Tasks: ${tasksTotal}, of which ${percent(countParagraphsOfType(["done", "cancelled"]), tasksTotal)} are closed`,
    `⚪️ Open Tasks: ${percent(countParagraphsOfType(["open"]), tasksTotal)}`,
    `✅ Done Tasks: ${percent(countParagraphsOfType(["done"]), tasksTotal)}`,
    `🚫 Cancelled Tasks: ${percent(countParagraphsOfType(["cancelled"]), tasksTotal)}`,
    `📆 Scheduled Tasks: ${percent(countParagraphsOfType(["scheduled"]), tasksTotal)}`,
    `Total Checklists: ${checklistsTotal}, of which ${percent(countParagraphsOfType(["checklistDone", "checklistCancelled"]), checklistsTotal)} are closed`,
  ]

  const re = await CommandBar.showOptions(
    display,
    `Task count for '${displayTitle(note)}'. Select anything to copy.`,
  )
  if (re !== null) {
    Clipboard.string = display.join("\n")
  }
}

// Shows task statistics for all notes, ignoring @special folders
export async function showTaskCountForAll(): Promise<void> {
  const projectNotes = DataStore.projectNotes.filter(
    (n) => !n.filename.startsWith("@Templates") && !n.filename.startsWith("@Trash") && !n.filename.startsWith("@Archive")
  )
  const calendarNotes = DataStore.calendarNotes.slice()
  const allNotes = projectNotes.concat(calendarNotes)
  const allNotesCount = allNotes.length
  let openTasksTotal = 0
  let doneTasksTotal = 0
  let cancelledTasksTotal = 0
  let scheduledTasksTotal = 0
  let openChecklistsTotal = 0
  let doneChecklistsTotal = 0
  let cancelledChecklistsTotal = 0
  let scheduledChecklistsTotal = 0
  const open = new Map() // track the open totals as an object

  // Iterate over all project notes, counting
  for (let i = 0; i < allNotesCount; i += 1) {
    const n = allNotes[i]
    const paragraphs = n.paragraphs
    const countParagraphsOfType = function (types) {
      const pf = paragraphs.filter((p) => types.includes(p.type))
      return paragraphs.filter((p) => types.includes(p.type)).length
    }
    openTasksTotal += countParagraphsOfType(["open"]) // doesn't include scheduled
    doneTasksTotal += countParagraphsOfType(["done"])
    cancelledTasksTotal += countParagraphsOfType(["cancelled"])
    // following is not quite the same as future. TODO: make future
    scheduledTasksTotal += countParagraphsOfType(["scheduled"])
    open.set(n.title, countParagraphsOfType(["open"]))

    openChecklistsTotal += countParagraphsOfType(["checklist"]) // doesn't include scheduled
    doneChecklistsTotal += countParagraphsOfType(["checklistDone"])
    cancelledChecklistsTotal += countParagraphsOfType(["checklistCancelled"])
    // following is not quite the same as future. TODO: make future
    scheduledChecklistsTotal += countParagraphsOfType(["checklistScheduled"])
  }

  const closedTasksTotal = doneTasksTotal + cancelledTasksTotal
  const tasksTotal = openTasksTotal + closedTasksTotal
  const doneTasksPercent = percent(doneTasksTotal, tasksTotal)
  const cancelledTasksPercent = percent(cancelledTasksTotal, tasksTotal)
  const display1 = [
    `Task statistics from ${allNotesCount.toLocaleString()} notes:`,
    `\t⚪️ Open: ${percent(openTasksTotal, tasksTotal)}\t📆 Scheduled: ${percent(scheduledTasksTotal, tasksTotal)}`,
    `\t✅ Done: ${doneTasksPercent}\t🚫 Cancelled: ${cancelledTasksPercent}`,
  ]
  const closedChecklistsTotal = doneChecklistsTotal + cancelledChecklistsTotal
  const checklistsTotal = openChecklistsTotal + closedChecklistsTotal
  const doneChecklistsPercent = percent(doneChecklistsTotal, checklistsTotal)
  const cancelledChecklistsPercent = percent(cancelledChecklistsTotal, checklistsTotal)
  const display2 = [
    `Checklist statistics from ${allNotesCount.toLocaleString()} notes:`,
    `\t⚪️ Open: ${percent(openChecklistsTotal, checklistsTotal)}\t📆 Scheduled: ${percent(scheduledChecklistsTotal, checklistsTotal)}`,
    `\t✅ Done: ${doneChecklistsPercent}\t🚫 Cancelled: ${cancelledChecklistsPercent}`,
  ]

  // Now find top 5 project notes by open tasks
  // (spread operator can be used to concisely convert a Map into an array)
  const openSorted = new Map([...open.entries()].sort((a, b) => b[1] - a[1]))
  const openSortedTitle = []
  let i = 0
  const display3 = []
  display3.push('Notes with most open tasks:')
  for (const elem of openSorted.entries()) {
    i += 1
    display3.push(`\t${elem[0] ?? ''} (${elem[1]} open)`)
    openSortedTitle.push(elem[0])
    if (i >= 5) {
      break
    }
  }
  const display = display1.concat(display2).concat(display3)
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
