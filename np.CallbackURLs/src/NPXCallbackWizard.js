// @flow

/*
REMEMBER: Always build a flow cancel path every time you offer a prompt
TODO: add wizard for template variables
TODO: new search?text=noteplan or search?filter=Upcoming
TODO: add back button to return to previous step (@qualitativeeasing)
TODO: maybe create choosers based on arguments text
*/
import yaml from 'yaml'
import { log, logError, logDebug, JSP, clo, timer } from '../../helpers/dev'
import { createOpenOrDeleteNoteCallbackUrl, createAddTextCallbackUrl, createCallbackUrl } from '../../helpers/general'
import pluginJson from '../plugin.json'
import { getXcallbackForTemplate } from './NPTemplateRunner'
import { openFolderView } from './NPOpenFolders'
import { chooseRunPluginXCallbackURL } from '@helpers/NPdev'
import { chooseOption, showMessage, showMessageYesNo, chooseFolder, chooseNote, getInput, getInputTrimmed } from '@helpers/userInput'
import { getSelectedParagraph } from '@helpers/NPParagraph'

// import { getSyncedCopiesAsList } from '@helpers/NPSyncedCopies'

// https://help.noteplan.co/article/49-x-callback-url-scheme#addnote

/**
 * Create a callback URL for openNote or addText (they are very similar)
 * @param {string} command - 'openNote' | 'addText' (default: 'openNote')
 * @returns {string} the URL or false if user canceled
 */
async function getAddTextOrOpenNoteURL(command: 'openNote' | 'addText' | 'deleteNote' = 'openNote'): Promise<string | false> {
  let url = '',
    note,
    fields
  const date = await askWhatKind() // returns date or '' or false
  if (date === false) return false
  let openType: 'subWindow' | 'splitView' | 'reuseSplitView' | 'useExistingSubWindow' | null = null
  let timeframe: 'week' | 'month' | 'quarter' | 'year' | null = null
  let highlightStart: number | null = null
  let highlightLength: number | null = null
  if (command === 'openNote') {
    const openTypeChoice = await askOpenType()
    if (openTypeChoice === false) return false
    openType = openTypeChoice ?? null
    const highlightChoice = await askHighlight()
    if (highlightChoice === false) return false
    if (highlightChoice) {
      highlightStart = highlightChoice.start
      highlightLength = highlightChoice.length
    }
  }
  if (date === 'folder') {
    note = await chooseFolder('Choose a folder', true, false)
    logDebug(pluginJson, `getAddTextOrOpenNoteURL: folder=${String(note)}`)
    if (note) {
      // in this case, note is a string (the folder name)
      url = createOpenOrDeleteNoteCallbackUrl(String(note), 'filename', '', openType, false, '', null, highlightStart, highlightLength)
      return url
    }
  } else if (date === '') {
    note = await chooseNote()
    log(pluginJson, `getAddTextOrOpenNoteURL: ${note?.filename || 'no note filename'}`)
    if (command === 'addText' && note) {
      fields = await getAddTextAdditions()
      if (fields === false) {
        url = false
      } else {
        if (fields.openNote === 'yes') {
          const openTypeChoice = await askOpenType()
          if (openTypeChoice === false) return false
          fields.openType = openTypeChoice ?? null
        }
        url = createAddTextCallbackUrl(note, fields)
      }
    } else if (command === 'openNote' && note?.filename) {
      url = createOpenOrDeleteNoteCallbackUrl(note?.filename ?? '', 'filename', '', openType, false, '', null, highlightStart, highlightLength)
    } else if (command === 'deleteNote' && note?.filename) {
      url = createOpenOrDeleteNoteCallbackUrl(note?.filename ?? '', 'filename', null, null, true)
    }
  } else {
    if (command === 'addText') {
      fields = await getAddTextAdditions()
      if (fields === false) {
        url = false
      } else {
        if (fields.openNote === 'yes') {
          const openTypeChoice = await askOpenType()
          if (openTypeChoice === false) return false
          fields.openType = openTypeChoice ?? null
        }
        url = createAddTextCallbackUrl(date, fields)
      }
    } else if (command === 'openNote') {
      const timeframeChoice = await askTimeframe()
      if (timeframeChoice === false) return false
      timeframe = timeframeChoice ?? null
      url = createOpenOrDeleteNoteCallbackUrl(date, 'date', '', openType, false, '', timeframe, highlightStart, highlightLength)
    } else if (command === 'deleteNote') {
      url = createOpenOrDeleteNoteCallbackUrl(date, 'date', null, null, true)
    }
  }

  if (url !== '') {
    return url
  } else {
    return 'An error occurred. Could not get URL. Check plugin console for details.'
  }
}

