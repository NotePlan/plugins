/**
 * @jest-environment jsdom
 */

/**
 * Regression tests for the template preprocessor
 * Verifies that the preprocessor doesn't affect regular JavaScript code
 */

import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import TemplatingEngine from '../lib/TemplatingEngine'
import NPTemplating from '../lib/NPTemplating'
import { DataStore } from '@mocks/index'

// for Flow errors with Jest
/* global describe, beforeEach, afterEach, test, expect, jest */

// Helper to load test fixtures
const factory = async (factoryName = '') => {
  const factoryFilename = path.join(__dirname, 'factories', factoryName)
  if (existsSync(factoryFilename)) {
    return await fs.readFile(factoryFilename, 'utf-8')
  }
  return 'FACTORY_NOT_FOUND'
}

describe('NPTemplating preProcess regression tests', () => {
  let templatingEngine
  let originalConsoleLog
  let consoleOutput = []

  beforeEach(() => {
    templatingEngine = new TemplatingEngine()

    originalConsoleLog = console.log
    console.log = jest.fn((...args) => {
      consoleOutput.push(args.join(' '))
    })

    // Mock DataStore.invokePluginCommandByName
    DataStore.invokePluginCommandByName = jest.fn().mockResolvedValue('mocked result')
    global.DataStore = { ...DataStore, settings: { _logLevel: 'none' } }
  })

  afterEach(() => {
    console.log = originalConsoleLog
    consoleOutput = []
    jest.clearAllMocks()
  })

  test('should not affect regular JavaScript code in template', async () => {
    const template = await factory('day-header-template.ejs')
    const { newTemplateData } = await NPTemplating.preProcess(template)

    // Should not modify JavaScript variable declarations
    expect(newTemplateData).toContain('const dayNum = date.dayNumber')
    expect(newTemplateData).toContain('const isWeekday = dayNum >= 1 && dayNum <= 5')
    expect(newTemplateData).toContain('const isWeekend = !isWeekday')
  })

  test('should handle multiple adjacent code blocks without interference', async () => {
    const template = `
<% const x = 5; %>
<% await DataStore.invokePluginCommandByName('Test', 'plugin', ['{'prop1':'value1'}']) %>
<% const y = 10; %>
`
    const { newTemplateData } = await NPTemplating.preProcess(template)

    // Regular code should be unchanged
    expect(newTemplateData).toContain('const x = 5;')
    expect(newTemplateData).toContain('const y = 10;')
  })

  test('should not be confused by JSON-looking objects', async () => {
    const template = `
<% 
  // This shouldn't be processed as JSON
  const data = { numDays: 14, sectionHeading: 'Test' };
  
  // But this should be processed
  await DataStore.invokePluginCommandByName('Test', 'plugin', ['{'numDays':14}'])
%>`
    const { newTemplateData } = await NPTemplating.preProcess(template)

    // Regular object should be untouched
    expect(newTemplateData).toContain("const data = { numDays: 14, sectionHeading: 'Test' };")

    // But the command call should be processed
    expect(newTemplateData).toContain(`{'numDays':14}`)
  })

  test('should handle complex template with mixed code and DataStore calls', async () => {
    const template = await factory('complex-json-template.ejs')
    const { newTemplateData } = await NPTemplating.preProcess(template)

    // Regular JavaScript code should be untouched
    expect(newTemplateData).toContain('const dayNum = date.dayNumber')
    expect(newTemplateData).toContain('const isWeekday = dayNum >= 1 && dayNum <= 5')
    expect(newTemplateData).toContain("const data = { numDays: 14, sectionHeading: 'Test' }")
  })
})
