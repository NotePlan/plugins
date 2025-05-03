/* global describe, test, expect */
import JSONValidator from '../lib/support/JSONValidator'

describe('JSONValidator', () => {
  // Test context setup
  const createTestContext = () => ({
    templateData: '',
    sessionData: {},
    jsonErrors: [],
    criticalError: false,
    override: {},
  })

  describe('validateJSON', () => {
    test('should detect invalid JSON in DataStore.invokePluginCommandByName call', async () => {
      // Setup
      const context = createTestContext()
      context.templateData = `Some content with DataStore.invokePluginCommandByName("plugin", "command", {"key":"value")`

      // Execute
      await JSONValidator.validateJSON(context)

      // Verify
      expect(context.jsonErrors.length).toBeGreaterThan(0)
      expect(context.criticalError).toBe(true)
    })

    test('should not flag valid JS object literals in DataStore function calls as errors', async () => {
      // Setup
      const context = createTestContext()
      // Add code block markers to simulate being inside code
      context.templateData = `<% await DataStore.invokePluginCommandByName("plugin", "command", {"key":"value"}) %>`

      // Execute
      await JSONValidator.validateJSON(context)

      // Verify - should not flag valid JSON inside code blocks
      expect(context.criticalError).toBe(false)
    })

    test('should handle single-quoted JSON strings in DataStore calls', async () => {
      // Setup
      const context = createTestContext()
      // Add code block markers to simulate being inside code
      context.templateData = `<% await DataStore.invokePluginCommandByName("plugin", "command", '{"key":"value"}') %>`

      // Execute
      await JSONValidator.validateJSON(context)

      // Verify
      expect(context.criticalError).toBe(false)
    })

    test('should detect missing closing brace in JSON outside of code blocks', async () => {
      // Setup
      const context = createTestContext()
      context.templateData = `Some text with {"incomplete": "json"`

      // Execute
      await JSONValidator.validateJSON(context)

      // Verify
      expect(context.jsonErrors.length).toBeGreaterThan(0)
      expect(context.criticalError).toBe(true)
    })

    test('should detect mixed quotes in JSON object properties outside of code blocks', async () => {
      // Setup
      const context = createTestContext()
      context.templateData = `Some text with {"numDays":14, 'sectionHeading':"Test Section"}`

      // Execute
      await JSONValidator.validateJSON(context)

      // Verify
      expect(context.jsonErrors.length).toBeGreaterThan(0)
      expect(context.criticalError).toBe(true)
    })

    test('should handle valid JSON objects with complex nested structures', async () => {
      // Setup
      const context = createTestContext()
      // Add code block markers to simulate being inside code
      context.templateData = `<% await DataStore.invokePluginCommandByName("plugin", "command", {"key": "value", "nested": {"inner": [1, 2, 3]}}) %>`

      // Execute
      await JSONValidator.validateJSON(context)

      // Verify
      expect(context.criticalError).toBe(false)
    })

    test('should fix single-quoted properties in JSON objects outside of code blocks', async () => {
      // Setup
      const context = createTestContext()
      context.templateData = `Some text with '{"key": "value"}'`
      const originalTemplate = context.templateData

      // Execute
      await JSONValidator.validateJSON(context)

      // Verify
      expect(context.criticalError).toBe(false)
      // Should replace the single-quoted JSON with its contents
      expect(context.templateData).not.toEqual(originalTemplate)
      expect(context.templateData).toEqual(`Some text with {"key": "value"}`)
    })
  })

  describe('_isInsideCodeBlock', () => {
    test('should correctly identify text inside a code block', () => {
      const templateData = '<% const x = 5; DataStore.invokePluginCommandByName("cmd", "plugin", {}); %>'
      const match = 'DataStore.invokePluginCommandByName'

      expect(JSONValidator._isInsideCodeBlock(templateData, match)).toBe(true)
    })

    test('should correctly identify text outside a code block', () => {
      const templateData = '<% const x = 5; %> DataStore.invokePluginCommandByName("cmd", "plugin", {}); <% const y = 6; %>'
      const match = 'DataStore.invokePluginCommandByName'

      expect(JSONValidator._isInsideCodeBlock(templateData, match)).toBe(false)
    })
  })

  describe('_attemptJsonFix', () => {
    test('should fix missing closing braces', () => {
      // Setup
      const invalidJson = '{"key": "value"'

      // Execute
      const result = JSONValidator._attemptJsonFix(invalidJson)

      // Verify - just check that the result is valid JSON and has a closing brace
      expect(result).toContain('}')
      // Ensure it's now valid JSON
      expect(() => JSON.parse(result)).not.toThrow()
    })

    test('should fix single-quoted property names', () => {
      // Setup
      const invalidJson = '{\'key\': "value"}'

      // Execute
      const result = JSONValidator._attemptJsonFix(invalidJson)

      // Verify
      expect(result).toContain('"key"')
      // Ensure it's now valid JSON
      expect(() => JSON.parse(result)).not.toThrow()
    })

    test('should fix trailing commas in objects', () => {
      // Setup
      const invalidJson = '{"key1": "value1", "key2": "value2", }'

      // Execute
      const result = JSONValidator._attemptJsonFix(invalidJson)

      // Verify
      expect(result).not.toContain(', }')
      expect(result).toContain('value2"}')
      // Ensure it's now valid JSON
      expect(() => JSON.parse(result)).not.toThrow()
    })

    test('should fix trailing commas in arrays', () => {
      // Setup
      const invalidJson = '{"key": [1, 2, 3, ]}'

      // Execute
      const result = JSONValidator._attemptJsonFix(invalidJson)

      // Verify
      expect(result).not.toContain('3, ]')
      expect(result).toContain('3]}')
      // Ensure it's now valid JSON
      expect(() => JSON.parse(result)).not.toThrow()
    })

    test('should fix unquoted property names', () => {
      // Setup
      const invalidJson = '{key: "value"}'

      // Execute
      const result = JSONValidator._attemptJsonFix(invalidJson)

      // Verify
      expect(result).toContain('"key"')
      // Ensure it's now valid JSON
      expect(() => JSON.parse(result)).not.toThrow()
    })

    test('should fix single-quoted values', () => {
      // Setup
      const invalidJson = '{"key": \'value\'}'

      // Execute
      const result = JSONValidator._attemptJsonFix(invalidJson)

      // Verify
      expect(result).toContain('"value"')
      // Ensure it's now valid JSON
      expect(() => JSON.parse(result)).not.toThrow()
    })
  })

  describe('_getLineNumberForMatch', () => {
    test('should find the correct line number for a match', () => {
      // Setup
      const templateData = 'Line 1\nLine 2\nLine 3 with match\nLine 4'

      // Execute
      const result = JSONValidator._getLineNumberForMatch(templateData, 'match')

      // Verify
      expect(result).toBe(3) // 1-based index
    })

    test('should return 0 if match is not found', () => {
      // Setup
      const templateData = 'Line 1\nLine 2\nLine 3\nLine 4'

      // Execute
      const result = JSONValidator._getLineNumberForMatch(templateData, 'nonexistent')

      // Verify
      expect(result).toBe(0)
    })
  })

  describe('_getErrorContextString', () => {
    test('should provide context around the error line', () => {
      // Setup
      const templateData = 'Line 1\nLine 2\nLine 3 with error\nLine 4\nLine 5'

      // Execute
      const result = JSONValidator._getErrorContextString(templateData, 'error', 3)

      // Verify
      expect(result).toContain('1|')
      expect(result).toContain('2|')
      expect(result).toContain('3|')
      expect(result).toContain('4|')
      expect(result).toContain('5|')
      expect(result).toContain(' >> 3|') // Error line indicator
    })

    test('should handle invalid line numbers', () => {
      // Setup
      const templateData = 'Line 1\nLine 2\nLine 3 with error\nLine 4\nLine 5'

      // Execute
      const result = JSONValidator._getErrorContextString(templateData, 'error', 999)

      // Verify
      // Should find the line containing 'error' which is line 3
      expect(result).toContain(' >> 3|')
    })
  })

  describe('formatCriticalErrors', () => {
    test('should format critical errors into readable message', () => {
      // Setup
      const jsonErrors = [
        {
          lineNumber: 10,
          messages: ['Invalid JSON: Missing closing brace'],
          context: 'Line context...',
          critical: true,
        },
        {
          lineNumber: 20,
          messages: ['Invalid JSON: Single quotes used'],
          context: 'Another line context...',
          critical: true,
        },
      ]

      // Execute
      const result = JSONValidator.formatCriticalErrors(jsonErrors)

      // Verify
      expect(result).toContain('Template has critical errors')
      expect(result).toContain('LINE 10:')
      expect(result).toContain('LINE 20:')
      expect(result).toContain('Missing closing brace')
      expect(result).toContain('Single quotes used')
    })

    test('should ignore non-critical errors', () => {
      // Setup
      const jsonErrors = [
        {
          lineNumber: 10,
          messages: ['Critical error'],
          context: 'Line context...',
          critical: true,
        },
        {
          lineNumber: 20,
          messages: ['Non-critical warning'],
          context: 'Another line context...',
          critical: false,
        },
      ]

      // Execute
      const result = JSONValidator.formatCriticalErrors(jsonErrors)

      // Verify
      expect(result).toContain('LINE 10:')
      expect(result).not.toContain('LINE 20:')
      expect(result).toContain('Critical error')
      expect(result).not.toContain('Non-critical warning')
    })
  })
})
