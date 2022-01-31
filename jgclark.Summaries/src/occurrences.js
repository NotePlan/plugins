// @flow
//-----------------------------------------------------------------------------
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 30.1.2022 for v0.5.1, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Helper functions

import {
  DEFAULT_SUMMARIES_CONFIG,
  gatherMatchingLines,
  getConfigSettings,
  getPeriodStartEndDates,
} from './summaryHelpers'
import type { SummariesConfig } from './summaryHelpers'
import {
  dateStringFromCalendarFilename,
  monthNameAbbrev,
  toLocaleDateString,
  unhyphenatedDate,
  withinDateRange,
} from '../../helpers/dateTime'
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
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

//-------------------------------------------------------------------------------

/**
 * Ask user which period to cover, call main stats function, and present results
 * @author @jgclark
 */
export async function occurrencesPeriod(): Promise<void> {
  // Get config settings from Template folder _configuration note
  // await getPluginSettings()
  const config = await getConfigSettings()

  // Work out time period to cover
  const [fromDate, toDate, periodString, periodPartStr] = await getPeriodStartEndDates()

  if (fromDate == null || toDate == null) {
    console.log('error: dates could not be parsed')
    return
  }
  const fromDateStr = unhyphenatedDate(fromDate) //fromDate.toISOString().slice(0, 10).replace(/-/g, '')
  const toDateStr = unhyphenatedDate(toDate) // toDate.toISOString().slice(0, 10).replace(/-/g, '')
  
  let stringsToMatch = Array.from(config.defaultOccurrences)
  // Show user these default 'config.defaultOccurrences' search terms, 
  // and offer to get a single search term instead
  const res = await chooseOption(
    `Search for '${stringsToMatch.join(', ')}'`,
    [
      { label: `Yes (use defaults)`, value: 'Yes' },
      { label: `No (I'll choose my own; can be comma-separated)`, value: 'No' },
    ],
    'Yes',
  )
  if (res === 'No') {
    stringsToMatch.splice(0, stringsToMatch.length) // clear array
    const newTerms = await getInput(`Enter search term(s)`)
    if (typeof newTerms === 'boolean') {
      // i.e. user has cancelled
      console.log(`User has cancelled operation.`)
      return
    } else {
      stringsToMatch = Array.from(newTerms.split(','))
    }
  }
  console.log(
    `\nperiodOccurrences: looking for '${String(stringsToMatch)}' over ${periodString} (${fromDateStr}-${toDateStr}):`,
  )
  
  // Get array of all daily notes that are within this time period
  const periodDailyNotes = DataStore.calendarNotes.filter((p) =>
    withinDateRange(
      dateStringFromCalendarFilename(p.filename),
      fromDateStr,
      toDateStr,
    ),
  )
  if (periodDailyNotes.length === 0) {
    console.log('  warning: no matching daily notes found')
    await showMessage(`No matching daily notes found; stopping.`)
    return
  }

  // Find matches in notes for the time period
  const outputArray = []
  for (const toMatch of stringsToMatch) {
    // output a heading first
    // get list of matching paragraphs for this string
    const results = await gatherMatchingLines(periodDailyNotes, toMatch, config.highlightOccurrences, config.dateStyle)
    const lines = results?.[0]
    const context = results?.[1]
    if (lines.length > 0) {
      console.log(`  Found ${lines.length} results for ${toMatch}`)
      outputArray.push(`### ${toMatch}`)
      // form the output
      for (let i = 0; i < lines.length; i++) {
        outputArray.push(`- ${lines[i]}${context[i]}`)
      }
    } else if (config.showEmptyOccurrences) {
      // If there's nothing to report, make that clear
      outputArray.push(`### ${toMatch}`)
      outputArray.push('(none)')
    }
  }

  // Ask where to save this summary to
  const labelString = `🖊 Create/update note '${periodString}' in folder '${String(
    config.folderToStore,
  )}'`
  const destination = await chooseOption(
    `Where to save the summary for ${periodString}?`,
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

  // Ask where to send the results
  switch (destination) {
    case 'current': {
      const currentNote = Editor.note
      if (currentNote == null) {
        console.log(`\terror: no note is open`)
      } else {
        console.log(
          `\tappending results to current note (${currentNote.filename ?? ''})`,
        )
        const insertionLineIndex = currentNote.paragraphs.length
        currentNote.insertHeading(
          `${config.occurrencesHeading} ${periodPartStr}`,
          insertionLineIndex,
          config.headingLevel,
        )
        currentNote.appendParagraph(
          outputArray.join('\n'),
          'text',
        )
        console.log(`\tappended results to current note`)
      }
      break
    }
    case 'note': {
      let note: TNote
      // first see if this note has already been created
      // (look only in active notes, not Archive or Trash)
      const existingNotes: $ReadOnlyArray<TNote> =
        DataStore.projectNoteByTitle(periodString, true, false) ?? []

      console.log(
        `\tfound ${existingNotes.length} existing summary notes for this period`,
      )

      if (existingNotes.length > 0) {
        note = existingNotes[0] // pick the first if more than one
        // console.log(`\tfilename of first matching note: ${displayTitle(note)}`)
      } else {
        // make a new note for this. NB: filename here = folder + filename
        const noteFilename = DataStore.newNote(periodString, config.folderToStore) ?? ''
        if (!noteFilename) {
          console.log(`\tError creating new note (filename: ${noteFilename})`)
          await showMessage('There was an error creating the new note')
          return
        }
        console.log(`\tnewNote filename: ${noteFilename}`)
        // $FlowIgnore[incompatible-type]
        note = DataStore.projectNoteByFilename(noteFilename)
        if (note == null) {
          console.log(`\tError getting new note (filename: ${noteFilename})`)
          await showMessage('There was an error getting the new note ready to write')
          return
        }
      }
      console.log(`\twriting results to the new note '${displayTitle(note)}'`)

      // Do we have an existing Hashtag counts section? If so, delete it.
      const insertionLineIndex = removeSection(
        note,
        config.occurrencesHeading,
      )
      console.log(`\tinsertionLineIndex: ${String(insertionLineIndex)}`)
      // Set place to insert either after the found section heading, or at end of note
      // write in reverse order to avoid having to calculate insertion point again
      note.insertHeading(
        `${config.occurrencesHeading} ${periodPartStr}`,
        insertionLineIndex,
        config.headingLevel,
      )
      note.insertParagraph(
        outputArray.join('\n'),
        insertionLineIndex + 1,
        'text',
      )
      await Editor.openNoteByFilename(note.filename)

      console.log(`\twritten results to note '${periodString}'`)
      break
    }

    case 'log': {
      console.log(
        `Summaries for ${periodString} ${periodPartStr}`,
      )
      console.log(outputArray.join('\n'))
      break
    }

    default: {
      break
    }
  }
}

//-------------------------------------------------------------------------------
// Return list of lines matching the specified string in the supplied set of notes
// @param {string} notes - array of Notes to look over
// @param {string} stringToLookFor - string to look for
// @return [Array, Array] - array of lines with matching term, and array of 
//   contexts for those lines (dates for daily notes; title for project notes).
async function gatherMatchingLinesInPeriod(
  notes,
  stringToLookFor
): Promise<[Array<string>, Array<Date>]> {
  const config = await getConfigSettings()
  console.log(`Looking for '${stringToLookFor}' in ${notes.length} notes`)
  CommandBar.showLoading(true, `Searching in ${notes.length} notes ...`)
  await CommandBar.onAsyncThread()

  // work out what set of mentions to look for (or ignore)
  // console.log(`Looking for '${stringToLookFor}' in ${notes.length} relevant daily notes`)

  const matches = []
  const dates: Array<Date> = []
  let i = 0
  for (const n of notes) {
    i += 1
    const noteDate = n.date
    // find any matches
    const matchingParas = n.paragraphs.filter((q) => q.content.includes(stringToLookFor))
    for (const p of matchingParas) {
      // If the stringToLookFor is in the form of an 'attribute::' and found at the start of a line,
      // then remove it from the output line
      let matchLine = p.content
      console.log(`  Found '${stringToLookFor}' in ${matchLine} (${String(noteDate)})`)
      if (stringToLookFor.endsWith('::') && matchLine.startsWith(stringToLookFor)) {
        matchLine = matchLine.replace(stringToLookFor, '') // NB: only removes first instance
        // console.log(`    -> ${matchLine}`)
      }
      // highlight matches if requested
      if (config.highlightOccurrences) {
        matchLine = matchLine.replace(stringToLookFor, `==${stringToLookFor}==`)
      }
      // console.log(`    -> ${matchLine}`)
      matches.push(matchLine.trim())
      dates.push(noteDate)
    }
    if (i % 10 === 0) {
      CommandBar.showLoading(true, `Searching in ${notes.length} notes ...`, (i / notes.length))
    }
  }
  await CommandBar.onMainThread()
  CommandBar.showLoading(false)
  return [matches, dates]
}
