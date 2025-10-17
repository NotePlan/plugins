/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Specialised user input functions
// Note: Most if not all use the CommandBar or DataStore APIs, so this really should be called 'NPUserInput.js'.
//-----------------------------------------------------------------------------

import json5 from 'json5'
import { RE_DATE, RE_DATE_INTERVAL } from './dateTime'
import { displayTitleWithRelDate } from './NPdateTime'
import { clo, logDebug, logError, logInfo, logWarn, JSP } from './dev'
import { getFoldersMatching } from './folders'
import { getAllTeamspaceIDsAndTitles, getTeamspaceTitleFromID } from './NPTeamspace'
import { getHeadingsFromNote, getOrMakeCalendarNote } from './NPnote'
import { findStartOfActivePartOfNote, findEndOfActivePartOfNote } from './paragraph'
import { parseTeamspaceFilename } from './teamspace'

//-------------------------------- Types --------------------------------------

type TFolderIcon = {
  firstLevelFolder: string,
  icon: string,
  emoji: string, // fallback to use before v3.18 (
  color: string,
  alpha?: number,
  darkAlpha?: number,
}

//------------------------------ Constants ------------------------------------

const TEAMSPACE_ICON_COLOR = 'green-700'

//--------------------------- Local functions ---------------------------------
// NB: This fn is a local copy from helpers/general.js, to avoid a circular dependency
function parseJSON5(contents: string): ?{ [string]: ?mixed } {
  try {
    const value = json5.parse(contents)
    return (value: any)
  } catch (error) {
    logError('userInput / parseJSON5', error.message)
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
 * @returns {TDefault} - the value attribute of the user-chosen item
 */
export async function chooseOption<T, TDefault = T>(message: string, options: $ReadOnlyArray<Option<T>>, defaultValue: TDefault | null = null): Promise<T | TDefault> {
  const { index } = await CommandBar.showOptions(
    options.map((option) => (typeof option === 'string' ? option : option.label)),
    message,
  )
  return typeof options[index] === 'string' ? options[index] : options[index]?.value ?? defaultValue ?? options[0].value
}

/**
 * Show a list of options to the user and return which option they picked, along with any modifier key pressed.
 * Optionally, allow the user to create a new item.
 * @author @dwertheimer based on @nmn chooseOption
 *
 * @param {string} message - text to display to user
 * @param {Array<Option<T>>} options - array of options to display
 * @param {boolean} addCreate? - add an option to create a new item (default: false)
 * @param {string?} addCreateItemDescriptor - (if addCreate is true) descriptor for the "Add new item" option (default: 'item')
 * @returns {Promise<{value: T, label: string, index: number, keyModifiers: Array<string>}>} - Promise resolving to the result
 * see CommandBar.showOptions for more info
 */
export async function chooseOptionWithModifiers<T, TDefault = T>(
  message: string,
  options: $ReadOnlyArray<Option<T>>,
  addCreate: boolean = false,
  addCreateItemDescriptor: string = 'item',
): Promise<{ ...TDefault, index: number, keyModifiers: Array<string>, label: string, value: string }> {
  logDebug('userInput / chooseOptionWithModifiers()', `About to showOptions with ${options.length} options & prompt:"${message}"`)

  // Add the "Add new item" option if addCreate is true
  let displayOptions: Array<Option<T>> = [...options]
  if (addCreate) {
    // $FlowIgnore[incompatible-type]
    displayOptions = [{ label: '➕ Add new ' + addCreateItemDescriptor, value: '__ADD_NEW__' }, ...options]
  }

  logDebug('userInput / chooseOptionWithModifiers()', `displayOptions: ${displayOptions.length} options`)

  // $FlowFixMe[prop-missing]
  const { index, keyModifiers } = await CommandBar.showOptions(
    displayOptions.map((option) => (typeof option === 'string' ? option : option.label)),
    message,
  )

  // Check if the user selected "Add new item"
  if (addCreate && index === 0) {
    const result = await getInput('Enter new ' + addCreateItemDescriptor + ':', 'OK', 'Add New Item')
    if (result && typeof result === 'string') {
      // Return a custom result with the new item
      // $FlowFixMe[incompatible-return]
      return {
        index: -1, // -1 indicates a custom entry
        keyModifiers: keyModifiers || [],
        label: result,
        value: result,
      }
    }
  }

  // $FlowFixMe[incompatible-return]
  return { ...displayOptions[index], index, keyModifiers }
}

/**
 * Show a list of options to the user and return which option they picked (and whether they used a modifier key), optionally with ability to create a new item.
 * This is a fork of chooseOptionWithModifiers(), without the <TDefault> type parameter, using the new CommandBar.showOptions() options from v3.18
 * Note: requires at least v3.18
 * @author @jgclark, @dwertheimer based on @nmn chooseOption
 *
 * @param {string} message - text to display to user
 * @param {Array<TCommandBarOptionObject>} options - array of options to display
 * @param {TCommandBarOptionObject} additionalCreateNewOption - optional option object to create a new item
 * @returns {Promise<TCommandBarResultObject>} - the object that was chosen, plus an index of the chosen option and keyModifiers array. If the user created a new item, the index will be -1.
 */
export async function chooseDecoratedOptionWithModifiers(
  message: string,
  options: Array<TCommandBarOptionObject>,
  additionalCreateNewOption?: TCommandBarOptionObject,
): Promise<TCommandBarResultObject> {
  logDebug('userInput / chooseDecoratedOptionWithModifiers()', `Will showOptions with ${options.length} options & prompt: "${message}"`)

  // label field is used elsewhere, but @eduardme made showOptions use text instead, so we map it back to label
  if (Array.isArray(options) && options.length > 0) {
    options.forEach((option, i) => {
      options[i] = { ...option, text: option.text }
    })
  }

  // Add the "Add new item" option at the start, if given
  const displayOptions = options.slice()
  if (additionalCreateNewOption) {
    displayOptions.unshift(additionalCreateNewOption)
  }
  // logDebug('userInput / chooseDecoratedOptionWithModifiers()', `displayOptions: ${displayOptions.length} options`)

  // Use newer CommandBar.showOptions() from v3.18
  const result = await CommandBar.showOptions(displayOptions, message, '')
  const { index, keyModifiers } = result
  clo(result, `chooseDecoratedOptionWithModifiers chosen result`)
  clo(displayOptions[index], `from relevant displayOption`)

  // Check if the user selected "Add new item"
  if (additionalCreateNewOption && index === 0) {
    const result = await getInput('Enter new item:', 'OK', 'Add New Item')
    if (result && typeof result === 'string') {
      // Return a custom result with the new item
      return {
        index: -1, // -1 indicates a custom entry
        value: result,
        keyModifiers: keyModifiers || [],
      }
    }
  }

  return result
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
 * Show a single-button dialog-box like message (modal), with a list of items, that will be truncated if too long.
 * Note: This is a hack to avoid showing too many items at once, as the CommandBar.prompt() function is not smart and can run off the screen.
 * @author @jgclark
 *
 * @param {string} message - text to display to user
 * @param {Array<string>} list - array of strings to display to user
 * @param {?string} confirmButton - the "button" (option) text (default: 'OK')
 * @param {?string} dialogTitle - title for the dialog (default: empty)
 */
export async function showMessageWithList(message: string, list: Array<string>, confirmButton: string = 'OK', dialogTitle: string = ''): Promise<void> {
  const safeListLimitToDisplay = 25
  const listToShow = list.slice(0, safeListLimitToDisplay)
  const listIsLimited = list.length > safeListLimitToDisplay
  const listToShowString = listToShow.join('\n')
  const listIsLimitedString = listIsLimited ? `\n  ... and ${list.length - safeListLimitToDisplay} more` : ''
  const messageToShow = `${message} \n${listToShowString}${listIsLimitedString}`
  await CommandBar.prompt(dialogTitle, messageToShow, [confirmButton])
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
 * Let user pick from a nicely-indented list of available folders (or / for root, or optionally give a new folder name).
 * This now shows teamspaces as a special case, with a teamspace icon. And uses a new CommandBar.showOptions() function with richer options from v3.18.
 * Note: the API does not allow for creation of the folder, so all this does is pass back a path which you will need to handle creating.
 * @author @jgclark + @dwertheimer
 *
 * @param {string?} msg - text to display to user. Optional: default is 'Choose a folder'
 * @param {boolean?} includeArchive - if true, include the Archive folder in the list of folders. Optional: default is false
 * @param {boolean?} includeNewFolderOption - if true, add a 'New Folder' option that will allow users to create a new folder and select it. Optional: default is false
 * @param {string?} startFolder - folder to start the list in (e.g. to limit the folders to a specific subfolder). If not given, all folders will be shown.
 * @param {boolean?} includeFolderPath - (optional: default true) Show the folder path (or most of it), not just the last folder name, to give more context.
 * @param {boolean?} excludeTeamspaces - if true, exclude teamspace folders from the list of folders. Optional: default is false.
 * @returns {string} - returns the user's folder choice (or / for root)
 */
export async function chooseFolder(
  msg?: string = 'Choose a folder',
  includeArchive?: boolean = false,
  includeNewFolderOption?: boolean = false,
  startFolder?: string = '',
  includeFolderPath?: boolean = true,
  excludeTeamspaces?: boolean = false,
  forceOriginalCommandBar?: boolean = false,
): Promise<string> {
  try {
    const IS_DESKTOP = NotePlan.environment.platform === 'macOS'
    const NEW_FOLDER = `➕ New Folder${IS_DESKTOP ? ' - or ⌥+click on a parent folder to create new sub-folder' : ''}`
    const teamspaceDefs = getAllTeamspaceIDsAndTitles()
    const addSimpleNewFolderOption = {
      label: `➕ New Folder${IS_DESKTOP ? ' - or ⌥+click on a parent folder to create new sub-folder' : ''}`,
      value: '__ADD_NEW__',
    }
    const addDecoratedNewFolderOption: TCommandBarOptionObject = {
      text: NEW_FOLDER,
      icon: 'folder-plus',
      color: 'orange-500',
      shortDescription: 'Add new',
      alpha: 0.5,
      darkAlpha: 0.5,
    }
    logDebug('userInput / chooseFolder', `creating with folder path, starting at "${startFolder}"`)

    // Get all folders, excluding @Trash
    // V2
    // Get all folders, excluding the Trash, and only includes folders that match the startFolder (if given)
    // getAllMatchingFolders() now also sorts the list to the order displayed in NotePlan's sidebar.
    const folderInclusions: Array<string> = startFolder ? [startFolder] : []
    const folderExclusions: Array<string> = includeArchive ? [] : ['@Archive']
    const matchingFolders = getFoldersMatching(folderInclusions, false, folderExclusions, excludeTeamspaces)
    const folders: Array<string> = matchingFolders
    // logDebug('userInput / chooseFolder', `🟡 ${ folders.length } folders ordered: ${ String(folders) }`) // ✅

    let folder: string = ''
    let value: string = ''
    let keyModifiers: Array<string> = []
    let optClickedOnFolder = false
    let newFolderWanted = false

    if (folders.length > 0) {
      // Create folder options for display (without new folder option at this point)
      const [simpleFolderOptions, decoratedFolderOptions] = createFolderOptions(folders, teamspaceDefs, includeFolderPath)
      // for(let i = 0; i < 15; i++) {
      //   console.log(`- ${i}: ${folders[i]}`)
      // }

      // Get user selection. Use newer CommandBar.showOptions() from v3.18 if available.
      let result: TCommandBarOptionObject | any
      if (NotePlan.environment.buildVersion >= 1413 && !forceOriginalCommandBar) {
        // ✅ for list with add new option
        // ✅ for list without add new option
        // ✅ for both private + teamspace
        // ✅ for excluding Archive
        // ✅ for folder creation to private area root
        // ✅ for folder creation to private area subfolder
        // ✅ for folder creation to private area root opt-click
        // ✅ for folder creation to private area subfolder opt-click
        // ✅ for folder creation to a Teamspace root
        // ✅ for folder creation to a Teamspace subfolder
        // ✅ for folder creation to a Teamspace root opt-click
        // ✅ for folder creation to a Teamspace subfolder opt-click

        if (includeNewFolderOption) {
          // Add in the new folder option just for newer CommandBar use
          decoratedFolderOptions.unshift(addDecoratedNewFolderOption)
          result = await chooseDecoratedOptionWithModifiers(msg, decoratedFolderOptions) // note disabling the add new folder option as we need to handle it with access to folders array
          keyModifiers = result.keyModifiers || []
          if (keyModifiers.length > 0 && keyModifiers.indexOf('opt') > -1) {
            optClickedOnFolder = true
          }

          if (result.index === 0) {
            // i.e. new folder wanted, but no name given yet
            folder = ''
            newFolderWanted = true
          } else if (optClickedOnFolder) {
            // i.e. new folder wanted, and parent folder chosen
            folder = folders[result.index - 1] // to ignore the added new folder option if present
            newFolderWanted = true
          } else {
            folder = folders[result.index - 1] // to ignore the added new folder option if present
          }

          // Handle new folder creation, if requested
          if (newFolderWanted) {
            const newFolderPath = await handleNewFolderCreation(folder, startFolder, includeArchive, includeFolderPath, excludeTeamspaces, forceOriginalCommandBar)
            if (newFolderPath) {
              folder = newFolderPath
              // logInfo(`userInput / chooseFolder`, ` -> created new folder "${folder}"`)
              return newFolderPath
            } else {
              throw new Error(`Failed to create new folder "${folder}"`)
            }
          }
        } else {
          // not including add new folder option
          result = await chooseDecoratedOptionWithModifiers(msg, decoratedFolderOptions)
          clo(result, 'chooseFolder chooseDecoratedOptionWithModifiers result') // ✅
          value = folders[result.index]
        }
      } else {
        // ✅ for both private + teamspace
        // ✅ for excluding Archive
        // ✅ for folder creation to private area root
        // ✅ for folder creation to private area subfolder
        // ✅ for folder creation to a Teamspace root
        // ✅ for folder creation to a Teamspace subfolder
        // ✅ for folder creation to private area root opt-click
        // ✅ for folder creation to private area subfolder opt-click
        // ✅ for folder creation to a Teamspace root opt-click
        // ✅ for folder creation to a Teamspace subfolder opt-click

        // Add in the new folder option just for newer CommandBar use
        if (includeNewFolderOption) {
          simpleFolderOptions.unshift(addSimpleNewFolderOption)
        }
        // V1 used chooseOptionWithModifiers() but it just got too complicated, so using parts of its logic here
        // V2
        const { index, keyModifiers } = await CommandBar.showOptions(
          simpleFolderOptions.map((option) => (typeof option === 'string' ? option : option.label)),
          'Choose Folder',
        )
        if (keyModifiers.length > 0 && keyModifiers.indexOf('opt') > -1) {
          optClickedOnFolder = true
        }
        logDebug('userInput / chooseFolder', `- index: ${index}, keyModifiers: ${String(keyModifiers)}`)

        if (includeNewFolderOption && index === 0) {
          // i.e. new folder wanted but no name given
          folder = ''
          newFolderWanted = true
        } else if (optClickedOnFolder) {
          // i.e. new folder wanted, and parent folder chosen
          folder = folders[index - 1]
          newFolderWanted = true
        } else {
          folder = folders[index]
        }
        logDebug('userInput / chooseFolder', `- folder: ${folder}, newFolderWanted? ${String(newFolderWanted)}`)
        // Handle new folder creation, if required
        if (newFolderWanted) {
          const newFolderPath = await handleNewFolderCreation(folder, startFolder, includeArchive, includeFolderPath, excludeTeamspaces, forceOriginalCommandBar)
          if (newFolderPath) {
            folder = newFolderPath
            // logInfo(`userInput / chooseFolder`, ` -> created new folder "${folder}"`)
            return newFolderPath
          } else {
            throw new Error(`Failed to create new folder "${folder}"`)
          }
        }
        value = result?.value || ''
        newFolderWanted = result?.index === -1
      }
      logDebug(`userInput / chooseFolder`, ` -> folder:${folder} value:${value} keyModifiers:${String(keyModifiers)}`)
    } else {
      // no Folders so just choose private root folder
      folder = '/'
    }

    logDebug(`userInput / chooseFolder`, ` -> "${folder}"`)
    return folder
  } catch (error) {
    logError('userInput / chooseFolder', error.message)
    return ''
  }
}

/**
 * Create folder options for display (private function).
 * Note: can't just have opt-click to create a new folder, because this doesn't work on iOS/iPadOS.
 * @param {Array} folders to create options for
 * @param {Array} teamspaceDefs - teamspace definitions
 * @param {boolean} includeFolderPath? - whether to show full path
 * @param {string?} newFolderText - text of the special new folder option (if present)
 *
 * @returns {Array<{ label: string, value: string }> | Array<TCommandBarOptionObject>} formatted folder options
 */
function createFolderOptions(
  folders: Array<string>,
  teamspaceDefs: Array<TTeamspace>,
  includeFolderPath: boolean,
  newFolderText: string = '',
): [Array<{ label: string, value: string }>, Array<TCommandBarOptionObject>] {
  const simpleOptions: Array<{ label: string, value: string }> = []
  const decoratedOptions: Array<TCommandBarOptionObject> = []

  for (const folder of folders) {
    // logDebug('userInput / createFolderOptions', `- folder: ${folder}`)
    if (folder === newFolderText) {
      simpleOptions.push({ label: newFolderText, value: newFolderText })
      decoratedOptions.push({
        icon: 'folder-plus',
        color: 'orange-500',
        text: newFolderText,
        shortDescription: 'Add new',
        alpha: 0.5,
        darkAlpha: 0.5,
      })
    } else if (folder !== '/') {
      const [simpleOption, decoratedOption] = createFolderRepresentation(folder, includeFolderPath, teamspaceDefs)
      simpleOptions.push({ label: simpleOption, value: folder })
      decoratedOptions.push(decoratedOption)
    } else {
      // deal with special case for private root folder
      simpleOptions.push({ label: '📁 /', value: '/' })
      decoratedOptions.push({
        icon: 'folder',
        color: 'gray-500',
        text: '/',
        shortDescription: 'Root folder',
      })
    }
  }

  return [simpleOptions, decoratedOptions]
}

/**
 * Create a simple and decorated representation of a folder's name with appropriate icon and formatting
 * @param {string} folder - folder path
 * @param {boolean} includeFolderPath - whether to show full path
 * @param {Array} teamspaceDefs - teamspace definitions
 * @returns {[string, TCommandBarOptionObject]} simple and decorated version of the folder label
 */
export function createFolderRepresentation(folder: string, includeFolderPath: boolean, teamspaceDefs: Array<TTeamspace>): [string, TCommandBarOptionObject] {
  // logDebug('userInput / createFolderRepresentation', `- folder: ${folder}`)
  const INDENT_SPACES = '     ' // to use for indentation of folders that are not the root folder, when includeFolderPath is false
  const FOLDER_PATH_MAX_LENGTH = 50 // OK on desktop and iOS, at least for @jgclark
  const folderParts = folder.split('/')
  const isTeamspaceFolder = teamspaceDefs.some((teamspaceDef) => folder.includes(teamspaceDef.id))
  let simpleOption: string = ''

  // Set default icons
  let simpleIcon = '📁'
  const decoratedOption: TCommandBarOptionObject = {
    icon: 'folder',
    color: 'gray-500',
    alpha: 0.5,
    darkAlpha: 0.5,
    text: '',
    shortDescription: '',
  }

  // Update the icon to use the appropriate icon for special @folders
  if (folderParts[0] === '@Archive') {
    simpleIcon = '🗄️'
    decoratedOption.icon = 'box-archive'
  } else if (folderParts[0] === '@Templates') {
    simpleIcon = '📝'
    decoratedOption.icon = 'clipboard'
  } else if (folderParts[0] === '@Trash') {
    simpleIcon = '🗑️'
    decoratedOption.icon = 'trash-can'
  }

  if (isTeamspaceFolder) {
    const thisTeamspaceDef: ?TTeamspace = teamspaceDefs.find((thisTeamspaceDef) => folder.includes(thisTeamspaceDef.id))
    if (!thisTeamspaceDef) {
      throw new Error(`userInput / createFolderRepresentation: teamspaceDef not found for folder: "${folder}"`)
    }
    const teamspaceTitle = getTeamspaceTitleFromID(thisTeamspaceDef.id)
    const teamspaceDetails = parseTeamspaceFilename(folder)
    // logDebug('userInput / createFolderRepresentation', `teamspaceDef: ${ JSON.stringify(thisTeamspaceDef) } from '${folder}' / filepath:${ teamspaceDetails.filepath } / includeFolderPath:${ String(includeFolderPath) }`)
    if (teamspaceDetails.filepath === '/') {
      simpleOption = `👥 ${teamspaceTitle}`
      decoratedOption.color = TEAMSPACE_ICON_COLOR
      decoratedOption.text = '/'
      decoratedOption.shortDescription = teamspaceTitle
      // decoratedOption.alpha = 0.6
      // decoratedOption.darkAlpha = 0.6
    } else {
      if (includeFolderPath) {
        simpleOption = `👥 ${teamspaceTitle} / ${folderParts.slice(2).join(' / ')}`
        decoratedOption.color = TEAMSPACE_ICON_COLOR
        decoratedOption.text = folderParts.slice(2).join(' / ')
        decoratedOption.shortDescription = teamspaceTitle
        // decoratedOption.alpha = 0.6
        // decoratedOption.darkAlpha = 0.6
      } else {
        simpleOption = `${simpleIcon} ${folderParts.slice(2).join(' / ')}`
        decoratedOption.color = TEAMSPACE_ICON_COLOR
        decoratedOption.text = folderParts.slice(2).join(' / ')
        decoratedOption.shortDescription = teamspaceTitle
        // decoratedOption.alpha = 0.6
        // decoratedOption.darkAlpha = 0.6
      }
    }
    // logDebug('userInput / createFolderRepresentation', `-> teamspaceDef: ${ JSON.stringify(decoratedOption) } `)
  } else if (includeFolderPath) {
    // Get the folder path prefix, and truncate it if it's too long
    if (folder.length >= FOLDER_PATH_MAX_LENGTH) {
      const folderPathPrefix = `${folder.slice(0, FOLDER_PATH_MAX_LENGTH - folderParts[folderParts.length - 1].length)} …${folderParts[folderParts.length - 1]} `
      simpleOption = `${simpleIcon} ${folderPathPrefix} `
      decoratedOption.text = folderPathPrefix
    } else {
      simpleOption = `${simpleIcon} ${folderParts.join(' / ')} `
      decoratedOption.text = folderParts.join(' / ')
    }
  } else {
    // Replace earlier parts of the path with indentation spaces
    const indentedParts = [...folderParts]
    for (let i = 0; i < indentedParts.length - 2; i++) {
      indentedParts[i] = INDENT_SPACES
    }
    simpleOption = `${indentedParts.join('')}${simpleIcon} ${indentedParts[indentedParts.length - 1]}`
    decoratedOption.text = indentedParts.join('')
  }
  return [simpleOption, decoratedOption]
}

/**
 * Creates a new folder with help from the user.
 * If 'containingFolder' is specified, then use it as the containing folder for the new folder, otherwise ask user (constrained by the other two parameters).
 * Then ask user for the new folder's name.
 * The function handles the creation process and returns the path of the newly created folder.
 *
 * @param {string} containingFolder - The current folder path or name selected by the user. If blank, then ask user where to create the new folder.
 * @param {string} startingFolderToChooseFrom - The initial folder path to start the selection from.
 * @param {boolean?} includeArchive? - A flag indicating whether to include archived folders in the selection process. (Optional: defaults to false)
 * @returns {Promise<string>} - the path of the newly created folder, or an empty string if creation fails.
 */
async function handleNewFolderCreation(
  containingFolder: string,
  startingFolderToChooseFrom: string,
  includeArchive?: boolean = false,
  includeFolderPath?: boolean = true,
  excludeTeamspaces?: boolean = false,
  forceOriginalCommandBar?: boolean = false,
): Promise<string> {
  try {
    let inWhichFolder = ''
    let newFolderName: string | boolean

    logDebug('userInput / handleNewFolderCreation', `containingFolder: "${containingFolder}" / startingFolderToChooseFrom: "${startingFolderToChooseFrom}"`)
    if (containingFolder === '') {
      newFolderName = await getInput(`Step 1: Name (not path) of new folder:`, 'OK', `Create new folder`, '')
      if (typeof newFolderName !== 'string' || newFolderName === '') {
        throw new Error('No new folder name given.')
      }
      inWhichFolder = await chooseFolder(
        `Step 2: Create sub-folder '${newFolderName}' inside which folder?`,
        includeArchive,
        false,
        startingFolderToChooseFrom,
        includeFolderPath,
        excludeTeamspaces,
        forceOriginalCommandBar,
      )
    } else {
      const teamspaceDefs = getAllTeamspaceIDsAndTitles()
      const [simpleFolderRepresentation, _decoratedFolderRepresentation] = createFolderRepresentation(containingFolder, true, teamspaceDefs)
      newFolderName = await CommandBar.textPrompt(`Create new folder`, `Name (not path) of new folder to create in folder '${simpleFolderRepresentation}':`, '')
      if (!newFolderName || newFolderName === '') {
        throw new Error('No new folder name given.')
      }
      inWhichFolder = containingFolder
    }

    if (inWhichFolder) {
      newFolderName = inWhichFolder === '/' ? newFolderName : `${inWhichFolder}/${newFolderName}`
    }
    DataStore.createFolder(newFolderName)
    logInfo('userInput / handleNewFolderCreation', ` -> created new folder "${newFolderName}"`)
    return newFolderName
  } catch (error) {
    logError('userInput / handleNewFolderCreation', error.message)
    return ''
  }
}

/**
 * Ask user to select a heading from those in a given note (regular or calendar), or optionally create a new heading at top or bottom of note to use, or the top or bottom of the note.
 * Note: Any whitespace on the end of the heading text is left in place, as otherwise this would cause issues with NP API calls that take heading parameter.
 * @author @jgclark
 *
 * @param {TNote} note - note to draw headings from
 * @param {boolean} optionAddATopAndtBottom - whether to add 'top of note' and 'bottom of note' options. Default: true.
 * @param {boolean} optionCreateNewHeading - whether to offer to create a new heading at the top or bottom of the note. Default: false.
 * @param {boolean} includeArchive - whether to include headings in the Archive section of the note (i.e. after 'Done'). Default: false.
 * @param {number} headingLevel - if adding a heading, the H1-H5 level to set (as an integer)
 * @returns {string} - the selected heading as text without any markdown heading markers. Blank string implies no heading selected, and user wishes to write to the end of the note. Special string '<<top of note>>' implies to write to the top (after any preamble or frontmatter). Likewise '<<bottom of note>>'.
 */
export async function chooseHeading(
  note: TNote,
  optionAddATopAndtBottom: boolean = true,
  optionCreateNewHeading: boolean = false,
  includeArchive: boolean = false,
  headingLevel: number = 2,
): Promise<string> {
  try {
    // Get the existing headings from the note, with markdown markers, and also add top and bottom of note options etc. if requested
    const headingStrings = getHeadingsFromNote(note, true, optionAddATopAndtBottom, optionCreateNewHeading, includeArchive)

    // Present heading options to user and ask for choice
    const result = await CommandBar.showOptions(headingStrings, `Select a heading from note '${note.title ?? 'Untitled'}'`)

    // Get the underlying heading back by removing added # marks and trimming left.
    // Note: We don't trim right as there can be valid trailing spaces.
    let headingToReturn = headingStrings[result.index].replace(/^#{1,5}\s*/, '').trimLeft()
    headingToReturn = await processChosenHeading(note, headingToReturn, headingLevel)
    return headingToReturn
  } catch (error) {
    logError('userInput / chooseHeading', error.message)
    return '<error>'
  }
}

/**
 * Ask user to select a heading from those in a given note (regular or calendar), or optionally create a new heading at top or bottom of note to use, or the top or bottom of the note.
 * Note: Any whitespace on the end of the heading text is left in place, as otherwise this would cause issues with NP API calls that take heading parameter.
 * V2: Can use newer CommandBar decorated options, if running on v3.18 or later.
 * @author @jgclark
 *
 * @param {TNote} note - note to draw headings from
 * @param {boolean} optionAddATopAndtBottom - whether to add 'top of note' and 'bottom of note' options. Default: true.
 * @param {boolean} optionCreateNewHeading - whether to offer to create a new heading at the top or bottom of the note. Default: false.
 * @param {boolean} includeArchive - whether to include headings in the Archive section of the note (i.e. after 'Done'). Default: false.
 * @param {number} headingLevel - if adding a heading, the H1-H5 level to set (as an integer)
 * @returns {string} - the selected heading as text without any markdown heading markers. Blank string implies no heading selected, and user wishes to write to the end of the note. Special string '<<top of note>>' implies to write to the top (after any preamble or frontmatter). Likewise '<<bottom of note>>'.
 */
export async function chooseHeadingV2(
  note: TNote,
  optionAddAtTopAndBottom: boolean = true,
  optionCreateNewHeading: boolean = false,
  includeArchive: boolean = false,
  headingLevel: number = 2,
): Promise<string> {
  try {
    // If running on v3.17 or earlier, use the older chooseHeading() function
    if (NotePlan.environment.buildVersion < 1413) {
      return await chooseHeading(note, optionAddAtTopAndBottom, optionCreateNewHeading, includeArchive, headingLevel)
    }

    // Get the existing headings from the note, with markdown markers, but without any 'create new heading' options
    const headingStrings = getHeadingsFromNote(note, true, false, false, includeArchive)
    const headingOptions: Array<TCommandBarOptionObject> = []
    headingStrings.forEach((heading) => {
      const headingWithoutLeadingMarkers = heading.replace(/^#{1,5}\s*/, '')
      const headingLevel = heading.match(/^#{1,5}/)?.[0]?.length ?? 2
      headingOptions.push({
        text: '    '.repeat(headingLevel - 1) + headingWithoutLeadingMarkers,
        icon: 'h' + String(headingLevel),
        alpha: 0.6,
        darkAlpha: 0.6,
      })
    })

    // Now add any wanted new heading options (borrowing logic from getHeadingsFromNote())
    if (optionCreateNewHeading) {
      headingOptions.unshift({
        text: note.type === 'Calendar' ? '(insert new heading at the start of the note)' : '(insert new heading under the title)',
        icon: 'h' + String(headingLevel),
        shortDescription: 'Add new',
        color: 'orange-500',
        alpha: 0.6,
        darkAlpha: 0.6,
      })
      headingOptions.push({
        text: '(insert new heading at the end of the note)',
        icon: 'h' + String(headingLevel),
        shortDescription: 'Add new',
        color: 'orange-500',
        alpha: 0.6,
        darkAlpha: 0.6,
      })
    }
    if (optionAddAtTopAndBottom) {
      headingOptions.unshift({
        text: '(top of note)',
        icon: 'angles-up',
        shortDescription: 'Top',
        color: 'blue-500',
        alpha: 0.8,
        darkAlpha: 0.8,
      })
      headingOptions.push({
        text: '(bottom of note)',
        icon: 'angles-down',
        shortDescription: 'Bottom',
        color: 'blue-500',
        alpha: 0.8,
        darkAlpha: 0.8,
      })
    }

    // Present heading options to user and ask for choice
    const result = await CommandBar.showOptions(headingOptions, `Select a heading from note '${note.title ?? 'Untitled'}'`)

    // Get the underlying heading back by removing added # marks and trimming left.
    // Note: We don't trim right as there can be valid trailing spaces.
    let headingToReturn = headingOptions[result.index].text.replace(/^#{1,5}\s*/, '').trimLeft()
    headingToReturn = await processChosenHeading(note, headingToReturn, headingLevel)
    return headingToReturn
  } catch (error) {
    logError('userInput / chooseHeading', error.message)
    return '<error>'
  }
}

/**
 * Used as part of chooseHeading (above) and Dashboard, to handle special instructions -- inserting a new heading, or inserting at top or bottom of the note.
 * If there are no special instructions, it just returns the heading as is.
 * @param {TNote} note
 * @param {string} chosenHeading - The text of the new heading to add, or 5 possible special instruction strings.
 * @param {number?} headingLevel - The level of the heading to add (1-5) where requested. If not given, will default to 2.
 * @returns {string} headingToReturn - The heading to return, or one of the special instruction strings <<top of note>>, <<bottom of note>>.
 */
export async function processChosenHeading(note: TNote, chosenHeading: string, headingLevel: number = 2): Promise<string> {
  if (chosenHeading === '') {
    throw new Error('No heading passed to processChosenHeading(). Stopping.')
  }

  let newHeading: string | boolean
  let headingToReturn = chosenHeading
  logDebug('userInput / processChosenHeading', `headingLevel: ${headingLevel} chosenHeading: '${chosenHeading}'`)

  if (headingToReturn.includes('insert new heading at the start of the note')) {
    // ask for new heading, and insert right at top
    newHeading = await getInput(`Enter heading to add at the start of the note`)
    if (newHeading && typeof newHeading === 'string') {
      const startPos = 0
      // $FlowIgnore
      note.insertHeading(newHeading, startPos, headingLevel)
      logDebug('userInput / processChosenHeading', `prepended new heading '${newHeading}' at line ${startPos} (calendar note)`)
      headingToReturn = newHeading
    } else {
      throw new Error(`user cancelled operation`)
    }
  } else if (headingToReturn.includes('insert new heading under the title')) {
    // ask for new heading, find smart insertion position, and insert it
    newHeading = await getInput(`Enter heading to add at the start of the note`)
    if (newHeading && typeof newHeading === 'string') {
      const startPos = findStartOfActivePartOfNote(note)
      // $FlowIgnore
      note.insertHeading(newHeading, startPos, headingLevel)
      logDebug('userInput / processChosenHeading', `prepended new heading '${newHeading}' at line ${startPos} (project note)`)
      headingToReturn = newHeading
    } else {
      throw new Error(`user cancelled operation`)
    }
  } else if (headingToReturn.includes('insert new heading at the end of the note')) {
    // ask for new heading, and then append it
    newHeading = await getInput(`Enter heading to add at the end of the note`)
    if (newHeading && typeof newHeading === 'string') {
      const indexEndOfActive = findEndOfActivePartOfNote(note)
      const newLindeIndex = indexEndOfActive + 1
      // $FlowIgnore - headingLevel is a union type, and we've already checked it's a number
      note.insertHeading(newHeading, newLindeIndex, headingLevel || 2)
      logDebug('userInput / processChosenHeading', `appended new heading '${newHeading}' at line ${newLindeIndex}`)
      headingToReturn = newHeading
    } else {
      throw new Error(`user cancelled operation`)
    }
  } else if (headingToReturn.includes('(top of note)')) {
    logDebug('userInput / processChosenHeading', `selected top of note, rather than a heading`)
    headingToReturn = '<<top of note>>' // hopefully won't ever be used as an actual title!
  } else if (headingToReturn.includes('(bottom of note)')) {
    logDebug('userInput / processChosenHeading', `selected end of note, rather than a heading`)
    headingToReturn = '<<bottom of note>>'
  } else {
    // Nothing else to do
  }
  return headingToReturn
}

/**
 * Ask for a date interval from user, using CommandBar
 * @author @jgclark
 *
 * @param {string} dateParams - given parameters -- currently only looks for {question:'question test'} parameter in a JSON string. if it's a normal string, it will be treated as the question.
 * @return {string} - the returned interval string, or empty if an invalid string given
 */
export async function askDateInterval(dateParams: string): Promise<string> {
  // logDebug('askDateInterval', `starting with '${dateParams}':`)
  const dateParamsTrimmed = dateParams?.trim() || ''
  const isJSON = dateParamsTrimmed.startsWith('{') && dateParamsTrimmed.endsWith('}')
  const paramConfig = isJSON ? parseJSON5(dateParams) : dateParamsTrimmed !== '' ? { question: dateParams } : {}
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
 * @param {string|object} dateParams - given parameters -- currently only looks for {question:'question test'} and {defaultValue:'YYYY-MM-DD'} and {canBeEmpty: false} parameters
 * @param {[string]: ?mixed} config - previously used as settings from _configuration note; now ignored
 * @return {string} - the returned ISO date as a string, or empty if an invalid string given
 */
export async function datePicker(dateParams: string | Object, config?: { [string]: ?mixed } = {}): Promise<string | false> {
  try {
    const dateConfig = config.date ?? {}
    // $FlowIgnore[incompatible-call]
    // $FlowIgnore[not-an-object]
    clo(dateConfig, `userInput / datePicker dateParams="${JSON.stringify(dateParams)}" dateConfig typeof="${typeof dateConfig}" keys=${Object.keys(dateConfig || {}).toString()}`)
    let paramConfig = dateParams
    if (typeof dateParams === 'string') {
      // JSON stringified string
      const dateParamsTrimmed = dateParams.trim()
      paramConfig = dateParamsTrimmed
        ? dateParamsTrimmed.startsWith('{') && dateParamsTrimmed.endsWith('}')
          ? parseJSON5(dateParams)
          : dateParamsTrimmed !== ''
          ? parseJSON5(`{${dateParams}}`)
          : {}
        : {}
    }

    // $FlowIgnore[incompatible-type]
    logDebug('userInput / datePicker', `params: ${JSON.stringify(dateParams)} -> ${JSON.stringify(paramConfig)}`)
    // '...' = "gather the remaining parameters into an array"
    const allSettings: { [string]: mixed } = {
      // $FlowIgnore[exponential-spread] known to be very small objects
      // $FlowIgnore[not-an-object]
      ...dateConfig,
      // $FlowIgnore[not-an-object]
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
      if (!allSettings.canBeEmpty) {
        const reply2 = reply.replace('>', '').trim() // remove leading '>' and trim
        if (!reply2.match(RE_DATE)) {
          await showMessage(`FYI: ${reply2} wasn't a date in the preferred form YYYY-MM-DD`, `OK`, 'Warning')
          return ''
        }
      }
      return reply
    } else {
      logWarn('userInput / datePicker', `User cancelled date input: ${typeof reply}: "${String(reply)}"`)
      return false
    }
  } catch (e) {
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
    logInfo('userInput / inputInteger', `Error trying to get integer answer for question '${question}'. -> NaN`)
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
      logInfo('userInput / inputIntegerBounded', `Value ${reply} is out of bounds for [${String(lowerBound)},${String(upperBound)}] -> NaN`)
    }
  } else {
    logInfo('userInput / inputIntegerBounded', `No valid integer answer for question '${question}' -> NaN`)
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
  const answers: Array<string> = []

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
 * Create a new regular note with a given title, content, and in a specified folder.
 * If title, content, or folder is not provided, it will prompt the user for input.
 * Note: ideally would live in NPnote.js, but it's here because it uses other functions in userInput.
 * @author @dwertheimer
 *
 * @param {string} [_title] - The title of the new note.
 * @param {string} [_content] - The content of the new note.
 * @param {string} [_folder] - The folder to create the new note in.
 * @returns {Promise<Note | false>} - The newly created note, or false if the operation was cancelled.
 */
export async function createNewRegularNote(_title?: string = '', _content?: string = '', _folder?: string = ''): Promise<Note | null> {
  const title = _title || ((await getInput('Title of new note', 'OK', 'New Note', '')) && 'error')
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
 * Choose a particular note from a CommandBar list of notes
 * @author @dwertheimer extended by @jgclark to include 'relative date' indicators in displayed title
 * @param {boolean} includeProjectNotes
 * @param {boolean?} includeCalendarNotes
 * @param {Array<string>?} foldersToIgnore - a list of folder names to ignore
 * @param {string?} promptText - text to display in the CommandBar
 * @param {boolean?} currentNoteFirst - add currently open note to the front of the list
 * @param {boolean?} allowNewNoteCreation - add option for user to create new note to return instead of choosing existing note
 * @returns {?TNote} note
 */
export async function chooseNote(
  includeProjectNotes: boolean = true,
  includeCalendarNotes?: boolean = false,
  foldersToIgnore?: Array<string> = [],
  promptText?: string = 'Choose a note',
  currentNoteFirst?: boolean = false,
  allowNewNoteCreation?: boolean = false,
): Promise<?TNote> {
  let noteList: Array<TNote> = []
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
  const sortedNoteListFiltered = noteListFiltered.sort((first, second) => second.changedDate.getTime() - first.changedDate.getTime()) // most recent first
  const opts = sortedNoteListFiltered.map((note) => {
    return displayTitleWithRelDate(note)
  })
  const { note } = Editor
  if (allowNewNoteCreation) {
    opts.unshift('[New note]')
    // $FlowIgnore[incompatible-type] just to keep the indexes matching; won't be used
    sortedNoteListFiltered.unshift('[New note]') // just keep the indexes matching
  }
  if (currentNoteFirst && note) {
    sortedNoteListFiltered.unshift(note)
    opts.unshift(`[Current note: "${displayTitleWithRelDate(Editor)}"]`)
  }
  const { index } = await CommandBar.showOptions(opts, promptText)
  const noteToReturn = opts[index] === '[New note]' ? await createNewRegularNote() : sortedNoteListFiltered[index]
  return noteToReturn ?? null
}
