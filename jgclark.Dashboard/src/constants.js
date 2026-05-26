// @flow
//-----------------------------------------------------------------------------
// Constants for Dashboard code.
// Check each of them when adding a new Section.
// Last updated 2026-05-25 for v2.4.0.b44, @jgclark + @CursorAI
//-----------------------------------------------------------------------------
import pluginJson from '../plugin.json'
import type { TSectionDetails, TSectionCode } from './types'

// NOTE: Dashboard Settings are in the src/dashboardSettingsItems.js file

// Note: Needs to be set in plugin.json file for each sidebarView windowID
export const WEBVIEW_WINDOW_ID = `${pluginJson['plugin.id']}.main` // will be used as the customId for your window

export const allSectionDetails: Array<TSectionDetails> = [
  { sectionCode: 'TB', sectionName: 'Current time blocks', showSettingName: 'showTimeBlockSection' },
  { sectionCode: 'WINS', sectionName: 'Wins', showSettingName: 'showWinsSection' },
  { sectionCode: 'DT', sectionName: 'Today', showSettingName: 'showTodaySection' },
  { sectionCode: 'DY', sectionName: 'Yesterday', showSettingName: 'showYesterdaySection' },
  { sectionCode: 'DO', sectionName: 'Tomorrow', showSettingName: 'showTomorrowSection' },
  { sectionCode: 'LW', sectionName: 'Last Week', showSettingName: 'showLastWeekSection' },
  { sectionCode: 'W', sectionName: 'This Week', showSettingName: 'showWeekSection' },
  { sectionCode: 'M', sectionName: 'Month', showSettingName: 'showMonthSection' },
  { sectionCode: 'Q', sectionName: 'Quarter', showSettingName: 'showQuarterSection' },
  { sectionCode: 'Y', sectionName: 'Year', showSettingName: 'showYearSection' },
  // TAG types are treated specially (one for each tag a user wants to see).
  // Use getTagSectionDetails() to get them
  // sectionName set later to reflect the tagsToShow setting
  { sectionCode: 'TAG', sectionName: '', showSettingName: `showTagSection` },
  { sectionCode: 'PROJACT', sectionName: 'Active Projects', showSettingName: 'showProjectActiveSection' },
  { sectionCode: 'PROJREVIEW', sectionName: 'Projects to Review', showSettingName: 'showProjectReviewSection' },
  { sectionCode: 'PRIORITY', sectionName: 'Priority', showSettingName: 'showPrioritySection' },
  { sectionCode: 'OVERDUE', sectionName: 'Overdue', showSettingName: 'showOverdueSection' },
  { sectionCode: 'SEARCH', sectionName: 'Search', showSettingName: '' },
  // For possible future use:
  // { sectionCode: 'INFO', sectionName: 'Info', showSettingName: 'showInfoSection' },
  // { sectionCode: 'SAVEDSEARCH', sectionName: 'Saved Search', showSettingName: 'showSavedSearchSection' },
]

export const allSectionCodes: Array<TSectionCode> = allSectionDetails.map((s) => s.sectionCode)

/** Sections backed by Reviews `allProjectsList.json`. Exclude from editor-trigger "refresh all" so we do not double-refresh (and race) right after `updateDashboardIfOpen` from list writes. */
export const sectionCodesFromAllProjectsJson: Array<TSectionCode> = ['PROJACT', 'PROJREVIEW']

export const allCalendarSectionCodes = ['DT', 'DY', 'DO', 'LW', 'W', 'M', 'Q', 'Y']

export const defaultSectionDisplayOrder = ['SEARCH', 'INFO', 'SAVEDSEARCH', 'TB', 'WINS', 'DT', 'DY', 'DO', 'LW', 'W', 'M', 'Q', 'Y', 'TAG', 'OVERDUE', 'PRIORITY', 'PROJACT', 'PROJREVIEW']

// change this order to change which duplicate items get kept - the first on the list. Should not include 'dontDedupeSectionCodes' below.
// WINS before DT/W/M/Q so hideDuplicates keeps >> items in Wins and strips them from period sections.
export const sectionPriority = ['TB', 'TAG', 'WINS', 'DT', 'DY', 'DO', 'W', 'M', 'Q', 'Y', 'PRIORITY', 'OVERDUE']

// Those sections we can't or shouldn't attempt to dedupe:
// - TB as its for info only
// - PROJREVIEW and PROJACT as they aren't about paragraphs, but notes
export const dontDedupeSectionCodes = ['INFO', 'PROJACT', 'PROJREVIEW', 'SEARCH', 'SAVEDSEARCH']

// Enable interactive processing for these itemTypes:
export const interactiveProcessingPossibleSectionTypes = ['DT', 'DY', 'DO', 'LW', 'W', 'M', 'Q', 'Y', 'TAG', 'OVERDUE', 'PRIORITY']

/** When the user toggles visibility of a calendar period section only, refresh these sections (if enabled) so Wins / Priority / Overdue deduping stays correct. */
export const SECTIONS_TO_REFRESH_AFTER_CHANGE_OF_VISIBILITY_OF_CALENDAR_SECTIONS: Array<TSectionCode> = ['WINS', 'PRIORITY', 'OVERDUE']

export const SEARCH_RELATED_SECTION_CODES: Array<TSectionCode> = ['SEARCH', 'SAVEDSEARCH']

// i.e. build in React front end, not in back end
export const SYNTHETIC_SECTION_CODES: Array <TSectionCode> = ['WINS']

// Treat these itemTypes as if they are zero items, so we don't show the Interactive or other Processing buttons, and correct the count in the description
export const treatSingleItemTypesAsZeroItems = ['itemCongrats', 'winsCongrats', 'projectCongrats', 'noSearchResults', 'preLimitOverdues']

/** Font Awesome classes for the Item and Wins congrats messages (`section.FAIconClass`); use the same for `winsCongrats` message rows. */
export const winsSectionHeaderFAIconClass = 'fa-regular fa-trophy'
export const itemCongratsFAIconClass = 'fa-light fa-champagne-glasses'

/**
 * Dashboard setting keys that can change without re-fetching section item lists (theme uses CHANGE_THEME CSS regen instead).
 */
export const DASHBOARD_SETTING_KEYS_NOT_REQUIRING_DISPLAY_OR_CONTENT_REFRESH: Set<string> = new Set(['applyCurrentFilteringToSearch', 'autoUpdateAfterIdleTime', 'dashboardTheme', 'dontSearchFutureItems', 'enableInteractiveProcessing', 'enableInteractiveProcessingTransitions', 'interactiveProcessingHighlightTask', 'lastModified', 'moveSubItems', 'newTaskSectionHeading', 'newTaskSectionHeadingLevel', 'preferredWindowType', 'settingsMigrated', 'useLiteScheduleMethod'])
