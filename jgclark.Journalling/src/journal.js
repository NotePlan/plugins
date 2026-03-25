// @flow
//---------------------------------------------------------------
// Journalling commands
// Jonathan Clark
// last update 2026-03-23 for v2.0.0.b1 by @jgclark + @Cursor
//---------------------------------------------------------------

import strftime from 'strftime'
import pluginJson from '../plugin.json'
import { getJournalSettings } from './journalHelpers'
import type { JournalConfigType, ParsedQuestionType } from './journalHelpers'
import { stylesheetinksInHeader, faLinksInHeader, buildReviewHTML } from './reviewHTMLViewGenerator'
import { RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE, getWeek, getPeriodOfNPDateStr, isDailyNote, isWeeklyNote, isMonthlyNote, isQuarterlyNote, isYearlyNote } from '@helpers/dateTime'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { showHTMLV2 } from '@helpers/HTMLView'
import type { HtmlWindowOptions } from '@helpers/HTMLView'
import { getEventsForDay } from '@helpers/NPCalendar'
import { getFirstDateInPeriod, getLastDateInPeriod } from '@helpers/NPdateTime'
import { getNotesChangedInInterval } from '@helpers/NPnote'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import { closeWindowFromCustomId } from '@helpers/NPWindows'
import { findHeadingStartsWith } from '@helpers/paragraph'
import { getInput, isInt, showMessage } from '@helpers/userInput'

//---------------------------------------------------------------
// Constants & Types

const REVIEW_WINDOW_CUSTOM_ID = 'jgclark.Journalling.period-review'
const REVIEW_WINDOW_CALLBACK_COMMAND = 'onReviewWindowAction'

//---------------------------------------------------------------

/**
 * Gather answers to daily journal questions, and inserts at the cursor.
 */
