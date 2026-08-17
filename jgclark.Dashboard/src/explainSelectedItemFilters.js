// @flow
//-----------------------------------------------------------------------------
// Diagnostic: explain why the selected (or given) paragraph would or would not
// appear in each enabled Dashboard section under the active Perspective settings.
// Last updated 2026-08-15 for v2.4.0.b64 by @CursorAI
// TODO(later): remove when no longer needed for filter debugging
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { allSectionDetails, WEBVIEW_WINDOW_ID } from './constants'
import {
  filterBySchedulingRules,
  filterParasByExcludedCalendarSections,
  filterParasByIncludedCalendarSections,
  filterParasByIgnoreTerms,
  filterParasByRelevantFolders,
  filterToOpenParagraphs,
  getDashboardSettings,
  getListOfEnabledSections,
  getNotePlanSettings,
  isLineDisallowedByIgnoreTerms,
  isNoteFromAllowedTeamspace,
  resolveAllowedTeamspaceIDs,
} from './dashboardHelpers'
import { getActivePerspectiveName, loadPerspectiveDefsFromPluginSettings } from './perspectiveHelpers'
import { getCurrentlyAllowedFolders } from './perspectivesShared'
import type { TDashboardSettings, TSectionCode } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import {
  findScheduledDates,
  getDateStringFromCalendarFilename,
  getNPMonthStr,
  getNPQuarterStr,
  getNPWeekStr,
  getNPYearStr,
  getTodaysDateHyphenated,
  includesScheduledFutureDate,
} from '@helpers/dateTime'
import { clo, logError, logInfo, logWarn } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { sendBannerMessage } from '@helpers/HTMLView'
import { getSelectedParagraphsToUse } from '@helpers/NPEditor'
import { getHeadingHierarchyForThisPara } from '@helpers/headings'
import { getDueDateOrStartOfCalendarDate } from '@helpers/NPdateTime'
import { isNoteFromAllowedFolder, getNoteByFilename } from '@helpers/note'
import { hasOverdueTag, paragraphIsEffectivelyOverdue } from '@helpers/NPParagraph'
import { fullHashtagOrMentionMatch } from '@helpers/search'
import { getNumericPriorityFromPara } from '@helpers/sorting'
import { showMessage } from '@helpers/userInput'
import { isOpen, isOpenNotScheduled, isOpenTask } from '@helpers/utils'

const LOG = 'explainSelectedItemFilters'

type TStepResult = {
  label: string,
  pass: boolean,
  detail: string,
}

type TSectionExplainResult = {
  sectionCode: TSectionCode,
  sectionLabel: string,
  verdict: 'INCLUDE' | 'EXCLUDE' | 'N/A',
  reason: string,
  steps: Array<TStepResult>,
}

type TPeriodInfo = {
  periodName: string,
  dateStrForAPI: string,
  dateStrForSchedule: string,
  calendarFilenameHint: string,
}

/**
 * Log one PASS/FAIL step for the Plugin Console.
 * @param {TStepResult} step
 * @returns {void}
 */
function logStep(step: TStepResult): void {
  logInfo(LOG, `  ${step.pass ? 'PASS' : 'FAIL'} ${step.label}: ${step.detail}`)
}

/**
 * Human label for a section code (TAG uses tagsToShow).
 * @param {TSectionCode} sectionCode
 * @param {TDashboardSettings} settings
 * @returns {string}
 */
function sectionLabelFor(sectionCode: TSectionCode, settings: TDashboardSettings): string {
  if (sectionCode === 'TAG') {
    return `TAG (${settings.tagsToShow || 'none'})`
  }
  const detail = allSectionDetails.find((s) => s.sectionCode === sectionCode)
  return detail ? `${sectionCode} (${detail.sectionName || sectionCode})` : sectionCode
}

/**
 * Resolve calendar period info for a calendar section code.
 * @param {TSectionCode} sectionCode
 * @returns {?TPeriodInfo}
 */
