// @flow
//-----------------------------------------------------------------------------
// Main functions for Tidy plugin
// Jonathan Clark
// Last updated 2025-10-14 for v1.15.1, @jgclark
//-----------------------------------------------------------------------------

import { getSettings, type TidyConfig } from './tidyHelpers'
import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getFolderDisplayName, getFolderListMinusExclusions, getProjectNotesInFolder } from '@helpers/folders'
import { appendStringToSettingArray } from '@helpers/NPSettings'
import { getAllTeamspaceIDsAndTitles } from '@helpers/NPTeamspace'
import { chooseOption, chooseHeading, chooseDecoratedOption, createFolderOptions, getInputTrimmed, showMessage, showMessageYesNo } from '@helpers/userInput'

/**
 * For each root-level note, asks user which folder to move it to. (There's a setting for ones to ignore.)
 * @author @jgclark
 */
export async function fileRootNotes(): Promise<void> {
  try {
    // Get plugin settings (config)
    let config: TidyConfig = await getSettings()

    // Get all root notes
    const rootNotes = getProjectNotesInFolder('/')
    // logDebug('rootNotes', rootNotes.map((n) => n.title))
    const teamspaceDefs = getAllTeamspaceIDsAndTitles()

    // Remove any listed in config.rootNotesToIgnore (by title)
    const excludedNotes = config.rootNotesToIgnore ?? []
    logDebug('excludedNotes', String(excludedNotes))
    const rootNotesToUse = rootNotes.filter((n) => !excludedNotes.includes(n.title))
    logDebug('rootNotesToUse', rootNotesToUse.map((n) => n.title))

    // Get list of all folders (other than @specials and root!)
    const allRelevantFolders = getFolderListMinusExclusions(['/'], true, false)
    logDebug('allRelevantFolders', String(allRelevantFolders))

    // Form options to present to user for each root note.
    // Form both simple and decorated options, ready for both versions of CommandBar.showOptions()
    const [simpleFolderOptions, decoratedFolderOptions] = createFolderOptions(allRelevantFolders, teamspaceDefs, true)
    if (NotePlan.environment.buildVersion >= 1413) {
      // Prepend some special items
      decoratedFolderOptions.unshift({icon: 'folder-plus', text: `Move to a new folder`, color: 'orange-500', shortDescription: 'Add new', alpha: 0.8, darkAlpha: 0.8})
      decoratedFolderOptions.unshift({icon: 'trash-can', text: `Delete this note`, color: 'red-500', shortDescription: 'Delete', alpha: 0.8, darkAlpha: 0.8})
      decoratedFolderOptions.unshift({icon: 'ban', text: `Stop processing root-level notes`, color: 'gray-500', shortDescription: 'Stop', alpha: 0.8, darkAlpha: 0.8})
      decoratedFolderOptions.unshift({icon: 'circle-stop', text: `Ignore this note from now on`, color: 'gray-500', shortDescription: 'Ignore', alpha: 0.8, darkAlpha: 0.8})
      decoratedFolderOptions.unshift({icon: 'hand', text: `Leave this note in root`, color: 'gray-500', shortDescription: 'Leave', alpha: 0.8, darkAlpha: 0.8})
      // clo(decoratedFolderOptions, 'decoratedFolderOptions')
    } else {
      // Prepend some special items
      simpleFolderOptions.unshift({label: `🆕 Move to a new folder`, value: `🆕 Move to a new folder`})
      simpleFolderOptions.unshift({label:`🗑️ Delete this note`, value: `🗑️ Delete this note`})
      simpleFolderOptions.unshift({label: `❌ Stop processing`, value: `❌ Stop processing`})
      simpleFolderOptions.unshift({label: `➡️ Ignore this note from now on`, value: `➡️ Ignore this note from now on`})
      simpleFolderOptions.unshift({label: `◎ Leave this note in root`, value: `◎ Leave this note in root`})
      // logDebug('simpleFolderOptions', String(simpleFolderOptions))
    }

    // Keep a note of currently open note in Editor
    const openEditorNote = Editor?.note

    // Loop over the rest, asking where to move to
    let numMoved = 0
    for (const n of rootNotesToUse) {
      if (!n) {
        logWarn('fileRootNotes', `No note found for some reason`)
        continue
      }

      const thisTitle = (n.title && n.title !== '') ? n.title : 'Untitled' // to pacify flow
      const thisFilename = n.filename // to pacify flow
      // open the note we're going to move in the Editor to help user assess what to do
      const res = await Editor.openNoteByFilename(thisFilename)

      // Ask user which folder to move to. Use newer CommandBar.showOptions() from v3.18 if available.
      let chosenOption: string = ''
      if (NotePlan.environment.buildVersion >= 1413) {
        const chosenDecoratedOption = await chooseDecoratedOption(`Move '${thisTitle}' to which folder?`, decoratedFolderOptions)
        chosenOption = chosenDecoratedOption.value
      } else {
        chosenOption = await chooseOption(`Move '${thisTitle}' to which folder?`, simpleFolderOptions)
      }
      // clo(chosenOption, 'chosenOption')

      if (chosenOption.includes('Stop processing')) {
        logInfo('fileRootNotes', `User cancelled operation.`)
        return
      } else if (chosenOption.includes('Ignore this note from now on')) {
        if (thisTitle === '<untitled note>' || thisTitle === '') {
          logWarn('fileRootNotes', `Can't an untitled note to the plugin setting "rootNotesToIgnore"`)
        } else {
          const ignoreRes = appendStringToSettingArray(pluginJson['plugin.id'], "rootNotesToIgnore", thisTitle, false)
          if (ignoreRes) {
            logInfo('fileRootNotes', `Ignoring '${thisTitle}' from now on; this note has been appended it to the plugin's settings`)
          } else {
            logError('fileRootNotes', `Error when trying to add '${thisTitle}' to the plugin setting "rootNotesToIgnore"`)
          }
        }
      } else if (chosenOption.includes('Leave this note in root')) {
        logDebug('fileRootNotes', `Leaving '${thisTitle}' note in root`)
      } else if (chosenOption.includes('Delete this note')) {
        logInfo('fileRootNotes', `User has asked for '${thisTitle}' note (filename '${thisFilename}') to be deleted ...`)
        const res = DataStore.moveNote(n.filename, '@Trash')
        if (res && res !== '') {
          logDebug('fileRootNotes', '... done')
          numMoved++
        } else {
          logError('fileRootNotes', `Couldn't delete it for some reason`)
        }
      } else if (chosenOption.includes('Move to a new folder')) {
        logDebug('fileRootNotes', `Moving '${thisTitle}' note to a 🆕 folder`)
        const newFolder = await getInputTrimmed(`Name of new folder to create?`)
        if (!newFolder || typeof newFolder !== 'string') {
          logWarn('fileRootNotes', `User cancelled operation.`)
          return
        }
        if (newFolder === '') {
          logError('fileRootNotes', `No new folder given.`)
        }
        logDebug('fileRootNotes', `Creating new folder '${newFolder}' ...`)
        const res: boolean = DataStore.createFolder(newFolder)
        if (!res) {
          logError('fileRootNotes', `Couldn't create new folder ' ${newFolder}' for some reason`)
        }
        const res2 = DataStore.moveNote(n.filename, newFolder)
        if (res2 && res2 !== '') {
          logDebug('fileRootNotes', `... filename now '${res2}'`)
          numMoved++
        } else {
          logError('fileRootNotes', `... Failed to move it to folder ${newFolder} for some reason. Does this folder name already exist?`)
        } 
        
      } else {
        // Default: move to the chosen folder = option
        const chosenFolder = chosenOption
        logDebug('fileRootNotes', `Moving '${thisTitle}' note (filename '${thisFilename}') to folder '${chosenFolder}' ...`)
        const res = DataStore.moveNote(n.filename, chosenFolder)
        if (res && res !== '') {
          logDebug('fileRootNotes', `... filename now '${res}'`)
          numMoved++
        } else {
          logError('fileRootNotes', `... Failed to move it to folder ${chosenFolder} for some reason`)
        }
      }
    }

    // Show a completion message
    logDebug('fileRootNotes', `${String(numMoved)} notes moved from the root folder`)
    const res = await showMessage(`${String(numMoved)} notes moved from the root folder`, 'OK', 'File root-level notes', false)

    // Restore original note (if it was open)
    if (openEditorNote) {
      Editor.openNoteByFilename(openEditorNote.filename)
    }
  } catch (err) {
    logError('fileRootNotes', JSP(err))
    return // for completeness
  }
}
