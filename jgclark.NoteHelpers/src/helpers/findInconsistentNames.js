// @flow

import pluginJson from '../../plugin.json'
import { newNotePath } from './newNotePath'
import { logDebug } from '@helpers/dev'

export function findInconsistentNames(folder?: string = ''): Array<TNote> {
  const { projectNotes } = DataStore

  // Note: there's a faster way to do this if folder is given ... (which it currently never is)
  return projectNotes
    .filter((note) => {
      const currentFullPath = note.filename
      if (currentFullPath.substring(0, 1) === '@') {
        // Ignore Notes in reserved folders
        return false
      }

      // If a folder is specified, only check notes in that folder, ignored if '/' is specified
      if (folder.length > 0 && folder !== '/') {
        // Only check notes in the specified folder
        if (currentFullPath.indexOf(folder) !== 0) {
          // logDebug(pluginJson, `findInconsistentNames(): Ignoring note ${currentFullPath} as not in specified folder ${folder}`)
          return false
        }
      }

      const newPath = newNotePath(note)

      return currentFullPath !== newPath
    })
    .sort()
}
