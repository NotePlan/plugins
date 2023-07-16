// @flow
//-----------------------------------------------------------------------------
// Functions to identify and fix where note names and their filenames are inconsistent.
// Leo ?, readied for the plugin by Jonathan Clark
// Last updated 16.7.2023 for v0.18.0 by @jgclark
//-----------------------------------------------------------------------------
// TODO:
// - put up warning first, then offer to batch rename or rename interactively
// - do interactive renaming
// - add a 'foldersToIgnore' option.

import pluginJson from '../plugin.json'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { allNotesSortedByChanged } from '@helpers/note'
// import { chooseFolder, chooseHeading, chooseOption, getInput, showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------
// Settings

const pluginID = 'jgclark.NoteHelpers'

/**
 * Return list of notes with inconsistent titles and filenames
 * @returns {Array<TNote>} notes
 */
export function listInconsistentNames(): Array<TNote> {
  try {
    logInfo(pluginJson, "listInconsistentNames(): Checking for inconsistent names in project notes...")

    const inconsistentNames = findInconsistentNames()

    if (inconsistentNames.length > 0) {
      logInfo(pluginJson, `listInconsistentNames(): Found ${inconsistentNames.length} inconsistent names in project notes:`)

      inconsistentNames.forEach((note) => {
        const currentFullPath = note.filename
        const newPath = newName(note)
        logInfo(pluginJson, `listInconsistentNames(): ${currentFullPath} -> ${newPath}`)
      })
    }
    return inconsistentNames
  } catch (error) {
    logError(pluginJson, `listInconsistentNames() error: ${error.message}`)
    return [] // for completeness
  }
}

export function renameInconsistentNames(): void {
  try {
    const inconsistentNames = findInconsistentNames()
    if (!Array.isArray(inconsistentNames) || inconsistentNames.length < 1) {
      logDebug(pluginJson, "renameInconsistentNames(): No inconsistent names found. Stopping.")
      return
    }
    inconsistentNames.forEach(rename)
  } catch (error) {
    logError(pluginJson, `renameInconsistentNames() error: ${error.message}`)
  }
}

export function titleToFilename(): void {
  try {
    const { note } = Editor
    rename(note)
  } catch (error) {
    logError(pluginJson, `titleToFilename() error: ${error.message}`)
  }
}

/*******************************************************************************
 * Helper functions
 ******************************************************************************/

function findInconsistentNames(): Array<TNote> {
  const { projectNotes } = DataStore

  return projectNotes
    .filter((note) => {
      const currentFullPath = note.filename
      if (currentFullPath.substring(0, 1) === "@") {
        // Ignore Notes in reserved folders
        return false
      }
      const newPath = newName(note)

      return currentFullPath !== newPath
    })
    .sort()
}

function newName(note): string {
  const { defaultFileExtension } = DataStore

  const title = note.paragraphs[0]?.content ?? ''
  if (title !== '') {
    const currentFullPath = note.filename
    const pathWithoutTitle = currentFullPath.split("/").slice(0, -1).join("/")
    const newName = [pathWithoutTitle, `${title}.${defaultFileExtension}`].filter(Boolean).join("/")

    return newName
  } else {
    logWarn(pluginJson, 'newName(): No title found in note ${note.filename}. Returning empty string.')
    return ''
  }
}

function rename(note): void {
  if (note == null || note.paragraphs.length < 1) {
    // No note open, so don't do anything.
    logDebug(pluginJson, "rename(): No note open, or no content. Stopping.")
    return
  }
  if (Editor.type === "Calendar") {
    // Won't work on calendar notes
    logDebug(pluginJson, "rename(): This is a calendar note, we ignore those. Stopping.")
    return
  }

  const currentFullPath = note.filename
  const newPath = newName(note)

  if (newPath === '') {
    // No title found, so don't do anything.
    logWarn(pluginJson, "rename(): No title found. Stopping.")
    return
  }

  if (currentFullPath === newPath) {
    // No need to rename
    logWarn(pluginJson, "rename(): Current path is the same as the new path. Stopping.")
    return
  }

  const newFilename = note.rename(newPath)
  logDebug(pluginJson, `rename(): ${currentFullPath} -> ${newFilename}`)
}
