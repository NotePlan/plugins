// @flow
//-----------------------------------------------------------------------------
// Default dashboard settings (no I/O or save-path dependencies).
// Extracted from dashboardHelpers.js to break circular imports with dashboardSettingsClean.
// Last updated 2026-06-13 for v2.4.0.b46 by @CursorAI
//-----------------------------------------------------------------------------

import { allSectionDetails } from './constants'
import { dashboardSettingDefs, dashboardFilterDefs } from './dashboardSettings'
import type { TDashboardSettings, TSettingItem } from './types'
import { clo, logError } from '@helpers/dev'

/**
 * Get the default values for all dashboard settings.
 * @returns {TDashboardSettings} The default values for all dashboard settings.
 */
export function getDashboardSettingsDefaults(): TDashboardSettings {
  const dashboardFilterDefaults = dashboardFilterDefs.filter((f) => f.key !== 'includedFolders')
  const nonFilterDefaults = dashboardSettingDefs.filter((f) => f.key)
  const dashboardSettingsDefaults: TAnyObject = [...dashboardFilterDefaults, ...nonFilterDefaults].reduce((acc: TAnyObject, curr: TSettingItem) => {
    // logDebug('doSwitchToPerspective', `doSwitchToPerspective: curr.key='${String(curr.key)}' curr.default='${String(curr.default)}'`)
    if (curr.key && curr.default !== undefined) {
      acc[curr.key] = curr.default
    } else {
      logError('doSwitchToPerspective', `doSwitchToPerspective: default value for ${String(curr.key)} is not set in dashboardSettings file defaults.`)
    }
    return acc
  }, {})

  // Add section show settings from allSectionDetails
  // Most sections default to true, except INFO which defaults to false,
  // and TAG sections are handled specially (one for each tag a user wants to see).
  const sectionDefaults = allSectionDetails.reduce((acc, section) => {
    if (section.showSettingName && section.showSettingName !== '') {
      // $FlowIgnore[prop-missing]
      acc[section.showSettingName] = section.sectionCode !== 'INFO'
    }
    return acc
  }, {})

  // Add showSearchSection (SEARCH section doesn't have showSettingName in allSectionDetails)
  // $FlowIgnore[prop-missing]
  sectionDefaults.showSearchSection = true

  // clo(dashboardSettingsDefaults, `dashboardSettingsDefaults:`)
  // $FlowIgnore[cannot-spread-indexer]
  return ({ ...dashboardSettingsDefaults, ...sectionDefaults }: any)
}

/**
 * Get the default values for the dashboard settings, with all sections set to false.
 * This is used on update or install to ensure that any new settings or Sections are added to the perspectives.
 * @param {TDashboardSettings} dashboardSettings - The dashboard settings to update.
 * @returns {TDashboardSettings} The default values for the dashboard settings, with all sections set to false.
 */
export function getDashboardSettingsDefaultsWithSectionsSetToFalse(): TDashboardSettings {
  const dashboardSettingsDefaults = getDashboardSettingsDefaults()
  const sectionList = allSectionDetails.map((s) => s.showSettingName).filter((s) => s !== '' && s !== undefined)
  const sectionsSetToFalse = sectionList.reduce((acc: TAnyObject, curr: string) => {
    acc[curr] = false
    return acc
  }, {})
  clo(sectionsSetToFalse, `sectionsSetToFalse:`)
  // $FlowIgnore[cannot-spread-indexer]
  return { ...dashboardSettingsDefaults, ...sectionsSetToFalse }
}
