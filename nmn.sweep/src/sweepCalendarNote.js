// @flow strict

import { hyphenatedDateString } from './dateHelpers'
import { chooseOption } from './userInput'

export default async function sweepCalendarNote(
  note: TNote,
  withUserConfirm: boolean = true,
  notifyNoChanges: boolean = true,
): Promise<void> {
  const paragraphs = note.paragraphs

  const paragraphsToMove: Array<TParagraph> = []
  const paragraphsToRemove: Array<TParagraph> = []

  const moveableTypes = ['open', 'title']
  const mainItemTypes = ['open']
  const nonMovableTypes = ['scheduled', 'cancelled', 'done']
  const resetTypes = ['title', 'empty']

  let lastRootItem: ?TParagraph = null

  paragraphs.forEach((p) => {
    if (nonMovableTypes.includes(p.type)) {
      return
    }

    // Remember the last item which is not indented and open, or a bullet
    if (mainItemTypes.includes(p.type) && p.indents === 0) {
      lastRootItem = p
    }

    // Reset the root item to null if a heading comes in between
    if (resetTypes.includes(p.type) && p.indents === 0) {
      lastRootItem = null
    }

    // Either all movable types, or anything indented, if the parent is indented as well.
    if (
      moveableTypes.includes(p.type) ||
      ((p.indents > 0 || p.type === 'empty') && lastRootItem != null)
    ) {
      paragraphsToMove.push(p)

      if (!['title', 'empty'].includes(p.type)) {
        paragraphsToRemove.push(p)
      }
    }
  })

  // TODO: Match existing headings
  // TODO: Add back non-todo main types if it has indented todos
  // TODO: Filter out "empty" headings
  // TODO: Don't remove root tasks or bullets, if they have at least one closed item below, indented as child. Rather, check it off
  const today = new Date()
  const todayNote = DataStore.calendarNoteByDate(today)
  if (todayNote == null) {
    return
  }

  type RescheduleType = 'move' | 'reschedule' | false

  const numTasksToMove = paragraphsToMove.filter(
    (p) => p.type === 'open',
  ).length

  if (numTasksToMove > 0) {
    let rescheduleTasks: RescheduleType = 'move'
    if (withUserConfirm) {
      Editor.openNoteByFilename(note.filename)
      rescheduleTasks = await chooseOption<RescheduleType>(
        '🧹 Ready to sweep?',
        [
          {
            label: `✂️ Move (cut & paste) ${numTasksToMove} task(s) to today`,
            value: 'move',
          },
          {
            label: `🗓 Reschedule (copy) ${numTasksToMove} task(s) to today`,
            value: 'reschedule',
          },
          {
            label: '❌ Cancel',
            value: false,
          },
        ],
        false,
      )
    }

    if (rescheduleTasks === 'move') {
      // Add Tasks to Today
      todayNote.paragraphs = [...todayNote.paragraphs, ...paragraphsToMove]

      paragraphsToRemove.forEach((para) => {
        if (Editor.filename === note.filename) {
          Editor.removeParagraph(para)
        } else {
          note.removeParagraph(para)
        }
      })
    }
    if (rescheduleTasks === 'reschedule') {
      const noteDate = note.date
      const dateTag =
        noteDate != null ? ` <${hyphenatedDateString(noteDate)}` : ''
      const paragraphsWithDateTag = paragraphsToMove.map((para) => {
        const paraClone = para.duplicate()
        if (para.type === 'open') {
          paraClone.content = removeDateTags(paraClone.content) + dateTag
        }
        return paraClone
      })

      todayNote.paragraphs = [...todayNote.paragraphs, ...paragraphsWithDateTag]

      paragraphsToRemove.forEach((para) => {
        para.type = 'scheduled'
        para.content = `${removeDateTags(para.content)} >${hyphenatedDateString(
          today,
        )}`
        if (Editor.filename == note.filename) {
          Editor.updateParagraph(para)
        } else {
          note.updateParagraph(para)
        }
      })
    }
  } else {
    if (notifyNoChanges && withUserConfirm) {
      await CommandBar.showInput(
        'There are no open tasks to move in this note.',
        "OK, I'll open another date.",
      )
    }
  }
}

function removeDateTags(content: string): string {
  return content
    .replace(/<\d{4}-\d{2}-\d{2}/g, '')
    .replace(/>\d{4}-\d{2}-\d{2}/g, '')
    .trim()
}
