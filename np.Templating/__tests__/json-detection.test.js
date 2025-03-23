/**
 * @jest-environment jsdom
 */

/**
 * Tests for JSON error detection in template preprocessing
 * These tests focus specifically on the enhanced JSON validation capabilities
 */

import NPTemplating from '../lib/NPTemplating'
import { DataStore } from '@mocks/index'

// for Flow errors with Jest
/* global describe, beforeEach, afterEach, test, expect, jest */

describe('JSON error detection', () => {
  let consoleLogMock
  let consoleErrorMock
  let logDebugMock
  let logErrorMock
  let pluginJsonMock
  let context

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

    // Standard context object for testing
    context = {
      templateData: '',
      sessionData: {},
      jsonErrors: [],
      criticalError: false,
      override: {},
    }
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

  test('should detect missing closing brace in JSON object', async () => {
    const invalidJson = '{"numDays":14, "sectionHeading":"Test Section"'
    context.templateData = `<% await DataStore.invokePluginCommandByName('Test Command','plugin.id',['${invalidJson}']) %>`

    await NPTemplating._processJsonInDataStoreCalls(context)

    expect(context.criticalError).toBe(true)
    expect(context.jsonErrors.length).toBeGreaterThan(0)
    expect(context.jsonErrors.some((err) => err.error.includes('Unclosed JSON'))).toBe(true)
    expect(context.jsonErrors[0].lineNumber).toBe(1) // Should report line number 1
  })

  test('should detect mixed quotes in JSON object properties', async () => {
    const invalidJson = '{"numDays":14, \'sectionHeading\':"Test Section"}'
    context.templateData = `<% await DataStore.invokePluginCommandByName('Another Command','plugin.id',['${invalidJson}']) %>`

    await NPTemplating._processJsonInDataStoreCalls(context)

    expect(context.criticalError).toBe(true)
    expect(context.jsonErrors.some((err) => err.error.includes('Mixed quote styles'))).toBe(true)
  })

  test('should detect unescaped quotes in JSON string values', async () => {
    const invalidJson = '{"message":"This "contains" quotes"}'
    context.templateData = `<% await DataStore.invokePluginCommandByName('Third Command','plugin.id',['${invalidJson}']) %>`

    await NPTemplating._processJsonInDataStoreCalls(context)

    expect(context.criticalError).toBe(true)
    expect(context.jsonErrors.length).toBeGreaterThan(0)
  })

  test('should handle multi-line JSON and report correct line numbers', async () => {
    context.templateData = `Line 1
    Line 2
    <% await DataStore.invokePluginCommandByName('Test Command','plugin.id',['{
      "numDays":14, 
      "sectionHeading":"Test Section"
    ']) %>
    Line 5
    Line 6`

    await NPTemplating._processJsonInDataStoreCalls(context)

    expect(context.criticalError).toBe(true)
    expect(context.jsonErrors.some((err) => err.lineNumber === 3)).toBe(true)
  })

  test('should fix single-quoted properties in JSON objects', async () => {
    context.templateData = `<% await DataStore.invokePluginCommandByName('Valid Command','plugin.id',['{\'numDays\':14, \'sectionHeading\':\'Test Section\'}']) %>`

    await NPTemplating._processJsonInDataStoreCalls(context)

    // Should have converted single-quoted properties to double-quoted properties
    expect(context.templateData).toContain('"numDays"')
    expect(context.templateData).toContain('"sectionHeading"')
    expect(context.templateData).toContain('"Test Section"')
    expect(context.criticalError).toBe(false) // No critical errors after fixing
  })

  test('should preserve original JSON when error detected', async () => {
    const invalidJson = '{"message":"This "contains" quotes"}'
    context.templateData = `<% await DataStore.invokePluginCommandByName('Third Command','plugin.id',['${invalidJson}']) %>`

    await NPTemplating._processJsonInDataStoreCalls(context)

    // Should preserve the original problematic JSON
    expect(context.templateData).toContain('This "contains" quotes')
  })

  test('should handle multiple JSON errors in the same template', async () => {
    context.templateData = `
      <% await DataStore.invokePluginCommandByName('Command1','plugin.id',['{"numDays":14, "sectionHeading":"Test Section"']) %>
      <% await DataStore.invokePluginCommandByName('Command2','plugin.id',['{"message":"This "contains" quotes"}']) %>
      <% await DataStore.invokePluginCommandByName('Command3','plugin.id',['{\'property\':\'value\'}']) %>
    `

    await NPTemplating._processJsonInDataStoreCalls(context)

    expect(context.criticalError).toBe(true)
    expect(context.jsonErrors.length).toBeGreaterThanOrEqual(2) // At least 2 errors detected
  })

  test('should properly integrate with preProcess', async () => {
    const template = `
      <% await DataStore.invokePluginCommandByName('Command1','plugin.id',['{"numDays":14, "sectionHeading":"Test Section"']) %>
      <% const myVar = "test value" %>
    `

    const { jsonErrors, criticalError, newTemplateData } = await NPTemplating.preProcess(template)

    expect(criticalError).toBe(true)
    expect(jsonErrors.length).toBeGreaterThan(0)
    expect(jsonErrors.some((err) => err.critical)).toBe(true)
    expect(newTemplateData).toContain('{"numDays":14, "sectionHeading":"Test Section"') // Preserves original for debugging
  })
})
