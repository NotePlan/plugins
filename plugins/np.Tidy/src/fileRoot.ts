// @flow
//-----------------------------------------------------------------------------
// Main functions for Tidy plugin
// Jonathan Clark
// Last updated 19.3.2024 for v0.8.1+, @jgclark
//-----------------------------------------------------------------------------

import { getSettings, type TidyConfig } from './tidyHelpers'
import pluginJson from '../plugin.json'
import { JSP, logDebug, logError, logInfo, logWarn } from '@np/helpers/dev'
import { getFolderListMinusExclusions } from '@np/helpers/folders'
import { getProjectNotesInFolder } from '@np/helpers/note'
import { appendStringToSettingArray } from '@np/helpers/NPSettings'
import { chooseOption, chooseHeading, getInputTrimmed, showMessage, showMessageYesNo } from '@np/helpers/userInput'

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

    // Remove any listed in config.rootNotesToIgnore (by title)
    const excludedNotes = config.rootNotesToIgnore ?? []
    logDebug('excludedNotes', String(excludedNotes))
    const rootNotesToUse = rootNotes.filter((n) => !excludedNotes.includes(n.title))
    logDebug('rootNotesToUse', rootNotesToUse.map((n) => n.title))

    // Make list of all folders (other than @specials and root!)
    const allRelevantFolders = getFolderListMinusExclusions(['/'], true, false)
    logDebug('allRelevantFolders', String(allRelevantFolders))

    // Pre-pend some special items
    allRelevantFolders.unshift(`🆕 Move to a new folder`)
    allRelevantFolders.unshift(`🗑️ Delete this note`)
    allRelevantFolders.unshift(`❌ Stop processing`)
    if (NotePlan.environment.buildVersion >= 1045) { allRelevantFolders.unshift(`➡️ Ignore this note from now on`) } // what this calls fails before 3.9.2b
    allRelevantFolders.unshift(`◎ Leave this note in root`)
    logDebug('allRelevantFolders', String(allRelevantFolders))
    const options = allRelevantFolders.map((f) => ({
      label: f,
      value: f,
    }))

    // Keep a note of currently open note in Editor
    const openEditorNote = Editor?.note

    // Loop over the rest, asking where to move to
    let numMoved = 0
    for (const n of rootNotesToUse) {
      if (n && n.filename !== undefined) {
        const thisTitle = (n.title && n.title !== '') ? n.title : 'Untitled' // to pacify flow
        const thisFilename = n.filename // to pacify flow
        // open the note we're going to move in the Editor to help user assess what to do
        const res = await Editor.openNoteByFilename(thisFilename)

        let chosenFolder: string = await chooseOption(`Move '${thisTitle}' to which folder?`, options)
        switch (chosenFolder) {
          case '❌ Stop processing': {
            logInfo('fileRootNotes', `User cancelled operation.`)
            return
          }
          case '➡️ Ignore this note from now on': {
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
            break
          }

          case '◎ Leave this note in root': {
            logDebug('fileRootNotes', `Leaving '${thisTitle}' note in root`)
            break
          }

          case '🗑️ Delete this note': {
            logInfo('fileRootNotes', `User has asked for '${thisTitle}' note (filename '${thisFilename}') to be deleted ...`)
            const res = DataStore.moveNote(n.filename, '@Trash')
            if (res && res !== '') {
              logDebug('fileRootNotes', '... done')
              numMoved++
            } else {
              logError('fileRootNotes', `Couldn't delete it for some reason`)
            }
            break
          }

          case '🆕 Move to a new folder': {
            logDebug('fileRootNotes', `Moving '${thisTitle}' note to a 🆕 folder`)
            const newFolder = await getInputTrimmed(`Name of new folder to create?`)
            if (!newFolder || typeof newFolder === 'boolean') {
              logWarn('fileRootNotes', `User cancelled operation.`)
              break
            }
            if (newFolder === '') {
              logError('fileRootNotes', `No new folder given.`)
              break
            }
            logDebug('fileRootNotes', `Creating new folder '${newFolder}' ...`)
            let res: any = DataStore.createFolder(newFolder)
            if (!res) {
              logError('fileRootNotes', `Couldn't create new folder ' ${newFolder}' for some reason`)
            }
            res = DataStore.moveNote(n.filename, newFolder)
            if (res && res !== '') {
              logDebug('fileRootNotes', `... filename now '${res}'`)
              numMoved++
            } else {
              logError('fileRootNotes', `... Failed to move it to folder ${newFolder} for some reason. Does this folder name already exist?`)
            }
            break
          }

          default: {
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
      } else {
        logError('fileRootNotes', `Failed to get note for some reason`)
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