function getPeriodInfoForSection(sectionCode: TSectionCode): ?TPeriodInfo {
  const today = new moment().toDate()
  switch (sectionCode) {
    case 'DT': {
      const hyphen = getTodaysDateHyphenated()
      const unhyphen = moment(today).format('YYYYMMDD')
      return { periodName: 'day', dateStrForAPI: unhyphen, dateStrForSchedule: hyphen, calendarFilenameHint: unhyphen }
    }
    case 'DY': {
      const y = moment(today).subtract(1, 'day')
      return { periodName: 'day', dateStrForAPI: y.format('YYYYMMDD'), dateStrForSchedule: y.format('YYYY-MM-DD'), calendarFilenameHint: y.format('YYYYMMDD') }
    }
    case 'DO': {
      const t = moment(today).add(1, 'day')
      return { periodName: 'day', dateStrForAPI: t.format('YYYYMMDD'), dateStrForSchedule: t.format('YYYY-MM-DD'), calendarFilenameHint: t.format('YYYYMMDD') }
    }
    case 'W': {
      const w = getNPWeekStr(today)
      return { periodName: 'week', dateStrForAPI: w, dateStrForSchedule: w, calendarFilenameHint: w }
    }
    case 'LW': {
      const lw = getNPWeekStr(moment(today).subtract(1, 'week').toDate())
      return { periodName: 'week', dateStrForAPI: lw, dateStrForSchedule: lw, calendarFilenameHint: lw }
    }
    case 'M': {
      const m = getNPMonthStr(today)
      return { periodName: 'month', dateStrForAPI: m, dateStrForSchedule: m, calendarFilenameHint: m }
    }
    case 'Q': {
      const q = getNPQuarterStr(today)
      return { periodName: 'quarter', dateStrForAPI: q, dateStrForSchedule: q, calendarFilenameHint: q }
    }
    case 'Y': {
      const y = getNPYearStr(today)
      return { periodName: 'year', dateStrForAPI: y, dateStrForSchedule: y, calendarFilenameHint: y }
    }
    default:
      return null
  }
}

/**
 * Whether this paragraph lives in the calendar note for the given period.
 * @param {TParagraph} para
 * @param {TPeriodInfo} period
 * @returns {boolean}
 */
function isInNoteForPeriod(para: TParagraph, period: TPeriodInfo): boolean {
  const note = para.note ?? getNoteByFilename(para.filename ?? '')
  if (!note || note.type !== 'Calendar') return false
  const noteDateStr = getDateStringFromCalendarFilename(note.filename, true) || getDateStringFromCalendarFilename(note.filename, false) || note.title || ''
  return noteDateStr === period.dateStrForSchedule || noteDateStr === period.dateStrForAPI || (note.title || '') === period.dateStrForSchedule
}

/**
 * Whether content schedules this paragraph onto the given period (referenced path).
 * @param {TParagraph} para
 * @param {TPeriodInfo} period
 * @param {boolean} isTodaySection
 * @returns {boolean}
 */
function isReferencedToPeriod(para: TParagraph, period: TPeriodInfo, isTodaySection: boolean): boolean {
  const content = para.content || ''
  if (content.includes(`>${period.dateStrForSchedule}`)) return true
  if (isTodaySection && content.includes('>today')) return true
  return false
}

/**
 * Apply checklist settings to a single paragraph (mirrors filterByChecklistSettings).
 * @param {TParagraph} para
 * @param {TDashboardSettings} settings
 * @returns {{ pass: boolean, detail: string }}
 */
function checkChecklistSettings(para: TParagraph, settings: TDashboardSettings): { pass: boolean, detail: string } {
  if (settings.ignoreChecklistItems && para.type === 'checklist') {
    return { pass: false, detail: 'ignoreChecklistItems is on and type is checklist' }
  }
  return { pass: true, detail: `type=${para.type}` }
}

/**
 * Walk shared content filters used by most section generators.
 * @param {TParagraph} para
 * @param {TDashboardSettings} settings
 * @param {{ applyFolders: boolean, applyTeamspaces: boolean, applyCalendarSectionFilters: boolean }} opts
 * @returns {Array<TStepResult>}
 */
