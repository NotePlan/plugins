// @flow
//-----------------------------------------------------------------------------
// Daily Journal plugin for NotePlan
// Jonathan Clark
// last update 13.3.2022 for v0.12.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json' 
import { clo, log, logError } from '../../helpers/dev'
import { displayTitle } from '../../helpers/general'
import {
  getInputTrimmed,
  isInt,
  showMessage
} from '../../helpers/userInput'
import NPTemplating from 'NPTemplating'

//-----------------------------------------------------------------------------
// Settings

const configKey = 'dailyJournal'

type JournalConfigType = {
  templateTitle: string,
  reviewSectionHeading: string,
  reviewQuestions: string,
  moods: string
}

/**
 * Get or make config settings from _configuration, with no minimum required config
 * Updated for #ConfigV2
 * @author @jgclark
 */
async function getJournalSettings(): Promise<JournalConfigType> {
  // Wish the following was possible:
  // if (NotePlan.environment.version >= "3.4") {
  
  const tempConfig: JournalConfigType = DataStore.settings
  if ((tempConfig != null) && Object.keys(tempConfig).length > 0) {
    const config: JournalConfigType = tempConfig
    // $FlowFixMe
    clo(config, `\t${configKey} settings from V2:`)
    return config

  } else {
    // No longer support reading settings from _configuration
    logError(pluginJson, `couldn't read config for '${configKey}. Will use defaults instead.`)
    // Will just use defaults
    const config: JournalConfigType = {
      templateTitle: "Daily Note Template",
      reviewSectionHeading: "Journal",
      reviewQuestions: '@sleep(<number>)\\n@work(<number>)\\n@fruitveg(<int>)\\nMood:: <mood>\\nExercise:: <string>\\nGratitude:: <string>\\nGod was:: <string>\\nAlive:: <string>\\nNot Great:: <string>\\nWife:: <string>\\nRemember:: <string>',
      moods: "🤩 Great,🙂 Good,😇 Blessed,🥱 Tired,😫 Stressed,😤 Frustrated,😔 Low,🥵 Sick,Other"
    }
    return config
  }
}


//------------------------------------------------------------------
// Main functions

// Start today's daily note with the user's Daily Note Template
export async function todayStart(): Promise<void> {
  try {
    await dayStart(true)
  } catch (error) {
    await showMessage(error)
  }
}

// Start the currently open daily note with the user's Daily Note Template
export async function dayStart(today: boolean = false): Promise<void> {
  if (today) {
    // open today's date in the main window, and read content
    await Editor.openNoteByDate(new Date(), false)
  } else {
    // apply daily template in the currently open daily note
    if (Editor.type !== 'Calendar') {
      await showMessage('Note: /dayStart only works on calendar notes.')
      return
    }
    else if (Editor.note == null) {
      // we must be in an uninitialized Calendar note
      await showMessage('Error: this calendar note is not initialized. Stopping.')
      return
    }
  }
  // $FlowIgnore[incompatible-call]
  log(pluginJson, `for '${displayTitle(Editor.note)}'`)
  const config: JournalConfigType = await getJournalSettings()

  try {
    const result = await NPTemplating.renderTemplate(config.templateTitle)
    Editor.insertTextAtCursor(result)
  } catch (error) {
    logError(pluginJson, `${error} from todayStart() with template name '${config.templateTitle}'`)
  }  
}

//------------------------------------------------------------------
// Gather answers to set questions, and append to the daily note
export async function dayReview(): Promise<void> {
  if (Editor.note == null || Editor.type !== 'Calendar') {
    await showMessage('Please run again with a calendar note open.')
    return
  }

  const config: JournalConfigType = await getJournalSettings()
  const question = []
  const questionType = []
  let output = ''
  let i = 0

  // Parse preference string to make array of questions and input types
  const typeRE = new RegExp('<(.*)>')
  const questionLines = config.reviewQuestions.split('\n')
  const numQs = questionLines.length
  log(pluginJson, `\tFound ${numQs} question lines`)
  for (i = 0; i < numQs; i++) {
    // remove type indicators from the question string
    question[i] = questionLines[i].replace(/:|\(|\)|<string>|<int>|<number>|<mood>|<subheading>/g, '').trim()
    const reArray = questionLines[i].match(typeRE)
    questionType[i] = reArray?.[1] ?? '<error in question type>'
    // log(pluginJson, '\t' + i + ': ' + question[i] + ' / ' + questionType[i])
  }

  try {
    // Ask each question in turn
    for (i = 0; i < numQs; i++) {
      // Each question type is handled slightly differently, but in all cases a blank
      // or invalid answer means the question is ignored.
      let reviewLine = ''
      log(pluginJson, `\tQ${i}: ${question[i]} / ${questionType[i]}`)

      // Look to see if this question has already been put into the note with something following it.
      // If so, skip this question.
      const resAQ = returnAnsweredQuestion(question[i])
      if (resAQ !== '') {
        log(pluginJson, `\t  Found existing Q answer '${resAQ}', so won't ask again`)
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
            logError(pluginJson, `Failed to get integer answer for question '${question[i]}'`)
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
            logError(pluginJson, `Failed to get number answer for question '${question[i]}'`)
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
            log(pluginJson, `Null or empty string for answer to question '${question[i]}'`)
          }
          break
        }
        case 'mood': {
          // Some confusion as to which type is coming through from ConfigV1 and ConfigV2. 
          // So cope with either a string (to be turned into an array) or an array.
          const moodArray = (typeof config.moods === 'string') ? config.moods.split(',') : config.moods
          // $FlowFixMe
          const reply = await CommandBar.showOptions(moodArray, 'Choose most appropriate mood for today')
          const replyMood = moodArray[reply.index]
          if (replyMood != null && replyMood !== '') {
            reviewLine = `${questionLines[i].replace(/<mood>/, replyMood)}`
          } else {
            logError(pluginJson, 'Failed to get mood answer')
          }
          break
        }
        case 'subheading': {
          reviewLine = '\n### '.concat(question[i].replace(/<subheading>/, ''))
          break
        }
      }
      // log(pluginJson, `\tAnswer to '${question[i]}' = ${reviewLine[i]}`)
      if (reviewLine !== '') {
        output += `${reviewLine}\n`
      }
    }

    // Add the finished review text to the current daily note,
    // appending after the line found in config.reviewSectionHeading.
    // If this doesn't exist, then append it first.
    log(pluginJson, `\tAppending answers to heading '${config.reviewSectionHeading}'`)
    Editor.addParagraphBelowHeadingTitle(output, 'empty', config.reviewSectionHeading, true, true)
  } catch (e) {
    if (e === 'cancelled') {
      log(pluginJson, `Asking questions cancelled by user: stopping.`)
    } else {
      log(pluginJson, `Stopping, following error ${e}.`)
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
  for (let p of paragraphs) {
    let m = p.content.match(RE_Q)
    if (m != null) {
      result = m[0]
    }
  }
  return result
}
