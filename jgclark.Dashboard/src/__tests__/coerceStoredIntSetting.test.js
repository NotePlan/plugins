// @flow
/* globals describe, expect, test */

import { coerceStoredIntSetting, numberSettingDefault } from '../dashboardSettings'

describe('coerceStoredIntSetting', () => {
  test('keeps 0', () => {
    expect(coerceStoredIntSetting(0, 7)).toBe(0)
    expect(coerceStoredIntSetting('0', 7)).toBe(0)
  })

  test('parses numeric strings', () => {
    expect(coerceStoredIntSetting('14', 31)).toBe(14)
    expect(coerceStoredIntSetting(31, 7)).toBe(31)
  })

  test('uses the fallback when the value is missing or not a number', () => {
    expect(coerceStoredIntSetting(undefined, 31)).toBe(31)
    expect(coerceStoredIntSetting(null, 31)).toBe(31)
    expect(coerceStoredIntSetting('', 31)).toBe(31)
    expect(coerceStoredIntSetting('nope', 10)).toBe(10)
  })
})

describe('numberSettingDefault', () => {
  test('reads look-back default from the setting def (not the old hardcoded 7)', () => {
    expect(numberSettingDefault('lookBackDaysForOverdue', 7)).toBe(31)
  })

  test('reads other number defaults', () => {
    expect(numberSettingDefault('autoUpdateAfterIdleTime', 0)).toBe(10)
    expect(numberSettingDefault('newTaskSectionHeadingLevel', 0)).toBe(2)
    expect(numberSettingDefault('maxItemsToShowInSection', 0)).toBe(24)
  })
})
