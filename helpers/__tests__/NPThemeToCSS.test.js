/* global describe, expect, test */
// import colors from 'chalk'
import * as n from '../NPThemeToCSS'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'


// To test generateCSSFromTheme() run at the moment,
// run '/test:generateCSSFromTheme' command
// TODO: write test for a standard one using generateCSSFromTheme()

describe(`NPThemeToCSS`, () => {
  describe('textDecorationFromNP()', () => {
    test('should return empty from unsupported selector', () => {
      const res = n.textDecorationFromNP('unsupported', 'ignore')
      expect(res).toEqual("")
    })
    test('should return empty from unsupported value', () => {
      const res = n.textDecorationFromNP('underline', 'bob')
      expect(res).toEqual("")
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('underline', '1')
      expect(res).toEqual("text-decoration: underline")
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('underline', '9')
      expect(res).toEqual("text-decoration: underline double")
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('underline', '513')
      expect(res).toEqual("text-decoration: underline dashed")
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('strikethrough', '1')
      expect(res).toEqual("text-decoration: line-through")
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('strikethrough', '9')
      expect(res).toEqual("text-decoration: line-through double")
    })
    test('should return OK with valid params', () => {
      const res = n.textDecorationFromNP('strikethrough', '513')
      expect(res).toEqual("text-decoration: line-through dashed")
    })
  })
})
