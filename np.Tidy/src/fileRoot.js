// @flow
//-----------------------------------------------------------------------------
// Main functions for Tidy plugin
// Jonathan Clark
// Last updated 20.6.2023+ for v0.8.1, @jgclark
//-----------------------------------------------------------------------------

import { getSettings, type TidyConfig } from './tidyHelpers'
import pluginJson from '../plugin.json'
import { JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getFilteredFolderList } from '@helpers/folders'
import { getProjectNotesInFolder } from '@helpers/note'
import { appendStringToSettingArray } from '@helpers/NPSettings'
import { chooseOption, chooseHeading, getInputTrimmed, showMessage, showMessageYesNo } from '@helpers/userInput'

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

    // Make list of all folders (other than root!)
    const allFolders = getFilteredFolderList([], true, [], false)
    logDebug('allFolders', String(allFolders))

    // Pre-pend some special items
    allFolders.unshift(`🗑️ Delete this note`)
    allFolders.unshift(`❌ Stop processing`)
    if (NotePlan.environment.buildVersion >= 1045) { allFolders.unshift(`➡️ Ignore this note from now on`) } // what this calls fails before 3.9.2b
    allFolders.unshift(`➡️ Leave this note in root`)
    logDebug('allFolders', String(allFolders))
    const options = allFolders.map((f) => ({
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

        const chosenFolder = await chooseOption(`Move '${thisTitle}' to which folder?`, options)
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
          case '➡️ Leave this note in root': {
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
          default: {
            logDebug('fileRootNotes', `Moving '${thisTitle}' note (filename '${thisFilename}') to folder '${chosenFolder}' ...`)
            const res = DataStore.moveNote(n.filename, chosenFolder)
            if (res && res !== '') {
              logDebug('fileRootNotes', `... filename now '${res}'`)
              numMoved++
            } else {
              logError('fileRootNotes', `... Failed to move it for some reason`)
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
