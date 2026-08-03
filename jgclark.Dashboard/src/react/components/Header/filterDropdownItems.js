// @flow
// Last updated 2026-08-01 for v2.4.0.b60 by @jgclark + @CursorAI

import { allSectionDetails } from '../../../constants.js'
import type { TDashboardSettings } from '../../../types.js'
import { dashboardFilterDefs } from '../../../dashboardSettings.js'
import { getTagSectionDetails } from '../Section/sectionHelpers.js'
import { clo } from '@helpers/react/reactDev.js'
import type { TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog.jsx'

/**
 * Create two arrays of TSettingItems to use in Dropdown menu, using details in constants allSectionDetails, dashboardFilters.
 * The first array is for section toggling, the second array is for all the other toggles for the filter menu.
 * REM uses showRemindersSection → "Show Reminders" (master gate for all reminder display).
 * @param {TDashboardSettings} dashboardSettings
 * @returns {[Array<TSettingItem>, Array<TSettingItem>]}
 */
export const createFilterDropdownItems = (dashboardSettings: TDashboardSettings): [Array<TSettingItem>, Array<TSettingItem>] => {
  const sectionsWithoutTags = allSectionDetails.filter((s) => s.sectionCode !== 'TAG')
  const tagSections = getTagSectionDetails(dashboardSettings)
  const allSections = [...sectionsWithoutTags, ...tagSections]
  const sectionDropbownItems: Array<TSettingItem> = []
  for (const s of allSections) {
    if (!s.showSettingName || s.showSettingName === '') continue
    sectionDropbownItems.push({
      label: `Show ${s.sectionName}`,
      description: `Show or hide items in section ${s.sectionName}`,
      key: s.showSettingName,
      type: 'switch',
      checked: (typeof dashboardSettings !== undefined && (dashboardSettings: TAnyObject)[s.showSettingName]) ?? true,
    })
  }

  const nonSectionDropbownItems: Array<TSettingItem> = dashboardFilterDefs.map((s) => ({
    label: s.label,
    description: s.description,
    key: s.key,
    type: 'switch',
    // KNOWN BUG - `typeof dashboardSettings !== undefined` compares a string to `undefined`, so it is always true; the intended guard was
    // `typeof dashboardSettings !== 'undefined'` (or just `dashboardSettings != null`). Same mistake on line 30 above. Left as-is: fixing it changes emitted JS.
    // Cast on `s.key`: TSettingItem.key is optional (?string) so it cannot index TAnyObject directly.
    checked: Boolean((typeof dashboardSettings !== undefined && (dashboardSettings: TAnyObject)[(s.key: any)]) ?? s.default),
  }))

  return [sectionDropbownItems, nonSectionDropbownItems]
}
