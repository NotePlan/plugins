// @flow
// -----------------------------------------------------------------
// Helpers for moving paragraphs around.
// -----------------------------------------------------------------

import { addParasAsText } from '../jgclark.Filer/src/filerHelpers.js'
import {
  getAPIDateStrFromDisplayDateStr,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getNoteByFilename } from '@helpers/note'
import { coreAddChecklistToNoteHeading, coreAddTaskToNoteHeading } from '@helpers/NPAddItems'
import { getParaAndAllChildren } from '@helpers/parentsAndChildren'
import { findEndOfActivePartOfNote, findHeadingStartsWith, findStartOfActivePartOfNote, parasToText, smartPrependPara } from '@helpers/paragraph'
import { findParaFromStringAndFilename, insertParagraph, noteHasContent } from '@helpers/NPParagraph'
import { removeDateTagsAndToday } from '@helpers/stringTransforms'
import { chooseHeading, chooseNote, displayTitleWithRelDate } from '@helpers/userInput'

/**
 * Move an item (given by its content and filename) and move to a note specified by the user.
 * Note: designed to be used by HTMLView plugins where proper Paragraphs aren't available.
 * @param {string} origFilename line is currently in
 * @param {string} content of line
 * @param {ParagraphType} type of item
 * @param {number} newHeadingLevel for new Headings
 * @returns {TNote} returns new note the line was moved to
 */
export async function moveItemToRegularNote(origFilename: string, content: string, itemType: ParagraphType, newHeadingLevel: number = 2): Promise<TNote | null> {
  try {
    logDebug('moveItemToRegularNote', `Starting with {${content}} in ${origFilename}`)

    // find para in the given origFilename
    const possiblePara: TParagraph | boolean = findParaFromStringAndFilename(origFilename, content)
    if (typeof possiblePara === 'boolean') {
      throw new Error('moveItemToRegularNote: no para found')
    }

    // const itemType = data.itemType
    logDebug('moveItemToRegularNote', `- itemType: ${itemType}`)

    // Ask user for destination project note
    const typeToDisplayToUser = itemType // === 'checklist' ? 'Checklist' : 'Task'
    const destNote = await chooseNote(true, false, [], `Choose Note to Move ${typeToDisplayToUser} to`, false, true)
    logDebug('moveItemToRegularNote', `- Moving to note '${displayTitle(destNote)}'`)
    if (!destNote) return null

    // Ask to which heading to add the selectedParas
    const headingToFind = await chooseHeading(destNote, true, true, false)
    logDebug('moveItemToRegularNote', `- Moving to note '${displayTitle(destNote)}' under heading: '${headingToFind}'`)

    // TODO: Add new setting + Logic to handle inserting section heading(s) more generally (ref tastapod)
    // TODO: Add new setting + logic to not add new section heading (ref #551)

    // Add text to the new location in destination note
    logDebug('moveItemToRegularNote', `- newHeadingLevel: ${newHeadingLevel}`)
    if (itemType === 'open') {
      coreAddTaskToNoteHeading(destNote, headingToFind, content, newHeadingLevel, false)
    } if (itemType === 'checklist') {
      coreAddChecklistToNoteHeading(destNote, headingToFind, content, newHeadingLevel, false)
    } else {
      logError('moveItemToRegularNote', `- not (yet) designed to handle item type ${itemType}`)
    }

    // Trying to get the note again from DataStore in case that helps find the task (it doesn't)
    // $FlowIgnore
    const noteAfterChanges: TNote = DataStore.noteByFilename(destNote.filename, destNote.type)
    // Ask for cache refresh for this note
    const updatedDestNote = DataStore.updateCache(noteAfterChanges, false)

    // delete from existing location
    const origNote = getNoteByFilename(origFilename)
    const origPara = findParaFromStringAndFilename(origFilename, content)
    if (origNote && origPara) {
      logDebug('moveItemToRegularNote', `- Removing 1 para from original note ${origFilename}`)
      origNote.removeParagraph(origPara)
      DataStore.updateCache(origNote, false)
    } else {
      logWarn('moveItemToRegularNote', `couldn't remove para {${content}} from original note ${origFilename} because note or paragraph couldn't be found`)
    }
    // Return the destNote
    return updatedDestNote

    // Ask for cache refresh for this note
  } catch (error) {
    logError('', error.message)
    return null
  }
}

