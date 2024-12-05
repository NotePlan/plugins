// @flow
//---------------------------------------------------------------
// Helper functions for Journalling plugin for NotePlan
// Jonathan Clark
// last update 23.11.2022 for v0.15.0 by @jgclark
//---------------------------------------------------------------

import pluginJson from '../plugin.json'
import strftime from 'strftime'
// import { getWeek, isDailyNote, isWeeklyNote } from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { findHeadingStartsWith } from '@helpers/paragraph'
import { getInputTrimmed, isInt, showMessage } from '@helpers/userInput'

//---------------------------------------------------------------
// Settings

const pluginID = 'jgclark.DailyJournal' // now out of date, but tricky to rename

export type JournalConfigType = {
  templateTitle: string, // named over a year before weekly notes became possible
  weeklyTemplateTitle: string,
  monthlyTemplateTitle: string,
  reviewSectionHeading: string,
  reviewQuestions: string, // named over a year before weekly notes became possible
  weeklyReviewQuestions: string,
  monthlyReviewQuestions: string,
  quarterlyReviewQuestions: string,
  yearlyReviewQuestions: string,
  moods: string
}

/**
 * Get or make config settings
 * @author @jgclark
 */
export async function getJournalSettings(): Promise<any> { // want to use Promise<JournalConfigType> but too many flow errors result
  try {
    const tempConfig: JournalConfigType = DataStore.settings
    if ((tempConfig != null) && Object.keys(tempConfig).length > 0) {
      const config: JournalConfigType = tempConfig
      // clo(config, `\t${pluginID} settings from V2:`)
      return config
    } else {
      throw new Error(`couldn't read settings for '${pluginID}.`)
    }
  }
  catch (error) {
    logError(pluginJson, `getJournalSettings: ${error.message}`)
    return // for completeness
  }
}

/**
 * Process questions for the given period, and write to the current note.
 * @author @jgclark
 * @param {string} period for journal questions
 */
export async function processJournalQuestions(period: string): Promise<void> {
  try {
    // Work out which note to output to
    let outputNote = Editor
    if (Editor.note == null || Editor.type !== 'Calendar') {
      logError(pluginJson, `Editor isn't open with a Calendar note open. Stopping.`)
      await showMessage('Please run again with a calendar note open.')
      return
    }

    const config: JournalConfigType = await getJournalSettings()
    let questionLines: Array<string> = []
    switch (period) {
      case 'day': {
        questionLines = config.reviewQuestions.split('\n')
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
      question[i] = questionLines[i].replace(/:|\(|\)|<string>|<int>|<number>|<mood>|<subheading>/g, '').trim()
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
      switch (questionType[i]) {
        case 'int': {
          let reply = await getInputTrimmed(`Please enter an integer`, 'OK', `Journal Q: ${question[i]}?`)
          if (typeof reply === 'boolean') {
            throw ('cancelled')
          }
          reply = String(reply) // shouldn't be needed, but avoids Flow errors
          if (isInt(reply)) {
            if (questionLines[i].startsWith('-')) {
              reviewLine = `- ${reply}`
            } else {
              reviewLine = questionLines[i].replace(/<int>/, reply)
            }
          } else {
            logWarn(pluginJson, `- Failed to get integer answer for question '${question[i]}'`)
          }
          break
        }
        case 'number': {
          let reply = await getInputTrimmed(`Please enter a number`, 'OK', `Journal Q: ${question[i]}?`)
          if (typeof reply === 'boolean') {
            throw ('cancelled')
          }
          reply = String(reply) // shouldn't be needed, but avoids Flow errors
          if (reply != null && Number(reply)) {
            if (questionLines[i].startsWith('-')) {
              reviewLine = `- ${reply}`
            } else {
              reviewLine = questionLines[i].replace(/<number>/, reply)
            }
          } else {
            logWarn(pluginJson, `Failed to get number answer for question '${question[i]}'`)
          }
          break
        }
        case 'string': {
          let reply = await getInputTrimmed(`Please enter text`, 'OK', `Journal Q: ${question[i]}?`)
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
            logWarn(pluginJson, `- Null or empty string for answer to question '${question[i]}'`)
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
            logWarn(pluginJson, '- Failed to get mood answer')
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
export function returnAnsweredQuestion(question: string): string {
  const RE_Q = `${question}.+`
  const { paragraphs } = Editor
  let result = ''
  for (let p of paragraphs) {
    let m = p.content.match(RE_Q)
    if (m != null) {
      result = m[0]
    }
  }
  return result
}
