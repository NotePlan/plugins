// @flow

/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
import { hyphenatedDateString } from './dateHelpers'
import { fieldSorter } from '@helpers/sorting'
import { clo, copyObject } from '@helpers/dev'

export const HASHTAGS: RegExp = /\B#([a-zA-Z0-9\/]+\b)/g
export const MENTIONS: RegExp = /\B@([a-zA-Z0-9\/]+\b)/g
const EXCLAMATIONS: RegExp = /\B(!+\B)/g
const PARENS_PRIORITY: RegExp = /^\s*\(([a-zA-z])\)\B/g // must be at start of content
export const TASK_TYPES: Array<string> = ['open', 'scheduled', 'done', 'cancelled']

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
function getNumericPriority(item: SortableParagraph): number {
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
export const isOverdue = (t: TParagraph): boolean => {
  let theDate = null
  if (t.type === 'scheduled') theDate = t.date
  if (t.type === 'open') theDate = hasTypedDate(t)
  return theDate == null ? false : hyphenatedDateString(theDate) < hyphenatedDateString(new Date())
}

/*
 * @param paragraphs array
 * @return filtered list of overdue tasks
 */
export const getOverdueTasks = (paras: Array<TParagraph>): Array<TParagraph> => paras.filter((p) => isOverdue(p))

export type SortableParagraph = {
  content: string,
  index: number,
  raw: string,
  hashtags: Array<string>,
  mentions: Array<string>,
  exclamations: Array<string>,
  parensPriority: Array<string>,
  priority?: number,
  filename: string,
  indents: number,
  children: Array<SortableParagraph>,
  paragraph: ?TParagraph,
}

export type GroupedTasks = {
  open?: Array<SortableParagraph>,
  scheduled?: Array<SortableParagraph>,
  cancelled?: Array<SortableParagraph>,
  done?: Array<SortableParagraph>,
  title?: Array<SortableParagraph>,
  quote?: Array<SortableParagraph>,
  list?: Array<SortableParagraph>,
  empty?: Array<SortableParagraph>,
  text?: Array<SortableParagraph>,
  code?: Array<SortableParagraph>,
  separator?: Array<SortableParagraph>,
}

/**
 * Sort paragraphs into groups of like types (open, scheduled, done, cancelled, etc.) for task sorting
 * @param {Array<Paragraph>} paragraphs - array of paragraph objects input
 * @param {boolean} ignoreIndents - whether to pay attention to child/indented paragraphs
 * @returns {GroupedTasks} - object of tasks by type {'open':[], 'scheduled'[], 'done':[], 'cancelled':[], etc.}
 */
export function getTasksByType(paragraphs: Array<Paragraph>, ignoreIndents: boolean = false): GroupedTasks {
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
    const isTask = TASK_TYPES.indexOf(para.type) >= 0
    if (isTask || (!ignoreIndents && para.indents > lastParent.indents)) {
      const content = para.content
      // console.log(`found: ${index}: ${para.type}: ${para.content}`)
      try {
        const hashtags = getElementsFromTask(content, HASHTAGS)
        const mentions = getElementsFromTask(content, MENTIONS)
        const exclamations = getElementsFromTask(content, EXCLAMATIONS)
        const parensPriority = getElementsFromTask(content, PARENS_PRIORITY)
        const task: SortableParagraph = {
          content: para.content,
          index,
          raw: para.rawContent,
          hashtags,
          mentions,
          exclamations,
          parensPriority,
          filename: para?.filename || '',
          indents: para.indents,
          children: [],
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
