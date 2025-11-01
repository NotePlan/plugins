// @flow
//---------------------------------------------------------------
// Journalling commands
// Jonathan Clark
// last update 2025-11-01 for v1.15.2 by @jgclark
//---------------------------------------------------------------

import strftime from 'strftime'
import pluginJson from '../plugin.json'
import { getJournalSettings } from './journalHelpers'
import type { JournalConfigType } from './journalHelpers'
import { displayTitle } from '@helpers/general'
import { findHeadingStartsWith } from '@helpers/paragraph'
import { getWeek, getPeriodOfNPDateStr, isDailyNote, isWeeklyNote, isMonthlyNote, isQuarterlyNote, isYearlyNote } from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getInputTrimmed, isInt, showMessage, showMessageYesNoCancel } from '@helpers/userInput'

//---------------------------------------------------------------

/**
 * Gather answers to daily journal questions, and inserts at the cursor.
 * First checks to see if we're in a daily note; if not, offer to open current daily note first.
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
 * First checks to see if we're in a weekly note; if not, offer to open current weekly note first.
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
 * First checks to see if we're in a monthly note; if not, offer to open current monthly note first.
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
 * First checks to see if we're in a quarterly note; if not, offer to open the current one first.
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
 * First checks to see if we're in a yearly note; if not, offer to open the current one first.
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
 * Ensure the correct period note is open, or open it if user requests.
 * @param {string} period for journal questions: 'day', 'week', 'month', 'quarter', 'year'
 * @param {string} periodAdjective adjective for period: 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'
 * @return {Promise<boolean>} true if we should continue, false if cancelled
 */
async function ensureCorrectPeriodNote(period: string, periodAdjective: string): Promise<boolean> {
  // Open current calendar note if wanted
  const { note } = Editor
  const currentNotePeriod = (note && note.type === 'Calendar') ? getPeriodOfNPDateStr(note.title ?? '') : ''
  if (currentNotePeriod === '' || currentNotePeriod === 'error' || currentNotePeriod !== period) {
    const res = await showMessageYesNoCancel(
      `You don't currently have a ${periodAdjective} note open. Would you like me to open the current ${periodAdjective} note first?`,
      ['Yes', 'No', 'Cancel'],
      `${periodAdjective} Journal`
    )
    switch (res) {
      case 'Yes': {
        Editor.openNoteByDate(new Date(), false, 0, 0, false, period)
        break
      }
      case 'No': {
        break
      }
      case 'Cancel': {
        return false
      }
    }
  }
  return true
}

/**
 * Get question lines for the given period from config.
 * @param {JournalConfigType} config the journal configuration
 * @param {string} period for journal questions: 'day', 'week', 'month', 'quarter', 'year'
 * @return {Promise<Array<string>>} array of question lines, or empty array if unsupported
 */
async function getQuestionsForPeriod(config: JournalConfigType, period: string): Promise<Array<string>> {
  let questionLines: Array<string> = []
  switch (period) {
    case 'day': {
      questionLines = config.dailyReviewQuestions.split('\n')
      break
    }
    case 'week': {
      questionLines = config.weeklyReviewQuestions.split('\n')
      break
    }
    case 'month': {
      questionLines = config.monthlyReviewQuestions.split('\n')
      break
    }
    case 'quarter': {
      questionLines = config.quarterlyReviewQuestions.split('\n')
      break
    }
    case 'year': {
      questionLines = config.yearlyReviewQuestions.split('\n')
      break
    }
    default: {
      logError(pluginJson, `${period} review questions aren't yet supported. Stopping.`)
      await showMessage(`Sorry, ${period} review questions aren't yet supported.`)
      return []
    }
  }
  return questionLines
}

/**
 * Parse question lines to extract questions and their types.
 * @param {Array<string>} questionLines raw question lines from config
 * @return {Array<{question: string, type: string, originalLine: string}>} parsed questions with types
 */
function parseQuestions(questionLines: Array<string>): Array<{ question: string, type: string, originalLine: string }> {
  const parsed = []
  const typeRE = new RegExp('<(.*)>')

  // remove type indicators from the question string
  for (let i = 0; i < questionLines.length; i++) {
    const question = questionLines[i].replace(/:|\(|\)|<string>|<int>|<number>|<boolean>|<mood>|<subheading>/g, '').trim()
    const reArray = questionLines[i].match(typeRE)
    const questionType = reArray?.[1] ?? '<error in question type>'
    // logDebug(pluginJson, '- ' + i + ': ' + question + ' / ' + questionType)
    parsed.push({ question, type: questionType, originalLine: questionLines[i] })
  }

  return parsed
}

