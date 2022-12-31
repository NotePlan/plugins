// @flow
//-----------------------------------------------------------------------------
// Specialised user input functions

import json5 from 'json5'
import { RE_DATE, RE_DATE_INTERVAL } from './dateTime'
import { clo, logDebug, logError, logWarn, JSP } from './dev'
import { calcSmartPrependPoint, findEndOfActivePartOfNote } from './paragraph'
import { start } from 'repl'

// NB: This fn is a local copy from helpers/general.js, to avoid a circular dependency
async function parseJSON5(contents: string): Promise<?{ [string]: ?mixed }> {
  try {
    const value = json5.parse(contents)
    return (value: any)
  } catch (error) {
    logError('userInput / parseJSON5', error.message)
    await showMessage('Invalid JSON5 in your configuration. Please fix it to use configuration')
    return {}
  }
}

// (from @nmn / nmn.sweep)
export type Option<T> = $ReadOnly<{
  label: string,
  value: T,
}>

/**
 * Ask user to choose from a set of options (from nmn.sweep) using CommandBar
 * @author @nmn
 *
 * @param {string} message - text to display to user
 * @param {Array<T>} options - array of label:value options to present to the user
 * @param {TDefault} defaultValue - (optional) default value to use (default: options[0].value)
 * @return {TDefault} - the value attribute of the user-chosen item
 */
export async function chooseOption<T, TDefault = T>(message: string, options: $ReadOnlyArray<Option<T>>, defaultValue: TDefault | null = null): Promise<T | TDefault> {
  const { index } = await CommandBar.showOptions(
    options.map((option) => option.label),
    message,
  )
  return options[index]?.value ?? defaultValue ?? options[0].value
}

/**
 * Ask user to choose from a set of options (from nmn.sweep) using CommandBar
 * @author @dwertheimer based on @nmn chooseOption
 *
 * @param {string} message - text to display to user
 * @param {Array<T>} options - array of label:value options to present to the user
 * @param {TDefault} defaultValue - (optional) default value to use (default: options[0].value)
 * @return {TDefault} - the value attribute of the user-chosen item
 */
// @nmn we need some $FlowFixMe
export async function chooseOptionWithModifiers<T, TDefault = T>(
  message: string,
  options: $ReadOnlyArray<Option<T>>,
): Promise<{ ...TDefault, index: number, keyModifiers: Array<string> }> {
  // $FlowFixMe[prop-missing]
  const { index, keyModifiers } = await CommandBar.showOptions(
    options.map((option) => option.label),
    message,
  )
  // $FlowFixMe[incompatible-return]
  return { ...options[index], index, keyModifiers }
}

/**
 * Ask user to give arbitary input using CommandBar.
 * Will now use newer native dialog if available (from 3.3.2), which gets a title and default, but doesn't allow to customise the button text.
 * @author @jgclark, updating @nmn
 *
 * @param {string} message - request text to display to user
 * @param {?string} okLabel - the "button" (option) text (default: 'OK')
 * @param {?string} dialogTitle - title for the dialog (default: empty)
 * @param {?string} defaultValue - default value to display in text entry (default: empty)
 * @return {Promise<boolean|string>} - string that the user enters. Maybe be the empty string. If the user cancels the operation, it will return false instead.
 */
export async function getInput(message: string, okLabel: string = 'OK', dialogTitle: string = 'Enter value', defaultValue: string = ''): Promise<false | string> {
  if (typeof CommandBar.textPrompt === 'function') {
    // i.e. do we have .textPrompt available?
    return await CommandBar.textPrompt(dialogTitle, message, defaultValue)
  } else {
    return await CommandBar.showInput(message, okLabel)
  }
}

/**
 * Get user input, trimmed at both ends, using CommandBar.
 * Will now use newer native dialog if available (from 3.3.2), which gets a title and default, but doesn't allow to customise the button text.
 * @author @jgclark, updating @m1well
 *
 * @param {string} message - request text to display to user
 * @param {?string} okLabel - the "button" (option) text (default: 'OK')
 * @param {?string} dialogTitle - title for the dialog (default: empty)
 * @param {?string} defaultValue - default value to display in text entry (default: empty)
 * @returns {Promise<boolean|string>} string that the user enters. Maybe be the empty string. If the user cancels the operation, it will return false instead.
 */
