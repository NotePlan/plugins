// @flow
//-----------------------------------------------------------------------------
// Create statistics for hasthtags and mentions for time periods
// Jonathan Clark, @jgclark
// Last updated 25.11.2022 for v0.17.0
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
    const [fromDate, toDate, periodType, periodString, periodAndPartStr] = await getPeriodStartEndDates()
    if (fromDate == null || toDate == null) {
      throw new Error(`Error: failed to calculate dates`)
    }
    if (fromDate > toDate) {
      throw new Error(`Error: requested fromDate ${String(fromDate)} is after toDate ${String(toDate)}`)
    }
    const fromDateStr = hyphenatedDate(fromDate)
    const toDateStr = hyphenatedDate(toDate)
    logInfo(pluginJson, `statsPeriod: starting for ${periodString} (${fromDateStr} - ${toDateStr})`)
    const calendarNoteType =
      (periodType === 'userwtd' || periodType === 'wtd' || periodType === 'lw' || periodType === 'ow') ? 'week'
        : (periodType === 'mtd' || periodType === 'lm' || periodType === 'om') ? 'month'
          : (periodType === 'qtd' || periodType === 'lq' || periodType === 'oq') ? 'quarter'
            : (periodType === 'ytd' || periodType === 'ly' || periodType === 'oy') ? 'year'
              : '(error)'
    if (calendarNoteType === '(error)') {
      throw new Error(`Error: I can't handle periodType '${periodType}'`)
    }

    const startTime = new Date()
    CommandBar.showLoading(true, `Creating Period Stats`)
    await CommandBar.onAsyncThread()

    // Main work: calculate the progress update as an array of strings
    const tmOccurrencesArray = await gatherOccurrences(periodString, fromDateStr, toDateStr, config.includeHashtags, config.excludeHashtags, config.includeMentions, config.excludeMentions, [], config.progressMentions, config.progressMentionsAverage, config.progressMentionsTotal)

    const output = generateProgressUpdate(tmOccurrencesArray, periodString, fromDateStr, toDateStr, 'markdown', config.showSparklines, true).join('\n')

    await CommandBar.onMainThread()
    CommandBar.showLoading(false)
    logDebug(pluginJson, `Created progress update in ${timer(startTime)}`)

    // --------------------------------------------------------------------------
    // Ask where to save this summary to
    // Start by tailoring the set of options to present
    const outputOptions = [
      { label: '🖊 Update/append to the open note', value: 'current' },
      { label: '📋 Write to plugin console log', value: 'log' },
      { label: '❌ Cancel', value: 'cancel' },
    ]
    if (config.folderToStore && config.folderToStore !== '') {
      outputOptions.unshift({ label: `🖊 Create/update a note in folder '${config.folderToStore}'`, value: 'note' })
    }
    if (NotePlan.environment.buildVersion >= 917) { // = 3.7.2 beta
      outputOptions.unshift({ label: `📅 Add/Update the ${calendarNoteType}ly calendar note '${periodString}'`, value: 'calendar' })
    }
    const destination = await chooseOption(`Where to save the summary for ${periodString}?`, outputOptions, 'note')

    // Output the results to the selected place
    switch (destination) {
      case 'current': {
        const currentNote = Editor.note
        if (currentNote == null) {
          logError(pluginJson, `No note is open in the Editor, so I can't write to it.`)
        } else {
          // logDebug(pluginJson, `- about to update section '${config.statsHeading}' in weekly note '${currentNote.filename}' for ${periodAndPartStr}`)
          // Replace or add output section
          replaceSection(currentNote, config.statsHeading, `${config.statsHeading} ${periodAndPartStr}`, config.headingLevel, output)
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

          // logDebug(pluginJson, `- about to update section '${config.statsHeading}' in weekly note '${note.filename}' for ${periodAndPartStr}`)
          // Replace or add output section
          replaceSection(note, config.statsHeading, `${config.statsHeading} ${periodAndPartStr}`, config.headingLevel, output)
          logDebug(pluginJson, `Written results to note '${periodString}'`)

          // open this note as a new split window in the Editor
          await Editor.openNoteByFilename(note.filename, false, 0, 0, true)
        }
        break
      }

      case 'calendar': {
        // Weekly note (from v3.6) or Monthly / Quarterly / Yearly (from v3.7.2)
        const todaysDate = new Date()

        logDebug(pluginJson, `- opening ${calendarNoteType} note that starts ${fromDateStr}`)
        // TODO: when API makes this possible, make it only open a new window if not already open
        const temp = await Editor.openNoteByDate(fromDate, false, 0, 0, true, calendarNoteType)
        const { note } = Editor
        if (note == null) {
          logError(pluginJson, `cannot get Calendar note`)
          await showMessage('There was an error getting the Calendar ready to write')
        } else {
          // If note doesn't appear to have a title, then insert one
          if (note.paragraphs.length === 0 || ! /^#\s/.test(note.paragraphs[0]?.content)) {
            note.insertHeading(periodString, 0, 1)
          }
          // Replace or add output section
          replaceSection(note, config.statsHeading, `${config.statsHeading} ${periodAndPartStr}`, config.headingLevel, output)
          logDebug(pluginJson, `Written results to note '${periodString}'`)

          // // open this note as a new split window in the Editor
          // Editor.openNoteByFilename(note.filename, false, 0, 0, true)
          // logDebug(pluginJson, `Written results to note '${displayTitle(note)}'`)
        }
        break
      }

      case 'log': {
        logInfo(pluginJson, `${config.statsHeading} for ${periodAndPartStr ? periodAndPartStr : periodString}`)
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
