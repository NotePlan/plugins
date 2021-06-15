/* eslint-disable max-len */
import { hyphenatedDateString } from './dateHelpers'

const HASHTAGS = /\B#([a-zA-Z0-9]+\b)/g
const MENTIONS = /\B@([a-zA-Z0-9]+\b)/g
const EXCLAMATIONS = /\B(!+\B)/g
const PARENS_PRIORITY = /^\s*(\([a-zA-z]\))\B/g // must be at start of content

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

export function getOverdueTasks(paragraphs) {
  const todayDateString = hyphenatedDateString(new Date())

  return paragraphs.filter(
    (p) =>
      p.type === 'open' &&
      p.date !== null &&
      hyphenatedDateString(p.date) < todayDateString,
  )
  // Note: nmn.sweep limits how far back you look with: && hyphenatedDateString(p.date) >= afterHyphenatedDate,
  // For now, we are assuming that sweep was already done, and we're just looking at this one note
}

/*
 * @param Paragraphs array
 * @return tasks object of tasks by type {'open':[], 'scheduled'[], 'done':[], 'cancelled':[]}
 */
export function getTasksByType(paragraphs) {
  const tasks = {}
  // * @type {"open", "done", "scheduled", "cancelled", "title", "quote", "list" (= bullet), "empty" (no content) or "text" (= plain text)}
  const taskTypes = ['open', 'scheduled', 'done', 'cancelled']
  taskTypes.forEach((t) => (tasks[t] = []))
  paragraphs.forEach((para, index) => {
    if (taskTypes.indexOf(para.type) >= 0) {
      const content = para.content
      console.log(`\t${index}: ${para.type}: ${para.content}`)
      try {
        const hashtags = getElementsFromTask(content, HASHTAGS)
        const mentions = getElementsFromTask(content, MENTIONS)
        const exclamations = getElementsFromTask(content, EXCLAMATIONS)
        const parensPriority = getElementsFromTask(content, PARENS_PRIORITY)

        tasks[para.type].push({
          content: para.content,
          index,
          raw: para.rawContent,
          hashtags,
          mentions,
          exclamations,
          parensPriority,
        })
      } catch (error) {
        console.log(error, para.content, index)
      }
    } else {
      // console.log(`\t\tSkip: ${para.content}`) //not a task
    }
  })
  console.log(`\t${JSON.stringify(tasks)}`)
  return tasks
}