function explainSharedFilters(
  para: TParagraph,
  settings: TDashboardSettings,
  opts: {
    applyFolders: boolean,
    applyTeamspaces: boolean,
    applyCalendarSectionFilters: boolean,
    folderStyle?: 'referenced' | 'scan',
  },
): Array<TStepResult> {
  const steps: Array<TStepResult> = []
  const note = para.note ?? getNoteByFilename(para.filename ?? '')
  const startTime = new Date()

  if (opts.applyTeamspaces) {
    const allowedIDs = resolveAllowedTeamspaceIDs(settings)
    if (!note) {
      steps.push({ label: 'teamspace', pass: false, detail: 'could not resolve note for teamspace check' })
    } else {
      const ok = isNoteFromAllowedTeamspace(note, allowedIDs)
      steps.push({
        label: 'teamspace',
        pass: ok,
        detail: ok
          ? `allowed (includedTeamspaces=${JSON.stringify(allowedIDs)})`
          : `note not in allowed teamspaces ${JSON.stringify(allowedIDs)} (isTeamspace=${String(note.isTeamspaceNote)}, id=${note.teamspaceID || 'private'})`,
      })
    }
  }

  if (opts.applyFolders) {
    const folder = getFolderFromFilename(para.filename ?? note?.filename ?? '')
    // Calendar referenced path uses getCurrentlyAllowedFolders + isNoteFromAllowedFolder;
    // OVERDUE / PRIORITY / TAG use filterParasByRelevantFolders (getFoldersMatching).
    if (opts.folderStyle === 'referenced') {
      const allowedFolders = getCurrentlyAllowedFolders(settings)
      const ok = note ? isNoteFromAllowedFolder(note, allowedFolders, true) : false
      steps.push({
        label: 'folder',
        pass: ok,
        detail: ok
          ? `folder '${folder}' allowed via getCurrentlyAllowedFolders (included='${settings.includedFolders || ''}', excluded='${settings.excludedFolders || ''}')`
          : `folder '${folder}' not allowed via getCurrentlyAllowedFolders (included='${settings.includedFolders || ''}', excluded='${settings.excludedFolders || ''}')`,
      })
    } else {
      const before = [para]
      const after = filterParasByRelevantFolders(before, settings, startTime, LOG)
      const ok = after.length > 0
      steps.push({
        label: 'folder',
        pass: ok,
        detail: ok
          ? `folder '${folder}' allowed via filterParasByRelevantFolders (included='${settings.includedFolders || ''}', excluded='${settings.excludedFolders || ''}')`
          : `folder '${folder}' not in validFolders (included='${settings.includedFolders || ''}', excluded='${settings.excludedFolders || ''}')`,
      })
    }
  }

  if (settings.ignoreItemsWithTerms) {
    const before = [para]
    const after = filterParasByIgnoreTerms(before, settings, startTime, LOG)
    const disallowed = isLineDisallowedByIgnoreTerms(para.content, settings.ignoreItemsWithTerms)
    steps.push({
      label: 'ignoreItemsWithTerms',
      pass: after.length > 0 && !disallowed,
      detail: disallowed
        ? `matched ignore term(s) from '${settings.ignoreItemsWithTerms}'`
        : `no match in '${settings.ignoreItemsWithTerms}'`,
    })
  } else {
    steps.push({ label: 'ignoreItemsWithTerms', pass: true, detail: 'not set' })
  }

  if (opts.applyCalendarSectionFilters) {
    if (settings.includedCalendarSections) {
      const before = [para]
      const after = filterParasByIncludedCalendarSections(before, settings, startTime, LOG)
      const headings = getHeadingHierarchyForThisPara(para)
      steps.push({
        label: 'includedCalendarSections',
        pass: after.length > 0,
        detail: after.length > 0
          ? `matched includedCalendarSections='${settings.includedCalendarSections}' (headings=${JSON.stringify(headings)})`
          : `did not match includedCalendarSections='${settings.includedCalendarSections}' (headings=${JSON.stringify(headings)})`,
      })
    } else {
      steps.push({ label: 'includedCalendarSections', pass: true, detail: 'not set' })
    }

    if (settings.ignoreItemsWithTerms && settings.applyIgnoreTermsToCalendarHeadingSections) {
      const before = [para]
      const after = filterParasByExcludedCalendarSections(before, settings, startTime, LOG)
      steps.push({
        label: 'excludedCalendarHeadingTerms',
        pass: after.length > 0,
        detail: after.length > 0
          ? 'heading hierarchy OK'
          : `heading matched ignoreItemsWithTerms under applyIgnoreTermsToCalendarHeadingSections`,
      })
    } else {
      steps.push({ label: 'excludedCalendarHeadingTerms', pass: true, detail: 'not applied' })
    }
  }

  return steps
}

/**
 * First failing step label, or empty if all passed.
 * @param {Array<TStepResult>} steps
 * @returns {string}
 */
function firstFailLabel(steps: Array<TStepResult>): string {
  const fail = steps.find((s) => !s.pass)
  return fail ? fail.label : ''
}

/**
 * Explain calendar section (DT/DY/DO/LW/W/M/Q/Y) for one paragraph.
 * @param {TParagraph} para
 * @param {TSectionCode} sectionCode
 * @param {TDashboardSettings} settings
 * @returns {TSectionExplainResult}
 */
