// @flow
//-----------------------------------------------------------------------------
// Jonathan Clark
// Last updated 30.6.2023 for v0.17.2 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getSettings, type noteHelpersConfigType } from './noteHelpers'
import {
  daysBetween,
  relativeDateFromNumber,
  toISOShortDateTimeString,
} from '@helpers/dateTime'
import {
  nowLocaleShortDateTime,
  toLocaleDateString,
} from '@helpers/NPdateTime'
import {
  JSP, logDebug, logError, logInfo,
  overrideSettingsWithStringArgs
} from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import {
  createPrettyRunPluginLink,
  displayTitle,
  returnNoteLink,
} from '@helpers/general'
import { notesInFolderSortedByTitle, pastCalendarNotes } from '@helpers/note'
import {
  chooseFolder,
  chooseOption,
  // showMessage,
} from '@helpers/userInput'
import { openNoteByFilename } from "../../helpers/NPnote"

const pluginID = 'jgclark.NoteHelpers'

//-----------------------------------------------------------------------------
/**
 * Private function to generate the index of a specified folder, including
 * each note as a wikilink, with relative time since it was last updated.
 * @author @jgclark
 *
 * @param {string} folder - folder name (without trailling /)
 * @param {any} config - config object
 * @param {boolean} includeSubfolders?
 * @returns {Array<string>} array of strings, one for each output line
*/
function makeFolderIndex(folder: string, config: any, /* displayOrder: string, dateDisplayType: string,*/ includeSubfolders: boolean): Array<string> {
  try {
    logDebug(pluginJson, `makeFolderIndex() starting for '${folder}', displayOrder:${config.displayOrder} / dateDisplayType:${config.dateDisplayType} / ${includeSubfolders ? 'with' : 'without'} subfolders`)

    const outputArray: Array<string> = []
    let folderList: Array<string> = []
    // if we want a to include any subfolders, create list of folders
    if (includeSubfolders) {
      folderList = DataStore.folders.filter((f) => f.startsWith(folder))
    } else {
      // otherwise use a single folder
      folderList = [folder]
    }
    logDebug('makeFolderIndex', `- Found ${folderList.length} matching folder(s)`)

    // Prepare output items we need just once in the output
    const sortExplainer = (config.displayOrder === "updatedDate")
      ? "Sorted by most recently updated date"
      : (config.displayOrder === "createdDate")
        ? "Sorted by most recently created date"
        : "Sorted by title"
    // const dateDisplayExplainer = (config.dateDisplayType === "timeSince")
    const dateExplainer = (config.dateDisplayType === "updatedDate")
      ? "Dates are when note was last updated."
      : (config.dateDisplayType === "timeSince")
        ? "Times are since note was last updated."
        : ""
    // const paramsForXCB: Array<string> = [folder, config.displayOrder, config.dateDisplayType, String(includeSubfolders)]
    const argsForXCB = `displayOrder:${config.displayOrder};dateDisplayType=${config.dateDisplayType};includeSubfolders=${String(includeSubfolders)}`
    const paramsForXCB: Array<string> = [folder, argsForXCB]
    const refreshXCBStr = createPrettyRunPluginLink('🔄 Refresh', pluginID, 'index folders', paramsForXCB)

    // Iterate over the folders
    let isSubFolder = false
    for (const f of folderList) {
      // Get list of the notes in this folder, but ignore any '_index' notes :-)
      const outputTitle = config.indexTitle.replace('{{folder}}', f)
      let notes = notesInFolderSortedByTitle(f)
        .filter((n) => n.title !== outputTitle)
      logDebug('makeFolderIndex', `- Found ${notes.length} notes in '${f}' before '${config.displayOrder}' sort`)

      // Sort this list by whatever the user's setting says
      // (Need to do this before the gatherMatchingLines, as afterwards we don't have date information.)
      switch (config.displayOrder) {
        case 'updatedDate':
          notes = notes.sort((a, b) => (a.changedDate > b.changedDate ? -1 : 1))
          break
        case 'createdDate': // though data is very unreliable at least from NP 3.0.23 to 3.8.0
          notes = notes.sort((a, b) => (a.createdDate > b.createdDate ? -1 : 1))
          break
        default: // alphabetical
          notes = notes.sort((a, b) => (displayTitle(a).toUpperCase() < displayTitle(b).toUpperCase() ? -1 : 1))
          break
      }
      // logDebug('makeFolderIndex', `- ${notes.length} notes after sort`)

      // Add suffix, if wanted

      if (isSubFolder) {
        outputArray.push(`### ${f} (${notes.length})`)
      } else {
        outputArray.push(outputTitle)
        outputArray.push(`Index generated ${nowLocaleShortDateTime()} ${refreshXCBStr} \n${sortExplainer}. ${dateExplainer}`)

      }

      if (notes.length > 0) {
        // If this is a sub-folder level, then prefix with ### for a 3rd level heading,
        // otherwise leave blank, as a suitable header gets added elsewhere.
        // outputArray.push(`${notes.length} notes`)
        // iterate over this folder's notes
        for (const note of notes) {
          // add type of date suffix (if wanted)
          const dateSuffix = (config.dateDisplayType === "updatedDate")
            ? '\t' + toLocaleDateString(note.changedDate)
            : (config.dateDisplayType === "timeSince")
              ? '\t' + relativeDateFromNumber(daysBetween(new Date(), note.changedDate))
              : ''
          outputArray.push(`- ${returnNoteLink(note.title ?? 'error')}${dateSuffix}`)
        }
        outputArray.push('')
      } else {
        outputArray.push('(No notes found)')
      }
      isSubFolder = true
    }
    return outputArray
  }
  catch (err) {
    logError(pluginJson, JSP(err))
    return ['error running makeFolderIndex'] // for completeness
  }
}

