/* global jest, describe, test, expect, beforeAll, beforeEach, afterEach */
// @flow
/**
 * Phase 3: Integration Tests with NotePlan Mocks
 * Tests for command functions with mocked Editor/Note
 */

import { CustomConsole } from '@jest/console'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph, simpleFormatter } from '@mocks/index'
import { FetchMock } from '@mocks/Fetch.mock'
import * as mainFile from '../src/NPPluginMain'
import { createMockParagraph, createNoteParagraphs } from '../src/testFixtures/mockParagraphs'
import { openTaskNoDue, completedTask, createMockTask } from '../src/testFixtures/mockTasks'

const PLUGIN_NAME = 'dbludeau.TodoistNoteplanSync'

let originalFetch: any

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'none'
  originalFetch = global.fetch
})

beforeEach(() => {
  // Reset DataStore settings before each test
  DataStore.settings = {
    ...DataStore.settings,
    apiToken: 'test-api-token',
    todoistFolder: 'Todoist',
    projectDateFilter: 'overdue | today',
    _logLevel: 'none',
  }

  // Reset CommandBar prompt mock
  CommandBar.prompt = jest.fn().mockResolvedValue(undefined)
})

afterEach(() => {
  global.fetch = originalFetch
  jest.clearAllMocks()
})

