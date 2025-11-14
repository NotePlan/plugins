// @flow
//-----------------------------------------------------------------------------
// Constants for Dashboard code
// Last updated 2025-11-12 for v2.3.0.b14, @jgclark
//-----------------------------------------------------------------------------
import pluginJson from '../plugin.json'
import type { TSectionDetails, TSectionCode } from './types'

// NOTE: Dashboard Settings are in the src/dashboardSettingsItems.js file

// Note: Not yet used everwhere
export const WEBVIEW_WINDOW_ID = `${pluginJson['plugin.id']}.main` // will be used as the customId for your window

export const allSectionDetails: Array<TSectionDetails> = [
  { sectionCode: 'DT', sectionName: 'Today', showSettingName: 'showTodaySection' },
  { sectionCode: 'DY', sectionName: 'Yesterday', showSettingName: 'showYesterdaySection' },
  { sectionCode: 'DO', sectionName: 'Tomorrow', showSettingName: 'showTomorrowSection' },
  { sectionCode: 'LW', sectionName: 'Last Week', showSettingName: 'showLastWeekSection' },
  { sectionCode: 'W', sectionName: 'Week', showSettingName: 'showWeekSection' },
  { sectionCode: 'M', sectionName: 'Month', showSettingName: 'showMonthSection' },
  { sectionCode: 'Q', sectionName: 'Quarter', showSettingName: 'showQuarterSection' },
  // TAG types are treated specially (one for each tag a user wants to see).
  // Use getTagSectionDetails() to get them
  { sectionCode: 'TAG', sectionName: '', showSettingName: `showTagSection` }, // sectionName set later to reflect the tagsToShow setting
  { sectionCode: 'PROJ', sectionName: 'Projects', showSettingName: 'showProjectSection' },
  { sectionCode: 'PRIORITY', sectionName: 'Priority', showSettingName: 'showPrioritySection' },
  { sectionCode: 'OVERDUE', sectionName: 'Overdue', showSettingName: 'showOverdueSection' },
  { sectionCode: 'TB', sectionName: 'Current time block', showSettingName: 'showTimeBlockSection' },
  { sectionCode: 'SEARCH', sectionName: 'Search', showSettingName: '' },
  { sectionCode: 'INFO', sectionName: 'Info', showSettingName: 'showInfoSection' },
  // For later use:
  // { sectionCode: 'SAVEDSEARCH', sectionName: 'Saved Search', showSettingName: 'showSavedSearchSection' },
]

export const allSectionCodes: Array<TSectionCode> = allSectionDetails.map((s) => s.sectionCode)

// 6:W 12:TAG 14:PRIORITY 15:PROJ 16:TB 19:LW 20:INFO 21:SEARCH 22:SAVEDSEARCH
// TODO(later): remove once we re-work the sectionCodes
export const indexIntoAllSectionCodes = ['DT', 'DT', 'DY', 'DY', 'DO', 'DO', 'W', 'W', 'M', 'M', 'Q', 'Q', 'TAG', 'OVERDUE', 'PRIORITY', 'PROJ', 'TB', '-', '-', 'LW', 'INFO', 'SEARCH', 'SAVEDSEARCH']

export const allCalendarSectionCodes = ['TB', 'DT', 'DY', 'DO', 'LW', 'W', 'M', 'Q']

export const defaultSectionDisplayOrder = ['SEARCH', 'INFO', 'SAVEDSEARCH', 'TB', 'DT', 'DY', 'DO', 'LW', 'W', 'M', 'Q', 'TAG', 'OVERDUE', 'PRIORITY', 'PROJ']

// change this order to change which duplicate items get kept - the first on the list. Should not include 'dontDedupeSectionCodes' below.
export const sectionPriority = ['TB', 'TAG', 'DT', 'DY', 'DO', 'W', 'M', 'Q', 'PRIORITY', 'OVERDUE']

// Those sections we can't or shouldn't attempt to dedupe:
// - TB as its for info only
// - PROJ as it isn't about paragraphs, but notes
export const dontDedupeSectionCodes = ['INFO', 'PROJ', 'SEARCH', 'SAVEDSEARCH']

// Enable interactive processing for these itemTypes:
export const interactiveProcessingPossibleSectionTypes = ['DT', 'DY', 'DO', 'LW', 'W', 'M', 'Q', 'TAG', 'OVERDUE', 'PRIORITY']

// Treat these itemTypes as if they are zero items, so we don't show the Interactive or other Processing buttons, and correct the count in the description
export const treatSingleItemTypesAsZeroItems = ['itemCongrats', 'projectCongrats', 'noSearchResults', 'preLimitOverdues']
