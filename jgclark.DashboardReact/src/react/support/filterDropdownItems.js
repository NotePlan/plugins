// @flow
import { allSectionDetails, nonSectionSwitches } from "../../constants.js"
import type { TDropdownItem, TSharedSettings } from "../../types.js"
import { getTagSectionDetails } from "./sectionHelpers.js"

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

  const nonSectionItems = nonSectionSwitches.map(s => ({
    label: s.label,
    key: s.key,
    type: 'switch',
    checked: (typeof sharedSettings !== undefined && sharedSettings[s.key]) ?? pluginSettings[s.key] ?? s.default,
  }))

  return [...nonSectionItems, ...dropdownSectionNames]
}
