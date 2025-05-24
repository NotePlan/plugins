/* global describe, beforeEach, afterEach, test, expect, jest */
/**
 * @jest-environment jsdom
 */

/**
 * Tests for AI-enhanced error analysis functionality
 */

import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import TemplatingEngine from '../lib/TemplatingEngine'
import { DataStore } from '@mocks/index'

// Helper to load test fixtures
const factory = async (factoryName = '') => {
  const factoryFilename = path.join(__dirname, 'factories', factoryName)
  if (existsSync(factoryFilename)) {
    return await fs.readFile(factoryFilename, 'utf-8')
  }
  return 'FACTORY_NOT_FOUND'
}

describe('AI-Enhanced Error Analysis', () => {
  let originalConsoleLog
  let consoleOutput = []
  let originalNotePlan

  beforeEach(() => {
    originalConsoleLog = console.log
    console.log = jest.fn((...args) => {
      consoleOutput.push(args.join(' '))
    })

    // Store original NotePlan
    originalNotePlan = global.NotePlan

    // Mock DataStore
    global.DataStore = { ...DataStore, settings: { _logLevel: 'none' } }
  })

  afterEach(() => {
    console.log = originalConsoleLog
    consoleOutput = []

    // Restore original NotePlan
    global.NotePlan = originalNotePlan

    jest.clearAllMocks()
  })

  test('should provide AI-enhanced error analysis for template with multiple errors', async () => {
    // Mock NotePlan.AI with a realistic response
    global.NotePlan = {
      ...originalNotePlan,
      ai: jest.fn().mockResolvedValue(`**Problem Analysis:**

The template has several critical issues:

1. **Undefined Variables**: Multiple variables are referenced but not defined:
   - \`nonExistentVariable\` in frontmatter
   - \`undefinedBodyVariable\` in template body
   - \`anotherUndefinedVariable\` property access

2. **JavaScript Syntax Error**: Missing closing parenthesis in function call:
   \`const result = someFunction(\` - needs closing parenthesis

3. **Assignment vs Comparison**: Using assignment (=) instead of comparison (===):
   \`if (someVar = "test")\` should be \`if (someVar === "test")\`

**Solutions:**
- Define all variables before use or provide defaults
- Add the missing closing parenthesis: \`someFunction()\`
- Use comparison operators in conditions: \`===\` instead of \`=\`
- Use conditional rendering: \`<%- typeof variable !== 'undefined' ? variable : 'default' %>\`

**Quick Fix:**
Replace undefined variables with: \`<%- typeof varName !== 'undefined' ? varName : 'defaultValue' %>\``),
    }

    const errorTemplate = await factory('error-sample.ejs')
    expect(errorTemplate).not.toBe('FACTORY_NOT_FOUND')

    const templatingEngine = new TemplatingEngine({}, errorTemplate)

    const result = await templatingEngine.render(errorTemplate, {
      date: {
        now: jest.fn().mockReturnValue('2024-01-15'),
      },
    })

    // Should contain AI analysis
    expect(result).toContain('**Templating Error Found**')
    expect(result).toContain('Problem Analysis')
    expect(result).toContain('Undefined Variables')
    expect(result).toContain('JavaScript Syntax Error')

    // Verify NotePlan.ai was called with the correct parameters
    expect(global.NotePlan.ai).toHaveBeenCalledWith(expect.stringContaining('You are now an expert in EJS Templates'), [], false, 'gpt-4')

    // Check that the prompt includes the original script
    const aiCallArgs = global.NotePlan.ai.mock.calls[0][0]
    expect(aiCallArgs).toContain('original template before it went to the pre-processor')
    expect(aiCallArgs).toContain('nonExistentVariable')
    expect(aiCallArgs).toContain('undefinedBodyVariable')
  })

  test('should handle AI service failure gracefully', async () => {
    // Mock NotePlan.AI to fail
    global.NotePlan = {
      ...originalNotePlan,
      ai: jest.fn().mockRejectedValue(new Error('AI service unavailable')),
    }

    const errorTemplate = `<% const test = undefinedVariable %>`
    const templatingEngine = new TemplatingEngine({}, errorTemplate)

    const result = await templatingEngine.render(errorTemplate, {})

    // Should fall back to regular error handling when AI fails
    expect(result).toContain('Template Rendering Error')
    expect(result).not.toContain('AI Enhanced')
    expect(result).toContain('undefinedVariable')
  })

  test('should include context information in AI prompt', async () => {
    let capturedPrompt = ''
    global.NotePlan = {
      ...originalNotePlan,
      ai: jest.fn().mockImplementation((prompt) => {
        capturedPrompt = prompt
        return Promise.resolve('Mock AI response')
      }),
    }

    const errorTemplate = `<% const test = undefinedVariable %>`
    const templatingEngine = new TemplatingEngine({}, errorTemplate)

    const contextData = {
      user: { name: 'John', email: 'john@example.com' },
      date: { now: () => '2024-01-15' },
      someFunction: () => 'test',
    }

    await templatingEngine.render(errorTemplate, contextData)

    // Verify the prompt includes context information
    expect(capturedPrompt).toContain('context variables/values that were available')
    expect(capturedPrompt).toContain('user: [object with keys: name, email]')
    expect(capturedPrompt).toContain('date: [object with keys: now]')
    expect(capturedPrompt).toContain('someFunction: [function]')
  })

  test('should handle templates without original script', async () => {
    global.NotePlan = {
      ...originalNotePlan,
      ai: jest.fn().mockResolvedValue('AI analysis response'),
    }

    const errorTemplate = `<% const test = undefinedVariable %>`
    // Create engine without original script
    const templatingEngine = new TemplatingEngine({}, '')

    const result = await templatingEngine.render(errorTemplate, {})

    // Should still work even without original script
    expect(global.NotePlan.ai).toHaveBeenCalled()

    const aiCallArgs = global.NotePlan.ai.mock.calls[0][0]
    expect(aiCallArgs).toContain('No original script available')
  })
})
