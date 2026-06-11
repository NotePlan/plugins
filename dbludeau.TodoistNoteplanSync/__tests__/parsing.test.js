/* global jest, describe, test, expect, beforeAll, beforeEach */
// @flow
/**
 * Phase 1: Pure Function Unit Tests
 * Tests for deterministic functions with no external dependencies
 */

import { CustomConsole } from '@jest/console'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph, simpleFormatter } from '@mocks/index'
import * as mainFile from '../src/NPPluginMain'
import {
  createMockParagraph,
  openTaskNoLink,
  openTaskWithLink,
  doneTaskWithLink,
  textParagraph,
  emptyParagraph,
  checklistItem,
  highPriorityTask,
  mediumPriorityTask,
  lowPriorityTask,
  taskWithDueDate,
  taskWithToday,
  taskWithLabels,
  complexTask,
  parentTaskParagraph,
  subtaskParagraph1,
  subtaskParagraph2,
  nonSubtaskParagraph,
  createTaskHierarchy,
} from '../src/testFixtures/mockParagraphs'

const PLUGIN_NAME = 'dbludeau.TodoistNoteplanSync'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'none' // change to 'DEBUG' for more logging
})

// ============================================================================
// extractTodoistTaskId
// ============================================================================
describe('extractTodoistTaskId', () => {
  test('should extract ID from valid Todoist link with caret', () => {
    const content = 'Task [^](https://app.todoist.com/app/task/12345678)'
    const result = mainFile.extractTodoistTaskId(content)
    expect(result).toBe('12345678')
  })

  test('should extract ID from valid Todoist link without caret', () => {
    const content = 'Task [](https://app.todoist.com/app/task/87654321)'
    const result = mainFile.extractTodoistTaskId(content)
    expect(result).toBe('87654321')
  })

  test('should return null for content without Todoist link', () => {
    const content = 'Regular task without link'
    const result = mainFile.extractTodoistTaskId(content)
    expect(result).toBeNull()
  })

  test('should return null for empty content', () => {
    const result = mainFile.extractTodoistTaskId('')
    expect(result).toBeNull()
  })

  test('should extract ID when there is text after the link', () => {
    const content = 'Task [^](https://app.todoist.com/app/task/99999999) @done(2025-01-01)'
    const result = mainFile.extractTodoistTaskId(content)
    expect(result).toBe('99999999')
  })

  test('should extract first ID when multiple links present', () => {
    const content = 'Task [^](https://app.todoist.com/app/task/11111111) and [^](https://app.todoist.com/app/task/22222222)'
    const result = mainFile.extractTodoistTaskId(content)
    expect(result).toBe('11111111')
  })

  test('should handle very long task IDs', () => {
    const content = 'Task [^](https://app.todoist.com/app/task/123456789012345)'
    const result = mainFile.extractTodoistTaskId(content)
    expect(result).toBe('123456789012345')
  })
})

