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
  // smartAppendPara,
  // smartPrependPara
} from '@helpers/paragraph'

/**
 * Add a checklist to a (regular or calendar) note and heading that is supplied.
 * Note: duplicate headings not properly handled, due to NP architecture.
 * Note: drawn from QuickCapture's /qach addChecklistToNoteHeading
 * @author @jgclark
 * @param {TNote} note note title to use (can be YYYYMMDD as well as usual calendar titles)
 * @param {string} heading heading to put checklist under (if blank, then append to end of note)
 * @param {string} text text to use as checklist
 * @param {number} headingLevel heading level 1-5
 * @param {boolean} shouldAppend whether to append to end of note or not
 */
export function coreAddChecklistToNoteHeading(
  note: TNote,
  heading: string,
  checklistText: string,
  headingLevel: number,
  shouldAppend: boolean
): void {
  try {
    logDebug('coreAddChecklistToNoteHeading', `starting for note '${displayTitle(note)}' under heading '${heading}' text ${checklistText} headingLevel ${headingLevel}`)

    // Note: assumes all inputs have already been validated

    // Add checklist to the heading in the note, or if blank heading,
    // then then user has chosen to append to end of note, without a heading
    if (heading === '<<top of note>>') {
      // Handle this special case
      logDebug('coreAddChecklistToNoteHeading', `Adding line '${checklistText}' to start of active part of note '${displayTitle(note)}'`)
      note.insertParagraph(checklistText, findStartOfActivePartOfNote(note), 'checklist')
    }
    else if (heading === '' || heading === '<<bottom of note>>') {
      // Handle bottom of note
      logDebug('coreAddChecklistToNoteHeading', `Adding checklist '${checklistText}' to end of '${displayTitle(note)}'`)
      note.insertParagraph(checklistText, findEndOfActivePartOfNote(note) + 1, 'checklist')
    } else {
      const matchedHeading = findHeadingStartsWith(note, heading)
      logDebug('coreAddChecklistToNoteHeading', `Adding checklist '${checklistText}' to '${displayTitle(note)}' below '${heading}'`)
      if (matchedHeading !== '') {
        // Heading does exist in note already
        note.addParagraphBelowHeadingTitle(
          checklistText,
          'checklist',
          (matchedHeading !== '') ? matchedHeading : heading,
          shouldAppend, // NB: since 0.12 treated as position for all notes, not just inbox
          true, // create heading if needed (possible if supplied via headingArg)
        )
      } else {
        // We need to a new heading either at top or bottom, depending what shouldAppend says
        const headingMarkers = '#'.repeat(headingLevel)
        const headingToUse = `${headingMarkers} ${heading}`
        const insertionIndex = shouldAppend
          ? findEndOfActivePartOfNote(note) + 1
          : findStartOfActivePartOfNote(note)
        logDebug('coreAddChecklistToNoteHeading', `- adding new heading '${headingToUse}' at line index ${insertionIndex}`)
        note.insertParagraph(headingToUse, insertionIndex, 'text') // can't use 'title' type as it doesn't allow headingLevel to be set
        logDebug('coreAddChecklistToNoteHeading', `- then adding text '${checklistText}' after `)
        note.insertParagraph(checklistText, insertionIndex + 1, 'checklist')
      }
      DataStore.updateCache(note)
    }
  } catch (err) {
    logError('coreAddChecklistToNoteHeading', err.message)
    // await showMessage(err.message)
  }
}

/**
 * Add a task to a (regular or calendar) note and heading that is supplied.
 * Note: duplicate headings not properly handled, due to NP architecture.
 * Note: drawn from QuickCapture's /qath coreAddTaskToNoteHeading
 * @author @jgclark
 * @param {TNote} note note title to use (can be YYYYMMDD as well as usual calendar titles)
 * @param {string} heading heading to put checklist under
 * @param {string} text text to use as checklist
 * @param {number} headingLevel heading level 1-5
 * @param {boolean} shouldAppend whether to append to end of note or not
 */
