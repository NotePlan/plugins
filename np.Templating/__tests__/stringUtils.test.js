/* eslint-disable */
// @flow

import colors from 'chalk'
import { getProperyValue } from '../lib/utils/stringUtils'

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