// ============================================================================
// parseTaskDetailsForTodoist
// ============================================================================
describe('parseTaskDetailsForTodoist', () => {
  describe('priority parsing', () => {
    test('should parse highest priority (!!!) as Todoist p4', () => {
      const result = mainFile.parseTaskDetailsForTodoist('!!! Urgent task')
      expect(result.priority).toBe(4)
      expect(result.content).toBe('Urgent task')
    })

    test('should parse medium priority (!!) as Todoist p3', () => {
      const result = mainFile.parseTaskDetailsForTodoist('!! Important task')
      expect(result.priority).toBe(3)
      expect(result.content).toBe('Important task')
    })

    test('should parse low priority (!) as Todoist p2', () => {
      const result = mainFile.parseTaskDetailsForTodoist('! Normal task')
      expect(result.priority).toBe(2)
      expect(result.content).toBe('Normal task')
    })

    test('should default to p1 when no priority marker', () => {
      const result = mainFile.parseTaskDetailsForTodoist('Regular task')
      expect(result.priority).toBe(1)
      expect(result.content).toBe('Regular task')
    })

    test('should not parse priority marker in middle of content', () => {
      const result = mainFile.parseTaskDetailsForTodoist('Task with !!! in middle')
      expect(result.priority).toBe(1)
      expect(result.content).toBe('Task with !!! in middle')
    })
  })

  describe('date parsing', () => {
    test('should parse YYYY-MM-DD date format', () => {
      const result = mainFile.parseTaskDetailsForTodoist('Task >2025-03-15')
      expect(result.dueDate).toBe('2025-03-15')
      expect(result.content).toBe('Task')
    })

    test('should parse >today keyword', () => {
      const result = mainFile.parseTaskDetailsForTodoist('Task >today')
      const today = new Date().toISOString().split('T')[0]
      expect(result.dueDate).toBe(today)
      expect(result.content).toBe('Task')
    })

    test('should parse >tomorrow keyword', () => {
      const result = mainFile.parseTaskDetailsForTodoist('Task >tomorrow')
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      expect(result.dueDate).toBe(tomorrow.toISOString().split('T')[0])
      expect(result.content).toBe('Task')
    })

    test('should return null dueDate when no date specified', () => {
      const result = mainFile.parseTaskDetailsForTodoist('Task without date')
      expect(result.dueDate).toBeNull()
    })

    test('should handle date in middle of content', () => {
      const result = mainFile.parseTaskDetailsForTodoist('Meeting >2025-04-01 with team')
      expect(result.dueDate).toBe('2025-04-01')
      expect(result.content).toBe('Meeting with team')
    })
  })

  describe('label parsing', () => {
    test('should extract single label', () => {
      const result = mainFile.parseTaskDetailsForTodoist('Task #work')
      expect(result.labels).toEqual(['work'])
      expect(result.content).toBe('Task')
    })

    test('should extract multiple labels', () => {
      const result = mainFile.parseTaskDetailsForTodoist('Task #work #urgent #project')
      expect(result.labels).toContain('work')
      expect(result.labels).toContain('urgent')
      expect(result.labels).toContain('project')
      expect(result.labels.length).toBe(3)
    })

    test('should not extract duplicate labels', () => {
      const result = mainFile.parseTaskDetailsForTodoist('Task #work #work')
      expect(result.labels).toEqual(['work'])
    })

    test('should handle labels with hyphens and underscores', () => {
      const result = mainFile.parseTaskDetailsForTodoist('Task #my-project #task_type')
      expect(result.labels).toContain('my-project')
      expect(result.labels).toContain('task_type')
    })

    test('should return empty labels array when no labels', () => {
      const result = mainFile.parseTaskDetailsForTodoist('Task without labels')
      expect(result.labels).toEqual([])
    })
  })

  describe('combined parsing', () => {
    test('should parse priority, date, and labels together', () => {
      const result = mainFile.parseTaskDetailsForTodoist('!! Important meeting >2025-04-01 #work #urgent')
      expect(result.priority).toBe(3)
      expect(result.dueDate).toBe('2025-04-01')
      expect(result.labels).toContain('work')
      expect(result.labels).toContain('urgent')
      expect(result.content).toBe('Important meeting')
    })

    test('should handle complex task with all elements', () => {
      const result = mainFile.parseTaskDetailsForTodoist('!!! Call client >today #sales #important')
      expect(result.priority).toBe(4)
      const today = new Date().toISOString().split('T')[0]
      expect(result.dueDate).toBe(today)
      expect(result.labels.length).toBe(2)
      expect(result.content).toBe('Call client')
    })

    test('should clean up extra whitespace', () => {
      const result = mainFile.parseTaskDetailsForTodoist('!!   Messy   task   >2025-01-01   #tag')
      expect(result.content).toBe('Messy task')
    })
  })
})

// ============================================================================
// isNonTodoistOpenTask
// ============================================================================
describe('isNonTodoistOpenTask', () => {
  test('should return true for open task without Todoist link', () => {
    const para = createMockParagraph({ type: 'open', content: 'Buy groceries' })
    const result = mainFile.isNonTodoistOpenTask(para)
    expect(result).toBe(true)
  })

  test('should return false for open task with Todoist link', () => {
    const para = createMockParagraph({
      type: 'open',
      content: 'Task [^](https://app.todoist.com/app/task/12345)',
    })
    const result = mainFile.isNonTodoistOpenTask(para)
    expect(result).toBe(false)
  })

  test('should return false for done task', () => {
    const para = createMockParagraph({ type: 'done', content: 'Completed task' })
    const result = mainFile.isNonTodoistOpenTask(para)
    expect(result).toBe(false)
  })

  test('should return false for cancelled task', () => {
    const para = createMockParagraph({ type: 'cancelled', content: 'Cancelled task' })
    const result = mainFile.isNonTodoistOpenTask(para)
    expect(result).toBe(false)
  })

  test('should return true for checklist item without Todoist link', () => {
    const para = createMockParagraph({ type: 'checklist', content: 'Pack laptop' })
    const result = mainFile.isNonTodoistOpenTask(para)
    expect(result).toBe(true)
  })

  test('should return false for text paragraph', () => {
    const para = createMockParagraph({ type: 'text', content: 'Some notes' })
    const result = mainFile.isNonTodoistOpenTask(para)
    expect(result).toBe(false)
  })

  test('should return false for empty paragraph', () => {
    const para = createMockParagraph({ type: 'open', content: '' })
    const result = mainFile.isNonTodoistOpenTask(para)
    expect(result).toBe(false)
  })

  test('should return false for whitespace-only content', () => {
    const para = createMockParagraph({ type: 'open', content: '   ' })
    const result = mainFile.isNonTodoistOpenTask(para)
    expect(result).toBe(false)
  })

  test('should handle task with link without caret', () => {
    const para = createMockParagraph({
      type: 'open',
      content: 'Task [](https://app.todoist.com/app/task/12345)',
    })
    const result = mainFile.isNonTodoistOpenTask(para)
    expect(result).toBe(false)
  })
})

