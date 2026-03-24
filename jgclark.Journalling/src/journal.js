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
import { showHTMLV2 } from '@helpers/HTMLView'
import type { HtmlWindowOptions } from '@helpers/HTMLView'
import { displayTitle } from '@helpers/general'
import { closeWindowFromCustomId } from '@helpers/NPWindows'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import { findHeadingStartsWith } from '@helpers/paragraph'
import { getWeek, getPeriodOfNPDateStr, isDailyNote, isWeeklyNote, isMonthlyNote, isQuarterlyNote, isYearlyNote } from '@helpers/dateTime'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { isInt, showMessage } from '@helpers/userInput'

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

    await processJournalQuestions('day', 'Daily')
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

    await processJournalQuestions('week', 'Weekly')
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

    await processJournalQuestions('month', 'Monthly')
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

    await processJournalQuestions('quarter', 'Quarterly')
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

    await processJournalQuestions('year', 'Yearly')
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

    for (const questionPart of questionParts) {
      const segments = questionPart.match(segmentRE) ?? []
      for (const segmentRaw of segments) {
        const segment = segmentRaw.trim()
        const reArray = segment.match(typeRE)
        const questionType = reArray?.[1] ?? '<error in question type>'
        // Prefer #/@ tokens when present (e.g. #bible<boolean>, @sleep(<int>))
        const tokenMatch = segment.match(/([@#][^\s(<]+)/)
        const question = tokenMatch?.[1]
          ?? segment.replace(/\(|\)|<string>|<int>|<number>|<boolean>|<mood>|<subheading>/gi, '').trim()
        logDebug(pluginJson, `- Q#${String(lineIndex)}: Line ${lineIndex}, type:${questionType} "${question}"`)
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
 * Wait for submit/cancel payload from single-window HTML form.
 * @returns {Promise<ReviewWindowPayloadType>}
 */
function waitForReviewWindowPayload(): Promise<ReviewWindowPayloadType> {
  return new Promise((resolve) => {
    reviewWindowResolve = resolve
  })
}

/**
 * Convert answer payload from single window into output line for one parsed question.
 * @param {ParsedQuestionType} parsedQuestion
 * @param {string} answerRaw
 * @returns {string}
 */
function answerFromReviewWindowPayload(parsedQuestion: ParsedQuestionType, answerRaw: string): string {
  const answer = answerRaw.trim()
  if (answer === '') {
    return ''
  }
  switch (parsedQuestion.type) {
    case 'boolean': {
      return answer === 'yes' ? parsedQuestion.question : ''
    }
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
 * @param {{ [string]: string }} answersByIndex
 * @returns {string}
 */
function buildOutputFromReviewWindowAnswers(parsedQuestions: Array<ParsedQuestionType>, answersByIndex: { [string]: string }): string {
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
 * Display all questions in the window and return the answers.
 * @param {Array<ParsedQuestionType>} parsedQuestions
 * @param {string} period
 * @param {string} periodAdjective
 * @param {JournalConfigType} config
 * @param {Array<string>} rawQuestionLines lines from getQuestionsForPeriod (same array passed to parseQuestions)
 * @returns {Promise<string>}
 */
async function displayQuestionsWindow(
  parsedQuestions: Array<ParsedQuestionType>,
  period: string,
  periodAdjective: string,
  config: JournalConfigType,
  rawQuestionLines: Array<string>,
): Promise<string> {
  const periodTitle = getReviewPeriodTitle(period)
  const htmlBody = buildReviewHTML(config, parsedQuestions, rawQuestionLines, periodAdjective, period, periodTitle, REVIEW_WINDOW_CALLBACK_COMMAND)
  const preferredWindowType = config.preferredWindowType ?? 'New Window'
  const windowOptions: HtmlWindowOptions = {
    customId: REVIEW_WINDOW_CUSTOM_ID,
    windowTitle: `${periodAdjective} Review for ${periodTitle}`,
    headerTags: `${faLinksInHeader}${stylesheetinksInHeader}`,
    savedFilename: `../../jgclark.Journalling/period-review-${period}.html`,
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
  const payload = await waitForReviewWindowPayload()
  await closeWindowFromCustomId(REVIEW_WINDOW_CUSTOM_ID)
  if ((payload.action ?? '') === 'cancel') {
    throw 'cancelled'
  }
  const answers = payload.answers ?? {}
  return buildOutputFromReviewWindowAnswers(parsedQuestions, answers)
}

/**
 * Write the collected answers to the note:
 * Add the finished review text to the current calendar note, appending after the line found in config.reviewSectionHeading.
 * If the heading doesn't exist, then append it first.
 * @param {JournalConfigType} config the journal configuration
 * @param {string} periodString the calendar note title string for the review period
 * @param {string} answersText the text to insert into the journal
 */
function writeAnswersToNote(
  config: JournalConfigType,
  periodString: string,
  answersText: string,
): void {
  // Get the correct Editor for the calendar note
  // TODO: find the right existing helper function to use periodString to get the correct note
  
  // $FlowIgnore(incompatible-call) .note is a superset of CoreNoteFields
  const outputNote = Editor
  // $FlowIgnore[incompatible-call] .note is a superset of CoreNoteFields
  logDebug(pluginJson, `Appending answers to heading '${config.reviewSectionHeading}' in note ${displayTitle(Editor.note)}`)
  const matchedHeading = findHeadingStartsWith(outputNote, config.reviewSectionHeading)
  outputNote.addParagraphBelowHeadingTitle(answersText,
    'empty',
    matchedHeading ? matchedHeading : config.reviewSectionHeading,
    true,
    true)
}

/**
 * Process questions for the given period, and write to the current note.
 * If we're not in the correct note, offer to open it first.
 * @author @jgclark
 * @param {string} periodType for journal questions: 'day', 'week', 'month', 'quarter', 'year'
 * @param {string} periodAdjective adjective for period: 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'
 */
async function processJournalQuestions(
  periodType: string,
  periodAdjective: string = ''
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

    const periodString = reviewNote.title ?? ''

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

    const output = await displayQuestionsWindow(parsedQuestions, periodType, periodAdjective, config, questionLines)

    // Write answers to note
    if (output !== '') {
      writeAnswersToNote(config, periodString, output)
    } else {
      logWarn(pluginJson, 'No answers were collected from the review window')
    }
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
      writeAnswersToNote(config, periodString, output)
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
