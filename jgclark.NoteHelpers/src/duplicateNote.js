// @flow
//-----------------------------------------------------------------------------
// Duplicate note with options from current Editor
// Last updated 2025-12-24 for v1.3.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { findEndOfActivePartOfNote, findStartOfActivePartOfNote } from '@helpers/paragraph'
import { chooseFolder, getInputTrimmed, chooseOption } from '@helpers/userInput'

//----------------------------------------------------------------------------
// Local helper functions

/**
 * Generate a candidate title for a duplicate note based on the original title.
 * Increments year/quarter/half-year patterns if found, otherwise appends "copy".
 * @param {string} originalTitle - The title of the original note
 * @returns {string} - The candidate title for the duplicate
 * @author @jgclark
 */
export function generateCandidateTitleForDuplicate(originalTitle: string): string {
  // Work out a candidate title for the new note, based on the current note's title as the default, but first:
  // - if it contains year (as \d{4}) then increment it
  // - if it contains half-year (as \d{4}H[12]) then increment it
  // - if it contains quarter (as \d{4}Q[1234]) then increment it
  // - else append "copy"
  let candidateTitle = originalTitle ?? ''

  // Check for quarter pattern first (YYYYQ[1234]) - highest priority
  const quarterMatch = candidateTitle.match(/(\d{4})Q([1234])/)
  if (quarterMatch) {
    const year = parseInt(quarterMatch[1])
    const quarter = parseInt(quarterMatch[2])
    if (quarter === 4) {
      // Q4 -> next year Q1
      candidateTitle = candidateTitle.replace(/(\d{4})Q4/, `${year + 1}Q1`)
    } else {
      // Q1-Q3 -> increment quarter
      candidateTitle = candidateTitle.replace(/(\d{4})Q([123])/, (_match, y, q) => `${y}Q${parseInt(q) + 1}`)
    }
    return candidateTitle
  }

  // Check for half-year pattern (YYYYH[12]) - second priority
  const halfYearMatch = candidateTitle.match(/(\d{4})H([12])/)
  if (halfYearMatch) {
    const year = parseInt(halfYearMatch[1])
    const halfYear = parseInt(halfYearMatch[2])
    if (halfYear === 1) {
      // H1 -> H2
      candidateTitle = candidateTitle.replace(/(\d{4})H1/, `${year}H2`)
    } else {
      // H2 -> next year H1
      candidateTitle = candidateTitle.replace(/(\d{4})H2/, `${year + 1}H1`)
    }
    return candidateTitle
  }

  // Check for year-only pattern (\d{4}) - lowest priority
  // Match years that are at word boundaries: start of string or preceded by space or some punctuation,
  // and followed by space or end of string or some punctuation
  const yearMatch = candidateTitle.match(/(?:^|\s|[\(\[])(\d{4})(?:\s|$|[\),\],])/)
  if (yearMatch) {
    const year = parseInt(yearMatch[1])
    if (year > 0) {
      // Replace the year while preserving all surrounding context
      candidateTitle = candidateTitle.replace(
        /(?:^|\s|[\(\[])(\d{4})(?=\s|$|[\),\],])/,
        (match, yearStr) => {
          // Preserve the prefix (space, opening paren/bracket, or start of string)
          const prefix = match.slice(0, match.length - yearStr.length)
          return `${prefix}${year + 1}`
        }
      )
      return candidateTitle
    }
  }

  // No date pattern found, append "copy"
  candidateTitle = `${candidateTitle} copy`
  return candidateTitle
}

/**
 * Update the title in a content array for a duplicate note.
 * Updates title in frontmatter if present, and also updates/replaces H1 if present.
 * Adds H1 if it doesn't exist, and if there is no frontmatter title.
 * @param {TNote} existingNote - The original note
 * @param {string} newTitle - The new title to use
 * @param {number} startOfActivePartOfNote - The line index where active content starts
 * @param {number} endOfActivePartOfNote - The line index where active content ends
 * @returns {Array<string>} - The content array with updated title
 * @author @jgclark
 */
