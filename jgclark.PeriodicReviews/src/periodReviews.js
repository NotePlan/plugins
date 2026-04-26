// @flow
//---------------------------------------------------------------
// Journalling commands
// Jonathan Clark
// last update 2026-04-26 for v2.0.0.b12 by @jgclark + @Cursor
//---------------------------------------------------------------

import strftime from 'strftime'
import pluginJson from '../plugin.json'
import {
  buildNextPeriodNotePlanSectionHeadingTitle,
  formatPlannedItemLineForNextNote,
  getEffectivePlannedItemAffixes,
  getJournalSettings,
  getPeriodAdjectiveFromType,
  getPlanItemsNameForPeriodType,
  getQuestionsForPeriod,
  getSectionHeadingForPeriod,
  normalizePlanningTaskLinesFromForm,
  normalizeReviewPeriodTitleForNPDateHelpers,
  summaryTaskLineDedupeKey,
  taskContentIsSummaryWin,
} from './periodicReviewHelpers'
export { taskContentIsSummaryWin }
import type { PeriodicReviewConfigType, ParsedQuestionType } from './periodicReviewHelpers'
import {
  buildInitialReviewAnswersByFieldName,
  buildOutputFromReviewWindowAnswers,
  getBooleanClearDirectivesFromAnswers,
  getTemplateLineUpsertKeyFromOutputLine,
  parseQuestions,
} from './reviewQuestions'
import { stylesheetinksInHeader, faLinksInHeader, buildReviewHTML } from './reviewHTMLViewGenerator'
import {
  // convertISOToYYYYMMDD,
  getNextNPPeriodString,
  getNPQuarterStr,
  getPreviousNPPeriodString,
  getWeek,
  getPeriodOfNPDateStr,
  RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE,
} from '@helpers/dateTime'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { showHTMLV2 } from '@helpers/HTMLView'
import type { HtmlWindowOptions } from '@helpers/HTMLView'
import { getEventsForDay } from '@helpers/NPCalendar'
import { getFirstDateInPeriod, getLastDateInPeriod } from '@helpers/NPdateTime'
import { getNotesChangedInInterval } from '@helpers/NPnote'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import { closeWindowFromCustomId } from '@helpers/NPWindows'
import { isParaAMatchForHeading } from '@helpers/headings'
import { findEndOfActivePartOfNote, findHeading, findHeadingStartsWith, findStartOfActivePartOfNote } from '@helpers/paragraph'
import { escapeRegExp } from '@helpers/regex'
import { getNumericPriorityFromPara } from '@helpers/sorting'
import { getInput, showMessage } from '@helpers/userInput'

//---------------------------------------------------------------
// Constants & Types

const REVIEW_WINDOW_CUSTOM_ID = 'jgclark.PeriodicReviews.period-review'
const REVIEW_WINDOW_CALLBACK_COMMAND = 'onReviewWindowAction'

/** Paragraph types treated as tasks under a plan H2 (carry-over + rewrite). Includes cancelled so >> plan lines stay in the summary as not done. */
const PLAN_SECTION_PARA_TYPES: Set<string> = new Set([
  'open',
  'done',
  'scheduled',
  'cancelled',
  'checklist',
  'checklistDone',
  'checklistCancelled',
  'checklistScheduled',
  'list'
])

/**
 * Find first matching H2 in the active part of the note.
 * @param {TNote} note
 * @param {string} headingTitle
 * @returns {TParagraph | null}
 */
function findPlanSectionHeadingPara(note: TNote, headingTitle: string): TParagraph | null {
  logDebug('findPlanSectionHeadingPara', `Looking for heading {${headingTitle}} ...`)
  const paras = note.paragraphs ?? []
  const last = Math.min(findEndOfActivePartOfNote(note), paras.length - 1)
  for (let i = 0; i <= last; i++) {
    const p = paras[i]
    if (p.type === 'title' && isParaAMatchForHeading(p, headingTitle, 2)) {
      logDebug('', `- found line ${String(i)}: {${p.rawContent}} `)
      return p
    }
  }
  return null
}

/**
 * Heading plus body paragraphs until the next H1/H2-style break (level &lt;= 2), for removal.
 * @param {TNote} note
 * @param {TParagraph} headingPara
 * @returns {Array<TParagraph>}
 */
function getParagraphsForPlanSection(note: TNote, headingPara: TParagraph): Array<TParagraph> {
  const toRemove: Array<TParagraph> = [headingPara]
  const paras = note.paragraphs ?? []
  const start = headingPara.lineIndex ?? 0
  for (let i = start + 1; i < paras.length; i++) {
    const p = paras[i]
    if (p.type === 'title' && (p.headingLevel ?? 99) <= 2) {
      break
    }
    toRemove.push(p)
  }
  return toRemove
}

/**
 * Remove a plan H2 block (heading + body) if present.
 * TODO: Probably can be simplified?
 * @param {TNote} note
 * @param {string} headingTitle
 * @returns {void}
 */
