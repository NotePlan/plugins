/* eslint-disable prefer-template */
// @flow
// ----------------------------------------------------------------------------
// Plugin to help move selected Paragraphs to other notes
// Jonathan Clark
// last updated 2026-11-13, for v1.7.0 by @CursorAI
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { applyFilerJsonSettings, getFilerSettings, reportFiler, resolveNoteArgument } from './filerHelpers'
import { getParagraphBlock } from '@helpers/blocks'
import { formatNoteDateFromNPDateStr, getDateStringFromCalendarFilename, todaysDateISOString } from '@helpers/dateTime'
import { toNPLocaleDateString } from '@helpers/NPdateTime'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { allRegularNotesSortedByChanged } from '@helpers/note'
import { endOfFrontmatterLineIndex } from '@helpers/NPFrontMatter'
import { addParagraphsToNote, findHeading } from '@helpers/paragraph'
import { clearHighlighting, getNoteFromEditorWindow, getSelectedParagraphsToUse, highlightSelectionInEditor } from '@helpers/NPEditor'
import { prepareEmbeddedMediaMove, removeSourceEmbeddedMediaIfUnused } from '@helpers/NPEmbeddedMedia'
import { chooseNoteV2 } from '@helpers/NPnote'
import { chooseHeadingV2, showMessageYesNo } from '@helpers/userInput'

const TITLE_MOVE_LOOSE_MESSAGE = 'Moving the block that starts with the title line will empty the whole note. Do you wish to continue?'
const TITLE_MOVE_TIGHT_MESSAGE = 'Moving the block (starting with the title line until the next blank line or H1 heading) will change the title of the note as well. Do you wish to continue?'

//-----------------------------------------------------------------------------
// Private helper functions

/**
 * Get the paragraphs to move based on selection and context.
 * @param {CoreNoteFields} note - The note containing the paragraphs
 * @param {Array<TParagraph>} selectedParagraphsToUse - The selected paragraphs
 * @param {boolean} withBlockContext - Whether to include surrounding block
 * @param {Object} config - Configuration settings
 * @returns {Array<TParagraph>} Paragraphs to move
 */
