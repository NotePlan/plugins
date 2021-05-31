// @flow

import { filenameDateString } from './dateHelpers'
import sweepProjectNote from './sweepProjectNote'
import sweepCalendarNote from './sweepCalendarNote'

export default async function sweepFile(): Promise<void> {
  const type = Editor.type
  const note = Editor.note

  if (note == null) {
    return
  }

  if (type === 'Calendar') {
    const todayNoteFileName =
      filenameDateString(new Date()) + '.' + DataStore.defaultFileExtension
    if (Editor.filename == todayNoteFileName) {
      await CommandBar.showInput('Open a different note than today', 'OK')
      return
    }
    return await sweepCalendarNote(note)
  } else {
    return await sweepProjectNote(note)
  }
}