/**
 * Command to index folders, creating list of notes.
 * Called by user directly, or via x-callback call.
 * Options:
 * 1. This folder only (insert into current note)
 * 2. This folder only (add/update to _index note)
 * 3. This folder + subfolders (add/update into single _index note)
 * 4. This folder + subfolders (add/update into _index notes in each subfolder)
 * @author @jgclark
 * @param {string?} folder - folder name (without trailling /)
 * @param {string?} args - (optional) other arguments, as semicolon-separated set of key=value. Possible keys:
 * - displayOrder - sort order for index items ('updatedDate'/'createdDate'/'alphabetical')
 * - dateDisplayType - what type of date suffix to add ('none'/'timeSince'/'updateDate')
 * - includeSubfolders?
 */
export async function indexFolders(folder: string = "", args: string = ''): Promise<void> {
  try {
    let folderToUse = ''
    let fullFilename = ''

    // Use parameters if passed, otherwise fallback to the settings
    // v2 method
    let config: noteHelpersConfigType = await getSettings()
    config = overrideSettingsWithStringArgs(config, args)
    logDebug(pluginJson, `indexFolders() starting with (possibly default) params '${folder}', displayOrder:${config.displayOrder} / dateDisplayType:${config.dateDisplayType} / includeSubfolders? ${config.includeSubfolders}`)

    // Get folder from param, falling back to current note's folder
    if (folder) {
      folderToUse = folder
    } else {
      // logDebug('indexFolders', Editor.filename)
      logDebug('indexFolders', NotePlan.selectedSidebarFolder)
      folderToUse = (Editor.filename)
        ? getFolderFromFilename(Editor.filename)
        : (NotePlan.selectedSidebarFolder)
          ? NotePlan.selectedSidebarFolder
          : undefined
      logDebug('indexFolders', `folderToUse: ${folderToUse ?? '(undefined still)'}`)
      if (Editor.type === 'Calendar' || folderToUse === undefined) {
        logDebug('indexFolders', `Info: No valid current filename (or folder) found, so will ask instead.`)
        folderToUse = await chooseFolder(`Please pick folder to index`, true, true) // include @Archive as an option, and to create a new folder
      }
    }
    logDebug('indexFolders', `- values to use: folder:'${folderToUse}' / displayOrderToUse:${config.displayOrder} / dateDisplayTypeToUse:${config.dateDisplayType} / ${config.includeSubfolders ? 'with' : 'without'} subfolders`)

    // If we've been called by x-callback then output will be to relevant folder's Index file.
    let option: string | boolean
    if (folder) {
      option = (config.includeSubfolders) ? 'all-to-one-index' : 'one-to-index'
    } else {
      option = await chooseOption(
        'Create index for which folder(s)?',
        [
          {
            label: `🖊 This folder only (add/update to Index note)`,
            value: 'one-to-index',
          },
          {
            label: `🖊 This folder and sub-folders (add/update to single Index note)`,
            value: 'all-to-one-index',
          },
          {
            label: `🖊 This folder only (insert into current note)`,
            value: 'one-to-current',
          },
          {
            label: `📋 This folder only (to console log)`,
            value: 'one-to-log',
          },
          {
            label: '❌ Cancel',
            value: false,
          },
        ],
        false,
      )
    }

    if (!option) {
      // Cancel selected
      return
    }
    logDebug('indexFolders', `- option: ${option}`)

    // Start constructing output
    let outputArray: Array<string> = []

    if (option.startsWith('one')) {
      outputArray = makeFolderIndex(folderToUse, config, false)
    } else if (option.startsWith('all')) {
      outputArray = makeFolderIndex(folderToUse, config, true)
    }
    const outString = outputArray.join('\n')

    if (option.endsWith('index')) {
      // write out to Index file(s)
      let outputFilename = `${folderToUse}/_index.${DataStore.defaultFileExtension}`
      // see if we already have an _index file in this folder
      let outputNote = DataStore.projectNoteByFilename(outputFilename)

      if (outputNote == null) {
        // make a new note for this
        outputFilename = await DataStore.newNote('_index', folderToUse) ?? ''
        logDebug('indexFolders', `- newNote filename: ${String(outputFilename)}`)
        // outputFilename = `${pref_folderToStore}/${String(outputFilename)}` ?? '(error)'
        // NB: filename here = folder + filename
        if (outputFilename === '') {
          logError('indexFolders', `couldn't make a new note in folder ${folderToUse}' for some reason. Stopping.`)
          return
        }
        logInfo('indexFolders', `Writing index to new note '${outputFilename}'`)
        // outputNote = await DataStore.projectNoteByFilename(outputFilename)
        const options = { newWindow: false, newSplit: true, content: `# ${outString}`, highlightStart: 0, highlightEnd: 0 }
        // $FlowFixMe[prop-missing]
        outputNote = await openNoteByFilename(outputFilename, options)
      } else {
        logInfo('indexFolders', `Writing index to note '${outputFilename}'`)
      }
      // fresh test to see if we now have the note
      if (outputNote != null) {
        outputNote.content = `# ${outString}` // overwrite what was there before
        // Note: this setter doesn't seem to be enough in some cases?
      } else {
        logError('indexFolders', 'error after newNote(): no valid note to write to')
        return
      }
    } else if (option.endsWith('current')) {
      // write out to the current file
      Editor.insertTextAtCursor(`${outString}`)
    } else {
      // write out to the log
      logDebug('indexFolders', `Output:\n${outString}`)
    }

    logDebug('indexFolders', `Finished indexFolders.`)
  }
  catch (err) {
    logError('indexFolders', JSP(err))
  }
}
