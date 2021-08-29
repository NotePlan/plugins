// @flow
//--------------------------------------------------------------------------------------------------------------------
// Specialised user input functions
// @jgclark, @nmn
// Last updated 29.8.2021
//--------------------------------------------------------------------------------------------------------------------

import { calcSmartPrependPoint } from '../helperFunctions'
import { RE_DATE, RE_DATE_INTERVAL } from '../helperFunctions/dateFunctions'
import { parseJSON5 } from '../nmn.Templates/src/configuration'

// (from @nmn / nmn.sweep)
export type Option<T> = $ReadOnly<{
  label: string,
  value: T,
}>


/** 
 * ask user to choose from a set of options (from nmn.sweep)
 * @author @nmn
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
 * ask user to give arbitary input (from nmn.sweep)
 * @author @nmn
 * @param {string} message - text to display to user
 * @param {string} okLabel - the "button" (option) text (default: 'OK')
 * @return {string} - string that the user enters. Maybe be the empty string.
 */ 
export async function getInput(
  message: string,
  okLabel: string = 'OK',
): Promise<string> {
  return await CommandBar.showInput(message, okLabel)
}

/**
 * Show a single-button dialog-box like message (modal) using CommandBar
 * @author @dwertheimer, updating @nmn
 * @param {string} message - text to display to user
 * @param {string} confirmTitle - the "button" (option) text (default: 'OK')
 */
export async function showMessage(
  message: string,
  confirmTitle: string = 'OK',
): Promise<void> {
  await CommandBar.showOptions([confirmTitle], message)
}

/**
 * Helper function to show a simple yes/no (could be OK/Cancel, etc.) dialog using CommandBar
 * @param {string} message - text to display to user
 * @param {Array<string>} - an array of the choices to give (default: ['Yes', 'No'])
 * @returns {string} - returns the user's choice - the actual *text* choice from the input array provided
 */
export async function showMessageYesNo(
  message: string,
  choicesArray: Array<string> = ['Yes', 'No'],
): Promise<string> {
  const answer = await CommandBar.showOptions(choicesArray, message)
  return choicesArray[answer.index]
}

/**
 * Let user pick from a nicely-indented list of available folders (or return / for root)
 * @author @jgclark
 * @param {string} message - text to display to user
 * @returns {string} - returns the user's folder choice (or / for root)
 */
