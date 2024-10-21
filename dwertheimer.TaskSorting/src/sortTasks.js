// @flow
// Last updated 2024-07-13 for v1.1.1 by @jgclark

import pluginJson from '../plugin.json'
import { chooseOption, chooseHeading, showMessage } from '@helpers/userInput'
import { getTagParamsFromString } from '@helpers/general'
import { removeHeadingFromNote, getBlockUnderHeading } from '@helpers/NPParagraph'
import { sortListBy, getTasksByType, TASK_TYPES, type ParagraphsGroupedByType } from '@helpers/sorting'
import { logDebug, logError, clo, JSP } from '@helpers/dev'
import { findStartOfActivePartOfNote, findEndOfActivePartOfNote } from '@helpers/paragraph'

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

const DEFAULT_SORT_INDEX = 0

// --------------------------------------------------------------

/**
 * This is going to headlessly sort all tasks in the Editor based on certain criteria passed in.
 * i.e. entry point for Templates/x-callback/invokePluginCommand.
 * e.g. {{sortTasks({withUserInput: false, withHeadings: true, subHeadingCategory: true, sortOrder: ['-priority', 'content'], })}}
 * TODO: Extend to deal with notes other than Editor.
 * @param {string} paramStr
 */
export async function sortTasksViaExternalCall(paramStr: string = ''): Promise<void> {
  logDebug('sortTasksViaExternalCall', `Starting with paramStr '${paramStr}', and will call sortTasks()`)
  const withUserInput: boolean = await getTagParamsFromString(paramStr, 'withUserInput', true)
  const sortFields: string[] = await getTagParamsFromString(paramStr, 'sortFields', SORT_ORDERS[DEFAULT_SORT_INDEX].sortFields)
  const withHeadings: boolean = await getTagParamsFromString(paramStr, 'withHeadings', false)
  const subHeadingCategory: boolean = await getTagParamsFromString(paramStr, 'subHeadingCategory', false)
  await sortTasks(withUserInput, sortFields, withHeadings, subHeadingCategory)
  logDebug('sortTasksViaExternalCall', `finished`)
}

/**
 * Bring tasks (tasks only, no surrounding text) to top of note
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
    logDebug('sortTasksDefault', `startng sortTasksDefault()`)
    let settings = await DataStore.loadJSON("../dwertheimer.TaskSorting/settings.json")
    clo(settings)
    // const { defaultSort1, defaultSort2, defaultSort3, includeHeading, includeSubHeading } = settings
    const defaultSort1 = settings.defaultSort1
    const defaultSort2 = settings.defaultSort2
    const defaultSort3 = settings.defaultSort3
    const includeHeading = settings.includeHeading
    const includeSubHeading = settings.includeSubHeading
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
    const { includeHeading, includeSubHeading } = DataStore.settings
    await sortTasks(false, ['hashtags', 'mentions'], includeHeading, includeSubHeading)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Insert multiple tasks to the Editor, in a more efficient manner (as opposed to inserting them one by one).
 * @param {TNote} note
 * @param {array} todos // @jgclark comment: needs type not just array. Perhaps Array<TParagraph> ?
 * @param {string?} heading to remove from note TODO: is this really a thing?
 * @param {string?} separator
 * @param {string?} subHeadingCategory
 * @param {string?} theTitle of the note?
 * @param {boolean?} insertAtSectionStart? (default: true) Insert at start of active part of note, or else at end of active part.
 * @returns {number} next line number
 */
export function insertTodos(note: CoreNoteFields, todos, heading: string = '', separator: string = '', subHeadingCategory: string = '', theTitle: string = '', insertAtSectionStart: boolean = true): number {
  try {
    const title = theTitle === ROOT ? '' : theTitle // root level tasks in Calendar note have no heading
    // const { tasksToTop } = DataStore.settings // now coming from calling function, to avoid potentially wrong plugin settings
    // THE API IS SUPER SLOW TO INSERT TASKS ONE BY ONE
    // SO INSTEAD, JUST PASTE THEM ALL IN ONE BIG STRING
    logDebug(`\tInsertTodos: subHeadingCategory=${String(subHeadingCategory)} typeof=${typeof subHeadingCategory} ${todos.length} todos`)
    let todossubHeadingCategory = []
    const headingStr = heading ? `${heading}\n` : ''
    if (heading) {
      logDebug('InsertTodos', `\theading=${heading}`)
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
          (leadingDigit[subHeadingCategory] ? leadingDigit[subHeadingCategory] : '') + shcZero || todos[lineIndex][subHeadingCategory] || ''
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
      logDebug(`\tinsertTodos: insertAtSectionStart=${insertAtSectionStart} title="${title}"`)
      if (insertAtSectionStart) {
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
      const insertionIndex = insertAtSectionStart ? findStartOfActivePartOfNote(note) : findEndOfActivePartOfNote(note) + 1
      note.insertParagraph(content, insertionIndex, 'text')
    }
    logDebug(`\tinsertTodos finished`)
  }
  catch (error) {
    logError('InsertTodos', JSP(error))
  }
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

async function getUserSort(sortChoices = SORT_ORDERS) {
  // logDebug(`\tgetUserSort(${JSON.stringify(sortChoices)}`)
  // [String] list of options, placeholder text, callback function with selection/
  const choice = await CommandBar.showOptions(
    sortChoices.map((a) => a.name),
    `Sort by type/status and then:`,
  )
  // logDebug(`\tgetUserSort returning ${JSON.stringify(sortChoices[choice.index].sortFields)}`)
  return sortChoices[choice.index].sortFields
}
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
  const { outputOrder, insertAtSectionStart } = DataStore.settings
  let taskTypes = (outputOrder ?? 'open, scheduled, done, cancelled').split(',').map((t) => t.trim())
  taskTypes = addChecklistTypes(taskTypes)
  logDebug(pluginJson, `writeOutTasks taskTypes: ${taskTypes.toString()}`)
  const headings = TOP_LEVEL_HEADINGS
  // need to write in reverse order if we are going to keep adding a top insertionIndex
  const writeSequence = insertAtSectionStart ? taskTypes.slice().reverse() : taskTypes
  logDebug(`writeOutTasks: writing task types in ${insertAtSectionStart ? 'reverse for lineIndex security' : 'order'} : ${writeSequence.toString()}`)
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
            subHeadingCategory || '',
            title,
            insertAtSectionStart
            )
          : null
      } catch (e) {
        logError(pluginJson, JSON.stringify(e))
      }
    }
  }
}