function getParagraphsToMove(
  note: CoreNoteFields,
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
 * Date backlink suffix to append on the *destination* copy when moving from a calendar note.
 * Returns '' when not applicable. Does not mutate source paragraphs -- mutating
 * TParagraph.content before removeParagraphs causes NotePlan to delete 0 lines.
 * Uses the source note's calendar date (if available) so the backlink refers to the origin calendar note, not "today".
 * @param {CoreNoteFields} note - Source note
 * @param {Object} config - Configuration settings
 * @returns {string} Suffix including leading space (e.g. ' >2026-10-26'), or ''
 */
function getDateBacklinkSuffix(note: CoreNoteFields, config: any): string {
  if (config.addDateBacklink && note.type === 'Calendar') {
    // Prefer the calendar note's own date, but fall back to today if it's missing
    const sourceCalDateStr: string = note.filename != null ? getDateStringFromCalendarFilename(note.filename, true) : todaysDateISOString
    const datePart: string = formatNoteDateFromNPDateStr(sourceCalDateStr, config.dateRefStyle)
    logInfo('getDateBacklinkSuffix', `Will add date backlink: ${datePart} in style: ${config.dateRefStyle}`)
    return ` ${datePart}`
  }
  return ''
}

/**
 * Line index of the note's H1 title, after any frontmatter. -1 when the note has no title line.
 * @param {CoreNoteFields} note
 * @returns {number}
 */
function noteTitleLineIndex(note: CoreNoteFields): number {
  const paras = note.paragraphs
  if (paras.length === 0) return -1
  const endOfFMIndex = endOfFrontmatterLineIndex(note) || 0
  const titleIndex = endOfFMIndex === 0 ? 0 : endOfFMIndex + 1
  if (titleIndex >= paras.length) return -1
  const titlePara = paras[titleIndex]
  if (titlePara.type === 'title' && (titlePara.headingLevel ?? 1) === 1) return titleIndex
  return -1
}

/**
 * Ask before a block move that includes the note title. Yes means continue.
 * The question depends on whether a block stops at the next blank line.
 * @param {CoreNoteFields} note
 * @param {Array<TParagraph>} parasInBlock
 * @param {boolean} useTightBlockDefinition
 * @param {string} logName
 * @returns {Promise<boolean>}
 */
async function confirmTitleLineMove(note: CoreNoteFields, parasInBlock: Array<TParagraph>, useTightBlockDefinition: boolean, logName: string): Promise<boolean> {
  const titleIndex = noteTitleLineIndex(note)
  if (titleIndex < 0 || !parasInBlock.some((p) => p.lineIndex === titleIndex)) return true
  const message = useTightBlockDefinition ? TITLE_MOVE_TIGHT_MESSAGE : TITLE_MOVE_LOOSE_MESSAGE
  const choice = await showMessageYesNo(message, ['Yes', 'No'], 'Filer: Move block')
  if (choice !== 'Yes') {
    logInfo(pluginJson, `${logName}: user declined to move the note title.`)
    return false
  }
  return true
}

/**
 * Move paragraphs from source note to destination note.
 * @param {CoreNoteFields} sourceNote - Note to move paragraphs from
 * @param {TNote} destNote - Note to move paragraphs to
 * @param {Array<TParagraph>} parasInBlock - Paragraphs to move (left unmodified so removeParagraphs can match them)
 * @param {string} headingToFind - Heading to add paragraphs under (empty string for calendar notes)
 * @param {Object} config - Configuration settings
 * @param {string} dateBacklinkSuffix - Optional suffix for first destination line (from getDateBacklinkSuffix)
 * @throws {Error} If paragraphs fail to be added
 */
function moveParagraphsToNote(
  sourceNote: CoreNoteFields,
  destNote: TNote,
  parasInBlock: Array<TParagraph>,
  headingToFind: string,
  config: any,
  dateBacklinkSuffix: string = '',
): void {
  const selectedNumLines = parasInBlock.length
  const beforeNumParasInDestNote = destNote.paragraphs.length
  const origNumParas = sourceNote.paragraphs.length

  // Copy embedded images/files into the destination note's attachment folder and
  // rewrite those links in the inserted text only (source paras stay intact).
  const embeddedMove = prepareEmbeddedMediaMove(sourceNote, destNote, parasInBlock)

  // Add paragraphs to destination note (suffix applied to insert text only; source paras stay intact)
  addParagraphsToNote(
    destNote,
    parasInBlock,
    headingToFind,
    config.whereToAddInSection,
    config.allowNotePreambleBeforeHeading,
    dateBacklinkSuffix,
    null,
    embeddedMove ? embeddedMove.rewrite : null,
  )

  // Verify that paragraphs were added
  const afterNumParasInDestNote = destNote.paragraphs.length
  logDebug('moveParagraphsToNote', `Added ${selectedNumLines} lines to ${destNote.title ?? 'error'}: before ${beforeNumParasInDestNote} paras / after ${afterNumParasInDestNote} paras`)
  if (beforeNumParasInDestNote === afterNumParasInDestNote) {
    throw new Error(`Failed to add ${selectedNumLines} lines to ${displayTitle(destNote)}, so will stop before removing the lines from ${displayTitle(sourceNote)}.\nThis is normally caused by spaces on the start/end of the heading.`)
  }

  // Remove paragraphs from source note
  logDebug('moveParagraphsToNote', `Removing ${parasInBlock.length} paras from original note (which had ${String(origNumParas)} paras)`)
  sourceNote.removeParagraphs(parasInBlock)
  if (embeddedMove) removeSourceEmbeddedMediaIfUnused(sourceNote, embeddedMove.copied)

  // Verify that paragraphs were removed
  if (sourceNote.paragraphs.length !== (origNumParas - parasInBlock.length)) {
    logWarn('moveParagraphsToNote', `WARNING: Delete has removed ${Number(origNumParas - sourceNote.paragraphs.length)} paragraphs`)
  }
}

/**
 * Move text to a different note, forcing treating this as a block.
 * See moveParas() for definition of selection logic.
 * From an x-callback, arg0 is the destination note and arg1 is the heading. No dialogs in that case.
 * @param {string?} destNoteArg - filename, title, or date phrase
 * @param {string?} headingArg - heading, `<<top of note>>`, or `<<bottom of note>>`
 * @author @jgclark
 */
export async function moveParaBlock(destNoteArg?: string, headingArg?: string): Promise<void> {
  await moveParasToNoteCommand(true, destNoteArg, headingArg, arguments.length)
}

/**
 * Move text to a different note.
 * This is how we identify what we're moving (in priority order):
 * - current selection (if any)
 * - current heading + its following section (if 'withBlockContext' true)
 * - current line
 * - current line plus any paragraphs directly following, if 'withBlockContext' true).
 * NB: the Setting 'includeFromStartOfSection' decides whether these directly following paragraphs have to be indented (false) or can take all following lines at same level until next empty line as well.
 * From an x-callback, arg0 is the destination note and arg1 is the heading. With no arguments, the command bar asks for both.
 * @param {string?} destNoteArg - filename, title, or date phrase
 * @param {string?} headingArg - heading, `<<top of note>>`, or `<<bottom of note>>`
 * @author @jgclark
 */
export async function moveParas(destNoteArg?: string, headingArg?: string): Promise<void> {
  await moveParasToNoteCommand(false, destNoteArg, headingArg, arguments.length)
}

/**
 * Shared mover for /move paragraph and /move paragraph block.
 * A string destNoteArg means the call came from an x-callback or template, so do not prompt.
 * @param {boolean} withBlockContext
 * @param {?string} destNoteArg
 * @param {?string} headingArg
 * @param {number} argCount - arguments.length from the command entry point
 */
async function moveParasToNoteCommand(withBlockContext: boolean, destNoteArg: ?string, headingArg: ?string, argCount: number): Promise<void> {
  const logName = withBlockContext ? 'Filer/moveParaBlock' : 'Filer/moveParas'
  // A string first argument (including '') is an x-callback. The command bar passes no arguments.
  const fromXCallback = typeof destNoteArg === 'string'
  try {
    const { content, selectedParagraphs } = Editor
    const note = getNoteFromEditorWindow(Editor)
    if (content == null || selectedParagraphs == null || note == null) {
      // No note open, or no selectedParagraph selection (perhaps empty note), so don't do anything.
      logWarn(pluginJson, `${logName}: No note open, so stopping.`)
      if (fromXCallback) logInfo(pluginJson, `${logName}(): no note open, so stopping.`)
      return
    }

    const config = await getFilerSettings(!fromXCallback)
    if (!config) return
    const selectedParagraphsToUse = getSelectedParagraphsToUse()

    if (selectedParagraphsToUse.length === 0) {
      logWarn(pluginJson, `${logName}: No selected paragraphs found.`)
      if (fromXCallback) logInfo(pluginJson, `${logName}(): no selected paragraphs, so stopping.`)
      return
    }

    logDebug(logName, `selectedParagraphsToUse:\n${selectedParagraphsToUse.map((p) => `- ${p.lineIndex}: ${p.content}`).join('\n')}`)
    const firstSelLineIndex = selectedParagraphsToUse[0].lineIndex
    const lastSelLineIndex = selectedParagraphsToUse[selectedParagraphsToUse.length - 1].lineIndex
    logDebug(pluginJson, `${logName}(): Starting with selected lineIndexes ${firstSelLineIndex}-${lastSelLineIndex}`)

    // Get paragraphs for the selection or block
    const parasInBlock = getParagraphsToMove(note, selectedParagraphsToUse, withBlockContext, config)

    if (parasInBlock.length === 0) {
      logWarn(pluginJson, `${logName}: No paragraphs to move.`)
      if (fromXCallback) logInfo(pluginJson, `${logName}(): no paragraphs to move, so stopping.`)
      return
    }

    if (withBlockContext && !(await confirmTitleLineMove(note, parasInBlock, config.useTightBlockDefinition, logName))) return

    logDebug(logName, `- firstSelLine: {${selectedParagraphsToUse[0].content}}`)
    // Attempt to highlight them to help user check all is well
    highlightSelectionInEditor(parasInBlock)

    logDebug(logName, `parasInBlock:\n${parasInBlock.map((p) => `- ${p.lineIndex}: ${p.content}`).join('\n')}`)

    // Date backlink for destination copy only (do not mutate source paras)
    const dateBacklinkSuffix = getDateBacklinkSuffix(note, config)

    // Decide where to move to. x-callback supplies the note and heading; the command bar asks.
    let destNote: TNote
    let headingToFind = ''
    if (fromXCallback) {
      const destName = (destNoteArg || '').trim()
      logInfo(pluginJson, `${logName}(): x-callback dest '${destName}' heading '${headingArg ?? ''}'`)
      if (destName === '') {
        logError(logName, 'No destination note given, so stopping.')
        return
      }
      if (argCount < 2 || headingArg == null || headingArg.trim() === '') {
        logError(logName, 'No heading given, so stopping. Use a heading name, <<top of note>>, or <<bottom of note>>.')
        return
      }
      const resolved = resolveNoteArgument(destName)
      if (!resolved) {
        logError(logName, `Could not find note '${destName}', so stopping.`)
        return
      }
      destNote = (resolved: any)
      headingToFind = headingArg.trim()
    } else {
      const chosen = await chooseNoteV2(`Select note to move ${(parasInBlock.length > 1) ? parasInBlock.length + ' lines' : 'current line'} to`, allRegularNotesSortedByChanged(), true, true, false, true)
      if (!chosen) {
        logWarn(logName, 'No note chosen. Stopping.')
        return
      }
      destNote = chosen
      // Ask to which heading to add the selectedParas
      headingToFind = await chooseHeadingV2(destNote, true, true, false)
    }
    logDebug(logName, `Moving to note '${displayTitle(destNote)}' under heading: '${headingToFind}'`)
    if (headingToFind === '') {
      logWarn(logName, 'No heading chosen. Stopping.')
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
          logWarn(logName, `Heading in note ('${headingPara.content}') has trailing whitespace. Removing it.`)
          headingPara.content = actualHeadingContent
          destNote.updateParagraph(headingPara)
        }
        // Use the normalized heading content
        headingToFind = actualHeadingContent
        logDebug(logName, `Normalized heading to: '${headingToFind}'`)
      } else {
        // Heading not found - warn user before proceeding
        const errorMsg = `Cannot find heading '${headingToFind}' in note '${displayTitle(destNote)}'. The move operation will be cancelled to prevent data loss.`
        logError(logName, errorMsg)
        await reportFiler(!fromXCallback, errorMsg, 'Filer: Heading Not Found')
        return
      }
    }

    // Move paragraphs to destination note
    moveParagraphsToNote(note, destNote, parasInBlock, headingToFind, config, dateBacklinkSuffix)
    logInfo(logName, `Moved ${String(parasInBlock.length)} lines to '${displayTitle(destNote)}' under '${headingToFind}'`)

    // Unhighlight the previous selection, for safety's sake
    clearHighlighting()
  }
  catch (error) {
    logError(logName, error.message)
    await reportFiler(!fromXCallback, error.message, 'Error moving lines')
  }
}

