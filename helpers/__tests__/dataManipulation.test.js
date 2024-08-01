/* globals describe, expect, test, toEqual */

import colors from 'chalk'
import * as d from '../dataManipulation'

const FILE = `${colors.yellow('helpers/dataManipulation')}`
// const section = colors.blue

describe(`${FILE}`, () => {
  describe('stringListOrArrayToArray()', () => {
    test('null input -> []', () => {
      expect(d.stringListOrArrayToArray(null, ',')).toEqual([])
    })
    test('empty string -> []', () => {
      expect(d.stringListOrArrayToArray('', ',')).toEqual([])
    })
    test('plain string -> [.]', () => {
      expect(d.stringListOrArrayToArray('single item', ',')).toEqual(['single item'])
    })
    test('simple list -> [...]', () => {
      expect(d.stringListOrArrayToArray('one,two,three', ',')).toEqual(['one', 'two', 'three'])
    })
    test('quote-delim list -> [...]', () => {
      expect(d.stringListOrArrayToArray("'one','two','three'", ',')).toEqual(["'one'", "'two'", "'three'"])
    })
    test('whitespace around separators should be removed', () => {
      expect(d.stringListOrArrayToArray('NotePlan, Home, Something Else , and more ', ',')).toEqual(["NotePlan", "Home", "Something Else", "and more"])
    })
  })
})