function explainCalendarSection(para: TParagraph, sectionCode: TSectionCode, settings: TDashboardSettings): TSectionExplainResult {
  const label = sectionLabelFor(sectionCode, settings)
  const period = getPeriodInfoForSection(sectionCode)
  if (!period) {
    return { sectionCode, sectionLabel: label, verdict: 'N/A', reason: 'unknown calendar section', steps: [] }
  }

  const NPSettings = getNotePlanSettings()
  const mustContainString = NPSettings.timeblockMustContainString
  const isTodaySection = sectionCode === 'DT'
  const inNote = isInNoteForPeriod(para, period)
  const asRef = isReferencedToPeriod(para, period, isTodaySection)
  const scheduledDates = findScheduledDates(para.content || '')

  const steps: Array<TStepResult> = []

  if (!inNote && !asRef) {
    steps.push({
      label: 'candidate path',
      pass: false,
      detail: `not in-note for ${period.dateStrForSchedule} and content not scheduled to it (schedules=${JSON.stringify(scheduledDates)})`,
    })
    return {
      sectionCode,
      sectionLabel: label,
      verdict: 'N/A',
      reason: `not a candidate for ${period.periodName} ${period.dateStrForSchedule}`,
      steps,
    }
  }

  const path = inNote ? 'in-note' : 'referenced'
  steps.push({
    label: 'candidate path',
    pass: true,
    detail: `${path} for ${period.periodName} ${period.dateStrForSchedule}`,
  })

  const openParas = filterToOpenParagraphs([para], false, mustContainString)
  steps.push({
    label: 'open',
    pass: openParas.length > 0,
    detail: openParas.length > 0 ? `isOpen type=${para.type}` : `not open (type=${para.type})`,
  })

  const checklist = checkChecklistSettings(para, settings)
  steps.push({ label: 'checklist settings', pass: checklist.pass, detail: checklist.detail })

  const blank = (para.content || '').trim() !== ''
  steps.push({ label: 'non-blank content', pass: blank, detail: blank ? 'OK' : 'empty content' })

  if (inNote) {
    const todayHyphenated = getTodaysDateHyphenated()
    const latestDate = todayHyphenated > period.dateStrForSchedule ? todayHyphenated : period.dateStrForSchedule
    const afterSched = filterBySchedulingRules([para], period.dateStrForAPI, latestDate)
    steps.push({
      label: 'scheduling rules',
      pass: afterSched.length > 0,
      detail: afterSched.length > 0
        ? `kept for calendar note ${period.dateStrForSchedule}`
        : `removed by scheduling rules (unscheduled / >${period.dateStrForSchedule} / >today / not future-scheduled)`,
    })
  }

  const shared = explainSharedFilters(para, settings, {
    applyFolders: asRef && !inNote,
    applyTeamspaces: asRef && !inNote,
    applyCalendarSectionFilters: true,
    folderStyle: 'referenced',
  })
  steps.push(...shared)

  const fail = firstFailLabel(steps)
  if (fail) {
    return { sectionCode, sectionLabel: label, verdict: 'EXCLUDE', reason: fail, steps }
  }
  return { sectionCode, sectionLabel: label, verdict: 'INCLUDE', reason: path, steps }
}

/**
 * Explain OVERDUE section for one paragraph.
 * @param {TParagraph} para
 * @param {TDashboardSettings} settings
 * @returns {TSectionExplainResult}
 */
function explainOverdueSection(para: TParagraph, settings: TDashboardSettings): TSectionExplainResult {
  const sectionCode: TSectionCode = 'OVERDUE'
  const label = sectionLabelFor(sectionCode, settings)
  const steps: Array<TStepResult> = []

  const open = isOpen(para)
  steps.push({ label: 'open', pass: open, detail: `type=${para.type}` })

  const datedOverdue = Boolean(hasOverdueTag(para, false))
  const effectiveOverdue = paragraphIsEffectivelyOverdue(para)
  const isOverdue = datedOverdue || effectiveOverdue
  steps.push({
    label: 'overdue eligibility',
    pass: isOverdue,
    detail: isOverdue
      ? `datedOverdue=${String(datedOverdue)}, effectivelyOverdue=${String(effectiveOverdue)} (schedules=${JSON.stringify(findScheduledDates(para.content || ''))})`
      : `not overdue (schedules=${JSON.stringify(findScheduledDates(para.content || ''))}; future dates keep item out of OVERDUE)`,
  })

  const checklist = checkChecklistSettings(para, settings)
  steps.push({ label: 'checklist settings', pass: checklist.pass, detail: checklist.detail })

  const shared = explainSharedFilters(para, settings, {
    applyFolders: true,
    applyTeamspaces: true,
    applyCalendarSectionFilters: true,
    folderStyle: 'scan',
  })
  steps.push(...shared)

  if (!Number.isNaN(settings.lookBackDaysForOverdue) && settings.lookBackDaysForOverdue > 0 && isOverdue) {
    const numDays = settings.lookBackDaysForOverdue
    const cutoffDate = moment().subtract(numDays, 'days').format('YYYY-MM-DD')
    const dueDateStr = getDueDateOrStartOfCalendarDate(para, true)
    const withinLookback = Boolean(dueDateStr && dueDateStr > cutoffDate)
    steps.push({
      label: 'lookBackDaysForOverdue',
      pass: withinLookback,
      detail: withinLookback
        ? `due/start '${dueDateStr}' is within last ${String(numDays)} days (cutoff ${cutoffDate})`
        : `due/start '${dueDateStr || '?'}' is outside lookBackDaysForOverdue=${String(numDays)} (cutoff ${cutoffDate})`,
    })
  }

  const fail = firstFailLabel(steps)
  if (fail) {
    return { sectionCode, sectionLabel: label, verdict: 'EXCLUDE', reason: fail, steps }
  }
  return { sectionCode, sectionLabel: label, verdict: 'INCLUDE', reason: 'overdue + filters passed', steps }
}

