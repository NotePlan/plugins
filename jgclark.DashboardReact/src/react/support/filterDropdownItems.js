// @flow
import { allSectionDetails, nonSectionSwitches } from "../../constants.js"
import type {TDropdownItem,TSharedSettings} from "../../types.js"

export const createDropdownItems = (
  sharedSettings: TSharedSettings,
  tagSectionStr: string,
  pluginSettings: TAnyObject
): Array<TDropdownItem> => {
  const dropdownSectionNames = allSectionDetails.filter(s => s.showSettingName !== '').map((s) => ({
    label: `Show ${s.sectionCode !== 'TAG' ? s.sectionName : tagSectionStr}`,
    key: s.showSettingName,
    type: 'switch',
    checked: (typeof sharedSettings !== undefined && sharedSettings[s.showSettingName]) ??  pluginSettings[s.showSettingName] ?? true,
  }))

  const nonSectionItems = nonSectionSwitches.map(s => ({
    label: s.label,
    key: s.key,
    type: 'switch',
    checked: (typeof sharedSettings !== undefined && sharedSettings[s.key]) ??  pluginSettings[s.key] ?? s.default,
  }))

  return [...nonSectionItems, ...dropdownSectionNames]
}
