// @flow

import pluginJson from '../plugin.json'
import { chooseOption, chooseHeading, showMessage } from '@helpers/userInput'
import { getTagParamsFromString } from '@helpers/general'
import { removeHeadingFromNote, getBlockUnderHeading } from '@helpers/NPParagraph'
import { sortListBy, getTasksByType, TASK_TYPES, type ParagraphsGroupedByType } from '@helpers/sorting'
import { logDebug, logWarn, logError, clo, JSP } from '@helpers/dev'
import { findStartOfActivePartOfNote, findEndOfActivePartOfNote } from '@helpers/paragraph'
import { saveEditorIfNecessary } from '@helpers/editor'

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

//FIXME: need to finish this...
/**
 * This template/macro is going to headlessly sort all tasks in the note based on certain criteria.
 * e.g. {{sortTasks({withUserInput: false, withHeadings: true, subHeadingCategory: true, sortOrder: ['-priority', 'content'], })}}
 */
export async function sortTasksViaTemplate(paramStr: string = ''): Promise<void> {
  logDebug(`tasksortTasksViaTemplateToTop(): calling sortTasks`)
  await saveEditorIfNecessary()
  const withUserInput: boolean = await getTagParamsFromString(paramStr, 'withUserInput', true)
  const sortFields: string[] = await getTagParamsFromString(paramStr, 'sortFields', SORT_ORDERS[DEFAULT_SORT_INDEX].sortFields)
  const withHeadings: boolean = await getTagParamsFromString(paramStr, 'withHeadings', false)
  const subHeadingCategory: boolean = await getTagParamsFromString(paramStr, 'subHeadingCategory', false)
  await sortTasks(withUserInput, sortFields, withHeadings, subHeadingCategory)
}

/**
 * @description Bring tasks (tasks only, no surrounding text) to top of note
 * @returns {Promise<void>}
 */
