// @flow

import { newNotePath } from './newNotePath'

export function findInconsistentNames(): Array<TNote> {
  const { projectNotes } = DataStore

  return projectNotes
    .filter((note) => {
      const currentFullPath = note.filename
      if (currentFullPath.substring(0, 1) === '@') {
        // Ignore Notes in reserved folders
        return false
      }
      const newPath = newNotePath(note)

      return currentFullPath !== newPath
    })
    .sort()
}
