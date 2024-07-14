// @flow
//-----------------------------------------------------------------------------
// Constants for Dashboard code
// Last updated 2024-07-13 for v2.0.1 by @jgclark
//-----------------------------------------------------------------------------
import pluginJson from '../plugin.json'
import type { TSectionDetails, TSectionCode } from "./types"

// NOTE: Dashboard Settings are in the src/dashboardSettingsItems.js file

// Note: Not yet used everwhere
export const WEBVIEW_WINDOW_ID = `${pluginJson['plugin.id']}.main` // will be used as the customId for your window

export const allSectionDetails: Array<TSectionDetails> = [
  { sectionCode: 'DT', sectionName: 'Today', showSettingName: '' }, // always show Today section
  { sectionCode: 'DY', sectionName: 'Yesterday', showSettingName: 'showYesterdaySection' },
  { sectionCode: 'DO', sectionName: 'Tomorrow', showSettingName: 'showTomorrowSection' },
  { sectionCode: 'W', sectionName: 'Week', showSettingName: 'showWeekSection' },
  { sectionCode: 'M', sectionName: 'Month', showSettingName: 'showMonthSection' },
  { sectionCode: 'Q', sectionName: 'Quarter', showSettingName: 'showQuarterSection' },
  // TAG types are treated specially (one for each tag a user wants to see). 
  // Use getTagSectionDetails() to get them
  { sectionCode: 'TAG', sectionName: '', showSettingName: `showTagSection` }, // sectionName set later to reflect the tagsToShow setting
  { sectionCode: 'PROJ', sectionName: 'Projects', showSettingName: 'showProjectSection' },
  // overdue last becasue it takes the longest to load
  { sectionCode: 'OVERDUE', sectionName: 'Overdue', showSettingName: 'showOverdueSection' },
]

export const sectionDisplayOrder = ['DT', 'DY', 'DO', 'W', 'M', 'Q', 'OVERDUE', 'TAG', 'PROJ']

export const allSectionCodes: Array<TSectionCode> = allSectionDetails.map(s => s.sectionCode)

export const allCalendarSectionCodes = ['DT', 'DY', 'DO', 'W', 'M', 'Q']