/**
 * Move text to the current Weekly note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 */
export async function moveParasToThisWeekly(params?: string): Promise<void> {
  await runQuickMove(params, new Date(), 'week', 'Weekly', 'moveParasToThisWeekly')
}

/**
 * Move text to next week's Weekly note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 */
export async function moveParasToNextWeekly(params?: string): Promise<void> {
  await runQuickMove(params, Calendar.addUnitToDate(new Date(), 'day', 7), 'week', 'Weekly', 'moveParasToNextWeekly') // + 1 week
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
  await moveParasToCalendarPeriod(destDate, 'week', 'Weekly', 'moveParasToCalendarWeekly', withBlockContext)
}

/**
 * Move text to the current Monthly note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 */
export async function moveParasToThisMonthly(params?: string): Promise<void> {
  await runQuickMove(params, new Date(), 'month', 'Monthly', 'moveParasToThisMonthly')
}

/**
 * Move text to next month's Monthly note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 */
export async function moveParasToNextMonthly(params?: string): Promise<void> {
  await runQuickMove(params, Calendar.addUnitToDate(new Date(), 'month', 1), 'month', 'Monthly', 'moveParasToNextMonthly')
}

/**
 * Move text to the current Quarterly note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 */
export async function moveParasToThisQuarterly(params?: string): Promise<void> {
  await runQuickMove(params, new Date(), 'quarter', 'Quarterly', 'moveParasToThisQuarterly')
}

