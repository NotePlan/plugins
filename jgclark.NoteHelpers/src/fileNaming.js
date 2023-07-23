// @flow
//-----------------------------------------------------------------------------
// Functions to identify and fix where note names and their filenames are inconsistent.
// Leo Melo, readied for the plugin by Jonathan Clark
// Last updated 16.7.2023 for v0.18.0 by @jgclark
//-----------------------------------------------------------------------------
// TODO:
// - put up warning first, then offer to batch rename or rename interactively
// - do interactive renaming
// - add a 'foldersToIgnore' option.

import pluginJson from '../plugin.json'
import { findInconsistentNames } from './lib/findInconsistentNames'
import { renameNote } from './lib/renameNote'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'

// import { chooseFolder, chooseHeading, chooseOption, getInput, showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------
// Settings

export function renameInconsistentNames(): void {
  try {
    const inconsistentNames = findInconsistentNames()
    if (!Array.isArray(inconsistentNames) || inconsistentNames.length < 1) {
      logDebug(pluginJson, 'renameInconsistentNames(): No inconsistent names found. Stopping.')
      return
    }
    inconsistentNames.forEach(renameNote)
  } catch (error) {
    logError(pluginJson, `renameInconsistentNames() error: ${error.message}`)
  }
}

export function titleToFilename(): void {
  try {
    const { note } = Editor
    if (note) {
      renameNote(note)
    }
  } catch (error) {
    logError(pluginJson, `titleToFilename() error: ${error.message}`)
  }
}
