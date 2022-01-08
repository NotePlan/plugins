// @flow
//-----------------------------------------------------------------------------
// Specialised user input functions

import json5 from 'json5'
import { RE_DATE, RE_DATE_INTERVAL } from './dateTime'
import { calcSmartPrependPoint } from './paragraph'

// NB: This fn is a local copy from helpers/general.js, to avoid a circular dependency
async function parseJSON5(contents: string): Promise<?{ [string]: ?mixed }> {
  try {
    const value = json5.parse(contents)
    return (value: any)
  } catch (e) {
    console.log(e)
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
 * @param {TDefault} defaultValue - default label:value to use
 * @return {TDefault} - string that the user enters. Maybe be the empty string.
 */
export async function chooseOption<T, TDefault = T>(
  message: string,
  options: $ReadOnlyArray<Option<T>>,
  defaultValue: TDefault,
): Promise<T | TDefault> {
  const { index } = await CommandBar.showOptions(
    options.map((option) => option.label),
    message,
  )
  return options[index]?.value ?? defaultValue
}

/**
 * Ask user to give arbitary input using CommandBar
 * or now newer native dialog if available.
 * @author @jgclark, updating @nmn
 * 
 * @param {string} message - text to display to user
 * @param {?string} okLabel - the "button" (option) text (default: 'OK')
 * @param {?string} dialogTitle - title for the dialog (default: empty)
 * @param {?string} defaultValue - default value to display in text entry (default: empty)
 * @return {string} - string that the user enters. Maybe be the empty string.
 */
export async function getInput(
  message: string,
  okLabel: string = 'OK',
  dialogTitle: string = 'Enter value',
  defaultValue: string = '',
): Promise<boolean | string> {
  if (typeof CommandBar.textPrompt === 'function') {
    return await CommandBar.textPrompt(dialogTitle, message, defaultValue)
  } else {
    return await CommandBar.showInput(message, okLabel)
  }
}

/**
 * Get user input, trimmed at both ends, using CommandBar
 * or now newer native dialog if available.
 * @author @jgclark, updating @m1well
 *
 * @param placeholder value to display a question
 * @param submitText describe what happens with the input
 * @returns {Promise<string>} value input from the user
 */
export async function getInputTrimmed(
  message: string,
  okLabel: string = 'OK',
  dialogTitle: string = 'Enter value',
  defaultValue: string = '',
): Promise<boolean | string> {
  if (typeof CommandBar.textPrompt === 'function') {
    const reply = await CommandBar.textPrompt(dialogTitle, message, defaultValue)
    return (typeof reply === 'string') ? reply.trim() : reply
  } else {
    const reply = await CommandBar.showInput(message, okLabel)
    return reply.trim()
  }
}

/**
 * Show a single-button dialog-box like message (modal) using CommandBar,
 * or now newer native dialog if available.
 * @author @jgclark, updating @dwertheimer, updating @nmn
 * 
 * @param {string} message - text to display to user
 * @param {?string} confirmButton - the "button" (option) text (default: 'OK')
 * @param {?string} dialogTitle - title for the dialog (default: empty)
 */
export async function showMessage(
  message: string,
  confirmButton: string = 'OK',
  dialogTitle: string = ''
): Promise<void> {
  if (typeof CommandBar.prompt === 'function') {
    const answer = await CommandBar.prompt(dialogTitle, message, [confirmButton])
  } else {
    await CommandBar.showOptions([confirmButton], message)
  }
}

/**
 * Show a simple yes/no (could be OK/Cancel, etc.) dialog using CommandBar
 * or the newer native dialog if available.
 * @author @jgclark, updating @nmn
 * 
 * @param {string} message - text to display to user
 * @param {?Array<string>} choicesArray - an array of the choices to give (default: ['Yes', 'No'])
 * @param {?string} dialogTitle - title for the dialog (default: empty)
 * @returns {string} - returns the user's choice - the actual *text* choice from the input array provided
 */
export async function showMessageYesNo(
  message: string,
  choicesArray: Array<string> = ['Yes', 'No'],
  dialogTitle: string = ''
): Promise<string> {
  let answer: number
  if (typeof CommandBar.prompt === 'function') {
    answer = await CommandBar.prompt(dialogTitle, message, choicesArray)
  } else {
    const answerObj = await CommandBar.showOptions(choicesArray, `${message}`)
    answer = answerObj.index
  }
  return choicesArray[answer]
}

/**
 * Let user pick from a nicely-indented list of available folders (or return / for root)
 * @author @jgclark
 * 
 * @param {string} msg - text to display to user
 * @param {boolean} includeArchive - include archive or not
 * @returns {string} - returns the user's folder choice (or / for root)
 */
export async function chooseFolder(msg: string, includeArchive: boolean = false): Promise<string> {
  let folder: string
  const folders = DataStore.folders.slice() // excludes Trash and Archive
  if (includeArchive) {
    folders.push('@Archive')
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
  // console.log(`chooseFolder -> ${folder}`)
  return folder
}

/** 
 * Ask user to select a heading from those in a given note
 * @author @jgclark
 * 
 * @param {TNote} note - note to draw headings from
 * @param {boolean} optionAddAtBottom - whether to add '(top of note)' and '(bottom of note)' options. Default: true
 * @param {boolean} optionCreateNewHeading - whether to offer to create a new heading at the top of bottom of the note. Default: false
 * @return {string} - the selected heading as text without any markdown heading markers
 */
export async function chooseHeading(
  note: TNote,
  optionAddAtBottom: boolean = true,
  optionCreateNewHeading: boolean = false,
): Promise<string> {
  let headingStrings = []
  const headingParas = note.paragraphs.filter((p) => p.type === 'title') // = all headings, not just the top 'title'
  if (headingParas.length > 0) {
    headingStrings = headingParas.map((p) => {
      let prefix = ''
      for (let i = 1; i < p.headingLevel; i++) {
        prefix += '    '
      }
      return prefix + p.content
    })
  }
  if (optionCreateNewHeading) {
    // Add options to add new heading at top or bottom of note
    headingStrings.splice(1, 0, '➕ ⬆️ (first insert new heading at the start of the note)') // insert at second item
    headingStrings.push('➕ ⬇️ (first insert new heading at the end of the note)')
  }
  if (note.type === 'Calendar') {
    headingStrings.unshift('⬆️ (top of note)') // add at start (as it has no title)
  }
  if (optionAddAtBottom) {
    // Ensure we can always add at top and bottom of note
    headingStrings.push('⬇️ (bottom of note)') // add at end
  }
  const result = await CommandBar.showOptions(
    headingStrings,
    `Select a heading
     from note '${note.title ?? 'Untitled'}'`,
  )
  let headingToFind = headingStrings[result.index].trim()
  if (headingToFind === '➕ ⬆️ (first insert new heading at the start of the note)') {
    // ask for new heading, find smart insertion position, and insert it
    const newHeading = await getInput(`Enter heading to add at the start of the note`)
    if (newHeading && typeof newHeading === 'string') {
      const startPos = calcSmartPrependPoint(note)
      console.log(`prepending new heading ${newHeading} at line ${startPos}`)
      note.insertHeading(newHeading, startPos, 2)
      headingToFind = newHeading
    } else {
      // i.e. input was cancelled -- TODO: ideally would quit here?
      return '(error)'
    }
  }
  if (headingToFind === '➕ ⬇️ (first insert new heading at the end of the note)') {
    // ask for new heading, and then append it
    const newHeading = await getInput(`Enter heading to add at the end of the note`)
    if (newHeading && typeof newHeading === 'string') {
      const endPos = note.paragraphs.length
      console.log(`appending new heading ${newHeading} at line ${endPos}`)
      note.insertHeading(newHeading, endPos, 2)
      headingToFind = newHeading
    } else {
      // i.e. input was cancelled -- TODO: ideally would quit here?
      return '(error)'
    }
  }
  return headingToFind
}

/**
 * Ask for a date interval from user, using CommandBar
 * @author @jgclark
 * 
 * @param {string} dateParams - given parameters -- currently only looks for {question:'question test'} parameter
 * @return {string} - the returned interval string, or empty if an invalid string given
 */
export async function askDateInterval(dateParams: string): Promise<string> {
  // console.log(`askDateInterval(${dateParams}):`)
  const dateParamsTrimmed = dateParams.trim()
  const paramConfig =
    dateParamsTrimmed.startsWith('{') && dateParamsTrimmed.endsWith('}')
      ? await parseJSON5(dateParams)
      : dateParamsTrimmed !== ''
        ? await parseJSON5(`{${dateParams}}`)
        : {}
  // $FlowFixMe[incompatible-type]
  console.log(`param config: ${dateParams} as ${JSON.stringify(paramConfig)}`)
  // ... = "gather the remaining parameters into an array"
  const allSettings: { [string]: mixed } = { ...paramConfig }
  // grab just question parameter, or provide a default
  let { question } = (allSettings: any)
  question = question ? question : 'Please enter a date interval'
  // console.log(question)

  const reply = (await CommandBar.showInput(question, `Date interval (in form nn[bdwmqy]): %@`)) ?? ''
  const reply2 = reply.trim()
  if (reply2.match(RE_DATE_INTERVAL) == null) {
    await showMessage(`Sorry: ${reply2} wasn't a valid date interval`, `OK`, 'Error')
    return ''
  }
  return reply2
}

/**
 * Ask for a date from user (very simple: they need to enter an ISO date).
 * TODO: in time @EduardMe should produce a native API call that can improve this.
 * @author @jgclark
 * 
 * @param {string} question - string to put in the command bar
 * @return {string} - the returned ISO date as a string, or empty if an invalid string given
 */
export async function askForFutureISODate(question: string): Promise<string> {
  // console.log(`askForFutureISODate():`)
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
 * @param {[string]: ?mixed} config - relevant settings from _configuration note
 * @return {string} - the returned ISO date as a string, or empty if an invalid string given
 */
export async function datePicker(dateParams: string, config: { [string]: ?mixed }): Promise<string> {
  // console.log(`processDate: ${dateConfig}`)
  const defaultConfig = config.date ?? {}
  const dateParamsTrimmed = dateParams.trim()
  const paramConfig =
    dateParamsTrimmed.startsWith('{') && dateParamsTrimmed.endsWith('}')
      ? await parseJSON5(dateParams)
      : dateParamsTrimmed !== ''
        ? await parseJSON5(`{${dateParams}}`)
        : {}
  // $FlowIgnore[incompatible-type] -- TODO: Is there a @dwertheimer function that can help here?
  console.log(`param config: ${dateParams} as ${JSON.stringify(paramConfig)}`)
  // ... = "gather the remaining parameters into an array"
  const allSettings: { [string]: mixed } = {
    ...defaultConfig,
    ...paramConfig,
  }
  // console.log(allSettings.toString())
  // grab just question parameter, or provide a default
  let { question } = (allSettings: any)
  question = question ? question : 'Please enter a date'
  // console.log(question)
  // const localeParam = locale != null ? String(locale) : []
  // const secondParam = {
  //   dateStyle: 'short',
  //   ...otherParams,
  // }
  // console.log(`${JSON.stringify(localeParam)}, ${JSON.stringify(secondParam)}`);
  // return new Intl.DateTimeFormat(localeParam, secondParam).format(new Date())
  const reply = (await CommandBar.showInput(question, `Date (YYYY-MM-DD): %@`)) ?? ''
  const reply2 = reply.replace('>', '').trim() // remove leading '>' and trim
  if (!reply2.match(RE_DATE)) {
    await showMessage(`Sorry: ${reply2} wasn't a date of form YYYY-MM-DD`, `OK`, 'Error')
    return ''
  }
  return reply2
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
    console.log(`\tERROR trying to get integer answer for question '${question}'`)
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
  return !isNaN(value) && (x | 0) === x
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
    console.log(`\tERROR trying to get number answer for question '${question}'`)
    return NaN
  }
}

/**
 * Ask user to choose a mood
 * @author @jgclark
 * 
 * @param {Array<string>} moodArray - list of moods to pick from
 * @return {string} - selected mood
 */
// FlowFixMe
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
 * @returns {Promise<string[]>} all the answers as an array
 */
export const multipleInputAnswersAsArray = async (question: string, submit: string, showCounter: boolean,
                                                  minAnswers: number = 0, maxAnswers?: number): Promise<string[]> => {
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
