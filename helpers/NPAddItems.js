// @flow
// -----------------------------------------------------------------
// Helpers for adding items to paragraphs/sections/notes.
// -----------------------------------------------------------------

import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import {
  findEndOfActivePartOfNote,
  findHeadingStartsWith,
  findStartOfActivePartOfNote,
  smartCreateSectionsAndPara,
  smartAppendPara,
  smartPrependParas,
} from '@helpers/paragraph'
import { findParaFromRawContentAndFilename, findParaFromStringAndFilename } from '@helpers/NPParagraph'

/**
 * Add a checklist to a (regular or calendar) note and heading that is supplied.
 * Note: limitations:
 * - duplicate headings not properly handled, due to NP architecture.
 * - doesn't handle making an indented/child paragraph. (Instead, see alternative function 'coreAddRawContentToNoteHeading' below.)
 * Note: drawn from QuickCapture's /qach addChecklistToNoteHeading
 * @author @jgclark
 * @param {TNote} note note title to use (can be YYYYMMDD as well as usual calendar titles)
 * @param {string} heading heading to put checklist under (if blank, then append to end of note)
 * @param {string} content to use as checklist
 * @param {number} headingLevel heading level 1-5
 * @param {boolean} shouldAppend whether to append to end of note or not
 */
export function coreAddChecklistToNoteHeading(
  note: TNote,
  heading: string,
  content: string,
  headingLevel: number,
  shouldAppend: boolean
): ?TParagraph {
  try {
    logDebug('coreAddChecklistToNoteHeading', `starting for note '${displayTitle(note)}' under heading '${heading}' text ${content} headingLevel ${headingLevel}`)

    // Note: assumes all inputs have already been validated

    // Add checklist to the heading in the note, or if blank heading,
    // then then user has chosen to append to end of note, without a heading
    if (heading === '<<top of note>>') {
      // Handle this special case
      logDebug('coreAddChecklistToNoteHeading', `Adding line '${content}' to start of active part of note '${displayTitle(note)}'`)
      // note.insertParagraph(content, findStartOfActivePartOfNote(note), 'checklist')
      smartPrependParas(note, [content], ['checklist'])
    }
    else if (heading === '' || heading === '<<bottom of note>>') {
      // Handle bottom of note
      logDebug('coreAddChecklistToNoteHeading', `Adding checklist '${content}' to end of '${displayTitle(note)}'`)
      // note.insertParagraph(content, findEndOfActivePartOfNote(note) + 1, 'checklist')
      smartAppendPara(note, content, 'checklist')
    } else {
      const matchedHeading = findHeadingStartsWith(note, heading)
      logDebug('coreAddChecklistToNoteHeading', `Adding checklist '${content}' to '${displayTitle(note)}' below '${heading}'`)
      if (matchedHeading !== '') {
        // Heading does exist in note already
        note.addParagraphBelowHeadingTitle(
          content,
          'checklist',
          (matchedHeading !== '') ? matchedHeading : heading,
          shouldAppend, // NB: since 0.12 treated as position for all notes, not just inbox
          true, // create heading if needed (possible if supplied via headingArg)
        )
      } else {
        // We need to add a new heading either at top or bottom, depending what shouldAppend says
        // V1
        // const headingMarkers = '#'.repeat(headingLevel)
        // const headingToUse = `${headingMarkers} ${heading}`
        // const insertionIndex = shouldAppend
        //   ? findEndOfActivePartOfNote(note) + 1
        //   : findStartOfActivePartOfNote(note)
        // logDebug('coreAddChecklistToNoteHeading', `- adding new heading '${headingToUse}' at line index ${insertionIndex}`)
        // note.insertParagraph(headingToUse, insertionIndex, 'text') // can't use 'title' type as it doesn't allow headingLevel to be set
        // logDebug('coreAddChecklistToNoteHeading', `- then adding text '${content}' after `)
        // note.insertParagraph(content, insertionIndex + 1, 'checklist')
        // V2:
        smartCreateSectionsAndPara(
          note,
          content,
          'checklist',
          [heading],
          headingLevel,
          shouldAppend,
        )
      }
      DataStore.updateCache(note, false)
      const resultingPara = findParaFromStringAndFilename(note.filename, content)
      return resultingPara || null
    }
  } catch (err) {
    logError('coreAddChecklistToNoteHeading', err.message)
    // await showMessage(err.message)
  }
}

/**
 * Add a task to a (regular or calendar) note and heading that is supplied.
 * Note: limitations:
 * - duplicate headings not properly handled, due to NP architecture.
 * - doesn't handle making an indented/child paragraph. (Instead, see alternative function 'coreAddRawContentToNoteHeading' below.)
 * Note: drawn from QuickCapture's /qath coreAddTaskToNoteHeading
 * @author @jgclark
 * @param {TNote} note note title to use (can be YYYYMMDD as well as usual calendar titles)
 * @param {string} heading heading to put task under
 * @param {string} content to use as task
 * @param {number} headingLevel heading level 1-5
 * @param {boolean} shouldAppend whether to append to end of note or not
 * @returns {TParagraph} returns paragraph for the new task
 */
