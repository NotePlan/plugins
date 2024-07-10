// @flow
// Last updated 2024-07-10 for v2.0.1 by @jgclark

import { allSectionDetails } from "../../../constants.js"
import type { TDashboardConfig, TDropdownItem } from "../../../types.js"
import { dashboardFilterDefs } from "../../../dashboardSettings.js"
import { getTagSectionDetails } from "../Section/sectionHelpers.js"
import { clo } from '@helpers/react/reactDev.js'

/**
 * Create two arrays of TDropdownItems to use in Dropdown menu, using details in constants allSectionDetails, dashboardFilters.
 * The first array is for section toggling, the second array is for all the other toggles for the filter menu.
 * @param {TDashboardConfig} dashboardSettings 
 * @returns {[Array<TDropdownItem>, Array<TDropdownItem>]}
 */
export const createFilterDropdownItems = (
  dashboardSettings: TDashboardConfig,
): [Array<TDropdownItem>, Array<TDropdownItem>] => {
  const sectionsWithoutTags = allSectionDetails.filter(s => s.sectionCode !== 'TAG')
  const tagSections = getTagSectionDetails(dashboardSettings)
  const allSections = [...sectionsWithoutTags, ...tagSections]
  const sectionDropbownItems: Array<TDropdownItem> = allSections.filter(s => s.showSettingName !== '').map((s) => ({
    label: `Show ${s.sectionName}`,
    description: `Show or hide items in section ${s.sectionName}`,
    key: s.showSettingName,
    type: 'switch',
    checked: (typeof dashboardSettings !== undefined && dashboardSettings[s.showSettingName]) ?? true,
  }))

  const nonSectionDropbownItems: Array<TDropdownItem> = dashboardFilterDefs.map(s => ({
    label: s.label,
    description: s.description,
    key: s.key,
    type: 'switch',
    checked: Boolean((typeof dashboardSettings !== undefined && dashboardSettings[s.key]) ?? s.default),
  }))

  return [sectionDropbownItems, nonSectionDropbownItems]
}
