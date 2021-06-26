// @flow strict

import { hyphenatedDateString, removeDateTags } from './dateHelpers'
import { chooseOption } from './userInput'

type ReturnStatus = { status: string, msg: string, tasks?: number }

/* eslint-disable no-unused-vars */
export default async function sweepNote(
  note: TNote,
  withUserConfirm: boolean = true,
  notifyNoChanges: boolean = true,
  overdueOnly: boolean = false,
  isProjectNote: boolean = false,
): Promise<ReturnStatus> {
  const paragraphs = note.paragraphs

  const paragraphsToMove: Array<TParagraph> = []
  const paragraphsToRemove: Array<TParagraph> = []

  const moveableTypes = ['open', 'title']
  const mainItemTypes = ['open']
  const nonMovableTypes = ['scheduled', 'cancelled', 'done']
  const resetTypes = ['title', 'empty']

  let lastRootItem: ?TParagraph = null

  paragraphs.forEach((p) => {
    // console.log(`type:${p.type} indents:${p.indents} "${p.content}"`)
    // ['scheduled', 'cancelled', 'done']
    if (nonMovableTypes.includes(p.type)) {
      return
    }

    // Remember the last item which is not indented and open, or a bullet
    // ['open']
    if (mainItemTypes.includes(p.type) && p.indents === 0) {
      lastRootItem = p
    }

    // Reset the root item to null if a heading comes in between
    // ['title', 'empty']
    if (resetTypes.includes(p.type) && p.indents === 0) {
      lastRootItem = null
    }

    // Either all movable types, or anything indented, if the parent is indented as well.
    if (
      // ['open', 'title']
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
    console.log(`Couldn't open Today's Calendar Note`)
    return { status: 'error', msg: `Couldn't open Today's Calendar Note` }
  }

  type RescheduleType = 'move' | 'reschedule' | false

  const numTasksToMove = paragraphsToMove.filter(
    (p) => p.type === 'open',
  ).length

  if (numTasksToMove > 0) {
    console.log(`\t\t${note.filename} has ${numTasksToMove} open tasks`)
    let rescheduleTasks: RescheduleType = isProjectNote ? 'reschedule' : 'move'
    if (withUserConfirm) {
      Editor.openNoteByFilename(note.filename)
      rescheduleTasks = await chooseOption<RescheduleType>(
        `Move or Copy ${numTasksToMove} open task(s) to TODAY?`,
        [
          {
            label: `✂️ Move (cut & paste) task(s) to today's Calendar Note`,
            value: 'move',
          },
          {
            label: `🗓 Leave original here and copy/link to Calendar Note`,
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

      // paragraphsToRemove.forEach((para) => {
      if (Editor.filename === note.filename) {
        Editor.removeParagraphs(paragraphsToRemove)
      } else {
        note.removeParagraphs(paragraphsToRemove)
      }
      // })
    }
    if (rescheduleTasks === 'reschedule') {
      const noteDate = note.date
      const dateTag =
        noteDate != null ? ` <${hyphenatedDateString(noteDate)}` : ''
      const projNote = note.title ?? ''
      const link = isProjectNote ? ` <[[${projNote}]]` : dateTag
      const paragraphsWithDateTag = paragraphsToMove.map((para) => {
        const paraClone = para.duplicate()
        if (para.type === 'open') {
          paraClone.content = removeDateTags(paraClone.content) + link
        }
        return paraClone
      })

      todayNote.paragraphs = [...todayNote.paragraphs, ...paragraphsWithDateTag]

      paragraphsToRemove.forEach((para) => {
        para.type = 'scheduled'
        para.content = `${removeDateTags(para.content)} >${hyphenatedDateString(
          today,
        )}`
        if (Editor.filename === note.filename) {
          Editor.updateParagraph(para)
        } else {
          note.updateParagraph(para)
        }
      })
    }
    console.log(
      `\t\t${rescheduleTasks}-ing  ${paragraphsToMove.length} paragraphs; ${numTasksToMove} tasks`,
    )
  } else {
    if (notifyNoChanges && withUserConfirm) {
      await CommandBar.showInput(
        'There are no open tasks to move in this note.',
        "OK, I'll open another date.",
      )
      return {
        status: 'error',
        msg: 'There are no open tasks to move in this note.',
      }
    }
  }
  return { status: 'ok', msg: `Moved ${numTasksToMove}`, tasks: numTasksToMove }
}
