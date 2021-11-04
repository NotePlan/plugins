/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
import { hyphenatedDateString } from './dateHelpers'

const HASHTAGS = /\B#([a-zA-Z0-9]+\b)/g
const MENTIONS = /\B@([a-zA-Z0-9]+\b)/g
const EXCLAMATIONS = /\B(!+\B)/g
const PARENS_PRIORITY = /^\s*\(([a-zA-z])\)\B/g // must be at start of content
export const TASK_TYPES = ['open', 'scheduled', 'done', 'cancelled']

function getElementsFromTask(content, reSearch) {
  const found = []
  let matches = reSearch.exec(content)

  do {
    if (matches?.length > 1) {
      found.push(matches[1].trim())
    }
  } while ((matches = reSearch.exec(content)) !== null)
  return found
}

/*
 * Get numeric priority level based on !!! or (B)
 */
function getNumericPriority(item) {
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

// is value an array? if so, return its first value in lowercase for sorting
const ia = (val) => {
  const retVal = Array.isArray(val) ? val[0] : val
  return typeof retVal === 'string' ? retVal.toLowerCase() : retVal
}

/*
 * Multi-key sorting
 * @param field list - property array
 * @example const sortedHomes = homes.sort(fieldSorter(['state', '-price'])); //the - in front of name is DESC
 */
const fieldSorter = (fields) => (a, b) =>
  fields
    .map((o) => {
      let dir = 1
      if (o[0] === '-') {
        dir = -1
        o = o.substring(1)
      }
      if (ia(a[o]) === undefined) return dir
      if (ia(b[o]) === undefined) return -dir
      return ia(a[o]) > ia(b[o]) ? dir : ia(a[o]) < ia(b[o]) ? -dir : 0
    })
    .reduce((p, n) => (p ? p : n), 0)

/*
 * @param array of task items
 * @param pass in field names to sort by -- either a single string or an array of strings/sort-order
 * @return the sorted task list
 */
export function sortListBy(list, fields) {
  const sortBy = typeof fields === 'string' ? [fields] : fields
  list.sort(fieldSorter(sortBy))
  // console.log('** LIST AFTER fieldSorter SORT:')
  // console.log(JSON.stringify(list))

  return list
  // return list.sort(fieldSorterOptimized(sortBy))
}

// Note: nmn.sweep limits how far back you look with: && hyphenatedDateString(p.date) >= afterHyphenatedDate,
// For now, we are assuming that sweep was already done, and we're just looking at this one note
export const isOverdue = (t) => {
  t.type === 'open' && t.date !== null && hyphenatedDateString(t.date) < hyphenatedDateString(new Date())
}

/*
 * @param paragraphs array
 * @return filtered list of overdue tasks
 */
export const getOverdueTasks = (paras) => paras.filter((p) => isOverdue(p))

/*
 * @param Paragraphs array
 * @return tasks object of tasks by type {'open':[], 'scheduled'[], 'done':[], 'cancelled':[]}
 */
export function getTasksByType(paragraphs) {
  const tasks = {}
  // * @type {"open", "done", "scheduled", "cancelled", "title", "quote", "list" (= bullet), "empty" (no content) or "text" (= plain text)}
  TASK_TYPES.forEach((t) => (tasks[t] = []))
  let lastParent = { indents: 999 }
  for (let index = 0; index < paragraphs.length; index++) {
    const para = paragraphs[index]
    // FIXME: non tasks are not going to get through this filter. What to do?
    const isTask = TASK_TYPES.indexOf(para.type) >= 0
    if (isTask || para.indents > lastParent.indents) {
      const content = para.content
      // console.log(`${index}: ${para.type}: ${para.content}`)
      try {
        const hashtags = getElementsFromTask(content, HASHTAGS)
        const mentions = getElementsFromTask(content, MENTIONS)
        const exclamations = getElementsFromTask(content, EXCLAMATIONS)
        const parensPriority = getElementsFromTask(content, PARENS_PRIORITY)
        const task = {
          content: para.content,
          index,
          raw: para.rawContent,
          hashtags,
          mentions,
          exclamations,
          parensPriority,
          indents: para.indents,
          children: [],
        }
        console.log(`${index}: indents:${para.indents} ${para.rawContent}`)
        task.priority = getNumericPriority(task)
        if (lastParent.indents < para.indents) {
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
  console.log(`\tgetTasksByType Open Tasks:${tasks.open.length} returning from getTasksByType`)
  return tasks
}
