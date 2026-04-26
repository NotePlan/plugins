// @flow
//---------------------------------------------------------------
// Helper functions for Journalling plugin for NotePlan
// Jonathan Clark
// last update 2026-04-13 for v2.0.0.b10 by @jgclark
//---------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getNextNPPeriodString, RE_DONE_DATE_OPT_TIME } from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

//---------------------------------------------------------------
// Constants & Types

const pluginID = 'jgclark.PeriodicReviews'

export type PeriodicReviewConfigType = {
  dailyJournalSectionHeading: string,
  reviewSectionHeading: string,
  dayPlanItemsName: string,
  weekPlanItemsName: string,
  monthPlanItemsName: string,
  quarterPlanItemsName: string,
  yearPlanItemsName: string,
  startDailyTemplateTitle: string,
  endDailyTemplateTitle: string,
  startWeeklyTemplateTitle: string,
  endWeeklyTemplateTitle: string,
  startMonthlyTemplateTitle: string,
  endMonthlyTemplateTitle: string,
  openCalendarNoteWhenReviewing: boolean,
  preferredWindowType: string,
  dailyReviewQuestions: string,
  weeklyReviewQuestions: string,
  monthlyReviewQuestions: string,
  quarterlyReviewQuestions: string,
  yearlyReviewQuestions: string,
  moods: string,
  calendarSet: Array<string>,
  plannedItemsPrefix?: string,
  plannedItemsSuffix?: string,
}

/** One parsed segment from review settings; `<type>` names are defined in `reviewQuestions.js` (`REVIEW_QUESTION_TYPE_NAMES_ALT`). */
export type ParsedQuestionType = {
  question: string,
  type: string,
  originalLine: string,
  lineIndex: number
}

//---------------------------------------------------------------
// Settings

/**
 * Get or make config settings
 * @author @jgclark
 */
