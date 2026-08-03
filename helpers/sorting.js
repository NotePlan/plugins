// @flow

import get from 'lodash/get'
import { isScheduled } from './dateTime'
import { clo, logDebug, logError } from './dev'

export interface SortableParagraphSubset {
  content: string;
  index: number;
  raw: string;
  hashtags: Array<string>;
  mentions: Array<string>;
  exclamations: Array<string>;
  parensPriority: Array<string>;
  due: ?Date;
  heading: ?string;
  priority?: number;
  type?: string;
  filename: string;
  indents: number;
  children: Array<SortableParagraphSubset>;
  paragraph: ?TParagraph;
  calculatedType: ?string;
  blockId?: string;
  note?: TNote;
}

export type GroupedTasks = {
  open: Array<SortableParagraphSubset>,
  scheduled: Array<SortableParagraphSubset>,
  cancelled: Array<SortableParagraphSubset>,
  done: Array<SortableParagraphSubset>,
  checklist: Array<SortableParagraphSubset>,
  checklistDone: Array<SortableParagraphSubset>,
  checklistCancelled: Array<SortableParagraphSubset>,
  checklistScheduled: Array<SortableParagraphSubset> /*,
  title: Array<SortableParagraphSubset>,
  quote: Array<SortableParagraphSubset>,
  list: Array<SortableParagraphSubset>,
  empty: Array<SortableParagraphSubset>,
  text: Array<SortableParagraphSubset>,
  code: Array<SortableParagraphSubset>,
  separator: Array<SortableParagraphSubset>, */,
  // Indexer: callers iterate TASK_TYPES and index dynamically (`tasks[taskType]`).
  [string]: Array<SortableParagraphSubset>,
}

/** Sorted/grouped task buckets produced by TaskSorting (always SortableParagraphSubset elements). */
export type ParagraphsGroupedByType = GroupedTasks

const RE_HASHTAGS: RegExp = /\B#([a-zA-Z0-9\/]+\b)/g
const RE_MENTIONS: RegExp = /\B@([a-zA-Z0-9\/]+\b)/g
const RE_LEADING_EXCLAMATIONS: RegExp = /^\s*(!+)/g // at start of content, though allowing for leading whitespace (as NP does)
const RE_LEADING_PARENS_PRIORITY: RegExp = /^\s*\(([a-zA-z])\)\B/g // must be at start of content
export const TASK_TYPES: Array<string> = ['open', 'scheduled', 'done', 'cancelled', 'checklist', 'checklistDone', 'checklistCancelled', 'checklistScheduled']
export const isTask = (para: TParagraph): boolean => TASK_TYPES.indexOf(para.type) >= 0

/**
 * Multi-level object property sorting callback function (for use in sort())
 * Note: this will work for arrays of arrays (in addition to arrays of objects), in this case, send
 * the number of the array index to check as a string, e.g. "2" or "-2" will use the second element to sort on
 * undefined values are treated as the lowest value (i.e. sorted to the bottom)
 * @author @dwertheimer
 * @example const sortedHomes = homes.sort(fieldSorter(['state', '-price'])); //the - in front of name is DESC
 * @param {Array<string>} field list - property array, e.g. ['date', 'title']
 * @returns {Function} callback function for sort()
 */
export const fieldSorter =
  (fields: Array<string>): Function =>
  (a: string, b: string) =>
    fields
      .map((_field) => {
        let field = _field
        let dir = 1
        const isDesc = field[0] === '-'
        if (isDesc) {
          dir = -1
          field = field.substring(1)
        }
        // field = isNaN(field) ? field : Number(field)
        const aFirstValue = firstValue(get(a, field))
        const bFirstValue = firstValue(get(b, field))
        const aValue = aFirstValue == null ? null : isNaN(aFirstValue) ? aFirstValue : Number(aFirstValue)
        const bValue = bFirstValue == null ? null : isNaN(bFirstValue) ? bFirstValue : Number(bFirstValue)
        // if (field === "date") logDebug('', `${field}: ${String(aValue)} (${typeof aValue}) / ${String(bValue)} (${typeof bValue})`)
        if (aValue === bValue) return 0
        if (aValue == null || aValue === 'NaN') return isDesc ? -dir : dir //null or undefined always come last
        if (bValue == null || bValue === 'NaN') return isDesc ? dir : -dir
        // $FlowIgnore - flow complains about comparison of non-identical types, but I am trapping for that
        return typeof aValue === typeof bValue ? (aValue > bValue ? dir : -dir) : 0
      })
      .reduce((p, n) => (p ? p : n), 0)