/**
 * Explain PRIORITY section for one paragraph.
 * @param {TParagraph} para
 * @param {TDashboardSettings} settings
 * @returns {TSectionExplainResult}
 */
function explainPrioritySection(para: TParagraph, settings: TDashboardSettings): TSectionExplainResult {
  const sectionCode: TSectionCode = 'PRIORITY'
  const label = sectionLabelFor(sectionCode, settings)
  const steps: Array<TStepResult> = []

  const openUnsched = isOpenNotScheduled(para)
  const schedules = findScheduledDates(para.content || '')
  steps.push({
    label: 'must be open and unscheduled',
    pass: openUnsched,
    detail: openUnsched
      ? 'OK (open, no >date)'
      : schedules.length > 0
        ? `has schedule ${JSON.stringify(schedules)} (PRIORITY only includes open items without a >date)`
        : `fails isOpenNotScheduled (type=${para.type})`,
  })

  const priority = getNumericPriorityFromPara(para)
  steps.push({
    label: 'raised priority',
    pass: priority > 0,
    detail: `numeric priority=${String(priority)} (need > 0)`,
  })

  const shared = explainSharedFilters(para, settings, {
    applyFolders: true,
    applyTeamspaces: false,
    applyCalendarSectionFilters: true,
    folderStyle: 'scan',
  })
  steps.push(...shared)

  const fail = firstFailLabel(steps)
  if (fail) {
    return { sectionCode, sectionLabel: label, verdict: 'EXCLUDE', reason: fail, steps }
  }
  return { sectionCode, sectionLabel: label, verdict: 'INCLUDE', reason: 'priority > 0 + filters passed', steps }
}

/**
 * Explain TAG section(s) for one paragraph against tagsToShow.
 * @param {TParagraph} para
 * @param {TDashboardSettings} settings
 * @returns {TSectionExplainResult}
 */
