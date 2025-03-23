/**
 * @jest-environment jsdom
 */

/**
 * Tests for the individual preProcess helper functions in NPTemplating
 * Each test focuses on a single function's behavior in isolation
 */

import NPTemplating from '../lib/NPTemplating'
import FrontmatterModule from '../lib/support/modules/FrontmatterModule'
import { DataStore } from '@mocks/index'

// for Flow errors with Jest
/* global describe, beforeEach, afterEach, test, expect, jest */

describe('PreProcess helper functions', () => {
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

  describe('_processCommentTag', () => {
    test('should remove comment tags and a following space', async () => {
      context.templateData = '<%# This is a comment %> some text'

      await NPTemplating._processCommentTag('<%# This is a comment %>', context)

      expect(context.templateData).toBe('some text')
    })
    test('should remove comment tags from the template and the following newline', async () => {
      context.templateData = '<%# This is a comment %>\nSome regular content'

      await NPTemplating._processCommentTag('<%# This is a comment %>', context)

      expect(context.templateData).toBe('Some regular content')
    })

    test('should handle comment tags with newlines', async () => {
      context.templateData = '<%# This is a comment\n  with multiple lines %>\nSome regular content'

      await NPTemplating._processCommentTag('<%# This is a comment\n  with multiple lines %>', context)

      expect(context.templateData).toBe('Some regular content')
    })
  })

  describe('_processNoteTag', () => {
    test('should replace note tags with note content', async () => {
      context.templateData = '<% note("My Note") %>\nSome regular content'

      // Mock preProcessNote to return fixed content
      NPTemplating.preProcessNote = jest.fn().mockResolvedValue('Mock note content')

      await NPTemplating._processNoteTag('<% note("My Note") %>', context)

      expect(NPTemplating.preProcessNote).toHaveBeenCalledWith('<% note("My Note") %>')
      expect(context.templateData).toBe('Mock note content\nSome regular content')
    })
  })

  describe('_processCalendarTag', () => {
    test('should replace calendar tags with calendar note content', async () => {
      context.templateData = '<% calendar("20220101") %>\nSome regular content'

      // Mock preProcessCalendar to return fixed content
      NPTemplating.preProcessCalendar = jest.fn().mockResolvedValue('Mock calendar content')

      await NPTemplating._processCalendarTag('<% calendar("20220101") %>', context)

      expect(NPTemplating.preProcessCalendar).toHaveBeenCalledWith('<% calendar("20220101") %>')
      expect(context.templateData).toBe('Mock calendar content\nSome regular content')
    })
  })

  describe('_processReturnTag', () => {
    test('should remove return tags from the template', async () => {
      context.templateData = '<% :return: %>\nSome regular content'

      await NPTemplating._processReturnTag('<% :return: %>', context)

      expect(context.templateData).toBe('\nSome regular content')
    })

    test('should remove CR tags from the template', async () => {
      context.templateData = '<% :CR: %>\nSome regular content'

      await NPTemplating._processReturnTag('<% :CR: %>', context)

      expect(context.templateData).toBe('\nSome regular content')
    })
  })

  describe('_processCodeTag', () => {
    test('should add await prefix to code tags', async () => {
      context.templateData = '<% DataStore.invokePluginCommandByName("cmd", "id", []) %>'

      await NPTemplating._processCodeTag('<% DataStore.invokePluginCommandByName("cmd", "id", []) %>', context)

      expect(context.templateData).toBe('<% await DataStore.invokePluginCommandByName("cmd", "id", []) %>')
    })

    test('should handle tags with escaped expressions', async () => {
      context.templateData = '<%- DataStore.invokePluginCommandByName("cmd", "id", []) %>'

      await NPTemplating._processCodeTag('<%- DataStore.invokePluginCommandByName("cmd", "id", []) %>', context)

      expect(context.templateData).toBe('<%- await DataStore.invokePluginCommandByName("cmd", "id", []) %>')
    })

    test('should process multi-line code blocks correctly', async () => {
      const multilineTag = `<% const foo = 'bar';
DataStore.invokePluginCommandByName("cmd1", "id", [])
let name = "george"
DataStore.invokePluginCommandByName("cmd2", "id", [])
note.content()
date.now()
%>`
      context.templateData = multilineTag

      await NPTemplating._processCodeTag(multilineTag, context)

      // Should add await only to function calls, not to variable declarations
      expect(context.templateData).toContain(`const foo = 'bar'`)
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("cmd1", "id", [])`)
      expect(context.templateData).toContain(`let name = "george"`)
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("cmd2", "id", [])`)
      expect(context.templateData).toContain(`await note.content()`)
      expect(context.templateData).toContain(`await date.now()`)
    })

    test('should process semicolon-separated statements on a single line', async () => {
      const tagWithSemicolons = '<% const foo = "bar"; DataStore.invoke("cmd1"); let x = 5; date.now() %>'
      context.templateData = tagWithSemicolons

      await NPTemplating._processCodeTag(tagWithSemicolons, context)

      expect(context.templateData).toContain(`const foo = "bar"`)
      expect(context.templateData).toContain(`await DataStore.invoke("cmd1")`)
      expect(context.templateData).toContain(`let x = 5`)
      expect(context.templateData).toContain(`await date.now()`)
    })

    test('should handle variable declarations with function calls', async () => {
      const tagWithFuncInVar = '<% const result = DataStore.invoke("cmd"); %>'
      context.templateData = tagWithFuncInVar

      await NPTemplating._processCodeTag(tagWithFuncInVar, context)

      // Should add await to the function call even though it's part of a variable declaration
      expect(context.templateData).toContain(`const result = await DataStore.invoke("cmd")`)
    })

    test('should not add await to lines that already have it', async () => {
      const tagWithAwait = `<% const foo = 'bar';
await DataStore.invokePluginCommandByName("cmd1", "id", [])
let name = "george"
DataStore.invoke("cmd2")
%>`
      context.templateData = tagWithAwait

      await NPTemplating._processCodeTag(tagWithAwait, context)

      expect(context.templateData).toContain(`const foo = 'bar'`)
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("cmd1", "id", [])`)
      expect(context.templateData).toContain(`let name = "george"`)
      expect(context.templateData).toContain(`await DataStore.invoke("cmd2")`)
      // Should not double-add await
      expect(context.templateData).not.toContain(`await await`)
    })

    test('should handle mixed semicolons and newlines', async () => {
      const mixedTag = `<% const a = 1; const b = 2;
DataStore.invoke("cmd1"); DataStore.invoke("cmd2");
await existingAwait(); doSomethingElse()
%>`
      context.templateData = mixedTag

      await NPTemplating._processCodeTag(mixedTag, context)

      expect(context.templateData).toContain(`const a = 1; const b = 2`)
      expect(context.templateData).toContain(`await DataStore.invoke("cmd1"); await DataStore.invoke("cmd2")`)
      expect(context.templateData).toContain(`await existingAwait(); await doSomethingElse()`)
      // Should not double-add await
      expect(context.templateData).not.toContain(`await await`)
    })

    test('should not add await to prompt function calls', async () => {
      const tagWithPrompt = `<% const foo = 'bar';
prompt("Please enter your name")
DataStore.invoke("cmd")
%>`
      context.templateData = tagWithPrompt

      await NPTemplating._processCodeTag(tagWithPrompt, context)

      expect(context.templateData).toContain(`const foo = 'bar'`)
      expect(context.templateData).toContain(`prompt("Please enter your name")`)
      expect(context.templateData).toContain(`await DataStore.invoke("cmd")`)
      // Should not add await to prompt
      expect(context.templateData).not.toContain(`await prompt`)
    })

    test('should correctly place await in variable declarations with function calls', async () => {
      // Create a combined tag with all the variable declarations
      const variableWithFunctionTag = `<% 
const result1 = DataStore.invoke("cmd1");
let result2=DataStore.invoke("cmd2");
var result3 = DataStore.invoke("cmd3");
%>`

      // Create specific test context for this test
      const testContext = {
        templateData: variableWithFunctionTag,
        sessionData: {},
        jsonErrors: [],
        criticalError: false,
        override: {},
      }

      console.log('BEFORE processing:', testContext.templateData)

      // Process the entire block at once
      await NPTemplating._processCodeTag(variableWithFunctionTag, testContext)

      console.log('AFTER processing:', testContext.templateData)

      // Should place await before the function call, not before the variable declaration
      expect(testContext.templateData).toContain(`const result1 = await DataStore.invoke("cmd1")`)
      expect(testContext.templateData).toContain(`let result2=await DataStore.invoke("cmd2")`)
      expect(testContext.templateData).toContain(`var result3 = await DataStore.invoke("cmd3")`)

      // Should NOT place await before the variable declaration
      expect(testContext.templateData).not.toContain(`await const result1`)
      expect(testContext.templateData).not.toContain(`await let result2`)
      expect(testContext.templateData).not.toContain(`await var result3`)
    })
  })

  describe('_processVariableTag', () => {
    test('should extract string variables', async () => {
      context.templateData = '<% const myVar = "test value" %>'

      await NPTemplating._processVariableTag('<% const myVar = "test value" %>', context)

      expect(context.sessionData.myVar).toBe('test value')
    })

    test('should extract object variables', async () => {
      context.templateData = '<% const myObj = {"key": "value"} %>'

      await NPTemplating._processVariableTag('<% const myObj = {"key": "value"} %>', context)

      expect(context.sessionData.myObj).toBe('{"key": "value"}')
    })

    test('should extract array variables', async () => {
      context.templateData = '<% const myArray = [1, 2, 3] %>'

      await NPTemplating._processVariableTag('<% const myArray = [1, 2, 3] %>', context)

      expect(context.sessionData.myArray).toBe('[1, 2, 3]')
    })
  })

  describe('_processJsonInDataStoreCalls', () => {
    test('should detect JSON with missing closing brace', async () => {
      const invalidJson = '{"numDays":14, "sectionHeading":"Test Section"'
      context.templateData = `<% await DataStore.invokePluginCommandByName('Test Command','plugin.id',['${invalidJson}']) %>`

      await NPTemplating._processJsonInDataStoreCalls(context)

      expect(context.criticalError).toBe(true)
      expect(context.jsonErrors.length).toBeGreaterThan(0)
      expect(context.jsonErrors.some((err) => err.error.includes('Unclosed JSON'))).toBe(true)
    })

    test('should detect JSON with mixed quotes', async () => {
      const invalidJson = '{"numDays":14, \'sectionHeading\':"Test Section"}'
      context.templateData = `<% await DataStore.invokePluginCommandByName('Another Command','plugin.id',['${invalidJson}']) %>`

      await NPTemplating._processJsonInDataStoreCalls(context)

      expect(context.criticalError).toBe(true)
      expect(context.jsonErrors.some((err) => err.error.includes('Mixed quote styles'))).toBe(true)
    })

    test('should detect JSON with unescaped quotes in string', async () => {
      const invalidJson = '{"message":"This "contains" quotes"}'
      context.templateData = `<% await DataStore.invokePluginCommandByName('Third Command','plugin.id',['${invalidJson}']) %>`

      await NPTemplating._processJsonInDataStoreCalls(context)

      expect(context.criticalError).toBe(true)
      expect(context.jsonErrors.length).toBeGreaterThan(0)
    })

    test('should fix single-quoted JSON format', async () => {
      context.templateData = `<% await DataStore.invokePluginCommandByName('Valid Command','plugin.id',['{\'numDays\':14, \'sectionHeading\':\'Test Section\'}'']) %>`

      await NPTemplating._processJsonInDataStoreCalls(context)

      // Should convert single quotes to double quotes
      expect(context.templateData).toContain('"numDays"')
      expect(context.templateData).toContain('"sectionHeading"')
    })
  })

  describe('_getLineNumberForMatch', () => {
    test('should return correct line number for a match', () => {
      const templateData = 'Line 1\nLine 2\nLine 3 with match\nLine 4'

      const lineNumber = NPTemplating._getLineNumberForMatch(templateData, 'with match')

      expect(lineNumber).toBe(3)
    })

    test('should return 0 if no match is found', () => {
      const templateData = 'Line 1\nLine 2\nLine 3\nLine 4'

      const lineNumber = NPTemplating._getLineNumberForMatch(templateData, 'not found')

      expect(lineNumber).toBe(0)
    })
  })

  describe('Integration with preProcess', () => {
    test('should process all types of tags in a single pass', async () => {
      // Set up specific mocks for this test
      NPTemplating.preProcessNote = jest.fn().mockResolvedValue('Note content')
      NPTemplating.preProcessCalendar = jest.fn().mockResolvedValue('Calendar content')
      NPTemplating.getTemplate = jest.fn().mockResolvedValue('')

      const template = `
        <%# Comment to remove %>
        <% note("My Note") %>
        <% calendar("20220101") %>
        <% const myVar = "test value" %>
        <% DataStore.invokePluginCommandByName("cmd", "id", []) %>
        <% :return: %>
        <% await DataStore.invokePluginCommandByName('Test Command','plugin.id',['{"numDays":14, \'sectionHeading\':"Test Section"}'']) %>
      `

      const result = await NPTemplating.preProcess(template)

      // Verify critical functions were called
      expect(NPTemplating.preProcessNote).toHaveBeenCalled()
      expect(NPTemplating.preProcessCalendar).toHaveBeenCalled()

      // Check results
      expect(result.newSettingData.myVar).toBe('test value')
      expect(result.newTemplateData).not.toContain('<%# Comment to remove %>')
      expect(result.newTemplateData).toContain('await DataStore.invokePluginCommandByName')
      expect(result.jsonErrors.some((err) => err.error.includes('Mixed quote styles'))).toBe(true)
    })
  })
})
