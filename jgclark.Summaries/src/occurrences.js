// @flow
//-----------------------------------------------------------------------------
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// v0.1.0, 11.10.2021
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Helper functions

import {
  displayTitle,
  stringReplace,
} from '../../helpers/general'
import {
  showMessage,
  chooseOption,
  getInput,
} from '../../helpers/userInput'
import {
  quarterStartEnd,
  todaysDateISOString,
  unhyphenatedDate,
  toISOShortDateTimeString,
  toLocaleDateString,
  monthNameAbbrev,
  withinDateRange,
  dateStringFromCalendarFilename,
  toLocaleShortTime,
} from '../../helpers/dateTime'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'
import {
  getPeriodStartEndDates,
  removeSection,
  DEFAULT_SUMMARIES_OPTIONS,
} from './summaryHelpers'

//-----------------------------------------------------------------------------
// Config settings
// Globals, to be looked up later
let pref_folderToStore: string
let pref_occurrencesHeading: string
let pref_occurrencesHeadingLevel: 1 | 2 | 3 | 4 | 5
// let pref_showAsHashtagOrMention: boolean = false
let pref_occurrencesToMatch: $ReadOnlyArray<string> = []
let pref_highlightOccurrences: boolean
let pref_showEmptyOccurrences: boolean

//-------------------------------------------------------------------------------
// Ask user which period to cover, call main stats function, and present results
export async function occurrencesPeriod(): Promise<void> {
  // Get config settings from Template folder _configuration note
  const summConfig = await getOrMakeConfigurationSection(
    'summaries',
    DEFAULT_SUMMARIES_OPTIONS,
    // no minimum config required, as all defaults are given below
  )
  if (summConfig == null) {
    console.log("\tCouldn't find 'occurrences' settings in _configuration note.")
    return
  }

  console.log("\tFound 'occurrences' settings in _configuration note.")
  // now get each setting
  pref_folderToStore =
    summConfig.folderToStore != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.folderToStore
      : 'Summaries'
  // console.log(pref_folderToStore)
  pref_occurrencesHeading =
    summConfig.occurrencesHeading != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.occurrencesHeading
      : 'Occurrences'
  // console.log(pref_occurrencesHeading)
  pref_occurrencesHeadingLevel =
    summConfig.occurrencesHeadingLevel != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.occurrencesHeadingLevel
      : 2
  // console.log(pref_occurrencesHeadingLevel)
  pref_occurrencesToMatch =
    // $FlowIgnore[incompatible-type]
    summConfig.occurrencesToMatch != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.occurrencesToMatch
      : []
  // console.log(pref_occurrencesToMatch)
  pref_highlightOccurrences =
    summConfig.highlightOccurrences != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.highlightOccurrences
      : false
  // console.log(pref_highlightOccurrences)
  pref_showEmptyOccurrences =
    summConfig.showEmptyOccurrences != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.showEmptyOccurrences
      : false
  console.log(pref_showEmptyOccurrences)

  const [fromDate, toDate, periodString, periodPartStr] = await getPeriodStartEndDates()

  if (fromDate == null || toDate == null) {
    console.log('dates could not be parsed')
    return
  }

  console.log(
    `periodOccurrences: calculating for ${periodString} (${toISOShortDateTimeString(fromDate)}-${toISOShortDateTimeString(toDate)})`,
  )

  const fromDateStr = unhyphenatedDate(fromDate) //fromDate.toISOString().slice(0, 10).replace(/-/g, '')
  const toDateStr = unhyphenatedDate(toDate) // toDate.toISOString().slice(0, 10).replace(/-/g, '')
  console.log(
    `\nperiodOccurrences: calculating for ${periodString} (${fromDateStr}-${toDateStr}):`,
  )

  const outputArray = []
  const stringsToMatch = Array.from(pref_occurrencesToMatch)

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
  for (const toMatch of stringsToMatch) {
    // output a heading first
    // get list of matching paragraphs for this string
    const results = gatherMatchingLinesInPeriod(periodDailyNotes, toMatch)
    const lines = results?.[0]
    const dates = results?.[1]
    if (lines.length > 0) {
      console.log(`  Found ${lines.length} results for ${toMatch}`)
      outputArray.push(`### ${toMatch}`)
      // format the output
      for (let i = 0; i < lines.length; i++) {
        outputArray.push(`- ${lines[i]} (${dates[i]})`)
      }
    } else if (pref_showEmptyOccurrences) {
      // If there's nothing to report, make that clear
      outputArray.push(`### ${toMatch}`)
      outputArray.push('(none)')
    }
  }

  // Ask where to save this summary to
  const labelString = `🖊 Add/update note '${periodString}' in folder '${String(
    pref_folderToStore,
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
        label: '📋 Write to console log',
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
          `${pref_occurrencesHeading} ${periodPartStr}`,
          insertionLineIndex,
          pref_occurrencesHeadingLevel,
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
      let note: ?TNote
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
        const noteFilename = DataStore.newNote(periodString, pref_folderToStore)
        if (!noteFilename) {
          console.log(`\tError creating new note (filename: ${noteFilename})`)
          await showMessage('There was an error creating the new note')
          return
        }
        console.log(`\tnewNote filename: ${noteFilename}`)
        note = DataStore.projectNoteByFilename(noteFilename)
        if (note == null) {
          console.log(`\tError getting new note (filename: ${noteFilename})`)
          await showMessage('There was an error getting the new note ready to write')
          return
        }
      }
      console.log(`\twriting results to the new note '${displayTitle(note)}'`)

      // const nonNullNote = note
      // Do we have an existing Hashtag counts section? If so, delete it.
      const insertionLineIndex = removeSection(
        note,
        pref_occurrencesHeading,
      )
      console.log(`\tinsertionLineIndex: ${String(insertionLineIndex)}`)
      // Set place to insert either after the found section heading, or at end of note
      // write in reverse order to avoid having to calculate insertion point again
      note.insertHeading(
        `${pref_occurrencesHeading} ${periodPartStr}`,
        insertionLineIndex,
        pref_occurrencesHeadingLevel,
      )
      console.log(outputArray.join('\n'))
      note.insertParagraph(
        outputArray.join('\n'),
        insertionLineIndex + 1,
        'text',
      )
      Editor.openNoteByFilename(note.filename)

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
// Return list of lines matching the specified string in daily notes of a given time period.
// @param {string} periodDailyNotes - array of Notes to look over
// @param {string} stringToLookFor - string to look for
// @return [Array, Array] - array of lines with matching hashtag, and array of dates of those lines
function gatherMatchingLinesInPeriod(
  periodDailyNotes,
  stringToLookFor
): [Array<string>, Array<string>] {

  // work out what set of mentions to look for (or ignore)
  // console.log(`Looking for '${stringToLookFor}' in ${periodDailyNotes.length} relevant daily notes`)

  const matches = []
  const dates = []
  for (const n of periodDailyNotes) {
    const noteDate = (n.date != null) ? toLocaleDateString(n.date) : '(no date)'
    // find any matches
    const matchingParas = n.paragraphs.filter((q) => q.content.includes(stringToLookFor))
    for (const p of matchingParas) {
      // If the stringToLookFor is in the form of an 'attribute::' and found at the start of a line,
      // then remove it from the output line
      let matchLine = p.content
      console.log(`  Found '${stringToLookFor}' in ${matchLine} (${noteDate})`)
      if (stringToLookFor.endsWith('::') && matchLine.startsWith(stringToLookFor)) {
        matchLine = matchLine.replace(stringToLookFor, '') // NB: only removes first instance
        // console.log(`    -> ${matchLine}`)
      }
      // highlight matches if requested
      if (pref_highlightOccurrences) {
        matchLine = matchLine.replace(stringToLookFor, `==${stringToLookFor}==`)
      }
      // console.log(`    -> ${matchLine}`)
      matches.push(matchLine.trim())
      dates.push(noteDate)
    }
  }
  return [matches, dates]
}
