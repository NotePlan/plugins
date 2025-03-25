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

  test('should NOT flag valid JS object literals in DataStore function calls as errors', async () => {
    context.templateData = `<% await DataStore.invokePluginCommandByName('Remove section from recent notes','np.Tidy',[{"numDays":14, "sectionHeading": "Blocks 🕑", "runSilently": true}]) -%>`

    await NPTemplating._processJsonInDataStoreCalls(context)

    // No errors should be reported
    expect(context.criticalError).toBe(false)
    expect(context.jsonErrors.length).toBe(0)
  })

  // FIXME: this one is a real-world use case that is being erroneously rewritten
  test('should NOT flag valid JS object literals in DataStore function calls as errors', async () => {
    context.templateData = `<% await DataStore.invokePluginCommandByName('Remove section from recent notes','np.Tidy',['{"numDays":14, "sectionHeading": "Blocks 🕑", "runSilently": true}']) -%>`

    await NPTemplating._processJsonInDataStoreCalls(context)

    // No errors should be reported
    expect(context.templateData).toContain(
      `await DataStore.invokePluginCommandByName('Remove section from recent notes','np.Tidy',['{"numDays":14, "sectionHeading": "Blocks 🕑", "runSilently": true}'])`,
    )
    expect(context.criticalError).toBe(false)
    expect(context.jsonErrors.length).toBe(0)
  })

  test('should detect missing closing brace in JSON outside of code blocks', async () => {
    const invalidJson = '{"numDays":14, "sectionHeading":"Test Section"'
    context.templateData = `Here is some invalid JSON: ${invalidJson}`

    await NPTemplating._processJsonInDataStoreCalls(context)

    expect(context.criticalError).toBe(true)
    expect(context.jsonErrors.length).toBeGreaterThan(0)
  })

  test('should detect mixed quotes in JSON object properties outside of code blocks', async () => {
    const invalidJson = '{"numDays":14, \'sectionHeading\':"Test Section"}'
    context.templateData = `Here is some invalid JSON: ${invalidJson}`

    await NPTemplating._processJsonInDataStoreCalls(context)

    expect(context.criticalError).toBe(true)
    expect(context.jsonErrors.length).toBeGreaterThan(0)
  })

  test('should detect unescaped quotes in JSON string values outside of code blocks', async () => {
    const invalidJson = '{"message":"This "contains" quotes"}'
    context.templateData = `Here is some invalid JSON: ${invalidJson}`

    await NPTemplating._processJsonInDataStoreCalls(context)

    expect(context.criticalError).toBe(true)
    expect(context.jsonErrors.length).toBeGreaterThan(0)
  })

  test('should fix single-quoted properties in JSON objects outside of code blocks', async () => {
    context.templateData = `Here is some single-quoted JSON: '{"numDays":14, "sectionHeading":"Test Section"}'`

    await NPTemplating._processJsonInDataStoreCalls(context)

    // Should have converted single quotes to double quotes
    expect(context.templateData).toContain('{"numDays":14, "sectionHeading":"Test Section"}')
    expect(context.criticalError).toBe(false) // No critical errors after fixing
  })

  test('should handle multiple JSON errors outside of code blocks', async () => {
    context.templateData = `
      Here is some invalid JSON with missing closing brace: {"numDays":14, "sectionHeading":"Test Section"
      Here is some invalid JSON with unescaped quotes: {"message":"This "contains" quotes"}
    `

    await NPTemplating._processJsonInDataStoreCalls(context)

    expect(context.criticalError).toBe(true)
    expect(context.jsonErrors.length).toBeGreaterThan(0)
  })

  test('should handle valid JS in code blocks and invalid JSON elsewhere', async () => {
    context.templateData = `
      <% await DataStore.invokePluginCommandByName('Command1','plugin.id',[{"valid": "object"}]) %>
      Here is some invalid JSON: {"unclosed": "object"
    `

    await NPTemplating._processJsonInDataStoreCalls(context)

    // Should find the error but leave the valid code block untouched
    expect(context.criticalError).toBe(true)
    expect(context.jsonErrors.length).toBeGreaterThan(0)
    expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName('Command1','plugin.id',[{"valid": "object"}])`)
  })

  test('should properly integrate with preProcess', async () => {
    const template = `
      <% await DataStore.invokePluginCommandByName('Command1','plugin.id',[{"valid": "object"}]) %>
      Here is some invalid JSON: {"unclosed": "object"
    `

    const { jsonErrors, criticalError, newTemplateData } = await NPTemplating.preProcess(template)

    expect(criticalError).toBe(true)
    expect(jsonErrors.length).toBeGreaterThan(0)
    expect(jsonErrors.some((err) => err.critical)).toBe(true)
    expect(newTemplateData).toContain(`await DataStore.invokePluginCommandByName('Command1','plugin.id',[{"valid": "object"}])`)
  })
})
