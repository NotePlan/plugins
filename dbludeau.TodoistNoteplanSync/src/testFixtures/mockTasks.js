// @flow
/**
 * Mock Todoist task objects for testing
 */

export type MockTodoistTask = {
  id: string,
  content: string,
  is_completed: boolean,
  priority: number,
  due?: {
    date: string,
    string?: string,
    datetime?: string,
    is_recurring: boolean,
    timezone?: string,
  },
  labels: Array<string>,
  project_id: string,
  section_id?: string,
  parent_id?: string,
  url: string,
}

/**
 * Sample open task with no due date
 */
export const openTaskNoDue: MockTodoistTask = {
  id: '12345678',
  content: 'Buy groceries',
  is_completed: false,
  priority: 1,
  labels: [],
  project_id: '2203306141',
  url: 'https://app.todoist.com/app/task/12345678',
}

/**
 * Sample open task with due date today
 */
export const openTaskDueToday: MockTodoistTask = {
  id: '12345679',
  content: 'Call the bank',
  is_completed: false,
  priority: 2,
  due: {
    date: new Date().toISOString().split('T')[0], // today's date
    string: 'today',
    is_recurring: false,
  },
  labels: ['urgent'],
  project_id: '2203306141',
  url: 'https://app.todoist.com/app/task/12345679',
}

/**
 * Sample completed task
 */
export const completedTask: MockTodoistTask = {
  id: '12345680',
  content: 'Review documents',
  is_completed: true,
  priority: 1,
  labels: [],
  project_id: '2203306141',
  url: 'https://app.todoist.com/app/task/12345680',
}

/**
 * Sample high priority task (!!!)
 */
export const highPriorityTask: MockTodoistTask = {
  id: '12345681',
  content: 'Submit tax return',
  is_completed: false,
  priority: 4, // Todoist priority 4 = highest
  due: {
    date: '2025-04-15',
    string: 'Apr 15',
    is_recurring: false,
  },
  labels: ['taxes', 'important'],
  project_id: '2203306141',
  url: 'https://app.todoist.com/app/task/12345681',
}

/**
 * Sample task with subtask (parent)
 */
export const parentTask: MockTodoistTask = {
  id: '12345682',
  content: 'Project kickoff',
  is_completed: false,
  priority: 3,
  labels: ['project'],
  project_id: '2203306142',
  url: 'https://app.todoist.com/app/task/12345682',
}

/**
 * Sample subtask
 */
export const subtask: MockTodoistTask = {
  id: '12345683',
  content: 'Prepare presentation',
  is_completed: false,
  priority: 1,
  labels: [],
  project_id: '2203306142',
  parent_id: '12345682',
  url: 'https://app.todoist.com/app/task/12345683',
}

/**
 * Sample overdue task
 */
export const overdueTask: MockTodoistTask = {
  id: '12345684',
  content: 'Follow up on email',
  is_completed: false,
  priority: 2,
  due: {
    date: '2024-12-01', // past date
    string: 'Dec 1',
    is_recurring: false,
  },
  labels: [],
  project_id: '2203306141',
  url: 'https://app.todoist.com/app/task/12345684',
}

/**
 * API response for fetching all tasks (paginated)
 */
export const taskListResponse = {
  results: [openTaskNoDue, openTaskDueToday, highPriorityTask, overdueTask],
  next_cursor: null,
}

/**
 * API response with pagination cursor
 */
export const taskListWithCursor = {
  results: [openTaskNoDue, openTaskDueToday],
  next_cursor: 'abc123cursor',
}

/**
 * Second page of paginated response
 */
export const taskListPage2 = {
  results: [highPriorityTask, overdueTask],
  next_cursor: null,
}

/**
 * Sample project response
 */
export const sampleProject = {
  id: '2203306141',
  name: 'Personal',
  color: 'charcoal',
  is_favorite: false,
  is_inbox_project: false,
  view_style: 'list',
}

/**
 * Sample section response
 */
export const sampleSection = {
  id: '7025',
  project_id: '2203306141',
  name: 'Errands',
  order: 1,
}

/**
 * Helper to create a mock task with custom properties
 */
export function createMockTask(overrides: Object = {}): MockTodoistTask {
  return {
    id: String(Math.floor(Math.random() * 100000000)),
    content: 'Test task',
    is_completed: false,
    priority: 1,
    labels: [],
    project_id: '2203306141',
    url: 'https://app.todoist.com/app/task/00000000',
    ...overrides,
  }
}
