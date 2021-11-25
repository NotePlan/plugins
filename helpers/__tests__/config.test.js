/* globals describe, expect, it, test, jest */

import colors from 'chalk'
import * as c from '../config'

const FILE = `${colors.yellow('helpers/config')}`
const section = colors.blue

describe(`${FILE}`, () => {
  describe(section('validateConfigProperties'), () => {
    // create the return errors to match against
    const createConfigError = (errType, configPropValue, validType) => {
      switch (errType) {
        case 'missing':
          return `validateConfigProperties: Config required field: "${configPropValue}" is missing;`
        case 'regex':
          return `validateConfigProperties: Config field: "${configPropValue}" failed RegEx test "${String(
            validType,
          )}";`
        case 'type':
          return `validateConfigProperties: Config required field: "${configPropValue}" is not of type "${String(
            validType,
          )}";`
        case 'noValidations':
          return 'validateConfigProperties: No validations provided'
      }
    }
    describe('validation should work ', () => {
      test('for string ', () => {
        expect(c.validateConfigProperties({ test: 'foo' }, { test: 'string' })).toEqual({ test: 'foo' })
      })
      test('for string with optional: true and exists', () => {
        expect(c.validateConfigProperties({ test: 'foo' }, { test: { type: 'string', optional: true } })).toEqual({
          test: 'foo',
        })
      })
      test('for string with optional: true and does not exist', () => {
        expect(c.validateConfigProperties({ bar: 'foo' }, { test: { type: 'string', optional: true } })).toEqual({
          bar: 'foo',
        })
      })
      test('for regex ', () => {
        expect(c.validateConfigProperties({ test: 'foo' }, { test: /oo/ })).toEqual({ test: 'foo' })
      })
      test('for boolean ', () => {
        expect(c.validateConfigProperties({ test: true }, { test: 'boolean' })).toEqual({ test: true })
      })
      test('for number ', () => {
        expect(c.validateConfigProperties({ test: 5 }, { test: 'number' })).toEqual({ test: 5 })
      })
      test('for array ', () => {
        expect(c.validateConfigProperties({ test: ['foo'] }, { test: 'array' })).toEqual({ test: ['foo'] })
      })
      test('for array ', () => {
        expect(c.validateConfigProperties({ test: { testing: true } }, { test: 'object' })).toEqual({
          test: { testing: true },
        })
      })
    })
    describe('validation errors should fail', () => {
      test('no validations sent ', () => {
        expect(c.validateConfigProperties({}, {})).toEqual({
          __error: createConfigError('noValidations', '', ''),
        })
      })
      test('for required field missing ', () => {
        expect(c.validateConfigProperties({}, { test: 'string' })).toEqual({
          __error: createConfigError('missing', 'test', 'string'),
        })
      })
      test('for required field missing marked as optional:false ', () => {
        expect(c.validateConfigProperties({}, { test: { type: 'string', optional: false } })).toEqual({
          __error: createConfigError('missing', 'test', 'string'),
        })
      })
      test('for number ', () => {
        expect(c.validateConfigProperties({ test: true }, { test: 'string' })).toEqual({
          __error: createConfigError('type', 'test', 'string'),
        })
      })
      test('for string ', () => {
        expect(c.validateConfigProperties({ test: true }, { test: 'string' })).toEqual({
          __error: createConfigError('type', 'test', 'string'),
        })
      })
      test('for object ', () => {
        expect(c.validateConfigProperties({ test: true }, { test: 'object' })).toEqual({
          __error: createConfigError('type', 'test', 'object'),
        })
      })
      test('for array ', () => {
        expect(c.validateConfigProperties({ test: true }, { test: 'array' })).toEqual({
          __error: createConfigError('type', 'test', 'array'),
        })
      })
      test('for regex failed on string', () => {
        expect(c.validateConfigProperties({ test: 'foo' }, { test: /test/ })).toEqual({
          __error: createConfigError('regex', 'test', /test/),
        })
      })
      test('for regex but config item wasnt string', () => {
        expect(c.validateConfigProperties({ test: true }, { test: /test/ })).toEqual({
          __error: createConfigError('regex', 'test', /test/),
        })
      })
      test('for boolean ', () => {
        expect(c.validateConfigProperties({ test: 'string' }, { test: 'boolean' })).toEqual({
          __error: createConfigError('type', 'test', 'boolean'),
        })
      })
    })
  })
})
