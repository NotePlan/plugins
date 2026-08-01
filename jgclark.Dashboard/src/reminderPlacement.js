// @flow
//-----------------------------------------------------------------------------
// Reminder section placement: settings -> destination sections
// Owns the routing table for where each date bucket is shown.
// Last updated 2026-08-01 for v2.4.0.b60, @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import { isCurrentRemindersEnabled, isUndatedOverdueRemindersEnabled } from './dashboardHelpers'
import { filterSectionItemsWhoseReminderTimeHasBeenReached, sortReminderSectionItems, type TReminderBuckets } from './reminderBuckets'
import type { TDashboardSettings, TSectionItem } from './types'
import { logDebug } from '@helpers/dev'

//-----------------------------------------------------------------------------
// Types

/**
 * One homeless-reminder warning entry for the orchestrator log.
 */
export type TReminderHomelessPart = {
  label: string,
  count: number,
}

/**
 * Ready-to-merge reminder arrays for each host section, plus REM description label and homeless warnings.
 *
 * Routing table (primary -> fallback -> never shown):
 * - untimed today -> DT -> REM -> if Current Reminders and REM both off
 * - timed today -> TB (after hideTimedRemindersUntilDue) -> none -> future-timed when hide-until-due on
 * - yesterday -> DY -> OVERDUE then REM -> if Current Reminders, OVERDUE, and REM all off
 * - tomorrow -> DO -> none -> when Tomorrow off
 * - overdue -> OVERDUE -> REM -> if Undated/Overdue Reminders and REM both off
 * - undated -> REM -> - -> if Undated/Overdue Reminders off
 */
export type TReminderPlacement = {
  forDT: Array<TSectionItem>,
  forTB: Array<TSectionItem>,
  forDY: Array<TSectionItem>,
  forDO: Array<TSectionItem>,
  forOVERDUE: Array<TSectionItem>,
  forREM: Array<TSectionItem>,
  remBucketsLabel: string,
  homeless: Array<TReminderHomelessPart>,
}

//-----------------------------------------------------------------------------
// Main placement

/**
 * @returns {TReminderPlacement}
 */
function emptyPlacement(): TReminderPlacement {
  return {
    forDT: [],
    forTB: [],
    forDY: [],
    forDO: [],
    forOVERDUE: [],
    forREM: [],
    remBucketsLabel: '',
    homeless: [],
  }
}

/**
 * Whether the Today section is enabled (missing key means ON, matching getListOfEnabledSections).
 * @param {TDashboardSettings} config
 * @returns {boolean}
 */
function isTodaySectionVisible(config: TDashboardSettings): boolean {
  return Boolean(config.showTodaySection) || config.showTodaySection === undefined
}

/**
 * Place date-bucketed reminders into destination sections according to Dashboard settings.
 * Pure settings -> destinations; does not assign final section item IDs.
 * @param {TReminderBuckets} buckets
 * @param {TDashboardSettings} config
 * @returns {TReminderPlacement}
 */
