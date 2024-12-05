// @flow

import pluginJson from '../../plugin.json'
import { logDebug, logWarn } from '@np/helpers/dev'
import { showMessage, showMessageYesNoCancel } from '@np/helpers/userInput'

export async function makeNoteTitleMatchFilename(note: Note, shouldPromptBeforeRenaming: boolean = true): Promise<boolean> {
  const { defaultFileExtension } = DataStore
  if (note == null || note.paragraphs.length < 1) {
    // No note open, so don't do anything.
    logDebug(pluginJson, 'No note open, or no content. Stopping.')
    return false
  }
  if (note.type === 'Calendar') {
    // Won't work on calendar notes
    await showMessage('Sorry: calendar notes cannot be renamed.')
    return false
  }

  const currentTitle = note.paragraphs[0]?.content ?? ''

  const currentFullPath = note.filename
  const currentFilename = currentFullPath.split('/').pop()
  const newTitle = currentFilename.replace(`.${defaultFileExtension}`, '')

  if (newTitle === currentTitle) {
    // No need to rename
    logDebug(pluginJson, 'makeNoteTitleMatchFilename(): Current title is the same as the filename. Stopping.')
    await showMessage('The note title is already consistent with the filename.')
    return false
  }

  if (!shouldPromptBeforeRenaming) {
    note.removeParagraphAtIndex(0)
    note.insertHeading(newTitle, 0, 1)
    logDebug(pluginJson, `makeNoteTitleMatchFilename(): ${currentTitle} -> ${newTitle}`)
    return true
  }

  const promptResponse = await showMessageYesNoCancel(`
  Would you like to change the note title "${currentTitle}" to match the filename "${newTitle}"?
  `)

  if (promptResponse === 'Cancel') {
    logDebug(pluginJson, `makeNoteTitleMatchFilename(): User cancelled`)
    return false
  } else if (promptResponse === 'Yes') {
    note.removeParagraphAtIndex(0)
    note.insertHeading(newTitle, 0, 1)
    logDebug(pluginJson, `makeNoteTitleMatchFilename(): ${currentTitle} -> ${newTitle}`)
    await showMessage(`Changed note title from ${currentTitle} to ${newTitle}.`)
  } else {
    logDebug(pluginJson, 'makeNoteTitleMatchFilename(): User chose not to rename.')
  }
  return true
}