function explainTagSection(para: TParagraph, settings: TDashboardSettings): TSectionExplainResult {
  const sectionCode: TSectionCode = 'TAG'
  const label = sectionLabelFor(sectionCode, settings)
  const tags = stringListOrArrayToArray(settings.tagsToShow || '', ',').map((t) => t.trim()).filter(Boolean)
  const steps: Array<TStepResult> = []

  if (tags.length === 0) {
    return { sectionCode, sectionLabel: label, verdict: 'N/A', reason: 'tagsToShow empty', steps: [] }
  }

  const matchingTags = tags.filter((tag) => fullHashtagOrMentionMatch(tag, para.content || ''))
  steps.push({
    label: 'tag match',
    pass: matchingTags.length > 0,
    detail: matchingTags.length > 0
      ? `matches ${JSON.stringify(matchingTags)} of tagsToShow=${JSON.stringify(tags)}`
      : `no match for tagsToShow=${JSON.stringify(tags)}`,
  })

  const openOk = settings.ignoreChecklistItems ? isOpenTask(para) : isOpen(para)
  steps.push({
    label: 'open',
    pass: openOk && (para.content || '').trim() !== '',
    detail: `openOk=${String(openOk)} type=${para.type}`,
  })

  // Ignore terms with matching tags removed (same as dataGenerationTags)
  if (matchingTags.length > 0 && settings.ignoreItemsWithTerms) {
    const ignoreMinus = stringListOrArrayToArray(settings.ignoreItemsWithTerms, ',')
      .filter((t) => !matchingTags.includes(t))
      .join(',')
    const disallowed = ignoreMinus ? isLineDisallowedByIgnoreTerms(para.content, ignoreMinus) : false
    steps.push({
      label: 'ignoreItemsWithTerms (minus matching tag)',
      pass: !disallowed,
      detail: disallowed ? `matched '${ignoreMinus}'` : `OK (list='${ignoreMinus}')`,
    })
  }

  const shared = explainSharedFilters(para, settings, {
    applyFolders: true,
    applyTeamspaces: true,
    applyCalendarSectionFilters: false,
    folderStyle: 'scan',
  })
  steps.push(...shared)

  if (!settings.includeFutureTagMentions) {
    const dateToUseHyphenated = settings.showTomorrowSection
      ? moment().add(1, 'days').format('YYYY-MM-DD')
      : moment().format('YYYY-MM-DD')
    const future = includesScheduledFutureDate(para.content || '', dateToUseHyphenated)
    steps.push({
      label: 'includeFutureTagMentions',
      pass: !future,
      detail: future
        ? `scheduled in future vs ${dateToUseHyphenated} (includeFutureTagMentions off)`
        : `not future-scheduled vs ${dateToUseHyphenated}`,
    })
  } else {
    steps.push({ label: 'includeFutureTagMentions', pass: true, detail: 'on (future schedules allowed)' })
  }

  const fail = firstFailLabel(steps)
  if (fail) {
    return { sectionCode, sectionLabel: label, verdict: 'EXCLUDE', reason: fail, steps }
  }
  return { sectionCode, sectionLabel: label, verdict: 'INCLUDE', reason: `tag(s) ${JSON.stringify(matchingTags)}`, steps }
}

/**
 * Stub explainers for sections that do not use the open-task pipeline the same way.
 * @param {TSectionCode} sectionCode
 * @param {TDashboardSettings} settings
 * @param {TParagraph} para
 * @returns {TSectionExplainResult}
 */
function explainSpecialSection(sectionCode: TSectionCode, settings: TDashboardSettings, para: TParagraph): TSectionExplainResult {
  const label = sectionLabelFor(sectionCode, settings)
  switch (sectionCode) {
    case 'TB':
      return {
        sectionCode,
        sectionLabel: label,
        verdict: 'N/A',
        reason: 'Time Block / timed reminders use timeblock and reminder placement, not this open-task filter walk',
        steps: [{ label: 'path', pass: false, detail: `type=${para.type}; use TB section generation for timed items` }],
      }
    case 'REM':
      return {
        sectionCode,
        sectionLabel: label,
        verdict: 'N/A',
        reason: 'Reminders section is Apple Reminders, not note paragraphs',
        steps: [],
      }
    case 'PROJACT':
    case 'PROJREVIEW':
      return {
        sectionCode,
        sectionLabel: label,
        verdict: 'N/A',
        reason: 'Project sections list project notes, not individual task lines',
        steps: [],
      }
    case 'SEARCH':
      return {
        sectionCode,
        sectionLabel: label,
        verdict: 'N/A',
        reason: 'Search section is query-driven; run a Dashboard search to see matches',
        steps: [],
      }
    case 'WINS':
      return {
        sectionCode,
        sectionLabel: label,
        verdict: 'N/A',
        reason: 'Wins is a React-synthetic section from top-priority calendar items',
        steps: [],
      }
    case 'INFO':
      return { sectionCode, sectionLabel: label, verdict: 'N/A', reason: 'INFO is not an item list', steps: [] }
    default:
      return { sectionCode, sectionLabel: label, verdict: 'N/A', reason: 'no explainer for this section', steps: [] }
  }
}

/**
 * Explain one enabled section for the paragraph.
 * @param {TParagraph} para
 * @param {TSectionCode} sectionCode
 * @param {TDashboardSettings} settings
 * @returns {TSectionExplainResult}
 */
function explainSection(para: TParagraph, sectionCode: TSectionCode, settings: TDashboardSettings): TSectionExplainResult {
  if (['DT', 'DY', 'DO', 'LW', 'W', 'M', 'Q', 'Y'].includes(sectionCode)) {
    return explainCalendarSection(para, sectionCode, settings)
  }
  if (sectionCode === 'OVERDUE') return explainOverdueSection(para, settings)
  if (sectionCode === 'PRIORITY') return explainPrioritySection(para, settings)
  if (sectionCode === 'TAG') return explainTagSection(para, settings)
  return explainSpecialSection(sectionCode, settings, para)
}

