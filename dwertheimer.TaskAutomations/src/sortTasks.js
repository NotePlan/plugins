/* eslint-disable no-unused-vars */
// @flow
// Type checking reference: https://flow.org/
// Specific how-to re: Noteplan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md

/**
 * TODO: do a lot more testing
 * Find the extra space and think about just one separator
 */

import { showMessage, showMessageYesNo } from './noteHelpers'
import {
  getOverdueTasks,
  getTasksByType,
  sortListBy,
  TASK_TYPES,
} from './taskHelpers'

const SORT_ORDERS = [
  { sortFields: ['-priority', 'content'], name: 'Priority (!!! and (A))' },
  {
    sortFields: ['mentions', '-priority', 'content'],
    name: 'By first @Person in task, then by priority',
  },
  {
    sortFields: ['hashtags', '-priority', 'content'],
    name: 'By first #tag in task, then by priority',
  },
]
/**
 *
 * @param {*} todos
 * @param {*} heading
 * @returns {int} next line number
 */
function insertTodos(note, todos, heading = null, separator = '') {
  // THIS VERSION IS SUPER SLOW. I THINK INSERTTODO IS SLOW...
  // let currentLine = startingLine ? startingLine : heading ? 1 : 2
  // if (heading) {
  //   Editor.insertParagraph(heading, 1, 'text')
  //   currentLine++
  // }
  // for (let i = todos.length - 1; i >= 0; i--) {
  //   Editor.insertTodo(todos[i].content, currentLine++)
  // }
  // return currentLine
  const headingStr = heading ? `${heading}\n` : ''
  const contentStr = todos.map((t) => t.raw).join(`\n`)
  note.insertParagraph(
    `${headingStr}${contentStr}${separator ? `\n${separator}` : ''}`,
    1,
    'text',
  )
}

/**
 *  @param {TNote} the note
 *  @param {array} sort fields order
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
 *  @returns the a sorted list of the tasks from the note
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
      })
      console.log(`After Sort - Open Tasks:${sortedList.open.length}`)
    }
  } else {
    console.log(`sorttasksInNote: no note to sort`)
  }
  // console.log(JSON.stringify(sortedList))
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

function findRawParagraph(note, content) {
  const found = note.paragraphs.filter((p) => p.rawContent === content)
  if (found && found.length > 1) {
    console.log(
      `Found ${found.length} occurrences for "${content}". Deleting the first.`,
    )
  }
  return found[0]
}

function deleteExistingTasks(note, tasks) {
  TASK_TYPES.forEach((typ) => {
    console.log(`Deleting ${tasks[typ].length} ${typ} tasks from note`)
    // Have to find all the paragraphs again
    Editor.note.removeParagraphs(
      tasks[typ].map((t) => findRawParagraph(note, t.raw)),
    )
  })
  //   tasks[typ]
  //     .slice()
  //     .reverse()
  //     .forEach((t) => Editor.removeParagraphAtIndex(t.index))
  // })
  //  removeParagraphAtIndex(lineIndex: number): void,
}

function writeOutTasks(note, tasks, drawSeparators = true) {
  // tasks.forEach((cat) => {})
  const headings = {
    open: 'Open Tasks',
    scheduled: 'Scheduled Tasks',
    done: 'Completed Tasks',
    cancelled: 'Cancelled Tasks',
  }
  TASK_TYPES.slice()
    .reverse()
    .forEach((ty) => {
      if (tasks[ty].length) {
        insertTodos(note, tasks[ty], `### ${headings[ty]}:`, '')
      }
    })
}

export default async function sortTasks() {
  console.log('\nStarting sortTasks():')
  const sortOrder = await getUserSort()
  const sortedTasks = sortTasksInNote(Editor.note, sortOrder)
  // console.log(`\t${JSON.stringify(tasks)}`)
  // console.log(
  //   `.OPEN Tasks: Priority | Content (sorted by ${JSON.stringify(sortOrder)})`,
  // )
  // tasks.open.forEach((t) => {
  //   console.log(
  //     `${t.priority}: # ${t.hashtags} || @ ${t.mentions} || ${t.content} `,
  //   )
  // })
  deleteExistingTasks(Editor.note, sortedTasks) // need to do this before adding new lines to preserve line numbers
  writeOutTasks(Editor.note, sortedTasks)
  console.log('Finished sortTasks()!')
}