/**
 * Handle a boolean question type.
 * @param {string} questionText the question text
 * @return {Promise<string>} the answer line, or empty string if not answered
 */
async function handleBooleanQuestion(questionText: string): Promise<string> {
  const reply = await showMessageYesNoCancel(`Was '${questionText}' done?`, ['Yes', 'No', 'Cancel'])
  if (reply === 'Cancel') {
    // There is no need to create a new Error object here because the string 'cancelled' is being used simply as a signal to indicate an early exit or cancellation. 
    // If error stack traces or catching by error type is not needed, just throwing a string suffices.
    throw 'cancelled'
  }
  if (reply === 'Yes') {
    return questionText
  }
  return ''
}

/**
 * Handle an integer question type.
 * @param {string} questionText the question text
 * @param {string} originalLine the original question line from config
 * @return {Promise<string>} the answer line, or empty string if invalid
 */
async function handleIntQuestion(questionText: string, originalLine: string): Promise<string> {
  const reply = await getInputTrimmed(`Please enter an integer`, 'OK', `Journal Q: ${questionText}?`)
  if (typeof reply === 'boolean') {
    throw ('cancelled')
  }
  if (isInt(reply)) {
    if (originalLine.startsWith('-')) {
      return `- ${reply}`
    } else {
      return originalLine.replace(/<int>/, reply)
    }
  } else {
    logInfo(pluginJson, `- Failed to get integer answer for question '${questionText}'`)
  }
  return ''
}

/**
 * Handle a number question type.
 * @param {string} questionText the question text
 * @param {string} originalLine the original question line from config
 * @return {Promise<string>} the answer line, or empty string if invalid
 */
async function handleNumberQuestion(questionText: string, originalLine: string): Promise<string> {
  const reply = await getInputTrimmed(`Please enter a number`, 'OK', `Journal Q: ${questionText}?`)
  if (typeof reply === 'boolean') {
    throw ('cancelled')
  }
  if (reply != null && Number(reply)) {
    if (originalLine.startsWith('-')) {
      return `- ${reply}`
    } else {
      return originalLine.replace(/<number>/, reply)
    }
  } else {
    logInfo(pluginJson, `Failed to get number answer for question '${questionText}'`)
  }
  return ''
}

/**
 * Handle a string question type.
 * @param {string} questionText the question text
 * @param {string} originalLine the original question line from config
 * @return {Promise<string>} the answer line, or empty string if invalid
 */
async function handleStringQuestion(questionText: string, originalLine: string): Promise<string> {
  const reply = await getInputTrimmed(`Please enter text`, 'OK', `Journal Q: ${questionText}?`)
  if (typeof reply === 'boolean') {
    throw ('cancelled')
  }
  const replyString = String(reply) // shouldn't be needed, but avoids Flow errors
  if (replyString != null && replyString !== '') {
    if (originalLine.startsWith('-')) {
      return `- ${replyString}`
    } else {
      return replyString !== '' ? originalLine.replace(/<string>/, replyString) : ''
    }
  } else {
    logInfo(pluginJson, `- Null or empty string for answer to question '${questionText}'`)
  }
  return ''
}

/**
 * Handle a mood question type.
 * @param {string} originalLine the original question line from config
 * @param {JournalConfigType} config the journal configuration
 * @return {Promise<string>} the answer line, or empty string if invalid
 */
async function handleMoodQuestion(originalLine: string, config: JournalConfigType): Promise<string> {
  // Some confusion as to which type is coming through from ConfigV1 and ConfigV2. 
  // So cope with either a string (to be turned into an array) or an array.
  const moodArray = (typeof config.moods === 'string') ? config.moods.split(',') : config.moods
  const reply = await CommandBar.showOptions(moodArray, 'Choose most appropriate mood for today')
  const replyMood = moodArray[reply.index]
  if (replyMood != null && replyMood !== '') {
    return `${originalLine.replace(/<mood>/, replyMood)}`
  } else {
    logInfo(pluginJson, '- Failed to get mood answer')
  }
  return ''
}

/**
 * Handle a subheading question type.
 * @param {string} question the question text
 * @return {string} the formatted subheading line
 */
function handleSubheadingQuestion(question: string): string {
  return '\n### '.concat(question.replace(/<subheading>/, ''))
}

