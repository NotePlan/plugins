/* global describe, expect, test, beforeAll */

// WHY IS THIS REFUSING TO DO ANYTHING ??

import colors from 'chalk'
import * as t from '../NPThemeToCSS'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging
})

// import { clo, logDebug, logError, logWarn } from '@helpers/dev'

// To test generateCSSFromTheme() run at the moment,
// run '/test:generateCSSFromTheme' command
// TODO: write test for a standard one using generateCSSFromTheme()

const FILE = `${colors.yellow('helpers/NPSyncedCopies')}`

describe(`${FILE}`, () => {
  describe('textDecorationFromNP()', () => {
    test('should return empty from unsupported selector', () => {
      const res = t.textDecorationFromNP('unsupported', 'ignore')
      expect(res).toEqual('')
    })
    test('should return empty from unsupported value', () => {
      const res = t.textDecorationFromNP('underlineStyle', 'bob')
      expect(res).toEqual('')
    })
    test('should return OK with valid params', () => {
      const res = t.textDecorationFromNP('underlineStyle', 1)
      expect(res).toEqual('text-decoration: underline')
    })
    test('should return OK with valid params', () => {
      const res = t.textDecorationFromNP('underlineStyle', 9)
      expect(res).toEqual('text-decoration: underline double')
    })
    test('should return OK with valid params', () => {
      const res = t.textDecorationFromNP('underlineStyle', 513)
      expect(res).toEqual('text-decoration: underline dashed')
    })
    test('should return OK with valid params', () => {
      const res = t.textDecorationFromNP('strikethroughStyle', 1)
      expect(res).toEqual('text-decoration: line-through')
    })
    test('should return OK with valid params', () => {
      const res = t.textDecorationFromNP('strikethroughStyle', 9)
      expect(res).toEqual('text-decoration: line-through double')
    })
    test('should return OK with valid params', () => {
      const res = t.textDecorationFromNP('strikethroughStyle', 513)
      expect(res).toEqual('text-decoration: line-through dashed')
    })
  })

  describe('fontPropertiesFromNP()', () => {
    const defaultAnswer = [`font-family: "sans"`, `font-weight: "regular"`, `font-style: "normal"`]
    test('should return defaults from empty selector', () => {
      const res = t.fontPropertiesFromNP('')
      expect(res).toEqual(defaultAnswer)
      expect(res).toEqual(['font-family: "sans"', 'font-weight: "regular"', 'font-style: "normal"'])
    })
    test('should return defaults from random font name', () => {
      const res = t.fontPropertiesFromNP('Zebra')
      expect(res).toEqual(['font-family: "Zebra"', 'font-weight: "400"', 'font-style: "normal"'])
    })
    test("input 'AvenirNext'", () => {
      const res = t.fontPropertiesFromNP('AvenirNext')
      expect(res).toEqual(['font-family: "Avenir Next"', 'font-weight: "400"', 'font-style: "normal"'])
    })
    test("input 'AvenirNext-Italic'", () => {
      const res = t.fontPropertiesFromNP('AvenirNext-Italic')
      expect(res).toEqual(['font-family: "Avenir Next"', 'font-weight: "400"', 'font-style: "italic"'])
    })
    test("input 'HelveticaNeue'", () => {
      const res = t.fontPropertiesFromNP('HelveticaNeue')
      expect(res).toEqual(['font-family: "Helvetica Neue"', 'font-weight: "400"', 'font-style: "normal"'])
    })
    test("input 'HelveticaNeue-Bold'", () => {
      const res = t.fontPropertiesFromNP('HelveticaNeue-Bold')
      expect(res).toEqual(['font-family: "Helvetica Neue"', 'font-weight: "700"', 'font-style: "normal"'])
    })
    test("input 'Candara'", () => {
      const res = t.fontPropertiesFromNP('Candara')
      expect(res).toEqual(['font-family: "Candara"', 'font-weight: "400"', 'font-style: "normal"'])
    })
    test("input 'Charter-Book'", () => {
      const res = t.fontPropertiesFromNP('Charter-Book')
      expect(res).toEqual(['font-family: "Charter"', 'font-weight: "500"', 'font-style: "normal"'])
    })
  })
})
