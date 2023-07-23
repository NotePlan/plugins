// @flow

import { logDebug } from '../../../helpers/dev'
import pluginJson from '../../plugin.json'
import { newNotePath } from './newNotePath'

export function findInconsistentNames(directory?: string = ''): Array<TNote> {
  const { projectNotes } = DataStore

  return projectNotes
    .filter((note) => {
      const currentFullPath = note.filename
      if (currentFullPath.substring(0, 1) === '@') {
        // Ignore Notes in reserved folders
        return false
      }

      // If a directory is specified, only check notes in that directory, ignored if '/' is specified
      if (directory.length > 0 && directory !== '/') {
        // Only check notes in the specified directory
        if (currentFullPath.indexOf(directory) !== 0) {
          logDebug(pluginJson, `findInconsistentNames(): Ignoring note ${currentFullPath} as not in specified directory ${directory}`)
          return false
        }
      }

      const newPath = newNotePath(note)

      return currentFullPath !== newPath
    })
    .sort()
}
