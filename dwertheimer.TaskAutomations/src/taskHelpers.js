/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
import { fieldSorter } from '../../helpers/sorting'
import { hyphenatedDateString } from './dateHelpers'
import { clo } from '../../helpers/dev'

export const HASHTAGS = /\B#([a-zA-Z0-9\/]+\b)/g
export const MENTIONS = /\B@([a-zA-Z0-9\/]+\b)/g
const EXCLAMATIONS = /\B(!+\B)/g
const PARENS_PRIORITY = /^\s*\(([a-zA-z])\)\B/g // must be at start of content
export const TASK_TYPES = ['open', 'scheduled', 'done', 'cancelled']

export function getElementsFromTask(content, reSearch) {
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

// returns a date object if it exists, and null if there is no forward date
const hasTypedDate = (t) => (/>\d{4}-\d{2}-\d{2}/g.test(t.content) ? t.date : null)

// Note: nmn.sweep limits how far back you look with: && hyphenatedDateString(p.date) >= afterHyphenatedDate,
// For now, we are assuming that sweep was already done, and we're just looking at this one note
export const isOverdue = (t) => {
  let theDate = null
  if (t.type === 'scheduled') theDate = t.date
  if (t.type === 'open') theDate = hasTypedDate(t)
  return theDate && hyphenatedDateString(theDate) < hyphenatedDateString(new Date())
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
export function getTasksByType(paragraphs: Array<Paragraph>, ignoreIndents: boolean = false) {
  const tasks = {}
  // * @type {"open", "done", "scheduled", "cancelled", "title", "quote", "list" (= bullet), "empty" (no content) or "text" (= plain text)}
  TASK_TYPES.forEach((t) => (tasks[t] = []))
  let lastParent = { indents: 999 }
  // clo(paragraphs, 'getTasksByType')
  for (let index = 0; index < paragraphs.length; index++) {
    // console.log(`getTasksByType paragraphs.length:${paragraphs.length}`)
    const para = paragraphs[index]
    // clo(para, 'getTasksByType')
    // FIXME: non tasks are not going to get through this filter. What to do?
    const isTask = TASK_TYPES.indexOf(para.type) >= 0
    if (isTask || (!ignoreIndents && para.indents > lastParent.indents)) {
      const content = para.content
      // console.log(`found: ${index}: ${para.type}: ${para.content}`)
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
          filename: para.filename,
          indents: para.indents,
          children: [],
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
