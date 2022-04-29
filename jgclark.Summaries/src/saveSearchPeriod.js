// @flow
//-----------------------------------------------------------------------------
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 16.3.2022 for v0.6.1, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Helper functions

import pluginJson from '../plugin.json'
import {
  // DEFAULT_SUMMARIES_CONFIG,
  gatherMatchingLines,
  getSummariesSettings,
  getPeriodStartEndDates,
} from './summaryHelpers'
import type { SummariesConfig } from './summaryHelpers'
import {
  getDateStringFromCalendarFilename,
  monthNameAbbrev,
  toLocaleDateString,
  unhyphenatedDate,
  withinDateRange,
} from '../../helpers/dateTime'
import { clo, log, logWarn, logError } from '../../helpers/dev'
import {
  quarterStartEnd,
} from '../../helpers/NPdateTime'
import {
  displayTitle,
  stringReplace,
} from '../../helpers/general'
import {
  removeSection,
} from '../../helpers/paragraph'
import {
  chooseOption,
  getInput,
  showMessage,
  showMessageYesNo,
} from '../../helpers/userInput'

//-------------------------------------------------------------------------------

/**
 * Ask user which period to cover, what word/phrase to search for, 
 * run the search over all notes, and ask where to save/show the results.
 * @author @jgclark
 */
