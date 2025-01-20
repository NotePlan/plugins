// @flow
// ----------------------------------------------------------------------------
// Command to Process Date Offsets
// @jgclark
// Last updated 2025-01-20 for v0.22.2, by @jgclark
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { timeBlocksToCalendar } from './timeblocks'
import {
  calcOffsetDateStr,
  RE_BARE_DATE_CAPTURE,
  RE_BARE_DATE,
  RE_DATE_INTERVAL,
  RE_DONE_DATE_OPT_TIME,
  RE_OFFSET_DATE,
  RE_OFFSET_DATE_CAPTURE,
} from '@helpers/dateTime'
import { clo, log, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { stripBlockIDsFromString } from '@helpers/stringTransforms'
import { isTimeBlockPara } from '@helpers/timeblocks'
import { datePicker, showMessage, showMessageYesNo } from '@helpers/userInput'

// ----------------------------------------------------------------------------

/**
 * Go through current Editor note and identify date offsets and turn into due dates.
 * Understands these types of offsets:
 * - {+Nd} add on N days relative to the 'base date'
 * - {-Nw} subtract N weeks
 * - {^Nb} add on N business days relative to the last calculated offset date.
 * Offset units can be 'b'usiness day, 'w'eek, 'm'onth, 'q'uarter or 'y'ear.
 * If the {^Nx} type is used, then it will attempt to add the final calculated
 * offset date after the 'pivot date'.
 * Offsets apply within a contiguous section; a section is considered ended when
 * a line has a lower indent or heading level, or is a blank line or separator line.
 * TODO: [Allow other date styles in /process date offsets](https://github.com/NotePlan/plugins/issues/221) from Feb 2021 -- but much harder than it looks.

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
    logDebug(pluginJson, `processDateOffsets() for note '${noteTitle}'`)
    // const config = await getEventsSettings()

    let currentTargetDate = ''
    let currentTargetDateLine = 0 // the line number where we found the currentTargetDate. Zero means not set.
    let lastCalcDate = ''
    let n = 0
    let numFoundTimeblocks = 0
    const endOfActive = findEndOfActivePartOfNote(note)

    // Look through this open note to find data offsets
    // which can look like timeblocks
    const dateOffsetParas = paragraphs.filter((p) => p.content.match(RE_DATE_INTERVAL) && p.lineIndex < endOfActive)
    if (dateOffsetParas.length > 0) {
      logDebug(pluginJson, `Found ${dateOffsetParas.length} date offsets in '${noteTitle}'`)

      // Go through each line in the active part of the file
      // Keep track of the indent level when a suitable date is found, so we know
      // when to use and when to discard:
      // - level = -1 = a heading
      // - level = 0-n = an indent level
      let previousFoundLevel = 0
      let thisLevel = 0

      while (n < endOfActive) {
        // Make a note if this contains a time block
        if (isTimeBlockPara(paragraphs[n])) { numFoundTimeblocks++ }

        let content = paragraphs[n].content
        // As we're about to update the string, let's first unhook it from any sync'd copies
        content = stripBlockIDsFromString(content)
        thisLevel = paragraphs[n].type === 'title' ? (thisLevel = -1) : paragraphs[n].indents
        // logDebug('processDateOffsets', `  Line ${n} (${thisLevel}) '${content}'`)

        // Decide whether to clear CTD
        // Specifically: clear on lower indent or heading or blank line or separator line
        if (thisLevel < previousFoundLevel || thisLevel === -1 || content === '' || paragraphs[n].type === 'separator') {
          if (currentTargetDate !== '') {
            logDebug('processDateOffsets', `- Cleared CTD`)

            // If we had a current target date, and want to add addFinalDate, do so
            if (lastCalcDate !== '' && currentTargetDateLine > 0) {
              paragraphs[currentTargetDateLine].content = `${paragraphs[currentTargetDateLine].content} to ${lastCalcDate}`
              note.updateParagraph(paragraphs[currentTargetDateLine])
            }
          }
          currentTargetDate = ''
          currentTargetDateLine = 0
          lastCalcDate = ''
          // addFinalDate = false
        }

        // Try matching for the standard YYYY-MM-DD date pattern on its own
        // (check it's not got various characters before it, to defeat common usage in middle of things like URLs)
        // TODO: make a different type of CTD for in-line vs in-heading dates

        // TODO: Somewhere around would be the place to assess another date format, but it's much harder than it looks. (Can the more recent support in shiftDates() above now help?)

        if (content.match(RE_BARE_DATE) && !content.match(RE_DONE_DATE_OPT_TIME)) {
          const dateISOStrings = content.match(RE_BARE_DATE_CAPTURE) ?? ['']
          const dateISOString = dateISOStrings[1] // first capture group
          // We have a date string to use for any offsets in this line, and possibly following lines
          currentTargetDate = dateISOString
          currentTargetDateLine = n
          logDebug('processDateOffsets', `- Found CTD ${currentTargetDate} on line ${currentTargetDateLine}`)
          previousFoundLevel = thisLevel
        }

        // find lines with {+3d} or {-4w} or {^3b} etc. plus {0d} special case
        // NB: this only deals with the first on any line; it doesn't make sense to have more than one.
        let dateOffsetString = ''
        if (content.match(RE_OFFSET_DATE)) {
          logDebug('processDateOffsets', `    - Found line '${content}'`)
          const dateOffsetStrings = content.match(RE_OFFSET_DATE_CAPTURE) ?? ['']
          dateOffsetString = dateOffsetStrings[1] // first capture group
          let calcDate = ''
          if (dateOffsetString !== '') {
            // We have a date offset in the line
            if (currentTargetDate === '' && lastCalcDate === '') {
              // This is currently an orphaned date offset
              logInfo(processDateOffsets, `Line ${paragraphs[n].lineIndex}: offset date '${dateOffsetString}' is an orphan, as no currentTargetDate or lastCalcDate is set. Will ask user for a date.`)

              // now ask for the date to use instead
              currentTargetDate = await datePicker(`{ question: 'Please enter a base date to use to offset against for "${content}"' }`, {})
              if (currentTargetDate === '') {
                logError(processDateOffsets, `- Still no valid CTD, so stopping.`)
                return
              } else {
                logDebug('processDateOffsets', `- User supplied CTD ${currentTargetDate}`)
              }
            }

            logDebug('processDateOffsets', `  cTD=${currentTargetDate}; lCD=${lastCalcDate}`)
            if (dateOffsetString.startsWith('^')) {
              calcDate = calcOffsetDateStr(lastCalcDate, dateOffsetString.slice(1))
            } else {
              calcDate = calcOffsetDateStr(currentTargetDate, dateOffsetString)
            }
            if (calcDate == null || calcDate === '') {
              logError(processDateOffsets, `Error while parsing date '${currentTargetDate}' for ${dateOffsetString}`)
            } else {
              lastCalcDate = calcDate
              // Continue, and replace offset with the new calcDate
              // Remove the offset text (e.g. {-3d}) by finding first '{' and '}' characters in the line
              const labelStart = content.indexOf('{')
              const labelEnd = content.indexOf('}')
              // Create new version with inserted date
              content = `${content.slice(0, labelStart)} >${calcDate} ${content.slice(labelEnd + 1)}` // also trim off trailing whitespace
              paragraphs[n].content = content.trimEnd()
              note.updateParagraph(paragraphs[n])
              logDebug('processDateOffsets', `    -> '${content.trimEnd()}'`)
            }
          } else {
            logWarn('processDateOffsets', `No date offset found in '${content}'`)
          }
        }
        n += 1
      } // loop over lines

      // If we've noticed any time blocks, offer to run timeblocks creation command
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
    logError(pluginJson, err.message)
  }
}