async function wantHeadings(): boolean {
  return await chooseOption(
    `Include Task Type headings in the output?`,
    [
      { label: 'No', value: false },
      { label: 'Yes', value: true },
    ],
    true,
  )
}

async function wantSubHeadings(): boolean {
  return await chooseOption(
    `Include sort field subheadings in the output?`,
    [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
    true,
  )
}

async function sortInsideHeadings(): boolean {
  return await chooseOption(
    `Sort each heading's tasks individually?`,
    [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
    true,
  )
}

export function removeEmptyHeadings(note: CoreNoteFields): void {
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
    logInfo(pluginJson, `removeEmptyHeadings: deleting ${updates.length} empty heading paras`)
    note.removeParagraphs(updates)
  } else {
    logDebug(pluginJson, `removeEmptyHeadings: no empty heading paras to delete.`)
  }
}

/**
 * If {stopAtDoneHeading} setting is set, then find just the paragraphs up to the first done/cancelled heading.
 * WARNING: this didn't work for @jgclark in Oct 2024, returning all paras, not just those in active part.
 * @param {CoreNoteFields} note - input note
 * @returns {$ReadOnlyArray<TParagraph>} - array of paragraphs
 */
export function getActiveParagraphs(note: CoreNoteFields): $ReadOnlyArray<TParagraph> {
  const { stopAtDoneHeading } = DataStore.settings
  const endOfActive = findEndOfActivePartOfNote(note)
  return (stopAtDoneHeading ? note.paragraphs.filter((p) => p.lineIndex <= endOfActive) : note?.paragraphs) || []
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
  // const { eliminateSpinsters, sortInHeadings, includeSubHeading } = DataStore.settings
  let settings = await DataStore.loadJSON("../dwertheimer.TaskSorting/settings.json")
  const eliminateSpinsters = settings.includeSubHeading
  const sortInHeadings = settings.sortInHeadings
  const includeSubHeading = settings.includeSubHeading
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
    logDebug(`sortTasks: sortGroup heading/key="${key}" (${sortGroups[key].length} paragraphs)`)
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
 * Sort Tasks/Checklists Under a Heading in the Editor, either specified in the call, or ask the user.
 * Note: Plugin entrypoint for "/sth"
 * @param {string} headingIn
 */
export async function sortTasksUnderHeading(headingIn = '') {
  try {
    if (!Editor || !Editor.note) {
      logError('sortTasksUnderHeading', `sortTasksUnderHeading: There is no open Editor.note. Stopping.`)
      await showMessage('No note is open, so stopping.')
    }

    // Get heading from param or ask user
    const headingToUse = (headingIn !== '') ? headingIn : await chooseHeading(Editor?.note, false, false, false)
    if (!headingToUse) {
      logInfo('sortTasksUnderHeading', `No heading given, so stopping.`)
      await showMessage(`No heading given, so stopping.`)
    }

    // Sort tasks
    logDebug('sortTasksUnderHeading', `Will sort tasks under heading '${headingToUse}'`)
    const block = getBlockUnderHeading(Editor.note, headingToUse)
    if (block?.length) {
      // TODO: If a heading was given, then use user's defined default sort order instead of asking
      const sortOrder = await getUserSort()
      if (sortOrder) {
        const sortedTasks = sortParagraphsByType(block, sortOrder)
        clo(sortedTasks, `sortTasksUnderHeading sortedTasks`)
        deleteExistingTasks(Editor.note, sortedTasks) // need to do this before adding new lines to preserve line numbers
        await writeOutTasks(Editor.note, sortedTasks, false, false, '', headingToUse)
      }
    } else {
      logInfo('sortTasksUnderHeading', `No tasks found under heading "${heading}"`)
      await showMessage(`No tasks found under heading "${headingToUse}"`)
    }

  } catch (error) {
    logError(pluginJson, JSON.stringify(error))
  }
}
