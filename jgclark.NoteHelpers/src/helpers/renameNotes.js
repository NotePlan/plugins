// @flow

import pluginJson from '../../plugin.json'
import { newNotePath } from './newNotePath'
import { logDebug, logWarn } from '@helpers/dev'
import { showMessage, showMessageYesNo, showMessageYesNoCancel } from '@helpers/userInput'

export async function renameNoteToTitle(note: Note, shouldPromptBeforeRenaming: boolean = true): Promise<boolean> {
  if (note == null || note.paragraphs.length < 1) {
    // No note open, so don't do anything.
    logDebug(pluginJson, 'No note open, or no content. Stopping.')
    return
  }
  if (note.type === 'Calendar') {
    // Won't work on calendar notes
    await showMessage('This command does not support renaming calendar notes.')
    return
  }

  const currentFullPath = note.filename
  const newPath = newNotePath(note)
  const title = note.paragraphs[0]?.content ?? ''

  if (newPath === '') {
    // No title found, so don't do anything.
    logWarn(pluginJson, 'renameNoteToTitle(): No title found. Stopping.')
    return
  }

  if (currentFullPath === newPath) {
    // No need to rename
    logDebug(pluginJson, 'renameNoteToTitle(): Current path is the same as the new path. Stopping.')
    await showMessage('The note name is already consistent with its filename.')
    return
  }

  if (!shouldPromptBeforeRenaming) {
    const newFilename = note.rename(newPath)
    logDebug(pluginJson, `renameNoteToTitle(): ${currentFullPath} -> ${newFilename}`)
    return
  }

  const promptResponse = await showMessageYesNoCancel(`
  Would you like to rename the note ${title} to match its filename?

  Current path: ${currentFullPath}
  New path: ${newPath}
  `)

  if (promptResponse === 'Cancel') {
    logDebug(pluginJson, `renameNoteToTitle(): User cancelled`)
    return false
  }
  else if (promptResponse === 'Yes') {
    const newFilename = note.rename(newPath)
    logDebug(pluginJson, `renameNoteToTitle(): ${currentFullPath} -> ${newFilename}`)
    await showMessage(`Renamed note ${title} to ${newFilename}.`)
  } else {
    logDebug(pluginJson, 'renameNoteToTitle(): User chose not to rename.')
  }
  return true
}