export function coreAddTaskToNoteHeading(
  note: TNote,
  heading: string,
  taskText: string,
  headingLevel: number,
  shouldAppend: boolean
): void {
  try {
    logDebug('coreAddTaskToNoteHeading', `starting for note '${displayTitle(note)}' under heading '${heading}' text ${taskText} headingLevel ${headingLevel}`)

    // Note: assumes all inputs have already been validated

    // Add todo to the heading in the note, or if blank heading,
    // then then user has chosen to append to end of note, without a heading
    if (heading === '<<top of note>>') {
      // Handle this special case
      logDebug('coreAddTaskToNoteHeading', `Adding line '${taskText}' to start of active part of note '${displayTitle(note)}'`)
      note.insertTodo(taskText, findStartOfActivePartOfNote(note))
    }
    else if (heading === '' || heading === '<<bottom of note>>') {
      // Handle bottom of note
      logDebug('coreAddTaskToNoteHeading', `Adding task '${taskText}' to end of '${displayTitle(note)}'`)
      note.insertTodo(taskText, findEndOfActivePartOfNote(note))
    } else {
      const matchedHeading = findHeadingStartsWith(note, heading)
      logDebug('coreAddTaskToNoteHeading', `Adding task '${taskText}' to '${displayTitle(note)}' below '${heading}'`)
      if (matchedHeading !== '') {
        // Heading does exist in note already
        note.addParagraphBelowHeadingTitle(
          taskText,
          'open',
          (matchedHeading !== '') ? matchedHeading : heading,
          shouldAppend, // NB: since 0.12 treated as position for all notes, not just inbox
          true, // create heading if needed (possible if supplied via headingArg)
        )
      } else {
        // We need to a new heading either at top or bottom, depending what shouldAppend says
        const headingMarkers = '#'.repeat(headingLevel)
        const headingToUse = `${headingMarkers} ${heading}`
        const insertionIndex = shouldAppend
          ? findEndOfActivePartOfNote(note) + 1
          : findStartOfActivePartOfNote(note)
        logDebug('coreAddTaskToNoteHeading', `- adding new heading '${headingToUse}' at line index ${insertionIndex}`)
        note.insertParagraph(headingToUse, insertionIndex, 'text') // can't use 'title' type as it doesn't allow headingLevel to be set
        logDebug('coreAddTaskToNoteHeading', `- then adding text '${taskText}' after `)
        note.insertParagraph(taskText, insertionIndex + 1, 'open')
      }

      DataStore.updateCache(note)
    }
  } catch (err) {
    logError('coreAddTaskToNoteHeading', err.message)
    // await showMessage(err.message)
  }
}

/**
 * Prepend a todo (task or checklist) to a calendar note.
 * Note: doesn't seem to be used. Commenting out to avoid circular dependency.
 * @author @jgclark
 * @param {"task" | "checklist"} todoTypeName 'English' name of type of todo
 * @param {string} NPDateStr the usual calendar titles, plus YYYYMMDD
 * @param {string} todoTextArg text to prepend. If empty or missing, then will ask user for it
 */
// export async function prependTodoToCalendarNote(todoTypeName: 'task' | 'checklist', NPDateStr: string, todoTextArg: string = ''): Promise<void> {
//   // logDebug('NPP/prependTodoToCalendarNote', `Starting with NPDateStr: ${NPDateStr}, todoTypeName: ${todoTypeName}, todoTextArg: ${todoTextArg}`)
//   try {
//     const todoType = todoTypeName === 'task' ? 'open' : 'checklist'
//     // Get calendar note to use
//     const note = DataStore.calendarNoteByDateString(NPDateStr)
//     if (note != null) {
//       // Get input either from passed argument or ask user
//       const todoText =
//         todoTextArg != null && todoTextArg !== '' ? todoTextArg : await CommandBar.showInput(`Type the ${todoTypeName} text to add`, `Add ${todoTypeName} '%@' to ${NPDateStr}`)
//       logDebug('NPP/prependTodoToCalendarNote', `- Prepending type ${todoType} '${todoText}' to '${displayTitle(note)}'`)
//       smartPrependPara(note, todoText, todoType)

//       // Ask for cache refresh for this note
//       DataStore.updateCache(note, false)
//     } else {
//       logError('NPP/prependTodoToCalendarNote', `- Can't get calendar note for ${NPDateStr}`)
//     }
//   } catch (err) {
//     logError('NPP/prependTodoToCalendarNote', `${err.name}: ${err.message}`)
//     await showMessage(err.message)
//   }
// }
