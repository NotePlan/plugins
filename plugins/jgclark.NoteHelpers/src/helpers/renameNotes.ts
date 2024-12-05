// @flow
// --------------------------------------------------------------
// Originally by Leo Melo, with bug fixes by @jgclark
// Last updated 2024-08-16 for v0.19.3 by @jgclark
// --------------------------------------------------------------

import pluginJson from '../../plugin.json'
import { newFilepathForNote } from './newNotePath'
import { logDebug, logWarn } from '@np/helpers/dev'
import { showMessage, showMessageYesNoCancel } from '@np/helpers/userInput'

export async function renameNoteToTitle(note: Note, shouldPromptBeforeRenaming: boolean = true): Promise<boolean> {
  if (note == null || note.paragraphs.length < 1) {
    // No note open, so don't do anything.
    logDebug(pluginJson, 'No note open, or no content. Stopping.')
    return false
  }
  if (note.type === 'Calendar') {
    // Won't work on calendar notes
    await showMessage('This command does not support renaming calendar notes.')
    return false
  }

  const title = note.title
  const currentFilepath = note.filename
  const newFilepath = newFilepathForNote(note)

  if (newFilepath === '' || title === '') {
    // No title found, so don't do anything.
    logWarn(pluginJson, 'renameNoteToTitle(): No title found. Stopping.')
    return false
  }

  if (currentFilepath === newFilepath) {
    // No need to rename
    logDebug(pluginJson, 'renameNoteToTitle(): Current path is the same as the new path. Stopping.')
    await showMessage('The filename is already consistent with the note name.')
    return false
  }

  if (!isValidFilename(newFilepath)) {
    logWarn(pluginJson, `renameNoteToTitle(): Invalid filename "${newFilepath}". Stopping.`)
    await showMessage(`The filename "${newFilepath}" is not valid. Please check the title and try again.`)
    return false
  }

  if (!shouldPromptBeforeRenaming) {
    const newFilename = note.rename(newFilepath)
    logDebug(pluginJson, `renameNoteToTitle(): ${currentFilepath} -> ${newFilename}`)
    return true
  }

  const currentFilename = currentFilepath.split('/').pop()
  // @ts-ignore
  const promptResponse = await showMessageYesNoCancel(`Would you like to rename "${currentFilename}" to match the note title "${title}"?

  Current path: ${currentFilepath}

  New path: ${newFilepath}
  `)

  if (promptResponse === 'Cancel') {
    logDebug(pluginJson, `renameNoteToTitle(): User cancelled`)
    return false
  } else if (promptResponse === 'Yes') {
    const newFilename = note.rename(newFilepath)
    logDebug(pluginJson, `renameNoteToTitle(): ${currentFilepath} -> ${newFilename}`)
    // @ts-ignore
    await showMessage(`Renamed note ${title} to ${newFilename}.`)
  } else {
    logDebug(pluginJson, 'renameNoteToTitle(): User chose not to rename.')
  }
  return true
}

function isValidFilename(path: string): boolean {
  // Check for invalid characters in filename
  const invalidChars = /[<>:"/\\|?*]/g
  if (path.split('/').pop().match(invalidChars)) {
    return false
  }
  return true
}