function removePlanSectionFromNoteIfPresent(note: TNote, headingTitle: string): void {
  const headingPara = findPlanSectionHeadingPara(note, headingTitle)
  if (headingPara == null) {
    return
  }
  const toRemove = getParagraphsForPlanSection(note, headingPara)
  const sorted = [...toRemove].sort((a, b) => (b.lineIndex ?? 0) - (a.lineIndex ?? 0))
  for (const p of sorted) {
    note.removeParagraph(p)
  }
}

/**
 * Insert plan heading and open tasks at the start of the active body.
 * Uses `insertParagraph(..., 'open')`, which adds the task `*` marker — pass full line text (prefix/suffix already applied), not a second task marker.
 * @param {TNote} note
 * @param {string} headingTitle
 * @param {Array<string>} taskLines full paragraph content (not rawContent) per planned item (after prefix/suffix formatting)
 * @returns {void}
 */
function insertPlanSectionAtActiveStart(note: TNote, headingTitle: string, taskLines: Array<string>): void {
  const startIdx = findStartOfActivePartOfNote(note)
  if (Number.isNaN(startIdx)) {
    logWarn(pluginJson, 'insertPlanSectionAtActiveStart: invalid start index')
    return
  }
  note.insertHeading(headingTitle, startIdx, 2)
  for (let i = 0; i < taskLines.length; i++) {
    note.insertParagraph(taskLines[i], startIdx + 1 + i, 'open')
  }
}

/**
 * Calendar note whose title equals `title` (trimmed), if any.
 * @param {string} title
 * @returns {TNote | null}
 */
function getCalendarNoteByTitle(title: string): TNote | null {
  const want = String(title).trim()
  const notes = DataStore.calendarNotes ?? []
  for (const n of notes) {
    if (String(n.title ?? '').trim() === want) {
      return n
    }
  }
  return null
}

/**
 * Return task lines for the review summary from:
 * - the configured 'planName' section (if given)
 * - any with priority '>>' (if 'planName' is empty, or can't find the 'planName' section)
 * Note: The heading match is partial + case insensitive.
 * @tests in jest file
 * @param {TNote} note
 * @param {string} planName (e.g. 'Big Rocks', or empty)
 * @returns {Array<{ content: string, isDone: boolean }>}
 */
export function extractPlanSectionItems(
  note: TNote,
  planName: string = ''
): Array<{ content: string, isDone: boolean }> {
  const paras = note.paragraphs ?? []
  let start = findStartOfActivePartOfNote(note)
  const end = findEndOfActivePartOfNote(note)
  const out: Array<{ content: string, isDone: boolean }> = []

  // Get relevant set of paras to parse
  if (planName !== '') {
    const headingPara = findHeading(note, planName, true)
    if (headingPara != null) {
      const heading = headingPara.content
      logDebug('extractPlanSectionItems', `- matched heading '${heading}'`)
      start = headingPara.lineIndex ?? 0
      logDebug('extractPlanSectionItems', `Found heading ${heading}, so processing lines ${String(start + 1)}-${String(end)}`)
      for (let i = start + 1; i <= end; i++) {
        const p = paras[i]
        if (p.type === 'title' && (p.headingLevel ?? 99) <= 2) {
          // We're now in a different section, so stop processing
          break
        }
        if (!PLAN_SECTION_PARA_TYPES.has(String(p.type))) {
          continue
        }
        const isDone = p.type === 'done' || p.type === 'checklistDone'
        out.push({ content: p.content, isDone })
      }
      return out
    } else {
      logDebug('extractPlanSectionItems', `Can't find a heading including '${planName}', so will now look for any other >> items`)
    }
  }

  logDebug('extractPlanSectionItems', `Will look for >> tasks in lines ${String(start+1)}-${String(end)}`)
  for (let i = start + 1; i <= end; i++) {
    const p = paras[i]
    if (!PLAN_SECTION_PARA_TYPES.has(String(p.type))) {
      continue
    }
    if (getNumericPriorityFromPara(p) !== 4) {
      // i.e. if not '>>' priority
      continue
    }
    const isDone = p.type === 'done' || p.type === 'checklistDone'
    out.push({ content: p.content, isDone })
  }
  return out
}

/**
 * Write or clear planned tasks on the **next** calendar note: replace existing H2 with same title, insert at active start.
 * @param {PeriodicReviewConfigType} config
 * @param {string} periodString
 * @param {string} periodType
 * @param {string} planningFormText
 * @returns {Promise<void>}
 */