export async function getInputTrimmed(message: string, okLabel: string = 'OK', dialogTitle: string = 'Enter value', defaultValue: string = ''): Promise<boolean | string> {
  if (typeof CommandBar.textPrompt === 'function') {
    // i.e. do we have .textPrompt available?
    const reply = await CommandBar.textPrompt(dialogTitle, message, defaultValue)
    return typeof reply === 'string' ? reply.trim() : reply
  } else {
    const reply = await CommandBar.showInput(message, okLabel)
    return reply.trim()
  }
}

/**
 * Show a single-button dialog-box like message (modal) using CommandBar.
 * Will now use newer native dialog if available (from 3.3.2), which adds a title.
 * Note: There's a copy in helpersNPParagaph.js to avoid a circular dependency
 * @author @jgclark, updating @dwertheimer, updating @nmn
 *
 * @param {string} message - text to display to user
 * @param {?string} confirmButton - the "button" (option) text (default: 'OK')
 * @param {?string} dialogTitle - title for the dialog (default: empty)
 * @param {?boolean} useCommandBar - force use NP CommandBar instead of native prompt (default: false)
 */
export async function showMessage(message: string, confirmButton: string = 'OK', dialogTitle: string = '', useCommandBar: boolean = false): Promise<void> {
  if (typeof CommandBar.prompt === 'function' && !useCommandBar) {
    // i.e. do we have .textPrompt available?
    await CommandBar.prompt(dialogTitle, message, [confirmButton])
  } else {
    await CommandBar.showOptions([confirmButton], message)
  }
}

/**
 * Show a simple yes/no (could be OK/Cancel, etc.) dialog using CommandBar.
 * Will now use newer native dialog if available (from 3.3.2), which adds a title.
 * Note: There's a copy in helpers/NPParagaph.js to avoid a circular dependency
 * @author @jgclark, updating @nmn
 *
 * @param {string} message - text to display to user
 * @param {?Array<string>} choicesArray - an array of the choices to give (default: ['Yes', 'No'])
 * @param {?string} dialogTitle - title for the dialog (default: empty)
 * @param {?boolean} useCommandBar - force use NP CommandBar instead of native prompt (default: false)
 * @returns {string} - returns the user's choice - the actual *text* choice from the input array provided
 */
export async function showMessageYesNo(message: string, choicesArray: Array<string> = ['Yes', 'No'], dialogTitle: string = '', useCommandBar: boolean = false): Promise<string> {
  let answer: number
  if (typeof CommandBar.prompt === 'function' && !useCommandBar) {
    // i.e. do we have .textPrompt available?
    answer = await CommandBar.prompt(dialogTitle, message, choicesArray)
  } else {
    const answerObj = await CommandBar.showOptions(choicesArray, `${message}`)
    answer = answerObj.index
  }
  return choicesArray[answer]
}

/**
 * Show a simple yes/no/cancel (or OK/No/Cancel, etc.) native dialog.
 * @author @jgclark
 *
 * @param {string} message - text to display to user
 * @param {?Array<string>} choicesArray - an array of the choices to give (default: ['Yes', 'No'])
 * @param {?string} dialogTitle - title for the dialog (default: empty)
 * @param {?boolean} useCommandBar - force use NP CommandBar instead of native prompt (default: false)
 * @returns {string} - returns the user's choice - the actual *text* choice from the input array provided
 */
export async function showMessageYesNoCancel(message: string, choicesArray: Array<string> = ['Yes', 'No', 'Cancel'], dialogTitle: string = ''): Promise<string> {
  const answer = await CommandBar.prompt(dialogTitle, message, choicesArray)
  return choicesArray[answer]
}

/**
 * Let user pick from a nicely-indented list of available folders (or return / for root)
 * @author @jgclark
 *
 * @param {string} msg - text to display to user
 * @param {boolean} includeArchive - include archive or not
 * @param {string} startFolder - folder to start the list in (e.g. to limit the folders to a specific subfolder)
 * @returns {string} - returns the user's folder choice (or / for root)
 */
