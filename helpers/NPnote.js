// @flow
//-------------------------------------------------------------------------------
// Note-level Functions that require NP API calls

import { clo, log, logError } from './dev'
import { displayTitle } from './general'

/**
 * Convert the note to using frontmatter Syntax
 * If optional default text is given, this is added to the frontmatter.
 * @author @jgclark
 * @param {TNote} note 
 * @param {string} defaultText (optional) to add after title in the frontmatter
 */
export function convertNoteToFrontmatter(note: TNote, defaultText?: string = ''): void {
  if (note == null || note.paragraphs.length < 1) {
    logError('note/convertToFrontmatter', `No note or empty note found. Stopping`)
    return
  }
  // Get title
  const firstLine = note.paragraphs[0]
  const title = firstLine.content ?? '(error)' // gets heading without markdown

  // Working backwards through the frontmatter (to make index addressing easier)
  // Change the current first line to be-- -
  firstLine.content = '---'
  firstLine.type = 'separator'
  note.updateParagraph(firstLine)
  if (defaultText) {
    note.insertParagraph(defaultText, 0, 'text')
  }
  note.insertParagraph(`title: ${title}`, 0, 'text')
  note.insertParagraph('---', 0, 'separator')
}
