/**
 * @jest-environment jsdom
 */

/**
 * Tests for the individual preProcess helper functions in templateProcessor
 * Each test focuses on a single function's behavior in isolation
 */

import NPTemplating from '../lib/NPTemplating'
import * as templateProcessor from '../lib/rendering/templateProcessor'
import {
  processCommentTag,
  processNoteTag,
  processCalendarTag,
  processReturnTag,
  processCodeTag,
  processVariableTag,
  preProcessTags,
  preProcessNote,
  preProcessCalendar,
} from '../lib/rendering/templateProcessor'
import * as coreModule from '../lib/core'
import FrontmatterModule from '../lib/support/modules/FrontmatterModule'
import { DataStore } from '@mocks/index'

// for Flow errors with Jest
/* global describe, beforeEach, afterEach, test, expect, jest */

// Set up global mocks directly instead of trying to mock NPTemplating
beforeEach(() => {
  global.logDebug = jest.fn()
  global.logError = jest.fn()
  global.pluginJson = { name: 'np.Templating', version: '1.0.0' }
})

afterEach(() => {
  delete global.logDebug
  delete global.logError
  delete global.pluginJson
})

describe('PreProcess helper functions', () => {
  let consoleLogMock
  let consoleErrorMock
  let logDebugMock
  let logErrorMock
  let pluginJsonMock
  let context
  // Define the asyncFunctions array here for the tests
  const asyncFunctions = [
    'invokePluginCommandByName',
    'events',
    'DataStore.invokePluginCommandByName',
    'DataStore.calendarNoteByDateString',
    'DataStore.projectNoteByTitle',
    'logError',
    'doSomethingElse',
    'processData',
    'existingAwait',
  ]

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

    // Mock DataStore.invokePluginCommandByName
    DataStore.invokePluginCommandByName = jest.fn().mockResolvedValue('mocked result')
    DataStore.calendarNoteByDateString = jest.fn().mockResolvedValue({ content: 'Mock calendar content' })
    DataStore.projectNoteByTitle = jest.fn().mockResolvedValue([{ content: 'Mock note content' }])

    // Basic context object for most tests
    context = {
      templateData: 'Initial data',
      sessionData: {},
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

  describe('processCommentTag', () => {
    test('should remove comment tags and a following space', () => {
      context.templateData = '<%# This is a comment %> some text'

      processCommentTag('<%# This is a comment %>', context)

      expect(context.templateData).toBe('some text')
    })
    test('should remove comment tags from the template and the following newline', () => {
      context.templateData = '<%# This is a comment %>\nSome regular content'

      processCommentTag('<%# This is a comment %>', context)

      expect(context.templateData).toBe('Some regular content')
    })

    test('should handle comment tags with newlines', () => {
      context.templateData = '<%# This is a comment\n  with multiple lines %>\nSome regular content'

      processCommentTag('<%# This is a comment\n  with multiple lines %>', context)

      expect(context.templateData).toBe('Some regular content')
    })
  })

  describe('processNoteTag', () => {
    test('should replace note tags with note content', async () => {
      // Set up the context with the tag to process
      context.templateData = '<% note("My Note") %>\nSome regular content'

      // Create a mock DataStore implementation for this test
      const mockProjectNoteByTitle = jest.fn().mockReturnValue([{ content: 'Mock note content' }])

      // Save the original implementation
      const originalDS = global.DataStore

      // Replace with our mock for this test
      global.DataStore = {
        ...originalDS,
        projectNoteByTitle: mockProjectNoteByTitle,
      }

      // We're no longer checking if preProcessNote was called - just mock it
      const spy = jest.spyOn(templateProcessor, 'preProcessNote').mockImplementation(() => Promise.resolve('Mock note content'))

      // Process the tag
      await processNoteTag('<% note("My Note") %>', context)

      // Restore the original DataStore
      global.DataStore = originalDS
      spy.mockRestore()

      // Just check that the template data was replaced correctly
      expect(context.templateData).toBe('Mock note content\nSome regular content')
    })
  })

  describe('processCalendarTag', () => {
    test('should replace calendar tags with calendar note content', async () => {
      // Set up the context with the tag to process
      context.templateData = '<% calendar("20220101") %>\nSome regular content'

      // Create a mock DataStore implementation for this test
      const mockCalendarNoteByDateString = jest.fn().mockReturnValue({ content: 'Mock calendar content' })

      // Save the original implementation
      const originalDS = global.DataStore

      // Replace with our mock for this test
      global.DataStore = {
        ...originalDS,
        calendarNoteByDateString: mockCalendarNoteByDateString,
      }

      // We're no longer checking if preProcessCalendar was called - just mock it
      const spy = jest.spyOn(templateProcessor, 'preProcessCalendar').mockImplementation(() => Promise.resolve('Mock calendar content'))

      // Process the tag
      await processCalendarTag('<% calendar("20220101") %>', context)

      // Restore the original DataStore
      global.DataStore = originalDS
      spy.mockRestore()

      // Just check that the template data was replaced correctly
      expect(context.templateData).toBe('Mock calendar content\nSome regular content')
    })
  })

  describe('processReturnTag', () => {
    test('should remove return tags from the template', () => {
      context.templateData = '<% :return: %>\nSome regular content'

      processReturnTag('<% :return: %>', context)

      expect(context.templateData).toBe('\nSome regular content')
    })

    test('should remove CR tags from the template', () => {
      context.templateData = '<% :CR: %>\nSome regular content'

      processReturnTag('<% :CR: %>', context)

      expect(context.templateData).toBe('\nSome regular content')
    })
  })

  describe('processCodeTag', () => {
    test('should add await prefix to code tags', () => {
      context.templateData = '<% DataStore.invokePluginCommandByName("cmd", "id", []) %>'

      processCodeTag('<% DataStore.invokePluginCommandByName("cmd", "id", []) %>', context, asyncFunctions)

      expect(context.templateData).toBe('<% await DataStore.invokePluginCommandByName("cmd", "id", []) %>')
    })

    test('should add await prefix to events() calls', () => {
      context.templateData = '<% events() %>'

      processCodeTag('<% events() %>', context, asyncFunctions)

      expect(context.templateData).toBe('<% await events() %>')
    })

    test('should handle tags with escaped expressions', () => {
      context.templateData = '<%- DataStore.invokePluginCommandByName("cmd", "id", []) %>'

      processCodeTag('<%- DataStore.invokePluginCommandByName("cmd", "id", []) %>', context, asyncFunctions)

      expect(context.templateData).toBe('<%- await DataStore.invokePluginCommandByName("cmd", "id", []) %>')
    })

    test('should process multi-line code blocks correctly', () => {
      const multilineTag = `<% const foo = 'bar';
DataStore.invokePluginCommandByName("cmd1", "id", [])
let name = "george"
DataStore.invokePluginCommandByName("cmd2", "id", [])
note.content()
date.now()
%>`
      context.templateData = multilineTag

      processCodeTag(multilineTag, context, asyncFunctions)

      // Should add await only to function calls, not to variable declarations
      expect(context.templateData).toContain(`const foo = 'bar'`)
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("cmd1", "id", [])`)
      expect(context.templateData).toContain(`let name = "george"`)
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("cmd2", "id", [])`)
      expect(context.templateData).toContain(`note.content()`)
      expect(context.templateData).toContain(`date.now()`)
    })

    test('should process semicolon-separated statements on a single line', () => {
      const tagWithSemicolons = '<% const foo = "bar"; DataStore.invokePluginCommandByName("cmd1"); let x = 5; date.now() %>'
      context.templateData = tagWithSemicolons

      processCodeTag(tagWithSemicolons, context, asyncFunctions)

      expect(context.templateData).toContain(`const foo = "bar"`)
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("cmd1")`)
      expect(context.templateData).toContain(`let x = 5`)
      expect(context.templateData).not.toContain(`await date.now()`)
    })

    test('should handle variable declarations with function calls', () => {
      const tagWithFuncInVar = '<% const result = DataStore.invokePluginCommandByName("cmd"); %>'
      context.templateData = tagWithFuncInVar

      processCodeTag(tagWithFuncInVar, context, asyncFunctions)

      // Should add await to the function call even though it's part of a variable declaration
      expect(context.templateData).toContain(`const result = await DataStore.invokePluginCommandByName("cmd")`)
    })

    test('should not add await to lines that already have it', () => {
      const tagWithAwait = `<% const foo = 'bar';
await DataStore.invokePluginCommandByName("cmd1", "id", [])
let name = "george"
DataStore.invokePluginCommandByName("cmd2")
%>`
      context.templateData = tagWithAwait

      processCodeTag(tagWithAwait, context, asyncFunctions)

      expect(context.templateData).toContain(`const foo = 'bar'`)
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("cmd1", "id", [])`)
      expect(context.templateData).toContain(`let name = "george"`)
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("cmd2")`)
      // Should not double-add await
      expect(context.templateData).not.toContain(`await await`)
    })

    test('should handle mixed semicolons and newlines', () => {
      const mixedTag = `<% const a = 1; const b = 2;
DataStore.invokePluginCommandByName("cmd1"); DataStore.invokePluginCommandByName("cmd2");
await existingAwait(); doSomethingElse()
%>`
      context.templateData = mixedTag

      processCodeTag(mixedTag, context, asyncFunctions)

      expect(context.templateData).toContain(`const a = 1; const b = 2`)
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("cmd1"); await DataStore.invokePluginCommandByName("cmd2")`)
      expect(context.templateData).toContain(`await existingAwait(); await doSomethingElse()`)
      // Should not double-add await
      expect(context.templateData).not.toContain(`await await`)
    })

    test('should not add await to prompt function calls', () => {
      const tagWithPrompt = `<% const foo = 'bar';
prompt("Please enter your name")
DataStore.invokePluginCommandByName("cmd")
%>`
      context.templateData = tagWithPrompt

      processCodeTag(tagWithPrompt, context, asyncFunctions)

      expect(context.templateData).toContain(`const foo = 'bar'`)
      expect(context.templateData).toContain(`prompt("Please enter your name")`)
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("cmd")`)
      // Should not add await to prompt
      expect(context.templateData).not.toContain(`await prompt`)
    })

    test('should correctly place await in variable declarations with function calls', () => {
      // Create a combined tag with all the variable declarations
      const variableWithFunctionTag = `<% 
const result1 = DataStore.invokePluginCommandByName("cmd1");
let result2=DataStore.invokePluginCommandByName("cmd2");
var result3 = DataStore.invokePluginCommandByName("cmd3");
%>`

      // Create specific test context for this test
      const testContext = {
        templateData: variableWithFunctionTag,
        sessionData: {},
        override: {},
      }

      // console.log('BEFORE processing:', testContext.templateData)

      // Process the entire block at once
      processCodeTag(variableWithFunctionTag, testContext, asyncFunctions)

      // console.log('AFTER processing:', testContext.templateData)

      // Should place await before the function call, not before the variable declaration
      expect(testContext.templateData).toContain(`const result1 = await DataStore.invokePluginCommandByName("cmd1")`)
      expect(testContext.templateData).toContain(`let result2= await DataStore.invokePluginCommandByName("cmd2")`)
      expect(testContext.templateData).toContain(`var result3 = await DataStore.invokePluginCommandByName("cmd3")`)

      // Should NOT place await before the variable declaration
      expect(testContext.templateData).not.toContain(`await const result1`)
      expect(testContext.templateData).not.toContain(`await let result2`)
      expect(testContext.templateData).not.toContain(`await var result3`)
    })

    test('should NOT add await to if/else statements', () => {
      const tagWithIfElse = `<% 
if (dayNum == 6) {
  // some code
} else if (dayNum == 7) {
  // other code
} else {
  // default code
}
%>`
      context.templateData = tagWithIfElse

      processCodeTag(tagWithIfElse, context, asyncFunctions)

      // Should NOT add await to if/else statements
      expect(context.templateData).toContain(`if (dayNum == 6)`)
      expect(context.templateData).toContain(`else if (dayNum == 7)`)
      expect(context.templateData).not.toContain(`await if`)
      expect(context.templateData).not.toContain(`await else if`)
    })

    test('should NOT add await to for loops', () => {
      const tagWithForLoop = `<% 
for (let i = 0; i < 10; i++) {
  DataStore.invokePluginCommandByName("cmd");
}
%>`
      context.templateData = tagWithForLoop

      processCodeTag(tagWithForLoop, context, asyncFunctions)

      // Should NOT add await to for loop
      expect(context.templateData).toContain(`for (let i = 0; i < 10; i++)`)
      expect(context.templateData).not.toContain(`await for`)
      // But should add await to function calls inside the loop
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("cmd")`)
    })

    test('should NOT add await to while loops', () => {
      const tagWithWhileLoop = `<% 
let x = 0;
while (x < 10) {
  DataStore.invokePluginCommandByName("cmd");
  x++;
}
%>`
      context.templateData = tagWithWhileLoop

      processCodeTag(tagWithWhileLoop, context, asyncFunctions)

      // Should NOT add await to while loop
      expect(context.templateData).toContain(`while (x < 10)`)
      expect(context.templateData).not.toContain(`await while`)
      // But should add await to function calls inside the loop
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("cmd")`)
    })

    test('should NOT add await to do-while loops', () => {
      const tagWithDoWhileLoop = `<% 
let x = 0;
do {
  DataStore.invokePluginCommandByName("cmd");
  x++;
} while (x < 10);
%>`
      context.templateData = tagWithDoWhileLoop

      processCodeTag(tagWithDoWhileLoop, context, asyncFunctions)

      // Should NOT add await to do-while loop
      expect(context.templateData).toContain(`do {`)
      expect(context.templateData).toContain(`} while (x < 10)`)
      expect(context.templateData).not.toContain(`await do`)
      expect(context.templateData).not.toContain(`await while`)
      // But should add await to function calls inside the loop
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("cmd")`)
    })

    test('should NOT add await to switch statements', () => {
      const tagWithSwitch = `<% 
switch (day) {
  case 1:
    DataStore.invokePluginCommandByName("weekday");
    break;
  case 6:
  case 7:
    DataStore.invokePluginCommandByName("weekend");
    break;
  default:
    DataStore.invokePluginCommandByName("default");
}
%>`
      context.templateData = tagWithSwitch

      processCodeTag(tagWithSwitch, context, asyncFunctions)

      // Should NOT add await to switch statement
      expect(context.templateData).toContain(`switch (day)`)
      expect(context.templateData).not.toContain(`await switch`)
      // But should add await to function calls inside the switch
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("weekday")`)
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("weekend")`)
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("default")`)
    })

    test('should NOT add await to try/catch statements', () => {
      const tagWithTryCatch = `<% 
try {
  DataStore.invokePluginCommandByName("risky");
} catch (error) {
  logError(error);
}
%>`
      context.templateData = tagWithTryCatch

      processCodeTag(tagWithTryCatch, context, asyncFunctions)

      // Should NOT add await to try/catch
      expect(context.templateData).toContain(`try {`)
      expect(context.templateData).toContain(`catch (error)`)
      expect(context.templateData).not.toContain(`await try`)
      expect(context.templateData).not.toContain(`await catch`)
      // But should add await to function calls inside the try/catch
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("risky")`)
      expect(context.templateData).toContain(`await logError(error)`)
    })

    test('should NOT add await to parenthesized expressions', () => {
      const tagWithParenExpr = `<% 
const result = (a + b) * c;
const isValid = (condition1 && condition2) || condition3;
%>`
      context.templateData = tagWithParenExpr

      processCodeTag(tagWithParenExpr, context, asyncFunctions)

      // Should NOT add await to parenthesized expressions
      expect(context.templateData).toContain(`const result = (a + b) * c`)
      expect(context.templateData).toContain(`const isValid = (condition1 && condition2) || condition3`)
      expect(context.templateData).not.toContain(`await (`)
    })

    test('should NOT add await to ternary operators', () => {
      const tagWithTernary = `<% 
const result = (condition) ? trueValue : falseValue;
const message = (age > 18) ? "Adult" : "Minor";
%>`
      context.templateData = tagWithTernary

      processCodeTag(tagWithTernary, context, asyncFunctions)

      // Should NOT add await to ternary expressions
      expect(context.templateData).toContain(`const result = (condition) ? trueValue : falseValue`)
      expect(context.templateData).toContain(`const message = (age > 18) ? "Adult" : "Minor"`)
      expect(context.templateData).not.toContain(`await (condition)`)
      expect(context.templateData).not.toContain(`await (age > 18)`)
    })

    test('should handle complex templates with mixed control structures and function calls', () => {
      const complexTag = `<% 
// This is a complex template
if (dayNum == 6) {
  // Saturday
  DataStore.invokePluginCommandByName("weekend");
} else if (dayNum == 7) {
  // Sunday
  DataStore.invokePluginCommandByName("weekend");
} else {
  // Weekday
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].isImportant) {
      DataStore.invokePluginCommandByName("important", tasks[i]);
    }
  }
}

// Function calls outside of control structures
const data = DataStore.invokePluginCommandByName("getData");
processData(data);
%>`
      context.templateData = complexTag

      processCodeTag(complexTag, context, asyncFunctions)

      // Should NOT add await to control structures
      expect(context.templateData).toContain(`if (dayNum == 6)`)
      expect(context.templateData).toContain(`else if (dayNum == 7)`)
      expect(context.templateData).toContain(`for (let i = 0; i < tasks.length; i++)`)
      expect(context.templateData).toContain(`if (tasks[i].isImportant)`)

      // Should NOT have any "await if", "await for", etc.
      expect(context.templateData).not.toContain(`await if`)
      expect(context.templateData).not.toContain(`await else if`)
      expect(context.templateData).not.toContain(`await for`)

      // Should add await to function calls
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("weekend")`)
      expect(context.templateData).toContain(`await DataStore.invokePluginCommandByName("important", tasks[i])`)
      expect(context.templateData).toContain(`const data = await DataStore.invokePluginCommandByName("getData")`)
      expect(context.templateData).toContain(`await processData(data)`)
    })

    test('should process code fragments with else if statements correctly', () => {
      const tagWithFragments = `<% 
} else if (dayNum === 2) { // tuesday -%>`
      context.templateData = tagWithFragments

      processCodeTag(tagWithFragments, context, asyncFunctions)

      // Should NOT add await to else if fragments
      expect(context.templateData).toContain(`} else if (dayNum === 2) {`)
      expect(context.templateData).not.toContain(`await } else if`)
    })

    test('should handle complex if/else fragments across multiple code blocks', () => {
      // This simulates the broken template example from the user
      const fragments = [
        '<% } else if (dayNum === 2) { // tuesday -%>',
        '<% } else if (dayNum == 3) { // wednesday task -%>',
        '<% } else if (dayNum == 4) { // thursday task -%>',
        '<% } else if (dayNum == 5) { // friday task -%>',
      ]

      for (const fragment of fragments) {
        context.templateData = fragment
        processCodeTag(fragment, context, asyncFunctions)

        // Should NOT add await to any of the fragments
        expect(context.templateData).not.toContain('await } else if')
      }
    })
  })

  describe('processVariableTag', () => {
    test('should extract string variables', async () => {
      context.templateData = '<% const myVar = "test value" %>'

      await processVariableTag('<% const myVar = "test value" %>', context)

      expect(context.sessionData.myVar).toBe('test value')
    })

    test('should extract object variables', async () => {
      context.templateData = '<% const myObj = {"key": "value"} %>'

      await processVariableTag('<% const myObj = {"key": "value"} %>', context)

      expect(context.sessionData.myObj).toBe('{"key": "value"}')
    })

    test('should extract array variables', async () => {
      context.templateData = '<% const myArray = [1, 2, 3] %>'

      await processVariableTag('<% const myArray = [1, 2, 3] %>', context)

      expect(context.sessionData.myArray).toBe('[1, 2, 3]')
    })
  })

  describe('Integration with preProcess', () => {
    test('should process all types of tags in a single pass', async () => {
      // Set up a simplified integration test that doesn't need to mock getTemplate
      const template = `
<%# This is a comment %>
<% :return: %>
        <% const myVar = "test value" %>
<% DataStore.invokePluginCommandByName("cmd") %>
`
      // Process the template
      const result = await preProcessTags(template)

      // Check results for things we can verify without mocking
      expect(result.newTemplateData).not.toContain('<%# This is a comment %>')
      expect(result.newTemplateData).not.toContain('<% :return: %>')
      expect(result.newTemplateData).toContain('<% const myVar = "test value" %>')
      expect(result.newTemplateData).toContain('<% await DataStore.invokePluginCommandByName("cmd") %>')
      expect(result.newSettingData).toHaveProperty('myVar', 'test value')
    })
  })
})
