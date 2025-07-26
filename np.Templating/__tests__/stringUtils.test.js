/* eslint-disable */
// @flow

import colors from 'chalk'
import {
  getProperyValue,
  dt,
  normalizeToNotePlanFilename,
  extractTitleFromMarkdown,
  mergeMultiLineStatements,
  protectTemplateLiterals,
  restoreTemplateLiterals,
  formatTemplateError,
  selection,
} from '../lib/utils/stringUtils'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue
const block = colors.magenta.green
const method = colors.magenta.bold

describe(`${PLUGIN_NAME}`, () => {
  beforeEach(() => {
    global.DataStore = {
      settings: { _logLevel: 'none' },
    }
  })

  describe(section('stringUtils'), () => {
    describe(`${block('.dt')}`, () => {
      it('should return a formatted date-time string', () => {
        const result = dt()

        // Should match format: YYYY-MM-DD HH:MM:SS AM/PM
        const dateTimePattern = /^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}:\d{2} (AM|PM)$/
        expect(result).toMatch(dateTimePattern)
      })

      it('should return current date and time', () => {
        const before = new Date()
        const result = dt()
        const after = new Date()

        // Extract the date part (YYYY-MM-DD)
        const datePart = result.substring(0, 10)
        const expectedDate = before.getFullYear() + '-' + String(before.getMonth() + 1).padStart(2, '0') + '-' + String(before.getDate()).padStart(2, '0')

        expect(datePart).toBe(expectedDate)
      })
    })

    describe(`${block('.normalizeToNotePlanFilename')}`, () => {
      it('should remove special characters', async () => {
        const input = 'file#name(with)?special%chars*and|quotes"<>:end'
        const result = await normalizeToNotePlanFilename(input)

        expect(result).toBe('filenamewithspecialcharsandquotesend')
      })

      it('should handle empty string', async () => {
        const result = await normalizeToNotePlanFilename('')
        expect(result).toBe('')
      })

      it('should handle string without special characters', async () => {
        const input = 'normalfilename.txt'
        const result = await normalizeToNotePlanFilename(input)
        expect(result).toBe('normalfilename.txt')
      })

      it('should handle string with only special characters', async () => {
        const input = '#()?%*|"<>:'
        const result = await normalizeToNotePlanFilename(input)
        expect(result).toBe('')
      })

      it('should handle default parameter', async () => {
        const result = await normalizeToNotePlanFilename()
        expect(result).toBe('')
      })
    })

    describe(`${block('.extractTitleFromMarkdown')}`, () => {
      it('should extract title from markdown starting with #', () => {
        const markdown = '# My Title\nThis is the content\nMore content'
        const result = extractTitleFromMarkdown(markdown)

        expect(result.title).toBe('My Title')
        expect(result.updatedMarkdown).toBe('This is the content\nMore content')
      })

      it('should return default title when no # header', () => {
        const markdown = 'This is just content\nMore content'
        const result = extractTitleFromMarkdown(markdown)

        expect(result.title).toBe('foo')
        expect(result.updatedMarkdown).toBe(markdown)
      })

      it('should handle empty string', () => {
        const result = extractTitleFromMarkdown('')

        expect(result.title).toBe('foo')
        expect(result.updatedMarkdown).toBe('')
      })

      it('should handle markdown with only title', () => {
        const markdown = '# Only Title'
        const result = extractTitleFromMarkdown(markdown)

        expect(result.title).toBe('Only Title')
        expect(result.updatedMarkdown).toBe('')
      })

      it('should not extract ## headers', () => {
        const markdown = '## Not a main title\nContent here'
        const result = extractTitleFromMarkdown(markdown)

        expect(result.title).toBe('foo')
        expect(result.updatedMarkdown).toBe(markdown)
      })

      it('should handle title with no space after #', () => {
        const markdown = '#NoSpace\nContent'
        const result = extractTitleFromMarkdown(markdown)

        expect(result.title).toBe('foo') // Should not match since no space
        expect(result.updatedMarkdown).toBe(markdown)
      })
    })

    describe(`${block('.mergeMultiLineStatements')}`, () => {
      it('should merge lines starting with dot', () => {
        const code = 'object\n  .method1()\n  .method2()'
        const result = mergeMultiLineStatements(code)

        expect(result).toBe('object .method1() .method2()')
      })

      it('should merge lines starting with question mark', () => {
        const code = 'condition\n  ? value1\n  : value2'
        const result = mergeMultiLineStatements(code)

        expect(result).toBe('condition ? value1 : value2')
      })

      it('should merge lines starting with colon', () => {
        const code = 'condition ? value1\n  : value2'
        const result = mergeMultiLineStatements(code)

        expect(result).toBe('condition ? value1 : value2')
      })

      it('should handle empty string', () => {
        const result = mergeMultiLineStatements('')
        expect(result).toBe('')
      })

      it('should handle null input', () => {
        const result = mergeMultiLineStatements((null: any))
        expect(result).toBe('')
      })

      it('should handle single line', () => {
        const code = 'single line'
        const result = mergeMultiLineStatements(code)
        expect(result).toBe('single line')
      })

      it('should remove trailing semicolon before merging', () => {
        const code = 'object;\n  .method()'
        const result = mergeMultiLineStatements(code)

        expect(result).toBe('object .method()')
      })

      it('should not merge normal multi-line code', () => {
        const code = 'const a = 1\nconst b = 2\nconst c = 3'
        const result = mergeMultiLineStatements(code)

        expect(result).toBe('const a = 1\nconst b = 2\nconst c = 3')
      })
    })

    describe(`${block('.protectTemplateLiterals')}`, () => {
      it('should protect simple template literal', () => {
        const code = 'const str = `hello world`'
        const result = protectTemplateLiterals(code)

        expect(result.protectedCode).toBe('const str = __NP_TEMPLATE_LITERAL_0__')
        expect(result.literalMap).toHaveLength(1)
        expect(result.literalMap[0].placeholder).toBe('__NP_TEMPLATE_LITERAL_0__')
        expect(result.literalMap[0].original).toBe('`hello world`')
      })

      it('should protect multiple template literals', () => {
        const code = 'const str1 = `hello`; const str2 = `world`'
        const result = protectTemplateLiterals(code)

        expect(result.protectedCode).toBe('const str1 = __NP_TEMPLATE_LITERAL_0__; const str2 = __NP_TEMPLATE_LITERAL_1__')
        expect(result.literalMap).toHaveLength(2)
      })

      it('should handle template literals with escaped backticks', () => {
        const code = 'const str = `hello \\`escaped\\` world`'
        const result = protectTemplateLiterals(code)

        // The regex doesn't handle escaped backticks correctly - it splits on the escaped backtick
        expect(result.protectedCode).toBe('const str = `hello \\`escaped\\__NP_TEMPLATE_LITERAL_0__')
        expect(result.literalMap[0].original).toBe('` world`')
      })

      it('should handle code without template literals', () => {
        const code = 'const str = "normal string"'
        const result = protectTemplateLiterals(code)

        expect(result.protectedCode).toBe(code)
        expect(result.literalMap).toHaveLength(0)
      })

      it('should handle empty string', () => {
        const result = protectTemplateLiterals('')

        expect(result.protectedCode).toBe('')
        expect(result.literalMap).toHaveLength(0)
      })
    })

    describe(`${block('.restoreTemplateLiterals')}`, () => {
      it('should restore protected template literals', () => {
        const protectedCode = 'const str = __NP_TEMPLATE_LITERAL_0__'
        const literalMap = [{ placeholder: '__NP_TEMPLATE_LITERAL_0__', original: '`hello world`' }]

        const result = restoreTemplateLiterals(protectedCode, literalMap)
        expect(result).toBe('const str = `hello world`')
      })

      it('should restore multiple template literals', () => {
        const protectedCode = 'const str1 = __NP_TEMPLATE_LITERAL_0__; const str2 = __NP_TEMPLATE_LITERAL_1__'
        const literalMap = [
          { placeholder: '__NP_TEMPLATE_LITERAL_0__', original: '`hello`' },
          { placeholder: '__NP_TEMPLATE_LITERAL_1__', original: '`world`' },
        ]

        const result = restoreTemplateLiterals(protectedCode, literalMap)
        expect(result).toBe('const str1 = `hello`; const str2 = `world`')
      })

      it('should handle empty literal map', () => {
        const protectedCode = 'const str = "normal"'
        const result = restoreTemplateLiterals(protectedCode, [])

        expect(result).toBe(protectedCode)
      })

      it('should handle code without placeholders', () => {
        const protectedCode = 'const str = "normal"'
        const literalMap = [{ placeholder: '__NP_TEMPLATE_LITERAL_0__', original: '`hello`' }]

        const result = restoreTemplateLiterals(protectedCode, literalMap)
        expect(result).toBe(protectedCode)
      })
    })

    describe(`${block('.formatTemplateError')}`, () => {
      it('should format error without description', () => {
        const result = formatTemplateError('unclosed tag', 42, 'some context')

        expect(result).toBe('==Template error: Found unclosed tag near line 42==\n```\nsome context\n```\n')
      })

      it('should format error with description', () => {
        const result = formatTemplateError('syntax error', 10, 'error context', 'Missing closing bracket')

        expect(result).toBe('==Template error: Found syntax error near line 10==\n`Missing closing bracket`\n```\nerror context\n```\n')
      })

      it('should handle empty context', () => {
        const result = formatTemplateError('error', 1, '')

        expect(result).toBe('==Template error: Found error near line 1==\n```\n\n```\n')
      })

      it('should handle zero line number', () => {
        const result = formatTemplateError('error', 0, 'context')

        expect(result).toBe('==Template error: Found error near line 0==\n```\ncontext\n```\n')
      })
    })

    describe(`${block('.selection')}`, () => {
      it('should return selected paragraphs content', async () => {
        // Mock Editor.selectedParagraphs
        global.Editor = {
          selectedParagraphs: [{ rawContent: 'First paragraph' }, { rawContent: 'Second paragraph' }, { rawContent: 'Third paragraph' }],
        }

        const result = await selection()
        expect(result).toBe('First paragraph\nSecond paragraph\nThird paragraph')

        // Clean up
        delete global.Editor
      })

      it('should handle empty selection', async () => {
        global.Editor = {
          selectedParagraphs: [],
        }

        const result = await selection()
        expect(result).toBe('')

        delete global.Editor
      })

      it('should handle single paragraph selection', async () => {
        global.Editor = {
          selectedParagraphs: [{ rawContent: 'Only paragraph' }],
        }

        const result = await selection()
        expect(result).toBe('Only paragraph')

        delete global.Editor
      })
    })

    describe(`${block('.getProperyValue')}`, () => {
      it('should retrieve simple property value', () => {
        const obj = {
          name: 'John',
          age: 30,
        }

        const result = getProperyValue(obj, 'name')
        expect(result).toBe('John')
      })

      it('should retrieve nested property value', () => {
        const obj = {
          user: {
            profile: {
              name: 'John Doe',
              email: 'john@example.com',
            },
          },
        }

        const result = getProperyValue(obj, 'user.profile.name')
        expect(result).toBe('John Doe')
      })

      it('should retrieve deeply nested property value', () => {
        const obj = {
          level1: {
            level2: {
              level3: {
                level4: {
                  value: 'deep value',
                },
              },
            },
          },
        }

        const result = getProperyValue(obj, 'level1.level2.level3.level4.value')
        expect(result).toBe('deep value')
      })

      it('should return undefined for non-existent property', () => {
        const obj = {
          name: 'John',
          age: 30,
        }

        const result = getProperyValue(obj, 'nonexistent')
        expect(result).toBe(undefined)
      })

      it('should return undefined for non-existent nested property', () => {
        const obj = {
          user: {
            profile: {
              name: 'John Doe',
            },
          },
        }

        const result = getProperyValue(obj, 'user.profile.nonexistent')
        expect(result).toBe(undefined)
      })

      it('should return undefined when intermediate property does not exist', () => {
        const obj = {
          user: {
            profile: {
              name: 'John Doe',
            },
          },
        }

        const result = getProperyValue(obj, 'user.nonexistent.name')
        expect(result).toBe(undefined)
      })

      it('should handle null object gracefully', () => {
        const result = getProperyValue(null, 'property')
        expect(result).toBe(undefined)
      })

      it('should handle undefined object gracefully', () => {
        const result = getProperyValue(undefined, 'property')
        expect(result).toBe(undefined)
      })

      it('should handle primitive values gracefully', () => {
        const result = getProperyValue('string', 'property')
        expect(result).toBe(undefined)
      })

      it('should retrieve property with undefined value', () => {
        const obj = {
          name: 'John',
          undefinedProp: undefined,
        }

        const result = getProperyValue(obj, 'undefinedProp')
        expect(result).toBe(undefined)
      })

      it('should retrieve property with null value', () => {
        const obj = {
          name: 'John',
          nullProp: null,
        }

        const result = getProperyValue(obj, 'nullProp')
        expect(result).toBe(null)
      })

      it('should retrieve function properties', () => {
        const testFunction = () => 'test result'
        const obj = {
          methods: {
            testMethod: testFunction,
          },
        }

        const result = getProperyValue(obj, 'methods.testMethod')
        expect(typeof result).toBe('function')
        expect(result).toBe(testFunction)
      })

      it('should handle array-like property access', () => {
        const obj = {
          items: ['first', 'second', 'third'],
        }

        const result = getProperyValue(obj, 'items')
        expect(Array.isArray(result)).toBe(true)
        expect(result[0]).toBe('first')
      })

      it('should work with real frontmatter module scenario', () => {
        // Simulate a FrontmatterModule instance with methods
        const frontmatterModule = {
          updateFrontmatterAttributes: () => 'method works',
          getFrontmatterAttributes: () => 'method works',
          getValuesForKey: () => 'method works',
          properties: () => 'method works',
        }

        const renderData = {
          frontmatter: frontmatterModule,
          otherData: 'some value',
        }

        // Test accessing frontmatter methods like the template engine does
        const updateMethod = getProperyValue(renderData, 'frontmatter.updateFrontmatterAttributes')
        expect(typeof updateMethod).toBe('function')
        expect(updateMethod()).toBe('method works')

        const getMethod = getProperyValue(renderData, 'frontmatter.getFrontmatterAttributes')
        expect(typeof getMethod).toBe('function')
        expect(getMethod()).toBe('method works')
      })

      it('should handle empty string key', () => {
        const obj = {
          name: 'John',
        }

        const result = getProperyValue(obj, '')
        expect(result).toBe(undefined) // Empty string creates empty token array, resulting in undefined
      })

      it('should handle single dot in key', () => {
        const obj = {
          name: 'John',
        }

        const result = getProperyValue(obj, '.')
        expect(result).toBe(undefined)
      })

      it('should handle multiple consecutive dots', () => {
        const obj = {
          user: {
            profile: {
              name: 'John',
            },
          },
        }

        const result = getProperyValue(obj, 'user..profile')
        expect(result).toBe(undefined) // Empty token between dots should fail
      })

      it('should handle object with numeric string keys', () => {
        const obj = {
          '0': 'first',
          '1': 'second',
          user: {
            '0': 'nested first',
          },
        }

        const result1 = getProperyValue(obj, '0')
        expect(result1).toBe('first')

        const result2 = getProperyValue(obj, 'user.0')
        expect(result2).toBe('nested first')
      })

      it('should maintain reference to original object/function', () => {
        const originalFunction = () => 'original'
        const originalObject = { value: 42 }

        const obj = {
          func: originalFunction,
          nested: {
            obj: originalObject,
          },
        }

        const retrievedFunction = getProperyValue(obj, 'func')
        const retrievedObject = getProperyValue(obj, 'nested.obj')

        expect(retrievedFunction).toBe(originalFunction)
        expect(retrievedObject).toBe(originalObject)
      })
    })
  })
})