/**
 * Resolve a note from a filename arg, tolerating an optional leading `Notes/` (MCP-style paths).
 * @param {string} filenameArg
 * @returns {?TNote}
 */
function resolveNoteFromFilenameArg(filenameArg: string): ?TNote {
  const candidates = [filenameArg]
  if (filenameArg.startsWith('Notes/')) {
    candidates.push(filenameArg.slice('Notes/'.length))
  } else if (!filenameArg.startsWith('/')) {
    candidates.push(`Notes/${filenameArg}`)
  }
  for (const candidate of candidates) {
    const note = getNoteByFilename(candidate)
    if (note) return note
  }
  // Fall back to title match when arg looks like a bare title
  if (!filenameArg.includes('/')) {
    const byTitle = DataStore.projectNoteByTitle(filenameArg, true, false)
    if (byTitle && byTitle.length > 0) return byTitle[0]
  }
  return null
}

/**
 * Resolve the paragraph to explain: optional filename+lineIndex args, else Editor selection.
 * @param {string=} filenameArg
 * @param {string=} lineIndexArg 0-based line index as string
 * @returns {Promise<?TParagraph>}
 */
async function resolveParagraphToExplain(filenameArg?: string, lineIndexArg?: string): Promise<?TParagraph> {
  if (filenameArg && filenameArg !== '' && lineIndexArg != null && lineIndexArg !== '') {
    const lineIndex = parseInt(lineIndexArg, 10)
    if (Number.isNaN(lineIndex)) {
      logWarn(LOG, `Invalid lineIndex arg '${lineIndexArg}'`)
      return null
    }
    const note = resolveNoteFromFilenameArg(filenameArg)
    if (!note) {
      logWarn(LOG, `Could not find note for filename '${filenameArg}'`)
      return null
    }
    const para = note.paragraphs.find((p) => p.lineIndex === lineIndex) ?? note.paragraphs[lineIndex]
    if (!para) {
      logWarn(LOG, `No paragraph at lineIndex ${String(lineIndex)} in '${note.filename}'`)
      return null
    }
    return para
  }

  const selected = getSelectedParagraphsToUse()
  if (!selected || selected.length === 0) {
    return null
  }
  if (selected.length > 1) {
    logInfo(LOG, `Selection has ${String(selected.length)} paragraphs; explaining the first only`)
  }
  return selected[0]
}

/**
 * Log React-side settings that can still hide an item after plugin generation.
 * @param {TDashboardSettings} settings
 * @returns {void}
 */
function logReactSideCaveats(settings: TDashboardSettings): void {
  logInfo(LOG, '--- React-side caveats (can still hide after generation) ---')
  logInfo(LOG, `  ignoreChecklistItems=${String(settings.ignoreChecklistItems)}`)
  logInfo(LOG, `  filterPriorityItems=${String(settings.filterPriorityItems)}`)
  logInfo(LOG, `  maxItemsToShowInSection=${String(settings.maxItemsToShowInSection)}`)
  logInfo(LOG, `  hideDuplicates=${String(settings.hideDuplicates)}`)
  logInfo(LOG, `  showWinsSection=${String(settings.showWinsSection)} treatTopPriorityAsWins=${String(settings.treatTopPriorityAsWins)} winsPriorityMarker=${String(settings.winsPriorityMarker)}`)
}

/**
 * Walk Dashboard selection/filter decisions for the current (or given) line across each enabled section.
 * Writes a detailed PASS/FAIL log to the Plugin Console and a short showMessage summary.
 * Optional args support x-callback testing without relying on Editor selection:
 *   noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=Explain%20selected%20item%20filters&arg0=<filename>&arg1=<lineIndex>
 * @param {string=} filenameArg optional note filename
 * @param {string=} lineIndexArg optional 0-based paragraph lineIndex
 * @returns {Promise<void>}
 */