export async function getFilter(): Promise<string | false> {
  const filters = DataStore.filters
  if (filters.length) {
    const opts = filters.map((f) => ({ label: f, value: f }))
    opts.push({ label: 'None of these; I need to make a new one', value: '__new__' })
    const chosen = await chooseOption('Choose a filter', opts, opts[0].value)
    if (chosen === '__new__') {
      NotePlan.openURL(`noteplan://x-callback-url/search?filter=__new__`)
      return false
    } else {
      return createCallbackUrl('search', { filter: chosen }) || false
    }
  } else {
    await showMessage('No filters found. Please add a filter before running this command')
  }
  return false
}

export async function search(): Promise<string> {
  const searchText = await getInput('Text to search for', 'Submit', 'Search Text', '')
  if (searchText) {
    return createCallbackUrl('search', { text: searchText })
  } else {
    return ''
  }
}

/**
 * Ask user what type of note to get, and if they want a date, get the date from them
 * (or optionallyget a folder)
 * @returns {Promise<string>} YYYYMMDD like '20180122' or use 'today', 'yesterday', 'tomorrow' instead of a date; '' if they want to enter a title, or false if date entry failed
 */
/**
 * Ask user how they want the note to open (window/split view options).
 * If they choose Floating or Split, a second step asks whether to reuse the window/split if already open.
 * @returns {Promise<'subWindow' | 'splitView' | 'reuseSplitView' | 'useExistingSubWindow' | null | false>} openType, null for default, false if cancelled
 */
async function askOpenType(): Promise<'subWindow' | 'splitView' | 'reuseSplitView' | 'useExistingSubWindow' | null | false> {
  const opts = [
    { label: 'No preference (open in main window)', value: '__none__' },
    { label: 'Open in Floating Window', value: 'subWindow' },
    { label: 'Open in Split View', value: 'splitView' },
  ]
  const choice = await chooseOption('How should the note open?', opts, opts[0].value)
  if (choice === false) return false
  if (choice === '__none__') return null
  const reuse = await chooseOption(
    'Reuse the window/split if it is already open?',
    [
      { label: 'Yes (open there, reuse if already open)', value: 'yes' },
      { label: 'No (always open a new window/split)', value: 'no' },
    ],
    'no',
  )
  if (reuse === false) return false
  if (choice === 'subWindow') return reuse === 'yes' ? 'useExistingSubWindow' : 'subWindow'
  if (choice === 'splitView') return reuse === 'yes' ? 'reuseSplitView' : 'splitView'
  return choice
}

/**
 * Ask user for calendar timeframe (week/month/quarter/year) when opening a calendar note
 * @returns {Promise<'week' | 'month' | 'quarter' | 'year' | null | false>} timeframe or null for default, false if cancelled
 */
async function askTimeframe(): Promise<'week' | 'month' | 'quarter' | 'year' | null | false> {
  const opts = [
    { label: 'No preference (default day view)', value: '__none__' },
    { label: 'Week view', value: 'week' },
    { label: 'Month view', value: 'month' },
    { label: 'Quarter view', value: 'quarter' },
    { label: 'Year view', value: 'year' },
  ]
  const choice = await chooseOption('Which calendar view?', opts, opts[0].value)
  if (choice === false) return false
  return choice === '__none__' ? null : choice
}

/**
 * Ask user for highlight position (cursor/selection) after opening note
 * @returns {Promise<{ start: number, length: number } | null | false>} highlight or null to skip, false if cancelled
 */
