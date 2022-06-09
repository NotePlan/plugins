// @flow

/*
REMEMBER: Always build a flow cancel path every time you offer a prompt
TODO: add back button to return to previous step (@qualitativeeasing)
TODO: add argument detail: description, default, datatype (@qualitativeeasing)
*/

import { log, logError, clo, JSP } from '../../helpers/dev'
import { createOpenNoteCallbackUrl, createAddTextCallbackUrl } from '../../helpers/general'
import { chooseRunPluginXCallbackURL } from '@helpers/NPdev'
import pluginJson from '../plugin.json'
import { chooseOption, showMessage, chooseHeading, chooseFolder, chooseNote, getInput } from '@helpers/userInput'

// https://help.noteplan.co/article/49-x-callback-url-scheme#addnote

/**
 * Create a callback URL for openNote or addText (they are very similar)
 * @param {string} command - 'openNote' | 'addText' (default: 'openNote')
 * @returns {string} the URL or false if user canceled
 */
async function getAddTextOrOpenNoteURL(command: 'openNote' | 'addText' = 'openNote'): Promise<string | false> {
  let url = '',
    note,
    addTextParams,
    fields
  const date = await askAboutDate() // returns date or '' or false
  if (date === false) return false
  if (date === '') {
    note = await chooseNote()
    log(pluginJson, `getAddTextOrOpenNoteURL: ${note?.filename || 'no note filename'}`)
    if (command === 'addText' && note) {
      fields = await getAddTextAdditions()
      if (fields === false) {
        url = false
      } else {
        url = createAddTextCallbackUrl(note, fields)
      }
    } else if (command === 'openNote' && note?.filename) {
      url = createOpenNoteCallbackUrl(note?.filename ?? '', 'filename')
    }
  } else {
    if (command === 'addText') {
      fields = await getAddTextAdditions()
      if (fields === false) {
        url = false
      } else {
        url = createAddTextCallbackUrl(date, fields)
      }
    } else if (command === 'openNote') {
      url = createOpenNoteCallbackUrl(date, 'date')
    }
  }
  if (url !== '') {
    return url
  } else {
    return 'An error occurred. Could not get URL. Check plugin console for details.'
  }
}

/**
 * Ask user what type of note to get, and if they want a date, get the date from them
 * @returns {Promise<string>} YYYYMMDD like '20180122' or use 'today', 'yesterday', 'tomorrow' instead of a date; '' if they want to enter a title, or false if date entry failed
 */
async function askAboutDate(): Promise<string | false> {
  let opts = [
    { label: 'Open/use a Calendar/Daily Note', value: 'date' },
    { label: 'Open/use a Project Note (by title)', value: '' },
  ]
  let choice = await chooseOption('What kind of note do you want to use/open?', opts, opts[0].value)
  if (choice === 'date') {
    let opts = [
      { label: 'Enter a specific date', value: 'nameDate' },
      { label: 'today (always current day)', value: 'today' },
      { label: "tomorrow (always tomorrow's date)", value: 'tomorrow' },
      { label: 'yesterday (always yesterday)', value: 'yesterday' },
    ]
    choice = await chooseOption('What date?', opts, opts[0].value)
    if (choice === 'nameDate') {
      choice = await getInput('Enter a date in YYYYMMDD format (no dashes)')
      if (!choice || choice == '' || /^\d{8}$/.test(choice) === false) {
        showMessage(`You entered "${String(choice)}", but that is not in the correct format (YYYYMMDD).`)
        return false
      }
    }
  }
  return choice || ''
}

async function getAddTextAdditions(): Promise<{ text: string, mode: string, openNote: string } | false> {
  let text = await getInput('Enter text to add to the note', 'OK', 'Text to Add', 'PLACEHOLDER')
  log(pluginJson, `getAddTextAdditions: ${text}`)
  if (text === false) return false
  let opts = [
    { label: 'Prepend text to the top of the note', value: 'prepend' },
    { label: 'Append text to the end of the note', value: 'append' },
  ]
  let mode = await chooseOption('How would you like to add the text?', opts, opts[0].value)
  if (mode === false) return false
  let openNote = await chooseOption(
    'Open the note after adding the text?',
    [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    'yes',
  )
  return openNote === false ? false : { text: text ? text : '', mode, openNote }
}

/**
 * Walk user through creation of a xcallback url
 * @param {string} incoming - text coming in from a runPlugin link
 */
export async function xCallbackWizard(incoming: ?string = ''): Promise<void> {
  try {
    let url = '',
      canceled = false

    const options = [
      { label: 'OPEN a note', value: 'openNote' },
      { label: 'ADD text to a note', value: 'addText' },
      { label: 'Run a Plugin Command', value: 'runPlugin' },
      /*
      { label: 'Add a NEW NOTE with title and text', value: 'addNote' },
      { label: 'DELETE a note by title', value: 'deleteNote' },
      { label: 'Select a TAG in the sidebar', value: 'selectTag' },
      { label: 'SEARCH for text in a type of notes', value: 'search' },
      { label: 'Get NOTE INFO (x-success) for use in another app', value: 'noteInfo' },
      */
    ]
    const res = await chooseOption(`Select an X-Callback type`, options, '')
    const item = options.find((i) => i.value === res)
    switch (res) {
      case '':
        log(pluginJson, 'No option selected')
        canceled = true
        break
      case 'openNote':
        url = await getAddTextOrOpenNoteURL('openNote')
        break
      case 'addText':
        url = await getAddTextOrOpenNoteURL('addText')
        break
      case 'runPlugin':
        url = await chooseRunPluginXCallbackURL()
        break
      default:
        showMessage(`${res}: This type is not yet available in this plugin`, 'OK', 'Sorry!')
        break
    }
    if (url === false) canceled = true // user hit cancel on one of the input prompts
    // ask if they want x-success and add it if so

    if (!canceled && url) {
      const op = [
        { label: `Raw/long URL (${url})`, value: 'raw' },
        { label: '[Pretty link](hide long URL)', value: 'pretty' },
      ]
      const urlType = await chooseOption(`What type of URL do you want?`, op, 'raw')
      if (urlType === 'pretty') {
        const linkText = await getInput('Enter short text to use for the link', 'OK', 'Link Text', 'Text')
        if (linkText) {
          url = `[${linkText}](${url})`
        }
      }
      Editor.insertTextAtCursor(url)
      Clipboard.string = url
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