export async function chooseFolder(msg: string, includeArchive: boolean = false, startFolder?: string): Promise<string> {
  let folder: string
  let folders = DataStore.folders.slice() // excludes Trash and Archive
  if (includeArchive) {
    folders.push('@Archive')
  }
  if (startFolder) {
    folders = folders.filter((f) => f.startsWith(startFolder))
  }
  if (folders.length > 0) {
    // make a slightly fancy list with indented labels, different from plain values
    const folderOptionList: Array<any> = []
    for (const f of folders) {
      if (f !== '/') {
        const folderParts = f.split('/')
        for (let i = 0; i < folderParts.length - 1; i++) {
          folderParts[i] = '     '
        }
        folderParts[folderParts.length - 1] = `📁 ${folderParts[folderParts.length - 1]}`
        const folderLabel = folderParts.join('')
        folderOptionList.push({ label: folderLabel, value: f })
      } else {
        // deal with special case for root folder
        folderOptionList.push({ label: '📁 /', value: '/' })
      }
    }
    // const re = await CommandBar.showOptions(folders, msg)
    folder = await chooseOption(msg, folderOptionList, '/')
  } else {
    // no Folders so go to root
    folder = '/'
  }
  // logDebug('userInput / chooseFolder', `-> ${folder}`)
  return folder
}

/**
 * Ask user to select a heading from those in a given note (regular or calendar), or optionally create a new heading at top or bottom of note to use.
 * TODO: Better handle case where note has no headings
 * @author @jgclark
 *
 * @param {TNote} note - note to draw headings from
 * @param {boolean} optionAddAtBottom - whether to add '(bottom of note)' option. Default: true.
 * @param {boolean} optionCreateNewHeading - whether to offer to create a new heading at the top or bottom of the note. Default: false.
 * @param {boolean} includeArchive - whether to include headings in the Archive section of the note (i.e. after 'Done'). Default: false.
 * @returns {string} - the selected heading as text without any markdown heading markers. Blank string implies no heading selected, and user wishes to write to the end of the note.
 */
