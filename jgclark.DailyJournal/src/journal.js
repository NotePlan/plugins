// @flow
//---------------------------------------------------------------
// Journalling commands
// Jonathan Clark
// last update 2025-10-16 for v1.0.1 by @jgclark
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

/**
 * Process questions for the given period, and write to the current note.
 * @author @jgclark
 * @param {string} period for journal questions: 'day', 'week', 'month', 'quarter', 'year'
 * @param {string} periodAdjective adjective for period: 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'
 */
async function processJournalQuestions(period: string, periodAdjective: string = ''): Promise<void> {
  try {
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
          return
        }
      }
    }

    // Work out which note to output to
    const outputNote = Editor

    const config: JournalConfigType = await getJournalSettings()
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
        return
      }
    }

    // Only continue if we have some questions
    const numQs = questionLines.length
    if (!questionLines || numQs === 0 || questionLines[0] === '') {
      await showMessage(`No questions for ${period} found in the plugin settings, so cannot continue.`)
      throw new Error(`No questions for ${period} found in the plugin settings, so cannot continue.`)
    }

    const question = []
    const questionType = []
    let output = ''
    let i = 0
    const typeRE = new RegExp('<(.*)>')
    logDebug(pluginJson, `Found ${numQs} question lines for ${period}`)

    // remove type indicators from the question string
    for (i = 0; i < numQs; i++) {
      question[i] = questionLines[i].replace(/:|\(|\)|<string>|<int>|<number>|<boolean>|<mood>|<subheading>/g, '').trim()
      const reArray = questionLines[i].match(typeRE)
      questionType[i] = reArray?.[1] ?? '<error in question type>'
      // logDebug(pluginJson, '- ' + i + ': ' + question[i] + ' / ' + questionType[i])
    }

    // Ask each question in turn
    for (i = 0; i < numQs; i++) {
      // Each question type is handled slightly differently, but in all cases a blank
      // or invalid answer means the question is ignored.
      let reviewLine = ''
      logDebug(pluginJson, `Q${i}: ${question[i]} / ${questionType[i]}`)

      // Look to see if this question has already been put into the note with something following it.
      // If so, skip this question.
      const resAQ = returnAnsweredQuestion(question[i])
      if (resAQ !== '') {
        logDebug(pluginJson, `- Found existing Q answer '${resAQ}', so won't ask again`)
        continue
      }

      // ask question, according to its type
      const questionText = question[i]
      switch (questionType[i]) {
        case 'boolean': {
          const reply = await showMessageYesNoCancel(`Was '${questionText}' done?`, ['Yes', 'No', 'Cancel'])
          if (reply === 'Cancel') {
            throw ('cancelled')
          }
          if (reply === 'Yes') {
            reviewLine = questionText
          }
          break
        }
        case 'int': {
          const reply = await getInputTrimmed(`Please enter an integer`, 'OK', `Journal Q: ${questionText}?`)
          if (typeof reply === 'boolean') {
            throw ('cancelled')
          }
          if (isInt(reply)) {
            if (questionLines[i].startsWith('-')) {
              reviewLine = `- ${reply}`
            } else {
              reviewLine = questionLines[i].replace(/<int>/, reply)
            }
          } else {
            logInfo(pluginJson, `- Failed to get integer answer for question '${questionText}'`)
          }
          break
        }
        case 'number': {
          const reply = await getInputTrimmed(`Please enter a number`, 'OK', `Journal Q: ${questionText}?`)
          if (typeof reply === 'boolean') {
            throw ('cancelled')
          }
          if (reply != null && Number(reply)) {
            if (questionLines[i].startsWith('-')) {
              reviewLine = `- ${reply}`
            } else {
              reviewLine = questionLines[i].replace(/<number>/, reply)
            }
          } else {
            logInfo(pluginJson, `Failed to get number answer for question '${questionText}'`)
          }
          break
        }
        case 'string': {
          const reply = await getInputTrimmed(`Please enter text`, 'OK', `Journal Q: ${questionText}?`)
          if (typeof reply === 'boolean') {
            throw ('cancelled')
          }
          const replyString = String(reply) // shouldn't be needed, but avoids Flow errors
          if (replyString != null && replyString !== '') {
            if (questionLines[i].startsWith('-')) {
              reviewLine = `- ${replyString}`
            } else {
              reviewLine = replyString !== '' ? questionLines[i].replace(/<string>/, replyString) : ''
            }
          } else {
            logInfo(pluginJson, `- Null or empty string for answer to question '${questionText}'`)
          }
          break
        }
        case 'mood': {
          // Some confusion as to which type is coming through from ConfigV1 and ConfigV2. 
          // So cope with either a string (to be turned into an array) or an array.
          const moodArray = (typeof config.moods === 'string') ? config.moods.split(',') : config.moods
          const reply = await CommandBar.showOptions(moodArray, 'Choose most appropriate mood for today')
          const replyMood = moodArray[reply.index]
          if (replyMood != null && replyMood !== '') {
            reviewLine = `${questionLines[i].replace(/<mood>/, replyMood)}`
          } else {
            logInfo(pluginJson, '- Failed to get mood answer')
          }
          break
        }
        case 'subheading': {
          reviewLine = '\n### '.concat(question[i].replace(/<subheading>/, ''))
          break
        }
      }
      logDebug(pluginJson, `- A${i} = ${reviewLine[i]}`)
      if (reviewLine !== '') {
        output += `${reviewLine}\n`
      }
    }

    // Add the finished review text to the current calendar note,
    // appending after the line found in config.reviewSectionHeading.
    // If this doesn't exist, then append it first.
    // $FlowIgnore(incompatible-call) .note is a superset of CoreNoteFields
    logDebug(pluginJson, `Appending answers to heading '${config.reviewSectionHeading}' in note ${displayTitle(Editor.note)}`)
    const matchedHeading = findHeadingStartsWith(outputNote, config.reviewSectionHeading)
    outputNote.addParagraphBelowHeadingTitle(output,
      'empty',
      matchedHeading ? matchedHeading : config.reviewSectionHeading,
      true,
      true)
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