/**
 * Move a task or checklist from one calendar note to another.
 * It's designed to be used when the para itself is not available; the para will try to be identified from its filename and content, and it will throw an error if it fails.
 * It also moves indented child paragraphs of any type.
 * Location in note depends on 'heading' value:
 * - '<<top of note>>', then start of active part of Note
 * - '' (blank) or '<<bottom of note>>' the para will be *prepended* to the effective top of the destination note.
 * - otherwise will add after the matching heading, adding new heading if needed.
 * Note: is called by moveClickHandlers::doMoveFromCalToCal().
 * @author @jgclark
 * @param {string} NPFromDateStr from date (the usual NP calendar date strings, plus YYYYMMDD)
 * @param {string} NPToDateStr to date (the usual NP calendar date strings, plus YYYYMMDD)
 * @param {string} paraContent content of the para to move.
 * @param {string?} heading which will be created if necessary
 * @returns {TNote | false} if succesful pass the new note, otherwise false
 */
export function moveItemBetweenCalendarNotes(NPFromDateStr: string, NPToDateStr: string, paraContent: string, heading: string = '', newTaskSectionHeadingLevel: number = 2): TNote | false {
  logDebug('moveItemBetweenCalendarNotes', `starting for ${NPFromDateStr} to ${NPToDateStr} under heading '${heading}'`)
  try {
    // Get calendar note to use
    const fromNote = DataStore.calendarNoteByDateString(getAPIDateStrFromDisplayDateStr(NPFromDateStr))
    const toNote = DataStore.calendarNoteByDateString(getAPIDateStrFromDisplayDateStr(NPToDateStr))
    // Don't proceed unless we have valid from/to notes
    if (!fromNote || !toNote) {
      logError('moveItemBetweenCalendarNotes', `- Can't get calendar note for ${NPFromDateStr} and/or ${NPToDateStr}`)
      return false
    }

    // find para in the fromNote
    const matchedPara: TParagraph | boolean = findParaFromStringAndFilename(fromNote.filename, paraContent)
    if (typeof matchedPara === 'boolean') {
      throw new Error('moveItemBetweenCalendarNotes: no para found')
    }
    // Remove any scheduled date on the parent para
    const updatedMatchedPara = removeDateTagsAndToday(paraContent, true)
    matchedPara.content = updatedMatchedPara
    fromNote.updateParagraph(matchedPara)

    // const itemType = matchedPara?.type
    const matchedParaAndChildren = getParaAndAllChildren(matchedPara)
    const targetContent = parasToText(matchedParaAndChildren)

    // FIXME: need to use coreAddTaskToNoteHeading() etc. here to handle '<<top of note>>' special processing
    // add to toNote
    if (heading === '<<top of note>>') {
      // Handle this special case
      logDebug('coreAddTaskToNoteHeading', `Adding line '${targetContent}' to start of active part of note '${displayTitle(toNote)}'`)
      smartPrependPara(toNote, targetContent, 'text')
    }
    else if (heading === '' || heading === '<<bottom of note>>') {
      logDebug('moveItemBetweenCalendarNotes', `- Calling smartPrependPara() for '${String(matchedParaAndChildren.length)}' to '${displayTitle(toNote)}'`)
      smartPrependPara(toNote, targetContent, 'text')
    } else {
      logDebug('moveItemBetweenCalendarNotes', `- Adding ${matchedParaAndChildren.length} lines under heading '${heading}' in '${displayTitle(toNote)}'`)
      // Note: this doesn't allow setting heading level ...
      // toNote.addParagraphBelowHeadingTitle(paraContent, itemType, heading, false, true)
      // so need to do it manually
      const shouldAppend = false
      const matchedHeading = findHeadingStartsWith(toNote, heading)
      logDebug(
        'moveItemBetweenCalendarNotes',
        `Adding line "${targetContent}" to '${displayTitleWithRelDate(toNote)}' below matchedHeading '${matchedHeading}' (heading was '${heading}')`,
      )

      // ? TODO: Add new setting + Logic to handle inserting section heading(s) more generally (ref tastapod)
      // ? TODO: Add new setting + logic to not add new section heading (ref #551)

      if (matchedHeading !== '') {
        // Heading does exist in note already
        toNote.addParagraphBelowHeadingTitle(
          targetContent,
          'text',
          matchedHeading !== '' ? matchedHeading : heading,
          shouldAppend, // NB: since 0.12 treated as position for all notes, not just inbox
          true, // create heading if needed (possible if supplied via headingArg)
        )
      } else {
        const headingLevel = newTaskSectionHeadingLevel
        const headingMarkers = '#'.repeat(headingLevel)
        const headingToUse = `${headingMarkers} ${heading}`
        const insertionIndex = shouldAppend ? findEndOfActivePartOfNote(toNote) + 1 : findStartOfActivePartOfNote(toNote)

        logDebug('moveItemBetweenCalendarNotes', `- adding new heading '${headingToUse}' at line index ${insertionIndex} ${shouldAppend ? 'at end' : 'at start'}`)
        toNote.insertParagraph(headingToUse, insertionIndex, 'text') // can't use 'title' type as it doesn't allow headingLevel to be set
        logDebug('moveItemBetweenCalendarNotes', `- then adding text after it`)
        toNote.insertParagraph(targetContent, insertionIndex + 1, 'text')
      }
    }

    // Assuming that's not thrown an error, now remove from fromNote
    logDebug('moveItemBetweenCalendarNotes', `- Removing line(s) from '${displayTitle(fromNote)}'`)
    fromNote.removeParagraphs(matchedParaAndChildren)

    // Ask for cache refresh for these notes
    DataStore.updateCache(fromNote, false)
    DataStore.updateCache(toNote, false)

    return toNote
  } catch (err) {
    logError('moveItemBetweenCalendarNotes', `${err.name}: ${err.message} moving {${paraContent}} from ${NPFromDateStr} to ${NPToDateStr}`)
    return false
  }
}

