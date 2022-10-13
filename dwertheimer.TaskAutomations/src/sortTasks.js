// @flow

import pluginJson from '../plugin.json'
import { chooseOption } from '@helpers/userInput'
import { getTagParamsFromString } from '@helpers/general'
import { removeHeadingFromNote, getBlockUnderHeading } from '@helpers/NPParagraph'
import { sortListBy, getTasksByType, TASK_TYPES, type ParagraphsGroupedByType } from '@helpers/sorting'
import { logDebug, logError, clo, JSP } from '@helpers/dev'
import { findStartOfActivePartOfNote, findEndOfActivePartOfNote } from '@helpers/paragraph'

const TOP_LEVEL_HEADINGS = {
  open: 'Open Tasks',
  scheduled: 'Scheduled Tasks',
  done: 'Completed Tasks',
  cancelled: 'Cancelled Tasks',
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
export function openTasksToTop(heading: string = '## Tasks:\n', separator: string = '---\n') {
  if (Editor.note == null) {
    return // if no note, stop. Should resolve 2 flow errors below, but doesn't :-(
  }
  logDebug(`openTasksToTop(): Bringing open tasks to top`)
  //FIXME: need to make this work now that nmn.sweep is gone
  // MAYBE ADD A QUESTION IN THE FLOW FOR WHICH TASKS TO MOVE

  const sweptTasks = { msg: '', status: '', taskArray: [], tasks: 0 }
  // if (Editor.type === 'Calendar') {
  //   if (Editor.note) sweptTasks = await sweepNote(Editor.note, false, true, false, false, true, false, 'move')
  // } else {
  //   if (Editor.note) sweptTasks = await sweepNote(Editor.note, false, true, false, true, true, false, 'move')
  // }
  if (sweptTasks) logDebug(`openTasksToTop(): ${sweptTasks?.taskArray?.length || 0} open tasks:`)
  // logDebug(JSON.stringify(sweptTasks))
  if (sweptTasks.taskArray?.length) {
    if (sweptTasks.taskArray[0].content === Editor.title) {
      sweptTasks.taskArray.shift()
    }
    Editor.prependParagraph(heading.concat((sweptTasks.taskArray ?? []).map((m) => m.rawContent).join('\n')).concat(`\n${separator}`), 'text')
  }
}

//FIXME: need to finish this...
/**
 * This template/macro is going to headlessly sort all tasks in the note based on certain criteria.
 * e.g. {{sortTasks({withUserInput: false, withHeadings: true, withSubHeadings: true, sortOrder: ['-priority', 'content'], })}}
 */
export async function sortTasksViaTemplate(paramStr: string = ''): Promise<void> {
  logDebug(`tasksortTasksViaTemplateToTop(): calling sortTasks`)
  const withUserInput: boolean = await getTagParamsFromString(paramStr, 'withUserInput', true)
  const sortFields: string[] = await getTagParamsFromString(paramStr, 'sortFields', SORT_ORDERS[DEFAULT_SORT_INDEX].sortFields)
  const withHeadings: boolean = await getTagParamsFromString(paramStr, 'withHeadings', false)
  const withSubHeadings: boolean = await getTagParamsFromString(paramStr, 'withSubHeadings', false)
  await sortTasks(withUserInput, sortFields, withHeadings, withSubHeadings)
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
    const { includeHeading, includeSubHeading } = DataStore.settings
    await sortTasks(false, ['mentions', '-priority', 'content'], includeHeading, includeSubHeading)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function sortTasksByDue() {
  try {
    const { includeHeading, includeSubHeading } = DataStore.settings
    await sortTasks(false, ['due', '-priority', 'content'], includeHeading, includeSubHeading)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function sortTasksByTag() {
  try {
    const { includeHeading, includeSubHeading } = DataStore.settings
    await sortTasks(false, ['hashtags', '-priority', 'content'], includeHeading, includeSubHeading)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function sortTasksDefault() {
  try {
    const { defaultSort1, defaultSort2, defaultSort3, includeHeading, includeSubHeading } = DataStore.settings
    await sortTasks(false, [defaultSort1, defaultSort2, defaultSort3], includeHeading, includeSubHeading)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function sortTasksTagMention() {
  try {
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
function insertTodos(note: CoreNoteFields, todos, heading = '', separator = '', subHeadingCategory = '', theTitle: string = '') {
  const title = theTitle === ROOT ? '' : theTitle // root level tasks in Calendar note have no heading
  const { tasksToTop } = DataStore.settings
  // THE API IS SUPER SLOW TO INSERT TASKS ONE BY ONE
  // SO INSTEAD, JUST PASTE THEM ALL IN ONE BIG STRING
  logDebug(`\tInsertTodos: subHeadingCategory=${String(subHeadingCategory)} typeof=${typeof subHeadingCategory} ${todos.length} todos`)
  let todosWithSubheadings = []
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
        todosWithSubheadings.push({ raw: `\n${headingStr}` })
        // delete the former version of this subheading
        removeHeadingFromNote(note, subCat)
      }
      todosWithSubheadings.push(todos[lineIndex])
    }
  } else {
    todosWithSubheadings = todos
  }

  const contentStr = todosWithSubheadings
    .map((t) => {
      let str = t.raw
      if (t.children && t.children.length) {
        str += `\n${t.children.map((c) => c.raw).join('\n')}`
      }
      return str
    })
    .join(`\n`)
  // logDebug(`Inserting tasks into Editor:\n${contentStr}`)
  // logDebug(`inserting tasks: \n${JSON.stringify(todosWithSubheadings)}`)
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
  const sortedList: ParagraphsGroupedByType = { open: [], done: [], cancelled: [], scheduled: [] }
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

async function getUserSort(sortChoices = SORT_ORDERS) {
  // logDebug(`\tgetUserSort(${JSON.stringify(sortChoices)}`)
  // [String] list of options, placeholder text, callback function with selection/
  const choice = await CommandBar.showOptions(
    sortChoices.map((a) => a.name),
    `Select sort order:`,
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
    if (tasks[typ].length) logDebug(`\tQueuing ${tasks[typ].length} ${typ} tasks for deletion from note`)
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
    note.removeParagraphs(tasksToDeleteByIndex)
    logDebug(
      `\tsortTasks/deleteExistingTasks`,
      `After Remove Paragraphs, Lines in note:${note.paragraphs.length} ${
        beforeDeleteParas - tasksToDelete.length === note.paragraphs.length ? '-- OK (math lines up)' : '-- ERROR'
      }`,
    )
  }
}

/**
 * Write the tasks list back into the top of the document
 * @param {TNote} note
 * @param {ParagraphsGroupedByType} tasks
 * @param {boolean} drawSeparators
 * @param {boolean} withHeadings
 * @param {any|null|string} withSubheadings // @jgclark comment: suggest change name to subHeadingCategory, as otherwise it sounds like a boolean
 */
export async function writeOutTasks(
  note: CoreNoteFields,
  tasks: ParagraphsGroupedByType,
  drawSeparators: boolean = false,
  withHeadings: boolean = false,
  withSubheadings: any | null | string = null,
  title: string = '',
): Promise<void> {
  const headings = TOP_LEVEL_HEADINGS
  const tasksTypesReverse = TASK_TYPES.slice().reverse()
  for (let i = 0; i < tasksTypesReverse.length; i++) {
    const ty = tasksTypesReverse[i]
    if (tasks[ty]?.length) {
      logDebug(`\twriteOutTasks TASK_TYPE=${ty} -- ${tasks[ty].length} tasks -- withHeadings=${String(withHeadings)}`)
      try {
        note
          ? await insertTodos(
              note,
              tasks[ty],
              withHeadings ? `### ${headings[ty]}:` : '',
              drawSeparators ? `${i === tasks[ty].length - 1 ? '---' : ''}` : '',
              withSubheadings,
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
 * Build an object list of tasks from the note filtered by task
 * @param {TNote} note
 */
export function getTasksByHeading(note: TNote): { [key: string]: $ReadOnlyArray<TParagraph> } {
  const paragraphs = note?.paragraphs || []
  try {
    const tasksObj = paragraphs.reduce(
      (acc: any, para) => {
        logDebug(`getTasksByHeading`, `para.type=${para.type} para.heading="${para.heading}" para.content="${para.content}"`)
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
 * Sort tasks (main)
 * (Plugin entrypoint for /ts - Task Sort)
 * @param {boolean} withUserInput - whether to ask in CommandBar
 * @param {Array<string>} sortFields (see SORT_FIELDS description above)
 * @param {boolean} withHeadings - top level headings (e.g. "Open Tasks")
 * @param {boolean} withSubHeadings - subheadings (e.g. for each tag)
 * @returns
 */
export async function sortTasks(
  withUserInput: boolean = true,
  sortFields: Array<string> = SORT_ORDERS[DEFAULT_SORT_INDEX].sortFields,
  withHeadings: boolean | null = null,
  withSubHeadings: boolean | null = null,
) {
  const { eliminateSpinsters, sortInHeadings } = DataStore.settings

  const byHeading = withUserInput ? await sortInsideHeadings() : sortInHeadings

  logDebug(
    `\n\nStarting sortTasks(withUserInput:${String(withUserInput)},default sortFields:${JSON.stringify(sortFields)},withHeadings:${String(withHeadings)},byHeading:${String(
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
    printSubHeadings = ['hashtags', 'mentions'].indexOf(sortField1) !== -1 ? (withSubHeadings === null ? await wantSubHeadings() : true) : false
    logDebug(`\twithSubHeadings=${String(withSubHeadings)} printSubHeadings=${String(printSubHeadings)}  cat=${printSubHeadings ? sortField1 : 'none'}`)
  }
  // logDebug(`\tFinished wantSubHeadings()=${String(printSubHeadings)}, now running sortParagraphsByType`)
  if (!Editor.note) {
    logError(pluginJson, `sortTasks: There is no Editor.note. Bailing`)
    clo(Editor, `sortTasks Editor`)
    return // doing this to make Flow happy
  }
  logDebug(pluginJson, `sortTasks about to get sortGroups object`)
  const sortGroups = byHeading && Editor?.note?.title ? getTasksByHeading(Editor.note) : { [Editor?.note?.title || '']: Editor?.note?.paragraphs }
  clo(sortGroups, `sortTasks -- sortGroups obj=`)
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
