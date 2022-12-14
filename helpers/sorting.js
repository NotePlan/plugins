// @flow

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
  filename: string;
  indents: number;
  children: Array<SortableParagraphSubset>;
  paragraph: ?TParagraph;
}

export type GroupedTasks = {
  open: Array<SortableParagraphSubset>,
  scheduled: Array<SortableParagraphSubset>,
  cancelled: Array<SortableParagraphSubset>,
  done: Array<SortableParagraphSubset>,
  title: Array<SortableParagraphSubset>,
  quote: Array<SortableParagraphSubset>,
  list: Array<SortableParagraphSubset>,
  empty: Array<SortableParagraphSubset>,
  text: Array<SortableParagraphSubset>,
  code: Array<SortableParagraphSubset>,
  separator: Array<SortableParagraphSubset>,
}

export type ParagraphsGroupedByType = {
  open?: ?Array<TParagraph>,
  scheduled?: ?Array<TParagraph>,
  cancelled?: ?Array<TParagraph>,
  done?: ?Array<TParagraph>,
}

export const HASHTAGS: RegExp = /\B#([a-zA-Z0-9\/]+\b)/g
export const MENTIONS: RegExp = /\B@([a-zA-Z0-9\/]+\b)/g
const EXCLAMATIONS: RegExp = /\B(!+\B)/g
const PARENS_PRIORITY: RegExp = /^\s*\(([a-zA-z])\)\B/g // must be at start of content
export const TASK_TYPES: Array<string> = ['open', 'scheduled', 'done', 'cancelled']
export const isTask = (para: TParagraph): boolean => TASK_TYPES.indexOf(para.type) >= 0

/**
 * Modern case insensitive sorting function
 * More details at https://stackoverflow.com/a/49004987/3238281
 * @param {string} a
 * @param {string} b
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

/** Code from @jgclark which is probably redundant given sortListBy() above */
// export const sortByChangedDate = (): Function => {
//   return (b, a) => {
//     if (a.note.changedDate !== b.note.changedDate) {
//       if (a.note.changedDate > b.note.changedDate) {
//         return -1
//       }
//       if (b.note.changedDate > a.note.changedDate) {
//         return 1
//       }
//     }
//     return 0
//   }
// }

// export const sortByTitle = (): Function => {
//   return (b, a) => {
//     const aTitle = displayTitle(a)
//     const bTitle = displayTitle(b)
//     if (aTitle !== bTitle) {
//       if (aTitle > bTitle) {
//         return -1
//       }
//       if (bTitle > aTitle) {
//         return 1
//       }
//     }
//     return 0
//   }
// }

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
          field = isNaN(field) ? field : Number(field)
        } else {
          field = isNaN(field) ? field : Number(field)
        }
        const aValue = firstValue(a[field])
        const bValue = firstValue(b[field])
        if (aValue === bValue) return 0
        if (aValue == null) return isDesc ? -dir : dir //null or undefined always come last
        if (bValue == null) return isDesc ? dir : -dir
        // $FlowIgnore - flow complains about comparison of non-identical types, but I am trapping for that
        return typeof aValue === typeof bValue ? (aValue > bValue ? dir : -dir) : 0
      })
      .reduce((p, n) => (p ? p : n), 0)

/**
 * Sometimes you you want to sort on the value of a field that is an array
 * So in that case, grab the first item in that array to sort
 * Helper function for fieldSorter fields. If the value is an array,
 * return the first value
 * if it's not an array, just return the value, and if it's a string, lowercase value.
 * @author @dwertheimer
 * @param {any} val
 * @returns
 */
export const firstValue = (val: any): string | number => {
  let retVal = Array.isArray(val) ? val[0] : val
  if (retVal == null) {
    return retVal
  } else {
    retVal = typeof retVal === 'number' || (typeof retVal !== 'object' && !isNaN(retVal) && retVal !== '') ? Number(retVal) : retVal
    return typeof retVal === 'string' ? retVal.toLowerCase() : retVal
  }
}

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
 */
function getNumericPriority(item: SortableParagraphSubset): number {
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

/**
 * Sort paragraphs into groups of like types (open, scheduled, done, cancelled, etc.) for task sorting
 * @param {Array<Paragraph>} paragraphs - array of paragraph objects input
 * @param {boolean} ignoreIndents - whether to pay attention to child/indented paragraphs
 * @returns {GroupedTasks} - object of tasks by type {'open':[], 'scheduled'[], 'done':[], 'cancelled':[], etc.}
 */
export function getTasksByType(paragraphs: $ReadOnlyArray<TParagraph>, ignoreIndents: boolean = false): GroupedTasks {
  const tasks = { open: [], scheduled: [], done: [], cancelled: [], title: [], quote: [], list: [], empty: [], text: [], code: [], separator: [] }
  // * @type {"open", "done", "scheduled", "cancelled", "title", "quote", "list" (= bullet), "empty" (no content) or "text" (= plain text)}
  TASK_TYPES.forEach((t) => (tasks[t] = []))
  let lastParent = { indents: 999, children: [] }
  // clo(paragraphs, 'getTasksByType')
  for (let index = 0; index < paragraphs.length; index++) {
    // console.log(`getTasksByType paragraphs.length:${paragraphs.length}`)
    const para = paragraphs[index]
    // clo(para, 'getTasksByType')
    // FIXME: non tasks are not going to get through this filter. What to do?
    if (isTask || (!ignoreIndents && para.indents > lastParent.indents)) {
      const content = para.content
      // console.log(`found: ${index}: ${para.type}: ${para.content}`)
      try {
        const hashtags = getElementsFromTask(content, HASHTAGS)
        const mentions = getElementsFromTask(content, MENTIONS)
        const exclamations = getElementsFromTask(content, EXCLAMATIONS)
        const parensPriority = getElementsFromTask(content, PARENS_PRIORITY)
        const task: SortableParagraphSubset = {
          content: para.content,
          index,
          raw: para.rawContent,
          hashtags,
          mentions,
          exclamations,
          parensPriority,
          heading: para.heading,
          filename: para?.filename || '',
          indents: para.indents,
          children: [],
          due: para.date ?? new Date('2099-12-31'),
          paragraph: para,
        }
        // console.log(`new: ${index}: indents:${para.indents} ${para.rawContent}`)
        task.priority = getNumericPriority(task)
        if (!ignoreIndents && lastParent.indents < para.indents) {
          lastParent.children.push(task)
        } else {
          const len = tasks[para.type].push(task)
          lastParent = tasks[para.type][len - 1]
        }
      } catch (error) {
        console.log(error, para.content, index)
      }
    } else {
      // console.log(`\t\tSkip: ${para.content}`) //not a task
    }
  }

  // console.log(`\tgetTasksByType Open Tasks:${tasks.open.length} returning from getTasksByType`)
  return tasks
}
