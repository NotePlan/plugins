// @flow

import { logDebug, logWarn } from '../../../helpers/dev'
import { showMessage, showMessageYesNo } from '../../../helpers/userInput'

import pluginJson from '../../plugin.json'
import { newNotePath } from './newNotePath'

export async function renameNote(note: Note, shouldPromptBeforeRenaming: boolean = true): Promise<void> {
  if (note == null || note.paragraphs.length < 1) {
    // No note open, so don't do anything.
    logDebug(pluginJson, 'No note open, or no content. Stopping.')
    return
  }
  if (Editor.type === 'Calendar') {
    // Won't work on calendar notes
    showMessage('This command does not support renaming calendar notes.')
    return
  }

  const currentFullPath = note.filename
  const newPath = newNotePath(note)
  const title = note.paragraphs[0]?.content ?? ''

  if (newPath === '') {
    // No title found, so don't do anything.
    logWarn(pluginJson, 'rename(): No title found. Stopping.')
    return
  }

  if (currentFullPath === newPath) {
    // No need to rename
    logDebug(pluginJson, 'rename(): Current path is the same as the new path. Stopping.')
    showMessage('The note name is already consistent with its filename.')
    return
  }

  if (!shouldPromptBeforeRenaming) {
    const newFilename = note.rename(newPath)
    logDebug(pluginJson, `rename(): ${currentFullPath} -> ${newFilename}`)
    return
  }

  const promptResponse = await showMessageYesNo(`
  Would you like to rename the note ${title} to match its filename?
  
  Current path: ${currentFullPath}
  New path: ${newPath}
  `)

  if (promptResponse === 'Yes') {
    const newFilename = note.rename(newPath)
    logDebug(pluginJson, `rename(): ${currentFullPath} -> ${newFilename}`)
    showMessage(`Renamed note ${title} to ${newFilename}.`)
  } else {
    logDebug(pluginJson, 'rename(): User chose not to rename.')
  }
}
