// @flow

import { hyphenatedDateString, removeDateTags } from './dateHelpers'
import { chooseOption, showMessage } from './userInput'

function createForwardedFromPara(para: TParagraph, noteTitleStr): TParagraph {
  // const dateTag = noteTitle ? ` <${hyphenatedDateString(noteTitle)}` : ''
  const paraClone = para.duplicate()
  paraClone.content = `${removeDateTags(
    paraClone.content,
  )} <[[${noteTitleStr}]]`
  return paraClone
}

// TODO make afterHyphenatedDate take a regular date instead
export default async function sweepProjectNote(
  note: TNote,
  withUserConfirm: boolean = true,
  afterHyphenatedDate: string = '0000-00-00',
  notifyNoChanges: boolean = true,
): Promise<void> {
  const paragraphs = note.paragraphs
  const paragraphsToMove: Array<TParagraph> = []
  console.log(`Reading note: "${note.title || ''}"`)

  const todayDateString = hyphenatedDateString(new Date())
  const today = new Date()
  const todayNote = DataStore.calendarNoteByDate(today)
  if (todayNote == null) {
    console.log(`Could not open today's calendar note`)
    return
  }

  const overdueTasks = paragraphs.filter((p) => {
    const pDateStr = hyphenatedDateString(p.date || note.changedDate)
    return (
      p.type === 'open' &&
      pDateStr <= todayDateString &&
      pDateStr >= afterHyphenatedDate
    )
  })

  const numTasksToUpdate = overdueTasks.length
  console.log(`${numTasksToUpdate} overdue tasks in this note`)

  if (numTasksToUpdate > 0) {
    let confirmed = true
    const pluralTask = numTasksToUpdate !== 1 ? 'tasks' : 'task'

    if (withUserConfirm) {
      Editor.openNoteByFilename(note.filename)
      const yesLabel = `🔗 Yes, reschedule (update '>date') ${numTasksToUpdate} ${pluralTask} to today`
      confirmed = await chooseOption<boolean>(
        `🧹 Ready to sweep '${note.title ?? 'Untitled'}'?`,
        [
          { label: yesLabel, value: true },
          { label: '❌ Skip this note', value: false },
        ],
        false,
      )
    }

    if (confirmed) {
      overdueTasks.forEach((para) => {
        if (para.type === 'open' || para.type === 'scheduled') {
          console.log(`processing ${para.content}`)
          paragraphsToMove.push(createForwardedFromPara(para, note.title || ''))

          if (para.date) {
            para.content = para.content.replace(
              hyphenatedDateString(para.date),
              todayDateString,
            )
          } else {
            para.content = `${para.content} >${todayDateString}`
          }
          para.type = 'scheduled'
          console.log(`about to updateParagraph ${para.content}`)

          if (Editor.filename === note.filename) {
            Editor.updateParagraph(para)
          } else {
            note.updateParagraph(para)
          }
        }
      })

      console.log(
        `Adding ${paragraphsToMove.length} tasks to ${todayNote.title || ''}`,
      )
      paragraphsToMove.forEach((t) => console.log(t.content))
      todayNote.paragraphs = [...todayNote.paragraphs, ...paragraphsToMove]
    }
  } else {
    if (notifyNoChanges && withUserConfirm) {
      await showMessage('Everything is already up to date here!')
    }
  }
}
