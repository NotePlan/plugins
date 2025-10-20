// @flow
// ----------------------------------------------------------------------------
// Command to Process Date Offsets and Shifts
// @jgclark
// Last updated 2025-10-20 for v0.23.1, by @jgclark
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getEventsSettings } from './eventsHelpers'
import { timeBlocksToCalendar } from './timeblocks'
import {
  calcOffsetDateStr,
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
import { getNPWeekData } from '@helpers/NPdateTime'
import { findEndOfActivePartOfNote, setParagraphToIncomplete } from '@helpers/paragraph'
import { stripBlockIDsFromString } from '@helpers/stringTransforms'
import { isTimeBlockPara } from '@helpers/timeblocks'
import { askDateInterval, datePicker, showMessage, showMessageYesNo } from '@helpers/userInput'

// ----------------------------------------------------------------------------
/**
 * Shift Dates
 * Go through currently selected lines in the open note and shift YYYY-MM-DD and YYYY-Wnn dates by an interval given by the user.
 * Optionally removes @done(...) dates if wanted, but doesn't touch other others than don't have whitespace or newline before them.
 * Optionally will un-complete completed tasks/checklists.
 * Note: Only deals with ISO and Weekly dates so far.
 * @author @jgclark
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

// Helper: optionally remove @done(...) part
function maybeRemoveDoneDatePart(content: string, config: any): string {
  const doneDatePart = content.match(RE_DONE_DATE_OPT_TIME) ?? ['']
  // logDebug('shiftDates', `>> ${String(doneDatePart)}`)
  if (config.removeDoneDates && doneDatePart[0] !== '') {
    return content.replace(doneDatePart[0], '')
  }
  return content
}

// Helper: optionally remove any processedTagName
function maybeRemoveProcessedTagName(content: string, config: any): string {
  if (config.removeProcessedTagName && content.includes(config.processedTagName)) {
    return content.replace(config.processedTagName, '')
  }
  return content
}

// Helper: process all YYYY-MM-DD dates in the line (can make sense in metadata lines to have multiples)
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

// Helper: process all YYYY-Wnn dates in the line (might in future make sense in metadata lines to have multiples)
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

// Helper (offset processing): determine section boundary
function isSectionBoundary(levelNow: number, prevLevel: number, content: string, type: string): boolean {
  // Specifically: clear on lower indent or heading or blank line or separator line
  return levelNow < prevLevel || levelNow === -1 || content === '' || type === 'separator'
}

// Helper (offset processing): append computed final date to heading if wanted
function appendComputedFinalDateIfWanted(
  hadCTD: boolean,
  lastCalcDate: string,
  ctdLine: number,
  config: any,
  paragraphs: $ReadOnlyArray<TParagraph>,
  note: CoreNoteFields,
): void {
  if (!hadCTD) return
  // If we had a current target date, and want to add the computed final date, do so
  if (config.addComputedFinalDate && lastCalcDate !== '' && ctdLine > 0) {
    paragraphs[ctdLine].content = `${paragraphs[ctdLine].content} to ${lastCalcDate}`
    note.updateParagraph(paragraphs[ctdLine])
  }
}

// Helper (offset processing): set CTD if a bare date is found
function setCurrentTargetDateIfBareDate(
  content: string,
  thisLevel: number,
  prevLevel: number,
  lineIndex: number,
): { ctd: string, ctdLine: number, prevLevel: number } {
  // Try matching for the standard YYYY-MM-DD date pattern on its own
  // (check it's not got various characters before it, to defeat common usage in middle of things like URLs)
  // TODO: make a different type of CTD for in-line vs in-heading dates

  // Note: Somewhere around would be the place to assess another date format, but it's much harder than it looks. (See more detail in shiftDates() above.)

  if (content.match(RE_BARE_DATE) && !content.match(RE_DONE_DATE_OPT_TIME)) {
    const dateISOStrings = content.match(RE_BARE_DATE_CAPTURE) ?? ['']
    const dateISOString = dateISOStrings[1] // first capture group
    // We have a date string to use for any offsets in this line, and possibly following lines
    logDebug('processDateOffsets', `- Found CTD ${dateISOString} on line ${lineIndex}`)
    return { ctd: dateISOString, ctdLine: lineIndex, prevLevel: thisLevel }
  }
  return { ctd: '', ctdLine: 0, prevLevel }
}

// Helper (offset processing): ensure a base date exists (possibly prompt user)
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

// Helper (offset processing): apply an offset in a single line
function applyOffsetInLine(
  content: string,
  dateOffsetString: string,
  baseDate: string,
  lastCalcDate: string,
): { content: string, lastCalcDate: string } {
  let calcDate = ''
  logDebug('processDateOffsets', `  cTD=${baseDate}; lCD=${lastCalcDate}`)
  if (dateOffsetString.startsWith('^')) {
    calcDate = calcOffsetDateStr(lastCalcDate, dateOffsetString.slice(1))
  } else {
    calcDate = calcOffsetDateStr(baseDate, dateOffsetString)
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
 * Go through current Editor note and identify date offsets and turn into due dates.
 * Understands these types of offsets:
 * - {+Nd} add on N days relative to the 'base date'
 * - {-Nw} subtract N weeks
 * - {^Nb} add on N business days relative to the last calculated offset date.
 * Offset units can be 'b'usiness day, 'w'eek, 'm'onth, 'q'uarter or 'y'ear.
 * If the {^Nx} type is used, then it will attempt to add the final calculated offset date after the 'pivot date'.
 * Offsets apply within a contiguous section; a section is considered ended when a line has a lower indent or heading level, or is a blank line or separator line.
 * If the 'addComputedFinalDate' setting is true, then the final date will be added to the end of the section heading, if present.
 *
 * @author @jgclark
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
            appendComputedFinalDateIfWanted(true, lastCalcDate, currentTargetDateLine, config, paragraphs, note)
          }
          currentTargetDate = ''
          currentTargetDateLine = 0
          lastCalcDate = ''
          // addFinalDate = false
        }

        // Try matching for the standard YYYY-MM-DD date pattern on its own
        const ctdInfo = setCurrentTargetDateIfBareDate(content, thisLevel, previousFoundLevel, n)
        if (ctdInfo.ctd !== '') {
          currentTargetDate = ctdInfo.ctd
          currentTargetDateLine = ctdInfo.ctdLine
          previousFoundLevel = ctdInfo.prevLevel
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