/**
 * Move text to next quarter's Quarterly note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 */
export async function moveParasToNextQuarterly(params?: string): Promise<void> {
  await runQuickMove(params, Calendar.addUnitToDate(new Date(), 'month', 3), 'quarter', 'Quarterly', 'moveParasToNextQuarterly')
}

/**
 * Move text to a calendar note for a date and period.
 * (Not called directly by users.)
 * Uses the same selection strategy as moveParas() above.
 * @param {Date} destDate
 * @param {string} period - 'day', 'week', 'month', or 'quarter'
 * @param {string} periodLabel - used in the message when the note cannot be opened
 * @param {string} logName
 * @param {boolean} withBlockContext
 * @param {?any} configIn - already loaded settings; loaded here when omitted
 * @param {boolean} interactive - when false, log instead of showing a dialog
 */
async function moveParasToCalendarPeriod(
  destDate: Date,
  period: string,
  periodLabel: string,
  logName: string,
  withBlockContext: boolean = false,
  configIn: ?any = null,
  interactive: boolean = true,
): Promise<void> {
  try {
    const { content, selectedParagraphs } = Editor
    const note = getNoteFromEditorWindow(Editor)

    // Pre-flight checks
    if (content == null || selectedParagraphs == null || note == null) {
      // No note open, or no selectedParagraph selection (empty note?), so don't do anything.
      logWarn(pluginJson, `${logName}(): No note open, so stopping.`)
      if (!interactive) logInfo(pluginJson, `${logName}(): no note open, so stopping.`)
      return
    }
    logDebug(pluginJson, `${logName}(): Starting`)

    // Get config settings
    const config = configIn ?? await getFilerSettings(interactive)
    if (!config) return
    const selectedParagraphsToUse = getSelectedParagraphsToUse()

    if (selectedParagraphsToUse.length === 0) {
      logWarn(pluginJson, `${logName}: No selected paragraphs found.`)
      return
    }

    // Find the calendar note to move to
    const destNote = DataStore.calendarNoteByDate(destDate, period)
    if (destNote == null) {
      const missingMsg = `Sorry: I can't find the ${periodLabel} note for ${toNPLocaleDateString(destDate)}.`
      await reportFiler(interactive, missingMsg)
      logError(logName, `Failed to open the ${periodLabel} note for ${toNPLocaleDateString(destDate)}. Stopping.`)
      return
    }

    const firstSelLineIndex = selectedParagraphsToUse[0].lineIndex
    const lastSelLineIndex = selectedParagraphsToUse[selectedParagraphsToUse.length - 1].lineIndex

    // Get paragraphs for the selection or block
    const parasInBlock = getParagraphsToMove(note, selectedParagraphsToUse, withBlockContext, config)

    if (parasInBlock.length === 0) {
      logWarn(pluginJson, `${logName}: No paragraphs to move.`)
      return
    }

    if (withBlockContext && !(await confirmTitleLineMove(note, parasInBlock, config.useTightBlockDefinition, logName))) return

    // Highlight if we expanded to a block (not a user selection)
    if (lastSelLineIndex === firstSelLineIndex) {
      highlightSelectionInEditor(parasInBlock)
    }

    // Date backlink for destination copy only (do not mutate source paras)
    const dateBacklinkSuffix = getDateBacklinkSuffix(note, config)

    // Move paragraphs to destination note (empty heading for calendar notes)
    moveParagraphsToNote(note, destNote, parasInBlock, '', config, dateBacklinkSuffix)
    logInfo(pluginJson, `${logName}(): moved ${String(parasInBlock.length)} lines to the ${periodLabel} note for ${toNPLocaleDateString(destDate)}`)

    // Clear highlighting
    clearHighlighting()
  }
  catch (error) {
    logError(`Filer/${logName}`, error.message)
    await reportFiler(interactive, error.message, 'Filer: Error moving lines to calendar date')
  }
}

