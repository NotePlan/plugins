// @flow
// Last updated 2024-07-05 for v2.0.1 by @jgclark

import { allSectionDetails } from "../../../constants.js"
import { type TDashboardConfig } from "../../../dashboardHelpers.js"
import type { TDropdownItem, /* TDashboardSettings */ } from "../../../types.js"
import { dashboardFilters } from "../../../dashboardSettings.js"
import { getTagSectionDetails } from "../Section/sectionHelpers.js"
import { clo } from '@helpers/react/reactDev.js'

/**
 * Create two arrays of TDropdownItems to use in Dropdown menu, using details in constants allSectionDetails, dashboardFilters.
 * The first array is for section toggling, the second array is for all the other toggles for the filter menu.
 * @param {TDashboardSettings} dashboardSettings 
 * @param {TAnyObject} pluginSettings 
 * @returns {[Array<TDropdownItem>, Array<TDropdownItem>]}
 */
export const createFilterDropdownItems = (
  dashboardSettings: TDashboardConfig,
  pluginSettings: TAnyObject
): [Array<TDropdownItem>, Array<TDropdownItem>] => {
  const sectionsWithoutTags = allSectionDetails.filter(s => s.sectionCode !== 'TAG')
  const tagSections = getTagSectionDetails(dashboardSettings, pluginSettings)
  const sectionsWithTags = [...sectionsWithoutTags, ...tagSections]
  const dropdownSectionItems = sectionsWithTags.filter(s => s.showSettingName !== '').map((s) => ({
    label: `Show ${s.sectionName}`,
    description: '',
    key: s.showSettingName,
    type: 'switch',
    checked: (typeof dashboardSettings !== undefined && dashboardSettings[s.showSettingName]) ?? pluginSettings[s.showSettingName] ?? true,
  }))

  const nonSectionItems = dashboardFilters.map(s => ({
    label: s.label,
    description: s.description,
    key: s.key,
    type: 'switch',
    checked: Boolean((typeof dashboardSettings !== undefined && dashboardSettings[s.key]) ?? pluginSettings[s.key] ?? s.default),
  }))

  // $FlowFixMe[incompatible-return]
  return [dropdownSectionItems, nonSectionItems]
}
