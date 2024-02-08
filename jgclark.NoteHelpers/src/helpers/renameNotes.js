// @flow

import pluginJson from '../../plugin.json'
import { newNotePath } from './newNotePath'
import { logDebug, logWarn } from '@helpers/dev'
import { showMessage, showMessageYesNoCancel } from '@helpers/userInput'

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

  const currentFullPath = note.filename
  const newPath = newNotePath(note)
  const title = note.paragraphs[0]?.content ?? ''

  if (newPath === '') {
    // No title found, so don't do anything.
    logWarn(pluginJson, 'renameNoteToTitle(): No title found. Stopping.')
    return false
  }

  if (currentFullPath === newPath) {
    // No need to rename
    logDebug(pluginJson, 'renameNoteToTitle(): Current path is the same as the new path. Stopping.')
    await showMessage('The filename is already consistent with the note name.')
    return false
  }

  if (!shouldPromptBeforeRenaming) {
    const newFilename = note.rename(newPath)
    logDebug(pluginJson, `renameNoteToTitle(): ${currentFullPath} -> ${newFilename}`)
    return true
  }

  const currentFilename = currentFullPath.split('/').pop()
  const promptResponse = await showMessageYesNoCancel(`
  Would you like to rename "${currentFilename}" to match the note title "${title}"?

  Current path: ${currentFullPath}

  New path: ${newPath}
  `)

  if (promptResponse === 'Cancel') {
    logDebug(pluginJson, `renameNoteToTitle(): User cancelled`)
    return false
  } else if (promptResponse === 'Yes') {
    const newFilename = note.rename(newPath)
    logDebug(pluginJson, `renameNoteToTitle(): ${currentFullPath} -> ${newFilename}`)
    await showMessage(`Renamed note ${title} to ${newFilename}.`)
  } else {
    logDebug(pluginJson, 'renameNoteToTitle(): User chose not to rename.')
  }
  return true
}
