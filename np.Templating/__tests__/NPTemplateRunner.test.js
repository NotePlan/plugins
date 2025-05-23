// @flow

import { describe, expect, test, beforeAll } from '@jest/globals'

// Mock NotePlan environment
global.DataStore = {
  projectNoteByTitle: jest.fn(),
  calendarNoteByDate: jest.fn(),
  calendarNoteByDateString: jest.fn(),
  newNote: jest.fn(),
  invokePluginCommandByName: jest.fn(),
  settings: {},
}

global.Editor = {
  type: 'Notes',
  note: null,
  openNoteByDate: jest.fn(),
  openNoteByTitle: jest.fn(),
  openWeeklyNote: jest.fn(),
  openNoteByFilename: jest.fn(),
}

global.CommandBar = {
  prompt: jest.fn(),
}

global.NotePlan = {
  environment: {
    templateFolder: '@Templates',
  },
}

describe('NPTemplateRunner', () => {
  let addFrontmatterToTemplate

  beforeAll(() => {
    const NPTemplateRunner = require('../src/NPTemplateRunner')
    addFrontmatterToTemplate = NPTemplateRunner.addFrontmatterToTemplate
  })

  test('addFrontmatterToTemplate function should exist', () => {
    expect(addFrontmatterToTemplate).toBeDefined()
    expect(typeof addFrontmatterToTemplate).toBe('function')
  })
})
