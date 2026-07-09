// @flow
// ----------------------------------------------------------------------------
// Command to Process Date Offsets and Shifts
// @jgclark
// Last updated 2026-07-09 for v0.23.4, by @jgclark and @CursorAI
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getEventsSettings } from './eventsHelpers'
import { timeBlocksToCalendar } from './timeblocks'
import {
  RE_BARE_DATE_CAPTURE,
  RE_BARE_DATE,
  RE_DATE_INTERVAL,
  RE_DONE_DATE_OPT_TIME,
  RE_ISO_DATE,
  RE_NP_WEEK_SPEC,
  RE_OFFSET_DATE,
  RE_OFFSET_DATE_CAPTURE,
  splitIntervalToParts,
} from '@helpers/dateTime'
import { clo, log, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { type EventsConfig } from '@helpers/NPCalendar'
import { calcOffsetDateStr, getNPWeekData } from '@helpers/NPdateTime'
import { findEndOfActivePartOfNote, setParagraphToIncomplete } from '@helpers/paragraph'
import { stripBlockIDsFromString } from '@helpers/stringTransforms'
import { isTimeBlockPara } from '@helpers/timeblocks'
import { askDateInterval, datePicker, showMessage, showMessageYesNo } from '@helpers/userInput'

/** Whether the current target date came from a heading line or a task line. */
export type CtdOrigin = 'heading' | 'task' | ''

// ----------------------------------------------------------------------------
/**
 * Main function
 * Shift day (ISO) and weekly dates in the current selection (or whole active note) by a user-supplied interval.
 * Optionally removes @done(...) dates, removes the processed-tag string, and re-opens completed tasks/checklists.
 * Note: only day (YYYY-MM-DD) and week (YYYY-Wnn) dates are shifted so far.
 * @author @jgclark
 * @returns {Promise<void>}
 */
export async function shiftDates(): Promise<void> {
  try {
    const config = await getEventsSettings()

    // Get working selection as an array of paragraphs
    const { paragraphs, selection, note } = Editor
    let pArr: $ReadOnlyArray<TParagraph> = []
    const startingCursorPos = selection?.start ?? 0
    if (Editor == null || paragraphs == null || note == null) {
      logError(pluginJson, `No note or content found to process. Stopping.`)
      await showMessage('No note or content found to process.', 'OK', 'Shift Dates')
      return
    }
    const selectionLength = selection?.length ?? 0
    if (selectionLength > 0) {
      // Use just the selected paragraphs
      pArr = Editor.selectedParagraphs
    } else {
      // Use the whole note
      pArr = paragraphs.slice(0, findEndOfActivePartOfNote(note))
    }
    logDebug('shiftDates', `shiftDates starting for ${pArr.length} lines`)
    if (pArr.length === 0) {
      logError('shiftDates', `Empty selection found. Stopping.`)
      await showMessage('Please select some lines to process.', 'OK', 'Shift Dates')
      return
    }

    // Get interval to use
    const interval = await askDateInterval("{question:'What interval would you like me to shift these dates by?'}")
    if (interval === '') {
      logError('shiftDates', `No valid interval supplied. Stopping.`)
      await showMessage(`Sorry, that was not a valid date interval.`)
      return
    }
    const intervalParts = splitIntervalToParts(interval)

    // Main loop
    let updatedCount = 0
    pArr.forEach((p) => {
      const origContent = p.content

      // Work on lines with dates
      if (origContent.match(RE_ISO_DATE) || origContent.match(RE_NP_WEEK_SPEC)) {
        // As we're about to update the string, first 'unhook' it from any sync'd copies
        let updatedContent = stripBlockIDsFromString(origContent)

        // If wanted, remove @done(...) part
        updatedContent = maybeRemoveDoneDatePart(updatedContent, config)

        // If wanted, remove any processedTagName
        updatedContent = maybeRemoveProcessedTagName(updatedContent, config)

        // If wanted, set any complete or cancelled tasks/checklists to not complete
        if (config.uncompleteTasks) { setParagraphToIncomplete(p) }

        // logDebug('shiftDates', `${origContent}`)
        // For any YYYY-MM-DD dates in the line (can make sense in metadata lines to have multiples)
        const shiftedIso = shiftIsoDatesInContent(updatedContent, interval)
        updatedContent = shiftedIso.content
        updatedCount += shiftedIso.updates

        // For any YYYY-Wnn dates in the line (might in future make sense in metadata lines to have multiples)
        const shiftedWeek = shiftWeekDatesInContent(updatedContent, intervalParts)
        updatedContent = shiftedWeek.content
        updatedCount += shiftedWeek.updates

        // else {
        // Note: This would be the place to assess another date format, but it's much harder than it looks.
        // Method probably to define new settings "regex" and "format".
        // Just using moment doesn't work fully unless you take out all other numbers in the rest of the line first.
        // NP.parseDate() uses chrono library, and probably useful, but needs testing to see how it actually works with ambiguous dates (documentation doesn't say)
        // }

        // Update the paragraph content
        p.content = updatedContent.trimEnd()
        // logDebug('shiftDates', `-> '${p.content}'`)
      }
    })
    // Write all paragraphs to the note
    note.updateParagraphs(pArr)
    // undo selection for safety, and because the end won't now be correct
    Editor.highlightByIndex(startingCursorPos, 0)

    // Notify user
    logDebug('shiftDates', `Shifted ${updatedCount} dates in ${pArr.length} lines`)
    await showMessage(`Shifted ${updatedCount} dates in ${pArr.length} lines`, 'OK', 'Shift Dates')
  } catch (err) {
    logError(pluginJson, `Error in shiftDates(): ${err.message}`)
  }
}

// ----------------------------------------------------------------------------
// Helper functions for processing date offsets
// ----------------------------------------------------------------------------
/**
 * Optionally remove an @done(...) segment from a line before shifting dates.
 * @param {string} content - paragraph content
 * @param {EventsConfig} config - Event Helpers settings
 * @returns {string} updated content
 */
function maybeRemoveDoneDatePart(content: string, config: EventsConfig): string {
  const doneDatePart = content.match(RE_DONE_DATE_OPT_TIME) ?? ['']
  // logDebug('shiftDates', `>> ${String(doneDatePart)}`)
  if (config.removeDoneDates && doneDatePart[0] !== '') {
    return content.replace(doneDatePart[0], '')
  }
  return content
}

/**
 * Optionally remove the configured processed-tag string from a line before shifting dates.
 * @param {string} content - paragraph content
 * @param {EventsConfig} config - Event Helpers settings
 * @returns {string} updated content
 */
function maybeRemoveProcessedTagName(content: string, config: EventsConfig): string {
  const processedTagName = config.processedTagName ?? ''
  if (config.removeProcessedTagName && processedTagName !== '' && content.includes(processedTagName)) {
    return content.replace(processedTagName, '')
  }
  return content
}

/**
 * Shift every YYYY-MM-DD date found in a line by the given interval.
 * @param {string} content - paragraph content
 * @param {string} interval - date interval such as '+3d' or '-2w'
 * @returns {{content: string, updates: number}} updated content and number of dates changed
 */
function shiftIsoDatesInContent(content: string, interval: string): { content: string, updates: number } {
  const RE_ISO_DATE_ALL = new RegExp(RE_ISO_DATE, 'g')
  let updatedContent = content
  let updates = 0
  if (updatedContent.match(RE_ISO_DATE)) {
    const dates = updatedContent.match(RE_ISO_DATE_ALL) ?? []
    for (const thisDate of dates) {
      const originalDateStr = thisDate
      const shiftedDateStr = calcOffsetDateStr(originalDateStr, interval)
      // Replace date part with the new shiftedDateStr
      updatedContent = updatedContent.replace(originalDateStr, shiftedDateStr)
      logDebug('shiftDates', `- ${originalDateStr}: day match found -> ${shiftedDateStr} from interval ${interval}`)
      updates += 1
    }
    logDebug('shiftDates', `-> ${updatedContent}`)
  }
  return { content: updatedContent, updates }
}

/**
 * Shift every YYYY-Wnn date found in a line by the given interval.
 * Uses NotePlan week numbering so the user's week-start preference is respected.
 * @param {string} content - paragraph content
 * @param {{number: number, type: string}} intervalParts - parsed interval from splitIntervalToParts()
 * @returns {{content: string, updates: number}} updated content and number of dates changed
 */
function shiftWeekDatesInContent(
  content: string,
  intervalParts: { number: number, type: string },
): { content: string, updates: number } {
  const RE_NP_WEEK_ALL = new RegExp(RE_NP_WEEK_SPEC, 'g')
  let updatedContent = content
  let updates = 0
  if (updatedContent.match(RE_NP_WEEK_SPEC)) {
    const dates = updatedContent.match(RE_NP_WEEK_ALL) ?? []
    for (const thisDate of dates) {
      const originalDateStr = thisDate
      // v1: but doesn't handle different start-of-week settings
      // const shiftedDateStr = calcOffsetDateStr(originalDateStr, `${intervalParts.number}${intervalParts.type}`)

      // v2: using NPdateTime::getNPWeekData instead
      const thisWeekInfo = getNPWeekData(originalDateStr, intervalParts.number, intervalParts.type)
      const shiftedDateStr = thisWeekInfo?.weekString ?? '(error)'
      // Replace date part with the new shiftedDateStr
      updatedContent = updatedContent.replace(originalDateStr, shiftedDateStr)
      logDebug('shiftDates', `- ${originalDateStr}: week match found -> ${shiftedDateStr} from interval ${intervalParts.number}${intervalParts.type}`)
      updates += 1
    }
    logDebug('shiftDates', `-> ${updatedContent}`)
  }
  return { content: updatedContent, updates }
}

/**
 * Decide whether the current line ends the active offset-processing section.
 * A section ends on a lower indent, heading, blank line, or separator line.
 * @param {number} levelNow - indent level of the current line (-1 for headings)
 * @param {number} prevLevel - indent level where the current target date was found
 * @param {string} content - paragraph content
 * @param {string} type - paragraph type
 * @returns {boolean} true if this line is a section boundary
 */
export function isSectionBoundary(levelNow: number, prevLevel: number, content: string, type: string): boolean {
  // Specifically: clear on lower indent or heading or blank line or separator line
  return levelNow < prevLevel || levelNow === -1 || content === '' || type === 'separator'
}

/**
 * Append the final computed offset date to content when configured and CTD is from a heading.
 * @param {string} content - line content to append to
 * @param {CtdOrigin} ctdOrigin - whether CTD came from a heading or task line
 * @param {string} lastCalcDate - most recently calculated offset date
 * @param {number} ctdLine - line index of the section heading / target-date line
 * @param {boolean} addComputedFinalDate - plugin setting
 * @returns {string} updated content
 */
export function appendComputedFinalDateToContent(
  content: string,
  ctdOrigin: CtdOrigin,
  lastCalcDate: string,
  ctdLine: number,
  addComputedFinalDate: boolean,
): string {
  if (!addComputedFinalDate || ctdOrigin !== 'heading' || lastCalcDate === '' || ctdLine < 0) return content
  return `${content} to ${lastCalcDate}`
}

/**
 * Append the final computed offset date to the section heading when configured.
 * Only appends when the base date came from a heading line (not a task line).
 * @param {boolean} hadCTD - whether a current target date was set for this section
 * @param {string} lastCalcDate - most recently calculated offset date
 * @param {number} ctdLine - line index of the section heading / target-date line
 * @param {CtdOrigin} ctdOrigin - whether CTD came from a heading or task line
 * @param {EventsConfig} config - Event Helpers settings
 * @param {$ReadOnlyArray<TParagraph>} paragraphs - note paragraphs
 * @param {CoreNoteFields} note - note being updated
 * @returns {void}
 */
function appendComputedFinalDateIfWanted(
  hadCTD: boolean,
  lastCalcDate: string,
  ctdLine: number,
  ctdOrigin: CtdOrigin,
  config: EventsConfig,
  paragraphs: $ReadOnlyArray<TParagraph>,
  note: CoreNoteFields,
): void {
  if (!hadCTD) return
  const updatedContent = appendComputedFinalDateToContent(paragraphs[ctdLine].content, ctdOrigin, lastCalcDate, ctdLine, config.addComputedFinalDate)
  if (updatedContent !== paragraphs[ctdLine].content) {
    paragraphs[ctdLine].content = updatedContent
    note.updateParagraph(paragraphs[ctdLine])
  }
}

/**
 * Detect a bare ISO date (YYYY-MM-DD) on a line and use it as the current target date (CTD).
 * Records whether the date came from a heading or task line (ctdOrigin).
 * @param {string} content - paragraph content
 * @param {number} thisLevel - indent level of the current line (-1 for headings)
 * @param {number} _prevLevel - previous indent level where a CTD was found (unused; kept for call-site compatibility)
 * @param {number} lineIndex - paragraph line index
 * @returns {{ctd: string, ctdLine: number, ctdLevel: number, ctdOrigin: CtdOrigin}} CTD value, line index, indent level, and origin
 */
export function setCurrentTargetDateIfBareDate(
  content: string,
  thisLevel: number,
  _prevLevel: number,
  lineIndex: number,
): { ctd: string, ctdLine: number, ctdLevel: number, ctdOrigin: CtdOrigin } {
  // Try matching for the standard YYYY-MM-DD date pattern on its own
  // (check it's not got various characters before it, to defeat common usage in middle of things like URLs)

  // Note: Somewhere around would be the place to assess another date format, but it's much harder than it looks. (See more detail in shiftDates() above.)

  if (content.match(RE_BARE_DATE) && !content.match(RE_DONE_DATE_OPT_TIME)) {
    const dateISOStrings = content.match(RE_BARE_DATE_CAPTURE) ?? ['']
    const dateISOString = dateISOStrings[1] // first capture group
    const ctdOrigin: CtdOrigin = thisLevel === -1 ? 'heading' : 'task'
    // We have a date string to use for any offsets in this line, and possibly following lines
    logDebug('processDateOffsets', `- Found CTD ${dateISOString} (${ctdOrigin}) on line ${lineIndex}`)
    return { ctd: dateISOString, ctdLine: lineIndex, ctdLevel: thisLevel, ctdOrigin }
  }
  return { ctd: '', ctdLine: 0, ctdLevel: 0, ctdOrigin: '' }
}

/**
 * Ensure a base date exists for an offset line, prompting the user when the offset is orphaned.
 * @param {string} content - paragraph content containing the orphan offset
 * @param {string} currentTargetDate - current target date for this section
 * @param {string} lastCalcDate - most recently calculated offset date
 * @returns {Promise<string>} base date to use, or '' if the user cancels
 */
async function ensureBaseDate(
  content: string,
  currentTargetDate: string,
  lastCalcDate: string,
): Promise<string> {
  if (currentTargetDate !== '' || lastCalcDate !== '') return currentTargetDate
  // This is currently an orphaned date offset
  logInfo(
    processDateOffsets,
    `Line orphan: offset date is an orphan, as no currentTargetDate or lastCalcDate is set. Will ask user for a date.`,
  )
  // now ask for the date to use instead
  const res: string | false = await datePicker(`{ question: 'Please enter a base date to use to offset against for "${content}"' }`, {})
  if (res === '' || res === false) {
    logError(processDateOffsets, `- Still no valid CTD, so stopping.`)
    return ''
  }
  logDebug('processDateOffsets', `- User supplied CTD ${res}`)
  return res
}

/**
 * Replace one date-offset pattern in a line with a computed scheduled date.
 * Relative offsets starting with '^' are calculated from lastCalcDate; others use baseDate.
 * Output format follows the offset unit (e.g. `{2w}` -> `>2026-W32`, `{3d}` -> `>2026-07-23`).
 * @param {string} content - paragraph content
 * @param {string} dateOffsetString - offset text inside braces, e.g. '+3d' or '^+1d'
 * @param {string} baseDate - current target date for this section
 * @param {string} lastCalcDate - most recently calculated offset date
 * @returns {{content: string, lastCalcDate: string}} updated content and new last calculated date
 */
function applyOffsetInLine(
  content: string,
  dateOffsetString: string,
  baseDate: string,
  lastCalcDate: string,
): { content: string, lastCalcDate: string } {
  let calcDate = ''
  logDebug('processDateOffsets', `  cTD=${baseDate}; lCD=${lastCalcDate}`)
  if (dateOffsetString.startsWith('^')) {
    calcDate = calcOffsetDateStr(lastCalcDate, dateOffsetString.slice(1), 'offset')
  } else {
    calcDate = calcOffsetDateStr(baseDate, dateOffsetString, 'offset')
  }
  if (calcDate == null || calcDate === '') {
    logError(processDateOffsets, `Error while parsing date '${baseDate}' for ${dateOffsetString}`)
    return { content, lastCalcDate }
  }
  // Continue, and replace offset with the new calcDate
  // Remove the offset text (e.g. {-3d}) by finding first '{' and '}' characters in the line
  const nextContent = content.replace(`{${dateOffsetString}}`, ` >${calcDate} `)
  return { content: nextContent, lastCalcDate: calcDate }
}

/**
 * Go through the current Editor note, find date-offset patterns, and turn them into scheduled dates.
 * Understands these offset forms:
 * - `{+Nd}` / `{-Nd}` add or subtract N units relative to the section base date
 * - `{^Nx}` add or subtract N units relative to the last calculated offset date
 * - `{0d}` keep the same day
 * Offset units: `b`usiness day, `d`ay, `w`eek, `m`onth, `q`uarter, `y`ear (upper- or lower-case).
 * Computed dates use the same calendar period as the offset unit (`d` -> YYYY-MM-DD, `w` -> YYYY-Wnn, etc.).
 * Note: doesn't explicitly handle case where base date period is longer than the offset unit (e.g. week base + 2d), which seems like an error case.
 * Offsets apply within a contiguous section, which ends on lower indent, heading, blank line, or separator.
 * If `addComputedFinalDate` is enabled, the final calculated date is appended to the section heading (not task lines).
 * @author @jgclark
 * @returns {Promise<void>}
 */
export async function processDateOffsets(): Promise<void> {
  try {
    const { paragraphs, note } = Editor
    if (paragraphs == null || note == null) {
      await showMessage('No content found to process.', 'OK', 'Process Date Offsets')
      return
    }
    if (note.filename.startsWith('@Templates')) {
      await showMessage(`For safety I won't run on notes in the @Templates folder.`, 'OK', 'Process Date Offsets')
      return
    }
    if (note.filename.startsWith('@Archive')) {
      await showMessage(`For safety I won't run on notes in the @Archive folder.`, 'OK', 'Process Date Offsets')
      return
    }
    const noteTitle = displayTitle(note)
    logDebug(pluginJson, `Starting processDateOffsets() for note '${noteTitle}'`)
    const config = await getEventsSettings()

    let currentTargetDate = ''
    let currentTargetDateLine = 0 // the line number where we found the currentTargetDate. Zero means not set.
    let currentTargetDateOrigin: CtdOrigin = ''
    let lastCalcDate = ''
    let n = 0
    let numFoundTimeblocks = 0
    const endOfActive = findEndOfActivePartOfNote(note)

    // Look through this open note to find date offsets
    const dateOffsetParas = paragraphs.filter((p) => p.content.match(RE_DATE_INTERVAL) && p.lineIndex < endOfActive)
    if (dateOffsetParas.length > 0) {
      logDebug('processDateOffsets', `Found ${dateOffsetParas.length} date offsets in '${noteTitle}'`)

      // Go through each line in the active part of the file
      // Keep track of the indent level when a suitable date is found, so we know
      // when to use and when to discard:
      // - level = -1 = a heading
      // - level = 0-n = an indent level
      let previousFoundLevel = 0
      let thisLevel = 0

      while (n < endOfActive) {
        // Make a note if this contains a time block
        if (isTimeBlockPara(paragraphs[n])) {
          numFoundTimeblocks++
        }

        let content = paragraphs[n].content
        // As we're about to update the string, let's first unhook it from any sync'd copies
        content = stripBlockIDsFromString(content)
        thisLevel = paragraphs[n].type === 'title' ? (thisLevel = -1) : paragraphs[n].indents
        // logDebug('processDateOffsets', `  Line ${n} (${thisLevel}) '${content}'`)

        // Decide whether to clear CTD
        if (isSectionBoundary(thisLevel, previousFoundLevel, content, paragraphs[n].type)) {
          if (currentTargetDate !== '') {
            logDebug('processDateOffsets', `- Cleared CTD`)
            appendComputedFinalDateIfWanted(true, lastCalcDate, currentTargetDateLine, currentTargetDateOrigin, config, paragraphs, note)
          }
          currentTargetDate = ''
          currentTargetDateLine = 0
          currentTargetDateOrigin = ''
          lastCalcDate = ''
          // addFinalDate = false
        }

        // Try matching for the standard YYYY-MM-DD date pattern on its own
        const ctdInfo = setCurrentTargetDateIfBareDate(content, thisLevel, previousFoundLevel, n)
        if (ctdInfo.ctd !== '') {
          currentTargetDate = ctdInfo.ctd
          currentTargetDateLine = ctdInfo.ctdLine
          currentTargetDateOrigin = ctdInfo.ctdOrigin
          previousFoundLevel = ctdInfo.ctdLevel
        }

        // find lines with {+3d} or {-4w} or {^3b} etc. plus {0d} special case
        // NB: this only deals with the first on any line; it doesn't make sense to have more than one.
        if (content.match(RE_OFFSET_DATE)) {
          logDebug('processDateOffsets', `    - Found line '${content}'`)
          const dateOffsetStrings = content.match(RE_OFFSET_DATE_CAPTURE) ?? ['']
          const dateOffsetString = dateOffsetStrings[1] // first capture group
          if (dateOffsetString !== '') {
            // We have a date offset in the line
            const ensuredCTD = await ensureBaseDate(content, currentTargetDate, lastCalcDate)
            if (ensuredCTD === '') return
            currentTargetDate = ensuredCTD

            const result = applyOffsetInLine(content, dateOffsetString, currentTargetDate, lastCalcDate)
            lastCalcDate = result.lastCalcDate
            content = result.content
            // now trim off any trailing whitespace
            paragraphs[n].content = content.trimEnd()
            note.updateParagraph(paragraphs[n])
            logDebug('processDateOffsets', `    -> '${content.trimEnd()}'`)
          } else {
            logWarn('processDateOffsets', `No date offset found in '${content}'`)
          }
        }
        n += 1
      }

      // If we found any time blocks, offer to create new events from them
      if (numFoundTimeblocks > 0) {
        const res = await showMessageYesNo(`I spotted ${String(numFoundTimeblocks)} time blocks: shall I create new events from them?`, ['Yes', 'No'], 'Process Date Offsets')
        if (res === 'Yes') {
          await timeBlocksToCalendar()
        }
      }
    } else {
      logWarn('processDateOffsets', `No date offset patterns found.`)
      await showMessage(`No date offset patterns found.`, `OK`, `Process Date Offsets`)
    }
  } catch (err) {
    logError(pluginJson, `Error in processDateOffsets(): ${err.message}`)
  }
}
