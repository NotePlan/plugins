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
  })
  describe(section('createCallbackUrl()'), () => {
    test('should create a link with a heading', () => {
      expect(g.createCallbackUrl('foo', 'bar')).toEqual('noteplan://x-callback-url/openNote?noteTitle=foo#bar')
    })
    test('should create a link if heading is missing', () => {
      expect(g.createCallbackUrl('foo')).toEqual('noteplan://x-callback-url/openNote?noteTitle=foo')
    })
    test('should create a link with heading passed as null', () => {
      expect(g.createCallbackUrl('foo', null)).toEqual('noteplan://x-callback-url/openNote?noteTitle=foo')
    })
  })
  describe(section('createPrettyLink()'), () => {
    const xcb = `noteplan://x-callback-url/openNote?noteTitle=`
    test('should create a link with a heading', () => {
      expect(g.createPrettyLink('baz', 'foo', 'bar')).toEqual(`[baz](${xcb}foo#bar)`)
    })
    test('should create a link if heading is missing', () => {
      expect(g.createPrettyLink('baz', 'foo')).toEqual(`[baz](${xcb}foo)`)
    })
    test('should create a link with heading passed as null', () => {
      expect(g.createPrettyLink('baz', 'foo', null)).toEqual(`[baz](${xcb}foo)`)
    })
  })
})
