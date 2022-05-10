// @flow strict
// Consolidated files by @dwertheimer

import { hyphenatedDateString, removeDateTags } from '../../helpers/dateTime'
import { chooseOption } from '../../helpers/userInput'
import { isOverdue } from '../../dwertheimer.TaskAutomations/src/taskHelpers'

export type ReturnStatus = {
  status: string,
  msg: string,
  tasks?: number,
  taskArray?: Array<TParagraph>,
}

type RescheduleType = 'move' | 'reschedule' | 'updateDate' | 'makeToday' | false

/* eslint-disable no-unused-vars */
export default async function sweepNote(
  note: TNote,
  withUserConfirm: boolean = true,
  notifyNoChanges: boolean = true,
  overdueOnly: boolean = false,
  isProjectNote: boolean = false,
  returnValue: boolean = false,
  includeHeadings: boolean = false,
  moveType: RescheduleType = false,
): Promise<ReturnStatus> {
  const paragraphs = note.paragraphs

  const paragraphsToMove: Array<TParagraph> = []
  const paragraphsToRemove: Array<TParagraph> = []
  let paragraphsToReturn: Array<TParagraph> = []
  const overdueParagraphs: Array<TParagraph> = []

  const moveableTypes = ['open', 'title', 'scheduled']
  const mainItemTypes = ['open']
  const nonMovableTypes = ['cancelled', 'done']
  const resetTypes = ['title', 'empty']

  let lastRootItem: ?TParagraph = null

  let overdueOnlyStr = overdueOnly ? 'true' : 'false'

  console.log(`Starting sweepNote for file: "${note.filename}" paragraphs:${paragraphs.length} overdueOnly:${overdueOnlyStr}`)
  paragraphs.forEach((p) => {
    const isSeparatorLine = /^---/.test(p.content)
    // use this console.log for creating Jest tests
    // console.log(
    //   `{type:"${p.type}", indents:${p.indents}, heading:"${p.heading}" headingLevel:${p.headingLevel}, content:"${p.content}"},`,
    // )

    // ['scheduled', 'cancelled', 'done']
    if (nonMovableTypes.includes(p.type)) {
      return
    }

    const itemIsOverdue = isOverdue(p)
    if (itemIsOverdue && overdueOnly) overdueParagraphs.push(p)
    const checkOverdue = !overdueOnly || itemIsOverdue

    // Remember the last item which is not indented and open, or a bullet
    // ['open']
    if ((mainItemTypes.includes(p.type) || checkOverdue) && p.indents === 0) {
      // console.log(`sweepNote: ${p.type} Task "${p.content}" ${itemIsOverdue ? `*** overdue` : ''}`)
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
      isSeparatorLine ||
      (moveableTypes.includes(p.type) && checkOverdue) ||
      ((p.indents > 0 || p.type === 'empty') && lastRootItem != null)
    ) {
      paragraphsToMove.push(p)

      if (!(isSeparatorLine || ['title', 'empty'].includes(p.type))) {
        paragraphsToRemove.push(p)
      }
    }

    if (!includeHeadings && returnValue && p.type === 'open') {
      paragraphsToReturn.push(p)
      // console.log(`sweepNote pushed rawContent: ${p.rawContent}`)
    } else {
      // console.log(
      //   `sweepNote ${note.title || note.filename} returning:${returnValue} ${
      //     p.type
      //   }:  ${p.rawContent}`,
      // )
    }
  })

  // TODO: Match existing headings
  // TODO: Add back non-todo main types if it has indented todos
  // TODO: Filter out "empty" headings
  // TODO: Don't remove root tasks or bullets, if they have at least one closed item below, indented as child. Rather, check it off
  const today = new Date()
  let todayNote,
    paragraphsWithDateTag = []
  if (!returnValue) {
    todayNote = DataStore.calendarNoteByDate(today)
    if (todayNote == null) {
      console.log(`Couldn't open Today's Calendar Note`)
      return { status: 'error', msg: `Couldn't open Today's Calendar Note` }
    }
  }

  const openTasks = paragraphsToMove.filter((p) => p.type === 'open').length
  const numTasksToMove = overdueOnly ? overdueParagraphs.length : openTasks

  if (numTasksToMove > 0) {
    console.log(
      `\tsweepNote: file:"${note.filename}" overdueOnly=${overdueOnlyStr} openTasks=${openTasks} overdueParagraphs:${overdueParagraphs.length} numTasksToMove=${numTasksToMove}`,
    )
    // console.log(`${note.filename} has ${numTasksToMove} open tasks`)
    // TODO: Refactor this and get rid of rescheduleType (use moveType instead)
    let rescheduleTasks: RescheduleType
    if (moveType) {
      rescheduleTasks = moveType
    } else {
      const runningTemplate = Boolean(returnValue)
      // rescheduleTasks = returnValue ? 'reschedule' : isProjectNote ? 'reschedule' : 'move'
      rescheduleTasks = isProjectNote ? 'reschedule' : 'move'
    }
    if (withUserConfirm) {
      let choices = [
        {
          label: `✂️ Move (cut & paste) task(s) to today's Calendar Note`,
          value: 'move',
        },
        {
          label: `🗓 Leave original here and copy+link to Calendar Note`,
          value: 'reschedule',
        },
      ]
      if (overdueOnly) {
        choices = [
          ...choices,
          {
            label: `> Replace due date with today's date (e.g. >YYYY-MM-DD)`,
            value: 'updateDate',
          },
          {
            label: `> Replace overdue date with '>today'`,
            value: 'makeToday',
          },
        ]
      }
      choices.push({
        label: '❌ Cancel',
        value: false,
      })
      Editor.openNoteByFilename(note.filename)
      rescheduleTasks = await chooseOption<RescheduleType>(`Found ${numTasksToMove} tasks`, choices, false)
    }

    if (rescheduleTasks === 'move') {
      // Add Tasks to Today
      if (!returnValue && todayNote != null) {
        todayNote.paragraphs = [...todayNote.paragraphs, ...paragraphsToMove]
      } else {
        if (includeHeadings) {
          paragraphsToReturn = [...paragraphsToReturn, ...paragraphsToMove]
        }
      }
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
      const dateTag = noteDate != null && note.filename !== todayNote?.filename ? ` <${hyphenatedDateString(noteDate)}` : ''
      const projNote = note.title ?? ''
      const link = isProjectNote ? ` <[[${projNote}]]` : dateTag
      paragraphsWithDateTag = paragraphsToMove.map((para) => {
        const paraClone = para.duplicate()
        if (para.type === 'open') {
          paraClone.content = removeDateTags(paraClone.content) + link
        }
        return paraClone
      })
    }

    if (rescheduleTasks === 'makeToday') {
      const newParas = overdueParagraphs.forEach((p) => {
        const before = p.content
        p.content = `${removeDateTags(p.content)} >today`
        p.type = 'open' // References section will only see >today tasks when they are "open"
        note.updateParagraph(p)
        // console.log(`Before: ${before} After: ${p.content} should be updated`)
      })
    }

    if (rescheduleTasks === 'updateDate') {
      const newParas = overdueParagraphs.forEach((p) => {
        const before = p.content
        p.content = `${removeDateTags(p.content)} >${hyphenatedDateString(today)}`
        p.type = 'scheduled' // References section will only see >dated tasks when they are "scheduled"
        note.updateParagraph(p)
        // console.log(`Before: ${before} After: ${p.content} should be updated`)
      })
    }

    if (['move', 'reschedule'].indexOf(rescheduleTasks) > -1) {
      if (!returnValue && todayNote != null) {
        todayNote.paragraphs = [...todayNote.paragraphs, ...paragraphsWithDateTag]
      } else {
        if (includeHeadings) {
          paragraphsToReturn = [...paragraphsToReturn, ...paragraphsWithDateTag]
        }
      }

      // paragraphsToRemove.forEach((para) => {
      if (Editor.filename === note.filename) {
        paragraphsToRemove.forEach((para) => {
          para.type = 'scheduled'
          para.content = `${removeDateTags(para.content)} >${hyphenatedDateString(today)}`
          if (Editor.filename === note.filename) {
            Editor.updateParagraph(para)
          } else {
            note.updateParagraph(para)
          }
        })
      }
    }

    console.log(`\tsweepNote: ${String(rescheduleTasks)}-ing  ${paragraphsToMove.length} paragraphs; ${numTasksToMove} tasks`)
  } else {
    if (notifyNoChanges && withUserConfirm) {
      await CommandBar.showInput('There are no open tasks to move in this note.', "OK, I'll open another date.")
      return {
        status: 'error',
        msg: 'There are no open tasks to move in this note.',
      }
    }
  }
  // console.log(`About to return: ${JSON.stringify(paragraphsToReturn)}`) //does not print paragraphs...
  return {
    status: 'ok',
    msg: `Moved ${numTasksToMove}`,
    tasks: numTasksToMove,
    taskArray: paragraphsToReturn,
  }
}