export function coreAddTaskToNoteHeading(
  note: TNote,
  heading: string,
  content: string,
  headingLevel: number,
  shouldAppend: boolean
): ?TParagraph {
  try {
    logDebug('coreAddTaskToNoteHeading', `starting for note '${displayTitle(note)}' under heading '${heading}' text ${content} headingLevel ${headingLevel}`)

    // Note: assumes all inputs have already been validated

    // Add todo to the heading in the note, or if blank heading,
    // then then user has chosen to append to end of note, without a heading
    if (heading === '<<top of note>>') {
      // Handle this special case
      logDebug('coreAddTaskToNoteHeading', `Adding line '${content}' to start of active part of note '${displayTitle(note)}'`)
      smartPrependParas(note, [content], ['open'])
    }
    else if (heading === '' || heading === '<<bottom of note>>') {
      // Handle bottom of note
      logDebug('coreAddTaskToNoteHeading', `Adding task '${content}' to end of '${displayTitle(note)}'`)
      smartAppendPara(note, content, 'open')
    } else {
      const matchedHeading = findHeadingStartsWith(note, heading)
      logDebug('coreAddTaskToNoteHeading', `Adding task '${content}' to '${displayTitle(note)}' below '${heading}'`)
      if (matchedHeading !== '') {
        // Heading does exist in note already
        note.addParagraphBelowHeadingTitle(
          content,
          'open',
          (matchedHeading !== '') ? matchedHeading : heading,
          shouldAppend, // NB: since 0.12 treated as position for all notes, not just inbox
          true, // create heading if needed (possible if supplied via headingArg)
        )
      } else {
        // We need to a new heading either at top or bottom, depending what shouldAppend says
        // V1:
        // const headingMarkers = '#'.repeat(headingLevel)
        // const headingToUse = `${headingMarkers} ${heading}`
        // const insertionIndex = shouldAppend
        //   ? findEndOfActivePartOfNote(note) + 1
        //   : findStartOfActivePartOfNote(note)
        // logDebug('coreAddTaskToNoteHeading', `- adding new heading '${headingToUse}' at line index ${insertionIndex}`)
        // note.insertParagraph(headingToUse, insertionIndex, 'text') // can't use 'title' type as it doesn't allow headingLevel to be set
        // logDebug('coreAddTaskToNoteHeading', `- then adding text '${content}' after `)
        // note.insertParagraph(content, insertionIndex + 1, 'open')
        // V2:
        smartCreateSectionsAndPara(
          note,
          content,
          'open',
          [heading],
          headingLevel,
          shouldAppend,
        )
      }

      DataStore.updateCache(note, false)
      const resultingPara = findParaFromStringAndFilename(note.filename, content)
      return resultingPara || null
    }
  } catch (err) {
    logError('coreAddTaskToNoteHeading', err.message)
    return null
    // await showMessage(err.message)
  }
}

/**
 * TEST: Add raw content to a heading in a note.
 * Note: similar to coreAddTaskToNoteHeading, but for raw content.
 * @author @jgclark
 * @param {TNote} note note title to use (can be YYYYMMDD as well as usual calendar titles)
 * @param {string} heading heading to put checklist under
 * @param {string} rawContent
 * @param {number} headingLevel heading level 1-5
 * @param {boolean} shouldAppend whether to append to end of note or not
 * @returns {TParagraph} returns paragraph for the new rawContent
 */
export function coreAddRawContentToNoteHeading(
  note: TNote,
  heading: string,
  rawContent: string,
  headingLevel: number,
  shouldAppend: boolean
): ?TParagraph {
  try {
    logDebug('coreAddRawContentToNoteHeading', `starting for note '${displayTitle(note)}' under heading '${heading}' rawContent {${rawContent}} headingLevel ${headingLevel}`)

    // Note: assumes all inputs have already been validated

    // Add raw content to the heading in the note, or if blank heading,
    // then then user has chosen to append to end of note, without a heading
    if (heading === '<<top of note>>') {
      // Handle this special case
      logDebug('coreAddRawContentToNoteHeading', `Adding line '${rawContent}' to start of active part of note '${displayTitle(note)}'`)
      note.insertParagraph(rawContent, findStartOfActivePartOfNote(note), 'text')
    }
    else if (heading === '' || heading === '<<bottom of note>>') {
      // Handle bottom of note
      logDebug('coreAddRawContentToNoteHeading', `Adding raw content '${rawContent}' to end of '${displayTitle(note)}'`)
      note.insertParagraph(rawContent, findEndOfActivePartOfNote(note) + 1, 'text')
    } else {
      const matchedHeading = findHeadingStartsWith(note, heading)
      logDebug('coreAddRawContentToNoteHeading', `Adding raw content '${rawContent}' to '${displayTitle(note)}' below '${heading}'`)
      if (matchedHeading !== '') {
        // Heading does exist in note already
        note.addParagraphBelowHeadingTitle(
          rawContent,
          'text',
          (matchedHeading !== '') ? matchedHeading : heading,
          shouldAppend,
          true, // create heading if needed (possible if supplied via headingArg)
        )
      } else {
        // We need to a new heading either at top or bottom, depending what shouldAppend says
        smartCreateSectionsAndPara(
          note,
          rawContent,
          'text',
          [heading],
          headingLevel,
          shouldAppend,
        )
      }
    }

    DataStore.updateCache(note, false)

    const resultingPara = findParaFromRawContentAndFilename(note.filename, rawContent)
    return resultingPara || null
  } catch (err) {
    logError('coreAddRawContentToNoteHeading', err.message)
    // await showMessage(err.message)
  }
}
