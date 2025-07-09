/* global describe, it, expect, beforeAll, afterAll, jest */

import {
  render,
  parseCodeTag,
  normalizeTagDelimiters,
  cleanCodeContent,
  processCodeLines,
  processSemicolonSeparatedStatements,
  reconstructCodeTag,
  processStatementForAwait,
} from '../templateProcessor'
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

      // console.log('NPTemplating.render result:', result)
      // console.log('NPTemplating.templateConfig:', JSON.stringify(NPTemplating.templateConfig, null, 2))

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

      // console.log('Complex variable names test result:', result)

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

      // console.log('Real-world template test result:', result)

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

      // console.log('Full pipeline test result:', result)

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

        // console.log('Nested prompt test result:', result)

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

        // console.log('Undefined function test result:', result)

        // Should contain a helpful error message
        expect(result).toContain('Error')
        // Should mention the undefined function
        expect(result).toContain('nonExistentFunction')
      })
    })
  })
})

describe('Code Tag Processing Functions', () => {
  describe('parseCodeTag', () => {
    it('should parse basic EJS tags correctly', () => {
      const tag = '<% console.log("hello") %>'
      const result = parseCodeTag(tag)

      expect(result).not.toBeNull()
      expect(result.startDelim).toBe('<%')
      expect(result.rawCodeContent).toBe(' console.log("hello") ')
      expect(result.endDelim).toBe('%>')
    })

    it('should parse output tags correctly', () => {
      const tag = '<%- variable %>'
      const result = parseCodeTag(tag)

      expect(result).not.toBeNull()
      expect(result.startDelim).toBe('<%-')
      expect(result.rawCodeContent).toBe(' variable ')
      expect(result.endDelim).toBe('%>')
    })

    it('should parse escaped output tags correctly', () => {
      const tag = '<%=  user.name  %>'
      const result = parseCodeTag(tag)

      expect(result).not.toBeNull()
      expect(result.startDelim).toBe('<%=')
      expect(result.rawCodeContent).toBe('  user.name  ')
      expect(result.endDelim).toBe('%>')
    })

    it('should parse chomp tags correctly', () => {
      const tag = '<%~ someFunction() -%>'
      const result = parseCodeTag(tag)

      expect(result).not.toBeNull()
      expect(result.startDelim).toBe('<%~')
      expect(result.rawCodeContent).toBe(' someFunction() ')
      expect(result.endDelim).toBe('-%>')
    })

    it('should parse comment tags correctly', () => {
      const tag = '<%# someFunction() %>'
      const result = parseCodeTag(tag)

      expect(result).not.toBeNull()
      expect(result.startDelim).toBe('<%#')
      expect(result.rawCodeContent).toBe(' someFunction() ')
      expect(result.endDelim).toBe('%>')
    })

    it('should handle multi-line content', () => {
      const tag = `<%
        if (condition) {
          doSomething()
        }
      %>`
      const result = parseCodeTag(tag)

      expect(result).not.toBeNull()
      expect(result.startDelim).toBe('<%')
      expect(result.rawCodeContent).toContain('if (condition)')
      expect(result.rawCodeContent).toContain('doSomething()')
      expect(result.endDelim).toBe('%>')
    })

    it('should return null for invalid tags', () => {
      expect(parseCodeTag('not a tag')).toBeNull()
      expect(parseCodeTag('<% incomplete')).toBeNull()
      expect(parseCodeTag('incomplete %>')).toBeNull()
      expect(parseCodeTag('')).toBeNull()
    })

    it('should handle edge cases', () => {
      // Empty tag
      const emptyTag = '<% %>'
      const emptyResult = parseCodeTag(emptyTag)
      expect(emptyResult).not.toBeNull()
      expect(emptyResult.rawCodeContent).toBe(' ')

      // Tag with special characters
      const specialTag = '<% "<%test%>" %>'
      const specialResult = parseCodeTag(specialTag)
      expect(specialResult).not.toBeNull()
      expect(specialResult.rawCodeContent).toBe(' "<%test%>" ')
    })
  })

  describe('normalizeTagDelimiters', () => {
    it('should add space after opening delimiter when missing', () => {
      const result = normalizeTagDelimiters('<%', '%>')
      expect(result.normalizedStart).toBe('<% ')
      expect(result.normalizedEnd).toBe(' %>')
    })

    it('should add space before closing delimiter when missing', () => {
      const result = normalizeTagDelimiters('<% ', '%>')
      expect(result.normalizedStart).toBe('<% ')
      expect(result.normalizedEnd).toBe(' %>')
    })

    it('should preserve existing spaces', () => {
      const result = normalizeTagDelimiters('<% ', ' %>')
      expect(result.normalizedStart).toBe('<% ')
      expect(result.normalizedEnd).toBe(' %>')
    })

    it('should handle different tag types', () => {
      const outputResult = normalizeTagDelimiters('<%=', '%>')
      expect(outputResult.normalizedStart).toBe('<%= ')
      expect(outputResult.normalizedEnd).toBe(' %>')

      const chompResult = normalizeTagDelimiters('<%-', '-%>')
      expect(chompResult.normalizedStart).toBe('<%- ')
      expect(chompResult.normalizedEnd).toBe(' -%>')
    })

    it('should NOT add spaces to comment tags (would break comment functionality)', () => {
      const commentResult = normalizeTagDelimiters('<%#', '%>')
      expect(commentResult.normalizedStart).toBe('<%#') // Should NOT have space added
      expect(commentResult.normalizedEnd).toBe(' %>')
    })
  })

  describe('cleanCodeContent', () => {
    it('should preserve simple content with spaces', () => {
      const content = ' console.log("hello") '
      const result = cleanCodeContent(content)
      expect(result).toBe(' console.log("hello") ')
    })

    it('should remove leading newlines but preserve spaces', () => {
      const content = ' \nconsole.log("hello") '
      const result = cleanCodeContent(content)
      expect(result).toBe(' console.log("hello") ')
    })

    it('should handle tabs and spaces in leading whitespace', () => {
      const content = '\t console.log("hello") \t'
      const result = cleanCodeContent(content)
      expect(result).toBe(' console.log("hello") ')
    })

    it('should handle content with no leading/trailing whitespace', () => {
      const content = 'console.log("hello")'
      const result = cleanCodeContent(content)
      expect(result).toBe('console.log("hello")')
    })

    it('should handle multiple leading returns', () => {
      const content = '\n\r\nif (condition) { return true; }'
      const result = cleanCodeContent(content)
      expect(result).toBe('if (condition) { return true; }')
    })

    it('should preserve internal spacing and newlines', () => {
      const content = ' if (condition) {\n  return true;\n} '
      const result = cleanCodeContent(content)
      expect(result).toBe(' if (condition) {\n  return true;\n} ')
    })
  })

  describe('processSemicolonSeparatedStatements', () => {
    const mockAsyncFunctions = ['asyncFunc', 'anotherAsync']

    it('should process single statement', () => {
      const line = 'console.log("hello")'
      const result = processSemicolonSeparatedStatements(line, mockAsyncFunctions)
      expect(result).toBe('console.log("hello")')
    })

    it('should process multiple statements', () => {
      const line = 'const a = 1; const b = 2'
      const result = processSemicolonSeparatedStatements(line, mockAsyncFunctions)
      expect(result).toBe('const a = 1; const b = 2')
    })

    it('should add await to async function calls', () => {
      const line = 'asyncFunc(); console.log("done")'
      const result = processSemicolonSeparatedStatements(line, mockAsyncFunctions)
      expect(result).toBe('await asyncFunc(); console.log("done")')
    })

    it('should preserve trailing semicolon', () => {
      const line = 'console.log("hello");'
      const result = processSemicolonSeparatedStatements(line, mockAsyncFunctions)
      expect(result).toBe('console.log("hello");')
    })

    it('should handle empty statements from multiple semicolons', () => {
      const line = 'console.log("hello");;console.log("world")'
      const result = processSemicolonSeparatedStatements(line, mockAsyncFunctions)
      expect(result).toBe('console.log("hello");; console.log("world")')
    })

    it('should handle line with only semicolons', () => {
      const line = ';;;'
      const result = processSemicolonSeparatedStatements(line, mockAsyncFunctions)
      expect(result).toBe(';;;')
    })

    it('should handle multiple async functions', () => {
      const line = 'asyncFunc(); anotherAsync(); console.log("done")'
      const result = processSemicolonSeparatedStatements(line, mockAsyncFunctions)
      expect(result).toBe('await asyncFunc(); await anotherAsync(); console.log("done")')
    })
  })

  describe('processCodeLines', () => {
    const mockAsyncFunctions = ['asyncFunc', 'templateFunc']

    it('should process single line without semicolons', () => {
      const content = 'console.log("hello")'
      const result = processCodeLines(content, mockAsyncFunctions)
      expect(result).toBe('console.log("hello")')
    })

    it('should add await to async functions', () => {
      const content = 'asyncFunc()'
      const result = processCodeLines(content, mockAsyncFunctions)
      expect(result).toBe('await asyncFunc()')
    })

    it('should handle multiple lines', () => {
      const content = `if (condition) {
  asyncFunc()
}`
      const result = processCodeLines(content, mockAsyncFunctions)
      expect(result).toContain('await asyncFunc()')
      expect(result).toContain('if (condition)')
    })

    it('should preserve empty lines in multi-line content', () => {
      const content = `console.log("start")

console.log("end")`
      const result = processCodeLines(content, mockAsyncFunctions)
      expect(result.split('\n')).toHaveLength(3)
      expect(result.split('\n')[1]).toBe('')
    })

    it('should handle statements with semicolons', () => {
      const content = 'asyncFunc(); console.log("done");'
      const result = processCodeLines(content, mockAsyncFunctions)
      expect(result).toBe('await asyncFunc(); console.log("done");')
    })

    it('should handle template literals (protected)', () => {
      const content = '`Hello ${asyncFunc()}`'
      const result = processCodeLines(content, mockAsyncFunctions)
      // Template literals should be protected from await processing
      expect(result).toBe('`Hello ${asyncFunc()}`')
    })
  })

  describe('reconstructCodeTag', () => {
    it('should reconstruct basic tag', () => {
      const result = reconstructCodeTag('<% ', 'console.log("hello")', ' %>')
      expect(result).toBe('<% console.log("hello") %>')
    })

    it('should handle different tag types', () => {
      const outputTag = reconstructCodeTag('<%- ', 'variable', ' %>')
      expect(outputTag).toBe('<%- variable %>')

      const chompTag = reconstructCodeTag('<% ', 'code', ' -%>')
      expect(chompTag).toBe('<% code -%>')
    })

    it('should handle multi-line content', () => {
      const content = `if (condition) {
  doSomething()
}`
      const result = reconstructCodeTag('<% ', content, ' %>')
      expect(result).toBe(`<% ${content} %>`)
    })
  })

  describe('processStatementForAwait', () => {
    const mockAsyncFunctions = ['getData', 'saveData', 'processAsync']

    it('should not add await if already present', () => {
      const statement = 'await getData()'
      const result = processStatementForAwait(statement, mockAsyncFunctions)
      expect(result).toBe('await getData()')
    })

    it('should add await to async function calls', () => {
      const statement = 'getData()'
      const result = processStatementForAwait(statement, mockAsyncFunctions)
      expect(result).toBe('await getData()')
    })

    it('should not add await to control structures', () => {
      const controlStatements = ['if (condition)', 'else if (condition)', 'for (let i = 0; i < 10; i++)', 'while (condition)', 'switch (value)', 'return result', 'catch (error)']

      controlStatements.forEach((statement) => {
        const result = processStatementForAwait(statement, mockAsyncFunctions)
        expect(result).toBe(statement)
      })
    })

    it('should handle variable declarations with async function calls', () => {
      const statement = 'const result = getData()'
      const result = processStatementForAwait(statement, mockAsyncFunctions)
      expect(result).toBe('const result = await getData()')
    })

    it('should not process template literals', () => {
      const statement = '`Hello ${getData()}`'
      const result = processStatementForAwait(statement, mockAsyncFunctions)
      expect(result).toBe('`Hello ${getData()}`')
    })

    it('should handle ternary operators', () => {
      const statement = 'condition ? value1 : value2'
      const result = processStatementForAwait(statement, mockAsyncFunctions)
      expect(result).toBe('condition ? value1 : value2')
    })

    it('should not add await to non-async functions', () => {
      const statement = 'console.log("hello")'
      const result = processStatementForAwait(statement, mockAsyncFunctions)
      expect(result).toBe('console.log("hello")')
    })

    it('should handle method calls on async functions', () => {
      const statement = 'obj.getData()'
      const result = processStatementForAwait(statement, mockAsyncFunctions)
      // Should not add await for method calls unless the full path is in asyncFunctions
      expect(result).toBe('obj.getData()')
    })

    it('should handle complex expressions', () => {
      const statement = 'getData().then(result => console.log(result))'
      const result = processStatementForAwait(statement, mockAsyncFunctions)
      expect(result).toBe('await getData().then(result => console.log(result))')
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete tag processing workflow', () => {
      const originalTag = '<%asyncFunc(); console.log("done")%>'
      const mockAsyncFunctions = ['asyncFunc']

      // Step 1: Parse
      const parsed = parseCodeTag(originalTag)
      expect(parsed).not.toBeNull()

      // Step 2: Normalize delimiters
      const { normalizedStart, normalizedEnd } = normalizeTagDelimiters(parsed.startDelim, parsed.endDelim)
      expect(normalizedStart).toBe('<% ')
      expect(normalizedEnd).toBe(' %>')

      // Step 3: Clean content
      const cleaned = cleanCodeContent(parsed.rawCodeContent)
      expect(cleaned).toBe('asyncFunc(); console.log("done")')

      // Step 4: Process code lines
      const processed = processCodeLines(cleaned, mockAsyncFunctions)
      expect(processed).toBe('await asyncFunc(); console.log("done")')

      // Step 5: Reconstruct
      const final = reconstructCodeTag(normalizedStart, processed, normalizedEnd)
      expect(final).toBe('<% await asyncFunc(); console.log("done") %>')
    })

    it('should handle edge case with complex multi-line code', () => {
      const originalTag = `<%
      if (condition) {
        asyncFunc();
        regularFunc();
      }
      %>`
      const mockAsyncFunctions = ['asyncFunc']

      const parsed = parseCodeTag(originalTag)
      expect(parsed).not.toBeNull()

      const cleaned = cleanCodeContent(parsed.rawCodeContent)
      const processed = processCodeLines(cleaned, mockAsyncFunctions)

      expect(processed).toContain('await asyncFunc()')
      expect(processed).toContain('regularFunc()')
      expect(processed).toContain('if (condition)')
    })
  })
})