// ============================================================================
// isDateFilterKeyword
// ============================================================================
describe('isDateFilterKeyword', () => {
  test('should return true for "today"', () => {
    expect(mainFile.isDateFilterKeyword('today')).toBe(true)
  })

  test('should return true for "overdue"', () => {
    expect(mainFile.isDateFilterKeyword('overdue')).toBe(true)
  })

  test('should return true for "current"', () => {
    expect(mainFile.isDateFilterKeyword('current')).toBe(true)
  })

  test('should return true for "all"', () => {
    expect(mainFile.isDateFilterKeyword('all')).toBe(true)
  })

  test('should return true for "3 days"', () => {
    expect(mainFile.isDateFilterKeyword('3 days')).toBe(true)
  })

  test('should return true for "7 days"', () => {
    expect(mainFile.isDateFilterKeyword('7 days')).toBe(true)
  })

  test('should be case insensitive', () => {
    expect(mainFile.isDateFilterKeyword('TODAY')).toBe(true)
    expect(mainFile.isDateFilterKeyword('Overdue')).toBe(true)
    expect(mainFile.isDateFilterKeyword('CURRENT')).toBe(true)
  })

  test('should handle leading/trailing whitespace', () => {
    expect(mainFile.isDateFilterKeyword('  today  ')).toBe(true)
  })

  test('should return false for invalid keywords', () => {
    expect(mainFile.isDateFilterKeyword('tomorrow')).toBe(false)
    expect(mainFile.isDateFilterKeyword('next week')).toBe(false)
    expect(mainFile.isDateFilterKeyword('')).toBe(false)
    expect(mainFile.isDateFilterKeyword('Personal')).toBe(false)
  })
})

// ============================================================================
// parseDateFilterArg
// ============================================================================
describe('parseDateFilterArg', () => {
  test('should return "today" for today argument', () => {
    expect(mainFile.parseDateFilterArg('today')).toBe('today')
  })

  test('should return "overdue" for overdue argument', () => {
    expect(mainFile.parseDateFilterArg('overdue')).toBe('overdue')
  })

  test('should return "overdue | today" for current argument', () => {
    expect(mainFile.parseDateFilterArg('current')).toBe('overdue | today')
  })

  test('should return "3 days" for 3 days argument', () => {
    expect(mainFile.parseDateFilterArg('3 days')).toBe('3 days')
  })

  test('should return "7 days" for 7 days argument', () => {
    expect(mainFile.parseDateFilterArg('7 days')).toBe('7 days')
  })

  test('should return "all" for all argument', () => {
    expect(mainFile.parseDateFilterArg('all')).toBe('all')
  })

  test('should return null for empty string', () => {
    expect(mainFile.parseDateFilterArg('')).toBeNull()
  })

  test('should return null for null input', () => {
    expect(mainFile.parseDateFilterArg(null)).toBeNull()
  })

  test('should return null for undefined input', () => {
    expect(mainFile.parseDateFilterArg(undefined)).toBeNull()
  })

  test('should return null for unknown filter', () => {
    expect(mainFile.parseDateFilterArg('next week')).toBeNull()
  })

  test('should be case insensitive', () => {
    expect(mainFile.parseDateFilterArg('TODAY')).toBe('today')
    expect(mainFile.parseDateFilterArg('OVERDUE')).toBe('overdue')
  })
})