// ============================================================================
// syncStatusOnly
// ============================================================================
describe('syncStatusOnly', () => {
  describe('NP done + Todoist open → closes Todoist', () => {
    test('should close Todoist task when NP task is marked done', async () => {
      // Set up a note with a done task that has a Todoist link
      const paragraphs = [
        createMockParagraph({
          type: 'title',
          content: 'Test Note',
          lineIndex: 0,
        }),
        createMockParagraph({
          type: 'done', // NotePlan task is done
          content: 'Task 1 [^](https://app.todoist.com/app/task/12345)',
          lineIndex: 1,
        }),
      ]

      const note = new Note({ paragraphs })
      Editor.note = note

      // Track API calls
      let closeTaskCalled = false
      let fetchedTaskId = ''

      const fm = new FetchMock([
        // fetchTodoistTask returns an OPEN task
        {
          match: { url: 'tasks/12345' },
          response: JSON.stringify({
            id: '12345',
            content: 'Task 1',
            is_completed: false, // Todoist task is open
          }),
        },
        // closeTodoistTask endpoint
        {
          match: { url: 'tasks/12345/close' },
          response: JSON.stringify({ success: true }),
        },
      ])

      global.fetch = (url, opts) => {
        if (url.includes('/close')) {
          closeTaskCalled = true
        }
        if (url.includes('tasks/') && !url.includes('/close')) {
          fetchedTaskId = url.match(/tasks\/(\d+)/)?.[1] || ''
        }
        return fm.fetch(url, opts)
      }

      await mainFile.syncStatusOnly()

      expect(fetchedTaskId).toBe('12345')
      expect(closeTaskCalled).toBe(true)
      expect(CommandBar.prompt).toHaveBeenCalled()
    })
  })

  describe('NP open + Todoist done → marks NP done', () => {
    test('should mark NotePlan task done when Todoist task is completed', async () => {
      // Set up a note with an open task that has a Todoist link
      const paragraphs = [
        createMockParagraph({
          type: 'title',
          content: 'Test Note',
          lineIndex: 0,
        }),
        createMockParagraph({
          type: 'open', // NotePlan task is open
          content: 'Task 1 [^](https://app.todoist.com/app/task/12345)',
          lineIndex: 1,
        }),
      ]

      const note = new Note({ paragraphs })
      Editor.note = note
      Editor.updateParagraph = jest.fn()

      const fm = new FetchMock([
        // fetchTodoistTask returns a COMPLETED task
        {
          match: { url: 'tasks/12345' },
          response: JSON.stringify({
            id: '12345',
            content: 'Task 1',
            is_completed: true, // Todoist task is completed
          }),
        },
      ])

      global.fetch = (url, opts) => fm.fetch(url, opts)

      await mainFile.syncStatusOnly()

      // The paragraph type should be updated to 'done'
      expect(Editor.updateParagraph).toHaveBeenCalled()
      expect(CommandBar.prompt).toHaveBeenCalled()
    })
  })

  describe('Already synced → no change', () => {
    test('should not make changes when both NP and Todoist are done', async () => {
      const paragraphs = [
        createMockParagraph({
          type: 'done',
          content: 'Task 1 [^](https://app.todoist.com/app/task/12345)',
          lineIndex: 0,
        }),
      ]

      const note = new Note({ paragraphs })
      Editor.note = note
      Editor.updateParagraph = jest.fn()

      let closeTaskCalled = false

      const fm = new FetchMock([
        {
          match: { url: 'tasks/12345' },
          response: JSON.stringify({
            id: '12345',
            content: 'Task 1',
            is_completed: true, // Both are done
          }),
        },
      ])

      global.fetch = (url, opts) => {
        if (url.includes('/close')) {
          closeTaskCalled = true
        }
        return fm.fetch(url, opts)
      }

      await mainFile.syncStatusOnly()

      // Should not call close (already done) or update (already matches)
      expect(closeTaskCalled).toBe(false)
      expect(Editor.updateParagraph).not.toHaveBeenCalled()
    })

    test('should not make changes when both NP and Todoist are open', async () => {
      const paragraphs = [
        createMockParagraph({
          type: 'open',
          content: 'Task 1 [^](https://app.todoist.com/app/task/12345)',
          lineIndex: 0,
        }),
      ]

      const note = new Note({ paragraphs })
      Editor.note = note
      Editor.updateParagraph = jest.fn()

      let closeTaskCalled = false

      const fm = new FetchMock([
        {
          match: { url: 'tasks/12345' },
          response: JSON.stringify({
            id: '12345',
            content: 'Task 1',
            is_completed: false, // Both are open
          }),
        },
      ])

      global.fetch = (url, opts) => {
        if (url.includes('/close')) {
          closeTaskCalled = true
        }
        return fm.fetch(url, opts)
      }

      await mainFile.syncStatusOnly()

      expect(closeTaskCalled).toBe(false)
      expect(Editor.updateParagraph).not.toHaveBeenCalled()
    })
  })

  describe('No Todoist tasks in note', () => {
    test('should report no Todoist tasks when note has no linked tasks', async () => {
      const paragraphs = [
        createMockParagraph({
          type: 'open',
          content: 'Regular task without Todoist link',
          lineIndex: 0,
        }),
      ]

      const note = new Note({ paragraphs })
      Editor.note = note

      await mainFile.syncStatusOnly()

      expect(CommandBar.prompt).toHaveBeenCalledWith(
        'Status Sync Complete',
        expect.stringContaining('No Todoist-linked tasks')
      )
    })
  })

  describe('Multiple tasks', () => {
    test('should process multiple Todoist-linked tasks', async () => {
      const paragraphs = [
        createMockParagraph({
          type: 'done', // NP done, Todoist open → close
          content: 'Task 1 [^](https://app.todoist.com/app/task/11111)',
          lineIndex: 0,
        }),
        createMockParagraph({
          type: 'open', // NP open, Todoist done → mark done
          content: 'Task 2 [^](https://app.todoist.com/app/task/22222)',
          lineIndex: 1,
        }),
        createMockParagraph({
          type: 'open', // Both open → no change
          content: 'Task 3 [^](https://app.todoist.com/app/task/33333)',
          lineIndex: 2,
        }),
      ]

      const note = new Note({ paragraphs })
      Editor.note = note
      Editor.updateParagraph = jest.fn()

      let closeCalls = 0

      const fm = new FetchMock([
        {
          match: { url: 'tasks/11111' },
          response: JSON.stringify({ id: '11111', is_completed: false }), // Open in Todoist
        },
        {
          match: { url: 'tasks/11111/close' },
          response: JSON.stringify({ success: true }),
        },
        {
          match: { url: 'tasks/22222' },
          response: JSON.stringify({ id: '22222', is_completed: true }), // Done in Todoist
        },
        {
          match: { url: 'tasks/33333' },
          response: JSON.stringify({ id: '33333', is_completed: false }), // Open in Todoist
        },
      ])

      global.fetch = (url, opts) => {
        if (url.includes('/close')) {
          closeCalls++
        }
        return fm.fetch(url, opts)
      }

      await mainFile.syncStatusOnly()

      // Task 1: NP done, Todoist open → should close in Todoist
      expect(closeCalls).toBe(1)
      // Task 2: NP open, Todoist done → should update in NP
      expect(Editor.updateParagraph).toHaveBeenCalledTimes(1)
    })
  })
})

