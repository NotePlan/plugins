// @flow

import { filenameDateString } from '../../helpers/dateTime'
import { default as sweepNote } from './sweepNote'

export default async function sweepFile(): Promise<void> {
  const type = Editor.type
  const note = Editor.note

  if (note == null) {
    return
  }
  console.log(`Starting sweepFile on ${note.filename}`)
  if (type === 'Calendar') {
    const todayNoteFileName = `${filenameDateString(new Date())}.${DataStore.defaultFileExtension}`
    if (Editor.filename === todayNoteFileName) {
      await CommandBar.showInput(`Open a different note for a different day (can't sweep today)`, 'OK')
      return
    }
    await sweepNote(note, true, true, false, false)
  } else {
    await sweepNote(note, true, true, false, true)
  }
  console.log(`Finished sweepFile`)
}