export async function dailyJournalQuestions(): Promise<void> {
  try {
    const thisPeriodStr = strftime(`%Y-%m-%d`)
    logDebug(pluginJson, `Starting for day ${thisPeriodStr}`)

    await processJournalQuestions(thisPeriodStr, 'day', 'Daily')
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

/**
 * Gather answers to weekly journal questions, and inserts at the cursor.
 */
export async function weeklyJournalQuestions(): Promise<void> {
  try {
    const currentWeekNum = getWeek(new Date())
    const thisPeriodStr = `${strftime(`%Y`)}-W${currentWeekNum}`
    logDebug(pluginJson, `Starting for week ${thisPeriodStr}`)

    await processJournalQuestions(thisPeriodStr, 'week', 'Weekly')
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

/**
 * Gather answers to monthly journal questions, and inserts at the cursor.
 */
export async function monthlyJournalQuestions(): Promise<void> {
  try {
    const thisPeriodStr = strftime(`%Y-%m`)
    logDebug(pluginJson, `Starting for month ${thisPeriodStr}`)

    await processJournalQuestions(thisPeriodStr, 'month', 'Monthly')
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

/**
 * Gather answers to quarterly journal questions, and inserts at the cursor.
 */
export async function quarterlyJournalQuestions(): Promise<void> {
  try {
    const todaysDate = new Date()
    const m = todaysDate.getMonth() // counting from 0
    const thisQ = Math.floor(m / 3) + 1
    const thisPeriodStr = `${strftime(`%Y`)}Q${String(thisQ)}`
    logDebug(pluginJson, `Starting for quarter ${thisPeriodStr}`)

    await processJournalQuestions(thisPeriodStr, 'quarter', 'Quarterly')
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

/**
 * Gather answers to yearly journal questions, and inserts at the cursor.
 */
export async function yearlyJournalQuestions(): Promise<void> {
  try {
    const thisPeriodStr = strftime(`%Y`)
    logDebug(pluginJson, `Starting for year ${thisPeriodStr}`)

    await processJournalQuestions(thisPeriodStr, 'year', 'Yearly')
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

//---------------------------------------------------------------
// Private functions
//---------------------------------------------------------------

/**
 * Ensure the correct period note is open, or open it automatically if configured.
 * @param {string} periodType for journal questions: 'day', 'week', 'month', 'quarter', 'year'
 * @param {string} periodAdjective adjective for period: 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'
 * @returns {TNote | null} the note, or null if not found
 */
function ensureCorrectPeriodNoteIsOpen(
  periodType: string,
  periodAdjective: string
): TNote | null {
  // Open current calendar note if wanted
  const { note } = Editor
  logDebug('ensureCorrectPeriodNoteIsOpen', `current note=${String(note?.title ?? 'unknown')}`)
  const currentNotePeriod = (note && note.type === 'Calendar') ? getPeriodOfNPDateStr(note.title ?? '') : ''
  logDebug('ensureCorrectPeriodNoteIsOpen', `currentNotePeriod=${String(currentNotePeriod)}. Wanted: ${periodType}`)
  if (currentNotePeriod === '' || currentNotePeriod === 'error' || currentNotePeriod !== periodType) {
    Editor.openNoteByDate(new Date(), false, 0, 0, false, periodType)
    logDebug('ensureCorrectPeriodNoteIsOpen', `Opened current ${periodAdjective} note automatically because openCalendarNoteWhenReviewing is true`)
    return Editor.note ?? null
  } else {
    return note
  }
}

/**
 * Get raw question lines for the given period from config. 
 * From v1.16, these may now contain multiple questions per line, separated by '||'.
 * @param {JournalConfigType} config the journal configuration
 * @param {string} period for journal questions: 'day', 'week', 'month', 'quarter', 'year'
 * @returns {Promise<Array<string>>} array of question lines, or empty array if unsupported
 */
async function getQuestionsForPeriod(config: JournalConfigType, period: string): Promise<Array<string>> {
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
 * Parse question lines to extract questions and their types.
 * Supports multiple questions per line separated by '||'.
 * @param {Array<string> | string} questionLines raw question lines from config
 * @returns {Array<{question: string, type: string, originalLine: string, lineIndex: number}>} parsed questions with types and line index
 */
export function parseQuestions(questionLines: Array<string> | string): Array<ParsedQuestionType> {
  const parsed = []
  const typeRE = new RegExp('<\\s*(string|int|number|boolean|mood|subheading)\\s*>', 'i')
  const segmentRE = new RegExp('[^<]*?<\\s*(?:string|int|number|boolean|mood|subheading)\\s*>\\)?[^\\s]*', 'gi')
  const linesToProcess = Array.isArray(questionLines) ? questionLines : String(questionLines ?? '').split('\n')

  // Process each line, splitting by '||' to support multiple questions per line
  for (let lineIndex = 0; lineIndex < linesToProcess.length; lineIndex++) {
    const line = linesToProcess[lineIndex]
    // Split the line by '||' to get individual questions (allowing optional whitespace around ||)
    const questionParts = line.split(/\s*\|\|\s*/).map(part => part.trim()).filter(part => part !== '')

    let questionNum = 0
    for (const questionPart of questionParts) {
      questionNum++
      const segments = questionPart.match(segmentRE) ?? []
      for (const segmentRaw of segments) {
        const segment = segmentRaw.trim()
        const reArray = segment.match(typeRE)
        const questionType = reArray?.[1] ?? '<error in question type>'
        // Prefer #/@ tokens when present (e.g. #bible<boolean>, @sleep(<int>))
        const tokenMatch = segment.match(/([@#][^\s(<]+)/)
        const question = tokenMatch?.[1]
          ?? segment.replace(/:|\(|\)|<string>|<int>|<number>|<boolean>|<mood>|<subheading>/gi, '').trim()
        // logDebug(pluginJson, `- Q#${questionNum}: Line ${lineIndex}, type:${questionType} "${question}"`)
        parsed.push({ question, type: questionType, originalLine: segment, lineIndex })
      }
    }
  }

  return parsed
}

/**
 * Handle a subheading question type.
 * @param {string} question the question text
 * @returns {string} the formatted subheading line
 */
function handleSubheadingQuestion(question: string): string {
  return '\n### '.concat(question.replace(/<subheading>/, ''))
}

/**
 * Escape a string for use inside a RegExp.
 * @param {string} s
 * @returns {string}
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Split a question segment at the typed marker (same idea as reviewHTMLViewGenerator.splitSegmentAtTypeMarker).
 * @param {string} segment
 * @param {string} questionType
 * @returns {{ prefix: string, suffix: string }}
 */
function splitParsedSegmentAtTypeMarker(segment: string, questionType: string): {| prefix: string, suffix: string |} {
  const safeType = questionType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`<\\s*${safeType}\\s*>`, 'i')
  const m = segment.match(re)
  if (!m || m.index == null) {
    return { prefix: segment, suffix: '' }
  }
  const idx = m.index
  const tagLen = m[0].length
  return { prefix: segment.slice(0, idx), suffix: segment.slice(idx + tagLen) }
}

/**
 * Paragraph text lines to scan for existing review answers: after review heading if present, else whole note.
 * @param {TNote} note
 * @param {string} reviewSectionHeading
 * @returns {Array<string>}
 */
function getParagraphLineContentsForReviewScan(note: TNote, reviewSectionHeading: string): Array<string> {
  const paragraphs = note.paragraphs ?? []
  if (!reviewSectionHeading || reviewSectionHeading.trim() === '') {
    return paragraphs.map((p) => p.content)
  }
  const headingToFindLC = reviewSectionHeading.toLowerCase()
  let startIdx = -1
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i]
    if (paragraph.type !== 'title') {
      continue
    }
    const c = paragraph.content.toLowerCase()
    if (c.startsWith(headingToFindLC) || headingToFindLC === c || headingToFindLC.startsWith(c)) {
      startIdx = i
      break
    }
  }
  if (startIdx < 0) {
    return paragraphs.map((p) => p.content)
  }
  return paragraphs.slice(startIdx + 1).map((p) => p.content)
}

/**
 * Parse one line of note content for a single parsed question's answer (form-ready value).
 * @param {ParsedQuestionType} parsedQuestion
 * @param {string} line
 * @returns {string} value for the HTML control, or '' if not found on this line
 */
function extractExistingAnswerOnLine(parsedQuestion: ParsedQuestionType, line: string): string {
  const t = parsedQuestion.type.toLowerCase()
  const seg = parsedQuestion.originalLine.trim()
  if (t === 'subheading') {
    return ''
  }
  if (t === 'boolean') {
    const token = parsedQuestion.question
    if (!token) {
      return ''
    }
    const re = new RegExp(`(?:^|\\s)${escapeRegExp(token)}(?=\\s|$)`)
    return re.test(line) ? 'yes' : ''
  }
  const { prefix, suffix } = splitParsedSegmentAtTypeMarker(seg, parsedQuestion.type)
  if (t === 'int') {
    const re = new RegExp(`${escapeRegExp(prefix)}(\\d+)${escapeRegExp(suffix)}`)
    const m = line.match(re)
    return m?.[1] != null ? m[1] : ''
  }
  if (t === 'number') {
    const re = new RegExp(
      `${escapeRegExp(prefix)}([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)${escapeRegExp(suffix)}`,
    )
    const m = line.match(re)
    return m?.[1] != null ? m[1] : ''
  }
  if (t === 'mood' || t === 'string') {
    if (suffix === '') {
      const idx = line.indexOf(prefix)
      if (idx < 0) {
        return ''
      }
      return line.slice(idx + prefix.length).trim()
    }
    const re = new RegExp(`${escapeRegExp(prefix)}(.*?)${escapeRegExp(suffix)}`)
    const m = line.match(re)
    return m?.[1] != null ? m[1].trim() : ''
  }
  return ''
}

/**
 * Latest matching answer in the note for one question (scans newest-to-oldest by paragraph order).
 * @param {ParsedQuestionType} parsedQuestion
 * @param {Array<string>} paragraphLines
 * @returns {string}
 */
function extractExistingAnswerForReviewForm(parsedQuestion: ParsedQuestionType, paragraphLines: Array<string>): string {
  for (let i = paragraphLines.length - 1; i >= 0; i--) {
    const line = paragraphLines[i]
    const v = extractExistingAnswerOnLine(parsedQuestion, line)
    if (v !== '') {
      return v
    }
  }
  return ''
}

/**
 * Map field names q_0, q_1, … to existing answers in the calendar note for pre-filling the review HTML form.
 * @param {Array<ParsedQuestionType>} parsedQuestions
 * @param {Array<string>} paragraphLines lines to scan (e.g. from getParagraphLineContentsForReviewScan)
 * @returns {{ [string]: string }}
 */
export function buildInitialReviewAnswersByFieldName(
  parsedQuestions: Array<ParsedQuestionType>,
  paragraphLines: Array<string>,
): { [string]: string } {
  const out: { [string]: string } = {}
  for (let globalIndex = 0; globalIndex < parsedQuestions.length; globalIndex++) {
    const pq = parsedQuestions[globalIndex]
    const v = extractExistingAnswerForReviewForm(pq, paragraphLines)
    if (v !== '') {
      out[`q_${globalIndex}`] = v
    }
  }
  return out
}

/**
 * Convert parsed questions into line-indexed groups.
 * @param {Array<ParsedQuestionType>} parsedQuestions
 * @returns {{ [number]: Array<ParsedQuestionType> }}
 */
function groupQuestionsByLine(parsedQuestions: Array<ParsedQuestionType>): { [number]: Array<ParsedQuestionType> } {
  const questionsByLine: { [number]: Array<ParsedQuestionType> } = {}
  for (let i = 0; i < parsedQuestions.length; i++) {
    const q = parsedQuestions[i]
    if (!questionsByLine[q.lineIndex]) {
      questionsByLine[q.lineIndex] = []
    }
    questionsByLine[q.lineIndex].push(q)
  }
  return questionsByLine
}

/**
 * Convert answer payload from single window into output line for one parsed question.
 * @param {ParsedQuestionType} parsedQuestion
 * @param {string | boolean} answerRaw
 * @returns {string}
 */
function answerFromReviewWindowPayload(parsedQuestion: ParsedQuestionType, answerRaw: string | boolean): string {
  const t = parsedQuestion.type
  if (t === 'boolean') {
    const on = answerRaw === true || answerRaw === 'yes'
    return on ? parsedQuestion.question : ''
  }
  const answer = (typeof answerRaw === 'string' ? answerRaw : String(answerRaw ?? '')).trim()
  if (answer === '') {
    return ''
  }
  switch (t) {
    case 'int': {
      if (isInt(answer)) {
        return parsedQuestion.originalLine.startsWith('-') ? `- ${answer}` : parsedQuestion.originalLine.replace(/<int>/, answer)
      }
      return ''
    }
    case 'number': {
      if (answer != null && Number(answer)) {
        return parsedQuestion.originalLine.startsWith('-') ? `- ${answer}` : parsedQuestion.originalLine.replace(/<number>/, answer)
      }
      return ''
    }
    case 'string': {
      return parsedQuestion.originalLine.startsWith('-') ? `- ${answer}` : parsedQuestion.originalLine.replace(/<string>/, answer)
    }
    case 'mood': {
      return parsedQuestion.originalLine.replace(/<mood>/, answer)
    }
    case 'subheading': {
      return handleSubheadingQuestion(parsedQuestion.question)
    }
    default: {
      return ''
    }
  }
}

/**
 * Build output from answers returned by single-window mode.
 * @param {Array<ParsedQuestionType>} parsedQuestions
 * @param {{ [string]: string | boolean }} answersByIndex
 * @returns {string}
 */
function buildOutputFromReviewWindowAnswers(parsedQuestions: Array<ParsedQuestionType>, answersByIndex: { [string]: string | boolean }): string {
  let output = ''
  const questionsByLine = groupQuestionsByLine(parsedQuestions)
  const lineIndices = Object.keys(questionsByLine).map(Number).sort((a, b) => a - b)

  for (const lineIndex of lineIndices) {
    const lineQuestions = questionsByLine[lineIndex]
    const lineAnswers: Array<string> = []
    for (let i = 0; i < lineQuestions.length; i++) {
      const globalIndex = parsedQuestions.findIndex((q) => q === lineQuestions[i])
      const parsedQuestion = lineQuestions[i]
      const resAQ = answerToQuestion(parsedQuestion.question)
      if (resAQ !== '') {
        logDebug(pluginJson, `- Found existing Q answer '${resAQ}', so won't ask again`)
        continue
      }
      const answer = answerFromReviewWindowPayload(parsedQuestion, answersByIndex[`q_${globalIndex}`] ?? '')
      if (answer !== '') {
        lineAnswers.push(answer)
      }
    }
    if (lineAnswers.length > 0) {
      let combinedLine = lineAnswers.join(' ')
      combinedLine = combinedLine.replace(/\s+/g, ' ')
      output += `${combinedLine}\n`
    }
  }
  return output
}

/**
 * Get the current calendar title string for a review period.
 * @param {string} period
 * @returns {string}
 */
function getReviewPeriodTitle(period: string): string {
  const now = new Date()
  switch (period) {
    case 'day':
      return strftime('%Y-%m-%d', now)
    case 'week':
      return `${strftime('%Y', now)}-W${getWeek(now)}`
    case 'month':
      return strftime('%Y-%m', now)
    case 'quarter': {
      const quarter = Math.floor(now.getMonth() / 3) + 1
      return `${strftime('%Y', now)}Q${quarter}`
    }
    case 'year':
      return strftime('%Y', now)
    default:
      return Editor.note?.title ?? ''
  }
}

/**
 * Map review title strings to forms understood by getFirstDateInPeriod / getLastDateInPeriod (e.g. `2026Q1` -> `2026-Q1`).
 * TODO: Revisit why this is necessary.
 * @param {string} periodTitle
 * @returns {string}
 */
function normalizeReviewPeriodTitleForNPDateHelpers(periodTitle: string): string {
  const compactQuarter = periodTitle.match(/^(\d{4})Q([1-4])$/i)
  if (compactQuarter) {
    return `${compactQuarter[1]}-Q${compactQuarter[2]}`
  }
  return periodTitle
}

// /**
//  * Stable key for deduping calendar items returned on multiple days (e.g. multi-day events).
//  * @param {TCalendarItem} ev
//  * @returns {string}
//  */
// function calendarItemDedupeKey(ev: TCalendarItem): string {
//   if (ev.id != null && String(ev.id) !== '') {
//     return String(ev.id)
//   }
//   const t = ev.date instanceof Date ? ev.date.getTime() : 0
//   return `${ev.title ?? ''}\0${String(t)}\0${ev.calendar ?? ''}`
// }

// /**
//  * Calendar events for [startISO..endISO] using EventHelpers settings + the same per-day fetch as `listDaysEvents`.
//  * @param {string} periodType
//  * @param {string} periodString
//  * @returns {Promise<Array<TCalendarItem>>}
//  */
// async function getListOfEventsForPeriod(_periodType: string, periodString: string): Promise<Array<TCalendarItem>> {
//   const npPeriodKey = normalizeReviewPeriodTitleForNPDateHelpers(periodString)
//   const startISO = getFirstDateInPeriod(npPeriodKey)
//   const endISO = getLastDateInPeriod(npPeriodKey)
//   if (startISO === '(error)' || endISO === '(error)') {
//     logWarn(pluginJson, `getListOfEventsForPeriod: could not parse period "${periodString}"`)
//     return []
//   }
//   try {
//     logDebug(pluginJson, `getListOfEventsForPeriod: ${_periodType} / ${periodString}`)
//     const eventsConfig = await getEventsSettings()
//     const calendarSet: Array<string> = Array.isArray(eventsConfig.calendarSet) ? eventsConfig.calendarSet : []
//     let yyyymmdd = startISO.replace(/-/g, '')
//     const endYYYYMMDD = endISO.replace(/-/g, '')
//     const collected: Array<TCalendarItem> = []
//     const seen = new Set<string>()
//     while (yyyymmdd <= endYYYYMMDD) {
//       const dayEvents = (await getEventsForDay(yyyymmdd, calendarSet)) ?? []
//       for (const ev of dayEvents) {
//         const k = calendarItemDedupeKey(ev)
//         if (seen.has(k)) {
//           continue
//         }
//         seen.add(k)
//         collected.push(ev)
//       }
//       if (yyyymmdd === endYYYYMMDD) {
//         break
//       }
//       yyyymmdd = calcOffsetDateStr(yyyymmdd, '+1d')
//     }
//     return collected
//   } catch (err) {
//     logError(pluginJson, `getListOfEventsForPeriod: ${err.message}`)
//     return []
//   }
// }

/**
 * Collect completed task lines for review summary, according to period rules.
 * - day: include all done lines whose @done date matches the day
 * - week/month/quarter/year: include done lines in period with #win or #bigwin
 * @param {string} periodType
 * @param {string} periodString
 * @returns {Array<string>}
 */
function getSummaryCompletedTasks(periodType: string, periodString: string): Array<string> {
  const npPeriodKey = normalizeReviewPeriodTitleForNPDateHelpers(periodString)
  const startISO = getFirstDateInPeriod(npPeriodKey)
  const endISO = getLastDateInPeriod(npPeriodKey)
  if (startISO === '(error)' || endISO === '(error)') {
    logWarn(pluginJson, `getSummaryCompletedTasks: could not parse period "${periodString}"`)
    return []
  }
  const periodStartMs = new Date(`${startISO}T12:00:00`).getTime()
  const lookbackDaysRaw = Math.ceil((Date.now() - periodStartMs) / 86400000) + 1
  const lookbackDays = Math.min(Math.max(0, lookbackDaysRaw), 400)
  const isDailyPeriod = periodType === 'day'
  const hasWinTag = (content: string): boolean => /(?:^|\s)#(?:bigwin|win)\b/i.test(content)
  const notesToScan = getNotesChangedInInterval(lookbackDays, ['Calendar', 'Notes'])
  const matchingLines: Array<string> = []

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
      if (!isDailyPeriod && !hasWinTag(para.content)) {
        continue
      }
      matchingLines.push(para.content)
    }
  }

  return matchingLines
}

/**
 * Display all questions in the window.
 * Note: does not return the answers -- see separate function for that.
 * @param {Array<ParsedQuestionType>} parsedQuestions
 * @param {string} periodString
 * @param {string} periodType
 * @param {string} periodAdjective adjective for period: 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'
 * @param {JournalConfigType} config
 * @param {Array<string>} rawQuestionLines lines from getQuestionsForPeriod (same array passed to parseQuestions)
 * @param {TNote} calendarNote the calendar note to scan for answers
 * @returns {void}
 */
async function displayQuestionsWindow(
  parsedQuestions: Array<ParsedQuestionType>,
  periodString: string,
  periodType: string,
  periodAdjective: string,
  config: JournalConfigType,
  rawQuestionLines: Array<string>,
  calendarNote: TNote,
): Promise<void> {
  // Get the data sources we need for the review window
  // const periodTitle = getReviewPeriodTitle(periodType)
  const summaryCompletedTasks = (periodAdjective === 'Day') ? getSummaryCompletedTasks(periodType, periodString) : []
  const calendarSet: Array<string> = ['Jonathan (iCloud)', 'Us (iCloud)']
  const eventsForPeriod: Array<TCalendarItem> = (periodType === 'Day') ? await getEventsForDay('2026-03-28', calendarSet) ?? [] : []
  clo(eventsForPeriod, 'eventsForPeriod')
  const scanLines = getParagraphLineContentsForReviewScan(calendarNote, config.reviewSectionHeading ?? '')
  const initialAnswers = buildInitialReviewAnswersByFieldName(parsedQuestions, scanLines)

  // Build the HTML body for the review window from this data
  const htmlBody = buildReviewHTML(
    config,
    parsedQuestions,
    rawQuestionLines,
    summaryCompletedTasks,
    periodString,
    periodType,
    periodAdjective,
    eventsForPeriod,
    REVIEW_WINDOW_CALLBACK_COMMAND,
    initialAnswers,
  )

  // Set the options and then open the review window
  const preferredWindowType = config.preferredWindowType ?? 'New Window'
  const windowOptions: HtmlWindowOptions = {
    customId: REVIEW_WINDOW_CUSTOM_ID,
    windowTitle: `${periodAdjective} Review for ${periodString}`,
    headerTags: `${faLinksInHeader}${stylesheetinksInHeader}`,
    savedFilename: `../../jgclark.Journalling/period-review-${periodType}.html`,
    showInMainWindow: preferredWindowType !== 'New Window',
    splitView: preferredWindowType === 'Split View',
    showReloadButton: true,
    reloadPluginID: pluginJson['plugin.id'],
    reloadCommandName: REVIEW_WINDOW_CALLBACK_COMMAND,
    icon: 'fa-regular fa-clipboard-list',
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
 * Write the collected answers to the note:
 * Add the finished review text to the current calendar note, appending after the line found in config.reviewSectionHeading.
 * If the heading doesn't exist, then append it first.
 * @param {JournalConfigType} config the journal configuration
 * @param {string} periodString the calendar note title string for the review period
 * @param {string} answersText the text to insert into the journal
 * TODO(later): revert to being private, and take out of index.js & plugin.json
 */
export async function writeAnswersToNote(
  periodStringIn: string = '',
  answersTextIn: string = '',
): Promise<void> {
  try {
    const config: JournalConfigType = await getJournalSettings()
    let periodString = periodStringIn ?? ''
    if (periodString === '') {
      periodString = Editor.note?.title ?? ''
    }
    let answersText = answersTextIn ?? ''
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
    // $FlowIgnore[incompatible-call] .note is a superset of CoreNoteFields
    logDebug(pluginJson, `Appending answers to heading '${config.reviewSectionHeading}' in note ${displayTitle(Editor.note)}`)
    const matchedHeading = findHeadingStartsWith(outputNote, config.reviewSectionHeading)
    outputNote.addParagraphBelowHeadingTitle(
      answersText,
      'empty',
      matchedHeading ? matchedHeading : config.reviewSectionHeading,
      true,
      true)
  } catch (err) {
    logError(pluginJson, `writeAnswersToNote: ${err.message}`)
  }
}

/**
 * Process questions for the given period, and write to the current note.
 * If we're not in the correct note, offer to open it first.
 * @author @jgclark
 * @param {string} periodString the calendar note title string for the review period
 * @param {string} periodType for journal questions: 'day', 'week', 'month', 'quarter', 'year'
 * @param {string} periodAdjective adjective for period: 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'
 */
async function processJournalQuestions(
  periodString: string,
  periodType: string,
  periodAdjective: string
): Promise<void> {
  try {
    // Get configuration and questions
    const config: JournalConfigType = await getJournalSettings()

    // Ensure correct period note is open
    const reviewNote = ensureCorrectPeriodNoteIsOpen(periodType, periodAdjective)
    if (!reviewNote) {
      await showMessage(`No ${periodAdjective} note found, so cannot continue.`)
      throw new Error(`No ${periodAdjective} note found, so cannot continue.`)
    }

    const questionLines = await getQuestionsForPeriod(config, periodType)

    // Only continue if we have some questions
    const numQs = questionLines.length
    if (!questionLines || numQs === 0 || questionLines[0] === '') {
      await showMessage(`No questions for ${periodType} found in the plugin settings, so cannot continue.`)
      throw new Error(`No questions for ${periodType} found in the plugin settings, so cannot continue.`)
    }

    logDebug(pluginJson, `Found ${numQs} question lines for ${periodType}`)

    // Parse questions (may result in multiple questions per line if '||' is used)
    const parsedQuestions = parseQuestions(questionLines)

    await displayQuestionsWindow(parsedQuestions, periodString, periodType, periodAdjective, config, questionLines, reviewNote)

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

/**
 * Callback function for HTML single-window review actions.
 * @param {string} actionName
 * @param {ReviewWindowPayloadType} payload
 */
export async function onReviewWindowAction(actionName: string, payload: string = ''): Promise<void> {
  logDebug(pluginJson, `onReviewWindowAction action=${actionName}`)
  const config: JournalConfigType = await getJournalSettings()
  if (actionName === 'cancel') {
    logDebug('Journalling/onReviewWindowAction', `Cancelled by user.`)
    closeWindowFromCustomId(REVIEW_WINDOW_CUSTOM_ID)
    return
  }

  let safePayload: any = {}
  try {
    // Allow callback payloads sent via x-callback-url arg1 JSON string.
    safePayload = JSON.parse(payload)
    clo(safePayload, `onReviewWindowAction: parsed payload`)
    const answers = safePayload.answers ?? {}
    // Get the period type and string from the hidden fields in the payload
    const periodType = safePayload.periodType ?? ''
    const periodString = safePayload.periodString ?? ''
    const questionLines = await getQuestionsForPeriod(config, periodType)
    const parsedQuestions = parseQuestions(questionLines)
    const output = buildOutputFromReviewWindowAnswers(parsedQuestions, answers)
    if (output !== '') {
      await writeAnswersToNote(periodString, output)
    } else {
      logWarn(pluginJson, 'No answers were collected from the review window')
    }
    logDebug('Journalling/onReviewWindowAction', `Finished.`)
    closeWindowFromCustomId(REVIEW_WINDOW_CUSTOM_ID)

  } catch (err) {
    logError(pluginJson, `onReviewWindowAction: couldn't parse payload JSON string: ${err.message}`)
  }
}

/**
 * Look to see if this question has already been answered.
 * If so return the line's content -- or empty string.
 * @author @jgclark
 * 
 * @param {string} question
 * @returns {string} found answered question, or empty string
 */
function answerToQuestion(question: string): string {
  const RE_Q = `${question}.+`
  const { paragraphs } = Editor
  let result = ''
  for (const p of paragraphs) {
    const m = p.content.match(RE_Q)
    if (m != null) {
      result = m[0]
    }
  }
  return result
}
