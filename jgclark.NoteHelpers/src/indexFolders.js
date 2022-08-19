// @flow
//-----------------------------------------------------------------------------
// Jonathan Clark
// Last updated 24.7.2022 for v0.10.7+
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  daysBetween,
  nowLocaleDateTime,
  relativeDateFromNumber,
  toISOShortDateTimeString,
} from '@helpers/dateTime'
import { logDebug, logError, logInfo } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import {
  returnNoteLink,
} from '@helpers/general'
import { notesInFolderSortedByTitle } from '@helpers/note'
import {
  chooseFolder,
  chooseOption,
  // showMessage,
} from '@helpers/userInput'

//-----------------------------------------------------------------------------
/** 
 * Command to generate the index of a specified folder, including
 * each note as a wikilink, with relative time since it was last updated.
 * @author @jgclark
 * 
 * @param {string} folder - folder name (without trailling /)
 * @param {boolean} includeSubfolders
 * @return {[string]} array of strings, one for each output line
*/
function makeFolderIndex(
  folder: string,
  includeSubfolders: boolean,
): Array<string> {
  logDebug(pluginJson, 
    `\nmakeFolderIndex for '${folder}' (${
      includeSubfolders ? 'with' : 'without'
    } subfolders)`,
  )

  const outputArray: Array<string> = []
  let folderList: Array<string> = []
  // if we want a to include any subfolders, create list of folders
  if (includeSubfolders) {
    folderList = DataStore.folders.filter((f) => f.startsWith(folder))
  } else {
    // otherwise use a single folder
    folderList = [folder]
  }
  logDebug(pluginJson, `\tFound ${folderList.length} matching folder(s)`)

  // Iterate over the folders
  let subFolder = false
  for (const f of folderList) {
    // Get list of the notes in this folder, but ignore any '_index' notes :-)
    const notes = notesInFolderSortedByTitle(f)
      .filter((n) => !n.title?.startsWith('_index'))
    outputArray.push(subFolder ? `### ${f}` : `_index: ${f}\n_Index generated ${nowLocaleDateTime}. Times are since note was last updated._`)
    if (notes.length > 0) {
      // If this is a sub-folder level, then prefix with ### for a 3rd level heading,
      // otherwise leave blank, as a suitable header gets added elsewhere.
      outputArray.push(`${notes.length} notes`)
      // iterate over this folder's notes
      for (const note of notes) {
        const relativeTimeSinceUpdate = relativeDateFromNumber(daysBetween(new Date(), note.changedDate))
        // TODO:have option about use of createdDate
        // TODO: have option about sort order
        const createdDateTime = toISOShortDateTimeString(note.changedDate)
        outputArray.push(`${returnNoteLink(note.title ?? 'error')}\t${createdDateTime}\t${relativeTimeSinceUpdate}`)
      }
      outputArray.push('')
    } else {
      outputArray.push('(No notes found)')
    }
    subFolder = true
  }

  return outputArray
}

/**
 * Command to index folders, creating list of notes
 * Options:
 * 1. This folder only (insert into current note)
 * 2. This folder only (add/update to _index note)
 * 3. This folder + subfolders (add/update into single _index note)
 * 4. TODO: This folder + subfolders (add/update into _index notes in each subfolder)
 * @author @jgclark
 */
export async function indexFolders(): Promise<void> {
  // To start with just operate on current note's folder
  const fullFilename = Editor.filename ?? undefined
  let thisFolder: string
  let outputArray: Array<string> = []

  if (fullFilename === undefined) {
    logInfo(pluginJson, `  Info: No current filename (and therefore folder) found, so will ask instead.`)
    thisFolder = await chooseFolder(`Please pick folder to index`)
  } else {
    thisFolder = getFolderFromFilename(fullFilename)
  }
  logDebug(pluginJson, `\nindexFolders from folder ${thisFolder}`)

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

  // logDebug(pluginJson, `  option: ${option}`)
  if (option.startsWith('one')) {
    outputArray = makeFolderIndex(thisFolder, false)
  } else if (option.startsWith('all')) {
    outputArray = makeFolderIndex(thisFolder, true)
  }
  const outString = outputArray.join('\n')

  if (option.endsWith('index')) {
    // write out to index file(s)
    let outputFilename = `${thisFolder}/_index.${DataStore.defaultFileExtension}`
    // see if we already have an _index file in this folder
    let outputNote = DataStore.projectNoteByFilename(outputFilename)

    if (outputNote == null) {
      // make a new note for this
      outputFilename = await DataStore.newNote('_index', thisFolder)
      logDebug(pluginJson, `\tnewNote filename: ${String(outputFilename)}`)
      // outputFilename = `${pref_folderToStore}/${String(outputFilename)}` ?? '(error)'
      // NB: filename here = folder + filename
      if (outputFilename == null) {
        return
      }
      outputNote = await DataStore.projectNoteByFilename(outputFilename)
      logInfo(pluginJson, `writing results to the new note '${outputFilename}'`)
    }

    if (outputNote != null) {
      outputNote.content = `# ${outString}` // overwrite what was there before
    } else {
      logError(pluginJson, 'error after newNote(): no valid note to write to')
      return
    }
  } else if (option.endsWith('current')) {
    // write out to the current file
    Editor.insertTextAtCursor(`${outString}`)
  } else {
    // write out to the log
    // TODO: add more detail to output?
    logDebug(pluginJson, outString)
  }

  logDebug(pluginJson, `Finished indexFolders.`)
}