/**
 * Move the tasks to the specified note
 * @param {TParagraph} para - the paragraph to move
 * @param {TNote} destinationNote - the note to move to
 * @returns {boolean} whether it worked or not
 * @author @dwertheimer based on @jgclark code lifted from fileItems.js
 * Note: Originally, if you were using Editor.* commands, this would not delete the original paragraph (need to use Editor.note.* or note.*)
 * Hoping that adding DataStore.updateCache() will fix that
 * TODO: add user preference for where to move tasks in note - see @jgclark's code fileItems.js
 */
export function moveParagraphToNote(para: TParagraph, destinationNote: TNote): boolean {
  // for now, insert at the top of the note
  if (!para || !para.note || !destinationNote) return false
  const oldNote = para.note
  insertParagraph(destinationNote, para.rawContent)
  // dbw note: because I am nervous about people losing data, I am going to check that the paragraph has been inserted before deleting the original
  if (noteHasContent(destinationNote, para.content)) {
    para?.note?.removeParagraph(para) // this may not work if you are using Editor.* commands rather than Editor.note.* commands
    // $FlowFixMe - not in the type defs yet
    DataStore.updateCache(oldNote) // try to force Editor and Editor.note to be in synce after the move
    return true
  } else {
    logDebug(
      'moveParagraphToNote',
      `Could not find ${para.content} in ${destinationNote.title || 'no title'} so could not move it to ${destinationNote.title || 'no title'}`,
    )
  }
  return false
}

/**
 * Move a given paragraph (and any following indented paragraphs) to a different note.
 * Note: simplified version of 'moveParas()' in NPParagraph.
 * NB: the Setting 'includeFromStartOfSection' decides whether these directly following paragaphs have to be indented (false) or can take all following lines at same level until next empty line as well.
 * Note: originally in helpers/blocks.js, not used anywhere yet.
 * @param {TParagraph} para
 * @param {string} toFilename
 * @param {NoteType} toNoteType
 * @param {string} toHeading to move under
 * @author @jgclark
 */
export function moveGivenParaAndBlock(para: TParagraph, toFilename: string, toNoteType: NoteType, toHeading: string): void {
  try {
    if (!toFilename) {
      throw new Error('Invalid destination filename given.')
    }
    if (!para) {
      throw new Error('Invalid paragraph filename given.')
    }

    // Get config settings
    // const config = await getFilerSettings()

    const fromNote = para.note
    if (!fromNote) {
      throw new Error(`From note can't be found. Stopping.`)
    }

    // Get paragraph index
    const firstSelLineIndex = para.lineIndex
    const lastSelLineIndex = para.lineIndex
    // Get paragraphs for the selection or block
    let firstStartIndex = 0

    // get children paras (as well as the original)
    const parasInBlock = getParaAndAllChildren(para)
    logDebug('blocks/moveGivenParaAndBlock', `moveParas: move block of ${parasInBlock.length} paras`)

    // Note: There's still no API function to add multiple
    // paragraphs in one go, but we can insert a raw text string.
    const selectedParasAsText = parasToText(parasInBlock)

    // Add text to the new location in destination note
    const destNote = DataStore.noteByFilename(toFilename, toNoteType)
    if (!destNote) {
      throw new Error(`Destination note can't be found from filename '${toFilename}'`)
    }
    logDebug('blocks/moveGivenParaAndBlock', `- Moving to note '${displayTitle(destNote)}' under heading: '${toHeading}'`)
    addParasAsText(destNote, selectedParasAsText, toHeading, 'start', true)

    // delete from existing location
    logDebug('blocks/moveGivenParaAndBlock', `- Removing ${parasInBlock.length} paras from original note`)
    fromNote.removeParagraphs(parasInBlock)
  }
  catch (error) {
    logError('blocks/moveGivenParaAndBlock', `moveParas(): ${error.message}`)
  }
}
