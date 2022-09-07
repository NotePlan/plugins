/* global describe, expect, test, beforeAll */

// WHY IS THIS REFUSING TO DO ANYTHING ??

import colors from 'chalk'
import * as n from '../HTMLView'
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
      const res = n.textDecorationFromNP('unsupported', 'ignore')
      expect(res).toEqual('')
    })
    test('should return empty from unsupported value', () => {
      const res = n.textDecorationFromNP('underline', 'bob')
      expect(res).toEqual('')
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('underline', '1')
      expect(res).toEqual('text-decoration: underline')
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('underline', '9')
      expect(res).toEqual('text-decoration: underline double')
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('underline', '513')
      expect(res).toEqual('text-decoration: underline dashed')
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('strikethrough', '1')
      expect(res).toEqual('text-decoration: line-through')
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('strikethrough', '9')
      expect(res).toEqual('text-decoration: line-through double')
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('strikethrough', '513')
      expect(res).toEqual('text-decoration: line-through dashed')
    })
  })

  describe('fontPropertiesFromNP()', () => {
    const defaultAnswer = [`font-family: "sans"`, `font-weight: "regular"`, `font-style: "normal"`]
    test('should return defaults from empty selector', () => {
      const res = n.fontPropertiesFromNP('')
      expect(res).toEqual(defaultAnswer)
      expect(res).toEqual(['font-family: "sans"', 'font-weight: "regular"', 'font-style: "normal"'])
    })
    test('should return defaults from random font name', () => {
      const res = n.fontPropertiesFromNP('Zebra')
      expect(res).toEqual(['font-family: "Zebra"', 'font-weight: "400"', 'font-style: "normal"'])
    })
    test("input 'AvenirNext'", () => {
      const res = n.fontPropertiesFromNP('AvenirNext')
      expect(res).toEqual(['font-family: "Avenir Next"', 'font-weight: "400"', 'font-style: "normal"'])
    })
    test("input 'AvenirNext-Italic'", () => {
      const res = n.fontPropertiesFromNP('AvenirNext-Italic')
      expect(res).toEqual(['font-family: "Avenir Next"', 'font-weight: "400"', 'font-style: "italic"'])
    })
    test("input 'HelveticaNeue'", () => {
      const res = n.fontPropertiesFromNP('HelveticaNeue')
      expect(res).toEqual(['font-family: "Helvetica Neue"', 'font-weight: "400"', 'font-style: "normal"'])
    })
    test("input 'HelveticaNeue-Bold'", () => {
      const res = n.fontPropertiesFromNP('HelveticaNeue-Bold')
      expect(res).toEqual(['font-family: "Helvetica Neue"', 'font-weight: "700"', 'font-style: "normal"'])
    })
    test("input 'Candara'", () => {
      const res = n.fontPropertiesFromNP('Candara')
      expect(res).toEqual(['font-family: "Candara"', 'font-weight: "400"', 'font-style: "normal"'])
    })
    test("input 'Charter-Book'", () => {
      const res = n.fontPropertiesFromNP('Charter-Book')
      expect(res).toEqual(['font-family: "Charter"', 'font-weight: "500"', 'font-style: "normal"'])
    })
  })
})