export async function writePlanningTasksToNextPeriodNote(
  config: PeriodicReviewConfigType,
  periodString: string,
  periodType: string,
  planningFormText: string,
): Promise<void> {
  try {
    const nextTitle = getNextNPPeriodString(periodString, periodType)
    if (nextTitle === '') {
      logWarn(pluginJson, `writePlanningTasksToNextPeriodNote: empty next period for "${periodString}" (${periodType})`)
      return
    }
    const planName = getPlanItemsNameForPeriodType(config, periodType)
    const headingTitle = buildNextPeriodNotePlanSectionHeadingTitle(planName, nextTitle)
    logDebug('writePlanningTasksToNextPeriodNote', `planName='${planName}' headingTitle='${headingTitle}' / nextTitle='${nextTitle}'`)
    let nextNote: ?TNote = getCalendarNoteByTitle(nextTitle)
    if (!nextNote) {
      logDebug('writePlanningTasksToNextPeriodNote', `Note '${nextTitle}' not found, so opening it`)
      await Editor.openNoteByTitle(nextTitle)
      nextNote = getCalendarNoteByTitle(nextTitle) ?? Editor.note
    }
    if (!nextNote) {
      logError(pluginJson, `writePlanningTasksToNextPeriodNote: could not open calendar note '${nextTitle}'`)
      return
    }

    logDebug('writePlanningTasksToNextPeriodNote', `Note '${nextTitle}' opened; will now write (or replace) plan section heading '${headingTitle}'`)
    const normalizedLines = normalizePlanningTaskLinesFromForm(planningFormText)
    const { prefix: plannedPrefix, suffix: plannedSuffix } = getEffectivePlannedItemAffixes(config)
    const formattedLines = normalizedLines.map((body) => formatPlannedItemLineForNextNote(body, plannedPrefix, plannedSuffix))
    removePlanSectionFromNoteIfPresent(nextNote, headingTitle)
    if (formattedLines.length > 0) {
      insertPlanSectionAtActiveStart(nextNote, headingTitle, formattedLines)
    }
    DataStore.updateCache(nextNote, true)
  } catch (err) {
    logError(pluginJson, `writePlanningTasksToNextPeriodNote: ${err.message}`)
  }
}

//---------------------------------------------------------------

/**
 * Shared entry for period review commands: resolve calendar title string, then open the review flow.
 * @param {string} periodType
 * @param {() => string} getPeriodString
 * @returns {Promise<void>}
 */