// ============================================================================
// filterTasksByDate
// ============================================================================
describe('filterTasksByDate', () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const twoDaysAgo = new Date(today)
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
  const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0]

  const twoDaysFromNow = new Date(today)
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2)
  const twoDaysFromNowStr = twoDaysFromNow.toISOString().split('T')[0]

  const fiveDaysFromNow = new Date(today)
  fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5)
  const fiveDaysFromNowStr = fiveDaysFromNow.toISOString().split('T')[0]

  const eightDaysFromNow = new Date(today)
  eightDaysFromNow.setDate(eightDaysFromNow.getDate() + 8)
  const eightDaysFromNowStr = eightDaysFromNow.toISOString().split('T')[0]

  const sampleTasks = [
    { id: '1', content: 'Task due today', due: { date: todayStr } },
    { id: '2', content: 'Task due yesterday', due: { date: yesterdayStr } },
    { id: '3', content: 'Task due tomorrow', due: { date: tomorrowStr } },
    { id: '4', content: 'Task due 2 days ago', due: { date: twoDaysAgoStr } },
    { id: '5', content: 'Task due in 2 days', due: { date: twoDaysFromNowStr } },
    { id: '6', content: 'Task due in 5 days', due: { date: fiveDaysFromNowStr } },
    { id: '7', content: 'Task due in 8 days', due: { date: eightDaysFromNowStr } },
    { id: '8', content: 'Task no due date' },
  ]

  test('should return all tasks when filter is "all"', () => {
    const result = mainFile.filterTasksByDate(sampleTasks, 'all')
    expect(result.length).toBe(8)
  })

  test('should return all tasks when filter is null', () => {
    const result = mainFile.filterTasksByDate(sampleTasks, null)
    expect(result.length).toBe(8)
  })

  test('should filter only today tasks', () => {
    const result = mainFile.filterTasksByDate(sampleTasks, 'today')
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('1')
  })

  test('should filter only overdue tasks', () => {
    const result = mainFile.filterTasksByDate(sampleTasks, 'overdue')
    expect(result.length).toBe(2)
    const ids = result.map((t) => t.id)
    expect(ids).toContain('2') // yesterday
    expect(ids).toContain('4') // 2 days ago
  })

  test('should filter overdue + today tasks (current)', () => {
    const result = mainFile.filterTasksByDate(sampleTasks, 'overdue | today')
    expect(result.length).toBe(3)
    const ids = result.map((t) => t.id)
    expect(ids).toContain('1') // today
    expect(ids).toContain('2') // yesterday
    expect(ids).toContain('4') // 2 days ago
  })

  test('should filter tasks within 3 days', () => {
    const result = mainFile.filterTasksByDate(sampleTasks, '3 days')
    // Should include: today, yesterday, 2 days ago, tomorrow, 2 days from now
    // All dates within 3 days from today (past dates count as within range)
    expect(result.length).toBeGreaterThanOrEqual(4)
    const ids = result.map((t) => t.id)
    expect(ids).toContain('1') // today
    expect(ids).toContain('2') // yesterday
    expect(ids).toContain('3') // tomorrow
    expect(ids).toContain('5') // 2 days from now
  })

  test('should filter tasks within 7 days', () => {
    const result = mainFile.filterTasksByDate(sampleTasks, '7 days')
    // Should include everything except 8 days from now and no due date
    const ids = result.map((t) => t.id)
    expect(ids).toContain('1')
    expect(ids).toContain('6') // 5 days from now
    expect(ids).not.toContain('7') // 8 days from now
    expect(ids).not.toContain('8') // no due date
  })

  test('should exclude tasks without due dates except for "all" filter', () => {
    const result = mainFile.filterTasksByDate(sampleTasks, 'today')
    const ids = result.map((t) => t.id)
    expect(ids).not.toContain('8')
  })

  test('should handle empty task array', () => {
    const result = mainFile.filterTasksByDate([], 'today')
    expect(result).toEqual([])
  })
})

