// @flow

import pluginJson from '../plugin.json'
import { chooseOption, chooseHeading, showMessage } from '@helpers/userInput'
import { getTagParamsFromString } from '@helpers/general'
import { removeHeadingFromNote, getBlockUnderHeading } from '@helpers/NPParagraph'
import { sortListBy, getTasksByType, TASK_TYPES, type ParagraphsGroupedByType } from '@helpers/sorting'
import { logDebug, logWarn, logError, clo, JSP } from '@helpers/dev'
import { findStartOfActivePartOfNote, findEndOfActivePartOfNote } from '@helpers/paragraph'
import { saveEditorIfNecessary } from '@helpers/editor'
import { getBooleanValue, getArrayValue } from '@helpers/dataManipulation'

const TOP_LEVEL_HEADINGS = {
  open: 'Open Tasks',
  checklist: 'Checklist Items',
  scheduled: 'Scheduled Tasks',
  checklistScheduled: 'Scheduled Checklist Items',
  done: 'Completed Tasks',
  checklistDone: 'Completed Checklist Items',
  cancelled: 'Cancelled Tasks',
  checklistCancelled: 'Completed Cancelled Items',
}

const ROOT = '__'

// Note: not currently using getOverdueTasks from taskHelpers (because if it's open, we are moving it)
// But the functions exist to look for open items with a date that is less than today
//

const SORT_ORDERS = [
  {
    sortFields: ['-priority', 'content'],
    name: 'By Priority (!!! and (A)) then by content',
  },
  {
    sortFields: ['-priority', 'due', 'content'],
    name: 'By Priority then by due date, then content',
  },
  {
    sortFields: ['mentions', '-priority', 'content'],
    name: 'By @Person in task, then by priority and content',
  },
  {
    sortFields: ['hashtags', '-priority', 'content'],
    name: 'By #tag in task, then by priority and content',
  },
  {
    sortFields: ['hashtags', 'mentions', '-priority'],
    name: 'By #tag in task, then by @Person & priority',
  },
  {
    sortFields: ['hashtags', 'mentions', 'date'],
    name: 'By #tag in task, then by @Person & Due date',
  },
  {
    sortFields: ['content', '-priority'],
    name: 'Alphabetical, then by priority',
  },
  {
    sortFields: ['due', 'hashtags', '-priority'],
    name: 'By Due Date, then by #tag & priority',
  },
  {
    sortFields: ['due', 'hashtags', '-priority'],
    name: 'By Due Date, then by @Person & priority',
  },
  {
    sortFields: ['due', '-priority', 'mentions'],
    name: 'By Due Date, then by priority & @Person',
  },
  {
    sortFields: ['due', '-priority'],
    name: 'By Due Date, then by priority',
  },
  {
    sortFields: [],
    name: 'Unsorted, bring to top in same order',
  },
]

/**
 * Common helper function to delete paragraphs from a note
 * @param {CoreNoteFields} note - The note to delete paragraphs from
 * @param {Array<TParagraph>} tasksToDelete - Array of paragraph objects to delete
 * @param {string} functionName - Name of the calling function for logging
 */
/**
 * Delete existing tasks from note when input is an array of SortableParagraphSubset objects
 * @param {CoreNoteFields} note - The note to delete tasks from
 * @param {Array<SortableParagraphSubset>} tasks - Array of SortableParagraphSubset objects
 */
async function deleteExistingTasksFromSortable(note: CoreNoteFields, tasks: Array<SortableParagraphSubset>): Promise<void> {
  const tasksToDelete = []

  // Extract paragraph objects from SortableParagraphSubset
  tasks.forEach((task) => {
    if (task.paragraph) {
      tasksToDelete.push(task.paragraph)
    }

    // Also include children if they exist
    if (task.children && task.children.length) {
      task.children.forEach((child) => {
        if (child.paragraph) {
          tasksToDelete.push(child.paragraph)
        }
      })
    }
  })

  // Use the common deletion logic
  await deleteParagraphsFromNote(note, tasksToDelete, 'deleteExistingTasksFromSortable')
}

async function deleteParagraphsFromNote(note: CoreNoteFields, tasksToDelete: Array<TParagraph>, functionName: string): Promise<void> {
  // Sort by lineIndex in descending order to avoid index shifting issues
  const sortedTasks = tasksToDelete.sort((a, b) => b.lineIndex - a.lineIndex)

  logDebug(pluginJson, `${functionName}: Deleting ${sortedTasks.length} tasks from note`)

  // Set Editor flags to avoid UI updates during bulk deletion
  if (Editor.beginEdits) {
    Editor.beginEdits()
  }

  try {
    // Delete each task
    for (const task of sortedTasks) {
      if (note.removeParagraph) {
        note.removeParagraph(task)
      }
    }
  } finally {
    // Always end edits, even if there was an error
    if (Editor.endEdits) {
      Editor.endEdits()
    }
  }
}

/**
 * @param {string} heading The text that goes above the tasks. Should have a \n at the end.
 * @param {string} separator The line that goes beneath the tasks. Should have a \n at the end.
 */