export async function getJournalSettings(): Promise<any> { // want to use Promise<JournalConfigType> but too many flow errors result
  try {
    // Get settings using Config system
    const config: PeriodicReviewConfigType = await DataStore.loadJSON(`../${pluginID}/settings.json`)

    if (config == null || Object.keys(config).length === 0) {
      logError(pluginJson, `getJournalSettings() cannot find '${pluginID}' plugin settings. Stopping.`)
      await showMessage(`Cannot find settings for the '${pluginID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
      return
    } else {
      // clo(config, `${pluginID} settings:`)
      return config
    }
  }
  catch (error) {
    logError(pluginJson, `getJournalSettings: ${error.message}`)
    return // for completeness
  }
}

/**
 * Get raw question lines for the given period from config.
 * From v1.16, these may now contain multiple questions per line, separated by '||'.
 * @param {JournalConfigType} config the journal configuration
 * @param {string} period for journal questions: 'day', 'week', 'month', 'quarter', 'year'
 * @returns {Promise<Array<string>>} array of question lines, or empty array if unsupported
 */
export async function getQuestionsForPeriod(config: PeriodicReviewConfigType, period: string): Promise<Array<string>> {
  let rawQuestionLines: Array<string> = []
  switch (period) {
    case 'day': {
      rawQuestionLines = config.dailyReviewQuestions.split('\n')
      break
    }
    case 'week': {
      rawQuestionLines = config.weeklyReviewQuestions.split('\n')
      break
    }
    case 'month': {
      rawQuestionLines = config.monthlyReviewQuestions.split('\n')
      break
    }
    case 'quarter': {
      rawQuestionLines = config.quarterlyReviewQuestions.split('\n')
      break
    }
    case 'year': {
      rawQuestionLines = config.yearlyReviewQuestions.split('\n')
      break
    }
    default: {
      logError(pluginJson, `${period} review questions aren't yet supported. Stopping.`)
      await showMessage(`Sorry, ${period} review questions aren't yet supported.`)
      return []
    }
  }
  logDebug(pluginJson, `rawQuestionLines: ${String(rawQuestionLines)}`)
  return rawQuestionLines
}

/**
 * Get the configured section heading to use for a given review period.
 * @param {JournalConfigType} config the journal configuration
 * @param {string} periodType for journal questions: 'day', 'week', 'month', 'quarter', 'year'
 * @returns {string}
 */
export function getSectionHeadingForPeriod(config: PeriodicReviewConfigType, periodType: string): string {
  if (periodType === 'day') {
    return config.dailyJournalSectionHeading
  }
  return config.reviewSectionHeading
}

/**
 * Normalize non-empty lines from the planning textarea for storage (strip task markers and any leading `>>').
 * @tests in jest file
 * @param {string} planningFormText
 * @returns {Array<string>}
 */
export function normalizePlanningTaskLinesFromForm(planningFormText: string): Array<string> {
  const raw = typeof planningFormText === 'string' ? planningFormText : String(planningFormText ?? '')
  return raw
    .split(/\r?\n/)
    .map((l) => {
      let t = l.trim()
      t = t.replace(/^\*\s*/, '')
      if (t.startsWith('>>')) {
        t = t.slice(2).trim()
      }
      return t
    })
    .filter((t) => t !== '')
}

/**
 * Effective prefix/suffix for lines written to the next period note (after `normalizePlanningTaskLinesFromForm`).
 * Defaults are empty string, if not set.
 * @tests in jest file
 * @param {PeriodicReviewConfigType} config
 * @returns {{ prefix: string, suffix: string }}
 */
export function getEffectivePlannedItemAffixes(config: PeriodicReviewConfigType): { prefix: string, suffix: string } {
  const affix = (raw: mixed, defaultValue: string): ?string => {
    if (raw === undefined || raw === null || typeof raw !== 'string') return defaultValue
    return raw.trim() === '' ? null : raw
  }
  return {
    prefix: affix(config.plannedItemsPrefix, ''),
    suffix: affix(config.plannedItemsSuffix, ''),
  }
}

/**
 * Build one task line body for the next period note: optional suffix on `body`, then optional prefix.
 * @tests in jest file
 * @param {string} body normalized plain text (no task marker)
 * @param {?string} prefix
 * @param {?string} suffix
 * @returns {string}
 */
export function formatPlannedItemLineForNextNote(body: string, prefix: ?string, suffix: ?string): string {
  const join = (left: string, right: string): string => {
    if (left === '') return right
    if (right === '') return left
    return /\s$/.test(left) || /^\s/.test(right) ? `${left}${right}` : `${left} ${right}`
  }
  let line = body
  if (suffix != null) line = join(line, suffix)
  if (prefix != null) line = join(prefix, line)
  return line
}

/**
 * Replace `<date>` with the calendar period title and `<datenext>` / `<nextdate>` with the following period.
 * Used for the review HTML window and for text written back to the note.
 * @tests in jest file
 * @param {string} input
 * @param {string} periodString
 * @param {string} periodType — 'day' | 'week' | 'month' | 'quarter' | 'year'
 * @returns {string}
 */
export function substituteReviewPeriodPlaceholders(input: string, periodString: string, periodType: string): string {
  const nextPeriodStr = getNextNPPeriodString(periodString, periodType)
  return input
    .replace(/<\s*date\s*>/gi, periodString)
    .replace(/<\s*(?:datenext|nextdate)\s*>/gi, nextPeriodStr)
}

/**
 * Title-case adjective for UI strings (window title, review heading, messages).
 * @tests in jest file
 * @param {string} periodType — 'day' | 'week' | 'month' | 'quarter' | 'year'
 * @returns {string} e.g. 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'
 */
export function getPeriodAdjectiveFromType(periodType: string): string {
  switch (periodType) {
    case 'day':
      return 'Daily'
    case 'week':
      return 'Weekly'
    case 'month':
      return 'Monthly'
    case 'quarter':
      return 'Quarterly'
    case 'year':
      return 'Yearly'
    default:
      return '(error: unknown period type)'
  }
}

/** Default plan-item labels when settings are missing or empty. */
// TODO: make this look at the plugin.json "default" for the "key" below
const PLAN_ITEMS_NAME_DEFAULTS: { [string]: string } = {
  day: 'Big Rocks',
  week: 'Top Wins',
  month: 'Key Outcomes',
  quarter: 'Goals',
  year: 'Theme',
}

/** Settings keys for `getPlanItemsNameForPeriodType`. */
const PLAN_ITEMS_NAME_CONFIG_KEYS: { [string]: string } = {
  day: 'dayPlanItemsName',
  week: 'weekPlanItemsName',
  month: 'monthPlanItemsName',
  quarter: 'quarterPlanItemsName',
  year: 'yearPlanItemsName',
}

/**
 * Configured label for planned items for a calendar period (e.g. "Big 3 Rocks").
 * @tests in jest file
 * @param {JournalConfigType} config
 * @param {string} periodType — 'day' | 'week' | 'month' | 'quarter' | 'year'
 * @returns {string}
 */
export function getPlanItemsNameForPeriodType(config: PeriodicReviewConfigType, periodType: string): string {
  const key = PLAN_ITEMS_NAME_CONFIG_KEYS[periodType]
  const fallback = PLAN_ITEMS_NAME_DEFAULTS[periodType] ?? 'Plans'
  if (key == null) {
    return fallback
  }
  // $FlowFixM
  // e[invalid-computed-prop]
  const raw = config[key]
  const s = typeof raw === 'string' ? raw.trim() : ''
  return s !== '' ? s : fallback
}

/**
 * Lowercase English noun for "the next …" in plan section titles.
 * @param {string} periodType
 * @returns {string}
 */
export function getPeriodNounForType(periodType: string): string {
  const nouns: { [string]: string } = {
    day: 'day',
    week: 'week',
    month: 'month',
    quarter: 'quarter',
    year: 'year',
  }
  return nouns[periodType] ?? 'period'
}

/**
 * H2 / UI title for the **current** period’s plan in the review summary: `Planned: {planName}`.
 * @param {string} planName
 * @returns {string}
 */
export function buildThisPlanSectionHeadingTitle(planName: string): string {
  return `Planned: ${planName}`
}

/**
 * H2 / UI title for the planning textarea in the review HTML: `Planning: {planName} for the next {noun}`.
 * @tests in jest file
 * @param {string} planName
 * @param {string} periodType — 'day' | 'week' | 'month' | 'quarter' | 'year'
 * @returns {string}
 */
export function buildNextPlanSectionHeadingTitle(planName: string, periodType: string): string {
  const noun = getPeriodNounForType(periodType)
  return `Planning: ${planName} for the next ${noun}`
}

/**
 * H2 written **on the next calendar note** when saving planned tasks: `{planName} for {periodString}`.
 * `periodString` must be that note’s calendar title (e.g. from `getNextNPPeriodString`).
 * @tests in jest file
 * @param {string} planName
 * @param {string} periodString — next period’s NotePlan calendar title
 * @returns {string}
 */
export function buildNextPeriodNotePlanSectionHeadingTitle(planName: string, periodString: string): string {
  return `${planName} for ${periodString}`
}

/**
 * Normalize a task line for comparing duplicates (trim; used when scanning notes and when merging summary lists).
 * @tests in jest file
 * @param {string} content
 * @returns {string}
 */
export function summaryTaskLineDedupeKey(content: string): string {
  return content.trim()
}

/** Global @done stripper for probing task body for `>>` win marker (same pattern as review HTML summary). */
const RE_STRIP_DONE_FOR_SUMMARY_PROBE: RegExp = new RegExp(RE_DONE_DATE_OPT_TIME.source, 'gi')

/**
 * True if task line includes #win / #bigwin anywhere (word boundary).
 * @param {string} content
 * @returns {boolean}
 */
function hasWinHashtag(content: string): boolean {
  return /(?:^|\s)#(?:bigwin|win)\b/i.test(content)
}

/**
 * True when the task body uses the `>>` win / planning marker after optional list marker and `!` priorities.
 * @param {string} content
 * @returns {boolean}
 */
function taskLineHasDoubleChevronWinPrefix(content: string): boolean {
  let probe = content.replace(RE_STRIP_DONE_FOR_SUMMARY_PROBE, '').trim()
  probe = probe.replace(/^\*+\s+/, '').replace(/^[-+]\s+\[[ x]\]\s*/i, '').replace(/^-\s+/, '').trim()
  while (!/^>>\s?/.test(probe)) {
    const next = probe.replace(/^!{1,3}\s+/, '').trim()
    if (next === probe) {
      return false
    }
    probe = next
  }
  return true
}

/**
 * A done task counts as a "win" for the review summary when tagged #win / #bigwin or prefixed with `>>` on the task body.
 * @tests in jest file
 * @param {string} content
 * @returns {boolean}
 */
export function taskContentIsSummaryWin(content: string): boolean {
  return hasWinHashtag(content) || taskLineHasDoubleChevronWinPrefix(content)
}

/**
 * Split the merged summary list into a leading win block and the rest ("other completed").
 * Uses the same win rules as {@link taskContentIsSummaryWin} so runtime HTML matches note scanning.
 * @tests in jest file
 * @param {Array<string>} mergedLines output of mergeUniqueSummaryDoneTaskLines (wins first, then others)
 * @returns {{ wins: Array<string>, others: Array<string> }}
 */
export function splitMergedSummaryDoneLinesIntoWinsAndOthers(mergedLines: Array<string>): {| wins: Array<string>, others: Array<string> |} {
  const wins: Array<string> = []
  let i = 0
  for (; i < mergedLines.length; i++) {
    const line = mergedLines[i]
    if (!taskContentIsSummaryWin(line)) {
      break
    }
    wins.push(line)
  }
  return { wins, others: mergedLines.slice(i) }
}

/**
 * Merge win-first and other completed lines into one list: each normalized line at most once.
 * Lines whose key matches a carry-over plan row are omitted (that row is already shown in the carry-over block).
 * @tests in jest file
 * @param {Array<string>} winTasks
 * @param {Array<string>} completedTasks
 * @param {Array<{ content: string }>} carryOverPlanItems
 * @returns {Array<string>}
 */
export function mergeUniqueSummaryDoneTaskLines(
  winTasks: Array<string>,
  completedTasks: Array<string>,
  carryOverPlanItems: Array<{ content: string }> = [],
): Array<string> {
  const carryKeys = new Set(carryOverPlanItems.map((item) => summaryTaskLineDedupeKey(item.content)))
  const seen = new Set<string>()
  const out: Array<string> = []
  const tryAdd = (line: string) => {
    const k = summaryTaskLineDedupeKey(line)
    if (k === '') {
      return
    }
    if (carryKeys.has(k)) {
      return
    }
    if (seen.has(k)) {
      return
    }
    seen.add(k)
    out.push(line)
  }
  winTasks.forEach(tryAdd)
  completedTasks.forEach(tryAdd)
  return out
}