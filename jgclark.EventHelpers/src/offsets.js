// @flow
// ----------------------------------------------------------------------------
// Command to Process Date Offsets
// @jgclark
// Last updated 13.2.2023 for v0.20.2, by @jgclark
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getEventsSettings } from './config'
import { timeBlocksToCalendar } from './timeblocks'
import {
  calcOffsetDateStr,
  RE_BARE_DATE_CAPTURE,
  RE_BARE_DATE,
  RE_BARE_WEEKLY_DATE,
  RE_BARE_WEEKLY_DATE_CAPTURE,
  RE_DONE_DATE_OPT_TIME,
  RE_OFFSET_DATE,
  RE_OFFSET_DATE_CAPTURE,
  RE_DATE_INTERVAL,
} from '@helpers/dateTime'
import { log, logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { askDateInterval, datePicker, showMessage, showMessageYesNo } from '@helpers/userInput'

// ----------------------------------------------------------------------------
/**
 * Shift Dates
 * Go through currently selected lines in the open note and shift YYYY-MM-DD dates by an interval given by the user.
 * And now supports YYYY-Www dates too.
 * Note: can remove @done(...) dates if wanted, but doesn't touch other others than don't have whitespace or newline before them.
 * Will also un-complete completed tasks.
 * @author @jgclark
 */
export async function shiftDates(): Promise<void> {
  try {
    const config = await getEventsSettings()

    // Get working selection as an array of paragraphs
    const { paragraphs, selection, note } = Editor
    let pArr: $ReadOnlyArray<TParagraph> = []
    if (Editor == null || paragraphs == null || note == null) {
      logError(pluginJson, `No note or content found to process. Stopping.`)
      await showMessage('No note or content found to process.', 'OK', 'Shift Dates')
      return
    }
    if (selection == null) {
      //
      pArr = paragraphs.slice(0, findEndOfActivePartOfNote(note))
    } else {
      pArr = Editor.selectedParagraphs
    }
    logDebug(pluginJson, `shiftDates starting for ${pArr.length} lines`)
    if (pArr.length === 0) {
      logError(pluginJson, `Empty selection found. Stopping.`)
      await showMessage('Please select some lines to process.', 'OK', 'Shift Dates')
      return
    }

    // Get interval to use
    const interval = await askDateInterval("{question:'What interval would you like me to shift these dates by?'}")
    if (interval === '') {
      logError(pluginJson, `No valid interval supplied. Stopping.`)
      await showMessage(`Sorry, that was not a valid date interval.`)
      return
    }

    // Shift dates
    let updatedCount = 0
    pArr.forEach((p) => {
      const c = p.content
      let dates: Array<string> = []
      let originalDateStr = ''
      let shiftedDateStr = ''
      // logDebug(pluginJson, `${c}`)
      if (c.match(RE_BARE_DATE)) {
        // Process this YYYY-MM-DD date
        dates = c.match(RE_BARE_DATE_CAPTURE) ?? []
        originalDateStr = dates[1]
        shiftedDateStr = calcOffsetDateStr(originalDateStr, interval)
      }
      else if (c.match(RE_BARE_WEEKLY_DATE)) {
        // Process this YYYY-Www date TEST:
        dates = c.match(RE_BARE_WEEKLY_DATE_CAPTURE) ?? []
        originalDateStr = dates[1]
        shiftedDateStr = calcOffsetDateStr(originalDateStr, interval)
      }

      if (shiftedDateStr !== '') {
        logDebug(pluginJson, `- ${originalDateStr}: match found -> ${shiftedDateStr}`)
        // Replace date part with the new shiftedDateStr
        let updatedP = c.replace(originalDateStr, shiftedDateStr)

        // If wanted, also remove @done(...) part
        const doneDatePart = (updatedP.match(RE_DONE_DATE_OPT_TIME)) ?? ['']
        if (config.removeDoneDates && doneDatePart[0] !== '') {
          updatedP = updatedP.replace(doneDatePart[0], '')
        }

        p.content = updatedP.trimEnd()
        logDebug(pluginJson, `-> '${p.content}'`)

        // If wanted, also set any complete tasks to not complete ('open')
        if (config.uncompleteTasks && p.type === 'done') {
          p.type = 'open'
        }
        note.updateParagraph(p)
        updatedCount += 1
      }
    })
    logDebug(pluginJson, `Shifted ${updatedCount} dates`)

    // undo selection for safety, and because the end won't now be correct
    Editor.highlight(pArr[0])
  } catch (err) {
    logError(pluginJson, err.message)
  }
}

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
 *
 * @author @jgclark
 */
export async function processDateOffsets(): Promise<void> {
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
  const config = await getEventsSettings()

  try {
    let currentTargetDate = ''
    let currentTargetDateLine = 0 // the line number where we found the currentTargetDate. Zero means not set.
    let lastCalcDate = ''
    let n = 0
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
        let line = paragraphs[n].content // don't think this needs to be rawContent
        thisLevel = paragraphs[n].type === 'title' ? (thisLevel = -1) : paragraphs[n].indents
        logDebug(pluginJson, `  Line ${n} (${thisLevel}) ${line}`)

        // Decide whether to clear CTD
        // Specifically: clear on lower indent or heading or blank line or separator line
        if (thisLevel < previousFoundLevel || thisLevel === -1 || line === '' || paragraphs[n].type === 'separator') {
          if (currentTargetDate !== '') {
            logDebug(pluginJson, `- Cleared CTD`)

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
        if (line.match(RE_BARE_DATE) && !line.match(RE_DONE_DATE_OPT_TIME)) {
          const dateISOStrings = line.match(RE_BARE_DATE_CAPTURE) ?? ['']
          const dateISOString = dateISOStrings[1] // first capture group
          // We have a date string to use for any offsets in this line, and possibly following lines
          currentTargetDate = dateISOString
          currentTargetDateLine = n
          logDebug(pluginJson, `- Found CTD ${currentTargetDate} on line ${currentTargetDateLine}`)
          previousFoundLevel = thisLevel
        }

        // find lines with {+3d} or {-4w} or {^3b} etc. plus {0d} special case
        // NB: this only deals with the first on any line; it doesn't make sense to have more than one.
        let dateOffsetString = ''
        if (line.match(RE_OFFSET_DATE)) {
          logDebug(pluginJson, `    - Found line '${line.trimEnd()}'`)
          const dateOffsetStrings = line.match(RE_OFFSET_DATE_CAPTURE) ?? ['']
          dateOffsetString = dateOffsetStrings[1] // first capture group
          let calcDate = ''
          if (dateOffsetString !== '') {
            // We have a date offset in the line
            if (currentTargetDate === '' && lastCalcDate === '') {
              // This is currently an orphaned date offset
              logWarn(pluginJson, `Line ${paragraphs[n].lineIndex}: offset date '${dateOffsetString}' is an orphan, as no currentTargetDate or lastCalcDate is set`)

              // now ask for the date to use instead
              currentTargetDate = await datePicker(`{ question: 'Please enter a base date to use to offset against for "${line}"' }`, {})
              if (currentTargetDate === '') {
                logError(pluginJson, `- Still no valid CTD, so stopping.`)
                return
              } else {
                logDebug(pluginJson, `- User supplied CTD ${currentTargetDate}`)
              }
            }

            logDebug(pluginJson, `  cTD=${currentTargetDate}; lCD=${lastCalcDate}`)
            if (dateOffsetString.startsWith('^')) {
              calcDate = calcOffsetDateStr(lastCalcDate, dateOffsetString.slice(1))
            } else {
              calcDate = calcOffsetDateStr(currentTargetDate, dateOffsetString)
            }
            if (calcDate == null || calcDate === '') {
              logError(pluginJson, `Error while parsing date '${currentTargetDate}' for ${dateOffsetString}`)
            } else {
              lastCalcDate = calcDate
              // Continue, and replace offset with the new calcDate
              // Remove the offset text (e.g. {-3d}) by finding first '{' and '}' characters in the line
              const labelStart = line.indexOf('{')
              const labelEnd = line.indexOf('}')
              // Create new version with inserted date
              line = `${line.slice(0, labelStart)} >${calcDate} ${line.slice(labelEnd + 1)}` // also trim off trailing whitespace
              paragraphs[n].content = line.trimEnd()
              note.updateParagraph(paragraphs[n])
              logDebug(pluginJson, `    -> '${line.trimEnd()}'`)
            }
          }
        }
        n += 1
      } // loop over lines

      // Offer to run timeblocks creation, as that often goes with offsets
      const res = await showMessageYesNo(`Shall I also look for time blocks to create new events?`, ['Yes', 'No'], 'Process Date Offsets')
      if (res === 'Yes') {
        await timeBlocksToCalendar()
      }
    } else {
      logWarn(pluginJson, `No date offset patterns found.`)
      await showMessage(`No date offset patterns found.`, `OK`, `Process Date Offsets`)
    }
  } catch (err) {
    logError(pluginJson, err.message)
  }
}