describe('Real-world Template Failures', () => {
  describe('Basic variable assignment and conditional rendering', () => {
    it('should handle basic const assignment with conditional output', async () => {
      const template = `<% const tasks = "* real world task should display" -%>
<% if (tasks?.length) { -%>
<%- tasks %>
<% } -%>`

      const result = await render(template, {})

      // The template naturally includes a trailing newline, which is expected EJS behavior
      expect(result.trim()).toBe('* real world task should display')

      // Also test that it's not empty and contains the expected content
      expect(result).toContain('* real world task should display')
    })

    it('should handle const assignment with object conditional', async () => {
      const template = `<% const tasks = ["task 1", "task 2"] -%>
<% if (tasks?.length) { -%>
<%- tasks.join(", ") %>
<% } -%>`

      const result = await render(template, {})

      expect(result).toBe('task 1, task 2\n')
    })

    it('should handle const assignment with null/undefined check', async () => {
      const template = `<% const tasks = null -%>
<% if (tasks?.length) { -%>
<%- tasks %>
<% } else { -%>
No tasks found
<% } -%>`

      const result = await render(template, {})

      expect(result).toBe('No tasks found\n')
    })

    it('should handle const assignment with proper newline elimination', async () => {
      // Using -%> at the end to chomp the trailing newline
      const template = `<% const tasks = "* real world task should display" -%>
<% if (tasks?.length) { -%>
<%- tasks -%>
<% } -%>`

      const result = await render(template, {})

      // With proper chomp tags, there should be no trailing newline
      expect(result).toBe('* real world task should display')
    })
  })

  describe('Event Date Methods Restoration', () => {
    it('should restore eventDate and eventEndDate methods when eventDateValue and eventEndDateValue are present', async () => {
      const templateData = `Event Start: <%- eventDate('YYYY-MM-DD') %>
Event End: <%- eventEndDate('YYYY-MM-DD HH:mm') %>`

      const sessionData = {
        data: {
          eventDateValue: '2023-12-25T10:00:00Z',
          eventEndDateValue: '2023-12-25T12:00:00Z',
        },
      }

      const result = await render(templateData, sessionData, {})

      // Should not contain error messages
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('eventDate is not defined')
      expect(result).not.toContain('eventEndDate is not defined')

      // Should contain formatted dates (accounting for timezone conversion)
      expect(result).toContain('Event Start: 2023-12-25')
      // The time will be converted from UTC to local timezone, so we just check for the date part
      expect(result).toMatch(/Event End: 2023-12-25 \d{2}:\d{2}/)
    })

    it('should work with only eventDateValue present', async () => {
      const templateData = `Event Start: <%- eventDate('YYYY-MM-DD') %>`

      const sessionData = {
        data: {
          eventDateValue: '2023-12-25T10:00:00Z',
        },
      }

      const result = await render(templateData, sessionData, {})

      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).toContain('Event Start: 2023-12-25')
    })

    it('should work with only eventEndDateValue present', async () => {
      const templateData = `Event End: <%- eventEndDate('YYYY-MM-DD HH:mm') %>`

      const sessionData = {
        data: {
          eventEndDateValue: '2023-12-25T12:00:00Z',
        },
      }

      const result = await render(templateData, sessionData, {})

      expect(result).not.toContain('==Error Rendering templateData.==')
      // The time will be converted from UTC to local timezone, so we just check for the date part
      expect(result).toMatch(/Event End: 2023-12-25 \d{2}:\d{2}/)
    })

    it('should handle default format when no format is provided', async () => {
      const templateData = `Event Start: <%- eventDate() %>
Event End: <%- eventEndDate() %>`

      const sessionData = {
        data: {
          eventDateValue: '2023-12-25T10:00:00Z',
          eventEndDateValue: '2023-12-25T12:00:00Z',
        },
      }

      const result = await render(templateData, sessionData, {})

      expect(result).not.toContain('==Error Rendering templateData.==')
      // Default format is 'YYYY MM DD'
      expect(result).toContain('Event Start: 2023 12 25')
      expect(result).toContain('Event End: 2023 12 25')
    })

    it('should not interfere when eventDateValue and eventEndDateValue are not present', async () => {
      const templateData = `Just some text: <%- someVariable %>`

      const sessionData = {
        someVariable: 'test value',
      }

      const result = await render(templateData, sessionData, {})

      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).toContain('Just some text: test value')
    })
  })
})

