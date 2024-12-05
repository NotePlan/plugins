// @flow
// Last updated 2024-10-11 for v2.1.0.a13 by @jgclark

import { allSectionDetails } from "../../../constants.js"
import type { TDashboardSettings } from "../../../types.js"
import type { TSettingItem } from "../../../../../np.Shared/src/react/DynamicDialog/DynamicDialog.jsx"
import { dashboardFilterDefs } from "../../../dashboardSettings.js"
import { getTagSectionDetails } from "../Section/sectionHelpers.js"
import { clo } from '@np/helpers/react/reactDev.js'

/**
 * Create two arrays of TSettingItems to use in Dropdown menu, using details in constants allSectionDetails, dashboardFilters.
 * The first array is for section toggling, the second array is for all the other toggles for the filter menu.
 * @param {TDashboardSettings} dashboardSettings 
 * @returns {[Array<TSettingItem>, Array<TSettingItem>]}
 */
export const createFilterDropdownItems = (
  dashboardSettings: TDashboardSettings,
): [Array<TSettingItem>, Array<TSettingItem>] => {
  const sectionsWithoutTags = allSectionDetails.filter(s => s.sectionCode !== 'TAG')
  const tagSections = getTagSectionDetails(dashboardSettings)
  const allSections = [...sectionsWithoutTags, ...tagSections]
  const sectionDropbownItems: Array<TSettingItem> = allSections.filter(s => s.showSettingName !== '').map((s) => ({
    label: `Show ${s.sectionName}`,
    description: `Show or hide items in section ${s.sectionName}`,
    key: s.showSettingName,
    type: 'switch',
    checked: (typeof dashboardSettings !== undefined && dashboardSettings[s.showSettingName]) ?? true,
  }))

  const nonSectionDropbownItems: Array<TSettingItem> = dashboardFilterDefs.map(s => ({
    label: s.label,
    description: s.description,
    key: s.key,
    type: 'switch',
    checked: Boolean((typeof dashboardSettings !== undefined && dashboardSettings[s.key]) ?? s.default),
  }))

  return [sectionDropbownItems, nonSectionDropbownItems]
}
