// @Flow

import { log, clo, JSP } from './dev'

/**
 * Remove any heading (type=='title') from a note matching the given text
 * @param {TNote} note
 * @param {string} headingStr
 * @param {boolean} search rawText (including #'s etc) default=false
 * @returns {void}
 */
export function removeHeadingFromNote(note: TNote, headingStr: string, rawTextSearch: boolean = false) {
  const prevExists = note.paragraphs.filter((p) => (p.type === 'title' && rawTextSearch ? p.rawContent === headingStr : p.content === headingStr))
  if (prevExists.length) {
    note.removeParagraphs(prevExists)
  }
}
