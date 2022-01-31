// @flow
//-----------------------------------------------------------------------------
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 30.1.2022 for v0.5.1, @jgclark
//-----------------------------------------------------------------------------

import {
  gatherMatchingLines,
  getConfigSettings,
  getPeriodStartEndDates,
} from './summaryHelpers'
import type { SummariesConfig } from './summaryHelpers'
import {
  todaysDateISOString,
  unhyphenatedDate,
  toISODateString,
  toISOShortDateTimeString,
  toLocaleDateString,
  monthNameAbbrev,
  withinDateRange,
  dateStringFromCalendarFilename,
  nowLocaleDateTime,
} from '../../helpers/dateTime'
import {
  quarterStartEnd,
} from '../../helpers/NPdateTime'
import { getFolderFromFilename } from '../../helpers/folders'
import {
  displayTitle,
  stringReplace,
} from '../../helpers/general'
import {
  removeSection,
} from '../../helpers/paragraph'
import {
  showMessage,
  chooseOption,
  getInput,
} from '../../helpers/userInput'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

//-------------------------------------------------------------------------------

/**
 * Ask user what word/phrase to search for, run the search, 
 * and ask where to save/show the results
 * @author @jgclark
 */
export async function saveSearch(): Promise<void> {
  // get relevant settings
  let config = await getConfigSettings()

  // Ask user for search term
  const searchTerm = await getInput(`Exact word/phrase to search for`)
  if (typeof searchTerm === 'boolean') {
    // i.e. user has cancelled
    console.log(`User has cancelled operation.`)
    return
  }

  // Create list of project notes not in excluded folders
  const allProjectNotes = DataStore.projectNotes
  const projectNotesToInclude = []
  // Iterate over the folders ...
  for (const pn of allProjectNotes) {
    const thisFolder = getFolderFromFilename(pn.filename)
    if (!config.foldersToIgnore.includes(thisFolder)) {
      projectNotesToInclude.push(pn)
    } else {
      console.log(pn.filename)
    }
  }
  console.log(`Will use ${projectNotesToInclude.length} project notes out of ${allProjectNotes.length}`)
  // Add all the calendar notes
  const notes = DataStore.calendarNotes.concat(projectNotesToInclude)

  // Find matches in this set of notes for the time period
  const outputArray = []
  // output a heading first
  const results = await gatherMatchingLines(notes, searchTerm, config.highlightOccurrences, config.dateStyle)
  const lines = results?.[0]
  const contexts = results?.[1]
  if (lines.length > 0) {
    // outputArray.push(`### ${searchTerm}`)
    console.log(`  Found ${lines.length} results for '${searchTerm}'`)
    // format the output
    for (let i = 0; i < lines.length; i++) {
      outputArray.push(`- ${lines[i]} ${contexts[i]}`)
    }
  } else {
    // If there's nothing to report, make that clear
    // outputArray.push(`### ${searchTerm}`)
    outputArray.push('(no matches)')
  }

  // Ask where to save this summary to
  const labelString = `🖊 Create/update note in folder '${config.folderToStore}'`
  const destination = await chooseOption(
    `Where should I save the ${lines.length} search results?`,
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
  const currentDate = nowLocaleDateTime
  const headingString = `Search results for '${searchTerm}'`
  switch (destination) {
    case 'current': {
      const currentNote = Editor.note
      if (currentNote == null) {
        console.log(`\terror: no note is open`)
      } else {
        console.log(
          `\tappending ${lines.length} results to current note (${currentNote.filename ?? ''})`,
        )
        const insertionLineIndex = currentNote.paragraphs.length
        currentNote.insertHeading(
          `${headingString} at ${currentDate}`,
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
      const requestedTitle = await getInput(`What do you want to call this note?`)
      if (typeof requestedTitle === 'boolean') {
        // i.e. user has cancelled
        console.log(`User has cancelled operation.`)
        return
      }

      let note: TNote
      // first see if this note has already been created
      // (look only in active notes, not Archive or Trash)
      const existingNotes: $ReadOnlyArray<TNote> =
        DataStore.projectNoteByTitle(requestedTitle, true, false) ?? []

      console.log(
        `\tfound ${existingNotes.length} existing ${requestedTitle} notes`,
      )

      if (existingNotes.length > 0) {
        note = existingNotes[0] // pick the first if more than one
        // console.log(`\tfilename of first matching note: ${displayTitle(note)}`)
      } else {
        // make a new note for this. NB: filename here = folder + filename
        const noteFilename = DataStore.newNote(requestedTitle, config.folderToStore) ?? ''
        if (noteFilename === '') {
          console.log(`\tError creating new note (filename '${noteFilename}')`)
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

      // const note = note
      // Do we have an existing Hashtag counts section? If so, delete it.
      const insertionLineIndex = removeSection(
        note,
        headingString,
      )
      console.log(`\tinsertionLineIndex: ${String(insertionLineIndex)}`)
      // Set place to insert either after the found section heading, or at end of note
      // write in reverse order to avoid having to calculate insertion point again
      note.insertHeading(
        `${headingString} at ${currentDate}`,
        insertionLineIndex,
        config.headingLevel,
      )
      note.insertParagraph(
        outputArray.join('\n'),
        insertionLineIndex + 1,
        'text',
      )
      await Editor.openNoteByFilename(note.filename)

      console.log(`\twritten results to note '${requestedTitle}'`)
      break
    }

    case 'log': {
      console.log(
        `Search results for '${searchTerm}', ${currentDate}`,
      )
      console.log(outputArray.join('\n'))
      break
    }

    default: {
      break
    }
  }
}
