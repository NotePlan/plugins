// @flow
//-----------------------------------------------------------------------------
// Dashboard-specific reminder list config and section-item helpers
// Shared Calendar/priority/date logic lives in @helpers/NPReminders
// Last updated 2026-08-01 for v2.4.0.b60, @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import type { TDashboardSettings, TReminderForDashboard, TSectionItem } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { logDebug } from '@helpers/dev'
import {
  dedupeReminderListTitles,
  getEnabledReminderLists,
  mapCalendarItemToReminder,
  resolveReminderListsByNames,
  type TReminderListsResult,
} from '@helpers/NPReminders'

export type { TReminderListsResult }

/**
 * Resolve which reminder lists to use for this Dashboard config / Perspective.
 * Blank `includedReminderLists` inherits NotePlan-enabled lists; a non-empty CSV selects
 * those accessible list names (including lists disabled in NotePlan) by exact title match.
 * @param {TDashboardSettings} config
 * @returns {TReminderListsResult}
 */
export function getReminderListsForConfig(config: TDashboardSettings): TReminderListsResult {
  const configuredNames = dedupeReminderListTitles(stringListOrArrayToArray(config.includedReminderLists ?? '', ','))
  if (configuredNames.length === 0) {
    return getEnabledReminderLists()
  }
  const result = resolveReminderListsByNames(configuredNames)
  logDebug('getReminderListsForConfig', `- Perspective override: ${String(result.titles.length)} of ${String(configuredNames.length)} configured list(s): ${result.titles.join(', ') || '(none)'}`)
  return result
}

/**
 * Map a NotePlan CalendarItem (reminder) into TReminderForDashboard.
 * Thin Dashboard alias for mapCalendarItemToReminder.
 * @param {TCalendarItem} calendarItem
 * @param {{ [string]: string }} [colorByTitle]
 * @returns {TReminderForDashboard}
 */
export function mapCalendarItemToReminderForDashboard(
  calendarItem: TCalendarItem,
  colorByTitle: { [string]: string } = {},
): TReminderForDashboard {
  return mapCalendarItemToReminder(calendarItem, colorByTitle)
}

/**
 * Build a TSectionItem for a reminder.
 * @param {string} id
 * @param {TReminderForDashboard} reminder
 * @returns {TSectionItem}
 */
export function createReminderSectionItem(id: string, reminder: TReminderForDashboard): TSectionItem {
  return {
    ID: id,
    sectionCode: 'REM',
    itemType: 'reminder',
    reminder,
  }
}
