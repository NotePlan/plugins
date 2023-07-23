// @flow

import { logWarn } from '../../../helpers/dev'
import pluginJson from '../../plugin.json'

export function newNotePath(note: Note): string {
  const { defaultFileExtension } = DataStore

  const title = note.title ?? ''
  if (title !== '') {
    const currentFullPath = note.filename
    const pathWithoutTitle = currentFullPath.split('/').slice(0, -1).join('/')
    const newName = [pathWithoutTitle, `${title}.${defaultFileExtension}`].filter(Boolean).join('/')

    return newName
  } else {
    logWarn(pluginJson, 'newName(): No title found in note ${note.filename}. Returning empty string.')
    return ''
  }
}
