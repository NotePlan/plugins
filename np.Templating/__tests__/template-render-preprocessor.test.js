/**
 * @jest-environment jsdom
 */

/**
 * Tests for template preprocessing integration
 */

import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import TemplatingEngine from '../lib/TemplatingEngine'
import NPTemplating from '../lib/NPTemplating'
import { DataStore, NotePlan } from '@mocks/index'

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

describe('Template preprocessing integration', () => {
  let templatingEngine
  let originalConsoleLog
  let consoleOutput = []

  beforeEach(() => {
    templatingEngine = new TemplatingEngine()

    // Mock console functions
    originalConsoleLog = console.log
    console.log = jest.fn((...args) => {
      consoleOutput.push(args.join(' '))
    })

    // Make DataStore available globally for template rendering
    global.DataStore = DataStore

    // Mock DataStore.invokePluginCommandByName to just return a test value
    DataStore.invokePluginCommandByName = jest.fn().mockResolvedValue('mocked result')
  })

  afterEach(() => {
    console.log = originalConsoleLog
    consoleOutput = []

    // Clean up global
    delete global.DataStore

    jest.clearAllMocks()
  })

  test('should preprocess and format JSON in DataStore calls', async () => {
    // Test direct preprocessing without rendering
    const template = `<% await DataStore.invokePluginCommandByName('Test', 'plugin', ['{'key':'value'}']) %>`

    // Test the preProcess method directly
    const { newTemplateData } = await NPTemplating.preProcess(template, {})

    // Verify JSON formatting happened correctly
    expect(newTemplateData).toContain('"key"') // Double-quoted key
    expect(newTemplateData).toContain('"value"') // Double-quoted value
    expect(newTemplateData).not.toContain("'key'") // No more single-quoted key
  })

  test('should render template with error handling', async () => {
    const template = `<% const invalid; %>` // Syntax error

    const result = await templatingEngine.render(template, {})

    // Should return an error message
    expect(result).toContain('Error')
  })
})
