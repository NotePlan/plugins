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
}

export type ParagraphsGroupedByType = {
  open?: ?Array<TParagraph>,
  scheduled?: ?Array<TParagraph>,
  cancelled?: ?Array<TParagraph>,
  done?: ?Array<TParagraph>,
  checklist?: ?Array<TParagraph>,
  checklistDone?: ?Array<TParagraph>,
  checklistCancelled?: ?Array<TParagraph>,
  checklistScheduled?: ?Array<TParagraph>,
}

const RE_HASHTAGS: RegExp = /\B#([a-zA-Z0-9\/]+\b)/g
const RE_MENTIONS: RegExp = /\B@([a-zA-Z0-9\/]+\b)/g
const RE_EXCLAMATIONS: RegExp = /\B(!+\B)/g
const RE_PARENS_PRIORITY: RegExp = /^\s*\(([a-zA-z])\)\B/g // must be at start of content
export const TASK_TYPES: Array<string> = ['open', 'scheduled', 'done', 'cancelled', 'checklist', 'checklistDone', 'checklistCancelled', 'checklistScheduled']
export const isTask = (para: TParagraph): boolean => TASK_TYPES.indexOf(para.type) >= 0

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
 * Multi-level object property sorting callback function (for use in sort())
 * Note: this will work for arrays of arrays (in addition to arrays of objects), in this case, send
 * the number of the array index to check as a string, e.g. "2" or "-2" will use the second element to sort on
 * undefined values are treated as the lowest value (i.e. sorted to the bottom)
 * @author @dwertheimer
 * @example const sortedHomes = homes.sort(fieldSorter(['state', '-price'])); //the - in front of name is DESC
 * @param {Array<string>} field list - property array, e.g. ['date', 'title']
 * @returns {function} callback function for sort()
 */
export const fieldSorter =
  (fields: Array<string>): function =>
  (a, b) =>
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
 * A general purpose function to get all the elements from a task that match a regex
 * and return them as an array. Generally usefull for getting all the tags or mentions from a task
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
 * TODO: Extend to add 'working-on' support (W)
 * @author @dwertheimer
 * @param {SortableParagraphSubset} item
 * @returns {number} priority from 3, 2, 1, -1 (default)
 */
export function getNumericPriority(item: SortableParagraphSubset): number {
  let prio = -1
  if (item.exclamations[0]) {
    prio = item.exclamations[0].length
  } else if (item.parensPriority[0]) {
    prio = item.parensPriority[0].charCodeAt(0) - 'A'.charCodeAt(0) + 1
  } else {
    prio = -1
  }
  return prio
}

/*
 * Get numeric priority level based on !!! or (B)
 * TODO: Extend to add 'working-on' support (W)
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
export function getSortableTask(para: TParagraph): SortableParagraphSubset {
  const content = para.content
  const hashtags = getElementsFromTask(content, RE_HASHTAGS)
  const mentions = getElementsFromTask(content, RE_MENTIONS)
  const exclamations = getElementsFromTask(content, RE_EXCLAMATIONS)
  const parensPriority = getElementsFromTask(content, RE_PARENS_PRIORITY)
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
export function getTasksByType(paragraphs: $ReadOnlyArray<TParagraph>, ignoreIndents: boolean = false, useCalculatedScheduled: boolean = false): GroupedTasks {
  const tasks = TASK_TYPES.reduce((acc, t) => ({ ...acc, ...{ [t]: [] } }), {})
  let lastParent = { indents: 999, children: [] }
  // clo(paragraphs, 'getTasksByType')
  for (let index = 0; index < paragraphs.length; index++) {
    const para = paragraphs[index]
    // logDebug('getTasksByType', `${para.lineIndex}: ${para.type}`)
    if (isTask || (!ignoreIndents && para.indents > lastParent.indents)) {
      // const content = para.content // Not used
      // console.log(`found: ${index}: ${para.type}: ${para.content}`)
      try {
        const task: SortableParagraphSubset = getSortableTask(para)
        if (!ignoreIndents && para.indents > lastParent.indents) {
          lastParent.children.push(task)
        } else {
          const ct = useCalculatedScheduled ? task.calculatedType : task.type // will always be the same as para.type except in case of scheduled
          if (ct && tasks[ct]) {
            const len = tasks[ct].push(task)
            lastParent = tasks[ct][len - 1]
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
  // $FlowFixMe - Flow doesn't like that I am ensuring that all the keys are in the object using reduce above
  return tasks
}