export function placeReminderBuckets(buckets: TReminderBuckets, config: TDashboardSettings): TReminderPlacement {
  const currentRemindersEnabled = isCurrentRemindersEnabled(config)
  const undatedOverdueRemindersEnabled = isUndatedOverdueRemindersEnabled(config)

  if (!currentRemindersEnabled && !undatedOverdueRemindersEnabled) {
    return emptyPlacement()
  }

  const showToday = isTodaySectionVisible(config)
  const showYesterday = Boolean(config.showYesterdaySection)
  const showTomorrow = Boolean(config.showTomorrowSection)
  const showOverdue = Boolean(config.showOverdueSection)
  const hideUntilDue = config.hideTimedRemindersUntilDue !== false

  // Gate by master toggles before routing
  const timedToday = currentRemindersEnabled ? buckets.timedTodayItems : []
  const untimedToday = currentRemindersEnabled ? buckets.untimedTodayItems : []
  const yesterday = currentRemindersEnabled ? buckets.yesterdayItems : []
  const tomorrow = currentRemindersEnabled ? buckets.tomorrowItems : []
  const overdue = undatedOverdueRemindersEnabled ? buckets.overdueItems : []
  const undated = undatedOverdueRemindersEnabled ? buckets.undatedItems : []

  // Timed today -> TB only (after optional hide-until-due). No fallback by design.
  const forTB = hideUntilDue ? filterSectionItemsWhoseReminderTimeHasBeenReached(timedToday) : timedToday
  if (hideUntilDue && timedToday.length > forTB.length) {
    logDebug(
      'placeReminderBuckets',
      `- skipped ${String(timedToday.length - forTB.length)} timed reminder(s) whose time has not been reached yet (hideTimedRemindersUntilDue)`,
    )
  }

  // Untimed today -> DT, else REM fallback
  let forDT: Array<TSectionItem> = []
  const remFallbackItems: Array<TSectionItem> = []
  const remLabelParts: Array<string> = []

  if (untimedToday.length > 0) {
    if (showToday) {
      forDT = untimedToday
    } else if (undatedOverdueRemindersEnabled) {
      remFallbackItems.push(...untimedToday)
      remLabelParts.push('today')
    }
  }

  // Yesterday -> DY, else OVERDUE, else REM
  let forDY: Array<TSectionItem> = []
  const overdueFromYesterday: Array<TSectionItem> = []
  if (yesterday.length > 0) {
    if (showYesterday) {
      forDY = yesterday
    } else if (showOverdue && undatedOverdueRemindersEnabled) {
      overdueFromYesterday.push(...yesterday)
    } else if (undatedOverdueRemindersEnabled) {
      remFallbackItems.push(...yesterday)
      remLabelParts.push('yesterday')
    }
  }

  // Tomorrow -> DO only; no fallback
  const forDO = showTomorrow ? tomorrow : []

  // Overdue (past-dated) -> OVERDUE, else REM
  let overdueForSection: Array<TSectionItem> = []
  if (overdue.length > 0) {
    if (showOverdue) {
      overdueForSection = overdue
    } else if (undatedOverdueRemindersEnabled) {
      remFallbackItems.push(...overdue)
      remLabelParts.push('overdue')
    }
  }

  const forOVERDUE = overdueForSection.concat(overdueFromYesterday)

  // REM = undated + fallbacks
  let forREM: Array<TSectionItem> = []
  let remBucketsLabel = ''
  if (undatedOverdueRemindersEnabled) {
    remBucketsLabel = 'undated'
    forREM = undated.slice()
    if (remFallbackItems.length > 0) {
      logDebug(
        'placeReminderBuckets',
        `- REM fallback: adopting ${String(remFallbackItems.length)} reminder(s) whose own section is off (overdueVisible=${String(showOverdue)} yesterdayVisible=${String(showYesterday)} todayVisible=${String(showToday)})`,
      )
      forREM = sortReminderSectionItems(forREM.concat(remFallbackItems))
      remBucketsLabel += remLabelParts.map((p) => ` + ${p}`).join('')
    }
  }

  // Homeless: items with no visible host (mirrors prior orchestrator warnings)
  const remCanHost = undatedOverdueRemindersEnabled
  const homeless: Array<TReminderHomelessPart> = []
  if (yesterday.length > 0 && forDY.length === 0 && !showOverdue && !remCanHost) {
    homeless.push({ label: 'yesterday', count: yesterday.length })
  }
  if (overdue.length > 0 && !showOverdue && !remCanHost) {
    homeless.push({ label: 'overdue', count: overdue.length })
  }
  if (tomorrow.length > 0 && !showTomorrow) {
    homeless.push({ label: 'tomorrow (no fallback: Tomorrow section off)', count: tomorrow.length })
  }
  if (untimedToday.length > 0 && !showToday && !remCanHost) {
    homeless.push({ label: 'untimed today', count: untimedToday.length })
  }

  return {
    forDT,
    forTB,
    forDY,
    forDO,
    forOVERDUE,
    forREM,
    remBucketsLabel,
    homeless,
  }
}
