import { hyphenatedDateString } from './dateHelpers'

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

export function getTasksByType(paragraphs) {
  const tasks = {}
  // * @type {"open", "done", "scheduled", "cancelled", "title", "quote", "list" (= bullet), "empty" (no content) or "text" (= plain text)}
  const taskTypes = ['open', 'done', 'scheduled', 'cancelled']
  taskTypes.forEach((t) => (tasks[t] = []))
  paragraphs.forEach((para, index) => {
    if (taskTypes.indexOf(para.type) >= 0) {
      console.log(`\t${para.type}: ${para.content}`)
      tasks[para.type].push({ content: para.content, index })
    } else {
      // console.log(`\t\tSkip: ${para.content}`)
    }
  })
  console.log(`\t${JSON.stringify(tasks)}`)
  return tasks
}