/**
 * Process a single question and get its answer.
 * @param {Object} parsedQuestion parsed question object with question, type, and originalLine
 * @param {number} index the question index
 * @param {JournalConfigType} config the journal configuration
 * @return {Promise<string>} the answer line, or empty string if skipped/invalid
 */
async function processQuestion(parsedQuestion: { question: string, type: string, originalLine: string }, index: number, config: JournalConfigType): Promise<string> {
  // Each question type is handled slightly differently, but in all cases a blank
  // or invalid answer means the question is ignored.
  let reviewLine = ''
  logDebug(pluginJson, `Q${index}: ${parsedQuestion.question} / ${parsedQuestion.type}`)

  // Look to see if this question has already been put into the note with something following it.
  // If so, skip this question.
  const resAQ = returnAnsweredQuestion(parsedQuestion.question)
  if (resAQ !== '') {
    logDebug(pluginJson, `- Found existing Q answer '${resAQ}', so won't ask again`)
    return ''
  }

  // ask question, according to its type
  const questionText = parsedQuestion.question
  switch (parsedQuestion.type) {
    case 'boolean': {
      reviewLine = await handleBooleanQuestion(questionText)
      break
    }
    case 'int': {
      reviewLine = await handleIntQuestion(questionText, parsedQuestion.originalLine)
      break
    }
    case 'number': {
      reviewLine = await handleNumberQuestion(questionText, parsedQuestion.originalLine)
      break
    }
    case 'string': {
      reviewLine = await handleStringQuestion(questionText, parsedQuestion.originalLine)
      break
    }
    case 'mood': {
      reviewLine = await handleMoodQuestion(parsedQuestion.originalLine, config)
      break
    }
    case 'subheading': {
      reviewLine = handleSubheadingQuestion(parsedQuestion.question)
      break
    }
  }
  logDebug(pluginJson, `- A${index} = ${reviewLine}`)
  return reviewLine !== '' ? `${reviewLine}\n` : ''
}

/**
 * Write the collected answers to the note.
 * @param {string} output the formatted output text
 * @param {JournalConfigType} config the journal configuration
 */
function writeAnswersToNote(output: string, config: JournalConfigType): void {
  // Add the finished review text to the current calendar note,
  // appending after the line found in config.reviewSectionHeading.
  // If this doesn't exist, then append it first.
  // $FlowIgnore(incompatible-call) .note is a superset of CoreNoteFields
  const outputNote = Editor
  // $FlowIgnore[incompatible-call] .note is a superset of CoreNoteFields
  logDebug(pluginJson, `Appending answers to heading '${config.reviewSectionHeading}' in note ${displayTitle(Editor.note)}`)
  const matchedHeading = findHeadingStartsWith(outputNote, config.reviewSectionHeading)
  outputNote.addParagraphBelowHeadingTitle(output,
    'empty',
    matchedHeading ? matchedHeading : config.reviewSectionHeading,
    true,
    true)
}

/**
 * Process questions for the given period, and write to the current note.
 * @author @jgclark
 * @param {string} period for journal questions: 'day', 'week', 'month', 'quarter', 'year'
 * @param {string} periodAdjective adjective for period: 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'
 */
async function processJournalQuestions(period: string, periodAdjective: string = ''): Promise<void> {
  try {
    // Ensure correct period note is open
    const shouldContinue = await ensureCorrectPeriodNote(period, periodAdjective)
    if (!shouldContinue) {
      return
    }

    // Get configuration and questions
    const config: JournalConfigType = await getJournalSettings()
    const questionLines = await getQuestionsForPeriod(config, period)

    // Only continue if we have some questions
    const numQs = questionLines.length
    if (!questionLines || numQs === 0 || questionLines[0] === '') {
      await showMessage(`No questions for ${period} found in the plugin settings, so cannot continue.`)
      throw new Error(`No questions for ${period} found in the plugin settings, so cannot continue.`)
    }

    logDebug(pluginJson, `Found ${numQs} question lines for ${period}`)

    // Parse questions
    const parsedQuestions = parseQuestions(questionLines)

    // Process all questions and collect answers
    let output = ''
    for (let i = 0; i < parsedQuestions.length; i++) {
      const answerLine = await processQuestion(parsedQuestions[i], i, config)
      output += answerLine
    }

    // Write answers to note
    if (output !== '') {
      writeAnswersToNote(output, config)
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
 * Look to see if this question has already been answered.
 * If so return the line's content.
 * @author @jgclark
 * 
 * @param {string} question
 * @return {string} found answered question, or empty string
 */
function returnAnsweredQuestion(question: string): string {
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
