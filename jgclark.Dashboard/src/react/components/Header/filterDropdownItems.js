// @flow
// Last updated 2026-07-29 for v2.4.0.b56 by @jgclark + @CursorAI

import { allSectionDetails } from '../../../constants.js'
import type { TDashboardSettings } from '../../../types.js'
import { dashboardFilterDefs } from '../../../dashboardSettings.js'
import { getTagSectionDetails } from '../Section/sectionHelpers.js'
import { clo } from '@helpers/react/reactDev.js'
import type { TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog.jsx'

/**
 * Create two arrays of TSettingItems to use in Dropdown menu, using details in constants allSectionDetails, dashboardFilters.
 * The first array is for section toggling, the second array is for all the other toggles for the filter menu.
 * REM is special-cased into Show Current Reminders + Show Undated/Overdue Reminders.
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
    // Split legacy single "Show Reminders" into Current vs Undated/Overdue toggles
    if (s.sectionCode === 'REM') {
      sectionDropbownItems.push({
        label: 'Show Current Reminders',
        description: 'Show or hide reminders due today, yesterday, or tomorrow (including timed reminders in Timed Items)',
        key: 'showCurrentReminders',
        type: 'switch',
        checked: (typeof dashboardSettings !== undefined && dashboardSettings.showCurrentReminders) ?? true,
      })
      sectionDropbownItems.push({
        label: 'Show Undated/Overdue Reminders',
        description: 'Show or hide undated reminders in the Reminders section, and past-dated reminders in Overdue',
        key: 'showUndatedOverdueReminders',
        type: 'switch',
        checked: (typeof dashboardSettings !== undefined && dashboardSettings.showUndatedOverdueReminders) ?? true,
      })
      continue
    }
    sectionDropbownItems.push({
      label: `Show ${s.sectionName}`,
      description: `Show or hide items in section ${s.sectionName}`,
      key: s.showSettingName,
      type: 'switch',
      checked: (typeof dashboardSettings !== undefined && dashboardSettings[s.showSettingName]) ?? true,
    })
  }

  const nonSectionDropbownItems: Array<TSettingItem> = dashboardFilterDefs.map((s) => ({
    label: s.label,
    description: s.description,
    key: s.key,
    type: 'switch',
    checked: Boolean((typeof dashboardSettings !== undefined && dashboardSettings[s.key]) ?? s.default),
  }))

  return [sectionDropbownItems, nonSectionDropbownItems]
}
