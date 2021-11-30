// create Jest tests for file dev.js

/* globals describe, expect, it, test, jest */
import * as d from '../dev'

// const _ = require('lodash')

// Jest suite
describe('helpers/dev', () => {
  test('getAllPropertyNames', () => {
    expect(d.getAllPropertyNames({ foo: '', bar: 1 }).indexOf('foo')).toBeGreaterThan(-1)
    expect(d.getAllPropertyNames({ foo: '', bar: 1 }).indexOf('bar')).toBeGreaterThan(-1)
    expect(d.getAllPropertyNames({ __foo__: '', bar: 1 }).indexOf('__foo__')).toEqual(-1)
  })
  test('getAllPropertyNames', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    d.logAllPropertyNames({ foo: '', bar: 1 })
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
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
})
