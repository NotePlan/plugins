// @flow
// -----------------------------------------------------------------
// Helpers for moving paragraphs around.
// -----------------------------------------------------------------

import { findScheduledDates, getAPIDateStrFromDisplayDateStr } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getHeadingHierarchyForThisPara } from '@helpers/headings'
import { getNoteByFilename } from '@helpers/note'
import { coreAddChecklistToNoteHeading, coreAddTaskToNoteHeading } from '@helpers/NPAddItems'
import { getParaAndAllChildren } from '@helpers/parentsAndChildren'
import { findEndOfActivePartOfNote, findHeading, findHeadingStartsWith, findStartOfActivePartOfNote, parasToText, smartAppendPara, smartCreateSectionsAndPara, smartPrependPara } from '@helpers/paragraph'
import { addParasAsText, findParaFromStringAndFilename, insertParagraph, noteHasContent } from '@helpers/NPParagraph'
import { removeDateTagsAndToday } from '@helpers/stringTransforms'
import { chooseHeading, chooseNote, displayTitleWithRelDate, showMessage, showMessageYesNo } from '@helpers/userInput'

/**
 * Move an item (given by its content and filename) and move to a note specified by the user.
 * Note: designed to be used by HTMLView plugins where proper Paragraphs aren't available.
 * @param {string} origFilename line is currently in
 * @param {string} paraContent content of line
 * @param {ParagraphType} type of item
 * @param {number} newHeadingLevel for new Headings
 * @returns {TNote} returns new note the line was moved to
 */