/**
 * Modern case insensitive sorting function
 * More details at https://stackoverflow.com/a/49004987/3238281
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function caseInsensitiveCompare(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base' })
}

/**
 * Function to sort a list of object by an array of fields (of property names)
 * put a - in front of the field name to sort descending
 * Note: this will work for arrays of arrays (in addition to arrays of objects), in this case, send
 * the number of the array index to check as a string, e.g. "2" or "-2" will use the second element to sort on
 * @author @dwertheimer
 * @example const sortedHomes = sortListBy([{state:"CA",price:1000}],['state', '-price']); //the - in front of name is DESC
 * @param {Array<T>} list - items
 * @param {Array<string> | string} objectPropertySortOrder - field names to sort by -- either a single string or an array of strings/sort-order
 * @returns {Array<T>} the sorted task list
 */
export function sortListBy<T>(list: Array<T>, objectPropertySortOrder: Array<string> | string): Array<T> {
  const sortBy = typeof objectPropertySortOrder === 'string' ? [objectPropertySortOrder] : objectPropertySortOrder
  list.sort(fieldSorter(sortBy))
  return list
}

/**
 * Helper function for fieldSorter fields.
 * Sometimes you want to sort on the value of a field that is an array.
 * If the value is an array, return the first value from it.
 * If it's not an array, just return the value, and if it's a string, lowercase value.
 * @author @dwertheimer
 * @param {any} val
 * @returns {string | number}
 */
export const firstValue = (val: any): string | number => {
  let retVal = Array.isArray(val) ? val[0] : val
  if (retVal == null) {
    return retVal
  } else {
    retVal = typeof retVal === 'number' || (typeof retVal !== 'object' && !isNaN(retVal) && retVal !== '') ? Number(retVal) : retVal
    return typeof retVal === 'string' && retVal !== 'NaN' ? retVal.toLowerCase() : retVal
  }
}

/**
 * A general purpose function to get all the elements from a task that match a regex and return them as an array.
 * Generally useful for getting all the tags or mentions from a task.
 * @param {string} content
 * @param {RegExp} reSearch
 * @returns {Array<string>} - array of elements found matching the regex
 */
export function getElementsFromTask(content: string, reSearch: RegExp): Array<string> {
  const found = []
  let matches = reSearch.exec(content)

  do {
    if (matches !== null && matches.length > 1) {
      found.push(matches[1].trim())
    }
  } while ((matches = reSearch.exec(content)) !== null)
  return found
}

/*
 * Get numeric priority level based on !!! or (B)
 * (or 'working-on' support (W) => 4)
 * @author @dwertheimer extended by @jgclark
 * @param {SortableParagraphSubset} item
 * @returns {number} priority from 3, 2, 1, 4 for >>, 0 for not priority markers, or -1 (for error or empty item)
 * Note: -1 is a special value in Dashboard:
 * - Sentinel value: indicates "no priority set" or "no items found"
 * - Initialization: default for max priority calculations
 * - State management: used to detect when priority calculations are pending vs. complete
 */
export function getNumericPriority(item: SortableParagraphSubset): number {
  try {
    let prio = 0
    if (item.content === '') {
      prio = -1
    }
  if (item.exclamations[0]) {
    prio = item.exclamations[0].length
  } else if (item.parensPriority[0]) {
    prio = item.parensPriority[0].charCodeAt(0) - 'A'.charCodeAt(0) + 1
    if (prio === 23) prio = 4
  } else if (item.content.startsWith('>>')) {
    prio = 4
  }
    return prio
  } catch (error) {
    logError('getNumericPriority', `${error.message}: ${item.content}`)
    return -1
  }
}

/*
 * Get numeric priority level based on !!! or (B)
 * @author @jgclark wrapping @dwertheimer's work above
 * @param {TParagraph} input
 * @returns {number} priority from 3, 2, 1, -1 (default)
 */
