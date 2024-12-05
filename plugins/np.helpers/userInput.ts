// @flow
//-----------------------------------------------------------------------------
// Specialised user input functions

import json5 from 'json5'
import { getDateStringFromCalendarFilename, RE_DATE, RE_DATE_INTERVAL } from './dateTime'
import { getRelativeDates } from './NPdateTime'
import { clo, logDebug, logError, logWarn, JSP } from './dev'
import { findStartOfActivePartOfNote, findEndOfActivePartOfNote } from './paragraph'
import { getHeadingsFromNote } from './NPnote'

// NB: This fn is a local copy from helpers/general.js, to avoid a circular dependency
function parseJSON5(contents: string): null | undefined | { [key: string]: unknown } {
  try {
    return json5.parse(contents) as any
  } catch (error: any) {
    logError('userInput / parseJSON5', typeof error === 'object' && error && 'message' in error ? error.message : String(error))
    return {}
  }
}

// (from @nmn / nmn.sweep)
export type Option<T> = Readonly<{
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
export async function chooseOption<T, TDefault = T>(message: string, options: ReadonlyArray<Option<T>>, defaultValue: TDefault | null = null): Promise<T | TDefault> {
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
 * @return {{ label:string, value:string, index: number, keyModifiers: Array<string> }} - the value attribute of the user-chosen item
 * keyModifiers is an array of 0+ strings, e.g. ["cmd", "opt", "shift", "ctrl"] that were pressed while selecting a result.
 */
// @nmn we need some $FlowFixMe
export async function chooseOptionWithModifiers<T, TDefault = T>(
  message: string,
  options: ReadonlyArray<Option<T>>,
): Promise<TDefault & { index: number, keyModifiers: Array<string> }> {
  logDebug('userInput / chooseOptionWithModifiers()', `About to showOptions with ${options.length} options & prompt:"${message}"`)
  // @ts-expect-error
  const { index, keyModifiers } = await CommandBar.showOptions(
    options.map((option) => option.label),
    message,
  )
  
  // @ts-ignore
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
export async function getInput(message: string, okLabel: string = 'OK', dialogTitle: string = 'Enter value', defaultValue: string = ''): Promise<boolean | string> {
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
 * Show a simple Yes/No (could be OK/Cancel, etc.) dialog using CommandBar.
 * Returns the text of the chosen option (by default 'Yes' or 'No')
 * Will now use newer native dialog if available (from 3.3.2), which adds a title.
 * Note: There's a copy in helpers/NPParagaph.js to avoid a circular dependency
 * @author @jgclark, updating @nmn
 *
 * @param {string} message - text to display to user
 * @param {?Array<string>} choicesArray - an array of the choices to give (default: ['Yes', 'No'])
 * @param {?string} dialogTitle - title for the dialog (default: empty)
 * @param {?boolean} useCommandBar - force use NP CommandBar instead of native prompt (default: false)
 * @returns {string} - returns the user's choice - the actual *text* choice from the input array provided (by default 'Yes' or 'No')
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
 * Let user pick from a nicely-indented list of available folders (or / for root, or optionally create a new folder)
 * @author @jgclark + @dwertheimer
 *
 * @param {string} msg - text to display to user
 * @param {boolean} includeArchive - if true, include the Archive folder in the list of folders; default is false
 * @param {boolean} includeNewFolderOption - if true, add a 'New Folder' option that will allow users to create a new folder and select it; IMPORTANT
 * NOTE: the API does not allow for creation of the folder, so all this does is pass back a path which will be created when the user saves/moves the note
 * If your use case does not include the creation or moving of a note to the chosen path, this option will not work for you
 * @param {string} startFolder - folder to start the list in (e.g. to limit the folders to a specific subfolder) - default is root (/) -- set to "/" to force start at root
 * @returns {string} - returns the user's folder choice (or / for root)
 */
export async function chooseFolder(msg: string, includeArchive: boolean = false, includeNewFolderOption: boolean = false, startFolder?: string): Promise<string> {
  const IS_DESKTOP = NotePlan.environment.platform === 'macOS'
  const NEW_FOLDER = `➕ (Add New Folder${IS_DESKTOP ? ' - or opt-click on a parent folder to create new subfolder' : ''})`
  let folder: string
  let folders = []
  if (includeNewFolderOption) {
    folders.push(NEW_FOLDER)
  }
  folders = [...folders, ...DataStore.folders.slice()] // excludes Trash
  if (startFolder?.length && startFolder !== '/') {
    folders = folders.filter((f) => f === NEW_FOLDER || f.startsWith(startFolder))
  } else {
    if (!includeArchive) {
      folders = folders.filter((f) => !f.startsWith('@Archive'))
    }
  }
  let value, keyModifiers
  if (folders.length > 0) {
    // make a slightly fancy list with indented labels, different from plain values
    const folderOptionList: Array<any> = []
    for (const f of folders) {
      if (f !== '/' && f !== NEW_FOLDER) {
        const folderParts = f.split('/')
        for (let i = 0; i < folderParts.length - 1; i++) {
          folderParts[i] = '     '
        }
        folderParts[folderParts.length - 1] = `📁 ${folderParts[folderParts.length - 1]}`
        const folderLabel = folderParts.join('')
        folderOptionList.push({ label: folderLabel, value: f })
      } else {
        // deal with special case for root folder
        folderOptionList.push(f !== NEW_FOLDER ? { label: '📁 /', value: '/' } : { label: NEW_FOLDER, value: NEW_FOLDER })
      }
    }
    // const re = await CommandBar.showOptions(folders, msg)
    // @ts-expect-error
    ;({ value, keyModifiers } = await chooseOptionWithModifiers(msg, folderOptionList))
    if (keyModifiers?.length && keyModifiers.indexOf('opt') > -1) {
      folder = NEW_FOLDER
    } else {
      folder = value
    }
    logDebug(`helpers/userInput`, `chooseFolder folder:${folder} value:${value} keyModifiers:${keyModifiers} keyModifiers.indexOf('opt')=${keyModifiers.indexOf('opt')}`)
  } else {
    // no Folders so go to root
    folder = '/'
  }
  // logDebug('userInput / chooseFolder', `-> ${folder}`)
  if (folder === NEW_FOLDER) {
    const optClicked = value?.length && keyModifiers && keyModifiers.indexOf('opt') > -1
    const newFolderName = await CommandBar.textPrompt(
      `Create new folder${optClicked ? ` inside folder:\n"${value || ''}".` : '...\nYou will choose where to create the folder in the next step.'}`,
      'Folder name:',
      '',
    )
    if (newFolderName && newFolderName.length) {
      const inWhichFolder =
        optClicked && value ? value : await chooseFolder(`Create '${newFolderName}' inside which folder? (${startFolder ?? '/'} for root)`, includeArchive, false, startFolder)
      if (inWhichFolder) {
        folder = inWhichFolder === '/' ? newFolderName : `${inWhichFolder}/${newFolderName}`
      }
    }
  }
  logDebug(`helpers/userInput`, `chooseFolder folder chosen: "${folder}"`)
  return folder
}

/**
 * Ask user to select a heading from those in a given note (regular or calendar), or optionally create a new heading at top or bottom of note to use, or the top or bottom of the note.
 * @author @jgclark
 *
 * @param {TNote} note - note to draw headings from
 * @param {boolean} optionAddATopAndtBottom - whether to add 'top of note' and 'bottom of note' options. Default: true.
 * @param {boolean} optionCreateNewHeading - whether to offer to create a new heading at the top or bottom of the note. Default: false.
 * @param {boolean} includeArchive - whether to include headings in the Archive section of the note (i.e. after 'Done'). Default: false.
 * @param {number} headingLevel - if adding a heading, the H1-H5 level to set (as an integer)
 * @returns {string} - the selected heading as text without any markdown heading markers. Blank string implies no heading selected, and user wishes to write to the end of the note. Special string '<<top of note>>' implies to write to the top (after any preamble or frontmatter). Also <<bottom of note>>
 */
export async function chooseHeading(
  note: TNote,
  optionAddATopAndtBottom: boolean = true,
  optionCreateNewHeading: boolean = false,
  includeArchive: boolean = false,
  headingLevel: number = 2,
): Promise<string> {
  try {
    const headingStrings = getHeadingsFromNote(note, true, optionAddATopAndtBottom, optionCreateNewHeading, includeArchive)

    // Present heading options to user and ask for choice
    const result = await CommandBar.showOptions(headingStrings, `Select a heading from note '${note.title ?? 'Untitled'}'`)
    // Get the underlying heading back by removing added # marks and trimming left. We don't trim right as there can be valid traillng spaces.
    let headingToReturn = headingStrings[result.index].replace(/^#{1,5}\s*/, '')
    headingToReturn = await processChosenHeading(note, headingLevel, headingToReturn)
    return headingToReturn
  } catch (error: any) {
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
  const paramConfig = dateParamsTrimmed.startsWith('{') && dateParamsTrimmed.endsWith('}') ? parseJSON5(dateParams) : dateParamsTrimmed !== '' ? parseJSON5(`{${dateParams}}`) : {}
  // logDebug('askDateInterval', `param config: ${dateParams} as ${JSON.stringify(paramConfig) ?? ''}`)
  // ... = "gather the remaining parameters into an array"
  const allSettings: { [k: string]: unknown } = { ...paramConfig }
  // grab just question parameter, or provide a default
  let { question } = (allSettings as any)
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
 * @param {[k: string]: null | void | unknown} config - previously used as settings from _configuration note; now ignored
 * @return {string} - the returned ISO date as a string, or empty if an invalid string given
 */
export async function datePicker(dateParams: string, config: { [k: string]: null | void | unknown } = {}): Promise<string> {
  try {
    // @ts-ignore
    const dateConfig = config.date ?? {}
    // @ts-ignore
    clo(dateConfig, 'userInput / datePicker dateConfig object:')
    const dateParamsTrimmed = dateParams.trim()
    const paramConfig =
      dateParamsTrimmed.startsWith('{') && dateParamsTrimmed.endsWith('}') ? parseJSON5(dateParams) : dateParamsTrimmed !== '' ? parseJSON5(`{${dateParams}}`) : {}
    // @ts-ignore
    logDebug('userInput / datePicker', `params: ${dateParams} -> ${JSON.stringify(paramConfig)}`)
    // '...' = "gather the remaining parameters into an array"
    const allSettings: { [k: string]: unknown } = {
      ...dateConfig,
      ...paramConfig,
    }
    // logDebug('userInput / datePicker', allSettings.toString())
    // grab just question parameter, or provide a default
    let { question, defaultValue } = (allSettings as any)
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
  } catch (e: any) {
    logError('userInput / datePicker', e.message)
    return ''
  }
}

/**
 * Ask for an integer number from user
 * @author @jgclark and @m1well
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
 * Ask user for integer, with lower and upper bounds. If out of bounds return NaN.
 * @author @jgclark
 * @param question question for the commandbar
 * @param {number} upperBound must be equal or less than this
 * @param {number?} lowerBound must be equal or greater than this; defaults to 0 if not given
 * @returns {Promise<number|*>} returns integer or NaN
 */
export async function inputIntegerBounded(title: string, question: string, upperBound: number, lowerBound: number = 0.0): Promise<number> {
  let result = NaN
  const reply = await CommandBar.textPrompt(title, question)
  if (reply != null && reply && isInt(reply)) {
    const value = parseFloat(reply)
    if (value <= upperBound && value >= lowerBound) {
      result = value
    } else {
      logWarn('userInput / inputInteger', `Value ${reply} is out of bounds for [${String(lowerBound)},${String(upperBound)}] -> NaN`)
    }
  } else {
    logWarn('userInput / inputInteger', `No valid integer answer for question '${question}' -> NaN`)
  }
  return result
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
  // @ts-expect-error
  return !isNaN(value) && value !== '' && (x | 0) === x
}

/**
 * Ask for a (floating-point) number from user
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

const relativeDates = getRelativeDates()

/**
 * Create a new note with a given title, content, and in a specified folder.
 * If title, content, or folder is not provided, it will prompt the user for input.
 *
 * @param {string} [_title] - The title of the new note.
 * @param {string} [_content] - The content of the new note.
 * @param {string} [_folder] - The folder to create the new note in.
 * @returns {Promise<Note | false>} - The newly created note, or false if the operation was cancelled.
 */
export async function createNewNote(_title: string = '', _content: string = '', _folder: string = ''): Promise<Note | null> {
  const title = _title || (await getInput('Title of new note', 'OK', 'New Note', ''))
  const content = _content
  if (title) {
    const folder = _folder || (await chooseFolder('Select folder to add note in:', false, true))
    const noteContent = `# ${title}\n${content}`
    const filename = await DataStore.newNoteWithContent(noteContent, folder)
    return DataStore.noteByFilename(filename, 'Notes') || null
  } else {
    return null
  }
}

/**
 * V2 of displayTitle that optionally adds the relative date string after relevant calendar note titles, to make it easier to spot last/this/next D/W/M/Q
 * Note: that this returns ISO title for daily notes (YYYY-MM-DD) not the one from the filename. This is different from the original displayTitle.
 * Note: Forked from helpers/general.js, but needed here anyway to avoid a circular dependency
 * @param {CoreNoteFields} noteIn
 * @param {boolean} showRelativeDates? (default: false)
 * @returns {string}
 */
export function displayTitleWithRelDate(noteIn: CoreNoteFields, showRelativeDates: boolean = true): string {
  if (noteIn.type === 'Calendar') {
    let calNoteTitle = getDateStringFromCalendarFilename(noteIn.filename, true) ?? '(error)'
    if (showRelativeDates) {
      for (const rd of relativeDates) {
        // @ts-expect-error
        if (calNoteTitle === rd.dateStr) {
          // console.log(`Found match with ${rd.relName}`)
          // @ts-expect-error
          calNoteTitle = `${rd.dateStr}\t(📆 ${rd.relName})`
        }
      }
    }
    return calNoteTitle
  } else {
    return noteIn.title ?? '(error)'
  }
}

/**
 * Choose a particular note from a CommandBar list of notes
 * @author @dwertheimer extended by @jgclark to include 'relative date' indicators in displayed title
 * @param {boolean} includeProjectNotes
 * @param {boolean} includeCalendarNotes
 * @param {Array<string>} foldersToIgnore - a list of folder names to ignore
 * @param {string} promptText - text to display in the CommandBar
 * @param {boolean} currentNoteFirst - add currently open note to the front of the list
 * @param {boolean} allowNewNoteCreation - add option for user to create new note to return instead of choosing existing note
 * @returns {TNote | null} note
 */
export async function chooseNote(
  includeProjectNotes: boolean = true,
  includeCalendarNotes: boolean = false,
  foldersToIgnore: Array<string> = [],
  promptText: string = 'Choose a note',
  currentNoteFirst: boolean = false,
  allowNewNoteCreation: boolean = false,
): Promise<TNote | null> {
  let noteList: TNote[] = []
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
  // @ts-expect-error
  const sortedNoteListFiltered = noteListFiltered.sort((first, second) => second.changedDate - first.changedDate) // most recent first
  const opts = sortedNoteListFiltered.map((note) => {
    return displayTitleWithRelDate(note)
  })
  const { note } = Editor
  if (allowNewNoteCreation) {
    opts.unshift('[New note]')
    // @ts-expect-error
    sortedNoteListFiltered.unshift('[New note]') // just keep the indexes matching
  }
  if (currentNoteFirst && note) {
    sortedNoteListFiltered.unshift(note)
    opts.unshift(`[Current note: "${displayTitleWithRelDate(Editor)}"]`)
  }
  const { index } = await CommandBar.showOptions(opts, promptText)
  let noteToReturn = sortedNoteListFiltered[index]
  // @ts-expect-error
  if (noteToReturn === '[New note]') {
    // @ts-expect-error
    noteToReturn = await createNewNote()
  }
  return noteToReturn ?? null
}

export async function processChosenHeading(note: TNote, headingLevel: number = 2, chosenHeading: string): Promise<string> {
  let newHeading,
    headingToReturn = chosenHeading
  logDebug('userInput / processChosenHeading', `headingLevel: ${headingLevel} chosenHeading: '${chosenHeading}'`)
  switch (headingToReturn) {
    case `➕#️⃣ (first insert new heading at the start of the note)`:
      // ask for new heading, and insert right at top
      newHeading = await getInput(`Enter heading to add at the start of the note`)
      if (newHeading && typeof newHeading === 'string') {
        const startPos = 0
        // @ts-ignore
        note.insertHeading(newHeading, startPos, headingLevel)
        logDebug('userInput / processChosenHeading', `prepended new heading '${newHeading}' at line ${startPos} (calendar note)`)
        headingToReturn = newHeading
      } else {
        throw new Error(`user cancelled operation`)
      }
      break

    case '\u2795#\ufe0f\u20e3 (first insert new heading under the title)':
      // ask for new heading, find smart insertion position, and insert it
      newHeading = await getInput(`Enter heading to add at the start of the note`)
      if (newHeading && typeof newHeading === 'string') {
        const startPos = findStartOfActivePartOfNote(note)
        // @ts-ignore
        note.insertHeading(newHeading, startPos, headingLevel)
        logDebug('userInput / processChosenHeading', `prepended new heading '${newHeading}' at line ${startPos} (project note)`)
        headingToReturn = newHeading
      } else {
        throw new Error(`user cancelled operation`)
      }
      break

    case `➕#️⃣ (first insert new heading at the end of the note)`:
      // ask for new heading, and then append it
      newHeading = await getInput(`Enter heading to add at the end of the note`)
      if (newHeading && typeof newHeading === 'string') {
        const indexEndOfActive = findEndOfActivePartOfNote(note)
        const newLindeIndex = indexEndOfActive + 1
        // @ts-ignore - headingLevel is a union type, and we've already checked it's a number
        note.insertHeading(newHeading, newLindeIndex, headingLevel || 2)
        logDebug('userInput / processChosenHeading', `appended new heading '${newHeading}' at line ${newLindeIndex}`)
        headingToReturn = newHeading
      } else {
        throw new Error(`user cancelled operation`)
      }
      break

    case '\u23eb (top of note)':
      logDebug('userInput / processChosenHeading', `selected top of note, rather than a heading`)
      headingToReturn = '<<top of note>>' // hopefully won't ever be used as an actual title!
      break

    case '\u23ec (bottom of note)':
      logDebug('userInput / processChosenHeading', `selected end of note, rather than a heading`)
      headingToReturn = '<<bottom of note>>'
      break

    default:
      // if (headingToReturn.startsWith('➡️')) {
      //   headingToReturn = headingToReturn.slice(1)
      // }
      break
  }
  return headingToReturn
}