export function updateTitleInContentArray(
  existingNote: TNote,
  newTitle: string,
  startOfActivePartOfNote: number,
  endOfActivePartOfNote: number,
): Array<string> {
  // Get the content array for the frontmatter + active part of the note
  // endOfActivePartOfNote is inclusive, so we need +1 for slice (which is exclusive)
  const newContentArray = existingNote.paragraphs.slice(0, endOfActivePartOfNote + 1).map((p) => p.rawContent)

  // Update title in frontmatter if present
  const lineIndexOfTitleinFM = existingNote.paragraphs.findIndex(
    (p) => p.rawContent.startsWith('title:') && p.lineIndex < startOfActivePartOfNote,
  )
  if (lineIndexOfTitleinFM !== -1) {
    newContentArray[lineIndexOfTitleinFM] = `title: ${newTitle}`
    logDebug('updateTitleInContentArray', `Updated title attribute in FM line ${lineIndexOfTitleinFM}: "${newContentArray[lineIndexOfTitleinFM]}"`)
  }

  // Find first H1 title in the content array (could be anywhere, not just at index 0)
  const h1IndexInArray = newContentArray.findIndex((line) => line?.match(/^# (.*)$/))
  if (h1IndexInArray !== -1) {
    newContentArray[h1IndexInArray] = `# ${newTitle}`
    logDebug('updateTitleInContentArray', `Updated H1 line at index ${h1IndexInArray}: ${newContentArray[h1IndexInArray]}`)
  }

  // Prepend H1 if it doesn't exist and there is no frontmatter title
  if (lineIndexOfTitleinFM === -1 && h1IndexInArray === -1) {
    newContentArray.unshift(`# ${newTitle}`)
    logDebug('updateTitleInContentArray', `Prepended H1 line: ${newContentArray[0]}`)
  }

  return newContentArray
}

//----------------------------------------------------------------------------

/**
 * Duplicate the current note.
 * @author @jgclark
 */
export async function duplicateNote(): Promise<void> {
  try {
    const existingNote = Editor.note
    if (!existingNote) {
      throw new Error('No note open; stopping.')
    }
    if (!existingNote.content || existingNote.content.trim().length < 3) {
      throw new Error('Note is empty; stopping.')
    }

    const candidateTitle = generateCandidateTitleForDuplicate(existingNote.title ?? '')

    // Now offer this title to the user for confirmation or modification.
    const title = await getInputTrimmed('Title of duplicate note', 'OK', 'Duplicate Note', candidateTitle)
    if (typeof title !== 'string') {
      throw new Error('The user cancelled the operation.')
    }
    logDebug('duplicateNote', `Will use title '${title}' for the new note.`)

    const currentFolder = await chooseFolder('Select folder to add note in:', false, true) // don't include @Archive as an option, but do allow creation of a new folder

    // Copy the existing paragraphs in the current note, apart from Frontmatter and anything after the first ## Done section
    const startOfActivePartOfNote = findStartOfActivePartOfNote(existingNote)
    const endOfActivePartOfNote = findEndOfActivePartOfNote(existingNote)
    const newContentArray = updateTitleInContentArray(existingNote, title, startOfActivePartOfNote, endOfActivePartOfNote)

    // Create new note in the specific folder
    const filename = (await DataStore.newNoteWithContent(newContentArray.join('\n'), currentFolder)) ?? ''
    logDebug('newNote', ` -> created new note with filename: ${filename}`)

    // Offer the user the option to open the new note in the current Editor, or a new split, or a new window, or to do nothing
    const openOptions = [
      { label: 'Current Editor', value: 'current' },
      { label: 'New Split', value: 'split' },
      { label: 'New Window', value: 'window' },
      { label: 'Do Nothing', value: 'none' },
    ]
    const openOption = await chooseOption('New Note created. Open it now?', openOptions, 'current')
    if (openOption === 'current') {
      await Editor.openNoteByFilename(filename)
    } else if (openOption === 'split') {
      await Editor.openNoteByFilename(filename, false, 0, 0, true)
    } else if (openOption === 'window') {
      await Editor.openNoteByFilename(filename, true)
    } else if (openOption === 'none') {
      return
    }
  } catch (err) {
    logError(pluginJson, `duplicateNote: ${err}`)
  }
}