export function getNumericPriorityFromPara(para: TParagraph): number {
  const item: SortableParagraphSubset = getSortableTask(para)
  return getNumericPriority(item)
}

export function addPriorityToParagraphs(paras: Array<TParagraph>): Array<any> {
  // Temporarily extend TParagraph with the task's priority
  for (let c = 0; c < paras.length; c++) {
    const thisPriority = getNumericPriorityFromPara(paras[c])
    // $FlowIgnore[prop-missing] - needed as we're extending TParagraph type
    paras[c].priority = thisPriority
  }
  return paras
}

/**
 * Scheduled tasks/checklists are not discernible from the 'type' property of the paragraph
 * (they both just appear to be open tasks). So we need to check the content to see if it's a scheduled task/checklist.)
 * @author @dwertheimer
 * @param {TParagraph} para
 * @returns - the type of the paragraph (the normal types + 'scheduled' and 'checklistScheduled')
 */
export function calculateParagraphType(para: TParagraph): string {
  let type = para.type
  if (type === 'open' && isScheduled(para.content)) type = 'scheduled'
  if (type === 'checklist' && isScheduled(para.content)) type = 'checklistScheduled'
  return type
}

/**
 * Take in a paragraph and return a sortable object with all the fields specified in the SortableParagraphSubset type
 * @param {TParagraph} para
 * @returns {SortableParagraphSubset} - a sortable object
 * @author @dwertheimer
 */
/**
 * Flatten a task's whole subtree into document order (depth-first, pre-order).
 * Use this anywhere that needs "this task and everything nested under it" -- e.g. collecting paragraphs to
 * delete before re-inserting, or rendering a task block back out. A one-level `task.children.forEach()` is
 * NOT sufficient now that nesting is tracked to arbitrary depth: it would silently miss grandchildren,
 * which on a delete/re-insert path leaves duplicates behind in the note.
 * @author @dwertheimer
 * @param {SortableParagraphSubset} task
 * @returns {Array<SortableParagraphSubset>} every descendant, not including `task` itself
 */
// Param is structural on purpose: this only ever reads `children`, and callers legitimately hold
// narrower shapes (e.g. the render loop in TaskSorting's insertTodos). Demanding a full
// SortableParagraphSubset here would reject them for fields the function never touches.
export function getAllDescendants(task: { +children?: $ReadOnlyArray<SortableParagraphSubset>, ... }): Array<SortableParagraphSubset> {
  const descendants: Array<SortableParagraphSubset> = []
  const visit = (node: { +children?: $ReadOnlyArray<SortableParagraphSubset>, ... }) => {
    const kids = node.children || []
    for (const child of kids) {
      descendants.push(child)
      visit(child)
    }
  }
  visit(task)
  return descendants
}

/**
 * Sort a list of tasks and, recursively, each task's children by the same sort order.
 * Children stay attached to their parent; only the ordering *within* each level changes.
 * @author @dwertheimer
 * @param {Array<SortableParagraphSubset>} tasks
 * @param {Array<string>} sortOrder - same field list understood by sortListBy (e.g. ['-priority', 'content'])
 * @returns {Array<SortableParagraphSubset>} newly-ordered list (children arrays are reordered in place)
 */
export function sortTaskTree(tasks: Array<SortableParagraphSubset>, sortOrder: Array<string>): Array<SortableParagraphSubset> {
  const sorted = sortListBy(tasks, sortOrder)
  for (const task of sorted) {
    if (task.children && task.children.length) {
      task.children = sortTaskTree(task.children, sortOrder)
    }
  }
  return sorted
}

export function getSortableTask(para: TParagraph): SortableParagraphSubset {
  const content = para.content
  const hashtags = getElementsFromTask(content, RE_HASHTAGS)
  const mentions = getElementsFromTask(content, RE_MENTIONS)
  const exclamations = getElementsFromTask(content, RE_LEADING_EXCLAMATIONS)
  const parensPriority = getElementsFromTask(content, RE_LEADING_PARENS_PRIORITY)
  const task: SortableParagraphSubset = {
    content: para.content,
    index: para.lineIndex,
    raw: para.rawContent,
    hashtags,
    mentions,
    exclamations,
    parensPriority,
    heading: para.heading,
    filename: para?.filename || '',
    indents: para.indents,
    children: [],
    due: para.date ?? new Date('2999-12-31'),
    paragraph: para,
    type: para.type,
    calculatedType: calculateParagraphType(para),
  }
  // console.log(`new: ${index}: indents:${para.indents} ${para.rawContent}`)
  task.priority = getNumericPriority(task)
  return task
}

