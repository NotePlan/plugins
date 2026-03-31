// @flow
//---------------------------------------------------------------
// Journalling commands
// Jonathan Clark
// last update 2026-03-28 for v2.0.0.b4 by @jgclark + @Cursor
//---------------------------------------------------------------

import strftime from 'strftime'
import pluginJson from '../plugin.json'
import {
  getJournalSettings,
  getPeriodAdjectiveFromType,
  REVIEW_QUESTION_TYPE_NAMES_ALT,
  substituteReviewPeriodPlaceholders,
} from './journalHelpers'
import type { JournalConfigType, ParsedQuestionType } from './journalHelpers'
import { stylesheetinksInHeader, faLinksInHeader, buildReviewHTML } from './reviewHTMLViewGenerator'
import {
  RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE,
  getWeek,
  getPeriodOfNPDateStr,
  isDailyNote,
  isWeeklyNote,
  isMonthlyNote,
  isQuarterlyNote,
  isYearlyNote,
} from '@helpers/dateTime'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { showHTMLV2 } from '@helpers/HTMLView'
import type { HtmlWindowOptions } from '@helpers/HTMLView'
import { getEventsForDay } from '@helpers/NPCalendar'
import { getFirstDateInPeriod, getLastDateInPeriod } from '@helpers/NPdateTime'
import { getNotesChangedInInterval } from '@helpers/NPnote'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import { closeWindowFromCustomId, isEditorWindowOpenByTitle } from '@helpers/NPWindows'
import { findEndOfActivePartOfNote, findHeadingStartsWith } from '@helpers/paragraph'
import { getInput, isInt, showMessage } from '@helpers/userInput'

//---------------------------------------------------------------
// Constants & Types

const REVIEW_WINDOW_CUSTOM_ID = 'jgclark.Journalling.period-review'
const REVIEW_WINDOW_CALLBACK_COMMAND = 'onReviewWindowAction'
const RE_DURATION_HHMM = /^(\d{1,2}):([0-5]\d)$/

//---------------------------------------------------------------

/**
 * Gather answers to daily journal questions, and inserts at the cursor.
 */