async function askHighlight(): Promise<{ start: number, length: number } | null | false> {
  const wantHighlight = await chooseOption(
    'Jump cursor / select text after opening?',
    [
      { label: 'No', value: 'no' },
      { label: 'Yes (enter position)', value: 'yes' },
    ],
    'no',
  )
  if (wantHighlight === false) return false
  if (wantHighlight !== 'yes') return null
  const startStr = await getInput('Character index to jump to (0 = start, 9999 = end)', 'OK', 'highlightStart', '0')
  if (startStr === false) return false
  const start = parseInt(startStr, 10)
  if (Number.isNaN(start)) return null
  const lengthStr = await getInput('Selection length (0 = cursor only, no selection)', 'OK', 'highlightLength', '0')
  if (lengthStr === false) return false
  const length = parseInt(lengthStr, 10)
  if (Number.isNaN(length)) return { start, length: 0 }
  return { start, length }
}

async function askWhatKind(): Promise<string | false> {
  const opts = [
    { label: 'Open/use a Calendar/Daily Note', value: 'date' },
    { label: 'Open/use a Project Note (by title)', value: '' },
    { label: 'Open a Folder', value: 'folder' },
  ]
  let choice = await chooseOption('What kind of note do you want to use/open?', opts, opts[0].value)
  if (choice === 'date') {
    const opts = [
      { label: 'Enter a specific date', value: 'nameDate' },
      { label: 'today (always current day)', value: 'today' },
      { label: "tomorrow (always tomorrow's date)", value: 'tomorrow' },
      { label: 'yesterday (always yesterday)', value: 'yesterday' },
    ]
    choice = await chooseOption('What date?', opts, opts[0].value)
    if (choice === 'nameDate') {
      choice = await getInput('Enter a date in YYYYMMDD format (no dashes)')
      if (!choice || choice === '' || /^\d{8}$/.test(choice) === false) {
        showMessage(`You entered "${String(choice)}", but that is not in the correct format (YYYYMMDD).`)
        return false
      }
    }
  }
  return choice || ''
}

