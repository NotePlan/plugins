// @flow


import pluginJson from '../../plugin.json'
import { logWarn } from '@np/helpers/dev'
import { getFolderFromFilename } from '@np/helpers/folders'
import { displayTitle } from '@np/helpers/general'

/**
 * Takes a Note returns a new path for a note.
 * Now copes with notes that use front matter, and substituting for '/' characters in filename (otherwise treated as a new folder in path)
 * @author @Leo, extended by @jgclark
 * @param {note: TNote} note 
 * @returns {string} filepath
 */
export function newFilepathForNote(note: TNote): string {
  const { defaultFileExtension } = DataStore

  // Get new title for note, though with any '/' or ':' replaced
  const title = displayTitle(note)
    .replace('/', '_')
    .replace(':', '_')
  if (title !== '') {
    const currentFullPath = note.filename
    const pathWithoutTitle = getFolderFromFilename(currentFullPath)
    const newName = [pathWithoutTitle, `${title}.${defaultFileExtension}`].filter(Boolean).join('/')

    return newName
  } else {
    logWarn(pluginJson, `newFilepathForNote(): No title found in note ${note.filename}. Returning empty string.`)
    return ''
  }
}
