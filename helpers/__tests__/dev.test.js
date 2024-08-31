// create Jest tests for file dev.js

/* globals describe, expect, test, it, jest, beforeAll, beforeEach, afterEach */
import * as d from '../dev'
import { deepCopy, clof, clo, logDebug } from '../dev'

import { Calendar, Clipboard, /* CommandBar, */ DataStore, Editor, NotePlan /*, Note, Paragraph */ } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  // global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging
})

const pluginJson = 'helpers/dev.test'

// Jest suite
describe('helpers/dev', () => {
  describe('getAllPropertyNames', () => {
    test('getAllPropertyNames', () => {
      expect(d.getAllPropertyNames({ foo: '', bar: 1 }).indexOf('foo')).toBeGreaterThan(-1)
      expect(d.getAllPropertyNames({ foo: '', bar: 1 }).indexOf('bar')).toBeGreaterThan(-1)
      // expect(d.getAllPropertyNames({ __foo__: '', bar: 1 }).indexOf('__foo__')).toEqual(-1)
    })
    if (DataStore.settings['_logLevel'] !== 'none') {
      // skipping test for log noise
      test.skip('getAllPropertyNames', () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {})
        d.logAllPropertyNames({ foo: '', bar: 1 })
        expect(log).toHaveBeenCalled()
        log.mockRestore()
      })
    }
  })
  describe('JSP', () => {
    test('JSP outputs object info', () => {
      const log = JSON.parse(d.JSP({ foo: '', bar: 1 }))
      expect(log).toEqual({ foo: '', bar: 1 })
    })
    test('JSP prettyPrint=2 formatted', () => {
      const log = d.JSP({ foo: '', bar: 1 }, 2)
      expect(log).toEqual(`{
  \"foo\": \"\",
  \"bar\": 1
}`)
    })
    test('should output full tree when passing in an array', () => {
      const arr = [{ subitems: [{ content: 'foo' }] }]
      const log = d.JSP(arr)
      logDebug(pluginJson, log)
      expect(log).toEqual(expect.stringContaining(`[0]`))
      expect(log).toEqual(expect.stringContaining(`subitems`))
    })
    test('should work with arrays in the middle also', () => {
      const arr = { someArray: [{ subitems: [{ content: 'foo' }] }] }
      const log = d.JSP(arr)
      logDebug(pluginJson, log)
      expect(log).toMatch(/someArray/m)
      expect(log).toMatch(/subitems/m)
      expect(log).toMatch(/content/m)
      expect(log).toMatch(/foo/m)
    })
  })

  /**
   * Test overrideSettingsWithStringArgs() using semicolon-seperated string inputs
   */
  describe('overrideSettingsWithStringArgs', () => {
    const testConfig = {
      stringA: 'a string',
      stringB: 'another string',
      numInt: 42,
      numNegInt: -23,
      numFloat: -42.3,
      numNaN: NaN,
      boolA: true,
      boolB: false,
      undef: undefined,
      stringArr: ['this', 'is a', 'simple array of words'],
    }

    test('expect no change to config with empty args', () => {
      const expectedConfig = Object.assign({}, testConfig)
      const res = d.overrideSettingsWithStringArgs(testConfig, '')
      expect(res).toEqual(expectedConfig)
    })
    test('expect no change to config with empty JSON args', () => {
      const expectedConfig = Object.assign({}, testConfig)
      const res = d.overrideSettingsWithStringArgs(testConfig, '{}')
      expect(res).toEqual(expectedConfig)
    })
    test('expect no change to config with non-intersecting args', () => {
      const expectedConfig = Object.assign({}, testConfig)
      expectedConfig.friend1 = 'Bob Skinner'
      expectedConfig.friend2 = 'Charlie Rose'
      const res = d.overrideSettingsWithStringArgs(testConfig, 'friend1=Bob Skinner;friend2=Charlie Rose')
      expect(res).toEqual(expectedConfig)
    })
    test('expect change to config on intersecting string args', () => {
      const expectedConfig = Object.assign({}, testConfig)
      expectedConfig.stringA = 'Bob Skinner'
      expectedConfig.stringB = 'Charlie Rose'
      const res = d.overrideSettingsWithStringArgs(testConfig, 'stringA=Bob Skinner;stringB=Charlie Rose')
      expect(res).toEqual(expectedConfig)
    })
    test('expect change to config on intersecting numeric args', () => {
      const expectedConfig = Object.assign({}, testConfig)
      expectedConfig.numInt = 8
      expectedConfig.numNegInt = -12
      expectedConfig.numFloat = 23.2
      const res = d.overrideSettingsWithStringArgs(testConfig, 'numInt=8;numNegInt=-12;numFloat=23.2')
      expect(res).toEqual(expectedConfig)
    })
    test('expect change to config on intersecting boolean args', () => {
      const expectedConfig = Object.assign({}, testConfig)
      expectedConfig.boolA = false
      expectedConfig.boolB = true
      const res = d.overrideSettingsWithStringArgs(testConfig, 'boolA=false;boolB=true')
      expect(res).toEqual(expectedConfig)
    })
    test('expect change to config on intersecting string list args', () => {
      const expectedConfig = Object.assign({}, testConfig)
      expectedConfig.stringArr = ['this is a', 'different', 'array of', 'strings']
      const res = d.overrideSettingsWithStringArgs(testConfig, 'stringArr=this is a,different,array of,strings')
      expect(res).toEqual(expectedConfig)
    })
  })

  /**
   * Test overrideSettingsWithTypedArgs() using JSON inputs
   */
  describe('overrideSettingsWithTypedArgs', () => {
    const testConfig = {
      stringA: 'a string',
      stringB: 'another string',
      numInt: 42,
      numNegInt: -23,
      numFloat: -42.3,
      numNaN: NaN,
      boolA: true,
      boolB: false,
      undef: undefined,
      stringArr: ['this', 'is a', 'simple array of words'],
    }

    test('expect no change to config with empty args', () => {
      const expectedConfig = Object.assign({}, testConfig)
      const res = d.overrideSettingsWithTypedArgs(testConfig, '')
      expect(res).toEqual(expectedConfig)
    })
    test('expect no change to config with empty JSON args', () => {
      const expectedConfig = Object.assign({}, testConfig)
      const res = d.overrideSettingsWithTypedArgs(testConfig, '{}')
      expect(res).toEqual(expectedConfig)
    })
    test('expect no change to config with non-intersecting args', () => {
      const expectedConfig = Object.assign({}, testConfig)
      expectedConfig.friend1 = 'Bob Skinner'
      expectedConfig.friend2 = 'Charlie Rose'
      // const res = d.overrideSettingsWithStringArgs(testConfig, 'friend1=Bob Skinner,friend2=Charlie Rose')
      const res = d.overrideSettingsWithTypedArgs(testConfig, '{"friend1":"Bob Skinner","friend2":"Charlie Rose"}')
      expect(res).toEqual(expectedConfig)
    })
    test('expect change to config on intersecting string args', () => {
      const expectedConfig = Object.assign({}, testConfig)
      expectedConfig.stringA = 'Bob Skinner'
      expectedConfig.stringB = 'Charlie Rose'
      // const res = d.overrideSettingsWithStringArgs(testConfig, 'stringA=Bob Skinner,stringB=Charlie Rose')
      const res = d.overrideSettingsWithTypedArgs(testConfig, '{"stringA":"Bob Skinner","stringB":"Charlie Rose"}')
      expect(res).toEqual(expectedConfig)
    })
    test('expect change to config on intersecting numeric args', () => {
      const expectedConfig = Object.assign({}, testConfig)
      expectedConfig.numInt = 8
      expectedConfig.numNegInt = -12
      expectedConfig.numFloat = 23.2
      // const res = d.overrideSettingsWithStringArgs(testConfig, 'numInt=8,numNegInt=-12,numFloat=23.2')
      const res = d.overrideSettingsWithTypedArgs(testConfig, '{"numInt":8,"numNegInt":-12,"numFloat":23.2}')
      expect(res).toEqual(expectedConfig)
      expect(typeof res.numInt).toEqual('number')
      expect(typeof res.numFloat).toEqual('number')
    })
    test('expect change to config on intersecting boolean args', () => {
      const expectedConfig = Object.assign({}, testConfig)
      expectedConfig.boolA = false
      expectedConfig.boolB = true
      // const res = d.overrideSettingsWithStringArgs(testConfig, 'boolA=false,boolB=true')
      const res = d.overrideSettingsWithTypedArgs(testConfig, '{"boolA":false,"boolB":true}')
      expect(res).toEqual(expectedConfig)
      expect(typeof res.boolA).toEqual('boolean')
    })
    test('expect change to config on intersecting array of string arg', () => {
      const expectedConfig = Object.assign({}, testConfig)
      expectedConfig.stringArr = ['this is a', 'different', 'array, of', 'strings']
      // const res = d.overrideSettingsWithStringArgs(testConfig, "stringArr=['this is a','different','array, of','strings']")
      const res = d.overrideSettingsWithTypedArgs(testConfig, '{"stringArr":["this is a","different","array, of","strings"]}')
      expect(res).toEqual(expectedConfig)
    })
    test('expect change to config on intersecting array of URL encoded string arg ', () => {
      const expectedConfig = Object.assign({}, testConfig)
      expectedConfig.stringArr = ['this is a', 'different', 'array, of', 'strings']
      const URLEncodedArgs = '%7B%22stringArr%22%3A%5B%22this%20is%20a%22%2C%22different%22%2C%22array%2C%20of%22%2C%22strings%22%5D%7D'
      const res = d.overrideSettingsWithEncodedTypedArgs(testConfig, URLEncodedArgs)
      expect(res).toEqual(expectedConfig)
    })
  })

  describe('deepCopy', () => {
    // Test copying primitive values
    it('should return the same value for primitive types', () => {
      expect(deepCopy(123)).toBe(123)
      expect(deepCopy('string')).toBe('string')
      expect(deepCopy(true)).toBe(true)
      expect(deepCopy(null)).toBeNull()
      expect(deepCopy(undefined)).toBeUndefined()
    })

    // Test copying Date objects
    it('should create a new Date object with the same value', () => {
      const date = new Date()
      const copiedDate = deepCopy(date)
      expect(copiedDate).toEqual(date)
      expect(copiedDate).not.toBe(date)
    })

    // Test copying arrays
    it('should create a deep copy of arrays', () => {
      const arr = [1, ['nested', 'array'], { key: 'value' }]
      const copiedArr = deepCopy(arr)
      expect(copiedArr).toEqual(arr)
      expect(copiedArr).not.toBe(arr)
      expect(copiedArr[1]).not.toBe(arr[1])
      expect(copiedArr[2]).not.toBe(arr[2])
    })

    // Test copying objects
    it('should create a deep copy of objects', () => {
      const obj = { number: 123, nested: { array: [1, 2, 3] } }
      const copiedObj = deepCopy(obj)
      expect(copiedObj).toEqual(obj)
      expect(copiedObj).not.toBe(obj)
      expect(copiedObj.nested).not.toBe(obj.nested)
      expect(copiedObj.nested.array).not.toBe(obj.nested.array)
    })

    // Test the propsToInclude functionality
    it('should only include specified properties if propsToInclude is provided', () => {
      const obj = { include: 'yes', exclude: 'no' }
      const copiedObj = deepCopy(obj, ['include'])
      expect(copiedObj).toEqual({ include: 'yes' })
      expect(copiedObj.exclude).toBeUndefined()
    })

    it('should include array indices in the keys when showIndices is true', () => {
      const arr = ['first', 'second']
      const copiedArr = deepCopy(arr, null, true) // Assuming deepCopy signature accommodates showIndices

      // Check that the copied object includes keys formatted as indices
      expect(Object.keys(copiedArr)).toEqual(['[0]', '[1]'])
      expect(copiedArr['[0]']).toEqual(arr[0])
      expect(copiedArr['[1]']).toEqual(arr[1])

      // Stringify to verify the format matches the expected output
      const expectedStringified = '{"[0]":"first","[1]":"second"}'
      expect(JSON.stringify(copiedArr)).toBe(expectedStringified)
    })

    // Optionally, test that arrays are copied normally when showIndices is false or not provided
    it('should not include array indices in the keys when showIndices is false', () => {
      const arr = ['first', 'second']
      const copiedArrWithoutIndices = deepCopy(arr) // Not passing showIndices, defaults to false
      const copiedArrWithIndicesFalse = deepCopy(arr, null, false) // Explicitly passing false

      // Check that the copied array is a normal array without index-based keys
      expect(Array.isArray(copiedArrWithoutIndices)).toBe(true)
      expect(copiedArrWithoutIndices).toEqual(arr)

      // Check the same for the explicitly false parameter
      expect(Array.isArray(copiedArrWithIndicesFalse)).toBe(true)
      expect(copiedArrWithIndicesFalse).toEqual(arr)
    })
  })
  describe('clof function', () => {
    let consoleSpy

    beforeEach(() => {
      // Spy on console.log before each test
      consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
      DataStore.settings['_logLevel'] = 'DEBUG'
    })

    afterEach(() => {
      // Restore console.log to its original state after each test
      consoleSpy.mockRestore()
      DataStore.settings['_logLevel'] = 'none'
    })

    it('should correctly log an object in compact mode with specified fields', () => {
      const obj = { name: 'John', age: 30, city: 'New York' }
      clof(obj, 'User Info', ['name', 'age'], true)
      // Expect the console.log to have been called with a string that includes the preamble and the specified fields in compact format
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('User Info:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"name":"John"'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"age":30'))
    })

    it('should log an object in non-compact mode with specified fields', () => {
      const obj = { name: 'John', age: 30 }
      clof(obj, 'User Details', ['name'], false)
      // In non-compact mode, expect a more verbose output, including new lines and indentation
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('User Details:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"name": "John"'))
    })

    it('should handle an array of objects, logging each with specified fields', () => {
      const arr = [{ name: 'John' }, { name: 'Doe' }]
      clof(arr, 'Names', ['name'], true)
      // Expect the console.log to be called for each object in the array
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Names: [0]:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"name":"John"'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Names: [1]:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"name":"Doe"'))
    })

    it('should respect the compactMode flag for arrays, providing appropriate formatting', () => {
      const arr = [{ name: 'John' }, { name: 'Doe' }]
      clof(arr, 'Names', ['name'], false)
      // In non-compact mode, expect more verbose output for each array element
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Names: [0]:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('{\n  "name": "John"\n}'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Names: [1]:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('{\n  "name": "Doe"\n}'))
    })

    it('should correctly handle an empty preamble, logging only the specified fields', () => {
      const obj = { name: 'John' }
      clof(obj, '', ['name'], true)
      // Even without a preamble, the specified fields should be logged in the expected format
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('{"name":"John"}'))
    })

    it('should handle cases where fields parameter is not provided, logging the entire object', () => {
      const obj = { name: 'John', age: 30 }
      clof(obj)
      // Adjust the expectation to match the output format of logDebug, focusing on the object content
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"name": "John"'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"age": 30'))
      // This test now checks for the presence of key object details in the log output, ignoring dynamic parts like the timestamp
    })

    it('should handle cases where fields parameter is not provided, logging the entire arrau', () => {
      const obj = [{ name: 'John', age: 30 }]
      clof(obj)
      // Adjust the expectation to match the output format of logDebug, focusing on the object content
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"name": "John"'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"age": 30'))
      // This test now checks for the presence of key object details in the log output, ignoring dynamic parts like the timestamp
    })
  })
})
