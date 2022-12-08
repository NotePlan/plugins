// create Jest tests for file dev.js

/* globals describe, expect, test, jest, beforeAll */
import * as d from '../dev'
import { logDebug } from '@helpers/dev'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan /*, Note, Paragraph */ } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging
})

const pluginJson = 'helpers/dev.test'

// const _ = require('lodash')

// Jest suite
describe('helpers/dev', () => {
  /*
   * deepDiff()
   */
  describe.skip('deepDiff()' /* function */, () => {
    test('should show no difference with empties', () => {
      const result = d.deepDiff({}, {})
      expect(result).toEqual({})
    })
    test('should show no difference with simple value', () => {
      const result = d.deepDiff({ a: 1 }, { a: 1 })
      expect(result).toEqual({})
    })
    test('should show differences when one has something the other doesnt', () => {
      const result = d.deepDiff({ a: 1 }, { a: 1, b: 1 })
      expect(result).toEqual({ b: { to: 1 } })
    })
    test('should show a deep different value', () => {
      const result = d.deepDiff({ a: 1 }, { a: { b: { c: 2 } } })
      expect(result).toEqual({ a: { from: 1, to: { b: { c: 2 } } } })
    })
  })

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
})
