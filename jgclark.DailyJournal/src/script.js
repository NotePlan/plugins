//--------------------------------------------------------------------------------------------------------------------
// Daily Journal plugin for NotePlan
// Jonathan Clark
// v0.6.2, 12.6.2021
//--------------------------------------------------------------------------------------------------------------------

import { getDefaultConfiguration } from '../../nmn.Templates/src/configuration'
import { showMessage } from '../../nmn.sweep/src/userInput'
import { applyNamedTemplate } from '../../nmn.Templates/src/index'

// Title of template note to use as Daily template
const pref_templateTitle = 'Daily Note Template'

const todaysDate = new Date().toISOString().slice(0, 10).replace(/-/g, '')

//------------------------------------------------------------------
// Helper functions

// test for integer
// taken from https://stackoverflow.com/questions/14636536/how-to-check-if-a-variable-is-an-integer-in-javascript
function isInt(value) {
  const x = parseFloat(value)
  return !isNaN(value) && (x | 0) === x
}

//------------------------------------------------------------------
// Start today's daily note with a template, including local weather lookup if configured
export async function dayStart() {
  console.log(`\ndayStart for ${todaysDate}`)

  // open today's date in the main window, and read content
  await Editor.openNoteByDate(new Date(), false)
  // apply daily template, using @nmn Template system
  await applyNamedTemplate(pref_templateTitle)
}

//------------------------------------------------------------------
// Gather answers to set questions, and append to the daily note
export async function dayReview() {
  console.log(`\ndailyReview for ${todaysDate}`)

  // Get config settings from Template folder _configuration note
  const config = (await getDefaultConfiguration()) ?? {}
  const journalConfig = config.dailyJournal ?? null
  if (journalConfig == null) {
    console.log("\tWarning: Cannot find 'journal' settings in Templates/_configuration note. Stopping.")
    await showMessage("Cannot find 'journal' settings in Templates/_configuration note")
    return
  }
  const pref_reviewQuestions = journalConfig.reviewQuestions ?? null
  if (pref_reviewQuestions == null) {
    console.log("\tWarning: Cannot find any 'reviewQuestions' setting in Templates/_configuration note. Stopping.")
    await showMessage("Cannot find any 'reviewQuestions' setting in Templates/_configuration note")
    return
  }
  const pref_reviewSectionHeading = journalConfig.reviewSectionHeading ?? "Journal"
  const pref_moods = journalConfig.moods ?? [
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
  const pref_moodArray = pref_moods.split(',') // with a proper config system, this won't be needed

  Editor.openNoteByDate(new Date()) // open today's date in main window

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
    question[i] = questionLines[i]
      .replace(/:|\(|\)|<string>|<int>|<mood>/g, '')
      .trim()
    const reArray = questionLines[i].match(typeRE)
    questionType[i] = reArray[1]
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
        const reply = await CommandBar.showInput(
          questionType[i],
          `${question[i]  }: %@`,
        )
        if (reply != null && isInt(reply)) {
          // console.log(reply)
          reviewLine = questionLines[i].replace(/<int>/, reply)
        } else {
          console.log(
            `\tERROR trying to get integer answer for question '${ 
              question[i] 
              }'`,
          )
        }
        break
      }
      case 'string': {
        const replyString = await CommandBar.showInput(
          questionType[i],
          `${question[i]  }: %@`,
        )
        if (replyString != null) {
          // console.log(replyString)
          reviewLine =
            replyString !== ''
              ? questionLines[i].replace(/<string>/, replyString)
              : ''
        } else {
          console.log(
            `\tERROR trying to get string answer for question '${ 
              question[i] 
              }'`,
          )
        }
        break
      }
      case 'mood': {
        const reply = await CommandBar.showOptions(
          pref_moodArray,
          'Choose appropriate mood',
        )
        const replyMood = pref_moodArray[reply.index]
        if (replyMood != null && replyMood !== '') {
          // console.log(replyMood)
          reviewLine = questionLines[i].replace(/<mood>/, replyMood)
        } else {
          console.log('\tERROR trying to get mood answer')
        }
        break
      }
    }
    // console.log("\tAnswer to '" + question[i] + "' = " + reviewLine[i])
    if (reviewLine !== '') {
      output += `${reviewLine  }\n`
    }
  }

  // add the finished review text to the current daily note,
  // appending after the line found in pref_reviewSectionHeading.
  // If this doesn't exist, then append it first.
  console.log(
    `\tAppending to heading '${ 
      pref_reviewSectionHeading 
      }' the text:${ 
      output}`,
  )
  Editor.note.addParagraphBelowHeadingTitle(
    output,
    '',
    pref_reviewSectionHeading,
    true,
    true,
  )
}
