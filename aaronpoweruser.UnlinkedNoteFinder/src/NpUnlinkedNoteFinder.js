// @flow
import pluginJson from '../plugin.json'
import { log, logDebug, logError, logWarn, clo, JSP } from '@helpers/dev'

/**
 * Find all note titles in the current note and replace them with [[note title]]
 */
export function findUnlinkedNotesInCurrentNote() {
  try {
    const currentNote = Editor.note
    if (currentNote) {
      findUnlinkedNotesInNote(currentNote)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Find all note titles in all notes and replace them with [[note title]]
 */
export async function findUnlinkedNotesInAllNotes() {
  try {
    await CommandBar.onAsyncThread()
    CommandBar.showLoading(true, 'Finding unlinked notes')
    const allNotes = DataStore.projectNotes.concat(DataStore.calendarNotes)
    allNotes.forEach((note) => findUnlinkedNotesInNote(note))
    CommandBar.showLoading(false)
    CommandBar.onMainThread()
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Get all note titles in the project notes sorted by length
 * @returns {Array<string>} - an array of all note titles
 */
function getAllNoteTitlesSortedByLength(): Array<string> {
  return DataStore.projectNotes
    .filter((note) => note.title !== undefined && note.title !== '')
    .map((note) => note.title)
    .sort((a, b) => b.length - a.length) // sort by length to replace longer titles first
}

/**
 * Find all note titles in the current note and replace them with [[note title]]
 * @param {TNote} currentNote - the note to search for links in
 *
 * Todo: Ignore urls and other non-note links
 * Todo: Ignore links in code blocks
 * Todo: rewrite note content in place optimally
 */
function findUnlinkedNotesInNote(currentNote: TNote) {
  getAllNoteTitlesSortedByLength().forEach((note) => {
    if (note && currentNote.title !== note && currentNote.content?.includes(note)) {
      logDebug(`In note: ${currentNote.title} found link to: ${note}`)
      if (!currentNote.content?.includes(`[[${note}]]`)) {
        currentNote.content = currentNote.content?.replaceAll(note, `[[${note}]]`)
      } else {
        logDebug(`${currentNote.title} already contains link to: ${note}`)
      }
    }
  })
}