describe('TemplateJS Code Block Detection', () => {
  describe('Fast path detection with ```templatejs blocks', () => {
    it('should use full processing when template contains ```templatejs blocks', async () => {
      const templateData = `# Test Template
Some regular text here.

\`\`\`templatejs
const message = "Hello from templatejs block"
// This code executes but doesn't output anything
\`\`\`

More text after the block.`

      const result = await render(templateData, {}, {})

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')

      // The templatejs block should be processed but not output anything (it's a scriptlet)
      // The surrounding text should be preserved
      expect(result).toContain('Some regular text here.')
      expect(result).toContain('More text after the block.')
      expect(result).toContain('# Test Template')

      // The templatejs block content should not appear in the output (it's executed, not output)
      expect(result).not.toContain('```templatejs')
      expect(result).not.toContain('const message = "Hello from templatejs block"')
    })

    it('should use full processing when template contains both EJS tags and ```templatejs blocks', async () => {
      const templateData = `# Test Template
Current time: <%- time.now() %>

\`\`\`templatejs
const greeting = "Hello from templatejs"
// This code executes but doesn't output anything
\`\`\`

End of template.`

      const result = await render(templateData, {}, {})

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')

      // Should contain EJS output
      expect(result).toMatch(/Current time: \d{2}:\d{2}/)
      expect(result).toContain('End of template.')

      // The templatejs block should be processed but not output anything
      expect(result).not.toContain('```templatejs')
      expect(result).not.toContain('const greeting = "Hello from templatejs"')
    })

    it('should use fast path when template has no EJS tags and no ```templatejs blocks', async () => {
      const templateData = `# Simple Template
This is just plain text.
No EJS tags or templatejs blocks here.

## Section
- Item 1
- Item 2`

      const result = await render(templateData, {}, {})

      // Should return the template exactly as-is (fast path)
      expect(result).toBe(templateData)
    })

    it('should use fast path when template has only regular code blocks (not templatejs)', async () => {
      const templateData = `# Template with Regular Code Blocks

\`\`\`javascript
console.log("This is regular JavaScript")
\`\`\`

\`\`\`python
print("This is Python code")
\`\`\`

End of template.`

      const result = await render(templateData, {}, {})

      // Should return the template exactly as-is (fast path)
      expect(result).toBe(templateData)
    })

    it('should handle multiple ```templatejs blocks in the same template', async () => {
      const templateData = `# Template with Multiple TemplateJS Blocks

\`\`\`templatejs
const firstBlock = "First block output"
// This code executes but doesn't output anything
\`\`\`

Middle text.

\`\`\`templatejs
const secondBlock = "Second block output"
// This code executes but doesn't output anything
\`\`\`

End text.`

      const result = await render(templateData, {}, {})

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')

      // Should contain the surrounding text
      expect(result).toContain('Middle text.')
      expect(result).toContain('End text.')
      expect(result).toContain('# Template with Multiple TemplateJS Blocks')

      // The templatejs blocks should be processed but not output anything
      expect(result).not.toContain('```templatejs')
      expect(result).not.toContain('const firstBlock = "First block output"')
      expect(result).not.toContain('const secondBlock = "Second block output"')
    })

    it('should handle ```templatejs blocks with complex JavaScript logic', async () => {
      const templateData = `# Complex TemplateJS Example

\`\`\`templatejs
const items = ["apple", "banana", "cherry"]
const formattedItems = items.map(item => \`- \${item}\`).join('\\n')
// This code executes but doesn't output anything
\`\`\`

End of template.`

      const result = await render(templateData, {}, {})

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')

      // Should contain the surrounding text
      expect(result).toContain('End of template.')
      expect(result).toContain('# Complex TemplateJS Example')

      // The templatejs block should be processed but not output anything
      expect(result).not.toContain('```templatejs')
      expect(result).not.toContain('const items = ["apple", "banana", "cherry"]')
    })

    it('should handle ```templatejs blocks that create objects (should not output anything)', async () => {
      const templateData = `# TemplateJS with Object Creation

\`\`\`templatejs
const data = { name: "John", age: 30 }
// This code executes but doesn't output anything
\`\`\`

End of template.`

      const result = await render(templateData, {}, {})

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')

      // Should contain the surrounding text
      expect(result).toContain('End of template.')
      expect(result).toContain('# TemplateJS with Object Creation')

      // The templatejs block should be processed but not output anything
      expect(result).not.toContain('```templatejs')
      expect(result).not.toContain('const data = { name: "John", age: 30 }')
    })

    it('should handle ```templatejs blocks with async operations', async () => {
      const templateData = `# TemplateJS with Async Operations

\`\`\`templatejs
// Simulate async operation
const asyncResult = await new Promise(resolve => {
  setTimeout(() => resolve("Async result"), 10)
})
// This code executes but doesn't output anything
\`\`\`

End of template.`

      const result = await render(templateData, {}, {})

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')

      // Should contain the surrounding text
      expect(result).toContain('End of template.')
      expect(result).toContain('# TemplateJS with Async Operations')

      // The templatejs block should be processed but not output anything
      expect(result).not.toContain('```templatejs')
      expect(result).not.toContain('const asyncResult = await new Promise')
    })

    it('should handle ```templatejs blocks with errors gracefully', async () => {
      const templateData = `# TemplateJS with Error

\`\`\`templatejs
// This will cause an error
const result = nonExistentFunction()
// This code would execute but doesn't output anything
\`\`\`

End of template.`

      const result = await render(templateData, {}, {})

      // Should not crash the entire template
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')

      // Should still contain the text outside the block
      expect(result).toContain('End of template.')
      expect(result).toContain('# TemplateJS with Error')
    })

    it('should handle mixed content: EJS tags, templatejs blocks, and regular code blocks', async () => {
      const templateData = `# Mixed Content Template
Current time: <%- time.now() %>

\`\`\`templatejs
const templatejsOutput = "From templatejs block"
// This code executes but doesn't output anything
\`\`\`

\`\`\`javascript
// This is regular JavaScript, should not be executed
console.log("Regular JS")
\`\`\`

\`\`\`templatejs
const secondOutput = "Second templatejs block"
// This code executes but doesn't output anything
\`\`\`

End of template.`

      const result = await render(templateData, {}, {})

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')

      // Should contain EJS output
      expect(result).toMatch(/Current time: \d{2}:\d{2}/)

      // Should contain regular code block as-is
      expect(result).toContain('```javascript')
      expect(result).toContain('console.log("Regular JS")')

      // Should contain end text
      expect(result).toContain('End of template.')

      // The templatejs blocks should be processed but not output anything
      expect(result).not.toContain('```templatejs')
      expect(result).not.toContain('const templatejsOutput = "From templatejs block"')
      expect(result).not.toContain('const secondOutput = "Second templatejs block"')
    })

    it('should handle edge case: templatejs block with no content', async () => {
      const templateData = `# Empty TemplateJS Block

\`\`\`templatejs

\`\`\`

End of template.`

      const result = await render(templateData, {}, {})

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')

      // Should still process the template (not use fast path)
      expect(result).toContain('End of template.')
      expect(result).toContain('# Empty TemplateJS Block')
    })

    it('should handle edge case: templatejs block with only whitespace', async () => {
      const templateData = `# Whitespace TemplateJS Block

\`\`\`templatejs
   
\`\`\`

End of template.`

      const result = await render(templateData, {}, {})

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')

      // Should still process the template (not use fast path)
      expect(result).toContain('End of template.')
      expect(result).toContain('# Whitespace TemplateJS Block')
    })
  })

  describe('Backtick-wrapped EJS detection', () => {
    it('should use full processing when template contains backtick-wrapped EJS tags', async () => {
      const templateData = `# Template with Backtick-Wrapped EJS
Regular text.

\`<%- someVariable %>\`

More text.`

      const sessionData = { someVariable: 'test value' }
      const result = await render(templateData, sessionData, {})

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')

      // Should contain the rendered value
      expect(result).toContain('test value')
      expect(result).toContain('Regular text.')
      expect(result).toContain('More text.')
    })

    it('should use full processing when template contains both backtick-wrapped EJS and ```templatejs', async () => {
      const templateData = `# Mixed Backtick and TemplateJS
Variable: \`<%- userVariable %>\`

\`\`\`templatejs
const blockOutput = "From templatejs"
// This code executes but doesn't output anything
\`\`\`

End.`

      const sessionData = { userVariable: 'user value' }
      const result = await render(templateData, sessionData, {})

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')

      // Should contain the backtick-wrapped EJS output
      expect(result).toContain('user value')
      expect(result).toContain('End.')

      // The templatejs block should be processed but not output anything
      expect(result).not.toContain('```templatejs')
      expect(result).not.toContain('const blockOutput = "From templatejs"')
    })
  })
})
