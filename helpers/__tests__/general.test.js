/* globals describe, expect, test, DataStore, afterAll */
import * as g from '../general'

import colors from 'chalk'
import * as c from '../config'

const FILE = `${colors.yellow('helpers/general')}`
const section = colors.blue

describe(`${FILE}`, () => {
  describe(section('createLink()'), () => {
    test('should create a link with a heading', () => {
      expect(g.createLink('foo', 'bar')).toEqual('[[foo#bar]]')
    })
    test('should create a link if heading is missing', () => {
      expect(g.createLink('foo')).toEqual('[[foo]]')
    })
    test('should create a link with heading passed as null', () => {
      expect(g.createLink('foo', null)).toEqual('[[foo]]')
    })
    test('should create a link with heading passed as empty string', () => {
      expect(g.createLink('foo', '')).toEqual('[[foo]]')
    })
  })
  describe(section('createCallbackUrl()'), () => {
    describe('using noteTitle', () => {
      test('should create a link with a heading', () => {
        expect(g.createCallbackUrl('foo', false, 'bar')).toEqual('noteplan://x-callback-url/openNote?noteTitle=foo#bar')
      })
      test('should create a link if heading is missing', () => {
        expect(g.createCallbackUrl('foo')).toEqual('noteplan://x-callback-url/openNote?noteTitle=foo')
      })
      test('should create a link with heading passed as null', () => {
        expect(g.createCallbackUrl('foo', false, null)).toEqual('noteplan://x-callback-url/openNote?noteTitle=foo')
      })
      test('should create a link with heading passed as empty string', () => {
        expect(g.createCallbackUrl('foo', false, '')).toEqual('noteplan://x-callback-url/openNote?noteTitle=foo')
      })
    })
    describe('using note filename', () => {
      test('should create a link with a heading', () => {
        expect(g.createCallbackUrl('foo', true, 'bar')).toEqual('noteplan://x-callback-url/openNote?filename=foo#bar')
      })
    })
  })
  describe(section('createPrettyLink()'), () => {
    describe('using noteTitle', () => {
      const xcb = `noteplan://x-callback-url/openNote?noteTitle=`
      test('should create a link with a heading', () => {
        expect(g.createPrettyLink('baz', 'foo', false, 'bar')).toEqual(`[baz](${xcb}foo#bar)`)
      })
      test('should create a link if heading is missing', () => {
        expect(g.createPrettyLink('baz', 'foo')).toEqual(`[baz](${xcb}foo)`)
      })
      test('should create a link with heading passed as null', () => {
        expect(g.createPrettyLink('baz', 'foo', false, null)).toEqual(`[baz](${xcb}foo)`)
      })
    })
    describe('using note filename', () => {
      test('should create a link with a heading', () => {
        expect(g.createPrettyLink('baz', 'foo', true, 'bar')).toEqual('[baz](noteplan://x-callback-url/openNote?filename=foo#bar)')
      })
    })
  })
})
