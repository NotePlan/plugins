/* eslint-disable prefer-template */
// @flow
// ----------------------------------------------------------------------------
// Plugin to help move selected Paragraphs to other notes
// Jonathan Clark
// last updated 2025-12-15, for v1.4.1
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { getFilerSettings } from './filerHelpers'
import { getParagraphBlock } from '@helpers/blocks'
import { hyphenatedDate, toLocaleDateTimeString } from '@helpers/dateTime'
import { toNPLocaleDateString } from '@helpers/NPdateTime'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { clearHighlighting, getSelectedParagraphsToUse } from '@helpers/editor'
import { displayTitle } from '@helpers/general'
import { allRegularNotesSortedByChanged } from '@helpers/note'
import { addParagraphsToNote, findHeading } from '@helpers/paragraph'
import { chooseNoteV2 } from '@helpers/NPnote'
import { highlightSelectionInEditor } from '@helpers/NPParagraph'
import { chooseHeadingV2, showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------------------
// Private helper functions

/**
 * Get the paragraphs to move based on selection and context.
 * @param {TNote} note - The note containing the paragraphs
 * @param {Array<TParagraph>} selectedParagraphsToUse - The selected paragraphs
 * @param {boolean} withBlockContext - Whether to include surrounding block
 * @param {Object} config - Configuration settings
 * @returns {Array<TParagraph>} Paragraphs to move
 */
function getParagraphsToMove(
  note: TNote,
  selectedParagraphsToUse: Array<TParagraph>,
  withBlockContext: boolean,
  config: any
): Array<TParagraph> {
  if (selectedParagraphsToUse.length === 0) {
    logWarn(pluginJson, 'getParagraphsToMove: No selected paragraphs found.')
    return []
  }

  const firstSelLineIndex = selectedParagraphsToUse[0].lineIndex
  const lastSelLineIndex = selectedParagraphsToUse[selectedParagraphsToUse.length - 1].lineIndex

  // If multiple paragraphs are selected, use only the selected paras
  if (lastSelLineIndex !== firstSelLineIndex) {
    logDebug('getParagraphsToMove', `User selection: lineIndexes ${firstSelLineIndex}-${lastSelLineIndex}`)
    return selectedParagraphsToUse.slice() // copy to avoid $ReadOnlyArray problem
  }

  // Single paragraph selected - check if user wants surrounding block
  if (withBlockContext) {
    // User has requested working on the surrounding block
    const parasInBlock = getParagraphBlock(note, firstSelLineIndex, config.includeFromStartOfSection, config.useTightBlockDefinition)
    logDebug('getParagraphsToMove', `No user selection: move block of ${parasInBlock.length} paras`)
    return parasInBlock
  } else {
    // User just wants to move the current line
    logDebug('getParagraphsToMove', `No user selection: move current para only`)
    return selectedParagraphsToUse.slice(0, 1) // just first para
  }
}

/**
 * Add date backlink to the first paragraph if moving from a calendar note.
 * @param {Array<TParagraph>} parasInBlock - Paragraphs to potentially modify
 * @param {TNote} note - Source note
 * @param {Object} config - Configuration settings
 */
function addDateBacklinkIfNeeded(parasInBlock: Array<TParagraph>, note: TNote, config: any): void {
  if (config.addDateBacklink && note.type === 'Calendar' && parasInBlock.length > 0) {
    const datePart: string =
      (config.dateRefStyle === 'link') ? ` >${hyphenatedDate(new Date())}`
        : (config.dateRefStyle === 'at') ? ` @${hyphenatedDate(new Date())}`
          : (config.dateRefStyle === 'date') ? ` (${toLocaleDateTimeString(new Date())})`
            : ''
    parasInBlock[0].content = `${parasInBlock[0].content} ${datePart}`
  }
}

/**
 * Move paragraphs from source note to destination note.
 * @param {TNote} sourceNote - Note to move paragraphs from
 * @param {TNote} destNote - Note to move paragraphs to
 * @param {Array<TParagraph>} parasInBlock - Paragraphs to move
 * @param {string} headingToFind - Heading to add paragraphs under (empty string for calendar notes)
 * @param {Object} config - Configuration settings
 * @throws {Error} If paragraphs fail to be added
 */
function moveParagraphsToNote(
  sourceNote: TNote,
  destNote: TNote,
  parasInBlock: Array<TParagraph>,
  headingToFind: string,
  config: any
): void {
  const selectedNumLines = parasInBlock.length
  const beforeNumParasInDestNote = destNote.paragraphs.length
  const origNumParas = sourceNote.paragraphs.length

  // Add paragraphs to destination note
  addParagraphsToNote(destNote, parasInBlock, headingToFind, config.whereToAddInSection, config.allowNotePreambleBeforeHeading)

  // Verify that paragraphs were added
  const afterNumParasInDestNote = destNote.paragraphs.length
  logDebug('moveParagraphsToNote', `Added ${selectedNumLines} lines to ${destNote.title ?? 'error'}: before ${beforeNumParasInDestNote} paras / after ${afterNumParasInDestNote} paras`)
  if (beforeNumParasInDestNote === afterNumParasInDestNote) {
    throw new Error(`Failed to add ${selectedNumLines} lines to ${displayTitle(destNote)}, so will stop before removing the lines from ${displayTitle(sourceNote)}.\nThis is normally caused by spaces on the start/end of the heading.`)
  }

  // Remove paragraphs from source note
  logDebug('moveParagraphsToNote', `Removing ${parasInBlock.length} paras from original note (which had ${String(origNumParas)} paras)`)
  sourceNote.removeParagraphs(parasInBlock)

  // Verify that paragraphs were removed
  if (sourceNote.paragraphs.length !== (origNumParas - parasInBlock.length)) {
    logWarn('moveParagraphsToNote', `WARNING: Delete has removed ${Number(origNumParas - sourceNote.paragraphs.length)} paragraphs`)
  }
}

/**
 * Move text to a different note, forcing treating this as a block.
 * See moveParas() for definition of selection logic.
 * @author @jgclark
 */
export async function moveParaBlock(): Promise<void> {
  await moveParas(true)
}

/**
 * Move text to a different note.
 * This is how we identify what we're moving (in priority order):
 * - current selection (if any)
 * - current heading + its following section (if 'withBlockContext' true)
 * - current line
 * - current line plus any paragraphs directly following, if 'withBlockContext' true).
 * NB: the Setting 'includeFromStartOfSection' decides whether these directly following paragraphs have to be indented (false) or can take all following lines at same level until next empty line as well.
 * @param {boolean?} withBlockContext?
 * @author @jgclark
 */
export async function moveParas(withBlockContext: boolean = false): Promise<void> {
  try {
    const { note, content, selectedParagraphs } = Editor
    if (content == null || selectedParagraphs == null || note == null) {
      // No note open, or no selectedParagraph selection (perhaps empty note), so don't do anything.
      logWarn(pluginJson, 'moveParas: No note open, so stopping.')
      return
    }

    const config = await getFilerSettings()
    const selectedParagraphsToUse = getSelectedParagraphsToUse()

    if (selectedParagraphsToUse.length === 0) {
      logWarn(pluginJson, 'moveParas: No selected paragraphs found.')
      return
    }

    logDebug('moveParas', `selectedParagraphsToUse:\n${selectedParagraphsToUse.map((p) => `- ${p.lineIndex}: ${p.content}`).join('\n')}`)
    const firstSelLineIndex = selectedParagraphsToUse[0].lineIndex
    const lastSelLineIndex = selectedParagraphsToUse[selectedParagraphsToUse.length - 1].lineIndex
    logDebug(pluginJson, `moveParas(): Starting with selected lineIndexes ${firstSelLineIndex}-${lastSelLineIndex}`)

    // Get paragraphs for the selection or block
    const parasInBlock = getParagraphsToMove(note, selectedParagraphsToUse, withBlockContext, config)

    if (parasInBlock.length === 0) {
      logWarn(pluginJson, 'moveParas: No paragraphs to move.')
      return
    }

    logDebug('moveParas', `- firstSelLine: {${selectedParagraphsToUse[0].content}}`)
    // Attempt to highlight them to help user check all is well
    highlightSelectionInEditor(parasInBlock)

    logDebug('moveParas', `parasInBlock:\n${parasInBlock.map((p) => `- ${p.lineIndex}: ${p.content}`).join('\n')}`)

    // Add date backlink if needed
    addDateBacklinkIfNeeded(parasInBlock, note, config)

    // Decide where to move to
    const destNote = await chooseNoteV2(`Select note to move ${(parasInBlock.length > 1) ? parasInBlock.length + ' lines' : 'current line'} to`, allRegularNotesSortedByChanged(), true, true, false, true)
    if (!destNote) {
      logWarn('moveParas', 'No note chosen. Stopping.')
      return
    }

    // Ask to which heading to add the selectedParas
    let headingToFind = await chooseHeadingV2(destNote, true, true, false)
    logDebug('moveParas', `Moving to note '${displayTitle(destNote)}' under heading: '${headingToFind}'`)
    if (headingToFind === '') {
      logWarn('moveParas', 'No heading chosen. Stopping.')
      return
    }

    // Handle trailing whitespace and normalize heading name
    // Special cases that don't need heading lookup
    if (headingToFind !== '<<top of note>>' && headingToFind !== '<<bottom of note>>') {
      // Try to find the heading (ignoring leading and trailing whitespace, but otherwise an exact match)
      const headingPara = findHeading(destNote, headingToFind, false)
      if (headingPara) {
        // Found the heading - use the actual heading content from the note (normalized)
        const actualHeadingContent = headingPara.content.trim()
        // If the actual heading has trailing whitespace, fix it in the note
        if (headingPara.content !== actualHeadingContent) {
          logWarn('moveParas', `Heading in note ('${headingPara.content}') has trailing whitespace. Removing it.`)
          headingPara.content = actualHeadingContent
          destNote.updateParagraph(headingPara)
        }
        // Use the normalized heading content
        headingToFind = actualHeadingContent
        logDebug('moveParas', `Normalized heading to: '${headingToFind}'`)
      } else {
        // Heading not found - warn user before proceeding
        const errorMsg = `Cannot find heading '${headingToFind}' in note '${displayTitle(destNote)}'. The move operation will be cancelled to prevent data loss.`
        logError('moveParas', errorMsg)
        await showMessage(errorMsg, 'OK', 'Filer: Heading Not Found')
        return
      }
    }

    // Move paragraphs to destination note
    moveParagraphsToNote(note, destNote, parasInBlock, headingToFind, config)

    // Unhighlight the previous selection, for safety's sake
    clearHighlighting()
  }
  catch (error) {
    logError('Filer/moveParas', error.message)
    await showMessage(error.message, 'OK', 'Filer: Error moving lines')
  }
}

/**
 * Move text to the current Weekly note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 */
export async function moveParasToThisWeekly(): Promise<void> {
  await moveParasToCalendarWeekly(new Date())
}

/**
 * Move text to next week's Weekly note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 */
export async function moveParasToNextWeekly(): Promise<void> {
  await moveParasToCalendarWeekly(Calendar.addUnitToDate(new Date(), 'day', 7)) // + 1 week
}

/**
 * Move text to a specified Weekly note.
 * (Not called directly by users.)
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 * @param {Date} date of weekly note to move to
 * @param {boolean?} withBlockContext?
 */
export async function moveParasToCalendarWeekly(destDate: Date, withBlockContext: boolean = false): Promise<void> {
  try {
    const { content, selectedParagraphs, note } = Editor

    // Pre-flight checks
    if (content == null || selectedParagraphs == null || note == null) {
      // No note open, or no selectedParagraph selection (empty note?), so don't do anything.
      logWarn(pluginJson, 'moveParasToCalendarWeekly(): No note open, so stopping.')
      return
    }
    logDebug(pluginJson, 'moveParasToCalendarWeekly(): Starting')

    // Get config settings
    const config = await getFilerSettings()
    const selectedParagraphsToUse = getSelectedParagraphsToUse()

    if (selectedParagraphsToUse.length === 0) {
      logWarn(pluginJson, 'moveParasToCalendarWeekly: No selected paragraphs found.')
      return
    }

    // Find the Weekly note to move to
    const destNote = DataStore.calendarNoteByDate(destDate, 'week')
    if (destNote == null) {
      await showMessage(`Sorry: I can't find the Weekly note for ${toNPLocaleDateString(destDate)}.`)
      logError('moveParasToCalendarWeekly', `Failed to open the Weekly note for ${toNPLocaleDateString(destDate)}. Stopping.`)
      return
    }

    const firstSelLineIndex = selectedParagraphsToUse[0].lineIndex
    const lastSelLineIndex = selectedParagraphsToUse[selectedParagraphsToUse.length - 1].lineIndex

    // Get paragraphs for the selection or block
    const parasInBlock = getParagraphsToMove(note, selectedParagraphsToUse, withBlockContext, config)

    if (parasInBlock.length === 0) {
      logWarn(pluginJson, 'moveParasToCalendarWeekly: No paragraphs to move.')
      return
    }

    // Highlight if we expanded to a block (not a user selection)
    if (lastSelLineIndex === firstSelLineIndex) {
      // $FlowIgnore[incompatible-call] just a readonly array issue
      highlightSelectionInEditor(parasInBlock)
    }

    // Add date backlink if needed
    addDateBacklinkIfNeeded(parasInBlock, note, config)

    // Move paragraphs to destination note (empty heading for calendar notes)
    moveParagraphsToNote(note, destNote, parasInBlock, '', config)

    // Clear highlighting
    clearHighlighting()
  }
  catch (error) {
    logError('Filer/moveParasToCalendarWeekly', error.message)
    await showMessage(error.message, 'OK', 'Filer: Error moving lines to calendar date')
  }
}

// -----------------------------------------------------------------

/**
 * Move text to today's Daily note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 */
export async function moveParasToToday(): Promise<void> {
  await moveParasToCalendarDate(new Date()) // today
}

/**
 * Move text to tomorrow's Daily note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 */
export async function moveParasToTomorrow(): Promise<void> {
  await moveParasToCalendarDate(Calendar.addUnitToDate(new Date(), 'day', 1)) // tomorrow
}

/**
 * Move text to a specified Daily note.
 * (Not called directly by users.)
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 * @param {Date} date of daily note to move to
 * @param {boolean?} withBlockContext?
 */
export async function moveParasToCalendarDate(destDate: Date, withBlockContext: boolean = false): Promise<void> {
  try {
    const { content, selectedParagraphs, note } = Editor

    // Pre-flight checks
    if (content == null || selectedParagraphs == null || note == null) {
      // No note open, or no selectedParagraph selection (perhaps empty note), so don't do anything.
      logWarn(pluginJson, 'moveParasToCalendarDate(): No note open, so stopping.')
      return
    }

    // Get config settings
    const config = await getFilerSettings()
    const selectedParagraphsToUse = getSelectedParagraphsToUse()

    if (selectedParagraphsToUse.length === 0) {
      logWarn(pluginJson, 'moveParasToCalendarDate: No selected paragraphs found.')
      return
    }

    // Find the Daily note to move to
    const destNote = DataStore.calendarNoteByDate(destDate, 'day')
    if (destNote == null) {
      await showMessage(`Sorry: I can't find the Daily note for ${toNPLocaleDateString(destDate)}.`)
      logError('moveParasToCalendarDate', `Failed to open the Daily note for ${toNPLocaleDateString(destDate)}. Stopping.`)
      return
    }

    const firstSelLineIndex = selectedParagraphsToUse[0].lineIndex
    const lastSelLineIndex = selectedParagraphsToUse[selectedParagraphsToUse.length - 1].lineIndex

    // Get paragraphs for the selection or block
    const parasInBlock = getParagraphsToMove(note, selectedParagraphsToUse, withBlockContext, config)

    if (parasInBlock.length === 0) {
      logWarn(pluginJson, 'moveParasToCalendarDate: No paragraphs to move.')
      return
    }

    // Highlight if we expanded to a block (not a user selection)
    if (lastSelLineIndex === firstSelLineIndex) {
      // $FlowIgnore[incompatible-call] just a readonly array issue
      highlightSelectionInEditor(parasInBlock)
    }

    // Add date backlink if needed
    addDateBacklinkIfNeeded(parasInBlock, note, config)

    // Move paragraphs to destination note (empty heading for calendar notes)
    moveParagraphsToNote(note, destNote, parasInBlock, '', config)

    // Unhighlight the previous selection, for safety's sake
    clearHighlighting()
  }
  catch (error) {
    logError('Filer/moveParasToCalendarDate', error.message)
    await showMessage(error.message, 'OK', 'Filer: Error moving lines to calendar date')
  }
}
