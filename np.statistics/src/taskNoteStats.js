// @flow

import { percent } from '../../helpers/general'

//-----------------------------------------------------------------------------
// Show task counts for currently displayed note
export async function showTaskCountNote() {
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
    "Task count. Select anything to copy.",
  )
  if (re !== null) {
    Clipboard.string = display.join("\n")
  }
}
