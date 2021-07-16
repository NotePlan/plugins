/* es lint-disable no-unused-vars */
// @flow
// Type checking reference: https://flow.org/
// Specific how-to re: Noteplan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md

/**
 * TODO: see readme
 * Find the extra space and think about just one separator
 */

import { chooseOption } from '../../nmn.sweep/src/userInput'

import { getTasksByType, sortListBy, TASK_TYPES } from './taskHelpers'
// Note: not currently using getOverdueTasks from taskHelpers (because if it's open, we are moving it)
// But the functions exist to look for open items with a date that is less than today

const SORT_ORDERS = [
  { sortFields: ['-priority', 'content'], name: 'Priority (!!! and (A))' },
  /* FIXME non-priority fields not working yet */
  {
    sortFields: ['mentions', '-priority', 'content'],
    name: 'By @Person in task, then by priority',
  },
  {
    sortFields: ['hashtags', '-priority', 'content'],
    name: 'By #tag in task, then by priority',
  },
  {
    sortFields: ['content', '-priority'],
    name: 'Alphabetical, then by priority',
  },
]
const DEFAULT_SORT_INDEX = 0
const MAKE_BACKUP = true

/**
 *
 * @param {*} todos
 * @param {*} heading
 * @returns {int} next line number
 */
function insertTodos(note: TNote, todos, heading = '', separator = '') {
  // THE API IS SUPER SLOW TO INSERT TASKS ONE BY ONE
  // let currentLine = startingLine ? startingLine : heading ? 1 : 2
  // if (heading) {
  //   Editor.insertParagraph(heading, 1, 'text')
  //   currentLine++
  // }
  // for (let i = todos.length - 1; i >= 0; i--) {
  //   Editor.insertTodo(todos].content, currentLine++)
  // }
  // return currentLine
  // SO INSTEAD, JUST PASTE THEM ALL IN ONE BIG STRING
  const headingStr = heading ? `${heading}\n` : ''
  const contentStr = todos.map((t) => t.raw).join(`\n`)
  // console.log(`inserting tasks: \n${JSON.stringify(todos)}`)
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
function sortTasksInNote(
  note,
  sortOrder = SORT_ORDERS[DEFAULT_SORT_INDEX].sortFields,
) {
  const sortedList = {}
  if (note) {
    const paragraphs = note.paragraphs
    console.log(`\t${paragraphs.length} total lines in note`)
    if (paragraphs.length) {
      const taskList = getTasksByType(paragraphs)
      console.log(`\tOpen Tasks:${taskList.open.length}`)
      for (const ty of TASK_TYPES) {
        sortedList[ty] = sortListBy(taskList[ty], sortOrder)
      }
      console.log(`\tAfter Sort - Open Tasks:${sortedList.open.length}`)
    }
  } else {
    console.log(`sorttasksInNote: no note to sort`)
  }
  // console.log(JSON.stringify(sortedList))
  return sortedList
}

async function getUserSort(sortChoices = SORT_ORDERS) {
  console.log(`\tgetUserSort(${JSON.stringify(sortChoices)}`)
  // [String] list of options, placeholder text, callback function with selection/
  const choice = await CommandBar.showOptions(
    sortChoices.map((a) => a.name),
    `Select sort order:`,
  )
  console.log(
    `\tgetUserSort returning ${JSON.stringify(
      sortChoices[choice.index].sortFields,
    )}`,
  )
  return sortChoices[choice.index].sortFields
}

function findRawParagraph(note: TNote, content) {
  const found = note.paragraphs.filter((p) => p.rawContent === content)
  if (found && found.length > 1) {
    console.log(
      `** Found ${found.length} identical occurrences for "${content}". Deleting the first.`,
    )
  }
  return found[0] || null
}

//TODO: this does not work. creates 4 copies of the file but does not save the tasks
// seems like somewheer there's not an await where there should be
async function saveBackup(taskList) {
  const backupPath = `@Trash`
  const backupTitle = `_Task-sort-backup`
  const backupFilename = `${backupPath}/${backupTitle}.${DataStore.defaultFileExtension}`
  console.log(`\tBackup filename: ${backupFilename}`)
  let notes = await DataStore.projectNoteByTitle(backupTitle, false, true)
  console.log(`\tGot note back: ${notes ? JSON.stringify(notes) : ''}`)
  if (!notes || !notes.length) {
    console.log(`\tsaveBackup: no note named ${backupFilename}`)
    const filename = await DataStore.newNote(`_Task-sort-backup`, `@Trash`)
    // TODO: There's a bug in API where filename is not correct and the file is not in cache unless you open a command bar
    // remove all this:
    await CommandBar.showOptions(
      ['OK'],
      `Backing up todos in @Trash/${backupTitle}`,
    )
    //
    console.log(`\tCreated ${filename ? filename : ''} for backups`)
    notes = await DataStore.projectNoteByTitle(backupTitle, false, true)
    // note = await DataStore.projectNoteByFilename(backupFilename)
    console.log(`backup file contents:\n${notes ? JSON.stringify(notes) : ''}`)
  }
  if (notes && notes[0]) {
    notes[0].insertParagraph(`---`, 2, 'text')
    console.log(`\tBACKUP Saved to ${backupTitle}`)
    await insertTodos(notes[0], taskList)
  }
}

async function deleteExistingTasks(note, tasks, shouldBackupTasks = true) {
  for (const typ of TASK_TYPES) {
    console.log(`\tDeleting ${tasks[typ].length} ${typ} tasks from note`)
    // Have to find all the paragraphs again
    if (shouldBackupTasks) {
      await saveBackup(tasks[typ])
    }
    try {
      const taskList = tasks[typ].map(
        note ? (t) => findRawParagraph(note, t.raw) : false,
      )
      //$FlowIgnore
      Editor.note.removeParagraphs(taskList)
    } catch (e) {
      console.log(JSON.stringify(e))
    }
  }
}

async function writeOutTasks(
  note,
  tasks,
  drawSeparators = false,
  withHeadings,
) {
  const headings = {
    open: 'Open Tasks',
    scheduled: 'Scheduled Tasks',
    done: 'Completed Tasks',
    cancelled: 'Cancelled Tasks',
  }
  const tasksTypesReverse = TASK_TYPES.slice().reverse()
  for (let i = 0; i < tasksTypesReverse.length; i++) {
    const ty = tasksTypesReverse[i]
    if (tasks[ty].length) {
      console.log(`\tEDITOR_FILE TASK_TYPE=${ty}`)
      try {
        note
          ? await insertTodos(
              note,
              tasks[ty],
              withHeadings ? `### ${headings[ty]}:` : '',
              drawSeparators
                ? `${i === tasks[ty].length - 1 ? '---' : ''}`
                : '',
            )
          : null
      } catch (e) {
        console.log(JSON.stringify(e))
      }
    }
  }
}

async function wantHeadings() {
  return await chooseOption(
    `Include Task Type headings in the output?`,
    [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
    true,
  )
}

export default async function sortTasks(
  withUserInput: boolean = true,
  sortFields: Array<string> = SORT_ORDERS[DEFAULT_SORT_INDEX].sortFields,
  withHeadings: boolean | null = null,
) {
  console.log(
    `\n\nStarting sortTasks(${withUserInput},${JSON.stringify(
      sortFields,
    )},${withHeadings}):`,
  )
  const sortOrder = withUserInput ? await getUserSort() : sortFields
  console.log(`\tUser specified sort=${JSON.stringify(sortOrder)}`)
  console.log(`\tFinished getUserSort, now running wantHeadings`)
  const printHeadings = withHeadings === null ? await wantHeadings() : true
  console.log(
    `\tFinished wantHeadings()=${String(
      printHeadings,
    )}, now running sortTasksInNote`,
  )
  const sortedTasks = sortTasksInNote(Editor.note, sortOrder)
  console.log(`\tFinished sortTasksInNote, now running deleteExistingTasks`)
  await deleteExistingTasks(Editor.note, sortedTasks, MAKE_BACKUP) // need to do this before adding new lines to preserve line numbers
  console.log(`\tFinished deleteExistingTasks, now running writeOutTasks`)
  await writeOutTasks(Editor.note, sortedTasks, false, printHeadings)
  console.log(`\tFinished writeOutTasks, now finished`)

  console.log('Finished sortTasks()!')
}
