// @flow
// Last updated 2024-07-05 for v2.0.1 by @jgclark

import { allSectionDetails } from "../../../constants.js"
import type { TDropdownItem, TSharedSettings } from "../../../types.js"
import { dashboardFilters } from "../../../dashboardSettings.js"
import { getTagSectionDetails } from "../Section/sectionHelpers.js"
import { clo } from '@helpers/react/reactDev.js'

/**
 * Create two arrays of TDropdownItems to use in Dropdown menu, using details in constants allSectionDetails, dashboardFilters.
 * The first array is for section toggling, the second array is for all the other toggles for the filter menu.
 * @param {TSharedSettings} sharedSettings 
 * @param {TAnyObject} pluginSettings 
 * @returns {[Array<TDropdownItem>, Array<TDropdownItem>]}
 */
export const createFilterDropdownItems = (
  sharedSettings: TSharedSettings,
  pluginSettings: TAnyObject
): [Array<TDropdownItem>, Array<TDropdownItem>] => {
  const sectionsWithoutTags = allSectionDetails.filter(s => s.sectionCode !== 'TAG')
  const tagSections = getTagSectionDetails(sharedSettings, pluginSettings)
  const sectionsWithTags = [...sectionsWithoutTags, ...tagSections]
  const dropdownSectionItems = sectionsWithTags.filter(s => s.showSettingName !== '').map((s) => ({
    label: `Show ${s.sectionName}`,
    description: '',
    key: s.showSettingName,
    type: 'switch',
    checked: (typeof sharedSettings !== undefined && sharedSettings[s.showSettingName]) ?? pluginSettings[s.showSettingName] ?? true,
  }))

  const nonSectionItems = dashboardFilters.map(s => ({
    label: s.label,
    description: s.description,
    key: s.key,
    type: 'switch',
    checked: Boolean((typeof sharedSettings !== undefined && sharedSettings[s.key]) ?? pluginSettings[s.key] ?? s.default),
  }))

  // $FlowFixMe[incompatible-return]
  return [dropdownSectionItems, nonSectionItems]
}