export async function chooseHeading(note: TNote, optionAddAtBottom: boolean = true, optionCreateNewHeading: boolean = false, includeArchive: boolean = false): Promise<string> {
  try {
    let headingStrings = []
    const headingLevel = 2
    const spacer = '    '
    // Decide whether to include all headings in note, or just those
    // before the Done/Cancelled section
    const indexEndOfActive = findEndOfActivePartOfNote(note)
    const headingParas = includeArchive
      ? note.paragraphs.filter((p) => p.type === 'title') // = all headings, not just the top 'Title'
      : note.paragraphs.filter((p) => p.type === 'title' && p.lineIndex < indexEndOfActive) // = all headings in the active part of the note
    if (headingParas.length > 0) {
      headingStrings = headingParas.map((p) => {
        let prefix = ''
        for (let i = 1; i < p.headingLevel; i++) {
          prefix += spacer
        }
        // return `${prefix}➡️ ${p.content}` // an experiment that didn't look great
        return `${prefix}${p.content}`
      })
    }
    if (optionCreateNewHeading) {
      // Add options to add new heading at top or bottom of note
      if (note.type === 'Calendar') {
        headingStrings.unshift('➕#️⃣ (first insert new heading at the start of the note)') // insert at start
      } else {
        headingStrings.splice(1, 0, `➕#️⃣ (first insert new heading under the title)`) // insert as second item, after title
      }

      // headingStrings.unshift('➕#️⃣ (first insert new heading at the start of the note)') // insert at second item
      headingStrings.push(`➕#️⃣ (first insert new heading at the end of the note)`)
    }

    // Had wanted to use this, but would then need to break existing return type in order to able to differentiate between 'top of note' and 'bottom of bote'
    // if (note.type === 'Calendar') {
    //   headingStrings.unshift('⬆️ (top of note)') // add at start (as it has no title heading)
    // }

    if (optionAddAtBottom) {
      // Ensure we can always add at bottom of note
      headingStrings.push('⏬ (bottom of note)') // add at end
    }

    // If there are no heading options to present, then just return '' = end of note
    if (headingStrings.length === 0) {
      return ''
    }

    // Present heading options to user and ask for choice
    const result = await CommandBar.showOptions(headingStrings, `Select a heading from note '${note.title ?? 'Untitled'}'`)
    let headingToReturn = headingStrings[result.index].trimLeft() // don't trim right as there can be valid traillng spaces
    let newHeading

    switch (headingToReturn) {
      case `➕#️⃣ (first insert new heading at the start of the note)`:
        // ask for new heading, and insert right at top
        newHeading = await getInput(`Enter heading to add at the start of the note`)
        if (newHeading && typeof newHeading === 'string') {
          const startPos = 0
          note.insertHeading(newHeading, startPos, headingLevel)
          logDebug('userInput / chooseHeading', `prepended new heading '${newHeading}' at line ${startPos} (calendar note)`)
          headingToReturn = newHeading
        } else {
          throw new Error(`user cancelled operation`)
        }
        break

      case '➕#️⃣ (first insert new heading under the title)':
        // ask for new heading, find smart insertion position, and insert it
        newHeading = await getInput(`Enter heading to add at the start of the note`)
        if (newHeading && typeof newHeading === 'string') {
          const startPos = calcSmartPrependPoint(note)
          note.insertHeading(newHeading, startPos, headingLevel)
          logDebug('userInput / chooseHeading', `prepended new heading '${newHeading}' at line ${startPos} (project note)`)
          headingToReturn = newHeading
        } else {
          throw new Error(`user cancelled operation`)
        }
        break

      case `➕#️⃣ (first insert new heading at the end of the note)`:
        // ask for new heading, and then append it
        newHeading = await getInput(`Enter heading to add at the end of the note`)
        if (newHeading && typeof newHeading === 'string') {
          const newLindeIndex = indexEndOfActive + 1
          note.insertHeading(newHeading, newLindeIndex, headingLevel)
          logDebug('userInput / chooseHeading', `appended new heading '${newHeading}' at line ${newLindeIndex}`)
          headingToReturn = newHeading
        } else {
          throw new Error(`user cancelled operation`)
        }
        break

      case '⏬ (bottom of note)':
        logDebug('userInput / chooseHeading', `selected end of note, rather than a heading`)
        headingToReturn = ''
        break

      default:
        // if (headingToReturn.startsWith('➡️')) {
        //   headingToReturn = headingToReturn.slice(1)
        // }
        logDebug('userInput / chooseHeading', `User picked existing heading number ${result.index + 1} ('${headingToReturn}') from ${headingStrings.length} ..`)
        break
    }
    return headingToReturn
  } catch (error) {
    logError('userInput / chooseHeading', error.message)
    return '<error>'
  }
}

/**
 * Ask for a date interval from user, using CommandBar
 * @author @jgclark
 *
 * @param {string} dateParams - given parameters -- currently only looks for {question:'question test'} parameter
 * @return {string} - the returned interval string, or empty if an invalid string given
 */
export async function askDateInterval(dateParams: string): Promise<string> {
  // logDebug('askDateInterval', `starting with '${dateParams}':`)
  const dateParamsTrimmed = dateParams?.trim() || ''
  const paramConfig =
    dateParamsTrimmed.startsWith('{') && dateParamsTrimmed.endsWith('}') ? await parseJSON5(dateParams) : dateParamsTrimmed !== '' ? await parseJSON5(`{${dateParams}}`) : {}
  // logDebug('askDateInterval', `param config: ${dateParams} as ${JSON.stringify(paramConfig) ?? ''}`)
  // ... = "gather the remaining parameters into an array"
  const allSettings: { [string]: mixed } = { ...paramConfig }
  // grab just question parameter, or provide a default
  let { question } = (allSettings: any)
  question = question ? question : 'Please enter a date interval'

  const reply = (await CommandBar.showInput(question, `Date interval (in form nn[bdwmqy]): %@`)) ?? ''
  const trimmedReply = reply.trim()
  if (trimmedReply.match(RE_DATE_INTERVAL) == null) {
    await showMessage(`Sorry: ${trimmedReply} wasn't a valid date interval`, `OK`, 'Error')
    return ''
  }
  return trimmedReply
}

