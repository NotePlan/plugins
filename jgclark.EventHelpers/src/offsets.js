// @flow
// ----------------------------------------------------------------------------
// Command to Process Date Offsets
// @jgclark
// Last updated 16.6.2022 for v0.16.0+, by @jgclark
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { getEventsSettings } from './config'
import { timeBlocksToCalendar } from './timeblocks'
import {
  calcOffsetDateStr,
  RE_BARE_DATE_CAPTURE,
  RE_BARE_DATE,
  RE_OFFSET_DATE,
  RE_OFFSET_DATE_CAPTURE,
  RE_DATE_INTERVAL,
  // todaysDateISOString,
} from '@helpers/dateTime'
import { log, logWarn, logError } from "@helpers/dev"
import { displayTitle } from '@helpers/general'
// import { calcOffsetDateStr } from '@helpers/NPdateTime'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { askDateInterval, datePicker, showMessage, showMessageYesNo } from '@helpers/userInput'

// const RE_HEADING_LINE = `^#+\s`

// ----------------------------------------------------------------------------
/**
 * Shift Dates
 * Go through currently selected lines in the open note and shift YYYY-MM-DD dates by an interval given by the user
 * Note: doesn't touch @done(...) dates, or others than don't have whitespace or newline before them
 * @author @jgclark
 */
export async function shiftDates(): Promise<void> {
  try {
    // Get working selection as an array of paragraphs
    const { paragraphs, selection, note } = Editor
    let pArr = []
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
    log(pluginJson, `shiftDates starting for ${pArr.length} lines`)
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
    pArr.forEach(p => {
      const c = p.content
      log(pluginJson, `${c}`)
      if (c.match(RE_BARE_DATE)) {
        const dates = c.match(RE_BARE_DATE_CAPTURE) ?? []
        const firstDate = dates[1]
        const shiftedDate = calcOffsetDateStr(firstDate, interval)
        log(pluginJson, `  ${firstDate}: match found, will become ${shiftedDate}`)
        // Replace date part with the new shiftedDate
        const updatedP = c.replace(firstDate, shiftedDate).trimEnd()
        p.content = updatedP
        note.updateParagraph(p)
        updatedCount += 1
      }
    })
    log(pluginJson, `Shifted ${updatedCount} dates`)
  }
  catch (err) {
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
  const noteTitle = displayTitle(note)
  log(pluginJson, `for note '${noteTitle}'`)
  const config = await getEventsSettings() // eslint-disable-line

  try {
    let currentTargetDate = ''
    let currentTargetDateLine = 0  // the line number where we found the currentTargetDate. Zero means not set.
    let lastCalcDate = ''
    let n = 0
    const endOfActive = findEndOfActivePartOfNote(note)

    // Look through this open note to find data offsets
    // which can look like timeblocks
    const dateOffsetParas = paragraphs.filter((p) => p.content.match(RE_DATE_INTERVAL) && p.lineIndex < endOfActive)
    if (dateOffsetParas.length > 0) {
      log(pluginJson, `Found ${dateOffsetParas.length} date offsets in '${noteTitle}'`)
      // Find first Done or Cancelled section and get its paragraph index

      // Go through each line in the active part of the file
      // Keep track of the indent level when a suitable date is found, so we know
      // when to use and when to discard:
      // - level = -1 = a heading
      // - level = 0-n = an indent level
      let previousFoundLevel = 0
      let thisLevel = 0

      while (n < endOfActive) {
        let line = paragraphs[n].content // don't think this needs to be rawContent
        thisLevel = (paragraphs[n].type === 'title')
          ? thisLevel = -1
          : paragraphs[n].indents
        // log(pluginJson, `  Line ${n} (${thisLevel}) ${line}`)

        // Decide whether to clear CTD
        // Specifically: clear on lower indent or heading or blank line or separator line
        if (thisLevel < previousFoundLevel || thisLevel === -1 || line === '' || paragraphs[n].type === 'separator') {
          if (currentTargetDate !== '') {
            log(pluginJson, `- Cleared CTD`)

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
        if (line.match(RE_BARE_DATE)) {
          const dateISOStrings = line.match(RE_BARE_DATE_CAPTURE) ?? ['']
          const dateISOString = dateISOStrings[1] // first capture group
          // We have a date string to use for any offsets in this line, and possibly following lines
          currentTargetDate = dateISOString
          currentTargetDateLine = n
          log(pluginJson, `- Found CTD ${currentTargetDate} on line ${currentTargetDateLine}`)
          previousFoundLevel = thisLevel
        }

        // find lines with {+3d} or {-4w} or {^3b} etc. plus {0d} special case
        // NB: this only deals with the first on any line; it doesn't make sense to have more than one.
        let dateOffsetString = ''
        if (line.match(RE_OFFSET_DATE)) {
          // log(pluginJson, `    - Found line '${line.trimEnd()}'`)
          const dateOffsetStrings = line.match(RE_OFFSET_DATE_CAPTURE) ?? ['']
          dateOffsetString = dateOffsetStrings[1] // first capture group
          let calcDate = ''
          if (dateOffsetString !== '') {
            // We have a date offset in the line
            if (currentTargetDate === '' && lastCalcDate === '') {
              // This is currently an orphaned date offset
              logWarn(pluginJson, `Line ${paragraphs[n].lineIndex}: offset date '${dateOffsetString}' is an orphan, as no currentTargetDate or lastCalcDate is set`)
            
              // now ask for the date to use instead
              currentTargetDate = await datePicker("{ question: 'Please enter a base date to use to offset against' }", {})
              if (currentTargetDate === '') {
                logError(pluginJson, `- Still no valid CTD, so stopping.`)
                return
              } else {
                log(pluginJson, `- User supplied CTD ${currentTargetDate}`)
              }
            }

            log(pluginJson, `  cTD=${currentTargetDate}; lCD=${lastCalcDate}`)
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
              log(pluginJson, `    -> '${line.trimEnd()}'`)
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
  }
  catch (err) {
    logError(pluginJson, err.message)
  }
}
