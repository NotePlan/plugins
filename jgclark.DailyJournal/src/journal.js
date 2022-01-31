// @flow
//-----------------------------------------------------------------------------
// Daily Journal plugin for NotePlan
// Jonathan Clark
// last update 29.1.2022 for v0.11.1 by @jgclark
// TODO: use a new config.* Type
// TODO: then switch to ConfigV2
//-----------------------------------------------------------------------------

import { getInputTrimmed, isInt, showMessage } from '../../helpers/userInput'
import { displayTitle } from '../../helpers/general'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'
import { applyNamedTemplate } from '../../nmn.Templates/src/index'

//-----------------------------------------------------------------------------
// Settings
const DEFAULT_JOURNAL_OPTIONS = `  dailyJournal: {
    templateTitle: 'Daily Note Template',
    reviewSectionHeading: 'Journal',
    moods: '🤩 Great,🙂 Good,😇 Blessed,🥱 Tired,😫 Stressed,😤 Frustrated,😔 Low,🥵 Sick,Other',
    reviewQuestions: '@sleep(<number>)\\n@work(<number>)\\n@fruitveg(<int>)\\nMood:: <mood>\\nExercise:: <string>\\nGratitude:: <string>\\nGod was:: <string>\\nAlive:: <string>\\nNot Great:: <string>\\nWife:: <string>\\nRemember:: <string>'
  },
`
const MINIMUM_JOURNAL_OPTIONS = {
  reviewQuestions: 'string',
}

const defaultTemplateTitle = 'Daily Note Template'
let pref_templateTitle: string
let pref_reviewSectionHeading: string
let pref_reviewQuestions: string
let pref_moodArray: Array<string>

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
  console.log(`dayStart: ${displayTitle(Editor.note)}`)

  // Get config settings from Template folder _configuration note
  const journalConfig = await getOrMakeConfigurationSection(
    'dailyJournal',
    DEFAULT_JOURNAL_OPTIONS,
    MINIMUM_JOURNAL_OPTIONS,
  )
  if (journalConfig == null
    || Object.keys(journalConfig).length === 0) // this is how to check for empty object
  {
    console.log(`\tWarning: Cannot find suitable 'dailyJournal' settings in Templates/_configuration note. Stopping.`)
    await showMessage(
      `Cannot find 'dailyJournal' settings in _configuration.`,
      `Yes, I'll check my _configuration settings.`,
    )
    return
  }
  pref_templateTitle = (journalConfig?.templateTitle != null)
    ? String(journalConfig?.templateTitle)
    : defaultTemplateTitle

  await applyNamedTemplate(pref_templateTitle)
}

//------------------------------------------------------------------
// Gather answers to set questions, and append to the daily note
export async function dayReview(): Promise<void> {
  if (Editor.note == null || Editor.type !== 'Calendar') {
    await showMessage('Please run again with a calendar note open.')
    return
  }

  // Get config settings from Template folder _configuration note
  const journalConfig = await getOrMakeConfigurationSection(
    'dailyJournal',
    DEFAULT_JOURNAL_OPTIONS,
    MINIMUM_JOURNAL_OPTIONS,
  )

  if (journalConfig == null
    || Object.keys(journalConfig).length === 0) // this is how to check for empty object
  {
    console.log(`\tWarning: Cannot find suitable 'dailyJournal' settings in Templates/_configuration note. Stopping.`)
    await showMessage(
      `Cannot find 'dailyJournal' settings in _configuration.`,
      `Yes, I'll check my settings.`,
    )
    return
  }
  // Finalise config settings
  const pref_reviewQuestions = (journalConfig?.reviewQuestions != null)
    ? String(journalConfig?.reviewQuestions)
    : '@sleep(<number>)\\n@work(<number>)\\n@fruitveg(<int>)\\nMood:: <mood>\\nExercise: <string>\\nGratitude: <string>\\nGod was: <string>\\nAlive: <string>\\nNot Great: <string>\\nWife: <string>\\nRemember: <string>'
  pref_reviewSectionHeading = (journalConfig?.reviewSectionHeading != null)
    ? String(journalConfig?.reviewSectionHeading)
    : 'Journal'
  const pref_moods =
    String(journalConfig.moods) ??
    [
      '🤩 Great',
      '🙂 Good',
      '😇 Blessed',
      '🥱 Tired',
      '😫 Stressed',
      '😤 Frustrated',
      '😡 Angry',
      '😔 Low',
      '🥵 Sick',
      'Other',
    ].join(',')

  pref_moodArray = pref_moods.split(',') // with a proper config system, this won't be needed

  const question = []
  const questionType = []
  let output = ''
  let i = 0

  // Parse preference string to make array of questions and input types
  const typeRE = new RegExp('<(.*)>')
  const questionLines = pref_reviewQuestions.split('\n')
  const numQs = questionLines.length
  console.log(`\tFound ${numQs} question lines`)
  for (i = 0; i < numQs; i++) {
    // remove type indicators from the question string
    question[i] = questionLines[i].replace(/:|\(|\)|<string>|<int>|<number>|<mood>|<subheading>/g, '').trim()
    const reArray = questionLines[i].match(typeRE)
    questionType[i] = reArray?.[1] ?? '<error in question type>'
    // console.log('\t' + i + ': ' + question[i] + ' / ' + questionType[i])
  }

  try {
    // Ask each question in turn
    for (i = 0; i < numQs; i++) {
      // Each question type is handled slightly differently, but in all cases a blank
      // or invalid answer means the question is ignored.
      let reviewLine = ''
      console.log(`\tQ${i}: ${question[i]} / ${questionType[i]}`)

      // Look to see if this question has already been put into the note with something following it.
      // If so, skip this question.
      const resAQ = returnAnsweredQuestion(question[i])
      if (resAQ !== '') {
        console.log(`\t  Found existing Q answer '${resAQ}', so won't ask again`)
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
            console.log(`\tError trying to get integer answer for question '${question[i]}'`)
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
            console.log(`\tError trying to get number answer for question '${question[i]}'`)
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
            console.log(`\tNote: null or empty string for answer to question '${question[i]}'`)
          }
          break
        }
        case 'mood': {
          const reply = await CommandBar.showOptions(pref_moodArray, 'Choose most appropriate mood for today')
          const replyMood = pref_moodArray[reply.index]
          if (replyMood != null && replyMood !== '') {
            reviewLine = `${questionLines[i].replace(/<mood>/, replyMood)}`
          } else {
            console.log('\tError trying to get mood answer')
          }
          break
        }
        case 'subheading': {
          reviewLine = '\n### '.concat(question[i].replace(/<subheading>/, ''))
          break
        }
      }
      // console.log(`\tAnswer to '${question[i]}' = ${reviewLine[i]}`)
      if (reviewLine !== '') {
        output += `${reviewLine}\n`
      }
    }

    // Add the finished review text to the current daily note,
    // appending after the line found in pref_reviewSectionHeading.
    // If this doesn't exist, then append it first.
    console.log(`\tAppending answers to heading '${pref_reviewSectionHeading}'`)
    Editor.addParagraphBelowHeadingTitle(output, 'empty', pref_reviewSectionHeading, true, true)
  } catch (e) {
    if (e === 'cancelled') {
      console.log(`Asking questions cancelled by user: stopping.`)
    } else {
      console.log(`Stopping, following error ${e}.`)
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
