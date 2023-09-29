// @flow
// ----------------------------------------------------------------------------
// Command to Process Date Offsets
// @jgclark
// Last updated 29.9.2023 for v0.21.0, by @jgclark
// ----------------------------------------------------------------------------
// TEST:
// * Unhook any blockIDs before starting /process
// * remove time block indicator tags in /shift
// TODO:
// * [Allow other date styles in /process date offsets](https://github.com/NotePlan/plugins/issues/221) from Feb 2021 -- but much harder than it looks.
// * Also allow other date styles in /shift? -- as above


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
  toISODateString,
  toLocaleDateString,
} from '@helpers/dateTime'
import { log, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { stripBlockIDsFromString } from '@helpers/stringTransforms'
import { isTimeBlockPara } from '@helpers/timeblocks'
import { askDateInterval, datePicker, showMessage, showMessageYesNo } from '@helpers/userInput'

// ----------------------------------------------------------------------------
/**
 * Shift Dates
 * Go through currently selected lines in the open note and shift YYYY-MM-DD and YYYY-Wnn dates by an interval given by the user.
 * Optionally removes @done(...) dates if wanted, but doesn't touch other others than don't have whitespace or newline before them.
 * Optionally will un-complete completed tasks/checklists.
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

    // Shift dates.
    let updatedCount = 0
    pArr.forEach((p) => {
      const origContent = p.content
      let dates: Array<string> = []
      let originalDateStr = ''
      let shiftedDateStr = ''

      // logDebug(pluginJson, `${origContent}`)
      if (origContent.match(RE_BARE_DATE)) { // find YYYY-MM-DD or >YYYY-MM-DD strings, but not following (</-
        // Process this YYYY-MM-DD date
        dates = origContent.match(RE_BARE_DATE_CAPTURE) ?? []
        originalDateStr = dates[1]
        shiftedDateStr = calcOffsetDateStr(originalDateStr, interval)
      }
      if (origContent.match(RE_BARE_WEEKLY_DATE)) { // find YYYY-Wnn or >YYYY-Wnn strings, but not following (</-
        // Process this YYYY-Www date
        dates = origContent.match(RE_BARE_WEEKLY_DATE_CAPTURE) ?? []
        originalDateStr = dates[1]
        shiftedDateStr = calcOffsetDateStr(originalDateStr, interval)
      }

      // TODO: This would be the place to assess another date format, but it's much harder than it looks.
      // Method probably to define new settings "regex" and "format".
      // Just using moment doesn't work fully unless you take out all other numbers in the rest of the line first.
      // NP.parseDate() uses chrono library, and probably useful, but needs testing to see how it actually works with ambiguous dates (documentation doesn't say)

      let updatedContent = origContent
      // As we're about to update the string, first 'unhook' it from any sync'd copies
      updatedContent = stripBlockIDsFromString(updatedContent)
      if (shiftedDateStr !== '') {
        logDebug(pluginJson, `- ${originalDateStr}: match found -> ${shiftedDateStr}`)
        // Replace date part with the new shiftedDateStr
        updatedContent = origContent.replace(originalDateStr, shiftedDateStr)
      }

      // If wanted, remove @done(...) part
      const doneDatePart = (updatedContent.match(RE_DONE_DATE_OPT_TIME)) ?? ['']
      // logDebug(pluginJson, `>> ${String(doneDatePart)}`)
      if (config.removeDoneDates && doneDatePart[0] !== '') {
        updatedContent = updatedContent.replace(doneDatePart[0], '')
      }

      // If wanted, remove any processedTagName
      if (config.removeProcessedTagName && updatedContent.includes(config.processedTagName)) {
        updatedContent = updatedContent.replace(config.processedTagName, '')
      }

      p.content = updatedContent.trimEnd()
      logDebug(pluginJson, `-> '${p.content}'`)

      // If wanted, set any complete or cancelled tasks/checklists to not complete
      if (config.uncompleteTasks) {
        if (p.type === 'done') {
      // logDebug(pluginJson, `>> changed done -> open`)
          p.type = 'open'
        } else if (p.type === 'cancelled') {
          // logDebug(pluginJson, `>> changed cancelled -> open`)
          p.type = 'open'
        } else if (p.type === 'checklistDone') {
          // logDebug(pluginJson, `>> changed checklistDone -> checklist`)
          p.type = 'checklist'
        } else if (p.type === 'checklistCancelled') {
          // logDebug(pluginJson, `>> changed checklistCancelled -> checklist`)
          p.type = 'checklist'
        }
      }
      note.updateParagraph(p)
      updatedCount += 1
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
    const config = await getEventsSettings()

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
        // As we're about to update the string, let's first unook it from any sync'd copies
        content = stripBlockIDsFromString(content)
        thisLevel = paragraphs[n].type === 'title' ? (thisLevel = -1) : paragraphs[n].indents
        logDebug(pluginJson, `  Line ${n} (${thisLevel}) <${content}>`)

        // Decide whether to clear CTD
        // Specifically: clear on lower indent or heading or blank line or separator line
        if (thisLevel < previousFoundLevel || thisLevel === -1 || content === '' || paragraphs[n].type === 'separator') {
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

        // TODO: Somewhere around would be the place to assess another date format, but it's much harder than it looks. (See more detail in shiftDates() above.)

        if (content.match(RE_BARE_DATE) && !content.match(RE_DONE_DATE_OPT_TIME)) {
          const dateISOStrings = content.match(RE_BARE_DATE_CAPTURE) ?? ['']
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
        if (content.match(RE_OFFSET_DATE)) {
          logDebug(pluginJson, `    - Found line '${content.trimEnd()}'`)
          const dateOffsetStrings = content.match(RE_OFFSET_DATE_CAPTURE) ?? ['']
          dateOffsetString = dateOffsetStrings[1] // first capture group
          let calcDate = ''
          if (dateOffsetString !== '') {
            // We have a date offset in the line
            if (currentTargetDate === '' && lastCalcDate === '') {
              // This is currently an orphaned date offset
              logInfo(pluginJson, `Line ${paragraphs[n].lineIndex}: offset date '${dateOffsetString}' is an orphan, as no currentTargetDate or lastCalcDate is set. Will ask user for a date.`)

              // now ask for the date to use instead
              currentTargetDate = await datePicker(`{ question: 'Please enter a base date to use to offset against for "${content}"' }`, {})
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
              const labelStart = content.indexOf('{')
              const labelEnd = content.indexOf('}')
              // Create new version with inserted date
              content = `${content.slice(0, labelStart)} >${calcDate} ${content.slice(labelEnd + 1)}` // also trim off trailing whitespace
              paragraphs[n].content = content.trimEnd()
              note.updateParagraph(paragraphs[n])
              logDebug(pluginJson, `    -> '${content.trimEnd()}'`)
            }
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
      logWarn(pluginJson, `No date offset patterns found.`)
      await showMessage(`No date offset patterns found.`, `OK`, `Process Date Offsets`)
    }
  } catch (err) {
    logError(pluginJson, err.message)
  }
}