/**
 * Load settings, apply optional JSON from an x-callback, then move to a calendar note.
 * A string `params` (including '') means no dialog. The command bar passes no arguments.
 * @param {?string} params
 * @param {Date} destDate
 * @param {string} period
 * @param {string} periodLabel
 * @param {string} logName
 */
async function runQuickMove(params: ?string, destDate: Date, period: string, periodLabel: string, logName: string): Promise<void> {
  const fromXCallback = typeof params === 'string'
  let config = await getFilerSettings(!fromXCallback)
  if (!config) return
  if (typeof params === 'string' && params.trim() !== '') {
    logInfo(pluginJson, `${logName}(): x-callback settings '${params}'`)
    const next = applyFilerJsonSettings(config, params)
    if (!next) return
    config = next
  } else if (fromXCallback) {
    logInfo(pluginJson, `${logName}(): x-callback with plugin settings`)
  }
  // withBlockContext is not a stored setting. JSON may set it. Otherwise a quick move stays a single line or the selection.
  const withBlockContext = Boolean(config.withBlockContext)
  await moveParasToCalendarPeriod(destDate, period, periodLabel, logName, withBlockContext, config, !fromXCallback)
}

// -----------------------------------------------------------------

/**
 * Move text to today's Daily note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 */
export async function moveParasToToday(params?: string): Promise<void> {
  await runQuickMove(params, new Date(), 'day', 'Daily', 'moveParasToToday') // today
}

/**
 * Move text to tomorrow's Daily note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 */
export async function moveParasToTomorrow(params?: string): Promise<void> {
  await runQuickMove(params, Calendar.addUnitToDate(new Date(), 'day', 1), 'day', 'Daily', 'moveParasToTomorrow') // tomorrow
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
  await moveParasToCalendarPeriod(destDate, 'day', 'Daily', 'moveParasToCalendarDate', withBlockContext)
}
