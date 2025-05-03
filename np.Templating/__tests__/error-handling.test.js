/**
 * @jest-environment jsdom
 */

/**
 * Tests for error handling in template preprocessing and rendering
 * Specifically focusing on JSON validation in DataStore.invokePluginCommandByName calls
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
  const factoryFilename = path.join(__dirname, 'factories-new', factoryName)
  if (existsSync(factoryFilename)) {
    return await fs.readFile(factoryFilename, 'utf-8')
  }
  return 'FACTORY_NOT_FOUND'
}

describe('JSON error detection in preProcess', () => {
  let consoleLogMock
  let consoleErrorMock
  let logDebugMock
  let logErrorMock
  let pluginJsonMock

  beforeEach(() => {
    // Mock console functions
    consoleLogMock = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorMock = jest.spyOn(console, 'error').mockImplementation()

    // Define the pluginJson mock for the errors
    pluginJsonMock = { name: 'np.Templating', version: '1.0.0' }

    // Add the mocks to the global object
    global.pluginJson = pluginJsonMock
    global.logDebug = logDebugMock = jest.fn()
    global.logError = logErrorMock = jest.fn()

    // Make the mock available directly in the NPTemplating module's scope
    jest.mock('../lib/NPTemplating', () => {
      const originalModule = jest.requireActual('../lib/NPTemplating')
      return {
        ...originalModule,
        logDebug: global.logDebug,
        logError: global.logError,
        pluginJson: global.pluginJson,
      }
    })

    // Mock DataStore.invokePluginCommandByName
    DataStore.invokePluginCommandByName = jest.fn().mockResolvedValue('mocked result')
  })

  afterEach(() => {
    consoleLogMock.mockRestore()
    consoleErrorMock.mockRestore()
    delete global.logDebug
    delete global.logError
    delete global.pluginJson
    jest.clearAllMocks()
    jest.resetModules()
  })


describe('Error handling in template rendering', () => {
  let consoleLogMock
  let consoleErrorMock
  let logDebugMock
  let logErrorMock
  let pluginJsonMock
  let templatingEngine

  beforeEach(() => {
    templatingEngine = new TemplatingEngine()

    // Mock console functions
    consoleLogMock = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorMock = jest.spyOn(console, 'error').mockImplementation()

    // Define the pluginJson mock for the errors
    pluginJsonMock = { name: 'np.Templating', version: '1.0.0' }

    // Add the mocks to the global object
    global.pluginJson = pluginJsonMock
    global.logDebug = logDebugMock = jest.fn()
    global.logError = logErrorMock = jest.fn()

    // Make the mock available directly in the NPTemplating module's scope
    jest.mock('../lib/NPTemplating', () => {
      const originalModule = jest.requireActual('../lib/NPTemplating')
      return {
        ...originalModule,
        logDebug: global.logDebug,
        logError: global.logError,
        pluginJson: global.pluginJson,
      }
    })

    // Mock DataStore.invokePluginCommandByName
    DataStore.invokePluginCommandByName = jest.fn().mockResolvedValue('mocked result')
  })

  afterEach(() => {
    consoleLogMock.mockRestore()
    consoleErrorMock.mockRestore()
    delete global.logDebug
    delete global.logError
    delete global.pluginJson
    jest.clearAllMocks()
    jest.resetModules()
  })

  test('should report the correct line number for JavaScript syntax errors', async () => {
    const template = await factory('invalid-line-error.ejs')
    const result = await templatingEngine.render(template, {})

    // Should contain an error message indicating the syntax error
    expect(result).toContain('Error')
    expect(result).toContain('Unexpected identifier')

    // Should show the error context with line numbers
    expect(result).toMatch(/\d+\|.*if.*\(testVar3.*===.*true/)
    expect(result).toMatch(/\d+\|.*console\.log/)
  })

  test('should halt rendering when a critical error is detected', async () => {
    const template = await factory('stop-on-json-error.ejs')

    // First validate that JSON errors are detected
    const { newTemplateData, jsonErrors, criticalError } = await NPTemplating.preProcess(template)

    // Verify errors were detected
    expect(logErrorMock).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('JSON error at line'))

    // The criticalError flag should be set
    expect(criticalError).toBe(true)

    // At least one error should be marked as critical
    expect(jsonErrors.some((err) => err.critical)).toBe(true)

    // The rendered template should contain the error rather than executing
    const result = await templatingEngine.render(template, {})

    // The result should contain an error message rather than the counter output
    expect(result).toContain('critical errors')
    expect(result).not.toContain('Execution reached: 4')
  })
})
