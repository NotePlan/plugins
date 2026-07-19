// @flow
/**
 * Mock NotePlan paragraph objects for testing
 */

import { Paragraph } from '@mocks/index'

/**
 * Create a mock paragraph with standard test defaults
 * Note: we explicitly set note to null so the code falls back to Editor.updateParagraph
 */
export function createMockParagraph(overrides: Object = {}): any {
  const para = new Paragraph({
    type: 'open',
    content: 'Test task',
    rawContent: '* Test task',
    indents: 0,
    lineIndex: 0,
    note: null, // Explicitly set to null so code falls back to Editor.updateParagraph
    ...overrides,
  })
  // Ensure note is null even if Paragraph mock sets a default
  if (!overrides.note) {
    para.note = null
  }
  return para
}

/**
 * Open task without Todoist link
 */
export const openTaskNoLink = createMockParagraph({
  type: 'open',
  content: 'Buy groceries',
  rawContent: '* Buy groceries',
  lineIndex: 0,
})

/**
 * Open task with Todoist link
 */
export const openTaskWithLink = createMockParagraph({
  type: 'open',
  content: 'Call the bank [^](https://app.todoist.com/app/task/12345679)',
  rawContent: '* Call the bank [^](https://app.todoist.com/app/task/12345679)',
  lineIndex: 1,
})

/**
 * Done task with Todoist link
 */
export const doneTaskWithLink = createMockParagraph({
  type: 'done',
  content: 'Review documents [^](https://app.todoist.com/app/task/12345680)',
  rawContent: '- [x] Review documents [^](https://app.todoist.com/app/task/12345680)',
  lineIndex: 2,
})

/**
 * Cancelled task with Todoist link
 */
export const cancelledTaskWithLink = createMockParagraph({
  type: 'cancelled',
  content: 'Old task [^](https://app.todoist.com/app/task/12345681)',
  rawContent: '- [-] Old task [^](https://app.todoist.com/app/task/12345681)',
  lineIndex: 3,
})

/**
 * Checklist item (not a task)
 */
export const checklistItem = createMockParagraph({
  type: 'checklist',
  content: 'Pack laptop charger',
  rawContent: '+ Pack laptop charger',
  lineIndex: 4,
})

/**
 * Regular text paragraph
 */
export const textParagraph = createMockParagraph({
  type: 'text',
  content: 'Some notes here',
  rawContent: 'Some notes here',
  lineIndex: 5,
})

/**
 * Empty paragraph
 */
export const emptyParagraph = createMockParagraph({
  type: 'empty',
  content: '',
  rawContent: '',
  lineIndex: 6,
})

/**
 * Task with priority (!!!)
 */
export const highPriorityTask = createMockParagraph({
  type: 'open',
  content: '!!! Submit tax return',
  rawContent: '* !!! Submit tax return',
  lineIndex: 7,
})

/**
 * Task with medium priority (!!)
 */
export const mediumPriorityTask = createMockParagraph({
  type: 'open',
  content: '!! Review quarterly report',
  rawContent: '* !! Review quarterly report',
  lineIndex: 8,
})

/**
 * Task with low priority (!)
 */
export const lowPriorityTask = createMockParagraph({
  type: 'open',
  content: '! Check email',
  rawContent: '* ! Check email',
  lineIndex: 9,
})

/**
 * Task with due date
 */
export const taskWithDueDate = createMockParagraph({
  type: 'open',
  content: 'Meeting prep >2025-03-15',
  rawContent: '* Meeting prep >2025-03-15',
  lineIndex: 10,
})

/**
 * Task with >today date
 */
export const taskWithToday = createMockParagraph({
  type: 'open',
  content: 'Daily standup >today',
  rawContent: '* Daily standup >today',
  lineIndex: 11,
})

/**
 * Task with labels/tags
 */
export const taskWithLabels = createMockParagraph({
  type: 'open',
  content: 'Research topic #work #research',
  rawContent: '* Research topic #work #research',
  lineIndex: 12,
})

/**
 * Complex task with priority, date, and labels
 */
export const complexTask = createMockParagraph({
  type: 'open',
  content: '!! Important meeting >2025-04-01 #work #urgent',
  rawContent: '* !! Important meeting >2025-04-01 #work #urgent',
  lineIndex: 13,
})

/**
 * Parent task with subtasks scenario
 */
export const parentTaskParagraph = createMockParagraph({
  type: 'open',
  content: 'Project kickoff',
  rawContent: '* Project kickoff',
  indents: 0,
  lineIndex: 14,
})

export const subtaskParagraph1 = createMockParagraph({
  type: 'open',
  content: 'Prepare presentation',
  rawContent: '\t* Prepare presentation',
  indents: 1,
  lineIndex: 15,
})

export const subtaskParagraph2 = createMockParagraph({
  type: 'open',
  content: 'Send invites',
  rawContent: '\t* Send invites',
  indents: 1,
  lineIndex: 16,
})

export const nonSubtaskParagraph = createMockParagraph({
  type: 'open',
  content: 'Unrelated task',
  rawContent: '* Unrelated task',
  indents: 0,
  lineIndex: 17,
})

/**
 * Helper to create a collection of paragraphs for a note
 */
export function createNoteParagraphs(): Array<any> {
  return [
    createMockParagraph({ type: 'title', content: 'Test Note', lineIndex: 0 }),
    createMockParagraph({ type: 'empty', content: '', lineIndex: 1 }),
    createMockParagraph({ type: 'open', content: 'Task 1', lineIndex: 2 }),
    createMockParagraph({ type: 'done', content: 'Task 2 [^](https://app.todoist.com/app/task/111)', lineIndex: 3 }),
    createMockParagraph({ type: 'open', content: 'Task 3 [^](https://app.todoist.com/app/task/222)', lineIndex: 4 }),
    createMockParagraph({ type: 'text', content: 'Some notes', lineIndex: 5 }),
  ]
}

/**
 * Helper to create paragraphs with parent/subtask relationships
 */
export function createTaskHierarchy(): Array<any> {
  return [
    parentTaskParagraph,
    subtaskParagraph1,
    subtaskParagraph2,
    nonSubtaskParagraph,
  ]
}