async function runReviewQuestionsForCurrentPeriod(periodType: string, getPeriodString: () => string): Promise<void> {
  try {
    const thisPeriodStr = getPeriodString()
    logDebug(pluginJson, `Starting for ${periodType} (currently ${thisPeriodStr})`)
    await processReviewQuestions(thisPeriodStr, periodType, { preferOpenNoteOfMatchingPeriodType: true })
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

/**
 * Gather answers to daily journal questions, and inserts at the cursor.
 */
export async function dailyReviewQuestions(): Promise<void> {
  await runReviewQuestionsForCurrentPeriod('day', () => strftime('%Y-%m-%d'))
}

/**
 * Gather answers to weekly journal questions, and inserts at the cursor.
 */
export async function weeklyReviewQuestions(): Promise<void> {
  await runReviewQuestionsForCurrentPeriod('week', () => {
    const currentWeekNum = getWeek(new Date())
    return `${strftime('%Y')}-W${currentWeekNum}`
  })
}

/**
 * Gather answers to monthly journal questions, and inserts at the cursor.
 */
export async function monthlyReviewQuestions(): Promise<void> {
  await runReviewQuestionsForCurrentPeriod('month', () => strftime('%Y-%m'))
}

/**
 * Gather answers to quarterly journal questions, and inserts at the cursor.
 */
export async function quarterlyReviewQuestions(): Promise<void> {
  await runReviewQuestionsForCurrentPeriod('quarter', () => getNPQuarterStr(new Date()))
}

/**
 * Gather answers to yearly journal questions, and inserts at the cursor.
 */
export async function yearlyReviewQuestions(): Promise<void> {
  await runReviewQuestionsForCurrentPeriod('year', () => strftime('%Y'))
}

//---------------------------------------------------------
// Main review function, called by the plugin.json commands
//---------------------------------------------------------

/**
 * Process questions for the given period, and write to the current note.
 * If we're not in the correct note, offer to open it first.
 * @author @jgclark
 * @param {string} periodStringIn the calendar note title string for the review period
 * @param {string} periodType for journal questions: 'day', 'week', 'month', 'quarter', 'year'
 * @param {{ preferOpenNoteOfMatchingPeriodType?: boolean }} options when `preferOpenNoteOfMatchingPeriodType` is true (commands that target the “current” period), keep the editor focused if it already has any calendar note of that period type (e.g. do not switch a daily note from yesterday to today). When false or omitted, the open note is only reused if its title matches `periodStringIn` (needed for refresh / prev-next navigation).
 */
async function processReviewQuestions(
  periodStringIn: string = '',
  periodType: string,
  options?: {| preferOpenNoteOfMatchingPeriodType?: boolean |},
): Promise<void> {
  try {
    const periodAdjective = getPeriodAdjectiveFromType(periodType)
    const preferOpenSameKind = options?.preferOpenNoteOfMatchingPeriodType === true
    // Get configuration
    const config: PeriodicReviewConfigType = await getJournalSettings()
    let reviewNote: ?TNote = null

    // Reuse the editor note when it is a calendar note of the requested period *kind* (day/week/…).
    // For refresh / navigatePeriod we require an exact title match so we actually move to the requested period.
    const { note: openEditorNote } = Editor
    const wantTitle = String(periodStringIn).trim()
    const openTitle = String(openEditorNote?.title ?? '').trim()
    const titlesMatch =
      normalizeReviewPeriodTitleForNPDateHelpers(openTitle) === normalizeReviewPeriodTitleForNPDateHelpers(wantTitle)
    const openPeriodKind = openTitle !== '' ? getPeriodOfNPDateStr(openTitle) : '(error)'
    const editorHasMatchingPeriodType = openEditorNote != null && openPeriodKind === periodType
    const useOpenNote = editorHasMatchingPeriodType && (preferOpenSameKind || titlesMatch)
    // TODO: Check for Teamspace stuff here
    if (useOpenNote) {
      reviewNote = openEditorNote
      logDebug(
        'processReviewQuestions',
        `Starting with open note '${String(reviewNote?.title ?? 'unknown')}' of period '${String(getPeriodOfNPDateStr(reviewNote?.title ?? ''))}'` +
          (preferOpenSameKind && !titlesMatch ? ` (keeping editor instead of '${String(periodStringIn)}')` : ''),
      )
    } else {
      // use the passed periodStringIn to open the correct note
      logDebug('processReviewQuestions', `Starting by opening current ${periodAdjective} note '${String(periodStringIn)}'`)
      reviewNote = await Editor.openNoteByTitle(periodStringIn)
    }
    if (!reviewNote) {
      // Warn user and stop.
      await showMessage(`Cannot open ${periodStringIn} note, so cannot continue. Please open the correct note first.`)
      throw new Error(`Cannot open ${periodStringIn} note, so cannot continue.`)
    }
    
    const titleFromNote = reviewNote.title != null ? String(reviewNote.title).trim() : ''
    const periodString = titleFromNote !== '' ? titleFromNote : periodStringIn !== '' ? periodStringIn : ''
    logDebug('processReviewQuestions', `- Will use review note '${String(periodString)}' of period '${String(getPeriodOfNPDateStr(periodString))}'`)

    // Get questions and parse them
    const questionLines = await getQuestionsForPeriod(config, periodType)
    const numQs = questionLines.length
    if (!questionLines || numQs === 0 || questionLines[0] === '') {
      await showMessage(`No questions for ${periodType} found in the plugin settings, so cannot continue.`)
      throw new Error(`No questions for ${periodType} found in the plugin settings, so cannot continue.`)
    }
    logDebug(pluginJson, `Found ${numQs} question lines for ${periodType}`)
    // Parse questions (may result in multiple questions per line if '||' is used)
    const parsedQuestions = parseQuestions(questionLines)

    await displayQuestionsWindow(parsedQuestions, periodString, periodType, config, questionLines, reviewNote)

    // Write answers to note
    // Answers are applied in onReviewWindowAction when the user saves the HTML form.
  } catch (err) {
    if (err === 'cancelled') {
      logDebug(pluginJson, `Asking questions cancelled by user: stopping.`)
    } else {
      logDebug(pluginJson, err.message)
    }
  }
}

//-------------------------------------------------------------
// Private functions
//-------------------------------------------------------------

/**
 * Paragraph text lines to scan for existing review answers: active part of the note (from start through end of active region).
 * @param {TNote} note
 * @returns {Array<string>}
 */
function getParagraphLineContentsForReviewScan(note: TNote): Array<string> {
  const endOfActiveLineIndex = findEndOfActivePartOfNote(note)
  const paragraphTextLines = note.paragraphs.slice(0, endOfActiveLineIndex).map((p) => p.content) ?? []
  return paragraphTextLines
}

/**
 * Collect done task lines for the review summary: wins (#win / #bigwin / `>>`) vs other completed tasks.
 * The HTML view merges them into one list (wins first; each line once).
 * - day: wins and completed are split (completed excludes win lines).
 * - week/month/quarter/year: only wins are returned; `completed` is empty.
 * @param {string} periodType
 * @param {string} periodString
 * @returns {{ wins: Array<string>, completed: Array<string> }}
 */
function getDoneTasksForSummary(periodType: string, periodString: string): {| wins: Array < string >, completed: Array < string > |} {
  try {
    const npPeriodKey = normalizeReviewPeriodTitleForNPDateHelpers(periodString)
    const startISO = getFirstDateInPeriod(npPeriodKey)
    const endISO = getLastDateInPeriod(npPeriodKey)
    if (startISO === '(error)' || endISO === '(error)') {
      logWarn('getDoneTasksForSummary', `Could not parse period "${periodString}"`)
      return { wins: [], completed: [] }
    }
    const periodStartMs = new Date(`${startISO}T12:00:00`).getTime()
    const lookbackDaysRaw = Math.ceil((Date.now() - periodStartMs) / 86400000) + 1
    const lookbackDays = Math.min(Math.max(0, lookbackDaysRaw), 400)
    const isDailyPeriod = periodType === 'day'
    const notesToScan = getNotesChangedInInterval(lookbackDays, ['Calendar', 'Notes'])
    const wins: Array<string> = []
    const completed: Array<string> = []
    /** Same task line can appear on multiple notes (or with different surrounding whitespace); show each logical line once. */
    const seenKeys = new Set < string > ()

    for (const note of notesToScan) {
      for (const para of note.paragraphs) {
        if (para.type !== 'done') {
          continue
        }
        const doneDateMatch = para.content.match(RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE)
        const doneDate = doneDateMatch?.[1] ?? ''
        if (doneDate === '') {
          continue
        }
        const isInPeriod = doneDate >= startISO && doneDate <= endISO
        if (!isInPeriod) {
          continue
        }
        const dedupeKey = summaryTaskLineDedupeKey(para.content)
        if (dedupeKey === '' || seenKeys.has(dedupeKey)) {
          continue
        }
        seenKeys.add(dedupeKey)
        const isWin = taskContentIsSummaryWin(para.content)
        if (!isDailyPeriod) {
          if (isWin) {
            wins.push(para.content)
          }
          continue
        }
        if (isWin) {
          wins.push(para.content)
        } else {
          completed.push(para.content)
        }
      }
    }

    return { wins, completed }
  } catch (error) {
    logError('getDoneTasksForSummary', error.message)
  }
}

/**
 * Display all questions in the window.
 * Note: does not return the answers -- see separate function for that.
 * @param {Array<ParsedQuestionType>} parsedQuestions
 * @param {string} periodString
 * @param {string} periodType
 * @param {PeriodicReviewConfigType} config
 * @param {Array<string>} rawQuestionLines lines from getQuestionsForPeriod (same array passed to parseQuestions)
 * @param {TNote} calendarNote the calendar note to scan for answers
 * @returns {void}
 */
async function displayQuestionsWindow(
  parsedQuestions: Array<ParsedQuestionType>,
  periodString: string,
  periodType: string,
  config: PeriodicReviewConfigType,
  rawQuestionLines: Array<string>,
  calendarNote: TNote,
): Promise<void> {
  const periodAdjective = getPeriodAdjectiveFromType(periodType)
  // Get the data sources we need for the review window
  const { wins: summaryWinTasks, completed: summaryCompletedTasks } = getDoneTasksForSummary(periodType, periodString)
  const calendarSet: Array<string> = config.calendarSet ?? []
  // logDebug(pluginJson, `calendarSet: [${String(calendarSet)}]`)
  const eventsForPeriod: Array<TCalendarItem> = (periodType === 'day') ? await getEventsForDay(periodString, calendarSet) ?? [] : []
  const scanLines = getParagraphLineContentsForReviewScan(calendarNote)
  const initialAnswers = buildInitialReviewAnswersByFieldName(parsedQuestions, scanLines)
  const planName = getPlanItemsNameForPeriodType(config, periodType)
  const carryOverPlanItems = extractPlanSectionItems(calendarNote) // TEST: trying without sending planName parameter

  // Build the HTML body for the review window from this data
  const htmlBody = buildReviewHTML(
    config,
    parsedQuestions,
    rawQuestionLines,
    summaryWinTasks,
    summaryCompletedTasks,
    periodString,
    periodType,
    eventsForPeriod,
    REVIEW_WINDOW_CALLBACK_COMMAND,
    planName,
    initialAnswers,
    carryOverPlanItems,
  )

  // Set the options and then open the review window
  const preferredWindowType = config.preferredWindowType ?? 'New Window'
  const windowOptions: HtmlWindowOptions = {
    customId: REVIEW_WINDOW_CUSTOM_ID,
    windowTitle: `${periodAdjective} Review`,
    headerTags: `${faLinksInHeader}${stylesheetinksInHeader}`,
    savedFilename: `../../jgclark.PeriodicReviews/period-review-${periodType}.html`,
    showInMainWindow: preferredWindowType !== 'New Window',
    splitView: preferredWindowType === 'Split View',
    showReloadButton: true,
    reloadPluginID: pluginJson['plugin.id'],
    reloadCommandName: REVIEW_WINDOW_CALLBACK_COMMAND,
    icon: 'clipboard-list',
    iconColor: 'blue-600',
    autoTopPadding: true,
    makeModal: false,
    reuseUsersWindowRect: true,
    width: 600,
    height: 700,
    shouldFocus: true,
    generalCSSIn: generateCSSFromTheme(''),
  }
  const openSuccess = await showHTMLV2(htmlBody, windowOptions)
  if (!openSuccess) {
    throw new Error('Unable to open single-window review form')
  }

  // That's it. The answers will be written to the note by the callback function.
}

/**
 * Determine which answer lines should update existing lines in a review section, and which should append.
 * @tests in jest file
 * @param {Array<TParagraph>} paragraphs
 * @param {string} sectionHeading
 * @param {Array<string>} rawAnswerLines
 * @param {Array<ParsedQuestionType>} parsedQuestions
 * @param {Array<{ lineKey: string, tokensToClear: Array<string> }>} booleanClearDirectives
 * @returns {{ updates: Array<{ para: TParagraph, content: string }>, appendLines: Array<string> }}
 */
export function partitionReviewAnswerLinesForMixedUpsert(
  paragraphs: Array<TParagraph>,
  sectionHeading: string,
  rawAnswerLines: Array<string>,
  parsedQuestions: Array<ParsedQuestionType>,
  booleanClearDirectives: Array<{| lineKey: string, tokensToClear: Array<string> |}> = [],
): {| updates: Array<{| para: TParagraph, content: string |}>, appendLines: Array<string> |} {
  const normalize = (input: string): string => String(input ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  const headingLC = normalize(sectionHeading)
  const sectionHeadingPara = paragraphs.find((p) => p.type === 'title' && normalize(String(p.content ?? '')).startsWith(headingLC))
  const headingLineIndex = sectionHeadingPara?.lineIndex ?? -1
  const sectionEndLineIndex = headingLineIndex >= 0
    ? paragraphs.find((p) => p.type === 'title' && (p.headingLevel ?? 99) <= 2 && (p.lineIndex ?? -1) > headingLineIndex)?.lineIndex ?? paragraphs.length
    : -1
  const updates: Array<{| para: TParagraph, content: string |}> = []
  const appendLines: Array<string> = []
  const usedLineIndexes: Set<number> = new Set()
  for (const answerLine of rawAnswerLines) {
    const trimmedLine = String(answerLine ?? '').trim()
    if (trimmedLine === '') {
      continue
    }
    const lineMatchKey = getTemplateLineUpsertKeyFromOutputLine(trimmedLine, parsedQuestions)
    if (lineMatchKey === '' || headingLineIndex < 0) {
      appendLines.push(answerLine)
      continue
    }
    const paraToUpdate = paragraphs.find((p) => {
      const lineIndex = p.lineIndex ?? -1
      if (usedLineIndexes.has(lineIndex)) {
        return false
      }
      if (lineIndex <= headingLineIndex || lineIndex >= sectionEndLineIndex || p.type === 'title') {
        return false
      }
      return normalize(String(p.content ?? '')).startsWith(lineMatchKey)
    })
    if (paraToUpdate) {
      usedLineIndexes.add(paraToUpdate.lineIndex ?? -1)
      updates.push({ para: paraToUpdate, content: answerLine })
    } else {
      appendLines.push(answerLine)
    }
  }
  for (const directive of booleanClearDirectives) {
    const lineKeyNormalized = normalize(directive.lineKey)
    if (lineKeyNormalized === '' || headingLineIndex < 0 || directive.tokensToClear.length === 0) {
      continue
    }
    let updateEntry = updates.find((u) => normalize(String(u.content ?? '')).startsWith(lineKeyNormalized))
    if (updateEntry == null) {
      const paraToUpdate = paragraphs.find((p) => {
        const lineIndex = p.lineIndex ?? -1
        if (lineIndex <= headingLineIndex || lineIndex >= sectionEndLineIndex || p.type === 'title') {
          return false
        }
        return normalize(String(p.content ?? '')).startsWith(lineKeyNormalized)
      })
      if (paraToUpdate == null) {
        continue
      }
      updateEntry = { para: paraToUpdate, content: String(paraToUpdate.content ?? '') }
      updates.push(updateEntry)
    }
    let nextContent = String(updateEntry.content ?? '')
    for (const token of directive.tokensToClear) {
      const tokenRE = new RegExp(`(?:^|\\s)${escapeRegExp(token)}(?=\\s|$)`, 'g')
      nextContent = nextContent.replace(tokenRE, ' ')
    }
    nextContent = nextContent.replace(/\s+/g, ' ').trim()
    updateEntry.content = nextContent
  }
  return { updates, appendLines }
}

/**
 * Write the collected answers to the note:
 * Add the finished review text to the current calendar note, appending after the configured heading for that period.
 * If the heading doesn't exist, then append it first.
 * @param {string} periodString the calendar note title string for the review period
 * @param {string} periodType for journal questions: 'day', 'week', 'month', 'quarter', 'year'
 * @param {string} answersText the text to insert into the journal
 */
async function writeAnswersToNote(
  periodStringIn: string = '',
  periodTypeIn: string = '',
  answersTextIn: string = '',
  parsedQuestionsIn: Array<ParsedQuestionType> = [],
  answersByIndexIn: { [string]: string | boolean } = {},
): Promise<void> {
  try {
    const config: PeriodicReviewConfigType = await getJournalSettings()
    let periodString = periodStringIn ?? ''
    if (periodString === '') {
      periodString = Editor.note?.title ?? ''
    }
    const allowedPeriodTypes = ['day', 'week', 'month', 'quarter', 'year']
    const isRecognizedPeriodType = allowedPeriodTypes.includes(periodTypeIn)
    const periodType = isRecognizedPeriodType ? periodTypeIn : ''
    let answersText = answersTextIn ?? ''
    // Backward-compatibility: earlier function signature was (periodString, answersText).
    if (!isRecognizedPeriodType && periodTypeIn !== '' && answersText === '') {
      answersText = periodTypeIn
    }
    if (answersText === '') {
      const result = await getInput('No answers were collected from the review window. Please enter them manually here:', 'OK', 'Enter answers', '')
      if (result === false) {
        throw new Error('No answers were collected from the review window')
      } else {
        answersText = String(result)
      }
    }

    // Get the correct Editor for the calendar note
    // TODO: find the right existing helper function to use periodString to get the correct note
    
    // $FlowIgnore(incompatible-call) .note is a superset of CoreNoteFields
    const outputNote = Editor
    const resolvedPeriodType = periodType !== '' ? periodType : getPeriodOfNPDateStr(periodString)
    const sectionHeading = getSectionHeadingForPeriod(config, resolvedPeriodType)
    // $FlowIgnore[incompatible-call] .note is a superset of CoreNoteFields
    logDebug(pluginJson, `Appending answers to heading '${sectionHeading}' in note ${displayTitle(outputNote)}`)
    const matchedHeading = findHeadingStartsWith(outputNote, sectionHeading)
    const headingToUse = matchedHeading ? matchedHeading : sectionHeading
    // Get the boolean clear directives for unchecked boolean answers. 
    // Note: @Cursor says this more complex upsert functionality is needed as we want to be able to clear boolean tokens on existing lines. @jgclark doesn't understand this, but has left it as it works.
    const booleanClearDirectives = getBooleanClearDirectivesFromAnswers(parsedQuestionsIn, answersByIndexIn)
    const { updates, appendLines } = partitionReviewAnswerLinesForMixedUpsert(
      outputNote.paragraphs ?? [],
      headingToUse,
      answersText.split(/\r?\n/),
      parsedQuestionsIn,
      booleanClearDirectives,
    )
    for (const { para, content } of updates) {
      para.content = content
      outputNote.updateParagraph(para)
    }
    if (appendLines.length > 0) {
      outputNote.addParagraphBelowHeadingTitle(
        appendLines.join('\n'),
        'empty',
        headingToUse,
        true,
        true)
    }
    if (outputNote.note) {
      DataStore.updateCache(outputNote.note, true)
    }
  } catch (err) {
    logError(pluginJson, `writeAnswersToNote: ${err.message}`)
  }
}

//---------------------------------------------------------
// Callback function for HTML single-window review actions
//---------------------------------------------------------

/**
 * Normalize review callback payload from the HTML bridge or x-callback-url (string or object per plugin.json).
 * @param {mixed} payload
 * @returns {any}
 */
function parseReviewWindowPayload(payload: mixed): any {
  if (payload == null || payload === '') {
    return {}
  }
  if (typeof payload === 'object' && !Array.isArray(payload)) {
    return payload
  }
  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    if (trimmed === '') {
      return {}
    }
    return JSON.parse(trimmed)
  }
  return {}
}

/**
 * Normalize args from DataStore.invokePluginCommandByName: usually (actionName, payload), but some bridges pass one array [actionName, payload].
 * @param {mixed} actionNameIn
 * @param {mixed} payloadIn
 * @returns {{ actionName: string, payload: mixed }}
 */
function normalizeReviewWindowInvokeArgs(actionNameIn: mixed, payloadIn: mixed): { actionName: string, payload: mixed } {
  if (Array.isArray(actionNameIn)) {
    return {
      actionName: String(actionNameIn[0] ?? ''),
      payload: actionNameIn.length >= 2 ? actionNameIn[1] : payloadIn,
    }
  }
  return {
    actionName: typeof actionNameIn === 'string' ? actionNameIn : String(actionNameIn ?? ''),
    payload: payloadIn,
  }
}

/**
 * Callback function for HTML single-window review actions.
 * Must return a value when invoked via DataStore.invokePluginCommandByName or NotePlan can fail silently after logging execution.
 * @param {mixed} actionNameIn
 * @param {mixed} payload — JSON string or object (NotePlan may pass either)
 * @returns {Promise<{||}>}
 */
export async function onReviewWindowAction(actionNameIn: mixed, payload: mixed = ''): Promise<{||}> {
  const { actionName, payload: payloadResolved } = normalizeReviewWindowInvokeArgs(actionNameIn, payload)
  logDebug(pluginJson, `onReviewWindowAction action=${actionName}`)
  // logDebug(pluginJson, `onReviewWindowAction payloadLength=${String(payload?.length ?? 0)} payloadPreview="${String(payload ?? '').slice(0, 100)}"`)
  if (actionName === 'cancel') {
    logDebug('Journalling/onReviewWindowAction', `Cancelled by user.`)
    closeWindowFromCustomId(REVIEW_WINDOW_CUSTOM_ID)
    return {}
  }

  if (actionName === 'refresh') {
    let refreshPayload: any = {}
    try {
      refreshPayload = parseReviewWindowPayload(payloadResolved)
    } catch (err) {
      logError(pluginJson, `onReviewWindowAction: refresh could not parse payload: ${err.message}`)
      return {}
    }
    const periodType = String(refreshPayload.periodType ?? '')
    const periodString = String(refreshPayload.periodString ?? '')
    if (periodType === '' || periodString === '') {
      logWarn(pluginJson, 'onReviewWindowAction: refresh missing periodType or periodString')
      return {}
    }
    logDebug('Journalling/onReviewWindowAction', `Refresh: reopening review for ${periodType} ${periodString}`)
    await processReviewQuestions(periodString, periodType)
    return {}
  }

  if (actionName === 'navigatePeriod') {
    let navPayload: any = {}
    try {
      navPayload = parseReviewWindowPayload(payloadResolved)
    } catch (err) {
      logError(pluginJson, `onReviewWindowAction: navigatePeriod could not parse payload: ${err.message}`)
      return {}
    }
    const periodType = String(navPayload.periodType ?? '')
    const periodString = String(navPayload.periodString ?? '')
    const direction = String(navPayload.direction ?? '')
    if (periodType === '' || periodString === '' || (direction !== 'prev' && direction !== 'next')) {
      logWarn(pluginJson, 'onReviewWindowAction: navigatePeriod missing periodType, periodString, or valid direction')
      return {}
    }
    const targetPeriodString =
      direction === 'next' ? getNextNPPeriodString(periodString, periodType) : getPreviousNPPeriodString(periodString, periodType)
    if (targetPeriodString === '') {
      logWarn(pluginJson, `onReviewWindowAction: navigatePeriod could not compute ${direction} period from "${periodString}" (${periodType})`)
      return {}
    }
    logDebug('Journalling/onReviewWindowAction', `Navigate ${direction}: reopening review for ${periodType} ${targetPeriodString}`)
    await processReviewQuestions(targetPeriodString, periodType)
    return {}
  }

  const configMaybe: ?PeriodicReviewConfigType = await getJournalSettings()
  if (configMaybe == null || typeof configMaybe !== 'object') {
    logError(pluginJson, 'onReviewWindowAction: no journal settings loaded; cannot save review')
    return {}
  }
  const config: PeriodicReviewConfigType = configMaybe
  let safePayload: any = {}
  try {
    // Allow callback payloads as JSON string (x-callback / jsBridge) or as an object (native bridge).
    safePayload = parseReviewWindowPayload(payloadResolved)
    clo(safePayload, `onReviewWindowAction: parsed payload`)
    let answers = safePayload.answers ?? {}
    // Get the period type and string from the hidden fields in the payload
    let periodType = safePayload.periodType ?? ''
    let periodString = safePayload.periodString ?? ''
    // Backward-compatibility: older bridges flattened q_* plus period fields at top level.
    if ((periodType === '' || periodString === '') && typeof safePayload === 'object' && safePayload != null) {
      periodType = periodType || String(safePayload.periodType ?? '')
      periodString = periodString || String(safePayload.periodString ?? '')
    }
    if ((answers == null || Object.keys(answers).length === 0) && typeof safePayload === 'object' && safePayload != null) {
      const extractedAnswers: { [string]: any } = {}
      const keys = Object.keys(safePayload)
      for (const key of keys) {
        if (key.startsWith('q_')) {
          extractedAnswers[key] = (safePayload: any)[key]
        }
      }
      answers = extractedAnswers
    }
    const planningRaw =
      answers.planning_tasks ?? (typeof safePayload === 'object' && safePayload != null ? (safePayload: any).planning_tasks : undefined)
    const planningText = typeof planningRaw === 'string' ? planningRaw : String(planningRaw ?? '')
    const hasPlanningContent = normalizePlanningTaskLinesFromForm(planningText).length > 0
    const questionLines = await getQuestionsForPeriod(config, periodType)
    const parsedQuestions = parseQuestions(questionLines)
    const output = buildOutputFromReviewWindowAnswers(parsedQuestions, questionLines, periodString, periodType, answers)
    if (output !== '') {
      await writeAnswersToNote(periodString, periodType, output, parsedQuestions, answers)
    } else if (!hasPlanningContent) {
      logWarn(pluginJson, 'No template question answers were collected from the review window')
    }
    await writePlanningTasksToNextPeriodNote(config, periodString, periodType, planningText)
    logDebug('Journalling/onReviewWindowAction', `Finished.`)
    closeWindowFromCustomId(REVIEW_WINDOW_CUSTOM_ID)
    return {}
  } catch (err) {
    logError(pluginJson, `onReviewWindowAction: ${err.message}`)
    return {}
  }
}