/**
 * Ask for a date from user (very simple: they need to enter an ISO date).
 * TODO: in time @EduardMe should produce a native API call that can improve this.
 * Note: No longer used by its author (or anyone else as of 2022-08-01)
 * @author @jgclark
 *
 * @param {string} question - string to put in the command bar
 * @return {string} - the returned ISO date as a string, or empty if an invalid string given
 */
export async function askForISODate(question: string): Promise<string> {
  // logDebug('askForISODate', `starting ...`)
  const reply = (await CommandBar.showInput(question, `Date (YYYY-MM-DD): %@`)) ?? ''
  const reply2 = reply.replace('>', '').trim() // remove leading '>' and trim
  if (reply2.match(RE_DATE) == null) {
    await showMessage(`Sorry: ${reply2} wasn't a valid date of form YYYY-MM-DD`, `OK`, 'Error')
    return ''
  }
  return reply2
}

/**
 * Ask for a date from user (very simple: they need to enter an ISO date)
 * TODO: in time @EduardMe should produce a native API call that can improve this.
 * @author @jgclark, based on @nmn code
 *
 * @param {string} dateParams - given parameters -- currently only looks for {question:'question test'} parameter
 * @param {[string]: ?mixed} config - previously used as settings from _configuration note; now ignored
 * @return {string} - the returned ISO date as a string, or empty if an invalid string given
 */
export async function datePicker(dateParams: string, config?: { [string]: ?mixed } = {}): Promise<string> {
  try {
    const dateConfig = config.date ?? {}
    // $FlowIgnore[incompatible-call]
    clo(dateConfig, 'userInput / datePicker dateConfig object:')
    const dateParamsTrimmed = dateParams.trim()
    const paramConfig =
      dateParamsTrimmed.startsWith('{') && dateParamsTrimmed.endsWith('}') ? await parseJSON5(dateParams) : dateParamsTrimmed !== '' ? await parseJSON5(`{${dateParams}}`) : {}
    // $FlowIgnore[incompatible-type]
    logDebug('userInput / datePicker', `params: ${dateParams} -> ${JSON.stringify(paramConfig)}`)
    // '...' = "gather the remaining parameters into an array"
    const allSettings: { [string]: mixed } = {
      ...dateConfig,
      ...paramConfig,
    }
    // logDebug('userInput / datePicker', allSettings.toString())
    // grab just question parameter, or provide a default
    let { question, defaultValue } = (allSettings: any)
    // logDebug('userInput / datePicker', `defaultValue: ${defaultValue}`)
    question = question ? question : 'Please enter a date'
    defaultValue = defaultValue ? defaultValue : 'YYYY-MM-DD'

    // Ask question (newer style)
    // const reply = (await CommandBar.showInput(question, `Date (YYYY-MM-DD): %@`)) ?? ''
    const reply = await CommandBar.textPrompt('Date Picker', question, defaultValue)
    if (typeof reply === 'string') {
      const reply2 = reply.replace('>', '').trim() // remove leading '>' and trim
      if (!reply2.match(RE_DATE)) {
        await showMessage(`Sorry: ${reply2} wasn't a date of form YYYY-MM-DD`, `OK`, 'Error')
        return ''
      }
      return reply2
    } else {
      logWarn('userInput / datePicker', 'User cancelled date input')
      return ''
    }
  } catch (e) {
    logError('userInput / datePicker', e.message)
    return ''
  }
}

/**
 * Ask for a (floating point) number from user
 * @author @jgclark and @m1well
 *
 * @param question question for the commandbar
 * @returns {Promise<number|*>} returns integer or NaN
 */
export async function inputInteger(question: string): Promise<number> {
  const reply = await CommandBar.showInput(question, `Answer: %@`)
  if (reply != null && isInt(reply)) {
    return Number(reply)
  } else {
    logError('userInput / inputInteger', `Error trying to get integer answer for question '${question}'`)
    return NaN
  }
}

