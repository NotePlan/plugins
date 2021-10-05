// @flow
//--------------------------------------------------------------------------------------------------------------------
// Daily Journal plugin for NotePlan
// Jonathan Clark
// v0.8.2, 5.10.2021
//--------------------------------------------------------------------------------------------------------------------

import { showMessage } from '../../helpers/userInput'
import { displayTitle } from '../../helpers/general'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'
import { applyNamedTemplate } from '../../nmn.Templates/src/index'

//--------------------------------------------------------------------------------------------------------------------
// Settings
const DEFAULT_JOURNAL_OPTIONS = `  dailyJournal: {
    reviewSectionHeading: "Journal",
    moods: "🤩 Great,🙂 Good,😇 Blessed,🥱 Tired,😫 Stressed,😤 Frustrated,😔 Low,🥵 Sick,Other",
    reviewQuestions: "@sleep(<number>)\\n@work(<number>)\\n@fruitveg(<int>)\\nMood:: <mood>\\nExercise:: <string>\\nGratitude:: <string>\\nGod was:: <string>\\nAlive:: <string>\\nNot Great:: <string>\\nWife:: <string>\\nRemember:: <string>"
  },
`
const MINIMUM_JOURNAL_OPTIONS = {
  reviewQuestions: 'string',
}

const pref_templateTitle = 'Daily Note Template' // fixed
let pref_reviewSectionHeading: string
let pref_moods: string
let pref_moodArray: Array<string>

//------------------------------------------------------------------
// Helper functions

// test for integer
// taken from https://stackoverflow.com/questions/14636536/how-to-check-if-a-variable-is-an-integer-in-javascript
function isInt(value) {
  const x = parseFloat(value)
  return !isNaN(value) && (x | 0) === x
}

//------------------------------------------------------------------
// Main functions

// Start today's daily note with the user's Daily Note Template
export async function todayStart() {
  await dayStart(true)
}

// Start the currently open daily note with the user's Daily Note Template
export async function dayStart(today: boolean = false) {
  console.log(`\ndayStart:`)
  if (today) {
    // open today's date in the main window, and read content
    await Editor.openNoteByDate(new Date(), false)
    // $FlowIgnore[incompatible-call]
    console.log(`Opened: ${displayTitle(Editor.note)}`)
  } else {
    // apply daily template in the currently open daily note
    if (Editor.note == null || Editor.type !== 'Calendar') {
      await showMessage('Please run again with a calendar note open.')
      return
    }
  }
  await applyNamedTemplate(pref_templateTitle)
}

//------------------------------------------------------------------
// Gather answers to set questions, and append to the daily note
export async function dayReview(): Promise<void> {
  if (Editor.note == null || Editor.type !== 'Calendar') {
    await showMessage('Please run again with a calendar note open.')
    return
  }
  console.log(`\ndailyReview:`)

  // Get config settings from Template folder _configuration note
  const journalConfig = await getOrMakeConfigurationSection(
    'dailyJournal',
    DEFAULT_JOURNAL_OPTIONS,
    MINIMUM_JOURNAL_OPTIONS,
  )
  // console.log(JSON.stringify(journalConfig))
  if (journalConfig == null
    || Object.keys(journalConfig).length === 0) // this is how to check for empty object
  {
    console.log("\tWarning: Cannot find suitable 'dailyJournal' settings in Templates/_configuration note. Stopping.")
    await showMessage(
      "Cannot find 'dailyJournal' settings in _configuration.",
      "Yes, I'll check my _configuration settings.",
    )
    return
  }
  // Finalise config settings
  const pref_reviewQuestions = (journalConfig?.reviewQuestions != null)
    ? String(journalConfig?.reviewQuestions)
    : "@sleep(<number>)\\n@work(<number>)\\n@fruitveg(<int>)\\nMood:: <mood>\\nExercise:: <string>\\nGratitude:: <string>\\nGod was:: <string>\\nAlive:: <string>\\nNot Great:: <string>\\nWife:: <string>\\nRemember:: <string>"
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
    question[i] = questionLines[i].replace(/:|\(|\)|<string>|<int>|<number>|<mood>/g, '').trim()
    const reArray = questionLines[i].match(typeRE)
    questionType[i] = reArray?.[1] ?? '<error in question type>'
    // console.log("\t" + i + ": " + question[i] + " / " + questionType[i])
  }
  // Ask each question in turn
  for (i = 0; i < numQs; i++) {
    // Each question type is handled slightly differently, but in all cases a blank
    // or invalid answer means the question is ignored.
    let reviewLine = ''
    console.log(`\t${i}: ${question[i]} / ${questionType[i]}`)
    switch (questionType[i]) {
      case 'int': {
        const reply = await CommandBar.showInput(questionType[i], `${question[i]}: %@`)
        if (reply != null && isInt(reply)) {
          reviewLine = questionLines[i].replace(/<int>/, reply)
        } else {
          console.log(`\tERROR trying to get integer answer for question '${question[i]}'`)
        }
        break
      }
      case 'number': {
        const reply = await CommandBar.showInput(questionType[i], `${question[i]}: %@`)
        if (reply != null && Number(reply)) {
          reviewLine = questionLines[i].replace(/<number>/, reply)
        } else {
          console.log(`\tERROR trying to get number answer for question '${question[i]}'`)
        }
        break
      }
      case 'string': {
        const replyString = await CommandBar.showInput(questionType[i], `${question[i]}: %@`)
        if (replyString != null) {
          reviewLine = replyString !== '' ? questionLines[i].replace(/<string>/, replyString) : ''
        } else {
          console.log(`\tERROR trying to get string answer for question '${question[i]}'`)
        }
        break
      }
      case 'mood': {
        const reply = await CommandBar.showOptions(pref_moodArray, 'Choose appropriate mood')
        const replyMood = pref_moodArray[reply.index]
        if (replyMood != null && replyMood !== '') {
          reviewLine = questionLines[i].replace(/<mood>/, replyMood)
        } else {
          console.log('\tERROR trying to get mood answer')
        }
        break
      }
    }
    // console.log(`\tAnswer to '${question[i]}' = ${reviewLine[i]}`)
    if (reviewLine !== '') {
      output += `${reviewLine}\n`
    }
  }

  // add the finished review text to the current daily note,
  // appending after the line found in pref_reviewSectionHeading.
  // If this doesn't exist, then append it first.
  console.log(`\tAppending answers to heading '${pref_reviewSectionHeading}'`)
  // If sectionHeading isn't present then it lands up writing '# ## Heading'
  // FIXME(@EduardMe): a bug in the API
  Editor.addParagraphBelowHeadingTitle(output, 'empty', pref_reviewSectionHeading, true, true)
}
