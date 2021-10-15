// @flow
//-----------------------------------------------------------------------------
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// v0.2.0, 15.10.2021
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Helper functions

import {
  displayTitle,
  stringReplace,
  getFolderFromFilename,
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
  toISODateString,
  toISOShortDateTimeString,
  toLocaleDateString,
  monthNameAbbrev,
  withinDateRange,
  dateStringFromCalendarFilename,
  // toLocaleShortTime,
  nowLocaleDateTime,
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
let pref_foldersToIgnore: Array<string> = []
let pref_headingLevel: 1 | 2 | 3 | 4 | 5
let pref_highlightOccurrences: boolean
let pref_addDates: string

async function getPluginSettings(): Promise<void> {
  // Get config settings from Template folder _configuration note
  const summConfig = await getOrMakeConfigurationSection(
    'summaries',
    DEFAULT_SUMMARIES_OPTIONS,
    // no minimum config required, as all defaults are given below
  )
  if (summConfig == null) {
    console.log("\tCouldn't find 'summaries' settings in _configuration note.")
    return
  }

  console.log("\tFound 'summaries' settings in _configuration note.")
  // now get each setting
  pref_folderToStore =
    summConfig.folderToStore != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.folderToStore
      : 'Summaries'
  // console.log(pref_folderToStore)
  pref_foldersToIgnore =
    summConfig.foldersToIgnore != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.foldersToIgnore
      : ['📋 Templates']
  // console.log(String(pref_foldersToIgnore))
  pref_headingLevel =
    summConfig.headingLevel != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.headingLevel
      : 2
  // console.log(pref_headingLevel)
  pref_highlightOccurrences =
    summConfig.highlightOccurrences != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.highlightOccurrences
      : false
  // console.log(pref_highlightOccurrences)
  pref_addDates =
    summConfig.addDates != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.addDates
      : 'links'
  // console.log(pref_addDates)
}

//-------------------------------------------------------------------------------
// Ask user which period to cover, call main stats function, and present results
export async function saveSearch(): Promise<void> {
  // get relevant settings
  await getPluginSettings()

  // Create list of project notes not in excluded folders
  const allProjectNotes = DataStore.projectNotes
  const projectNotesToInclude = []
  // Iterate over the folders ...
  for (const pn of allProjectNotes) {
    const thisFolder = getFolderFromFilename(pn.filename)
    if (!pref_foldersToIgnore.includes(thisFolder)) {
      projectNotesToInclude.push(pn)
    } else {
      console.log(pn.filename)
    }
  }
  console.log(`Will use ${projectNotesToInclude.length} project notes out of ${allProjectNotes.length}`)
  // Add all the calendar notes
  const notes = DataStore.calendarNotes.concat(projectNotesToInclude)

  // Ask user for search term
  const searchTerm = await getInput(`Exact word/phrase to search for`)

  // Find matches in this set of notes for the time period
  const outputArray = []
  // output a heading first
  const results = await gatherMatchingLines(notes, searchTerm)
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
  const labelString = `🖊 Create/update note in folder '${pref_folderToStore}'`
  const destination = await chooseOption(
    `Where should I save the search results?`,
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
          `\tappending results to current note (${currentNote.filename ?? ''})`,
        )
        const insertionLineIndex = currentNote.paragraphs.length
        currentNote.insertHeading(
          `${headingString} at ${currentDate}`,
          insertionLineIndex,
          pref_headingLevel,
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
        const noteFilename = DataStore.newNote(requestedTitle, pref_folderToStore) ?? ''
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
        pref_headingLevel,
      )
      note.insertParagraph(
        outputArray.join('\n'),
        insertionLineIndex + 1,
        'text',
      )
      Editor.openNoteByFilename(note.filename)

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

//-------------------------------------------------------------------------------
// Return list of lines matching the specified string in project or daily notes.
// @param {string} notes - array of Notes to look over
// @param {string} stringToLookFor - string to look for
// @return [Array, Array] - array of lines with matching hashtag, and array of 
//   contexts for those lines (dates for daily notes; title for project notes).
async function gatherMatchingLines(
  notes,
  stringToLookFor
): Promise<[Array<string>, Array<string>]> {

  console.log(`Looking for '${stringToLookFor}' in ${notes.length} notes`)
  CommandBar.showLoading(true, `Searching in ${notes.length} notes ...`)
  await CommandBar.onAsyncThread()

  const matches: Array<string> = []
  const noteContexts: Array<string> = []
  let i = 0
  for (const n of notes) {
    i += 1
    const noteContext = (n.date != null)
      ? `>${toISODateString(n.date)}`
      : `[[${n.title ?? ''}]]`
    // find any matches
    const matchingParas = n.paragraphs.filter((q) => q.content.includes(stringToLookFor))
    for (const p of matchingParas) {
      // If the stringToLookFor is in the form of an 'attribute::' and found at the start of a line,
      // then remove it from the output line
      let matchLine = p.content
      // console.log(`  Found '${stringToLookFor}' in ${matchLine} (${noteContext})`)
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
      noteContexts.push(noteContext)
    }
    if (i % 20 === 0) {
      CommandBar.showLoading(true, `Searching in ${notes.length} notes ...`, (i / notes.length))
    }
  }
  await CommandBar.onMainThread()
  CommandBar.showLoading(false)
  return [matches, noteContexts]
}
