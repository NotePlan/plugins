// @flow
//-------------------------------------------------------------------------------
// Note-level Functions that require NP API calls

import { log, logError, timer } from './dev'
import { displayTitle } from './general'
import { showMessage } from './userInput'
import { checkNoteForPlusDates } from './note'
import { findStartOfActivePartOfNote } from './paragraph'
/**
 * Convert the note to using frontmatter Syntax
 * If optional default text is given, this is added to the frontmatter.
 * @author @jgclark
 * @param {TNote} note
 * @param {string} defaultText (optional) to add after title in the frontmatter
 */
export async function convertNoteToFrontmatter(note: TNote, defaultText?: string = ''): Promise<void> {
  if (note == null) {
    logError('note/convertToFrontmatter', `No note found. Stopping conversion.`)
    await showMessage(`No note found to convert.`)
    return
  }
  if (note.paragraphs.length < 1) {
    logError('note/convertToFrontmatter', `'${displayTitle(note)}' is empty. Stopping conversion.`)
    await showMessage(`Cannot convert '${displayTitle(note)}' note as it is empty.`)
    return
  }

  // Get title
  const firstLine = note.paragraphs[0]
  if (firstLine.content === '---') {
    logError('note/convertToFrontmatter', `'${displayTitle(note)}' appears to already use frontmatter. Stopping conversion.`)
    await showMessage(`Cannot convert '${displayTitle(note)}' as it already appears to use frontmatter.`)
    return
  }
  const title = firstLine.content ?? '(error)' // gets heading without markdown

  // Working backwards through the frontmatter (to make index addressing easier)
  // Change the current first line to be ---
  firstLine.content = '---'
  firstLine.type = 'separator'
  note.updateParagraph(firstLine)
  if (defaultText) {
    note.insertParagraph(defaultText, 0, 'text')
  }
  note.insertParagraph(`title: ${title}`, 0, 'text')
  note.insertParagraph('---', 0, 'separator')
  log('note/convertToFrontmatter', `Note '${displayTitle(note)}' converted to use frontmatter.`)
}

/**
 * Search the DataStore looking for notes with >date+ tags which need to be converted to >today tags going forward
 * If plusTags are found (today or later), then convert them to >today tags
 * @param {TNote} note
 * @param {boolean} openTasksOnly - if true, only find/convert notes with >date+ tags that are open tasks
 * @param {Array<string>} foldersToIgnore (e.g. tests/templates)
 * @author @dwertheimer
 */
export function findAndUpdateDatePlusTags(openOnly: boolean = true, foldersToIgnore: ?Array<string> = []): void {
  const start = new Date()
  let notesWithDates = [...DataStore.projectNotes, ...DataStore.calendarNotes].filter((n) => n?.datedTodos?.length > 0)
  if (foldersToIgnore) {
    notesWithDates = notesWithDates.filter((note) => foldersToIgnore.every((skipFolder) => !note.filename.includes(`${skipFolder}/`)))
  }
  log(`NPNote::findAndUpdateDatePlusTags`, `total notesWithDates: ${notesWithDates.length}`)
  let updatedParas = []
  notesWithDates.forEach((note) => {
    if (note) {
      const updates = checkNoteForPlusDates(note, openOnly)
      if (updates.length > 0) {
        updatedParas = updatedParas.concat(updates)
        note?.updateParagraphs(updatedParas)
        log(`NPNote::findAndUpdateDatePlusTags`, `Updated ${updates.length} todos in note "${note.filename || ''}" ("${note.title || ''}")`)
      }
    }
  })
  log(`NPNote::findAndUpdateDatePlusTags`, `Total checkNoteForPlusDates scan took: ${timer(start)}`)
}

/**
 * Select the first non-title line in Editor
 * NotePlan will always show you the ## before a title if your cursor is on a title line, but
 * this is ugly. And so in this function we find and select the first non-title line
 * @author @dwertheimer
 * @returns
 */
export function selectFirstNonTitleLineInEditor(): void {
  if (Editor.content && Editor.note) {
    for (let i = findStartOfActivePartOfNote(Editor.note); i < Editor.paragraphs.length; i++) {
      const line = Editor.paragraphs[i]
      if (line.type !== 'title' && line?.contentRange && line.contentRange.start >= 0) {
        Editor.select(line.contentRange.start, 0)
        return
      }
    }
  }
}