export async function moveItemToRegularNote(origFilename: string, paraContent: string, itemType: ParagraphType, newHeadingLevel: number = 2): Promise<TNote | null> {
  try {
    logDebug('moveItemToRegularNote', `Starting with {${paraContent}} in ${origFilename}, itemType: ${itemType}`)

    // find para in the given origFilename
    const possiblePara: TParagraph | boolean = findParaFromStringAndFilename(origFilename, paraContent)
    if (typeof possiblePara === 'boolean') {
      logWarn('moveItemToRegularNote', `Cannot find paragraph {${paraContent}} in note '${origFilename}'. Likely cause: updated note since last Dashboard refresh.`)
      showMessage(`Cannot find paragraph {${paraContent}} in note '${origFilename}'. Have you updated this line in the note since the last Dashboard refresh?`, 'OK', 'Dashboard: Move Item', false)
      return null
    }

    // Ask user for destination project note
    const typeToDisplayToUser = itemType === 'checklist' ? 'Checklist' : 'Task'
    const destNote = await chooseNote(true, false, [], `Choose Note to Move ${typeToDisplayToUser} to`, false, true)
    logDebug('moveItemToRegularNote', `- Moving to note '${displayTitle(destNote)}'`)
    if (!destNote) return null

    // Ask to which heading to add the selectedParas
    const headingToFind = await chooseHeading(destNote, true, true, false)
    const origNote = getNoteByFilename(origFilename)
    logDebug('moveItemToRegularNote', `- Moving from note '${displayTitle(origNote)}' to '${displayTitle(destNote)}' under heading: '${headingToFind}'`)

    // If there's a >date in the line, ask whether to remove it
    let paraContentToUse = paraContent
    const schedDates = findScheduledDates(paraContent)
    if (schedDates.length) {
      const message = (schedDates.length === 1)
        ? `Remove the scheduled date '${schedDates[0]}'?`
        : `Remove the scheduled dates [${schedDates.join(',')}]?`
      const removeDate = await showMessageYesNo(message, ['Yes', 'No'], `Move ${itemType}`, false)
      if (removeDate === 'Yes') {
        paraContentToUse = removeDateTagsAndToday(paraContent, true)
      }
    }

    // TODO: Add new setting + Logic to handle inserting section heading(s) more generally (ref tastapod)
    // TODO: Add new setting + logic to not add new section heading (ref #551)

    // Add text to the new location in destination note
    logDebug('moveItemToRegularNote', `- newHeadingLevel: ${newHeadingLevel}`)
    if (itemType === 'open') {
      coreAddTaskToNoteHeading(destNote, headingToFind, paraContentToUse, newHeadingLevel, false)
    } else if (itemType === 'checklist') {
      coreAddChecklistToNoteHeading(destNote, headingToFind, paraContentToUse, newHeadingLevel, false)
    } else {
      logError('moveItemToRegularNote', `- not (yet) designed to handle item type ${itemType}`)
    }

    // Trying to get the note again from DataStore in case that helps find the task (it doesn't)
    // $FlowIgnore[incompatible-type] checked above
    const noteAfterChanges: TNote = DataStore.noteByFilename(destNote.filename, destNote.type)
    // Ask for cache refresh for this note
    const updatedDestNote = DataStore.updateCache(noteAfterChanges, false)

    // delete from existing location
    const origPara = findParaFromStringAndFilename(origFilename, paraContent)
    if (origNote && origPara) {
      logDebug('moveItemToRegularNote', `- Removing 1 para from original note ${origFilename}`)
      origNote.removeParagraph(origPara)
      DataStore.updateCache(origNote, false)
    } else {
      logWarn('moveItemToRegularNote', `couldn't remove para {${paraContent}} from original note ${origFilename} because note or paragraph couldn't be found`)
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
 * @param {string} paraRawContent raw content of the para to move
 * @param {string?} heading which will be created if necessary
 * @param {number?} newTaskSectionHeadingLevel heading level to use for new headings (optional, defaults to 2). If set to 0, then no new heading will be created if it doesn't already exist.
 * @returns {TNote | false} if succesful pass the new note, otherwise false
 */
export function moveItemBetweenCalendarNotes(NPFromDateStr: string, NPToDateStr: string, paraRawContent: string, heading: string = '', newTaskSectionHeadingLevel: number = 2): TNote | false {
  logDebug('moveItemBetweenCalendarNotes', `starting for ${NPFromDateStr} to ${NPToDateStr} under heading '${heading}' with newTaskSectionHeadingLevel ${String(newTaskSectionHeadingLevel)} ${typeof newTaskSectionHeadingLevel}`)

  try {
    // Get calendar note to use
    const originNote = DataStore.calendarNoteByDateString(getAPIDateStrFromDisplayDateStr(NPFromDateStr))
    const destNote = DataStore.calendarNoteByDateString(getAPIDateStrFromDisplayDateStr(NPToDateStr))
    // Don't proceed unless we have valid from/to notes
    if (!originNote || !destNote) {
      logError('moveItemBetweenCalendarNotes', `- Can't get calendar note for ${NPFromDateStr} and/or ${NPToDateStr}`)
      return false
    }

    // find para in the originNote
    const matchedPara: TParagraph | boolean = findParaFromStringAndFilename(originNote.filename, paraRawContent)
    if (typeof matchedPara === 'boolean') {
      logWarn('moveItemBetweenCalendarNotes', `Cannot find paragraph {${paraRawContent}} in note '${NPFromDateStr}'. Likely cause: updated note since last Dashboard refresh.`)
      showMessage(`Cannot find paragraph {${paraRawContent}} in calendar note '${NPFromDateStr}'. Have you updated this line in the note since the last Dashboard refresh?`, 'OK', 'Dashboard: Move Item', false)
      return false
    }

    // Remove any scheduled date on the parent para
    const updatedMatchedPara = removeDateTagsAndToday(paraRawContent, true)
    matchedPara.content = updatedMatchedPara
    originNote.updateParagraph(matchedPara)

    const matchedParaAndChildren = getParaAndAllChildren(matchedPara)
    const newContent = parasToText(matchedParaAndChildren)

    // Add to destNote
    // Handle options for where to insert the new lines (see also NPScheduleItems::scheduleItem())
    if (heading === '<<top of note>>') {
      // Handle this special case
      logDebug('coreAddTaskdestNoteHeading', `- Adding line '${newContent}' to start of active part of note '${displayTitle(destNote)}' using smartPrependPara()`)
      smartPrependPara(destNote, newContent, 'text')
    }
    else if (heading === '' || heading === '<<bottom of note>>') {
      logDebug('moveItemBetweenCalendarNotes', `- Adding line '${newContent}' to start of active part of note '${displayTitle(destNote)}' using smartAppendPara()`)
      smartAppendPara(destNote, newContent, 'text')
    }
    else if (heading !== '' && newTaskSectionHeadingLevel === 0) {
      // If the heading exists, then use it, but don't create a new one if it doesn't exist
      // FIXME: doesn't get here
      logDebug('scheduleItem', `- Heading ${heading} is wanted, but only if it already exists.`)
      const wantedHeadingPara = findHeading(destNote, heading)
      if (wantedHeadingPara) {
        logDebug('scheduleItem', `- Adding line '${newContent}' under heading ${heading} using addParagraphBelowHeadingTitle()`)
        destNote.addParagraphBelowHeadingTitle(newContent, 'text', heading, true, true)
      } else {
        logDebug('scheduleItem', `- Heading '${heading}' doesn't exist in note '${displayTitle(destNote)}'. Will add line to start of note using smartPrependPara() instead.`)
        smartPrependPara(destNote, newContent, 'text')
      }
    }
    else if (heading === '<<carry forward>>') {
      // Get preceding headings for matchedPara
      const headingHierarchy = getHeadingHierarchyForThisPara(matchedPara).reverse()
      logDebug('moveItemBetweenCalendarNotes', `- Calling smartCreateSectionsAndPara() for '${String(matchedParaAndChildren.length)}' to '${displayTitle(destNote)}' with headingHierarchy: [${String(headingHierarchy)}]`)
      const firstHeadingPara = findHeading(originNote, headingHierarchy[0])
      const firstHeadingLevel = firstHeadingPara?.headingLevel ?? newTaskSectionHeadingLevel
      smartCreateSectionsAndPara(destNote, newContent, 'text', headingHierarchy, firstHeadingLevel)
    }
    else {
      logDebug('moveItemBetweenCalendarNotes', `- Adding ${matchedParaAndChildren.length} lines under heading '${heading}' in '${displayTitle(destNote)}'`)
      // Note: this doesn't allow setting heading level ...
      // destNote.addParagraphBelowHeadingTitle(paraRawContent, itemType, heading, false, true)
      // so need to do it manually
      const shouldAppend = false
      const matchedHeading = findHeadingStartsWith(destNote, heading)
      logDebug(
        'moveItemBetweenCalendarNotes',
        `Adding line "${newContent}" to '${displayTitleWithRelDate(destNote)}' below matchedHeading '${matchedHeading}' (heading was '${heading}')`,
      )

      if (matchedHeading !== '') {
        // Heading does exist in note already
        destNote.addParagraphBelowHeadingTitle(
          newContent,
          'text',
          matchedHeading !== '' ? matchedHeading : heading,
          shouldAppend, // NB: since 0.12 treated as position for all notes, not just inbox
          true, // create heading if needed (possible if supplied via headingArg)
        )
      } else {
        const headingLevel = newTaskSectionHeadingLevel
        const headingMarkers = '#'.repeat(headingLevel)
        const headingToUse = `${headingMarkers} ${heading}`
        const insertionIndex = shouldAppend ? findEndOfActivePartOfNote(destNote) + 1 : findStartOfActivePartOfNote(destNote)

        logDebug('moveItemBetweenCalendarNotes', `- adding new heading '${headingToUse}' at line index ${insertionIndex} ${shouldAppend ? 'at end' : 'at start'}`)
        destNote.insertParagraph(headingToUse, insertionIndex, 'text') // can't use 'title' type as it doesn't allow headingLevel to be set
        logDebug('moveItemBetweenCalendarNotes', `- then adding text after it`)
        destNote.insertParagraph(newContent, insertionIndex + 1, 'text')
      }
    }

    // Assuming that's not thrown an error, now remove from originNote
    logDebug('moveItemBetweenCalendarNotes', `- Removing line(s) from '${displayTitle(originNote)}'`)
    originNote.removeParagraphs(matchedParaAndChildren)

    // Ask for cache refresh for these notes
    DataStore.updateCache(originNote, false)
    DataStore.updateCache(destNote, false)

    return destNote
  } catch (err) {
    logError('moveItemBetweenCalendarNotes', `${err.name}: ${err.message} moving {${paraRawContent}} from ${NPFromDateStr} to ${NPToDateStr}`)
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
 * @param {TParagraph} para
 * @param {string} destFilename
 * @param {NoteType} destNoteType
 * @param {string} destHeading to move under
 * @author @jgclark
 */
export function moveGivenParaAndIndentedChildren(para: TParagraph, destFilename: string, destNoteType: NoteType, destHeading: string): void {
  try {
    if (!destFilename) {
      throw new Error('Invalid destination filename given.')
    }
    if (!para) {
      throw new Error('Invalid paragraph filename given.')
    }

    const originNote = para.note
    if (!originNote) {
      throw new Error(`From note can't be found. Stopping.`)
    }

    // get children paras (as well as the original)
    const parasInBlock = getParaAndAllChildren(para)
    logDebug('blocks/moveGivenParaAndIndentedChildren', `moveParas: move block of ${parasInBlock.length} paras`)

    // Note: There's still no API function to add multiple
    // paragraphs in one go, but we can insert a raw text string.
    const selectedParasAsText = parasToText(parasInBlock)

    // Add text to the new location in destination note
    const destNote = DataStore.noteByFilename(destFilename, destNoteType)
    if (!destNote) {
      throw new Error(`Destination note can't be found from filename '${destFilename}'`)
    }
    logDebug('blocks/moveGivenParaAndIndentedChildren', `- Moving to note '${displayTitle(destNote)}' under heading: '${destHeading}'`)
    addParasAsText(destNote, selectedParasAsText, destHeading, 'start', true)

    // delete from existing location
    logDebug('blocks/moveGivenParaAndIndentedChildren', `- Removing ${parasInBlock.length} paras from original note`)
    originNote.removeParagraphs(parasInBlock)
  }
  catch (error) {
    logError('blocks/moveGivenParaAndIndentedChildren', `moveParas(): ${error.message}`)
  }
}
