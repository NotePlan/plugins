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

    // Should still process the JSON in DataStore.invokePluginCommandByName calls
    expect(newTemplateData).toContain('"numDays":')
    expect(newTemplateData).toContain('"sectionHeading":')
    expect(newTemplateData).toContain('"runSilently":')

    // The original single quotes should be gone
    expect(newTemplateData).not.toContain("'numDays':")
    expect(newTemplateData).not.toContain("'sectionHeading':")
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

    // Should process JSON in the middle block
    expect(newTemplateData).toContain('"prop1":')
    expect(newTemplateData).not.toContain("'prop1':")
  })

  test('should not be confused by similar but unrelated code', async () => {
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
    expect(newTemplateData).toContain('"numDays":')
    expect(newTemplateData).not.toContain("'numDays':")
  })

  test('should handle complex template with mixed code and DataStore calls', async () => {
    const template = await factory('complex-json-template.ejs')
    const { newTemplateData } = await NPTemplating.preProcess(template)

    // Regular JavaScript code should be untouched
    expect(newTemplateData).toContain('const dayNum = date.dayNumber')
    expect(newTemplateData).toContain('const isWeekday = dayNum >= 1 && dayNum <= 5')
    expect(newTemplateData).toContain("const data = { numDays: 14, sectionHeading: 'Test' }")

    // DataStore calls should be processed with double quotes (check the format being used)
    expect(newTemplateData).toContain('"numDays":')
    expect(newTemplateData).toContain('"sectionHeading":')
    expect(newTemplateData).toContain('"message":')

    // Original single quotes in JSON should be gone
    expect(newTemplateData).not.toContain("'numDays':")
    expect(newTemplateData).not.toContain("'sectionHeading':")
  })
})

describe('Template preprocessor regression tests', () => {
  test('should convert single-quoted JSON to properly formatted JSON in DataStore calls', async () => {
    // Test with a DataStore call that has single-quoted JSON
    const template = `<% await DataStore.invokePluginCommandByName('Command1','plugin.id',['{'numDays':14, 'sectionHeading':'Test Section'}']) %>`

    // Call preProcess directly to test the transformation
    const { newTemplateData } = await NPTemplating.preProcess(template, {})

    // The JSON should be properly formatted with double quotes
    expect(newTemplateData).toContain('"numDays":14')
    expect(newTemplateData).toContain('"sectionHeading":')
    expect(newTemplateData).not.toContain("'numDays'")
    expect(newTemplateData).not.toContain("'sectionHeading'")
  })

  test('should not affect regular JavaScript code in template', async () => {
    // Test with some regular JavaScript that shouldn't be affected
    const template = `<% const obj = { numDays: 14 }; %>\n<% const result = await someFunction(); %>`

    // Call preProcess
    const { newTemplateData } = await NPTemplating.preProcess(template, {})

    // The JavaScript code should remain unchanged
    expect(newTemplateData).toBe(template)
  })

  test('should handle complex template with mixed code and DataStore calls', async () => {
    // Test with a complex template that has both regular code and DataStore calls
    const template = `
<% // Regular JavaScript
const dayNumber = 14;
const sectionName = "Test Section";

// DataStore calls with single-quoted JSON
await DataStore.invokePluginCommandByName('Command1','plugin.id',['{'numDays':14, 'sectionHeading':'Test Section'}'])

// Object literal in regular code
const config = { 
  days: dayNumber,
  section: sectionName
};
%>`

    // Call preProcess
    const { newTemplateData } = await NPTemplating.preProcess(template, {})

    // DataStore calls should be transformed
    expect(newTemplateData).toContain('"numDays":14')
    expect(newTemplateData).toContain('"sectionHeading":')

    // Regular code should be preserved
    expect(newTemplateData).toContain('const dayNumber = 14;')
    expect(newTemplateData).toContain('const sectionName = "Test Section";')
    expect(newTemplateData).toContain('const config = {')
  })
})