export async function tasksToTop() {
  try {
    logDebug(`tasksToTop(): Bringing tasks to top`)
    await sortTasks(false, [])
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function sortTasksByPerson() {
  try {
    await saveEditorIfNecessary()
    const { includeHeading, includeSubHeading } = DataStore.settings
    await sortTasks(false, ['mentions', '-priority', 'content'], includeHeading, includeSubHeading)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function sortTasksByDue() {
  try {
    await saveEditorIfNecessary()
    const { includeHeading, includeSubHeading } = DataStore.settings
    await sortTasks(false, ['due', '-priority', 'content'], includeHeading, includeSubHeading)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function sortTasksByTag() {
  try {
    await saveEditorIfNecessary()
    const { includeHeading, includeSubHeading } = DataStore.settings
    await sortTasks(false, ['hashtags', '-priority', 'content'], includeHeading, includeSubHeading)
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
    await sortTasks(false, [defaultSort1, defaultSort2, defaultSort3], includeHeading, includeSubHeading)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function sortTasksTagMention() {
  try {
    await saveEditorIfNecessary()
    const { includeHeading, includeSubHeading } = DataStore.settings
    await sortTasks(false, ['hashtags', 'mentions'], includeHeading, includeSubHeading)
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
function insertTodos(note: CoreNoteFields, todos, heading: string = '', separator: string = '', subHeadingCategory: string = '', theTitle: string = '') {
  const title = theTitle === ROOT ? '' : theTitle // root level tasks in Calendar note have no heading
  const { tasksToTop } = DataStore.settings
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
    logDebug(`\tinsertTodos`, `tasksToTop=${tasksToTop} title="${title}"`)
    if (tasksToTop) {
      note.addParagraphBelowHeadingTitle(content, 'text', title, false, true)
    } else {
      const paras = getBlockUnderHeading(note, title)
      const lastPara = paras[paras.length - 1]
      const insertFunc = lastPara.type === 'separator' ? `insertTodoBeforeParagraph` : `insertParagraphAfterParagraph`
      logDebug(`\tinsertTodos note.${insertFunc} "${lastPara.content}"`)
      // $FlowIgnore - calling function by name is not very Flow friendly (but it works!)
      note[insertFunc](content, lastPara)
    }
  } else {
    const insertionIndex = tasksToTop ? findStartOfActivePartOfNote(note) : findEndOfActivePartOfNote(note) + 1
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
export function sortParagraphsByType(paragraphs: $ReadOnlyArray<TParagraph>, sortOrder: Array<string> = SORT_ORDERS[DEFAULT_SORT_INDEX].sortFields): ParagraphsGroupedByType {
  // $FlowFixMe
  const sortedList: ParagraphsGroupedByType = TASK_TYPES.reduce((acc, ty) => (acc[ty] = []), {})
  if (paragraphs?.length) {
    logDebug(`\t${paragraphs.length} total lines in section/note`)
    if (paragraphs.length) {
      const taskList = getTasksByType(paragraphs)
      logDebug(`\tOpen Tasks:${taskList.open.length}`)
      for (const ty of TASK_TYPES) {
        sortedList[ty] = sortListBy(taskList[ty], sortOrder)
      }
      logDebug(`\tAfter Sort - Open Tasks:${sortedList.open?.length || 0}`)
    }
  } else {
    logDebug(`\tsortParagraphsByType: no paragraphs to sort`)
  }
  // logDebug(JSON.stringify(sortedList))
  return sortedList
}

async function getUserSort(sortChoices: Array<any> = SORT_ORDERS) {
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
function deleteExistingTasks(note: CoreNoteFields, tasks: ParagraphsGroupedByType) {
  const tasksToDelete = []
  for (const typ of TASK_TYPES) {
    if (tasks[typ].length) logDebug(`\tQueuing ${tasks[typ].length} ${typ} tasks for temporary deletion from note (so they can be re-inserted in the correct order)`)
    // if (shouldBackupTasks) {
    //   await saveBackup(tasks[typ])
    // }
    let tasksAndIndented = []
    tasks[typ].forEach((taskPara) => {
      tasksAndIndented = [...tasksAndIndented, taskPara]
      if (taskPara.children.length) {
        tasksAndIndented = [...tasksAndIndented, ...taskPara.children]
      }
    })
    // if (tasksAndIndented.length) logDebug(`tasksAndIndented=${tasksAndIndented.length}=${JSON.stringify(tasksAndIndented)}`)
    tasksAndIndented.forEach((t) => {
      // clo(t.paragraph, `deleteExistingTasks map t`)
      // $FlowFixMe
      // return findRawParagraph(note, t.raw || null)
      tasksToDelete.push(t.paragraph)
    })
    //$FlowIgnore
    // logDebug(`deletesForThisType.length=${deletesForThisType.length} \n${JSON.stringify(deletesForThisType)}`)
    // deletesForThisType.map(t=>logDebug(`Before: lineIndex:${t.lineIndex} content:${t.content}`))
    // logDebug(`Editor content before remove: ${Editor.content || ''}`)
    // $FlowFixMe
    // if (deletesForThisType && deletesForThisType.length) tasksToDelete.push(deletesForThisType)
    // Editor.paragraphs.map(t=>logDebug(`After: lineIndex:${t.lineIndex} content:${t.content}`))

    // logDebug(`Editor content after remove: ${Editor.content || ''}`)
  }
  if (tasksToDelete.length) {
    const beforeDeleteParas = note.paragraphs.length
    logDebug(`\tsortTasks/deleteExistingTasks`, `Before Sort Lines in Note:${beforeDeleteParas} | Lines to delete:${tasksToDelete.length}`)
    const tasksToDeleteByIndex = sortListBy(tasksToDelete, ['lineIndex']) //NP API may give wrong results if lineIndexes are not in ASC order
    logDebug(`\tsortTasks/deleteExistingTasks`, `After Sort Lines in Note:${note.paragraphs.length} | Lines to delete:${tasksToDelete.length}`)
    // clo(tasksToDelete, `\tsortTasks/deleteExistingTasks=`)
    // We are going to delete them one at a time, and so that the page does not get confused, we will delete them bottom to top
    const tasksToDeleteByIndexReverse = sortListBy(tasksToDelete, ['-lineIndex']) //NP API may give wrong results if lineIndexes are not in ASC order
    tasksToDeleteByIndexReverse.forEach((t) => {
      // $FlowIgnore
      if (note.note) {
        // we are in the editor
        Editor.skipNextRepeatDeletionCheck = true
      }
      note.removeParagraph(t)
    })
    logDebug(
      `\tsortTasks/deleteExistingTasks`,
      `After Remove Paragraphs, Lines in note:${note.paragraphs.length} ${
        beforeDeleteParas - tasksToDelete.length === note.paragraphs.length ? '-- OK (math lines up)' : '-- ERROR'
      }`,
    )
  }
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
): Promise<void> {
  const { outputOrder, tasksToTop } = DataStore.settings
  let taskTypes = (outputOrder ?? 'open, scheduled, done, cancelled').split(',').map((t) => t.trim())
  taskTypes = addChecklistTypes(taskTypes)
  logDebug(pluginJson, `writeOutTasks taskTypes: ${taskTypes.toString()}`)
  const headings = TOP_LEVEL_HEADINGS
  // need to write in reverse order if we are going to keep adding a top insertionIndex
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
            )
          : null
      } catch (e) {
        logError(pluginJson, JSON.stringify(e))
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
 * @returns
 */
export async function sortTasks(
  withUserInput: boolean = true,
  sortFields: Array<string> = SORT_ORDERS[DEFAULT_SORT_INDEX].sortFields,
  withHeadings: boolean | null = null,
  subHeadingCategory: boolean | null = null,
) {
  await saveEditorIfNecessary()
  const { eliminateSpinsters, sortInHeadings, includeSubHeading } = DataStore.settings

  const byHeading = withUserInput ? await sortInsideHeadings() : sortInHeadings

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
  // clo(sortGroups, `sortTasks -- sortGroups obj=`)
  logDebug(pluginJson, `sortTasks have sortGroups object. key count=${Object.keys(sortGroups).length}. About to start the display loop`)

  for (const key in sortGroups) {
    logDebug(`sortTasks: heading Group title="${key}" (${sortGroups[key].length} paragraphs)`)
    if (sortGroups[key].length) {
      const sortedTasks = sortParagraphsByType(sortGroups[key], sortOrder)
      if (Editor.note) deleteExistingTasks(Editor.note, sortedTasks) // need to do this before adding new lines to preserve line numbers
      // TODO: come back to this with new template fields
      if (Editor.note) await writeOutTasks(Editor.note, sortedTasks, false, printHeadings, printSubHeadings ? sortField1 : '', key)
    }
  }

  // const sortedTasks = sortParagraphsByType(Editor.paragraphs, sortOrder)
  // logDebug(`\tFinished sortParagraphsByType, now running deleteExistingTasks`)
  // logDebug(`\tFinished deleteExistingTasks, now running writeOutTasks`)

  // if (Editor) {
  //   if (printSubHeadings) {
  //     // TODO: come back to this with new template fields
  //     // await deleteParagraphsContainingString(Editor)
  //   }
  //   // if (Editor.note) await writeOutTasks(Editor.note, sortedTasks, false, printHeadings, printSubHeadings ? sortField1 : '')
  // }
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
 */
export async function sortTasksUnderHeading(_heading: string, _sortOrder: string | Array<string>, _noteOverride: TNote | Editor | null = null): Promise<void> {
  try {
    await saveEditorIfNecessary()
    const noteToUse = _noteOverride || Editor.note
    if (!noteToUse) {
      logError(pluginJson, `sortTasksUnderHeading: There is no noteToUse. Bailing`)
      await showMessage('No note is open')
      return
    }
    const heading = _heading || (await chooseHeading(noteToUse, false, false, false))
    let sortOrder: Array<string> = []
    if (typeof _sortOrder === 'object') {
      // if sortOrder is an array, then it's already in the correct format
      sortOrder = _sortOrder
    } else {
      // if sortOrder is a string, then it's a JSON string, so we need to parse it
      sortOrder = _sortOrder ? JSON.parse(_sortOrder) : await getUserSort()
    }
    logDebug(pluginJson, `sortTasksUnderHeading: starting for heading="${heading}" sortOrder="${String(sortOrder)}"`)

    if (heading && noteToUse) {
      const block = getBlockUnderHeading(noteToUse, heading)
      // clo(block, `sortTasksUnderHeading block`)
      if (block?.length) {
        // clo(sortOrder, `sortTasksUnderHeading sortOrder`)
        if (sortOrder) {
          const sortedTasks = sortParagraphsByType(block, sortOrder)
          // clo(sortedTasks, `sortTasksUnderHeading sortedTasks`)
          // const printHeadings = (await wantHeadings()) || false
          // const printSubHeadings = (await wantSubHeadings()) || false
          // const sortField1 = sortOrder[0][0] === '-' ? sortOrder[0].substring(1) : sortOrder[0]
          if (noteToUse) deleteExistingTasks(noteToUse, sortedTasks) // need to do this before adding new lines to preserve line numbers
          // if (noteToUse) await writeOutTasks(noteToUse, sortedTasks, false, printHeadings, printSubHeadings ? sortField1 : '', heading)
          if (noteToUse) await writeOutTasks(noteToUse, sortedTasks, false, false, '', heading)
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