// ============================================================================
// convertToTodoistTask
// ============================================================================
describe('convertToTodoistTask', () => {
  describe('Single task conversion', () => {
    test('should convert single open task to Todoist', async () => {
      const para = createMockParagraph({
        type: 'open',
        content: 'Buy groceries',
        lineIndex: 0,
      })

      const note = new Note({ paragraphs: [para] })
      Editor.note = note
      Editor.selectedParagraphs = [para]
      Editor.selection = { start: 0, end: 10 }
      Editor.updateParagraph = jest.fn()

      const createdTask = { id: '99999', content: 'Buy groceries' }
      const fm = new FetchMock([
        {
          match: { url: '/tasks' },
          response: JSON.stringify(createdTask),
        },
      ])

      global.fetch = (url, opts) => fm.fetch(url, opts)

      await mainFile.convertToTodoistTask()

      // Should update paragraph with Todoist link
      expect(Editor.updateParagraph).toHaveBeenCalled()
      expect(CommandBar.prompt).toHaveBeenCalledWith(
        'Tasks converted',
        expect.stringContaining('1 task')
      )
    })
  })

  describe('Skips already linked tasks', () => {
    test('should not convert task that already has Todoist link', async () => {
      const para = createMockParagraph({
        type: 'open',
        content: 'Task [^](https://app.todoist.com/app/task/12345)',
        lineIndex: 0,
      })

      const note = new Note({ paragraphs: [para] })
      Editor.note = note
      Editor.selectedParagraphs = [para]
      Editor.selection = { start: 0, end: 50 }
      Editor.updateParagraph = jest.fn()

      let fetchCalled = false
      global.fetch = (url, opts) => {
        fetchCalled = true
        return JSON.stringify({})
      }

      await mainFile.convertToTodoistTask()

      // Should not call fetch to create a new task
      expect(fetchCalled).toBe(false)
      expect(CommandBar.prompt).toHaveBeenCalledWith(
        'Already Todoist tasks',
        expect.any(String)
      )
    })
  })

  describe('Multiple selected tasks', () => {
    test('should convert multiple selected tasks', async () => {
      const para1 = createMockParagraph({
        type: 'open',
        content: 'Task 1',
        lineIndex: 0,
      })
      const para2 = createMockParagraph({
        type: 'open',
        content: 'Task 2',
        lineIndex: 1,
      })

      const note = new Note({ paragraphs: [para1, para2] })
      Editor.note = note
      Editor.selectedParagraphs = [para1, para2]
      Editor.selection = { start: 0, end: 20 }
      Editor.updateParagraph = jest.fn()

      let createCalls = 0
      global.fetch = (url, opts) => {
        if (url.includes('/tasks') && opts?.method === 'POST') {
          createCalls++
          return JSON.stringify({ id: String(99999 + createCalls), content: 'Task' })
        }
        return JSON.stringify({})
      }

      await mainFile.convertToTodoistTask()

      expect(createCalls).toBe(2)
      expect(Editor.updateParagraph).toHaveBeenCalledTimes(2)
    })
  })

  describe('Task with subtasks', () => {
    test('should convert parent and subtasks with parent_id', async () => {
      const parent = createMockParagraph({
        type: 'open',
        content: 'Parent task',
        indents: 0,
        lineIndex: 0,
      })
      const subtask1 = createMockParagraph({
        type: 'open',
        content: 'Subtask 1',
        indents: 1,
        lineIndex: 1,
      })
      const subtask2 = createMockParagraph({
        type: 'open',
        content: 'Subtask 2',
        indents: 1,
        lineIndex: 2,
      })

      const note = new Note({ paragraphs: [parent, subtask1, subtask2] })
      Editor.note = note
      Editor.selectedParagraphs = [parent]
      Editor.selection = { start: 0, end: 10 }
      Editor.updateParagraph = jest.fn()

      const createdTasks: Array<Object> = []
      global.fetch = (url, opts) => {
        if (url.includes('/tasks') && opts?.method === 'POST') {
          const body = JSON.parse(opts.body || '{}')
          const taskId = String(99999 + createdTasks.length)
          createdTasks.push({ id: taskId, ...body })
          return JSON.stringify({ id: taskId, content: body.content })
        }
        return JSON.stringify({})
      }

      await mainFile.convertToTodoistTask()

      // Should create parent + 2 subtasks
      expect(createdTasks.length).toBe(3)
      // First task (parent) should have no parent_id
      expect(createdTasks[0].parent_id).toBeUndefined()
      // Subtasks should have parent_id set to parent's ID
      expect(createdTasks[1].parent_id).toBe('99999')
      expect(createdTasks[2].parent_id).toBe('99999')
    })
  })

  describe('Task with metadata', () => {
    test('should parse and send priority, date, and labels', async () => {
      const para = createMockParagraph({
        type: 'open',
        content: '!! Important meeting >2025-04-01 #work #urgent',
        lineIndex: 0,
      })

      const note = new Note({ paragraphs: [para] })
      Editor.note = note
      Editor.selectedParagraphs = [para]
      Editor.selection = { start: 0, end: 50 }
      Editor.updateParagraph = jest.fn()

      let capturedBody: ?Object = null
      global.fetch = (url, opts) => {
        if (url.includes('/tasks') && opts?.method === 'POST') {
          capturedBody = JSON.parse(opts.body || '{}')
          return JSON.stringify({ id: '99999', content: capturedBody?.content || '' })
        }
        return JSON.stringify({})
      }

      await mainFile.convertToTodoistTask()

      expect(capturedBody).not.toBeNull()
      expect(capturedBody?.priority).toBe(3) // !! = p3
      expect(capturedBody?.due_date).toBe('2025-04-01')
      expect(capturedBody?.labels).toContain('work')
      expect(capturedBody?.labels).toContain('urgent')
      // Content should be cleaned
      expect(capturedBody?.content).toBe('Important meeting')
    })
  })

  describe('No tasks found', () => {
    test('should show message when no open tasks in selection', async () => {
      const para = createMockParagraph({
        type: 'text',
        content: 'Just some text',
        lineIndex: 0,
      })

      const note = new Note({ paragraphs: [para] })
      Editor.note = note
      Editor.selectedParagraphs = [para]
      Editor.selection = { start: 0, end: 15 }

      await mainFile.convertToTodoistTask()

      expect(CommandBar.prompt).toHaveBeenCalledWith(
        'No open tasks found',
        expect.any(String)
      )
    })
  })
})

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================
describe('Error handling', () => {
  test('syncStatusOnly should handle API errors gracefully', async () => {
    const para = createMockParagraph({
      type: 'done',
      content: 'Task [^](https://app.todoist.com/app/task/12345)',
      lineIndex: 0,
    })

    const note = new Note({ paragraphs: [para] })
    Editor.note = note

    // Simulate API error
    global.fetch = () => {
      throw new Error('Network error')
    }

    // Should not throw
    await expect(mainFile.syncStatusOnly()).resolves.not.toThrow()
    expect(CommandBar.prompt).toHaveBeenCalled()
  })

  test('convertToTodoistTask should handle no note open', async () => {
    Editor.note = null

    await mainFile.convertToTodoistTask()

    // Should not throw, and not call fetch
    // The function should return early
  })

  test('syncStatusOnly should handle no note open', async () => {
    Editor.note = null

    await mainFile.syncStatusOnly()

    // Should not throw
  })
})

// ============================================================================
// Cancelled task handling
// ============================================================================
describe('Cancelled tasks', () => {
  test('syncStatusOnly should close Todoist task when NP task is cancelled', async () => {
    const para = createMockParagraph({
      type: 'cancelled', // NotePlan task is cancelled
      content: 'Cancelled task [^](https://app.todoist.com/app/task/12345)',
      lineIndex: 0,
    })

    const note = new Note({ paragraphs: [para] })
    Editor.note = note

    let closeCalled = false

    const fm = new FetchMock([
      {
        match: { url: 'tasks/12345' },
        response: JSON.stringify({
          id: '12345',
          is_completed: false, // Todoist is still open
        }),
      },
      {
        match: { url: 'tasks/12345/close' },
        response: JSON.stringify({ success: true }),
      },
    ])

    global.fetch = (url, opts) => {
      if (url.includes('/close')) {
        closeCalled = true
      }
      return fm.fetch(url, opts)
    }

    await mainFile.syncStatusOnly()

    // Cancelled in NP should also close in Todoist
    expect(closeCalled).toBe(true)
  })
})
