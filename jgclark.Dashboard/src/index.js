/* eslint-disable require-await */
// @flow

// ----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated 4.4.2024 for v1.1.2, @jgclark
// ----------------------------------------------------------------------------

export { getDemoDataForDashboard } from './demoDashboard'
export {
  addTask, addChecklist,
  refreshDashboard,
  showDashboard,
  showDemoDashboard,
  // resetDashboardWinSize,
} from './HTMLGeneratorGrid' // previously: './HTMLGenerator'
export {
  togglePriorityFilter,
  toggleMonthSection,
  toggleOverdueSection,
  toggleQuarterSection,
  toggleTomorrowSection,
  toggleWeekSection,
  turnOnAllSections,
} from './settingControllers'
export {
  scheduleAllOverdueOpenToToday,
  scheduleAllTodayTomorrow,
  scheduleAllYesterdayOpenToToday
} from './dashboardHelpersWithRefresh'
export { onMessageFromHTMLView } from './pluginToHTMLBridge'
export { getDataForDashboard } from './dataGeneration'

/**
 * Other imports/exports
 */
// eslint-disable-next-line import/order
export { onOpen, decideWhetherToUpdateDashboard } from './dashboardTriggers'
export { editSettings } from '@helpers/NPSettings'
export { onUpdateOrInstall, init, onSettingsUpdated, versionCheck } from './NPHooks'