export async function openTasksToTop(
  _heading: string = '## Open Tasks:',
  _separator: string = '---',
  includeChecklists: boolean = false,
  includeContextAndChildContext: boolean = false,
  noteOverride: TNote | null = null,
) {
  await saveEditorIfNecessary()
  const heading = _heading ? `${_heading}\n` : ''
  const separator = _separator ? `${_separator}\n` : ''
  logDebug(`openTasksToTop(): Bringing open tasks to top with params: heading="${heading}", separator="${separator}", includeChecklists="${String(includeChecklists)}"`)
  const noteToUse = noteOverride || Editor.note
  if (!noteToUse) {
    logError(pluginJson, `sortTasks openTasksToTop: There is no noteToUse. Bailing`)
    return
  }
  const tasksByType = getTasksByType(noteToUse.paragraphs)
  const activeParagraphs = { open: [...tasksByType['open'], ...(includeChecklists ? tasksByType['checklist'] : [])] }
  const numParas = activeParagraphs.open.length
  clo(activeParagraphs, `openTasksToTop activeParagraphs:${numParas}  ${includeChecklists ? ' including checklists' : ''}`)

  if (activeParagraphs.open.length) {
    const sortedParas = sortListBy(activeParagraphs.open, ['lineIndex'])
    await deleteExistingTasksFromSortable(noteToUse, sortedParas)
    logDebug(`tasksToTop temp deleted ${numParas} paragraphs; will now insert them at the top`)

    // Build rawContent based on includeContextAndChildContext setting
    const rawContent = []
    activeParagraphs.open.forEach((taskPara) => {
      if (includeContextAndChildContext) {
        // Move full context: heading + task + all children
        if (taskPara.heading && taskPara.heading !== '@<none>:') {
          rawContent.push(`### ${taskPara.heading.replace(':', '')}`)
        }
        rawContent.push(taskPara.raw)

        // Add all children content (not just tasks)
        if (taskPara.children && taskPara.children.length) {
          taskPara.children.forEach((child) => {
            rawContent.push(child.raw)
          })
        }
      } else {
        // Default: move all open tasks (parents + children) but no headings or non-task content
        rawContent.push(taskPara.raw)

        // Add child tasks (but not other content like notes, quotes)
        if (taskPara.children && taskPara.children.length) {
          taskPara.children.forEach((child) => {
            // Only include child tasks that match the same criteria as parent tasks
            const isOpenTask = child.type === 'open' || child.type === 'scheduled'
            const isChecklistTask = child.type === 'checklist' && includeChecklists

            if (isOpenTask || isChecklistTask) {
              rawContent.push(child.raw)
            }
            // Note: Excluding 'done', 'cancelled', and checklist types (unless includeChecklists is true)
          })
        }
      }
    })

    clo(rawContent, `tasksToTop: rawContent for insertion`)
    noteToUse.prependParagraph(heading.concat(rawContent.join('\n')).concat(`\n${separator}`), 'text')
  }
}

/**
 * @description Bring tasks (tasks only, no surrounding text) to top of note
 * @returns {Promise<void>}
 */
