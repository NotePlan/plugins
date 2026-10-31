// @flow
//-----------------------------------------------------------------------------
// Dashboard-specific reminder list config and section-item helpers
// Shared Calendar/priority/date logic lives in @helpers/NPReminders
// Last updated 2026-10-31, @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import type { TDashboardSettings, TReminderForDashboard, TSectionItem } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { logDebug } from '@helpers/dev'
import {
  dedupeReminderListTitles,
  getEnabledReminderLists,
  resolveReminderListsByNames,
  type TReminderListsResult,
} from '@helpers/NPReminders'

export type { TReminderListsResult }

/**
 * Resolve which reminder lists to use for this Dashboard config / Perspective, in display order.
 * Blank `includedReminderLists` inherits NotePlan-enabled lists in NotePlan's order.
 * A non-empty CSV is the order lists are offered in the Dashboard (the add-reminder dialog
 * shows that order and pre-selects the first). Names match accessible lists exactly,
 * including lists disabled in NotePlan.
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