export async function chooseFolder(msg: string): Promise<string> {
  let folder: string
  const folders = DataStore.folders // excludes Trash and Archive
  if (folders.length > 0) {
    // make a slightly fancy list with indented labels, different from plain values
    const folderOptionList: Array<any> = []
    for (const f of folders) {
      if (f !== '/') {
        const folderParts = f.split('/')
        for (let i = 0; i < folderParts.length - 1; i++) {
          folderParts[i] = '     '
        }
        folderParts[folderParts.length - 1] = `📁 ${
          folderParts[folderParts.length - 1]
        }`
        const folderLabel = folderParts.join('')
        // console.log(folderLabel)
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
  console.log(`chooseFolder -> ${folder}`)
  return folder
}

/** ask user to select a heading from those in a given note
 * @author @jgclark
 * @param {TNote} note - note to draw headings from
 * @param {boolean} optionAddAtBottom - whether to add '(top of note)' and '(bottom of note)' options. Default: true
 * @param {boolean} optionCreateNewHeading - whether to offer to create a new heading at the top of bottom of the note. Default: false
 * @return {string} - the selected heading as text without any markdown heading markers
 */
export async function chooseHeading(
  note: TNote,
  optionAddAtBottom: boolean = true,
  optionCreateNewHeading: boolean = false
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
    `Select a heading from note '${note.title ?? 'Untitled'}'`
  )
  let headingToFind = headingStrings[result.index].trim()
  if (headingToFind === '➕ ⬆️ (first insert new heading at the start of the note)') {
    // ask for new heading, find smart insertion position, and insert it
    const newHeading = await getInput(`Enter heading to add at the start of the note`)
    const startPos = calcSmartPrependPoint(note)
    console.log(`prepending new heading ${newHeading} at line ${startPos}`)
    note.insertHeading(newHeading, startPos, 2)
    headingToFind = newHeading
  }
  if (headingToFind === '➕ ⬇️ (first insert new heading at the end of the note)') {
    // ask for new heading, and then append it
    const newHeading = await getInput(`Enter heading to add at the end of the note`)
    const endPos = note.paragraphs.length
    console.log(`appending new heading ${newHeading} at line ${endPos}`)
    note.insertHeading(newHeading, endPos, 2)
    headingToFind = newHeading
  }
  return headingToFind
}

/**
 * ask for a date interval from user
 * @author @jgclark
 * @param {string} question - string to put in the command bar
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
  // $FlowFixMe
  console.log(`param config: ${dateParams} as ${JSON.stringify(paramConfig)}`)
  // ... = "gather the remaining parameters into an array"
  const allSettings: { [string]: mixed } = { ...paramConfig }
  console.log(allSettings.toString())
  // grab just question parameter
  // const { question, ...otherParams } = (allSettings: any)
  const { question } = (allSettings: any)
  console.log(question)

  const reply = await CommandBar.showInput(question, `Date interval: %@`) ?? ''
  const reply2 = reply.trim()
  if (reply2.match(RE_DATE_INTERVAL) == null) {
    await showMessage(`Sorry: ${reply2} is not a valid date interval`, `OK, I'll try again`)
    return ''
  }
  return reply2
}

/**
 * NOT CURRENTLY USED, I THINK
 * ask for a date from user (very simple: they need to enter an ISO date)
 * @author @jgclark
 * @param {string} question - string to put in the command bar
 * @return {string} - the returned ISO date as a string, or empty if an invalid string given
 */
// NB: in time @EduardMe should produce a native API call that can improve this
export async function askForFutureISODate(question: string): Promise<string> {
  // console.log(`askForFutureISODate():`)
  const reply = await CommandBar.showInput(question, `Date: %@`) ?? ''
  const reply2 = reply.replace('>', '').trim() // remove leading '>' and trim
  if (reply2.match(RE_DATE) == null) { // TODO: TEST this more
    await showMessage(`Sorry: ${reply2} is not a date of form YYYY-MM-DD`, `OK, I'll try again`)
    return ''
  }
  return reply2
}

/**
 * ask for a date from user (very simple: they need to enter an ISO date)
 * @author @jgclark, based on @nmn code
 * @param {string} dateParams - string included in the template tag
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
  // $FlowFixMe
  console.log(`param config: ${dateParams} as ${JSON.stringify(paramConfig)}`)
  // ... = "gather the remaining parameters into an array"
  const allSettings: { [string]: mixed } = {
    ...defaultConfig,
    ...paramConfig,
  }
  console.log(allSettings.toString())
  // grab just question parameter
  // const { question, ...otherParams } = (allSettings: any)
  const { question } = (allSettings: any)
  console.log(question)
  // const localeParam = locale != null ? String(locale) : []
  // const secondParam = {
  //   dateStyle: 'short',
  //   ...otherParams,
  // }
  // console.log(`${JSON.stringify(localeParam)}, ${JSON.stringify(secondParam)}`);
  // return new Intl.DateTimeFormat(localeParam, secondParam).format(new Date())
  const reply = await CommandBar.showInput(question, `Date: %@`) ?? ''
  const reply2 = reply.replace('>', '').trim() // remove leading '>' and trim
  if (!reply2.match(RE_DATE)) { // TODO: TEST this more
    await showMessage(`Sorry: ${reply2} is not a date of form YYYY-MM-DD`, `OK, I'll try again`)
    return ''
  }
  return reply2
}

// test for integer
// taken from https://stackoverflow.com/questions/14636536/how-to-check-if-a-variable-is-an-integer-in-javascript
// @jgclark
export function isInt(value: string): boolean {
  const x = parseFloat(value)
  return !isNaN(value) && (x | 0) === x
}

// ask for a (floating point) number from user
export async function inputInteger(question: string): Promise<number> {
  const reply = await CommandBar.showInput(question,`Answer: %@`)
  if (reply != null && isInt(reply)) {
    return Number(reply)
  } else {
    console.log(
      `\tERROR trying to get number answer for question '${question}'`,
    )
    return NaN
  }
}

// ask for an integer from user
export async function inputNumber(question: string): Promise<number> {
  const reply = await CommandBar.showInput(question,`Answer: %@`)
  if (reply != null && Number(reply)) {
    return Number(reply)
  } else {
    console.log(
      `\tERROR trying to get integer answer for question '${question}'`,
    )
    return NaN
  }
}

/**
 * ask user to choose a mood
 * @author @jgclark
 * @param {Array<string>} moodArray - list of moods to pick from
 * @return {string} - selected mood
 */
// $FlowFixMe
export async function inputMood(moodArray: Array<string>): Promise<string> {
  const reply = await CommandBar.showOptions(
    moodArray,
    `Please choose appropriate mood`,
  )
  const replyMood = moodArray[reply.index]
  if (replyMood != null && replyMood !== '') {
    return replyMood
  } else {
    console.log('\tERROR trying to get mood answer')
  }
}
