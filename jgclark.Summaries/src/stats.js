// @flow
//-----------------------------------------------------------------------------
// Create statistics for hasthtags and mentions for time periods
// Jonathan Clark, @jgclark
// Last updated 4.11.2022 for v0.15.0
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Helper functions

import pluginJson from '../plugin.json'
import {
  gatherOccurrences,
  generateProgressUpdate,
  getSummariesSettings,
  TMOccurrences
} from './summaryHelpers'
import { getWeek, hyphenatedDate, unhyphenatedDate } from '@helpers/dateTime'
import { getPeriodStartEndDates } from '@helpers/NPDateTime'
import { logDebug, logError, logInfo, timer } from '@helpers/dev'
import { CaseInsensitiveMap, displayTitle } from '@helpers/general'
import { getOrMakeNote, printNote, replaceSection } from '@helpers/note'
import { caseInsensitiveCompare } from '@helpers/sorting'
import {
  chooseOption,
  // getInput,
  showMessage,
} from '@helpers/userInput'

//-------------------------------------------------------------------------------

/**
 * Ask user which period to cover, call main stats function accordingly, and present results
 * @author @jgclark
 */
export async function statsPeriod(): Promise<void> {
  try {
    // Get config settings
    const config = await getSummariesSettings()

    // Get time period of interest
    const [fromDate, toDate, periodType, periodString, periodPartStr] = await getPeriodStartEndDates()
    if (fromDate == null || toDate == null) {
      throw new Error(`Error: failed to calculate dates`)
    }
    if (fromDate > toDate) {
      throw new Error(`Error: requested fromDate ${String(fromDate)} is after toDate ${String(toDate)}`)
    }
    const fromDateStr = hyphenatedDate(fromDate)
    const toDateStr = hyphenatedDate(toDate)
    logInfo(pluginJson, `statsPeriod: starting for ${periodString} (${fromDateStr} - ${toDateStr})`)

    const startTime = new Date()
    CommandBar.showLoading(true, `Creating Period Stats`)
    await CommandBar.onAsyncThread()

    // Main work: calculate the progress update as an array of strings
    const tmOccurrencesArray = await gatherOccurrences(periodString, fromDateStr, toDateStr, config.includeHashtags, config.excludeHashtags, config.includeMentions, config.excludeMentions, [], config.progressMentions, config.progressMentionsAverage, config.progressMentionsTotal)

    const output = generateProgressUpdate(tmOccurrencesArray, periodString, fromDateStr, toDateStr, 'markdown', config.showSparklines, true).join('\n')

    await CommandBar.onMainThread()
    CommandBar.showLoading(false)
    logDebug(pluginJson, `Created progress update in${timer(startTime)}`)

    // --------------------------------------------------------------------------
    // Ask where to save this summary to
    const outputOptions = [
      { label: `🖊 Create/update a note in folder '${config.folderToStore}'`, value: 'note' },
      { label: '🖊 Update/append to your current note', value: 'current' },
      { label: '📋 Write to plugin console log', value: 'log' },
      { label: '❌ Cancel', value: 'cancel' },
    ]
    switch (periodType) {
      case 'userwtd': {
        outputOptions.unshift({ label: `📅 Add/Update your current Weekly note`, value: 'weekly' })
        break
      }
      // TODO: When monthly notes are made possible in NP, add this option
      // case 'mtd': {
      //   outputOptions.unshift({ label: `📅 Add/Update your Monthly note`, value: 'monthly' })
      //   break
      // }
    }
    const destination = await chooseOption(`Where to save the summary for ${periodString}?`, outputOptions, 'note')

    // Ask where to send the results
    switch (destination) {
      case 'current': {
        const currentNote = Editor.note
        if (currentNote == null) {
          logError(pluginJson, `No note is open in the Editor, so I can't write to it.`)
        } else {
          logDebug(pluginJson, `- about to update section '${config.statsHeading}' in weekly note '${currentNote.filename}' for ${periodPartStr}`)
          // Replace or add output section
          replaceSection(currentNote, config.statsHeading, `${config.statsHeading} ${periodPartStr}`, config.headingLevel, output)
          logDebug(pluginJson, `Written results to note '${periodString}'`)
        }
        break
      }

      case 'note': {
        // Summaries note
        const note = await getOrMakeNote(periodString, config.folderToStore)
        if (note == null) {
          logError(pluginJson, `Cannot get new note`)
          await showMessage('There was an error getting the new note ready to write')
        } else {

          logDebug(pluginJson, `- about to update section '${config.statsHeading}' in weekly note '${note.filename}' for ${periodPartStr}`)
          // Replace or add output section
          replaceSection(note, config.statsHeading, `${config.statsHeading} ${periodPartStr}`, config.headingLevel, output)
          logDebug(pluginJson, `Written results to note '${periodString}'`)

          // open this note as a new split window in the Editor
          Editor.openNoteByFilename(note.filename, false, 0, 0, true)
        }
        break
      }

      case 'weekly': {
        // Weekly note (from v3.6)
        const todaysDate = new Date()
        const y = todaysDate.getFullYear()
        const w = getWeek(todaysDate)

        logDebug(pluginJson, `Opening weekly note for ${y} / ${w}`)
        await Editor.openWeeklyNote(y, w)
        const { note } = Editor
        if (note == null) {
          logError(pluginJson, `cannot get Weekly note`)
          await showMessage('There was an error getting the Weekly ready to write')
        } else {
          // Replace or add output section
          replaceSection(note, config.statsHeading, `${config.statsHeading} ${periodPartStr}`, config.headingLevel, output)
          logDebug(pluginJson, `Written results to note '${periodString}'`)

          // open this note as a new split window in the Editor
          Editor.openNoteByFilename(note.filename, false, 0, 0, true)
          logDebug(pluginJson, `Written results to note '${displayTitle(note)}'`)
        }
        break
      }

      case 'log': {
        logInfo(pluginJson, `${config.statsHeading} for ${periodString} at ${periodPartStr}`)
        logInfo(pluginJson, output)
        break
      }

      case 'cancel': {
        break
      }
    }
  }
  catch (error) {
    logError('gatherOccurrences', error.message)
  }
}
