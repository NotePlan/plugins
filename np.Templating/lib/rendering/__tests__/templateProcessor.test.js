/* global describe, it, expect, beforeAll, afterAll, jest */

import { render } from '../templateProcessor'
import TemplatingEngine from '../../TemplatingEngine'
import NPTemplating from '../../NPTemplating'

// Mock NotePlan environment for testing
const mockNotePlanEnvironment = () => {
  global.CommandBar = {
    prompt: jest.fn().mockResolvedValue('OK'),
    textPrompt: jest.fn().mockResolvedValueOnce('john').mockResolvedValueOnce('doe'),
    showOptions: jest.fn().mockResolvedValueOnce({ index: 0, value: 'high' }),
  }

  global.DataStore = {
    settings: {},
    preference: jest.fn().mockReturnValue(''),
    loadJSON: jest.fn().mockReturnValue({
      templateFolderName: '@Templates',
      templateLocale: 'en-US',
      templateGroupTemplatesByFolder: false,
      dateFormat: 'YYYY-MM-DD',
      timeFormat: 'HH:mm',
      defaultFormats: {
        now: 'YYYY-MM-DD HH:mm',
      },
      userFirstName: '',
      userLastName: '',
      userEmail: '',
      userPhone: '',
      services: {},
    }),
    saveJSON: jest.fn().mockReturnValue(true),
  }

  global.NotePlan = {
    environment: {
      languageCode: 'en-US',
      templateFolder: '@Templates',
    },
  }

  global.Clipboard = {
    string: 'test clipboard content',
  }
}

const cleanupNotePlanEnvironment = () => {
  delete global.CommandBar
  delete global.DataStore
  delete global.NotePlan
  delete global.Clipboard
}

