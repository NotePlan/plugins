// create Jest tests for file dev.js

/* globals describe, expect, test, jest */
import * as d from '../dev'

// const _ = require('lodash')

// Jest suite
describe('helpers/dev', () => {
  describe('getAllPropertyNames', () => {
    test('getAllPropertyNames', () => {
      expect(d.getAllPropertyNames({ foo: '', bar: 1 }).indexOf('foo')).toBeGreaterThan(-1)
      expect(d.getAllPropertyNames({ foo: '', bar: 1 }).indexOf('bar')).toBeGreaterThan(-1)
      // expect(d.getAllPropertyNames({ __foo__: '', bar: 1 }).indexOf('__foo__')).toEqual(-1)
    })
    test('getAllPropertyNames', () => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => {})
      d.logAllPropertyNames({ foo: '', bar: 1 })
      expect(log).toHaveBeenCalled()
      log.mockRestore()
    })
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
      console.log(log)
      expect(log).toEqual(expect.stringContaining(`[0]`))
      expect(log).toEqual(expect.stringContaining(`subitems`))
    })
    test('should work with arrays in the middle also', () => {
      const arr = { someArray: [{ subitems: [{ content: 'foo' }] }] }
      const log = d.JSP(arr)
      console.log(log)
      expect(log).toMatch(/someArray/m)
      expect(log).toMatch(/subitems/m)
      expect(log).toMatch(/content/m)
      expect(log).toMatch(/foo/m)
    })
  })
})
