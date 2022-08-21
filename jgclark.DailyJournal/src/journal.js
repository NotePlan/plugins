// @flow
//-----------------------------------------------------------------------------
// Journalling plugin for NotePlan
// Jonathan Clark
// last update 21.8.2022 for v0.13.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import strftime from 'strftime'
import { getWeek } from '@helpers/dateTime'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { findHeadingStartsWith } from '@helpers/paragraph'
import NPTemplating from 'NPTemplating'
import { getAttributes } from '@templatingModules/FrontMatterModule'
import { getInputTrimmed, isInt, showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------------------
// Settings

const pluginID = 'jgclark.DailyJournal' // now out of date, but tricky to rename

type JournalConfigType = {
  templateTitle: string,
  reviewSectionHeading: string,
  reviewQuestions: string, // named over a year before weekly notes became possible
  weeklyReviewQuestions: string,
  monthlyReviewQuestions: string,
  quarterlyReviewQuestions: string,
  moods: string
}

/**
 * Get or make config settings
 * @author @jgclark
 */
async function getJournalSettings(): Promise<any> { // want to use Promise<JournalConfigType> but too many flow errors result
  try {
    const tempConfig: JournalConfigType = DataStore.settings
    if ((tempConfig != null) && Object.keys(tempConfig).length > 0) {
      const config: JournalConfigType = tempConfig
      // clo(config, `\t${pluginID} settings from V2:`)
      return config

    } else {
      logError(pluginJson, `couldn't read config for '${pluginID}. Will use defaults instead.`)
      // Will just use defaults
      const config: JournalConfigType = {
        templateTitle: "Daily Note Template",
        reviewSectionHeading: "Journal",
        reviewQuestions: '@sleep(<number>)\\n@work(<number>)\\n@fruitveg(<int>)\\nMood:: <mood>\\nExercise:: <string>\\nGratitude:: <string>\\nGod was:: <string>\\nAlive:: <string>\\nNot Great:: <string>\\nWife:: <string>\\nRemember:: <string>',
        weeklyReviewQuestions: "Big win: <string>\\nNew/improved: <string>\\nRegret: <string>\\nFocus for next week: <string>",
        monthlyReviewQuestions: "What's working well in processes: <string>\\nProcesses that need work: <string>Personal Goals progress: <string>",
        quarterlyReviewQuestions: "Goals met: <string>\\nNew goals identified: <string>\\nProjects finished: <string>\\nNew projects identified: <string>",
        moods: "🤩 Great,🙂 Good,😇 Blessed,🥱 Tired,😫 Stressed,😤 Frustrated,😔 Low,🥵 Sick,Other"
      }
      return config
    }
  }
  catch (error) {
    logError(pluginJson, `getJournalSettings: ${error.message}`)
    return // for completeness
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
  try {
    let workToday = today
    if (!workToday) {
      // apply daily template in the currently open daily note
      if (Editor.type !== 'Calendar') {
        logWarn(pluginJson, '/dayStart only works on calendar notes; will run /todayStart instead.')
        workToday = true
      }
      else if (Editor.note == null) {
        // we must be in an uninitialized Calendar note
        await showMessage('Error: this calendar note is not initialized. Stopping.')
        return
      }
    }
    if (workToday) {
      // open today's date in the main window, and read content
      await Editor.openNoteByDate(new Date(), false) // defaults to 'daily' note
    }
    // if (today) {
    //   // open today's date in the main window, and read content
    //   await Editor.openNoteByDate(new Date(), false)
    // } else {
    //   // apply daily template in the currently open daily note
    //   if (Editor.type !== 'Calendar') {
    //     await showMessage('Note: /dayStart only works on calendar notes.')
    //     return
    //   }
    //   else if (Editor.note == null) {
    //     // we must be in an uninitialized Calendar note
    //     await showMessage('Error: this calendar note is not initialized. Stopping.')
    //     return
    //   }
    // }
    logDebug(pluginJson, `for '${displayTitle(Editor.note)}'`)
    const config: JournalConfigType = await getJournalSettings()

    // render the template, using recommended decoupled method of invoking a different plugin
    const result = await DataStore.invokePluginCommandByName('renderTemplate', 'np.Templating', [config.templateTitle])

    // Work out where to insert it in the note, by reading the template, and checking
    // the frontmatter attributes for a 'location' field (append/insert/cursor)
    const templateData = await NPTemplating.getTemplate(config.templateTitle)
    const attrs = getAttributes(templateData)
    const requestedTemplateLocation = attrs.location ?? 'append'
    let pos = 0
    switch (requestedTemplateLocation) {
      case 'insert': {
        logDebug(pluginJson, `- Will insert to start of Editor`)
        Editor.insertTextAtCharacterIndex(result, 0)
        break
      }
      case 'append': {
        pos = Editor.content?.length ?? 0 // end
        logDebug(pluginJson, `- Will insert to end of Editor (pos ${pos})`)
        Editor.insertTextAtCharacterIndex(result, pos)
        break
      }
      case 'cursor': {
        logDebug(pluginJson, `- Will insert to Editor at cursor position`)
        Editor.insertTextAtCursor(result)
        break
      }
    }

  } catch (error) {
    logError(pluginJson, `(to)dayStart(): ${error.message}`)
  }
}

//------------------------------------------------------------------
/**
 * Gather answers to daily journal questions, writing to appropriate daily note
 */
export async function dailyJournalQuestions(): Promise<void> {
  const thisPeriodStr = strftime(`%Y-%m-%d`)
  logDebug(pluginJson, `Starting for day ${thisPeriodStr}`)
  await processJournalQuestions('day')
}

/**
 * Gather answers to weekly journal questions, writing to appropriate weekly note
 */
export async function weeklyJournalQuestions(): Promise<void> {
  const currentWeekNum = getWeek(new Date())
  const thisPeriodStr = strftime(`%Y`) + '-W' + currentWeekNum
  logDebug(pluginJson, `Starting for week ${thisPeriodStr}`)
  await processJournalQuestions('week')
}

/**
 * Gather answers to monthly journal questions, and inserts at the cursor.
 * Note: Might need updating in future if NP gets first-class support for monthly notes.
 */
export async function monthlyJournalQuestions(): Promise<void> {
  const thisPeriodStr = strftime(`%Y-%m`)
  logDebug(pluginJson, `Starting for month ${thisPeriodStr}`)
  await processJournalQuestions('month')
}

/**
 * Gather answers to quarterly journal questions, and inserts at the cursor.
 * Note: Might need updating in future if NP gets first-class support for quarterly notes.
 */
export async function quarterlyJournalQuestions(): Promise<void> {
  const todaysDate = new Date()
  const y = todaysDate.getFullYear()
  const m = todaysDate.getMonth() // counting from 0
  const thisQ = Math.floor(m / 3) + 1
  const thisPeriodStr = strftime(`%Y`) + 'Q' + String(thisQ)
  logDebug(pluginJson, `Starting for quarter ${thisPeriodStr}`)
  await processJournalQuestions('quarter')
}

//------------------------------------------------------------------

/**
 * Process questions for the given period, and write to the appropriate note:
 * - for 'day' period write to current open daily note or ...
 * - for 'week' period write to current open weekly note or ...
 * - for 'month' and 'quarter' period insert at the cursor position of the current note (as there are no special notes for those periods)
 * Note: Will need updating in future if NP gets first-class support for quarterly notes.
 * @param {string} period for journal questions
 * @returns 
 */
async function processJournalQuestions(period: string): Promise<void> {
  try {
    const config: JournalConfigType = await getJournalSettings()

    let questionLines = []
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
      default: {
        logError(pluginJson, `${period} review questions aren't yet supported. Stopping.`)
        await showMessage(`Sorry, ${period} review questions aren't yet supported.`)
        return
      }
    }

    // FIXME: make sure it works on whichever daily/weekly note is open if its open
    // Work out which note to output to
    let outputNote = Editor
    if ((period === 'day' || period === 'week') && (Editor.note == null || Editor.type !== 'Calendar')) {
      logError(pluginJson, `Editor isn't open with a Calendar note open. Stopping.`)
      await showMessage('Please run again with a calendar note open.')
      return
    }

    const question = []
    const questionType = []
    let output = ''
    let i = 0
    const numQs = questionLines.length
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

    // Add the finished review text to the current daily note,
    // appending after the line found in config.reviewSectionHeading.
    // If this doesn't exist, then append it first.
    logDebug(pluginJson, `Appending answers to heading '${config.reviewSectionHeading}' in note ${displayTitle(Editor.note)}`)
    // $FlowFixMe[prop-missing]
    const matchedHeading = findHeadingStartsWith(outputNote, config.reviewSectionHeading)
    outputNote.addParagraphBelowHeadingTitle(output,
      'empty',
      matchedHeading ? matchedHeading : config.reviewSectionHeading,
      true,
      true)
  } catch (e) {
    if (e === 'cancelled') {
      logDebug(pluginJson, `Asking questions cancelled by user: stopping.`)
    } else {
      logDebug(pluginJson, `Stopping, following error ${e}.`)
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
