// @flow

import { logDebug, logWarn } from '../../../helpers/dev'
import pluginJson from '../../plugin.json'
import { newNotePath } from './newNotePath'

export function renameNote(note: Note): void {
  if (note == null || note.paragraphs.length < 1) {
    // No note open, so don't do anything.
    logDebug(pluginJson, 'rename(): No note open, or no content. Stopping.')
    return
  }
  if (Editor.type === 'Calendar') {
    // Won't work on calendar notes
    logDebug(pluginJson, 'rename(): This is a calendar note, we ignore those. Stopping.')
    return
  }

  const currentFullPath = note.filename
  const newPath = newNotePath(note)

  if (newPath === '') {
    // No title found, so don't do anything.
    logWarn(pluginJson, 'rename(): No title found. Stopping.')
    return
  }

  if (currentFullPath === newPath) {
    // No need to rename
    logWarn(pluginJson, 'rename(): Current path is the same as the new path. Stopping.')
    return
  }

  const newFilename = note.rename(newPath)
  logDebug(pluginJson, `rename(): ${currentFullPath} -> ${newFilename}`)
}