export async function tasksToTop() {
  try {
    logDebug(`tasksToTop(): Bringing tasks to top`)
    await sortTasks(false, [], null, null, false, null)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function sortTasksByPerson() {
  try {
    await saveEditorIfNecessary()
    const { includeHeading, includeSubHeading } = DataStore.settings
    await sortTasks(false, ['mentions', '-priority', 'content'], includeHeading, includeSubHeading, false, null)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function sortTasksByDue() {
  try {
    await saveEditorIfNecessary()
    const { includeHeading, includeSubHeading } = DataStore.settings
    await sortTasks(false, ['due', '-priority', 'content'], includeHeading, includeSubHeading, false, null)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function sortTasksByTag() {
  try {
    await saveEditorIfNecessary()
    const { includeHeading, includeSubHeading } = DataStore.settings
    await sortTasks(false, ['hashtags', '-priority', 'content'], includeHeading, includeSubHeading, false, null)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function sortTasksDefault() {
  try {
    await saveEditorIfNecessary()
    const { defaultSort1, defaultSort2, defaultSort3, includeHeading, includeSubHeading } = DataStore.settings
    logDebug(
      `sortTasksDefault(): defaultSort1=${defaultSort1}, defaultSort2=${defaultSort2}, defaultSort3=${defaultSort3}, includeHeading=${includeHeading}, includeSubHeading=${includeSubHeading}\nCalling sortTasks now`,
    )
    await sortTasks(false, [defaultSort1, defaultSort2, defaultSort3], includeHeading, includeSubHeading, false, null)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function sortTasksTagMention() {
  try {
    await saveEditorIfNecessary()
    const { includeHeading, includeSubHeading } = DataStore.settings
    await sortTasks(false, ['hashtags', 'mentions'], includeHeading, includeSubHeading, false, null)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

const DEFAULT_SORT_INDEX = 0

/**
 *
 * @param {TNote} note
 * @param {array} todos // @jgclark comment: needs type not just array. Perhaps Array<TParagraph> ?
 * @param {string} heading
 * @param {string} separator
 * @param {string} subHeadingCategory
 * @return {number} next line number
 */
function insertTodos(
  note: CoreNoteFields,
  todos: Array<any>,
  heading: string = '',
  separator: string = '',
  subHeadingCategory: string | null = null,
  theTitle: string = '',
  forceTasksToTop: boolean = false,
  insertAtTopOfNote: boolean = false,
) {
  const title = theTitle === ROOT ? '' : theTitle // root level tasks in Calendar note have no heading
  const { tasksToTop } = DataStore.settings
  // Use forceTasksToTop if provided, otherwise use the setting
  const shouldInsertAtTop = forceTasksToTop || tasksToTop
  // THE API IS SUPER SLOW TO INSERT TASKS ONE BY ONE
  // SO INSTEAD, JUST PASTE THEM ALL IN ONE BIG STRING
  logDebug(`\tInsertTodos: subHeadingCategory=${String(subHeadingCategory)} typeof=${typeof subHeadingCategory} ${todos.length} todos`)
  let todossubHeadingCategory = []
  const headingStr = heading ? `${heading}\n` : ''
  if (heading) {
    logDebug(`\tInsertTodos: heading=${heading}`)
    removeHeadingFromNote(note, heading, true)
  }

  if (subHeadingCategory) {
    const leadingDigit = {
      hashtags: '#',
      mentions: '@',
      priority: '',
      content: '',
      due: '',
    }
    let lastSubcat = ''
    for (const lineIndex in todos) {
      const shcZero = todos[lineIndex][subHeadingCategory][0] ?? `<none>`
      // logDebug(`InsertTodos: shcZero=${shcZero} typeof=${typeof shcZero} todos[lineIndex][subHeadingCategory]=${todos[lineIndex][subHeadingCategory]}`)
      const subCat =
        /* $FlowIgnore - complaining about -priority being missing. */
        (leadingDigit[subHeadingCategory] ? leadingDigit[subHeadingCategory] : '') + shcZero || todos[lineIndex][subHeadingCategory] || ''
      // logDebug(
      //   `lastSubcat[${subHeadingCategory}]=${subCat} check: ${JSON.stringify(
      //     todos[lineIndex],
      //   )}`,
      // )
      if (lastSubcat !== subCat) {
        lastSubcat = subCat
        // logDebug(pluginJson, `insertTodos subCat:"${subCat}" typeof=${typeof subCat} length=${subCat.length}`)

        const headingStr = `#### ${subCat}:`
        todossubHeadingCategory.push({ raw: `\n${headingStr}` })
        // delete the former version of this subheading
        removeHeadingFromNote(note, subCat)
      }
      todossubHeadingCategory.push(todos[lineIndex])
    }
  } else {
    todossubHeadingCategory = todos
  }

  const contentStr = todossubHeadingCategory
    .map((t) => {
      let str = t.raw
      if (t.children && t.children.length) {
        //TODO: sort 2nd level also indented tasks
        str += `\n${t.children.map((c) => c.raw).join('\n')}`
      }
      return str
    })
    .join(`\n`)
  // logDebug(`Inserting tasks into Editor:\n${contentStr}`)
  // logDebug(`inserting tasks: \n${JSON.stringify(todossubHeadingCategory)}`)
  const content = `${headingStr}${contentStr}${separator ? `\n${separator}` : ''}`
  if (title !== '') {
    // const headingIndex = findHeading(note, title)?.lineIndex || 0
    logDebug(`\tinsertTodos`, `shouldInsertAtTop=${shouldInsertAtTop} title="${title}"`)

    // Check if this is a traditional note with a single # heading or frontmatter-only note
    const firstPara = note.paragraphs[0]
    const hasTraditionalTitle = firstPara && firstPara.type === 'title' && firstPara.headingLevel === 1
    const hasFrontmatterTitle = note.frontmatterAttributes && note.frontmatterAttributes.title

    logDebug(
      `\tinsertTodos: hasTraditionalTitle=${hasTraditionalTitle}, hasFrontmatterTitle=${hasFrontmatterTitle}, firstPara.type="${firstPara?.type}", firstPara.headingLevel=${firstPara?.headingLevel}, title="${title}"`,
    )

    if (insertAtTopOfNote && shouldInsertAtTop) {
      // Special case: insert at top of note (after main title) regardless of the title parameter
      logDebug(`\tinsertTodos: insertAtTopOfNote=true, inserting at top of note`)
      if (hasTraditionalTitle) {
        // Insert below the note's main title
        logDebug(`\tinsertTodos: Inserting below note's main title="${firstPara.content}"`)
        note.addParagraphBelowHeadingTitle(content, 'text', firstPara.content, false, true)
        logDebug(`\tinsertTodos: Completed addParagraphBelowHeadingTitle`)
      } else {
        // Insert at top of active part (frontmatter-only note)
        logDebug(`\tinsertTodos: No traditional title, inserting at top of active part`)
        const insertionIndex = findStartOfActivePartOfNote(note)
        note.insertParagraph(content, insertionIndex, 'text')
      }
    } else {
      // Normal behavior: insert under the specified title/heading
      if (shouldInsertAtTop) {
        // Insert below the specified heading
        logDebug(`\tinsertTodos: Inserting below specified heading="${title}"`)
        note.addParagraphBelowHeadingTitle(content, 'text', title, false, true)
        logDebug(`\tinsertTodos: Completed addParagraphBelowHeadingTitle`)
      } else {
        // Insert at end of the specified heading section
        const paras = getBlockUnderHeading(note, title)
        const lastPara = paras[paras.length - 1]
        const insertFunc = lastPara.type === 'separator' ? `insertTodoBeforeParagraph` : `insertParagraphAfterParagraph`
        logDebug(`\tinsertTodos note.${insertFunc} "${lastPara.content}"`)
        // $FlowIgnore - calling function by name is not very Flow friendly (but it works!)
        note[insertFunc](content, lastPara)
      }
    }
  } else {
    const insertionIndex = shouldInsertAtTop ? findStartOfActivePartOfNote(note) : findEndOfActivePartOfNote(note) + 1
    note.insertParagraph(content, insertionIndex, 'text')
  }
  // logDebug(`\tinsertTodos finished`)
}

/**
 *  @param {Array<TParagraph>} paragraphs to sort
 *  @param {Array<string>} sortOrder - sort fields order  (see below)
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
 *  @return the object sorted list of the tasks from the note (keys are task types)
 */
/**
 * Define which task types should be interleaved together when interleaveTaskTypes is true
 * Each group contains task types that should be sorted together as one unit
 * @returns {Array<{types: Array<string>, name: string}>} Array of groups with their task types
 */
function getInterleavedTaskGroups(): Array<{ types: Array<string>, name: string }> {
  return [
    {
      name: 'Active Tasks',
      types: ['open', 'checklist', 'scheduled', 'checklistScheduled'],
    },
    {
      name: 'Completed Tasks',
      types: ['done', 'checklistDone'],
    },
    {
      name: 'Cancelled Tasks',
      types: ['cancelled', 'checklistCancelled'],
    },
  ]
}

export function sortParagraphsByType(
  paragraphs: $ReadOnlyArray<TParagraph>,
  sortOrder: Array<string> = SORT_ORDERS[DEFAULT_SORT_INDEX].sortFields,
  interleaveTaskTypes: boolean = true,
): ParagraphsGroupedByType {
  // $FlowFixMe
  const sortedList: ParagraphsGroupedByType = {}
  for (const ty of TASK_TYPES) {
    sortedList[ty] = []
  }
  logDebug(`\tInitialized sortedList with keys: ${Object.keys(sortedList).join(', ')}`)
  if (paragraphs?.length) {
    logDebug(`\tsortParagraphsByType: ${paragraphs.length} total lines in section/note, interleaveTaskTypes: ${interleaveTaskTypes}`)
    if (paragraphs.length) {
      const taskList = getTasksByType(paragraphs)
      logDebug(`\tOpen Tasks:${taskList.open.length}, Checklist Tasks:${taskList.checklist.length}`)

      if (interleaveTaskTypes) {
        // Interleaved sorting: prioritize open tasks over checklists within same priority
        const interleavedGroups = getInterleavedTaskGroups()
        for (const group of interleavedGroups) {
          const combinedTasks = []
          // Combine all task types in this group
          for (const taskType of group.types) {
            if (taskList[taskType] && taskList[taskType].length) {
              combinedTasks.push(...taskList[taskType])
            }
          }

          // Custom sort: priority first, then open tasks before checklists within same priority
          const sortedCombined = combinedTasks.sort((a, b) => {
            // First sort by priority (highest to lowest)
            const priorityDiff = (b.priority || -1) - (a.priority || -1)
            if (priorityDiff !== 0) return priorityDiff

            // Within same priority, open tasks come before checklists
            const aIsOpen = a.type === 'open' || a.type === 'scheduled' || a.type === 'done' || a.type === 'cancelled'
            const bIsOpen = b.type === 'open' || b.type === 'scheduled' || b.type === 'done' || b.type === 'cancelled'

            if (aIsOpen && !bIsOpen) return -1 // a (open) comes before b (checklist)
            if (!aIsOpen && bIsOpen) return 1 // b (open) comes before a (checklist)

            // If both are same type, sort by content
            return a.content.localeCompare(b.content)
          })

          // For interleaved sorting, put all tasks in the first type of each group
          // This maintains the interleaved order while satisfying the output format
          const firstTypeInGroup = group.types[0]
          if (sortedList[firstTypeInGroup]) {
            sortedList[firstTypeInGroup].push(...sortedCombined)
          }
        }
      } else {
        // Traditional grouped sorting: sort each type separately
        logDebug(`\tTraditional sorting: sorting each type separately`)
        for (const ty of TASK_TYPES) {
          sortedList[ty] = sortListBy(taskList[ty], sortOrder)
          logDebug(`\tTraditional: ${ty} tasks: ${taskList[ty]?.length || 0} -> ${sortedList[ty]?.length || 0}`)
        }
      }

      logDebug(`\tAfter Sort - Open Tasks:${sortedList.open?.length || 0}, Checklist Tasks:${sortedList.checklist?.length || 0}`)
      logDebug(`\tAfter Sort - Scheduled Tasks:${sortedList.scheduled?.length || 0}, Done Tasks:${sortedList.done?.length || 0}`)
      if (interleaveTaskTypes) {
        logDebug(`\tInterleaved arrays: open=${JSON.stringify(sortedList.open?.map((t) => t.content) || [])}`)
        logDebug(`\tInterleaved arrays: checklist=${JSON.stringify(sortedList.checklist?.map((t) => t.content) || [])}`)
        logDebug(`\tInterleaved arrays: scheduled=${JSON.stringify(sortedList.scheduled?.map((t) => t.content) || [])}`)
        logDebug(`\tInterleaved arrays: done=${JSON.stringify(sortedList.done?.map((t) => t.content) || [])}`)
      }
    }
  } else {
    logDebug(`\tsortParagraphsByType: no paragraphs to sort`)
  }
  // logDebug(JSON.stringify(sortedList))
  return sortedList
}

async function getUserSort(sortChoices: Array<any> = SORT_ORDERS): Promise<Array<string>> {
  // logDebug(`\tgetUserSort(${JSON.stringify(sortChoices)}`)
  // [String] list of options, placeholder text, callback function with selection/
  const choice = await CommandBar.showOptions(
    sortChoices.map((a) => a.name),
    `Sort by type/status and then:`,
  )
  // logDebug(`\tgetUserSort returning ${JSON.stringify(sortChoices[choice.index].sortFields)}`)
  return sortChoices[choice.index].sortFields
}

// function findRawParagraph(note: TNote, content) {
//   if (content) {
//     const found = note.paragraphs.filter((p) => p.rawContent === content)
//     if (found && found.length > 1) {
//       logDebug(`** Found ${found.length} identical occurrences for "${content}". Deleting the first.`)
//     }
//     return found[0] || null
//   } else {
//     return null
//   }
// }
// async function saveBackup(taskList: Array<TParagraph>) {
//   const backupPath = `@Trash`
//   const backupTitle = `_Task-sort-backup`
//   const backupFilename = `${backupPath}/${backupTitle}.${DataStore.defaultFileExtension}`
//   logDebug(`\tBackup filename: ${backupFilename}`)
//   let notes = await DataStore.projectNoteByTitle(backupTitle, false, true)
//   logDebug(`\tGot note back: ${notes ? JSON.stringify(notes) : ''}`)
//   if (!notes || !notes.length) {
//     logDebug(`\tsaveBackup: no note named ${backupFilename}`)
//     const filename = await DataStore.newNote(`_Task-sort-backup`, `@Trash`)
//     // TODO: There's a bug in API where filename is not correct and the file is not in cache unless you open a command bar
//     // remove all this:
//     await CommandBar.showOptions(['OK'], `\tBacking up todos in @Trash/${backupTitle}`)
//     //
//     logDebug(`\tCreated ${filename ? filename : ''} for backups`)
//     notes = await DataStore.projectNoteByTitle(backupTitle, false, true)
//     // note = await DataStore.projectNoteByFilename(backupFilename)
//     logDebug(`\tbackup file contents:\n${notes ? JSON.stringify(notes) : ''}`)
//   }
//   if (notes && notes[0]) {
//     notes[0].insertParagraph(`---`, 2, 'text')
//     logDebug(`\tBACKUP Saved to ${backupTitle}`)
//     await insertTodos(notes[0], taskList)
//   }
// }

/**
 * Delete Tasks from the note
 * @param {TNote} note
 * @param {Array<TParagraph>} tasks
 */
async function deleteExistingTasks(note: CoreNoteFields, tasks: ParagraphsGroupedByType): Promise<void> {
  const tasksToDelete = []
  for (const typ of TASK_TYPES) {
    if (tasks[typ] && tasks[typ].length) {
      logDebug(`\tQueuing ${tasks[typ].length} ${typ} tasks for temporary deletion from note (so they can be re-inserted in the correct order)`)

      tasks[typ].forEach((taskPara) => {
        if (taskPara.paragraph) {
          tasksToDelete.push(taskPara.paragraph)
        }

        // Also include children if they exist
        if (taskPara.children && taskPara.children.length) {
          taskPara.children.forEach((child) => {
            if (child.paragraph) {
              tasksToDelete.push(child.paragraph)
            }
          })
        }
      })
    }
  }

  // Use the common deletion logic
  await deleteParagraphsFromNote(note, tasksToDelete, 'deleteExistingTasks')
}

/**
 * Simple function to add checklist types into the sort order array following the task type it corresponds to
 * @param {Array<string>} sortArray - the array of sort keys
 * @returns {Array<string>} the array in the same order with checklist types added
 */
export const addChecklistTypes = (sortArray: Array<string>): Array<string> => {
  const maps = { open: 'checklist', scheduled: 'checklistScheduled', done: 'checklistDone', cancelled: 'checklistCancelled' }
  // splice checklist types into the sortArray following the task type it corresponds to
  const origTypes = Object.keys(maps)
  origTypes.forEach((origType) => {
    const checklistType = maps[origType]
    if (checklistType) {
      const index = sortArray.indexOf(origType)
      if (index > -1) {
        sortArray.splice(index + 1, 0, checklistType)
      }
    }
  })
  return sortArray
}

/**
 * Write the tasks list back into the top of the document
 * @param {TNote} note
 * @param {ParagraphsGroupedByType} tasks
 * @param {boolean} drawSeparators
 * @param {boolean} withHeadings
 * @param {any|null|string} subHeadingCategory
 */
export async function writeOutTasks(
  note: CoreNoteFields,
  tasks: ParagraphsGroupedByType,
  drawSeparators: boolean = false,
  withHeadings: boolean = false,
  subHeadingCategory: any | null | string = null,
  title: string = '',
  interleaveTaskTypes: boolean = true,
  insertAtTopOfNote: boolean = false,
): Promise<void> {
  const { outputOrder, tasksToTop } = DataStore.settings

  if (interleaveTaskTypes) {
    // When interleaving, write tasks in logical groups but interleave within each group
    const allTasks = []

    // Group 1: Active tasks (open + checklist) - interleaved by priority
    const activeTypes = ['open', 'checklist']
    for (const taskType of activeTypes) {
      if (tasks[taskType] && tasks[taskType].length > 0) {
        allTasks.push(...tasks[taskType])
      }
    }

    // Group 2: Scheduled tasks (scheduled + checklistScheduled) - interleaved by priority
    const scheduledTypes = ['scheduled', 'checklistScheduled']
    for (const taskType of scheduledTypes) {
      if (tasks[taskType] && tasks[taskType].length > 0) {
        allTasks.push(...tasks[taskType])
      }
    }

    // Group 3: Completed tasks (done + checklistDone) - interleaved by priority
    const completedTypes = ['done', 'checklistDone']
    for (const taskType of completedTypes) {
      if (tasks[taskType] && tasks[taskType].length > 0) {
        allTasks.push(...tasks[taskType])
      }
    }

    // Group 4: Cancelled tasks (cancelled + checklistCancelled) - interleaved by priority
    const cancelledTypes = ['cancelled', 'checklistCancelled']
    for (const taskType of cancelledTypes) {
      if (tasks[taskType] && tasks[taskType].length > 0) {
        allTasks.push(...tasks[taskType])
      }
    }

    logDebug(pluginJson, `writeOutTasks (interleaved): combining ${allTasks.length} tasks into single array`)

    if (allTasks.length > 0) {
      try {
        await insertTodos(
          note,
          allTasks,
          '', // No headings when interleaving
          drawSeparators ? '---' : '',
          subHeadingCategory,
          title,
          true, // Force tasks to top when interleaving
          insertAtTopOfNote, // Pass through the insertAtTopOfNote parameter
        )
      } catch (e) {
        logError(pluginJson, JSON.stringify(e))
      }
    }
  } else {
    // Traditional approach: write each type separately
    let taskTypes = (outputOrder ?? 'open, scheduled, done, cancelled').split(',').map((t) => t.trim())
    taskTypes = addChecklistTypes(taskTypes)
    logDebug(pluginJson, `writeOutTasks taskTypes: ${taskTypes.toString()}`)

    const headings = TOP_LEVEL_HEADINGS

    // Traditional approach: write in reverse order if tasksToTop is enabled
    const writeSequence = tasksToTop ? taskTypes.slice().reverse() : taskTypes
    logDebug(`writeOutTasks: writing task types in ${tasksToTop ? 'reverse for lineIndex security' : 'order'} : ${writeSequence.toString()}`)

    for (let i = 0; i < writeSequence.length; i++) {
      const ty = writeSequence[i]
      if (tasks[ty]?.length) {
        logDebug(`\twriteOutTasks TASK_TYPE=${ty} -- ${tasks[ty].length} tasks -- withHeadings=${String(withHeadings)}`)
        try {
          note
            ? await insertTodos(
                note,
                tasks[ty],
                withHeadings ? `### ${headings[ty]}:` : '',
                drawSeparators ? `${i === tasks[ty].length - 1 ? '---' : ''}` : '',
                subHeadingCategory,
                title,
                false, // Use normal tasksToTop behavior
                insertAtTopOfNote, // Pass through the insertAtTopOfNote parameter
              )
            : null
        } catch (e) {
          logError(pluginJson, JSON.stringify(e))
        }
      }
    }
  }
}

async function wantHeadings() {
  return await chooseOption(
    `Include Task Type headings in the output?`,
    [
      { label: 'No', value: false },
      { label: 'Yes', value: true },
    ],
    true,
  )
}

async function wantSubHeadings() {
  return await chooseOption(
    `Include sort field subheadings in the output?`,
    [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
    true,
  )
}

async function sortInsideHeadings() {
  return await chooseOption(
    `Sort each heading's tasks individually?`,
    [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
    true,
  )
}

export function removeEmptyHeadings(note: CoreNoteFields) {
  const paras = note.paragraphs
  const updates = []
  const topLevelHeadings = Object.keys(TOP_LEVEL_HEADINGS).map((key) => TOP_LEVEL_HEADINGS[key])
  for (let i = 0; i < paras.length; i++) {
    const para = paras[i]
    const nextPara = i < paras.length - 1 ? paras[i + 1] : null
    // clo(para, `removeEmptyHeadings`)
    // logDebug(pluginJson, `${para.type} ${para.headingLevel} ${topLevelHeadings.indexOf(`${para.content.replace(':', '')}`)}`)
    if (para.type === 'title' && para.headingLevel === 3 && topLevelHeadings.indexOf(`${para.content.replace(':', '')}`) > -1) {
      if ((nextPara && nextPara.type === 'empty') || !nextPara) {
        updates.push(para)
        if (nextPara) {
          updates.push(nextPara)
          i++ //skip nextPara
        }
      }
    }
    if (para.type === 'title' && para.headingLevel === 4 && para.content[para.content.length - 1] === ':') {
      if ((nextPara && nextPara.type === 'empty') || !nextPara) {
        updates.push(para)
        if (nextPara) {
          updates.push(nextPara)
          i++ //skip nextPara
        }
      }
    }
  }
  if (updates.length) {
    // updates.map((u) => logDebug(pluginJson, `removeEmptyHeadings deleting spinster lineIndex[${u.lineIndex}] ${u.rawContent}`))
    // note.updateParagraphs(updates)
    note.removeParagraphs(updates)
  }
}

/**
 * If {stopAtDoneHeading} setting is set, then find just the paragraphs up to the first done/cancelled heading
 * @param {*} note - input note
 * @returns {$ReadOnlyArray<TParagraph>} - array of paragraphs
 */
export function getActiveParagraphs(note: CoreNoteFields): $ReadOnlyArray<TParagraph> {
  const { stopAtDoneHeading } = DataStore.settings
  return (stopAtDoneHeading ? note.paragraphs.filter((p) => p.lineIndex <= findEndOfActivePartOfNote(note)) : note?.paragraphs) || []
}

/**
 * Build an object list of tasks from the note filtered by task
 * @param {TNote} note
 */
export function getTasksByHeading(note: TNote): { [key: string]: $ReadOnlyArray<TParagraph> } {
  try {
    if (!note) return { __: [] }
    const paragraphs = getActiveParagraphs(note)
    const tasksObj = paragraphs.reduce(
      (acc: any, para) => {
        // logDebug(`getTasksByHeading`, `para.type=${para.type} para.heading="${para.heading}" para.content="${para.content}"`)
        if (para.type === 'title') {
          if (para.content.trim()) {
            acc[para.content.trim()] = []
          }
        } else {
          const headTrimmed = para.heading.trim()
          const head = headTrimmed.length ? headTrimmed : ROOT
          if (!acc.hasOwnProperty(head)) {
            logError(`getTasksByHeading`, `Could not find this paragraph's heading: para.heading="${para.heading}" para.content="${para.content}"`)
            acc[ROOT].push(para)
          }
          acc[head].push(para)
        }
        return acc
      },
      { [ROOT]: [] },
    ) // start with root heading
    return tasksObj
  } catch (e) {
    logError(pluginJson, JSP(e))
    return { [ROOT]: [] }
  }
}

/**
 * Sort tasks in Editor (main)
 * (Plugin entrypoint for /ts - Task Sort)
 * @param {boolean} withUserInput - whether to ask in CommandBar
 * @param {Array<string>} sortFields (see SORT_FIELDS description above)
 * @param {boolean} withHeadings - top level headings (e.g. "Open Tasks")
 * @param {boolean} subHeadingCategory - subheadings (e.g. for each tag)
 * @param {boolean} interleaveTaskTypes - whether to interleave task types (open/checklist together) or keep them separate
 * @param {boolean} sortInHeadings - whether to sort within each heading separately (true) or treat entire note as one unit (false)
 * @returns
 */
export async function sortTasks(
  _withUserInput: string | boolean = true,
  _sortFields: string | Array<string> = SORT_ORDERS[DEFAULT_SORT_INDEX].sortFields,
  _withHeadings: string | boolean | null = null,
  _subHeadingCategory: string | boolean | null = null,
  _interleaveTaskTypes: string | boolean = true,
  _sortInHeadings: string | boolean | null = null,
) {
  // Cast parameters to proper types
  const withUserInput = getBooleanValue(_withUserInput, true)
  const sortFields = getArrayValue(_sortFields, SORT_ORDERS[DEFAULT_SORT_INDEX].sortFields, ',')
  const withHeadings = _withHeadings === null ? null : getBooleanValue(_withHeadings, false)
  const subHeadingCategory = _subHeadingCategory === null ? null : getBooleanValue(_subHeadingCategory, false)
  const interleaveTaskTypes = getBooleanValue(_interleaveTaskTypes, true)
  const sortInHeadingsOverride = _sortInHeadings === null ? null : getBooleanValue(_sortInHeadings, true)

  await saveEditorIfNecessary()
  logDebug(
    pluginJson,
    `sortTasks: Starting sortTasks(withUserInput:${String(
      withUserInput,
    )} (typeof:${typeof withUserInput}), sortFields:${sortFields.toString()} (typeof:${typeof sortFields}), withHeadings:${String(
      withHeadings,
    )} (typeof:${typeof withHeadings}), subHeadingCategory:${String(subHeadingCategory)} (typeof:${typeof subHeadingCategory}), interleaveTaskTypes:${String(
      interleaveTaskTypes,
    )} (typeof:${typeof interleaveTaskTypes}))`,
  )

  const { eliminateSpinsters, sortInHeadings, includeSubHeading } = DataStore.settings

  // Use override parameter if provided, otherwise use DataStore setting or prompt user
  const byHeading = withUserInput ? await sortInsideHeadings() : sortInHeadingsOverride !== null ? sortInHeadingsOverride : sortInHeadings

  logDebug(
    `\n\nStarting sortTasks(withUserInput:${String(withUserInput)}, default sortFields:${JSON.stringify(sortFields)}, withHeadings:${String(withHeadings)}, byHeading:${String(
      byHeading,
    )}):`,
  )
  const sortOrder = withUserInput ? await getUserSort() : sortFields
  logDebug(`\tsortTasks: User chose sort=${JSON.stringify(sortOrder)}`)
  // logDebug(`\tFinished getUserSort, now running wantHeadings`)

  const printHeadings = withHeadings === null ? await wantHeadings() : withHeadings
  // logDebug(`\tFinished wantHeadings()=${String(printHeadings)}, now running wantSubHeadings`)
  let printSubHeadings = true //by default in case you're not sorting
  let sortField1 = ''
  if (sortOrder.length) {
    sortField1 = sortOrder[0][0] === '-' ? sortOrder[0].substring(1) : sortOrder[0]
    printSubHeadings =
      includeSubHeading === false ? false : ['hashtags', 'mentions'].indexOf(sortField1) !== -1 ? (subHeadingCategory === null ? await wantSubHeadings() : true) : false
    logDebug(`\tsubHeadingCategory=${String(subHeadingCategory)} printSubHeadings=${String(printSubHeadings)}  cat=${printSubHeadings ? sortField1 : 'none'}`)
  }
  // logDebug(`\tFinished wantSubHeadings()=${String(printSubHeadings)}, now running sortParagraphsByType`)
  if (!Editor.note) {
    logError(pluginJson, `sortTasks: There is no Editor.note. Bailing`)
    clo(Editor, `sortTasks Editor`)
    return // doing this to make Flow happy
  }
  logDebug(pluginJson, `sortTasks about to get sortGroups object`)
  const activeParagraphs = Editor.note ? getActiveParagraphs(Editor.note) : []
  const sortGroups = byHeading && Editor?.note?.title ? getTasksByHeading(Editor.note) : { [Editor?.note?.title || '']: activeParagraphs }
  clo(sortGroups, `sortTasks -- sortGroups obj=`)
  logDebug(pluginJson, `sortTasks have sortGroups object. key count=${Object.keys(sortGroups).length}. About to start the display loop`)

  for (const key in sortGroups) {
    logDebug(`sortTasks: heading Group title="${key}" (${sortGroups[key].length} paragraphs)`)
    if (sortGroups[key].length) {
      clo(sortGroups[key], `sortTasks sortGroups[${key}] before sortParagraphsByType with sortOrder=${typeof sortOrder === 'string' ? sortOrder : JSON.stringify(sortOrder)}`)
      logDebug(`sortTasks: ----------------------------------------------`)
      // TODO: think about how to have a "type" sort field that can be used as a sort key
      // so instead of tasks by type all being separate, they could be grouped together and sorted by the "type" sort field
      const sortedTasks = sortParagraphsByType(sortGroups[key], sortOrder, interleaveTaskTypes)
      clo(sortedTasks, `sortTasks sortedTasks after sortParagraphsByType ${key}`)
      if (Editor.note) await deleteExistingTasks(Editor.note, sortedTasks) // need to do this before adding new lines to preserve line numbers
      if (Editor.note) await writeOutTasks(Editor.note, sortedTasks, false, printHeadings, printSubHeadings ? sortField1 : '', key, interleaveTaskTypes, !byHeading)
    }
  }

  logDebug(`\tFinished writeOutTasks, now finished`)
  if (eliminateSpinsters) {
    removeEmptyHeadings(Editor)
  }
  logDebug('Finished sortTasks()!')
}

/**
 * sortTasksUnderHeading
 * Plugin entrypoint for "/sth".
 * Can also be called from templates or other plugins.
 * @param {string} _heading - the heading to sort (probably comes in from xcallback)
 * @param {string} _sortOrder - the sort order (probably comes in from xcallback)
 * @param {boolean} _interleaveTaskTypes - whether to interleave task types (open/checklist together) or keep them separate
 */
export async function sortTasksUnderHeading(
  _heading: string | null,
  _sortOrder: string | Array<string> | null,
  _noteOverride: TNote | typeof Editor | null = null,
  _interleaveTaskTypes: string | boolean = true,
): Promise<void> {
  try {
    logDebug(`sortTasksUnderHeading: starting for heading="${_heading}" sortOrder="${String(_sortOrder)}" with note override? ${_noteOverride ? 'yes' : 'no'}`)
    logDebug(`sortTasksUnderHeading: About to saveEditorIfNecessary()`)
    await saveEditorIfNecessary()
    logDebug(`sortTasksUnderHeading: Back from saveEditorIfNecessary()`)
    const noteToUse = _noteOverride || Editor.note
    if (!noteToUse) {
      logError(pluginJson, `sortTasksUnderHeading: There is no noteToUse. Bailing`)
      await showMessage('No note is open')
      return
    }

    // Handle heading parameter - prompt user if null
    const heading = _heading || (await chooseHeading(noteToUse, false, false, false))

    // Handle sortOrder parameter - use type conversion if provided, otherwise prompt user
    let sortOrder: Array<string> = []
    // Use type conversion to handle string or array input
    sortOrder = getArrayValue(_sortOrder, null, ',')
    if (!_sortOrder) {
      // If null, prompt the user for sort order
      sortOrder = await getUserSort()
    }

    // Handle interleaveTaskTypes parameter
    const interleaveTaskTypes = getBooleanValue(_interleaveTaskTypes, true)
    logDebug(pluginJson, `sortTasksUnderHeading: about to get block under heading="${heading}" sortOrder="${String(sortOrder)}"`)

    if (heading && noteToUse) {
      const block = getBlockUnderHeading(noteToUse, heading)
      // clo(block, `sortTasksUnderHeading block`)
      if (block?.length) {
        // clo(sortOrder, `sortTasksUnderHeading sortOrder`)
        if (sortOrder) {
          const sortedTasks = sortParagraphsByType(block, sortOrder, interleaveTaskTypes)
          // clo(sortedTasks, `sortTasksUnderHeading sortedTasks`)
          // const printHeadings = (await wantHeadings()) || false
          // const printSubHeadings = (await wantSubHeadings()) || false
          // const sortField1 = sortOrder[0][0] === '-' ? sortOrder[0].substring(1) : sortOrder[0]
          if (noteToUse) await deleteExistingTasks(noteToUse, sortedTasks) // need to do this before adding new lines to preserve line numbers
          // if (noteToUse) await writeOutTasks(noteToUse, sortedTasks, false, printHeadings, printSubHeadings ? sortField1 : '', heading)
          if (noteToUse) await writeOutTasks(noteToUse, sortedTasks, false, false, '', heading, interleaveTaskTypes, false)
        }
      } else {
        await showMessage(`No tasks found under heading "${heading}"`)
      }
    } else {
      logError(pluginJson, `sortTasksUnderHeading: There is no noteToUse. Bailing`)
      await showMessage('No note is open')
    }
  } catch (error) {
    logError(pluginJson, JSON.stringify(error))
  }
}
