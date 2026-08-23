// @flow
//-----------------------------------------------------------------------------
// Helpers for Settings system.
// Last updated 2026-08-21 for v2.4.2, @jgclark + @CursorAI
//-----------------------------------------------------------------------------
import { createDashboardSettingsItems } from '../../dashboardSettings'
import { createFilterDropdownItems } from '../components/Header/filterDropdownItems.js'
import type { TSettingItem } from '../../types'

/**
 * Read the current value from a setting item without coercing false/0 to empty string.
 * Prefer `value` (inputs/numbers etc.), then `checked` (switches). Missing both -> ''.
 * Inexact object: accepts full TSettingItem (and test fixtures) while allowing non-string `value`.
 * @param {{ value?: any, checked?: boolean, ... }} item
 * @returns {any}
 */
export function getValueFromSettingItem(item: { value?: any, checked?: boolean, ... }): any {
  if (item.value !== undefined) return item.value
  if (item.checked !== undefined) return item.checked
  return ''
}

/**
 * Reduces an array of dashboard settings or filter items into an object with keys and values
 * Sets to the value of the item or the checked value if it is a boolean field or an empty string if none of the above
 * @param {Array<TSettingItem>} items - The array of dashboard settings items.
 * @returns {Object} - The resulting object with settings including defaults.
 */
function getSettingsObjectFromArray(items: Array<TSettingItem>): { [key: string]: any } {
  return items.reduce((acc: { [key: string]: any }, item) => {
    if (item.key) {
      acc[item.key] = getValueFromSettingItem(item)
    }
    return acc
  }, {})
}

// Empty on purpose: these two builders are called only to harvest each item's `default`, so no
// actual settings values are needed. Cast because a bare `{}` is otherwise checked against every
// required TDashboardSettings property, one error each.
const dSettings: any = {}
const dSettingsItems = createDashboardSettingsItems(dSettings)
const settingsDefaults: any = getSettingsObjectFromArray(dSettingsItems)
const [sectionToggles, _otherToggles] = createFilterDropdownItems(dSettings)
const filterSettingsDefaults: any = getSettingsObjectFromArray(sectionToggles)
const otherSettingsDefaults: any = getSettingsObjectFromArray(_otherToggles)

export const dashboardSettingsDefaults = {
  ...settingsDefaults,
  ...filterSettingsDefaults,
  ...otherSettingsDefaults,
  lastChange: `dashboardSettingsDefaults`,
}