export async function saveSearchPeriod(): Promise<void> {
  // Get config settings from Template folder _configuration note
  // await getPluginSettings()
  const config = await getSummariesSettings()

  // Work out time period to cover
  const [fromDate, toDate, periodString, periodPartStr] = await getPeriodStartEndDates(`What period shall I search over?`)
  if (fromDate == null || toDate == null) {
    logError(pluginJson, 'dates could not be parsed')
    return
  }
  const fromDateStr = unhyphenatedDate(fromDate) //fromDate.toISOString().slice(0, 10).replace(/-/g, '')
  const toDateStr = unhyphenatedDate(toDate) // toDate.toISOString().slice(0, 10).replace(/-/g, '')

  let stringsToMatch = Array.from(config.defaultOccurrences)
  const newTerms = await getInput(`Enter search term (or comma-separated set of terms)`, 'OK', `Search`, stringsToMatch.join(', '))
  if (typeof newTerms === 'boolean') {
    // i.e. user has cancelled
    log(pluginJson, `User has cancelled operation.`)
    return
  } else {
    stringsToMatch = Array.from(newTerms.split(','))
  }

  // Stop if we don't have search terms
  if (stringsToMatch.length === 0 || String(stringsToMatch) === '') {
    logWarn(pluginJson, 'no search terms given; stopping.')
    await showMessage(`No search terms given; stopping.`)
    return
  }
  log(pluginJson, 
    `saveSearchPeriod: looking for '${String(stringsToMatch)}' over ${periodString} (${fromDateStr}-${toDateStr}):`,
  )
  
  // Get array of all daily notes that are within this time period
  const periodDailyNotes = DataStore.calendarNotes.filter((p) =>
    withinDateRange(
      getDateStringFromCalendarFilename(p.filename),
      fromDateStr,
      toDateStr,
    ),
  )
  if (periodDailyNotes.length === 0) {
    logWarn(pluginJson, 'no matching daily notes found')
    await showMessage(`No matching daily notes found; stopping.`)
    return
  }

  // Find matches in notes for the time period
  const outputArray = []
  for (const searchTerm of stringsToMatch) {
    // get list of matching paragraphs for this string
    const results = await gatherMatchingLines(periodDailyNotes, searchTerm, config.highlightOccurrences, config.dateStyle)
    const lines = results?.[0]
    const context = results?.[1]
    // output a heading first
    outputArray.push(`### ${searchTerm}`)
    if (lines.length > 0) {
      log(pluginJson, `  Found ${lines.length} results for '${searchTerm}'`)
      // form the output
      for (let i = 0; i < lines.length; i++) {
        outputArray.push(`${config.resultPrefix}${lines[i]} ${context[i]}`)
      }
    } else if (config.showEmptyOccurrences) {
      // If there's nothing to report, make that clear
      outputArray.push('(no matches)')
    }
  }

  const headingLine = `${config.occurrencesHeading} for ${periodString}`
  const labelString = `🖊 Create/update note '${periodString}' in folder '${String(config.folderToStore)}'`
  
  // Ask where to save this summary to
  // log(pluginJson, `** Before chooseOption <${outputArray.length}>**`)
  const destination = await chooseOption(
    `Where should I save the results for ${periodString}?`,
    [
      {
        // TODO: When weekly/monthly notes are made possible in NP, then add options like this
        //   label: "📅 Append to this month's note",
        //   value: "today"
        // }, {
        label: labelString,
        value: 'note',
      },
      {
        label: '🖊 Append to current note',
        value: 'current',
      },
      {
        label: '📋 Write to plugin console log',
        value: 'log',
      },
      {
        label: '❌ Cancel',
        value: 'cancel',
      },
    ],
    'note',
  )
  // log(pluginJson, '** After await chooseOption **')

  switch (destination) {
    case 'current': {
      const currentNote = Editor.note
      if (currentNote == null) {
        logError(pluginJson, `no note is open`)
      } else {
        log(pluginJson, 
          `appending results to current note (${currentNote.filename ?? ''})`,
        )
        const insertionLineIndex = currentNote.paragraphs.length - 1
        currentNote.insertHeading(
          headingLine,
          insertionLineIndex,
          config.headingLevel,
        )
        // TODO: Can't see why a blank line appears here
        currentNote.appendParagraph(
          outputArray.join('\n'),
          'text',
        )
        // log(pluginJson, `\tappended results to current note`)
      }
      break
    }
    case 'note': {
      let note: TNote
      // first see if this note has already been created
      // (look only in active notes, not Archive or Trash)
      const existingNotes: $ReadOnlyArray<TNote> =
        DataStore.projectNoteByTitle(periodString, true, false) ?? []

      log(pluginJson, `found ${existingNotes.length} existing summary notes for this period`)

      if (existingNotes.length > 0) {
        note = existingNotes[0] // pick the first if more than one
        // log(pluginJson, `filename of first matching note: ${displayTitle(note)}`)
      } else {
        // make a new note for this. NB: filename here = folder + filename
        const noteFilename = DataStore.newNote(periodString, config.folderToStore) ?? ''
        if (!noteFilename) {
          logError(pluginJson, `Can't create new note (filename: ${noteFilename})`)
          await showMessage('There was an error creating the new note')
          return
        }
        log(pluginJson, `newNote filename: ${noteFilename}`)
        // $FlowIgnore[incompatible-type]
        note = DataStore.projectNoteByFilename(noteFilename)
        if (note == null) {
          logError(pluginJson, `Can't get new note (filename: ${noteFilename})`)
          await showMessage('There was an error getting the new note ready to write')
          return
        }
      }
      log(pluginJson, `writing results to the new note '${displayTitle(note)}'`)

      // Do we have an existing Hashtag counts section? If so, delete it.
      // (Sets place to insert either after the found section heading, or at end of note)
      const insertionLineIndex = removeSection(
        note,
        config.occurrencesHeading,
      )
      // log(pluginJson, `\tinsertionLineIndex: ${String(insertionLineIndex)}`)
      // write in reverse order to avoid having to calculate insertion point again
      note.insertParagraph(
        outputArray.join('\n'),
        insertionLineIndex + 1,
        'text',
      )
      note.insertHeading(
        headingLine,
        insertionLineIndex,
        config.headingLevel,
      )
      await Editor.openNoteByFilename(note.filename)

      log(pluginJson, `written results to note '${periodString}'`)
      break
    }

    case 'log': {
      log(pluginJson, headingLine)
      log(pluginJson, outputArray.join('\n'))
      break
    }

    default: {
      break
    }
  }
}
