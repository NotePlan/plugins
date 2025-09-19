/* eslint-disable prefer-template */
// @flow
// ----------------------------------------------------------------------------
// Plugin to help move selected Paragraphs to other notes
// Jonathan Clark
// last updated 2025-09-06, for v1.3.2
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { getFilerSettings, highlightSelectionInEditor } from './filerHelpers'
import { hyphenatedDate, toLocaleDateTimeString } from '@helpers/dateTime'
import { toNPLocaleDateString } from '@helpers/NPdateTime'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { allRegularNotesSortedByChanged } from '@helpers/note'
import { addParagraphsToNote, findHeading, parasToText, smartAppendPara, smartPrependPara } from '@helpers/paragraph'
import { chooseNoteV2 } from '@helpers/NPnote'
import { getParagraphBlock, selectedLinesIndex } from '@helpers/NPParagraph'
import { chooseHeadingV2, showMessage, } from '@helpers/userInput'

// const pluginID = pluginJson['plugin.id']

//-----------------------------------------------------------------------------

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
 * NB: the Setting 'includeFromStartOfSection' decides whether these directly following paragaphs have to be indented (false) or can take all following lines at same level until next empty line as well.
 * @param {boolean?} withBlockContext?
 * @author @jgclark
 */
export async function moveParas(withBlockContext: boolean = false): Promise<void> {
  try {
    const { note, content, selection, selectedParagraphs } = Editor
    if (content == null || selectedParagraphs == null || note == null) {
      // No note open, or no selectedParagraph selection (perhaps empty note), so don't do anything.
      logWarn(pluginJson, 'moveParas: No note open, so stopping.')
      return
    }
    // Get current selection, and its range
    if (selection == null) {
      // Really a belt-and-braces check that the editor is active
      logError(pluginJson, 'moveParas: No selection found, so stopping.')
      return
    }
    const config = await getFilerSettings()
    // const origNumParas = note.paragraphs.length
    const origNumParas = Editor.paragraphs.length

    // v1: use Editor.selection. However, we found an issue with this and frontmatter.
    // v2: use Editor.selectedParagraphs instead
    const firstSelLineIndex = selectedParagraphs[0].lineIndex
    const lastSelLineIndex = selectedParagraphs[selectedParagraphs.length - 1].lineIndex
    logDebug(pluginJson, `moveParas(): Starting with selected lineIndexes ${firstSelLineIndex}-${lastSelLineIndex}`)

    // Get paragraphs for the selectionToUse or block
    // let firstStartCharIndex = 0
    let parasInBlock: Array<TParagraph>
    if (lastSelLineIndex !== firstSelLineIndex) {
      // use only the selected paras
      logDebug('moveParas', `moveParas: user has selected lineIndexes ${firstSelLineIndex}-${lastSelLineIndex}`)
      parasInBlock = selectedParagraphs.slice() // copy to avoid $ReadOnlyArray problem
    } else {
      // there is no user selection
      // now see whether user wants to work on the surrounding block or not
      if (withBlockContext) {
        // user has requested working on the surrounding block
        parasInBlock = getParagraphBlock(note, firstSelLineIndex, config.includeFromStartOfSection, config.useTightBlockDefinition)
        logDebug('moveParas', `moveParas: move block of ${parasInBlock.length} paras`)
      } else {
        // user just wants to move the current line
        parasInBlock = selectedParagraphs.slice(0, 1) // just first para
        logDebug('moveParas', `moveParas: move current para only. lineIndex ${firstSelLineIndex}`)
      }

      // Attempt to highlight them to help user check all is well
      // $FlowIgnore[incompatible-call] just a readonly array issue
      highlightSelectionInEditor(parasInBlock)
    }

    // If this is a calendar note we've moving from, and the user wants to
    // create a date backlink, then append backlink to the first selectedPara in parasInBlock
    if (config.addDateBacklink && note.type === 'Calendar') {
      const datePart: string =
        (config.dateRefStyle === 'link') ? ` >${hyphenatedDate(new Date())}`
          : (config.dateRefStyle === 'at') ? ` @${hyphenatedDate(new Date())}`
            : (config.dateRefStyle === 'date') ? ` (${toLocaleDateTimeString(new Date())})`
              : ''
      parasInBlock[0].content = `${parasInBlock[0].content} ${datePart}`
    }
    // Note: There is no API function to deal with multiple selectedParagraphs, but we can insert a raw text string.
    // (can't simply use note.addParagraphBelowHeadingTitle() as we have more options than it supports)

    const selectedNumLines = parasInBlock.length

    // Decide where to move to
    // Ask for the note we want to add the selectedParas
    // V1
    // const allNotes = allNotesSortedByChanged()
    // const res = await CommandBar.showOptions(
    //   allNotes.map((n) => n.title ?? 'untitled'),
    //   `Select note to move ${(parasInBlock.length > 1) ? parasInBlock.length + ' lines' : 'current line'} to`,
    // )
    // const destNote = allNotes[res.index]
    // Note: showOptions returns the first item if something else is typed. And I can't see a way to distinguish between the two.
    // V2
    const destNote = await chooseNoteV2(`Select note to move ${(parasInBlock.length > 1) ? parasInBlock.length + ' lines' : 'current line'} to`, allRegularNotesSortedByChanged(), true, true, false, true)
    if (!destNote) {
      logWarn('addIDAndAddToOtherNote', `- No note chosen. Stopping.`)
      return
    }

    // Ask to which heading to add the selectedParas
    let headingToFind = await chooseHeadingV2(destNote, true, true, false)
    logDebug('moveParas', `- Moving to note '${displayTitle(destNote)}' under heading: '${headingToFind}'`)
    if (headingToFind === '<<top of note>>') {
      // add to top of note
      smartPrependPara(destNote, parasToText(parasInBlock), 'text')
    } else if (headingToFind === '<<bottom of note>>') {
      // add to bottom of note
      smartAppendPara(destNote, parasToText(parasInBlock), 'text')
    } else {
      if (/\s$/.test(headingToFind)) {
        logWarn('moveParas', `Heading to move to ('${headingToFind}') has trailing whitespace. Will pre-emptively remove them to try to avoid problems.`)
        const headingPara = findHeading(destNote, headingToFind)
        if (headingPara) {
          headingPara.content = headingPara.content.trim()
          destNote.updateParagraph(headingPara)
          logDebug('moveParas', `- now headingPara in destNote is '${headingPara.content}'`)
          headingToFind = headingPara.content
        }
      }
    }

    // Add text to the new location in destination note
    const beforeNumParasInDestNote = destNote.paragraphs.length
    addParagraphsToNote(destNote, parasInBlock, headingToFind, config.whereToAddInSection, config.allowNotePreambleBeforeHeading)

    // Now check that the right number of paras have been added
    const afterNumParasInDestNote = destNote.paragraphs.length
    logDebug('moveParas', `Added ${selectedNumLines} lines to ${destNote.title ?? 'error'}: before ${beforeNumParasInDestNote} paras / after ${afterNumParasInDestNote} paras`)
    if (beforeNumParasInDestNote === afterNumParasInDestNote) {
      throw new Error(`Failed to add ${selectedNumLines} lines to ${displayTitle(destNote)}, so will stop before removing the lines from ${displayTitle(note)}.\nThis is normally caused by spaces on the start/end of the heading.`)
    }

    // delete from existing location
    logDebug('moveParas', `- Removing ${parasInBlock.length} paras from original note (which had ${String(origNumParas)} paras)`)
    note.removeParagraphs(parasInBlock)
    // double-check that the paras have been removed
    if (note.paragraphs.length !== (origNumParas - parasInBlock.length)) {
      logWarn('moveParas', `- WARNING: Delete has removed ${Number(origNumParas - note.paragraphs.length)} paragraphs`)
    }

    // unhighlight the previous selection, for safety's sake
    const emptyRange: TRange = Range.create(0, 0)
    Editor.highlightByRange(emptyRange)
  }
  catch (error) {
    logError('Filer/moveParas', error.message)
    const res = await showMessage(error.message, 'OK', 'Filer: Error moving lines')
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
 * Move text to the current Weekly note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 */
export async function moveParasToNextWeekly(): Promise<void> {
  await moveParasToCalendarWeekly(Calendar.addUnitToDate(new Date(), 'day', 7)) // + 1 week
}

/**
 * Move text to the current Weekly note.
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
    const origNote = note
    // const paragraphs = origNote.paragraphs
    const origNumParas = origNote.paragraphs.length

    // Find the Weekly note to move to
    const destNote = DataStore.calendarNoteByDate(destDate, 'week')
    if (destNote == null) {
      await showMessage(`Sorry: I can't find the Weekly note for ${toNPLocaleDateString(destDate)}.`)
      logError('moveParasToCalendarWeekly', `Failed to open the Weekly note for ${toNPLocaleDateString(destDate)}. Stopping.`)
      return
    }

    // Get current selection, and its range
    // v1: use Editor.selection. However, we found an issue with this and frontmatter.
    // v2: use Editor.selectedParagraphs instead
    const firstSelLineIndex = selectedParagraphs[0].lineIndex
    const lastSelLineIndex = selectedParagraphs[selectedParagraphs.length - 1].lineIndex

    // Get paragraphs for the selectionToUse or block
    // let firstStartCharIndex = 0
    let parasInBlock: Array<TParagraph>
    if (lastSelLineIndex !== firstSelLineIndex) {
      // use only the selected paras
      logDebug('moveParasToCalendarWeekly', `moveParas: user has selected lineIndexes ${firstSelLineIndex}-${lastSelLineIndex}`)
      parasInBlock = selectedParagraphs.slice() // copy to avoid $ReadOnlyArray problem
    } else {
      // there is no user selection
      // now see whether user wants to work on the surrounding block or not
      if (withBlockContext) {
        // user has requested working on the surrounding block
        parasInBlock = getParagraphBlock(note, firstSelLineIndex, config.includeFromStartOfSection, config.useTightBlockDefinition)
        logDebug('moveParasToCalendarWeekly', `moveParas: move block of ${parasInBlock.length} paras`)
      } else {
        // user just wants to move the current line
        parasInBlock = selectedParagraphs.slice(0, 1) // just first para
        logDebug('moveParasToCalendarWeekly', `moveParas: move current para only. lineIndex ${firstSelLineIndex}`)
      }

      // Attempt to highlight them to help user check all is well
      // $FlowIgnore[incompatible-call] just a readonly array issue
      highlightSelectionInEditor(parasInBlock)
    }
    const selectedNumLines = parasInBlock.length

    // Append text to the new location in destination note
    const beforeNumParasInDestNote = destNote.paragraphs.length
    addParagraphsToNote(destNote, parasInBlock, '', config.whereToAddInSection, config.allowNotePreambleBeforeHeading)

    // Now check that the right number of paras have been added
    const afterNumParasInDestNote = destNote.paragraphs.length
    logDebug('moveParasToCalendarWeekly', `Added ${selectedNumLines} lines to ${destNote.title ?? 'error'}: before ${beforeNumParasInDestNote} paras / after ${afterNumParasInDestNote} paras`)
    if (beforeNumParasInDestNote === afterNumParasInDestNote) {
      throw new Error(`Failed to add ${selectedNumLines} lines to ${displayTitle(destNote)}, so will stop before removing the lines from ${displayTitle(note)}.\nThis is normally caused by spaces on the start/end of the heading.`)
    }

    // delete from existing location
    logDebug('moveParasToCalendarWeekly', `- Removing ${parasInBlock.length} paras from original note (which had ${String(origNumParas)} paras)`)
    origNote.removeParagraphs(parasInBlock)
    // double-check that the paras have been removed
    if (note.paragraphs.length !== (origNumParas - parasInBlock.length)) {
      logWarn('moveParasToCalendarWeekly', `- WARNING: Delete has removed ${Number(origNumParas - note.paragraphs.length)} paragraphs`)
    }

    // unhighlight the previous selection, for safety's sake
    const emptyRange: TRange = Range.create(0, 0)
    Editor.highlightByRange(emptyRange)
  }
  catch (error) {
    logError('Filer/moveParasToCalendarWeekly', error.message)
    const res = await showMessage(error.message, 'OK', 'Filer: Error moving lines to calendar date')
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
  await moveParasToCalendarDate(Calendar.addUnitToDate(new Date(), 'day', 1))// tomorrow
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
      logError(pluginJson, 'No note open, so stopping.')
      return
    }
    logDebug(pluginJson, 'moveParasToCalendarDate(): Starting')

    // Get config settings
    const config = await getFilerSettings()
    const origNote = note
    const paragraphs = origNote.paragraphs
    const origNumParas = origNote.paragraphs.length

    // Find the Daily note to move to
    const destNote = DataStore.calendarNoteByDate(destDate, 'day')
    if (destNote == null) {
      await showMessage(`Sorry: I can't find the Daily note for ${toNPLocaleDateString(destDate)}.`)
      throw new Error(`Failed to open the Daily note for ${toNPLocaleDateString(destDate)}. Stopping.`)
    }

    // Get current selection, and its range
    const selection = Editor.selection
    if (selection == null) {
      throw new Error('No selection found, so stopping.')
    }
    // Get paragraph indexes for the start and end of the selection (can be the same)
    const [firstSelParaIndex, _lastSelParaIndex] = selectedLinesIndex(selection, paragraphs)

    // Get paragraphs for the selection or block
    let firstStartIndex = 0
    let parasInBlock: Array<TParagraph>
    if (withBlockContext) {
      // user has requested working on the surrounding block
      parasInBlock = getParagraphBlock(origNote, firstSelParaIndex, config.includeFromStartOfSection, config.useTightBlockDefinition)
      logDebug('moveParasToCalendarDate', `moveParas: move block of ${parasInBlock.length} paras`)
    } else {
      // user just wants to move the current line
      parasInBlock = selectedParagraphs.slice(0, 1) // just first para
      logDebug('moveParasToCalendarDate', `moveParas: move current para only`)
    }

    // Now attempt to highlight them to help user check all is well (but only works from v3.6.2, build 844)
    if (NotePlan.environment.buildVersion > 844) {
      firstStartIndex = parasInBlock[0].contentRange?.start ?? NaN
      const lastEndIndex = parasInBlock[parasInBlock.length - 1].contentRange?.end ?? null
      if (firstStartIndex && lastEndIndex) {
        const parasCharIndexRange: TRange = Range.create(firstStartIndex, lastEndIndex)
        // logDebug('moveParasToCalendarDate', `- will try to highlight automatic block selection range ${rangeToString(parasCharIndexRange)}`)
        Editor.highlightByRange(parasCharIndexRange)
      }
    }
    const selectedNumLines = parasInBlock.length

    // Append text to the new location in destination note
    const beforeNumParasInDestNote = destNote.paragraphs.length
    addParagraphsToNote(destNote, parasInBlock, '', config.whereToAddInSection, config.allowNotePreambleBeforeHeading)

    // Now check that the right number of paras have been added
    const afterNumParasInDestNote = destNote.paragraphs.length
    logDebug('moveParasToCalendarDate', `Added ${selectedNumLines} lines to ${destNote.title ?? 'error'}: before ${beforeNumParasInDestNote} paras / after ${afterNumParasInDestNote} paras`)
    if (beforeNumParasInDestNote === afterNumParasInDestNote) {
      throw new Error(`Failed to add ${selectedNumLines} lines to ${displayTitle(destNote)}, so will stop before removing the lines from ${displayTitle(note)}.\nThis is normally caused by spaces on the start/end of the heading.`)
    }

    // delete from existing location
    logDebug('moveParasToCalendarDate', `- Removing ${parasInBlock.length} paras from original origNote (which had ${String(origNumParas)} paras)`)
    origNote.removeParagraphs(parasInBlock)
    // double-check that the paras have been removed
    if (note.paragraphs.length !== (origNumParas - parasInBlock.length)) {
      logWarn('moveParasToCalendarDate', `- WARNING: Delete has removed ${Number(origNumParas - note.paragraphs.length)} paragraphs`)
    }

    // unhighlight the previous selection, for safety's sake
    const emptyRange: TRange = Range.create(firstStartIndex ?? 0, firstStartIndex ?? 0)
    Editor.highlightByRange(emptyRange)
  }
  catch (error) {
    logError('Filer/moveParasToCalendarDate', error.message)
    const res = await showMessage(error.message, 'OK', 'Filer: Error moving lines to calendar date')
  }
}
