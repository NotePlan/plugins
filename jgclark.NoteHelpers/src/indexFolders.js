// @flow
//-----------------------------------------------------------------------------
// Jonathan Clark
// Last updated 25.1.2023 for v0.16.0 by @jgclark
//-----------------------------------------------------------------------------

import { toLocaleDateString } from "../../helpers/NPdateTime";
import pluginJson from '../plugin.json'
import { getSettings, type noteHelpersConfigType } from './noteHelpers'
import {
  daysBetween,
  nowLocaleDateTime,
  relativeDateFromNumber,
  toISOShortDateTimeString,
} from '@helpers/dateTime'
import { JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import {
  createPrettyRunPluginLink,
  displayTitle,
  returnNoteLink,
} from '@helpers/general'
import { notesInFolderSortedByTitle } from '@helpers/note'
import {
  chooseFolder,
  chooseOption,
  // showMessage,
} from '@helpers/userInput'

const pluginID = 'jgclark.NoteHelpers'

//-----------------------------------------------------------------------------
/** 
 * Command to generate the index of a specified folder, including
 * each note as a wikilink, with relative time since it was last updated.
 * @author @jgclark
 * 
 * @param {string} folder - folder name (without trailling /)
 * @param {string} displayOrder - sort order for index items
 * @param {string} dateDisplayType - what type of date suffix to add
 * @param {boolean} includeSubfolders?
 * @return {Array<string>} array of strings, one for each output line
*/
function makeFolderIndex(folder: string, displayOrder: string, dateDisplayType: string, includeSubfolders: boolean): Array<string> {
  try {
    logDebug(pluginJson, `makeFolderIndex() starting for '${folder}' (${includeSubfolders ? 'with' : 'without'} subfolders)`)

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

    // Iterate over the folders
    let isSubFolder = false
    for (const f of folderList) {
      // Get list of the notes in this folder, but ignore any '_index' notes :-)
      const notes = notesInFolderSortedByTitle(f)
        .filter((n) => !n.title?.startsWith('_index'))
      // logDebug('makeFolderIndex', `${notes.length} notes before sort`)

      // Sort this list by whatever the user's setting says
      // (Need to do this before the gatherMatchingLines, as afterwards we don't have date information.)
      switch (displayOrder) {
        case 'updatedDate':
          notes.sort((a, b) => (a.changedDate > b.changedDate ? -1 : 1))
          break
        case 'createdDate': // though data is very unreliable at least from NP 3.0.23 to 3.8.0
          notes.sort((a, b) => (a.createdDate > b.createdDate ? -1 : 1))
          break
        default: // alphabetical
          notes.sort((a, b) => (displayTitle(a).toUpperCase() < displayTitle(b).toUpperCase() ? -1 : 1))
          break
      }
      // logDebug('makeFolderIndex', `${notes.length} notes after sort`)

      // Add Refresh button FIXME: firing but nothing changing
      const dateExplainer = (dateDisplayType === "updated date") ? "Dates are when note was last updated. "
        : (dateDisplayType === "time since last update") ? "Times are since note was last updated. "
          : ""
      const paramsForXCB: Array<string> = [folder, displayOrder, dateDisplayType, "true"]
      const XCBStr = createPrettyRunPluginLink('🔄 Refresh', pluginID, 'index folders', paramsForXCB)
      outputArray.push(isSubFolder ? `### ${f} (${notes.length})` : `_index ${f}\nIndex generated ${nowLocaleDateTime}. ${dateExplainer}${XCBStr}`)

      if (notes.length > 0) {
        // If this is a sub-folder level, then prefix with ### for a 3rd level heading,
        // otherwise leave blank, as a suitable header gets added elsewhere.
        // outputArray.push(`${notes.length} notes`)
        // iterate over this folder's notes
        for (const note of notes) {
          // option about use of "choices": [ "none", "time since last update", "updated date"]
          const dateSuffix = (dateDisplayType === "updated date") ? '\t' + toLocaleDateString(note.changedDate)
            : (dateDisplayType === "time since last update") ? '\t' + relativeDateFromNumber(daysBetween(new Date(), note.changedDate))
              : ''
          // const createdDateTime = toLocaleDateString(note.createdDate)
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
 * Options:
 * 1. This folder only (insert into current note)
 * 2. This folder only (add/update to _index note)
 * 3. This folder + subfolders (add/update into single _index note)
 * 4. This folder + subfolders (add/update into _index notes in each subfolder)
 * // TODO: add parameters for other ways to call
 * @author @jgclark
 * @param {string} folder - folder name (without trailling /)
 * @param {string} displayOrder - sort order for index items (default: 'alphabetical')
 * @param {string?} dateDisplayType - what type of date suffix to add? (default: 'none')
 * @param {boolean?} includeSubfolders? (default: true)
 */
export async function indexFolders(folder: string, displayOrder: string = "alphabetical", dateDisplayType: string = "none", includeSubfolders: boolean = true): Promise<void> {
  try {
    let folderToUse: string = ''
    let fullFilename = ''
    logDebug(pluginJson, `indexFolders() starting`)

    // Get folder from param, falling back to current note's folder
    if (folder) {
      folderToUse = getFolderFromFilename(folder)
    }
    else {
      fullFilename = Editor.filename ?? undefined
      if (fullFilename === undefined) {
        logInfo('indexFolders', `  Info: No current filename (and therefore folder) found, so will ask instead.`)
        folderToUse = await chooseFolder(`Please pick folder to index`)
      } else {
        folderToUse = getFolderFromFilename(fullFilename)
      }
    }
    logDebug('indexFolders', `indexFolders from folder ${folderToUse}`)

    // Use parameters if passed, otherwise fallback to the settings
    const config: noteHelpersConfigType = await getSettings()

    // TODO: Can this be ignored when called by Refresh?
    const option = await chooseOption(
      'Create index for which folder(s)?',
      [
        {
          label: `🖊 This folder only (insert into current note)`,
          value: 'one-to-current',
        },
        {
          label: `🖊 This folder only (add/update to _index note)`,
          value: 'one-to-index',
        },
        {
          label: `🖊 This folder and sub-folders (add/update to single _index note)`,
          value: 'all-to-one-index',
        },
        {
          label: `📋 This folder only (to console log)`,
          value: 'one-to-log',
        },
        // { // TODO: Complete me
        //   label: `(NOT YET WORKING) This folder and sub-folders (add/update to _index notes)`,
        //   value: 'all-to-many-index',
        // },
        {
          label: '❌ Cancel',
          value: false,
        },
      ],
      false,
    )

    if (!option) {
      return
    }

    // Start constructing output
    let outputArray: Array<string> = []
    let displayOrderToUse = config.displayOrder
    let dateDisplayTypeToUse = config.dateDisplayType

    // logDebug('indexFolders', `- option: ${option}`)
    if (option.startsWith('one')) {
      outputArray = makeFolderIndex(folderToUse, config.displayOrder, config.dateDisplayType, false)
    } else if (option.startsWith('all')) {
      outputArray = makeFolderIndex(folderToUse, config.displayOrder, config.dateDisplayType, true)
    }
    const outString = outputArray.join('\n')
    // logDebug('indexFolders', outString)

    if (option.endsWith('index')) {
      // write out to index file(s)
      let outputFilename = `${folderToUse}/_index.${DataStore.defaultFileExtension}`
      // see if we already have an _index file in this folder
      let outputNote = DataStore.projectNoteByFilename(outputFilename)

      if (outputNote == null) {
        // make a new note for this
        outputFilename = await DataStore.newNote('_index', folderToUse) ?? ''
        logDebug('indexFolders', `- newNote filename: ${String(outputFilename)}`)
        // outputFilename = `${pref_folderToStore}/${String(outputFilename)}` ?? '(error)'
        // NB: filename here = folder + filename
        if (outputFilename !== '') {
          return
        }
        outputNote = await DataStore.projectNoteByFilename(outputFilename)
        logInfo('indexFolders', `writing results to the new note '${outputFilename}'`)
      }

      if (outputNote != null) {
        outputNote.content = `# ${outString}` // overwrite what was there before
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