export async function dailyJournalQuestions(): Promise<void> {
  try {
    const thisPeriodStr = strftime(`%Y-%m-%d`)
    logDebug(pluginJson, `Starting for day (currently ${thisPeriodStr})`)

    await processJournalQuestions(thisPeriodStr, 'day')
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
    logDebug(pluginJson, `Starting for week (currently ${thisPeriodStr})`)

    await processJournalQuestions(thisPeriodStr, 'week')
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
    logDebug(pluginJson, `Starting for month (currently ${thisPeriodStr})`)

    await processJournalQuestions(thisPeriodStr, 'month')
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
    logDebug(pluginJson, `Starting for quarter (currently ${thisPeriodStr})`)

    await processJournalQuestions(thisPeriodStr, 'quarter')
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
    logDebug(pluginJson, `Starting for year (currently ${thisPeriodStr})`)

    await processJournalQuestions(thisPeriodStr, 'year')
  } catch (error) {
    logError(pluginJson, error.message)
  }
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
 */
async function processJournalQuestions(periodStringIn: string = '', periodType: string): Promise<void> {
  try {
    const periodAdjective = getPeriodAdjectiveFromType(periodType)
    // Get configuration
    const config: JournalConfigType = await getJournalSettings()
    let reviewNote: ?TNote = null

    // Check that we have a correct period note open ...
    const { note: openEditorNote } = Editor
    // FIXME: Check for Teamspace stuff here
    if (openEditorNote && getPeriodOfNPDateStr(openEditorNote.title ?? '') === periodType) {
      // Use the existing open note
      reviewNote = openEditorNote
      logDebug('processJournalQuestions', `Starting with open note '${String(reviewNote?.title ?? 'unknown')}' of period '${String(getPeriodOfNPDateStr(reviewNote?.title ?? ''))}'`)
    } else {
      // use the passed periodStringIn to open the correct note
      logDebug('processJournalQuestions', `Starting by opening current ${periodAdjective} note '${String(periodStringIn)}'`)
      reviewNote = await Editor.openNoteByTitle(periodStringIn)
    }
    if (!reviewNote) {
      // Warn user and stop.
      await showMessage(`Cannot open ${periodStringIn} note, so cannot continue. Please open the correct note first.`)
      throw new Error(`Cannot open ${periodStringIn} note, so cannot continue.`)
    }
    
    // const reviewNote: ?TNote = ensureCorrectPeriodNoteIsOpen(periodType, periodStringIn)
    // if (!reviewNote) {
    //   await showMessage(`No ${periodAdjective} note found, so cannot continue.`)
    //   throw new Error(`No ${periodAdjective} note found, so cannot continue.`)
    // }

    const titleFromNote = reviewNote.title != null ? String(reviewNote.title).trim() : ''
    const periodString = titleFromNote !== '' ? titleFromNote : periodStringIn !== '' ? periodStringIn : ''
    logDebug('processJournalQuestions', `- Will use review note '${String(periodString)}' of period '${String(getPeriodOfNPDateStr(periodString))}'`)

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

/**
 * True when the editor’s open note is the calendar note for this review (same period type and same period as `periodStringIn` when it is non-empty).
 * @param {TNote | void} note
 * @param {string} periodType
 * @param {string} periodStringIn
 * @returns {boolean}
 */
function openEditorNoteMatchesReviewCommand(note: ?TNote, periodType: string, periodStringIn: string): boolean {
  if (note == null || note.type !== 'Calendar') {
    return false
  }
  const notePeriod = getPeriodOfNPDateStr(note.title ?? '')
  if (notePeriod !== periodType) {
    return false
  }
  const want = periodStringIn.trim()
  if (want === '') {
    return true
  }
  const a = normalizeReviewPeriodTitleForNPDateHelpers(String(note.title ?? '').trim())
  const b = normalizeReviewPeriodTitleForNPDateHelpers(want)
  return a === b
}

/**
 * Reuse the open calendar note when it matches this review; otherwise open the calendar note for the current period.
 * @param {string} periodType for journal questions: 'day', 'week', 'month', 'quarter', 'year'
 * @param {string} periodStringIn calendar title from the command (must match the open note to reuse it)
 * @returns {TNote | null} the note, or null if not found
 */
function ensureCorrectPeriodNoteIsOpen(periodType: string, periodStringIn: string = ''): TNote | null {
  const { note } = Editor
  const periodAdjective = getPeriodAdjectiveFromType(periodType)
  logDebug('ensureCorrectPeriodNoteIsOpen', `current note=${String(note?.title ?? 'unknown')}`)
  if (openEditorNoteMatchesReviewCommand(note, periodType, periodStringIn)) {
    logDebug('ensureCorrectPeriodNoteIsOpen', `Reusing open editor calendar note (matches ${periodType} / "${periodStringIn}")`)
    return note ?? null
  }
  logDebug('ensureCorrectPeriodNoteIsOpen', `Opening current ${periodAdjective} note (${periodType}); command period "${periodStringIn}"`)
  Editor.openNoteByDate(new Date(), false, 0, 0, false, periodType)
  return Editor.note ?? null
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
 * Get the configured section heading to use for a given review period.
 * @param {JournalConfigType} config the journal configuration
 * @param {string} periodType for journal questions: 'day', 'week', 'month', 'quarter', 'year'
 * @returns {string}
 */
function getSectionHeadingForPeriod(config: JournalConfigType, periodType: string): string {
  if (periodType === 'day') {
    return config.dailyJournalSectionHeading
  } else {
    return config.reviewSectionHeading
  }
}

/**
 * Parse question lines to extract questions and their types.
 * Supports multiple questions per line separated by '||'.
 * @tests in __tests__/periodReviews.test.js
 * @param {Array<string> | string} questionLines raw question lines from config
 * @returns {Array<{question: string, type: string, originalLine: string, lineIndex: number}>} parsed questions with types and line index
 */
export function parseQuestions(questionLines: Array<string> | string): Array<ParsedQuestionType> {
  const parsed = []
  const typeRE = new RegExp(`<\\s*(${REVIEW_QUESTION_TYPE_NAMES_ALT})\\s*>`, 'i')
  const segmentRE = new RegExp(`[^<]*?<\\s*(?:${REVIEW_QUESTION_TYPE_NAMES_ALT})\\s*>\\)?[^\\s]*`, 'gi')
  const linesToProcess = Array.isArray(questionLines) ? questionLines : String(questionLines ?? '').split('\n')

  // Process each line, splitting by '||' to support multiple questions per line
  for (let lineIndex = 0; lineIndex < linesToProcess.length; lineIndex++) {
    const line = linesToProcess[lineIndex]
    // Support explicit typed heading lines, e.g. `<h2> Heading` / `<h3>Heading`.
    // These are not questions: they are carried through as heading blocks in the output.
    const mTypedH2 = line.match(/^\s*<\s*h2\s*>\s*(.+)$/i)
    if (mTypedH2) {
      parsed.push({ question: String(mTypedH2[1] ?? '').trim(), type: 'h2', originalLine: line, lineIndex })
      continue
    }
    const mTypedH3 = line.match(/^\s*<\s*h3\s*>\s*(.+)$/i)
    if (mTypedH3) {
      parsed.push({ question: String(mTypedH3[1] ?? '').trim(), type: 'h3', originalLine: line, lineIndex })
      continue
    }
    // Support markdown heading lines in the settings, e.g. `## Heading` or `### Subheading`.
    // These are carried through as HTML heading tags in the output.
    const mH2 = line.match(/^##\s+(.+)$/)
    if (mH2) {
      parsed.push({ question: String(mH2[1] ?? '').trim(), type: 'h2', originalLine: line, lineIndex })
      continue
    }
    const mH3 = line.match(/^###\s+(.+)$/)
    if (mH3) {
      parsed.push({ question: String(mH3[1] ?? '').trim(), type: 'h3', originalLine: line, lineIndex })
      continue
    }
    // Support `<h2>` / `<h3>` markers as trailing decorators (e.g. `Title<h2>`).
    // In this case, treat the line as a plain string question (marker is ignored for typing).
    const mTrailingHeadingDecorator = line.match(/^(.*?)\s*<\s*(h2|h3)\s*>\s*$/i)
    if (mTrailingHeadingDecorator) {
      const base = String(mTrailingHeadingDecorator[1] ?? '').trim()
      if (base !== '') {
        parsed.push({ question: base, type: 'string', originalLine: `${base}: <string>`, lineIndex })
        continue
      }
    }
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
          ?? segment
            .replace(
              /:|\(|\)|<string>|<int>|<number>|<duration>|<boolean>|<mood>|<subheading>|<h2>|<h3>|<bullets>|<checklists>|<tasks>/gi,
              '',
            )
            .trim()
        // logDebug(pluginJson, `- Q#${questionNum}: Line ${lineIndex}, type:${questionType} "${question}"`)
        parsed.push({ question, type: questionType, originalLine: segment, lineIndex })
      }
    }
  }

  return parsed
}

/**
 * Handle an HTML heading question type.
 * @param {string} question the question text
 * @param {string} headingType 'h2' | 'h3' | 'subheading' (legacy)
 * @returns {string} the formatted markdown heading block
 */
function handleHeadingQuestion(question: string, headingType: string): string {
  const cleanHeading = question.replace(/<(?:subheading|h2|h3)>\s*$/i, '').trim()
  const headingMarker = headingType === 'h2' ? '##' : '###'
  return `\n${headingMarker} ${cleanHeading}`
}

/**
 * Handle a legacy `<subheading>` question type.
 * @param {string} question the question text
 * @returns {string} the formatted subheading line
 */
function handleSubheadingQuestion(question: string): string {
  return handleHeadingQuestion(question, 'subheading')
}

/**
 * Escape a string for use inside a RegExp.
 * @param {string} s
 * @returns {string}
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Output prefix per line for multiline journal types (`<bullets>`, `<checklists>`, `<tasks>`). */
const MULTILINE_ANSWER_PREFIX_BY_TYPE: { [string]: string } = {
  bullets: '- ',
  checklists: '+ ',
  tasks: '* ',
}

/**
 * Markdown prefix written before each answer line for a multiline question type.
 * @param {string} questionType
 * @returns {string}
 */
function linePrefixForMultilineAnswerType(questionType: string): string {
  return MULTILINE_ANSWER_PREFIX_BY_TYPE[questionType.toLowerCase()] ?? ''
}

/**
 * Remove leading line markers from saved note text so the review textarea shows plain lines.
 * @param {string} rawBlock
 * @param {string} linePrefix e.g. '- '
 * @returns {string}
 */
function stripMultilineAnswerPrefixes(rawBlock: string, linePrefix: string): string {
  if (linePrefix === '') {
    return rawBlock.trim()
  }
  return rawBlock
    .split(/\r?\n/)
    .map((l) => {
      const trimmed = l.trim()
      if (trimmed.startsWith(linePrefix)) {
        return trimmed.slice(linePrefix.length).trim()
      }
      return trimmed
    })
    .join('\n')
    .trim()
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
 * Paragraph text lines to scan for existing review answers: across whole of active part of the note.
 * @param {TNote} note
 * @param {string} reviewSectionHeading
 * @returns {Array<string>}
 */
function getParagraphLineContentsForReviewScan(note: TNote, reviewSectionHeading: string): Array<string> {
  const endOfActiveLineIndex = findEndOfActivePartOfNote(note)
  const paragraphTextLines = note.paragraphs.slice(0, endOfActiveLineIndex).map((p) => p.content) ?? []
  return paragraphTextLines
}

/**
 * Parse one line of note content for a single parsed question's answer (form-ready value). Match for question in case-insensitive way.
 * @param {ParsedQuestionType} parsedQuestion
 * @param {string} line
 * @returns {string} value for the HTML control, or '' if not found on this line
 */
function extractExistingAnswerOnLine(parsedQuestion: ParsedQuestionType, line: string): string {
  const t = parsedQuestion.type.toLowerCase()
  const seg = parsedQuestion.originalLine.trim()
  if (t === 'subheading' || t === 'h2' || t === 'h3') {
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
  if (t === 'duration') {
    const re = new RegExp(`${escapeRegExp(prefix)}(\\d{1,2}:[0-5]\\d)${escapeRegExp(suffix)}`)
    const m = line.match(re)
    return m?.[1] != null ? m[1] : ''
  }
  if (t === 'bullets' || t === 'checklists' || t === 'tasks') {
    const marker = linePrefixForMultilineAnswerType(t)
    const { prefix, suffix } = splitParsedSegmentAtTypeMarker(seg, parsedQuestion.type)
    if (suffix === '') {
      // If the template line is just `<bullets>`/`<checklists>`/`<tasks>`, only treat lines that actually begin with that marker as a match.
      if (prefix === '') {
        const trimmed = line.trim()
        if (!trimmed.startsWith(marker.trim())) {
          return ''
        }
        return stripMultilineAnswerPrefixes(trimmed, marker)
      }
      const idx = line.toLowerCase().indexOf(prefix.toLowerCase())
      if (idx < 0) {
        return ''
      }
      const raw = line.slice(idx + prefix.length).trim()
      if (raw === '') {
        return ''
      }
      return stripMultilineAnswerPrefixes(raw, marker)
    }
    const re = new RegExp(`${escapeRegExp(prefix)}([\\s\\S]*?)${escapeRegExp(suffix)}`, 'i')
    const m = line.match(re)
    if (m?.[1] == null) {
      return ''
    }
    return stripMultilineAnswerPrefixes(m[1].trim(), marker)
  }
  if (t === 'mood' || t === 'string') {
    if (suffix === '') {
      // If template is just `<string>` (no prefix), it's too ambiguous to pre-fill reliably (it would match every line).
      if (prefix === '') {
        return ''
      }
      const idx = line.toLowerCase().indexOf(prefix.toLowerCase())
      if (idx < 0) {
        return ''
      }
      return line.slice(idx + prefix.length).trim()
    }
    const re = new RegExp(`${escapeRegExp(prefix)}(.*?)${escapeRegExp(suffix)}`, 'i')
    const m = line.match(re)
    return m?.[1] != null ? m[1].trim() : ''
  }
  return ''
}

/**
 * Get first matching answer in the note for question
 * @param {ParsedQuestionType} parsedQuestion
 * @param {Array<string>} textLines
 * @returns {string}
 */
function extractExistingAnswerForReviewForm(parsedQuestion: ParsedQuestionType, textLines: Array<string>): string {
  for (let i = 0; i <= textLines.length - 1; i++) {
    const line = textLines[i]
    const v = extractExistingAnswerOnLine(parsedQuestion, line)
    if (v !== '') {
      return v
    }
  }
  return ''
}

/**
 * Map field names q_0, q_1, … to existing answers in the calendar note for pre-filling the review HTML form.
 * @tests in __tests__/periodReviews.test.js
 * @param {Array<ParsedQuestionType>} parsedQuestions
 * @param {Array<string>} textLines text of lines to scan
 * @returns {{ [string]: string }}
 */
export function buildInitialReviewAnswersByFieldName(
  parsedQuestions: Array<ParsedQuestionType>,
  textLines: Array<string>,
): { [string]: string } {
  const out: { [string]: string } = {}
  for (let i = 0; i < parsedQuestions.length; i++) {
    const pq = parsedQuestions[i]
    const v = extractExistingAnswerForReviewForm(pq, textLines)
    if (v !== '') {
      out[`q_${i}`] = v
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
  if (answer === '' && t !== 'subheading' && t !== 'h2' && t !== 'h3') {
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
    case 'duration': {
      if (RE_DURATION_HHMM.test(answer)) {
        return parsedQuestion.originalLine.startsWith('-') ? `- ${answer}` : parsedQuestion.originalLine.replace(/<duration>/, answer)
      }
      return ''
    }
    case 'string': {
      return parsedQuestion.originalLine.startsWith('-') ? `- ${answer}` : parsedQuestion.originalLine.replace(/<string>/, answer)
    }
    case 'mood': {
      return parsedQuestion.originalLine.replace(/<mood>/, answer)
    }
    case 'bullets':
    case 'checklists':
    case 'tasks': {
      const marker = linePrefixForMultilineAnswerType(t)
      const lines = answer.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '')
      if (lines.length === 0) {
        return ''
      }
      const formatted = lines.map((l) => `${marker}${l}`).join('\n')
      const ol = parsedQuestion.originalLine
      if (ol.trimStart().startsWith('-')) {
        return formatted
      }
      const { prefix, suffix } = splitParsedSegmentAtTypeMarker(ol, t)
      const prefixTrimmed = prefix.trimEnd()
      if (prefixTrimmed === '') {
        return `${formatted}${suffix}`
      }
      return `${prefixTrimmed}\n${formatted}${suffix}`
    }
    case 'subheading': {
      return handleSubheadingQuestion(parsedQuestion.question)
    }
    case 'h2': {
      return handleHeadingQuestion(parsedQuestion.question, 'h2')
    }
    case 'h3': {
      return handleHeadingQuestion(parsedQuestion.question, 'h3')
    }
    default: {
      return ''
    }
  }
}

/**
 * Build output from answers returned by single-window mode.
 * @tests in __tests__/periodReviews.test.js
 * @param {Array<ParsedQuestionType>} parsedQuestions
 * @param {Array<string>} rawQuestionLines
 * @param {string} periodString
 * @param {string} periodType for journal questions: 'day', 'week', 'month', 'quarter', 'year'
 * @param {{ [string]: string | boolean }} answersByIndex
 * @returns {string}
 */
export function buildOutputFromReviewWindowAnswers(
  parsedQuestions: Array<ParsedQuestionType>,
  rawQuestionLines: Array<string>,
  periodString: string,
  periodType: string,
  answersByIndex: { [string]: string | boolean },
): string {
  let output = ''
  const questionsByLine = groupQuestionsByLine(parsedQuestions)
  const lineCount = rawQuestionLines.length
  const stripPresentationDelimiters = (input: string): string => input.replace(/ \|\| /g, ' ')

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
    const lineQuestions = questionsByLine[lineIndex] ?? []
    const lineAnswers: Array<string> = []
    for (let i = 0; i < lineQuestions.length; i++) {
      const globalIndex = parsedQuestions.findIndex((q) => q === lineQuestions[i])
      const parsedQuestion = lineQuestions[i]
      const answer = answerFromReviewWindowPayload(parsedQuestion, answersByIndex[`q_${globalIndex}`] ?? '')
      if (answer !== '') {
        lineAnswers.push(answer)
      }
    }
    if (lineAnswers.length > 0) {
      const hasMultiline = lineAnswers.some((a) => a.includes('\n'))
      let combinedLine = hasMultiline ? lineAnswers.join('\n') : lineAnswers.join(' ')
      if (!hasMultiline) {
        combinedLine = combinedLine.replace(/\s+/g, ' ')
      }
      output += `${substituteReviewPeriodPlaceholders(combinedLine, periodString, periodType)}\n`
      continue
    }

    // If there are no questions/answers on this line, still carry `<date>` / `<datenext>` through into output.
    const rawLine = rawQuestionLines[lineIndex] ?? ''
    if (/<\s*date\s*>/i.test(rawLine) || /<\s*(?:datenext|nextdate)\s*>/i.test(rawLine)) {
      const substituted = substituteReviewPeriodPlaceholders(stripPresentationDelimiters(rawLine), periodString, periodType).trim()
      if (substituted !== '') {
        output += `${substituted}\n`
      }
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
 * @param {JournalConfigType} config
 * @param {Array<string>} rawQuestionLines lines from getQuestionsForPeriod (same array passed to parseQuestions)
 * @param {TNote} calendarNote the calendar note to scan for answers
 * @returns {void}
 */
async function displayQuestionsWindow(
  parsedQuestions: Array<ParsedQuestionType>,
  periodString: string,
  periodType: string,
  config: JournalConfigType,
  rawQuestionLines: Array<string>,
  calendarNote: TNote,
): Promise<void> {
  const periodAdjective = getPeriodAdjectiveFromType(periodType)
  // Get the data sources we need for the review window
  const summaryCompletedTasks = periodType === 'day' ? getSummaryCompletedTasks(periodType, periodString) : []
  const calendarSet: Array<string> = config.calendarSet ?? []
  // logDebug(pluginJson, `calendarSet: [${String(calendarSet)}]`)
  const eventsForPeriod: Array<TCalendarItem> = (periodType === 'day') ? await getEventsForDay(periodString, calendarSet) ?? [] : []
  const sectionHeading = getSectionHeadingForPeriod(config, periodType)
  const scanLines = getParagraphLineContentsForReviewScan(calendarNote, sectionHeading)
  const initialAnswers = buildInitialReviewAnswersByFieldName(parsedQuestions, scanLines)

  // Build the HTML body for the review window from this data
  const htmlBody = buildReviewHTML(
    config,
    parsedQuestions,
    rawQuestionLines,
    summaryCompletedTasks,
    periodString,
    periodType,
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
 * Write the collected answers to the note:
 * Add the finished review text to the current calendar note, appending after the configured heading for that period.
 * If the heading doesn't exist, then append it first.
 * @param {string} periodString the calendar note title string for the review period
 * @param {string} periodType for journal questions: 'day', 'week', 'month', 'quarter', 'year'
 * @param {string} answersText the text to insert into the journal
 * TODO(later): revert to being private, and take out of index.js & plugin.json
 */
export async function writeAnswersToNote(
  periodStringIn: string = '',
  periodTypeIn: string = '',
  answersTextIn: string = '',
): Promise<void> {
  try {
    const config: JournalConfigType = await getJournalSettings()
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
    logDebug(pluginJson, `Appending answers to heading '${sectionHeading}' in note ${displayTitle(Editor.note)}`)
    const matchedHeading = findHeadingStartsWith(outputNote, sectionHeading)
    outputNote.addParagraphBelowHeadingTitle(
      answersText,
      'empty',
      matchedHeading ? matchedHeading : sectionHeading,
      true,
      true)
  } catch (err) {
    logError(pluginJson, `writeAnswersToNote: ${err.message}`)
  }
}

//---------------------------------------------------------
// Callback function for HTML single-window review actions
//---------------------------------------------------------

/**
 * Callback function for HTML single-window review actions.
 * @param {string} actionName
 * @param {ReviewWindowPayloadType} payload
 */
export async function onReviewWindowAction(actionName: string, payload: string = ''): Promise<void> {
  logDebug(pluginJson, `onReviewWindowAction action=${actionName}`)
  // logDebug(pluginJson, `onReviewWindowAction payloadLength=${String(payload?.length ?? 0)} payloadPreview="${String(payload ?? '').slice(0, 100)}"`)
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
      const extractedAnswers = {}
      const keys = Object.keys(safePayload)
      for (const key of keys) {
        if (key.startsWith('q_')) {
          extractedAnswers[key] = safePayload[key]
        }
      }
      answers = extractedAnswers
    }
    const questionLines = await getQuestionsForPeriod(config, periodType)
    const parsedQuestions = parseQuestions(questionLines)
    const output = buildOutputFromReviewWindowAnswers(parsedQuestions, questionLines, periodString, periodType, answers)
    if (output !== '') {
      await writeAnswersToNote(periodString, periodType, output)
    } else {
      logWarn(pluginJson, 'No answers were collected from the review window')
    }
    logDebug('Journalling/onReviewWindowAction', `Finished.`)
    closeWindowFromCustomId(REVIEW_WINDOW_CUSTOM_ID)

  } catch (err) {
    logError(pluginJson, `onReviewWindowAction: couldn't parse payload JSON string: ${err.message}`)
  }
}
