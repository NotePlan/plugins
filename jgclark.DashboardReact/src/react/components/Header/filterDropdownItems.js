// @flow
import { allSectionDetails } from "../../../constants.js"
import type { TDropdownItem, TSharedSettings } from "../../../types.js"
import { dashboardFilters} from "../../../dashboardSettings.js"
import { getTagSectionDetails } from "../Section/sectionHelpers.js"
/**
 * Create array of TDropdownItems to use in Dropdown menu, using details in constants allSectionDetails, dashboardFilters
 * @param {TSharedSettings} sharedSettings 
 * @param {TAnyObject} pluginSettings 
 * @returns {Array<TDropdownItem>}
 */
export const createFilterDropdownItems = (
  sharedSettings: TSharedSettings,
  pluginSettings: TAnyObject
): Array<TDropdownItem> => {
  const sectionsWithoutTag = allSectionDetails.filter(s => s.sectionCode !== 'TAG')
  const tagSections = getTagSectionDetails(sharedSettings, pluginSettings)
  const sectionsWithTags = [...sectionsWithoutTag, ...tagSections]
  const dropdownSectionNames = sectionsWithTags.filter(s => s.showSettingName !== '').map((s) => ({
    label: `Show ${s.sectionName}`,
    key: s.showSettingName,
    type: 'switch',
    checked: (typeof sharedSettings !== undefined && sharedSettings[s.showSettingName]) ?? pluginSettings[s.showSettingName] ?? true,
  }))

  const nonSectionItems = dashboardFilters.map(s => ({
    label: s.label,
    description: s.description,
    key: s.key,
    type: 'switch',
    checked: (typeof sharedSettings !== undefined && sharedSettings[s.key]) ?? pluginSettings[s.key] ?? s.default,
  }))

  return [...nonSectionItems, ...dropdownSectionNames]
}
