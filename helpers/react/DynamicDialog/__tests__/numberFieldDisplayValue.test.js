// @flow
/* globals describe, expect, test */

import { numberFieldDisplayValue } from '../numberFieldDisplayValue.js'

describe('numberFieldDisplayValue', () => {
  test('keeps 0 visible', () => {
    expect(numberFieldDisplayValue(0)).toBe('0')
    expect(numberFieldDisplayValue('0')).toBe('0')
  })

  test('renders other numbers', () => {
    expect(numberFieldDisplayValue(7)).toBe('7')
    expect(numberFieldDisplayValue(31)).toBe('31')
  })

  test('uses a blank string when the value is missing', () => {
    expect(numberFieldDisplayValue(null)).toBe('')
    expect(numberFieldDisplayValue(undefined)).toBe('')
    expect(numberFieldDisplayValue('')).toBe('')
  })
})
