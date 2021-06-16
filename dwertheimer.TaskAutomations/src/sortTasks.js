/* eslint-disable no-unused-vars */
// @flow
// Type checking reference: https://flow.org/
// Specific how-to re: Noteplan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md
import { showMessage, showMessageYesNo } from './noteHelpers'
import {
  getOverdueTasks,
  getTasksByType,
  sortListBy,
  TASK_TYPES,
} from './taskHelpers'

const SORT_ORDERS = [
  { sortFields: ['priority'], name: 'Priority (!!! and (A))' },
  {
    sortFields: ['mentions', 'priority'],
    name: 'By first @Person in task, then by priority',
  },
  {
    sortFields: ['hashtags', 'priority'],
    name: 'By first #tag in task, then by priority',
  },
]

/*
 *  sortOrder can be an array-order of:
 *        content,
 *        priority,
 *        index,
 *        raw,
 *        hashtags,
 *        mentions,
 *        exclamations,
 *        parensPriority,
 *  any item can be in DESC order by placing a minus in front, e.g. "-priority"
 */
function sortTasksInNote(note, sortOrder = ['priority']) {
  const sortedList = {}
  if (note) {
    const paragraphs = note.paragraphs
    console.log(`\t${paragraphs.length} total lines in note`)
    if (paragraphs.length) {
      const taskList = getTasksByType(paragraphs)
      console.log(`Open Tasks:${taskList.open.length}`)
      TASK_TYPES.forEach((ty) => {
        sortedList[ty] = sortListBy(taskList[ty], sortOrder)
        // sortedList[ty] = sortListBy(taskList[ty], ['hashtags'])
        // sortedList[ty] = sortListBy(taskList[ty], ['mentions'])
        // sortedList[ty] = sortListBy(taskList[ty], ['priority'])
      })
      console.log(`After Sort - Open Tasks:${sortedList.open.length}`)
    }
  } else {
    console.log(`sorttasksInNote: no note to sort`)
  }
  console.log(JSON.stringify(sortedList))
  return sortedList
}

async function getUserSort(sortChoices = SORT_ORDERS) {
  // [String] list of options, placeholder text, callback function with selection/
  const choice = await CommandBar.showOptions(
    sortChoices.map((a) => a.name),
    `Select sort order:`,
  )
  return sortChoices[choice.index].sortFields
}

export default async function sortTasks() {
  console.log('\nStarting sortTasks():')
  const sortOrder = await getUserSort()
  const tasks = sortTasksInNote(Editor.note, sortOrder)
  console.log(`\t${JSON.stringify(tasks)}`)
  console.log(
    `.OPEN Tasks: Priority | Content (sorted by ${JSON.stringify(sortOrder)})`,
  )
  tasks.open.forEach((t) => {
    console.log(
      `${t.priority}: # ${t.hashtags} || @ ${t.mentions} || ${t.content} `,
    )
  })
  console.log('Finished sortTasks()!')
}