export async function explainSelectedItemFilters(filenameArg?: string, lineIndexArg?: string): Promise<void> {
  try {
    const para = await resolveParagraphToExplain(filenameArg, lineIndexArg)
    if (!para) {
      const msg = 'No paragraph to explain. Select a line in the Editor, or pass filename + lineIndex args.'
      logWarn(LOG, msg)
      if (filenameArg && filenameArg !== '') {
        await sendBannerMessage(WEBVIEW_WINDOW_ID, msg, 'WARN', 8000)
      } else {
        await showMessage(msg, 'OK', 'Explain selected item filters')
      }
      return
    }

    const settings: TDashboardSettings = await getDashboardSettings()
    const perspectiveDefs = await loadPerspectiveDefsFromPluginSettings(false)
    const activePerspectiveName = getActivePerspectiveName(perspectiveDefs)
    const enabledSections = getListOfEnabledSections(settings)
    const note = para.note ?? getNoteByFilename(para.filename ?? '')
    const folder = getFolderFromFilename(para.filename ?? note?.filename ?? '')
    const scheduledDates = findScheduledDates(para.content || '')

    logInfo(LOG, '========== Explain selected item filters ==========')
    logInfo(LOG, `Perspective: ${activePerspectiveName}`)
    logInfo(LOG, `Enabled sections: ${enabledSections.join(', ')}`)
    logInfo(LOG, `Item: ${para.filename || note?.filename || '?'} #${String(para.lineIndex)} type=${para.type} folder='${folder}'`)
    logInfo(LOG, `Content: ${para.content}`)
    logInfo(LOG, `Schedules: ${JSON.stringify(scheduledDates)}; priority=${String(getNumericPriorityFromPara(para))}`)
    logInfo(LOG, `Folders: included='${settings.includedFolders || ''}' excluded='${settings.excludedFolders || ''}'`)
    logInfo(LOG, `ignoreItemsWithTerms='${settings.ignoreItemsWithTerms || ''}' includedCalendarSections='${settings.includedCalendarSections || ''}'`)
    clo(
      {
        includedFolders: settings.includedFolders,
        excludedFolders: settings.excludedFolders,
        ignoreItemsWithTerms: settings.ignoreItemsWithTerms,
        includedCalendarSections: settings.includedCalendarSections,
        includedTeamspaces: settings.includedTeamspaces,
        tagsToShow: settings.tagsToShow,
        filterPriorityItems: settings.filterPriorityItems,
        hideDuplicates: settings.hideDuplicates,
        maxItemsToShowInSection: settings.maxItemsToShowInSection,
      },
      `${LOG} key settings`,
    )

    const results: Array<TSectionExplainResult> = []
    for (const sectionCode of enabledSections) {
      logInfo(LOG, `--- ${sectionLabelFor(sectionCode, settings)} ---`)
      const result = explainSection(para, sectionCode, settings)
      result.steps.forEach(logStep)
      logInfo(LOG, `  VERDICT: ${result.verdict}${result.reason ? ` (${result.reason})` : ''}`)
      results.push(result)
    }

    logReactSideCaveats(settings)

    const includeList = results.filter((r) => r.verdict === 'INCLUDE').map((r) => r.sectionCode)
    const excludeList = results.filter((r) => r.verdict === 'EXCLUDE').map((r) => `${r.sectionCode}(${r.reason})`)
    const naList = results.filter((r) => r.verdict === 'N/A').map((r) => `${r.sectionCode}(${r.reason})`)

    logInfo(LOG, '========== SUMMARY ==========')
    logInfo(LOG, `Would INCLUDE in: ${includeList.length ? includeList.join(', ') : 'none'}`)
    logInfo(LOG, `EXCLUDE: ${excludeList.length ? excludeList.join(', ') : 'none'}`)
    logInfo(LOG, `N/A: ${naList.length ? naList.join(', ') : 'none'}`)
    logInfo(LOG, '===============================================')

    const summaryLines = [
      `Perspective: ${activePerspectiveName}`,
      `Line #${String(para.lineIndex)}: ${para.content.slice(0, 80)}`,
      `INCLUDE: ${includeList.length ? includeList.join(', ') : 'none'}`,
      `EXCLUDE: ${excludeList.length ? excludeList.join(', ') : 'none'}`,
      '(Full step log in Plugin Console)',
    ]
    const summary = summaryLines.join('\n')
    // Interactive (Editor selection): modal. x-callback with filename args: banner only so automation is not blocked.
    if (filenameArg && filenameArg !== '') {
      await sendBannerMessage(WEBVIEW_WINDOW_ID, summary.replace(/\n/g, ' | '), 'INFO', 12000)
    } else {
      await showMessage(summary, 'OK', 'Explain selected item filters')
    }
  } catch (error) {
    logError(LOG, error.message)
    if (filenameArg && filenameArg !== '') {
      await sendBannerMessage(WEBVIEW_WINDOW_ID, `Explain selected item filters error: ${error.message}`, 'ERROR', 8000)
    } else {
      await showMessage(`Error: ${error.message}`, 'OK', 'Explain selected item filters')
    }
  }
}