/**
 * Sort paragraphs into groups of like types (open, scheduled, done, cancelled, etc.) for task sorting.
 * @author @dwertheimer
 * @param {Array<Paragraph>} paragraphs - array of paragraph objects input
 * @param {boolean} ignoreIndents - whether to pay attention to child/indented paragraphs
 * @returns {GroupedTasks} - object of tasks by type {'open':[], 'scheduled'[], 'done':[], 'cancelled':[], etc.}
 */
/** Indent depth of a task, treating a missing value as top level. */
function indentsOf(task: SortableParagraphSubset): number {
  return typeof task.indents === 'number' ? task.indents : 0
}

export function getTasksByType(paragraphs: $ReadOnlyArray<TParagraph>, ignoreIndents: boolean = false, useCalculatedScheduled: boolean = false): GroupedTasks {
  const tasks: GroupedTasks = (TASK_TYPES.reduce((acc, t) => ({ ...acc, ...{ [t]: [] } }), {}): any)
  // Ancestor chain for the paragraph currently being read, shallowest first. A paragraph belongs to the
  // nearest preceding item with a strictly smaller indent level. Previously this was a single `lastParent`
  // that was only reassigned for top-level tasks, so anything indented more than once (a grandchild) was
  // pushed onto the *top-level* task's children array -- every level below the first collapsed into one.
  const parentStack: Array<SortableParagraphSubset> = []
  // clo(paragraphs, 'getTasksByType')
  for (let index = 0; index < paragraphs.length; index++) {
    const para = paragraphs[index]
    // logDebug('getTasksByType', `${para.lineIndex}: ${para.type}`)
    // Treat a missing `indents` as 0. NotePlan always supplies it, but hand-built paragraphs (tests,
    // other plugins) often do not, and `undefined <= undefined` is false -- which would stop the stack
    // ever unwinding and nest every task under the first one.
    const paraIndents = typeof para.indents === 'number' ? para.indents : 0
    // Unwind BEFORE deciding what this paragraph is. Closing out every ancestor at the same or deeper
    // level leaves the true parent on top. Doing this after the decision compares the paragraph against
    // its own preceding SIBLING instead, which silently drops non-task lines that sit at sibling depth
    // (e.g. a quote or note indented alongside subtasks -- see the taskDocument.json fixture).
    if (!ignoreIndents) {
      while (parentStack.length && paraIndents <= indentsOf(parentStack[parentStack.length - 1])) {
        parentStack.pop()
      }
    }
    const parent = !ignoreIndents && parentStack.length ? parentStack[parentStack.length - 1] : null
    // Non-task lines (notes, quotes) still count as children when indented under a task, as before.
    if (isTask(para) || parent != null) {
      // const content = para.content // Not used
      // console.log(`found: ${index}: ${para.type}: ${para.content}`)
      try {
        const task: SortableParagraphSubset = getSortableTask(para)
        if (parent != null) {
          parent.children.push(task)
          parentStack.push(task)
        } else {
          // cast: para types are plain strings, but they are used here to index GroupedTasks, so declare the narrower key type (guarded by the `tasks[ct]` test below)
          const ct: $Keys<GroupedTasks> = ((useCalculatedScheduled ? task.calculatedType : task.type): any) // will always be the same as para.type except in case of scheduled
          if (ct && tasks[ct]) {
            const len = tasks[ct].push(task)
            if (!ignoreIndents) {
              parentStack.length = 0
              parentStack.push(tasks[ct][len - 1])
            }
          }
        }
      } catch (error) {
        logError('getTasksByType', `${error.message}: ${para.content}, ${index}`)
      }
    } else {
      // console.log(`\t\tSkip: ${para.content}`) //not a task
    }
  }

  // logDebug('getTasksByType', `\tgetTasksByType Open Tasks:${String(tasks.open.length)} returning from getTasksByType`)
  // logDebug('getTasksByType', `\tgetTasksByType Open Checklists:${String(tasks.checklist.length)} returning from getTasksByType`)
  return tasks
}
