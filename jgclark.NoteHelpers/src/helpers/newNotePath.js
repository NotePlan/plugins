// @flow


import pluginJson from '../../plugin.json'
import { logWarn } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { displayTitle } from '@helpers/general'

// author @Leo, extended by @jgclark
// now copes with notes that use front matter, and substituting for '/' characters in filename(otherwise treated as a new folder in path)
export function newNotePath(note: Note): string {
  const { defaultFileExtension } = DataStore

  // Get new title for note, though with any '/' replaced
  const title = displayTitle(note)
    .replace('/', '_')
  if (title !== '') {
    const currentFullPath = note.filename
    const pathWithoutTitle = getFolderFromFilename(currentFullPath)
    const newName = [pathWithoutTitle, `${title}.${defaultFileExtension}`].filter(Boolean).join('/')

    return newName
  } else {
    logWarn(pluginJson, `newNotePath(): No title found in note ${note.filename}. Returning empty string.`)
    return ''
  }
}