/**
 * Test for integer
 * Method taken from https://stackoverflow.com/questions/14636536/how-to-check-if-a-variable-is-an-integer-in-javascript
 * @author @jgclark
 *
 * @param {string} value - input value to check
 * @result {boolean}
 */
export function isInt(value: string): boolean {
  const x = parseFloat(value)
  return !isNaN(value) && value !== '' && (x | 0) === x
}

/**
 * Ask for an integer from user
 * @author @jgclark
 *
 * @param question question for the commandbar
 * @returns {Promise<number|*>} returns number or NaN
 */
export async function inputNumber(question: string): Promise<number> {
  const reply = await CommandBar.showInput(question, `Answer: %@`)
  if (reply != null && Number(reply)) {
    return Number(reply)
  } else {
    logError('userInput / inputNumber', `Error trying to get number answer for question '${question}'`)
    return NaN
  }
}

/**
 * Ask user to choose a mood from a given array.
 * @author @jgclark
 *
 * @param {Array<string>} moodArray - list of moods to pick from
 * @return {string} - selected mood
 */
export async function inputMood(moodArray: Array<string>): Promise<string> {
  const reply = await CommandBar.showOptions(moodArray, `Please choose appropriate mood`)
  const replyMood = moodArray[reply.index] ?? '<error>'
  return replyMood
}

/**
 * Ask one question and get a flexible amount of answers from the user. either he reached
 * the maximum answer amount, or he leaves the input empty - of course you can set a
 * minimum amount so that the user have to input an answer (e.g. at least once)
 * @example `await multipleInputAnswersAsArray('What went well last week', 'Leave empty to finish answers', true, 1, 3)`
 * @author @m1well
 *
 * @param question question as input placeholder
 * @param submit submit text
 * @param showCounter show counter as placeholder - e.g.: "what went well last week (1/3)",
 *                                                        "what went well last week (2/3)",
 *                                                        "what went well last week (3/3)"
 * @param minAnswers minimum amount of answers the user has to type in (optional)
 * @param maxAnswers maximum amount of answers the user could type in (optional)
 * @returns {Promise<Array<string>>} all the answers as an array
 */
export const multipleInputAnswersAsArray = async (question: string, submit: string, showCounter: boolean, minAnswers: number = 0, maxAnswers?: number): Promise<Array<string>> => {
  let input = '-'
  const answers = []

  while ((maxAnswers ? answers.length < maxAnswers : true) && (input || answers.length < minAnswers)) {
    const placeholder = maxAnswers && showCounter ? `${question} (${answers.length + 1}/${maxAnswers})` : question
    input = await CommandBar.showInput(placeholder, submit)
    if (input) {
      answers.push(input.trim())
    }
  }
  return answers
}

/**
 * Choose a particular note from a CommandBar list of notes
 * @author @dwertheimer
 * @param {boolean} includeProjectNotes
 * @param {boolean} includeCalendarNotes
 * @param {Array<string>} foldersToIgnore - a list of folder names to ignore
 * @returns {TNote | null} note
 */
export async function chooseNote(includeProjectNotes: boolean = true, includeCalendarNotes: boolean = false, foldersToIgnore: Array<string> = []): Promise<TNote | null> {
  let noteList = []
  const projectNotes = DataStore.projectNotes
  const calendarNotes = DataStore.calendarNotes
  if (includeProjectNotes) {
    noteList = noteList.concat(projectNotes)
  }
  if (includeCalendarNotes) {
    noteList = noteList.concat(calendarNotes)
  }
  const noteListFiltered = noteList.filter((note) => {
    // filter out notes that are in folders to ignore
    let isInIgnoredFolder = false
    foldersToIgnore.forEach((folder) => {
      if (note.filename.includes(`${folder}/`)) {
        isInIgnoredFolder = true
      }
    })
    isInIgnoredFolder = isInIgnoredFolder || !/(\.md|\.txt)$/i.test(note.filename) //do not include non-markdown files
    return !isInIgnoredFolder
  })
  const opts = noteListFiltered.map((note) => {
    return note.title && note.title !== '' ? note.title : note.filename
  })
  const { index } = await CommandBar.showOptions(opts, 'Choose note')
  return noteListFiltered[index] ?? null
}