async function getAddTextAdditions(): Promise<{ text: string, mode: string, openNote: string } | false> {
  const text = await getInput('Enter text to add to the note', 'OK', 'Text to Add', 'PLACEHOLDER')
  log(pluginJson, `getAddTextAdditions: ${text || ''}`)
  if (text === false) return false
  const opts = [
    { label: 'Prepend text to the top of the note', value: 'prepend' },
    { label: 'Append text to the end of the note', value: 'append' },
  ]
  const mode = await chooseOption('How would you like to add the text?', opts, opts[0].value)
  if (mode === false) return false
  const openNote = await chooseOption(
    'Open the note after adding the text?',
    [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    'yes',
  )
  return openNote === false ? false : { text: text ? text : '', mode, openNote }
}

export async function addNote(): Promise<string> {
  const vars = {}
  vars.noteTitle = await getInput(`What's the title?\n(optional - click OK to leave blank)`, `OK`, `Title of Note`, '')
  if (vars.noteTitle === false) return ''
  vars.folder = await chooseFolder(`What folder?`)
  vars.noteText = await getInput(`What text for content?\n(optional - click OK to leave blank)`, `OK`, `Note Content`, '')
  if (vars.noteText === false) return ''
  vars.openNote = await showMessageYesNo(`Open note automatically?`, ['yes', 'no'], `Open Note`)
  vars.subWindow = await showMessageYesNo(`Open in Floating Window?`, ['yes', 'no'], `Open in Window`)
  vars.splitView = await showMessageYesNo(`Open in Split View?`, ['yes', 'no'], `Open in Split View`)
  vars.useExistingSubWindow = await showMessageYesNo(`Open in Already-opened Floating Window?`, ['yes', 'no'], `Open in Existing Window`)
  if (vars.openNote === 'yes') {
    const highlightChoice = await askHighlight()
    if (highlightChoice === false) return ''
    if (highlightChoice) {
      vars.highlightStart = String(highlightChoice.start)
      vars.highlightLength = String(highlightChoice.length)
    }
  }
  for (const key in vars) {
    if (['openNote', 'subWindow', 'splitView', 'useExistingSubWindow'].indexOf(key) > -1 && vars[key] === 'no') {
      delete vars[key]
    }

    if (['noteTitle', 'folder', 'noteText'].indexOf(key) > -1 && vars[key] === '') {
      delete vars[key]
    }
  }
  let params = ''
  for (const key in vars) {
    params += `${params.length ? '&' : '?'}${key}=${encodeURIComponent(vars[key])}`
  }
  return `noteplan://x-callback-url/addNote${params}`
}

/**
 * Build selectTag x-callback URL (select a tag in the sidebar)
 * @returns {Promise<string>} the URL or empty string if cancelled
 */
export async function selectTag(): Promise<string> {
  const name = await getInput(
    'Enter tag name (prepend # for hashtag or @ for mention; leave empty to show all notes)',
    'OK',
    'Tag Name',
    '#noteplan',
  )
  if (name === false) return ''
  const tagName = name === '' ? '' : (name.startsWith('#') || name.startsWith('@') ? name : `#${name}`)
  return createCallbackUrl('selectTag', { name: tagName })
}

/**
 * Build installPlugin x-callback URL
 * @returns {Promise<string>} the URL or empty string if cancelled
 */
export async function installPlugin(): Promise<string> {
  const pluginID = await getInput('Enter plugin ID (e.g. dwertheimer.Favorites)', 'OK', 'Plugin ID', '')
  if (pluginID === false || !pluginID || pluginID.trim() === '') return ''
  return createCallbackUrl('installPlugin', { pluginID: pluginID.trim() })
}

/**
 * Build toggleSidebar x-callback URL
 * @returns {Promise<string>} the URL
 */
export async function toggleSidebar(): Promise<string> {
  const forceCollapse = await chooseOption(
    'Force sidebar to collapse/hide?',
    [
      { label: 'No (default)', value: 'no' },
      { label: 'Yes', value: 'yes' },
    ],
    'no',
  )
  if (forceCollapse === false) return ''
  const forceOpen = await chooseOption(
    'Force sidebar to show/open?',
    [
      { label: 'No (default)', value: 'no' },
      { label: 'Yes', value: 'yes' },
    ],
    'no',
  )
  if (forceOpen === false) return ''
  const animated = await chooseOption(
    'Animate the toggle? (Mac only)',
    [
      { label: 'Yes (default)', value: 'yes' },
      { label: 'No (instant)', value: 'no' },
    ],
    'yes',
  )
  if (animated === false) return ''
  const params = {}
  if (forceCollapse === 'yes') params.forceCollapse = 'yes'
  if (forceOpen === 'yes') params.forceOpen = 'yes'
  if (animated === 'no') params.animated = 'no'
  return Object.keys(params).length ? createCallbackUrl('toggleSidebar', params) : 'noteplan://x-callback-url/toggleSidebar'
}

export async function noteInfo(): Promise<string> {
  const callback = await getInput(
    `Enter the other app xcallback to call with details on the currently-open NotePlan note. e.g.\nsourceapp://x-callback-url`,
    'OK',
    'Callback URL',
    '',
  )
  if (callback && callback !== '') {
    return `noteplan://x-callback-url/noteInfo/?x-success=${encodeURIComponent(callback)}`
  }
  return ''
}

export async function getReturnCallback(incomingString: string): Promise<string> {
  const { showXSuccess } = DataStore.settings
  if (showXSuccess) {
    const shouldReturn = await showMessageYesNo(
      `After running this command, do you want to return execution to a non-NotePlan app using the x-success parameter?\n(generally the answer is no)`,
      ['yes', 'no'],
      `Return to Other App`,
    )
    if (shouldReturn && shouldReturn === 'yes') {
      const callback = await getInput(`Enter the other app xcallback to call after running the NotePlan function. e.g.\notherapp://x-callback-url`, 'OK', 'Callback URL', '')
      if (callback && callback !== '') {
        return `${incomingString}&x-success=${encodeURIComponent(callback)}`
      }
    }
  }
  return incomingString
}

export async function runShortcut(): Promise<string> {
  const name = await getInput('Enter the name of the shortcut', 'OK', 'Shortcut Name', '')
  if (name && name.length) {
    return `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`
  }
  return ''
}

/**
 * Get link to the current line's heading
 * @returns {string} the url - returns it and also puts it on the clipboard
 */
export async function getHeadingLink(allowPrettyLink: boolean = true): Promise<string> {
  const selectedPara = await getSelectedParagraph()
  if (selectedPara && selectedPara?.note?.title !== null && (selectedPara.type !== 'title' || (selectedPara.type === 'title' && selectedPara.content))) {
    // if a heading is selected, use that. otherwise look for the heading this note is in
    const heading = selectedPara.type === 'title' ? selectedPara.content : selectedPara.heading
    log(pluginJson, `selectedPara.heading: ${heading}`)
    // $FlowIgnore
    const url = createOpenOrDeleteNoteCallbackUrl(selectedPara.note.title, 'title', heading) || ''
    if (allowPrettyLink) {
      const linkText = await getInputTrimmed(
        `Link to this note and heading "${heading}" copied to clipboard (click Cancel). If you would like to create a pretty link for pasting inside of NotePlan\ne.g. [text](url), enter the text to display + OK/Enter and a pretty link will be copied to the clipboard instead.`,
        'Copy Pretty Link',
        'Link to Heading',
        heading,
      )
      if (linkText && linkText !== '') {
        Clipboard.string = `[${String(linkText) || ''}](${url})`
      } else {
        Clipboard.string = url
      }
    }
    // await showMessage(`Link to this note and heading "${heading}" copied to clipboard`)
    return url
  } else {
    await showMessage(`Paragraph+Heading info could not be ascertained`)
  }
  return ''
}

/**
 * Get link to the current line
 * Plugin entrypoint for the "/Get Link to Line" command
 * @returns {string} the url - returns it and also puts it on the clipboard
 */
export async function lineLink(): Promise<string> {
  const selectedPara = await getSelectedParagraph()
  if (selectedPara && selectedPara?.note?.title !== null) {
    if (selectedPara.type === 'title') {
      await getHeadingLink(true)
      return ''
    }
    // if a heading is selected, use that. otherwise look for the heading this note is in
    Editor.addBlockID(selectedPara)
    Editor.updateParagraph(selectedPara)
    const revisedPara = Editor.paragraphs[selectedPara.lineIndex]
    let url = ''
    if (revisedPara.note?.title && revisedPara.blockId) {
      url = createOpenOrDeleteNoteCallbackUrl(revisedPara.note.title, 'title', null, null, false, revisedPara.blockId)
    }
    logDebug(pluginJson, `lineLink url=${url}`)
    const linkText = await getInputTrimmed(
      `Link to this note and line copied to clipboard (click Cancel). If you would like to create a pretty link for pasting inside of NotePlan\ne.g. [text](url), enter the text to display and a pretty link will be copied to the clipboard instead.`,
      'OK',
      'Link to Specific Line',
      '',
    )
    if (linkText && linkText !== '') {
      Clipboard.string = `[${String(linkText) || ''}](${url})`
    } else {
      Clipboard.string = url
    }
    return url
  } else {
    await showMessage(`Paragraph info could not be ascertained`)
  }
  return ''
}

// Plugin command entry point for creating a heading link
export async function headingLink() {
  await xCallbackWizard(`headingLink`)
}

/**
 * Walk user through creation of a xcallback url
 * @param {string} _commandType - text coming in from a runPlugin link
 * @param {boolean} passBackResults - whether to pass back the results to the caller (e.g. runPlugin)
 */
export async function xCallbackWizard(_commandType: ?string = '', passBackResults?: boolean = false): Promise<string | void> {
  try {
    let url: string | false = '',
      canceled = false
    let commandType
    if (_commandType) {
      commandType = _commandType
    } else {
      const options = [
        { label: 'COPY URL to NOTE+Heading of current line', value: 'headingLink' },
        { label: 'COPY URL to the current line', value: 'lineLink' },
        { label: 'OPEN a note or folder', value: 'openNote' },
        { label: 'NEW NOTE with title and text', value: 'addNote' },
        { label: 'ADD text to a note', value: 'addText' },
        { label: 'OPEN FOLDER View', value: 'openFolderView' },
        { label: 'FILTER Notes by Preset', value: 'filter' },
        { label: 'SEARCH for text in notes', value: 'search' },
        { label: 'SELECT a tag in the sidebar', value: 'selectTag' },
        { label: 'INSTALL a plugin by ID', value: 'installPlugin' },
        { label: 'TOGGLE sidebar (show/hide)', value: 'toggleSidebar' },
        { label: 'Get NOTE INFO (x-success) for use in another app', value: 'noteInfo' },
        { label: 'RUN a Templating Command (e.g. new note, insert text, etc.)', value: 'runTemplating' },
        { label: 'RUN a TemplateRunner type template', value: 'runTemplate' },
        { label: 'RUN a Plugin Command', value: 'runPlugin' },
        { label: 'RUN a Mac/iOS Shortcut', value: 'runShortcut' },
        { label: 'DELETE a note by title', value: 'deleteNote' },
      ]
      commandType = await chooseOption(`Select a link type to create`, options, '')
    }
    let runplugin
    switch (commandType) {
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
      case 'deleteNote':
        url = await getAddTextOrOpenNoteURL('deleteNote')
        break
      case 'filter':
        url = await getFilter()
        break
      case 'headingLink':
        url = await getHeadingLink(!passBackResults) // don't allow pretty links if we're just trying to get a URL to pass back to the caller
        break
      case 'lineLink':
        url = await lineLink()
        return url
      case 'search':
        url = await search()
        break
      case 'runShortcut':
        url = await runShortcut()
        break
      case 'addNote':
        url = await addNote()
        break
      case 'runTemplating':
        runplugin = await chooseRunPluginXCallbackURL(true, /Templating/)
        if (runplugin) {
          url = runplugin.url || ''
        } else {
          return
        }
        break
      case 'runTemplate':
        url = await getXcallbackForTemplate()
        break
      case 'noteInfo':
        url = await noteInfo()
        break
      case 'runPlugin':
        runplugin = await chooseRunPluginXCallbackURL()
        if (runplugin) {
          url = runplugin.url || ''
        } else {
          return
        }
        break
      case 'openFolderView':
        url = await openFolderView()
        if (!url) {
          showMessage(`No view name or folder selected. Please try again.`, 'OK', 'No View Selected')
        }
        break
      case 'selectTag':
        url = await selectTag()
        break
      case 'installPlugin':
        url = await installPlugin()
        break
      case 'toggleSidebar':
        url = await toggleSidebar()
        break
      default:
        showMessage(`${commandType}: This type is not yet available in this plugin`, 'OK', 'Sorry!')
        break
    }
    if (url === false) canceled = true // user hit cancel on one of the input prompts

    if (!canceled && typeof url === 'string' && url) {
      if (passBackResults) return url
      if (commandType === 'headingLink') {
        return url // copied to clipboard already
      }
      url = commandType !== 'noteInfo' ? await getReturnCallback(url) : url
      const op = [
        { label: `Raw/long URL (${url})`, value: 'raw' },
        { label: '[Pretty link](hide long URL)', value: 'pretty' },
      ]
      if (commandType === 'runPlugin') {
        op.push({ label: 'Templating <% runPlugin %> command', value: 'template' })
      }
      const urlType = await chooseOption(`What type of URL do you want?`, op, 'raw')
      if (urlType === 'pretty') {
        const linkText = await getInput('Enter short text to use for the link', 'OK', 'Link Text', 'Text')
        if (linkText) {
          url = `[${linkText}](${url})`
        }
      } else if (urlType === 'template' && runplugin && typeof runplugin !== 'boolean') {
        //  static invokePluginCommandByName(command: string, pluginID: string, arguments ?: $ReadOnlyArray < mixed >): Promise < any >;
        // { pluginID, command, args, url: createRunPluginCallbackUrl(pluginID, command, args) }

        url = `<% await DataStore.invokePluginCommandByName("${runplugin.command}","${runplugin.pluginID}",${JSON.stringify(runplugin.args)})  -%>`
      }
      // Editor.insertTextAtCursor(url)
      Clipboard.string = url
      await showMessage(`Link copied to clipboard`)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