describe('Template Processor', () => {
  beforeAll(() => {
    mockNotePlanEnvironment()
  })

  afterAll(() => {
    cleanupNotePlanEnvironment()
  })

  describe('templateConfig integration', () => {
    it('should make helper modules available when templateConfig is provided via TemplatingEngine directly', async () => {
      const templateData = 'Current time: <%- time.now() %>'
      const mockConfig = {
        templateFolderName: '@Templates',
        templateLocale: 'en-US',
        templateGroupTemplatesByFolder: false,
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm',
        defaultFormats: {
          now: 'YYYY-MM-DD HH:mm',
        },
      }

      // Test TemplatingEngine directly to avoid config override issues
      const engine = new TemplatingEngine(mockConfig, '')
      const result = await engine.render(templateData, {}, {})

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')

      // Should contain a rendered time (basic pattern check)
      expect(result).toMatch(/Current time: \d{2}:\d{2}/)
    })

    it('should make helper modules available when going through NPTemplating.render() - REAL WORLD SCENARIO', async () => {
      const templateData = 'Current time: <%- time.now() %>'

      // This should reproduce the real-world scenario
      const result = await NPTemplating.render(templateData, {}, {})

      console.log('NPTemplating.render result:', result)
      console.log('NPTemplating.templateConfig:', JSON.stringify(NPTemplating.templateConfig, null, 2))

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')

      // Should contain a rendered time (basic pattern check)
      expect(result).toMatch(/Current time: \d{2}:\d{2}/)
    })

    it('should handle complex variable names with underscores from prompts', async () => {
      const templateData = `
# Test Template
- Basic text prompt: \`<%- What_is_your_first_name %>\`
- Choice prompt: \`<%- priority %>\`
- Last name: \`<%- lastName %>\`
`.trim()

      // Simulate session data that would be created by prompt processing
      const sessionData = {
        What_is_your_first_name: 'john',
        priority: 'high',
        lastName: 'doe',
      }

      const mockConfig = {
        templateFolderName: '@Templates',
        templateLocale: 'en-US',
        templateGroupTemplatesByFolder: false,
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm',
        defaultFormats: {
          now: 'YYYY-MM-DD HH:mm',
        },
      }

      const engine = new TemplatingEngine(mockConfig, '')
      const result = await engine.render(templateData, sessionData, {})

      console.log('Complex variable names test result:', result)

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')
      expect(result).not.toContain('SyntaxError')

      // Should contain the rendered values
      expect(result).toContain('john')
      expect(result).toContain('high')
      expect(result).toContain('doe')
    })

    it('should handle the exact real-world template that is failing', async () => {
      const templateData = `# Prompt Examples
## Basic Prompts
### Simple Text Input
- Basic text prompt: \`<%- What_is_your_first_name %>\`
  - Output: User's entered text (e.g., "John")

### Choice List
- Choice list prompt: \`<%- priority %>\`
  - Output: Selected value from list (e.g., "high")

### Define Early, Use Later
- Define variable: \`<%- lastName %>\`
- Use variable: \`<%- lastName %>\`
  - Output: Value entered in prompt (e.g., "Erickson" -- you should only see this once)
`

      // Simulate the exact session data from the error log
      const sessionData = {
        title: 'Prompt Examples',
        type: 'meeting-note, empty-note',
        frontmatter: {
          title: 'Prompt Examples',
          type: 'meeting-note, empty-note',
        },
        What_is_your_first_name: 'john',
        priority: 'high',
        lastName: 'doe',
      }

      const mockConfig = {
        templateFolderName: '@Templates',
        templateLocale: 'en-US',
        templateGroupTemplatesByFolder: false,
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm',
        defaultFormats: {
          now: 'YYYY-MM-DD HH:mm',
        },
        userFirstName: 'John',
        userLastName: 'Doe',
        userEmail: 'name@domain.com',
        userPhone: '(714) 555-1212',
      }

      const engine = new TemplatingEngine(mockConfig, '')
      const result = await engine.render(templateData, sessionData, {})

      console.log('Real-world template test result:', result)

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')
      expect(result).not.toContain('SyntaxError')
      expect(result).not.toContain('Unexpected identifier')

      // Should contain the rendered values
      expect(result).toContain('john')
      expect(result).toContain('high')
      expect(result).toContain('doe')
    })

    it('should handle the exact real-world template with original prompt syntax - FULL PIPELINE TEST', async () => {
      // This test uses the ORIGINAL template with prompt() calls, not the processed variable names
      // This reproduces the exact real-world flow: prompt processing → EJS rendering
      const templateData = `# Prompt Examples
## Basic Prompts  
### Simple Text Input
- Basic text prompt: \`<%- prompt('What is your first name?') %>\`
  - Output: User's entered text (e.g., "John")

### Choice List
- Choice list prompt: \`<%- prompt('priority', 'What is task priority?', ['high', 'medium', 'low']) %>\`
  - Output: Selected value from list (e.g., "high")

### Define Early, Use Later
- Define variable: \`<% prompt('lastName', 'What is your last name?') -%>\`
- Use variable: \`<%- lastName %>\`
  - Output: Value entered in prompt (e.g., "Erickson" -- you should only see this once)
`

      // Mock the prompt responses to match the real-world scenario
      global.CommandBar.textPrompt = jest
        .fn()
        .mockResolvedValueOnce('john') // What is your first name?
        .mockResolvedValueOnce('doe') // What is your last name?

      global.CommandBar.showOptions = jest.fn().mockResolvedValueOnce({ index: 0, value: 'high' }) // priority selection

      const result = await NPTemplating.render(templateData, {}, {})

      console.log('Full pipeline test result:', result)

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')
      expect(result).not.toContain('SyntaxError')
      expect(result).not.toContain('Unexpected identifier')

      // Should contain the rendered values
      expect(result).toContain('john')
      expect(result).toContain('high')
      expect(result).toContain('doe')
    })

    it('should fall back gracefully when no templateConfig is provided', async () => {
      const templateData = 'Just text, no templates'

      const result = await render(templateData, {}, {})

      expect(result).toBe('Just text, no templates')
    })

    describe('JavaScript Variable Name Conversion', () => {
      // Test the cleanVarName function directly
      const BasePromptHandler = require('../../support/modules/prompts/BasePromptHandler').default

      it('should handle basic valid cases', () => {
        expect(BasePromptHandler.cleanVarName('What is your first name?')).toBe('What_is_your_first_name')
        expect(BasePromptHandler.cleanVarName('variable_1')).toBe('variable_1')
        expect(BasePromptHandler.cleanVarName('validName')).toBe('validName')
        expect(BasePromptHandler.cleanVarName('_underscore')).toBe('_underscore')
        expect(BasePromptHandler.cleanVarName('$dollar')).toBe('$dollar')
      })

      it('should handle edge cases and invalid characters', () => {
        // Test starting with digits
        expect(BasePromptHandler.cleanVarName('123test')).toBe('var_123test')
        expect(BasePromptHandler.cleanVarName('9variable')).toBe('var_9variable')

        // Test invalid characters in middle - now properly handled
        expect(BasePromptHandler.cleanVarName('test-name')).toBe('test_name')
        expect(BasePromptHandler.cleanVarName('test.name')).toBe('test_name')
        expect(BasePromptHandler.cleanVarName('test@name')).toBe('test_name')
        expect(BasePromptHandler.cleanVarName('test name with spaces')).toBe('test_name_with_spaces')

        // Test special characters
        expect(BasePromptHandler.cleanVarName('test#name')).toBe('test_name')
        expect(BasePromptHandler.cleanVarName('test+name')).toBe('test_name')
        expect(BasePromptHandler.cleanVarName('test%name')).toBe('test_name')
      })

      it('should handle reserved keywords', () => {
        // Current implementation covers some
        expect(BasePromptHandler.cleanVarName('function')).toBe('var_function')
        expect(BasePromptHandler.cleanVarName('class')).toBe('var_class')
        expect(BasePromptHandler.cleanVarName('var')).toBe('var_var')
        expect(BasePromptHandler.cleanVarName('let')).toBe('var_let')
        expect(BasePromptHandler.cleanVarName('const')).toBe('var_const')

        // Previously missing keywords - now properly handled
        expect(BasePromptHandler.cleanVarName('await')).toBe('var_await')
        expect(BasePromptHandler.cleanVarName('async')).toBe('var_async')
        expect(BasePromptHandler.cleanVarName('default')).toBe('var_default')
        expect(BasePromptHandler.cleanVarName('export')).toBe('var_export')
        expect(BasePromptHandler.cleanVarName('import')).toBe('var_import')
        expect(BasePromptHandler.cleanVarName('null')).toBe('var_null')
        expect(BasePromptHandler.cleanVarName('undefined')).toBe('var_undefined')
        expect(BasePromptHandler.cleanVarName('true')).toBe('var_true')
        expect(BasePromptHandler.cleanVarName('false')).toBe('var_false')
      })

      it('should handle empty and null inputs', () => {
        expect(BasePromptHandler.cleanVarName('')).toBe('unnamed')
        expect(BasePromptHandler.cleanVarName(null)).toBe('unnamed')
        expect(BasePromptHandler.cleanVarName(undefined)).toBe('unnamed')
        expect(BasePromptHandler.cleanVarName('   ')).toBe('unnamed') // Now properly handled
      })

      it('should handle Unicode characters', () => {
        expect(BasePromptHandler.cleanVarName('café')).toBe('café') // Should work with Unicode regex
        expect(BasePromptHandler.cleanVarName('Наименование')).toBe('Наименование') // Cyrillic
        expect(BasePromptHandler.cleanVarName('名前')).toBe('名前') // Japanese
      })

      it('should handle complex real-world examples', () => {
        expect(BasePromptHandler.cleanVarName('What is your e-mail address?')).toBe('What_is_your_e_mail_address')
        expect(BasePromptHandler.cleanVarName('User ID (required)')).toBe('User_ID_required')
        expect(BasePromptHandler.cleanVarName('File.Name.Extension')).toBe('File_Name_Extension')
        expect(BasePromptHandler.cleanVarName('API_KEY_V2.1')).toBe('API_KEY_V2_1')
      })
    })

    describe('Error Scenarios', () => {
      it('should handle nested prompt calls gracefully - user enters template tag as prompt answer', async () => {
        // This reproduces the real-world error where:
        // 1. User gets prompted for some field
        // 2. User's answer is literally "<%- prompt('nested question') %>"
        // 3. This creates a nested prompt call that should fail gracefully

        // The key insight: when a user enters template syntax as their answer,
        // it gets processed by EJS later, which tries to execute the prompt() function
        const templateData = `# Test Template
User input: <%- promptKey('fieldName', 'What is your name?') %>
`

        // This should trigger the nested prompt error since EJS will try to execute promptKey()
        const sessionData = {}

        const mockConfig = {
          templateFolderName: '@Templates',
          templateLocale: 'en-US',
          templateGroupTemplatesByFolder: false,
          dateFormat: 'YYYY-MM-DD',
          timeFormat: 'HH:mm',
          defaultFormats: {
            now: 'YYYY-MM-DD HH:mm',
          },
        }

        const engine = new TemplatingEngine(mockConfig, '')
        const result = await engine.render(templateData, sessionData, {})

        console.log('Nested prompt test result:', result)

        // Should contain a helpful error message about nested prompts
        expect(result).toContain('Error')
        expect(result).toContain('Nested promptKey() calls are not allowed')
        // Should NOT crash with ReferenceError
        expect(result).not.toContain('ReferenceError')
        expect(result).not.toContain('promptKey is not defined')
      })

      it('should provide helpful error for undefined functions in templates', async () => {
        // Test what happens when an undefined function is called
        const templateData = `# Test Template
Result: <%- nonExistentFunction() %>
`

        const mockConfig = {
          templateFolderName: '@Templates',
          templateLocale: 'en-US',
        }

        const engine = new TemplatingEngine(mockConfig, '')
        const result = await engine.render(templateData, {}, {})

        console.log('Undefined function test result:', result)

        // Should contain a helpful error message
        expect(result).toContain('Error')
        // Should mention the undefined function
        expect(result).toContain('nonExistentFunction')
      })
    })
  })
})
