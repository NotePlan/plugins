// @flow
import { createDashboardSettingsItems } from '../../dashboardSettings'
import { createFilterDropdownItems } from '../components/Header/filterDropdownItems.js'
import type { TSettingItem } from '../../types'

/**
 * Reduces an array of dashboard settings or filter items into an object with keys and values
 * Sets to the value of the item or the checked value if it is a boolean field or an empty string if none of the above
 * @param {Array<TSettingItem>} items - The array of dashboard settings items.
 * @returns {Object} - The resulting object with settings including defaults.
 */
function getSettingsObjectFromArray(items: Array<TSettingItem>): { [key: string]: any } {
  return items.reduce((acc: { [key: string]: any }, item) => {
    if (item.key) {
      acc[item.key] = item.value || item.checked || ''
    }
    return acc
  }, {})
}

const dSettings = {}
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