// ============================================================================
// getTaskWithSubtasks
// ============================================================================
describe('getTaskWithSubtasks', () => {
  test('should return parent with its subtasks', () => {
    const allParagraphs = createTaskHierarchy()
    const result = mainFile.getTaskWithSubtasks(parentTaskParagraph, allParagraphs)

    expect(result.parent).toBe(parentTaskParagraph)
    expect(result.subtasks.length).toBe(2)
    expect(result.subtasks[0].content).toBe('Prepare presentation')
    expect(result.subtasks[1].content).toBe('Send invites')
  })

  test('should return empty subtasks array when no subtasks', () => {
    const para = createMockParagraph({ type: 'open', content: 'Solo task', indents: 0, lineIndex: 0 })
    const allParagraphs = [para]
    const result = mainFile.getTaskWithSubtasks(para, allParagraphs)

    expect(result.parent).toBe(para)
    expect(result.subtasks).toEqual([])
  })

  test('should stop at same or lower indent level', () => {
    const allParagraphs = createTaskHierarchy()
    const result = mainFile.getTaskWithSubtasks(parentTaskParagraph, allParagraphs)

    // Should not include nonSubtaskParagraph (same indent as parent)
    expect(result.subtasks.length).toBe(2)
    const subtaskContents = result.subtasks.map((s) => s.content)
    expect(subtaskContents).not.toContain('Unrelated task')
  })

  test('should not include subtasks that already have Todoist links', () => {
    const parent = createMockParagraph({ type: 'open', content: 'Parent', indents: 0, lineIndex: 0 })
    const subtaskWithLink = createMockParagraph({
      type: 'open',
      content: 'Subtask [^](https://app.todoist.com/app/task/123)',
      indents: 1,
      lineIndex: 1,
    })
    const subtaskWithoutLink = createMockParagraph({
      type: 'open',
      content: 'Normal subtask',
      indents: 1,
      lineIndex: 2,
    })
    const allParagraphs = [parent, subtaskWithLink, subtaskWithoutLink]

    const result = mainFile.getTaskWithSubtasks(parent, allParagraphs)
    expect(result.subtasks.length).toBe(1)
    expect(result.subtasks[0].content).toBe('Normal subtask')
  })

  test('should not include completed subtasks', () => {
    const parent = createMockParagraph({ type: 'open', content: 'Parent', indents: 0, lineIndex: 0 })
    const completedSubtask = createMockParagraph({
      type: 'done',
      content: 'Completed subtask',
      indents: 1,
      lineIndex: 1,
    })
    const openSubtask = createMockParagraph({
      type: 'open',
      content: 'Open subtask',
      indents: 1,
      lineIndex: 2,
    })
    const allParagraphs = [parent, completedSubtask, openSubtask]

    const result = mainFile.getTaskWithSubtasks(parent, allParagraphs)
    expect(result.subtasks.length).toBe(1)
    expect(result.subtasks[0].content).toBe('Open subtask')
  })

  test('should handle paragraph not in array', () => {
    const para = createMockParagraph({ type: 'open', content: 'Not in list', indents: 0, lineIndex: 99 })
    const allParagraphs = [createMockParagraph({ type: 'open', content: 'Other task', indents: 0, lineIndex: 0 })]

    const result = mainFile.getTaskWithSubtasks(para, allParagraphs)
    expect(result.parent).toBe(para)
    expect(result.subtasks).toEqual([])
  })
})

// ============================================================================
// parseCSVProjectNames
// ============================================================================
describe('parseCSVProjectNames', () => {
  test('should parse simple comma-separated values', () => {
    const result = mainFile.parseCSVProjectNames('ARPA-H, Personal, Work')
    expect(result).toEqual(['ARPA-H', 'Personal', 'Work'])
  })

  test('should handle single value', () => {
    const result = mainFile.parseCSVProjectNames('Personal')
    expect(result).toEqual(['Personal'])
  })

  test('should handle quoted values with internal commas', () => {
    const result = mainFile.parseCSVProjectNames('ARPA-H, "Work, Life Balance", Personal')
    expect(result).toEqual(['ARPA-H', 'Work, Life Balance', 'Personal'])
  })

  test('should trim whitespace', () => {
    const result = mainFile.parseCSVProjectNames('  ARPA-H  ,   Personal   ')
    expect(result).toEqual(['ARPA-H', 'Personal'])
  })

  test('should handle empty string', () => {
    const result = mainFile.parseCSVProjectNames('')
    expect(result).toEqual([])
  })

  test('should handle consecutive commas (skip empty values)', () => {
    const result = mainFile.parseCSVProjectNames('ARPA-H,, Personal')
    expect(result).toEqual(['ARPA-H', 'Personal'])
  })
})

// ============================================================================
// parseProjectIds
// ============================================================================
describe('parseProjectIds', () => {
  test('should handle single string ID', () => {
    const result = mainFile.parseProjectIds('12345')
    expect(result).toEqual(['12345'])
  })

  test('should handle array of IDs', () => {
    const result = mainFile.parseProjectIds(['12345', '67890'])
    expect(result).toEqual(['12345', '67890'])
  })

  test('should handle JSON array string', () => {
    const result = mainFile.parseProjectIds('["12345", "67890"]')
    expect(result).toEqual(['12345', '67890'])
  })

  test('should return empty array for null', () => {
    const result = mainFile.parseProjectIds(null)
    expect(result).toEqual([])
  })

  test('should return empty array for undefined', () => {
    const result = mainFile.parseProjectIds(undefined)
    expect(result).toEqual([])
  })

  test('should trim whitespace from values', () => {
    const result = mainFile.parseProjectIds(['  12345  ', '  67890  '])
    expect(result).toEqual(['12345', '67890'])
  })

  test('should handle numeric IDs in array', () => {
    const result = mainFile.parseProjectIds([12345, 67890])
    expect(result).toEqual(['12345', '67890'])
  })
})
