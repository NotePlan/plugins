// @flow
//--------------------------------------------------------------------------
// Tests for settingsHelpers getValueFromSettingItem (false must not become '')
//--------------------------------------------------------------------------

import { getValueFromSettingItem } from '../settingsHelpers'

describe('getValueFromSettingItem', () => {
  test('preserves false for switch checked state', () => {
    expect(getValueFromSettingItem({ type: 'switch', key: 'hideTimedRemindersUntilDue', checked: false })).toBe(false)
  })

  test('preserves true for switch checked state', () => {
    expect(getValueFromSettingItem({ type: 'switch', key: 'enableInteractiveProcessingTransitions', checked: true })).toBe(true)
  })

  test('prefers value over checked when value is set', () => {
    expect(getValueFromSettingItem({ type: 'input', key: 'x', value: 'hello', checked: true })).toBe('hello')
  })

  test('preserves numeric 0', () => {
    expect(getValueFromSettingItem({ type: 'number', key: 'n', value: 0 })).toBe(0)
  })

  test('returns empty string when neither value nor checked is set', () => {
    expect(getValueFromSettingItem({ type: 'heading', key: 'h' })).toBe('')
  })
})
