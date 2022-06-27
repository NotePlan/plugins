// @flow
//-----------------------------------------------------------------------------
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 27.6.2022 for v0.11.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  getSummariesSettings,
} from './summaryHelpers'
import {
  nowLocaleDateTime,
} from '@helpers/dateTime'
import { log, logWarn, logError, timer } from '@helpers/dev'
// import { getFolderFromFilename } from '@helpers/folders'
import { displayTitle, titleAsLink } from '@helpers/general'
import { removeSection, termInMarkdownPath, termInURL } from '@helpers/paragraph'
// import { gatherMatchingLines } from '@helpers/NPParagraph'
import {
  showMessage,
  chooseOption,
  getInput,
} from '@helpers/userInput'

//-------------------------------------------------------------------------------

/**
 * Run a search over all notes, saving the results in one of several locations.
 * Works interactively (if no arguments given) or in the background (using supplied arguments).
 * @author @jgclark
 * 
 * @param {string?} searchTermsArg optional comma-separated list of search terms to search
 */
export async function saveSearch(searchTermsArg?: string): Promise<void> {
  // get relevant settings
  const config = await getSummariesSettings()
  const headingMarker = '#'.repeat(config.headingLevel)

  // Get the search terms
  let stringsToMatch = []
  if (searchTermsArg !== undefined) {
    // either from argument supplied
    stringsToMatch = searchTermsArg.split(',')
    log(pluginJson, `saveSearch: will use arg0 '${searchTermsArg}'`)
  }
  else {
    // or by asking user
    stringsToMatch = Array.from(config.defaultOccurrences)
    const newTerms = await getInput(`Enter search term (or comma-separated set of terms)`, 'OK', `Search`, stringsToMatch.join(', '))
    if (typeof newTerms === 'boolean') {
      // i.e. user has cancelled
      log(pluginJson, `User has cancelled operation.`)
      return
    } else {
      stringsToMatch = Array.from(newTerms.split(','))
    }
  }
  log(pluginJson, `saveSearch: looking for '${String(stringsToMatch)}' over all notes:`)

  // // Create list of project notes not in excluded folders
  // const allProjectNotes = DataStore.projectNotes
  // const projectNotesToInclude = []
  // // Iterate over the folders ...
  // for (const pn of allProjectNotes) {
  //   const thisFolder = getFolderFromFilename(pn.filename)
  //   if (!config.foldersToExclude.includes(thisFolder)) {
  //     projectNotesToInclude.push(pn)
  //   } else {
  //     // log(pluginJson, `  excluded note '${pn.filename}'`)
  //   }
  // }
  // // log(pluginJson, `  (using ${projectNotesToInclude.length} project notes out of ${allProjectNotes.length})`)
  // // Add all the calendar notes
  // const notes = DataStore.calendarNotes.concat(projectNotesToInclude)

  //---------------------------------------------------------
  // Find matches in this set of notes (original method)
  let startTime = new Date
  let resultCount = 0
  const outputArray = []
  // for (const searchTerm of stringsToMatch) {
  //   const results = gatherMatchingLines(notes, searchTerm,
  //     config.highlightOccurrences, config.dateStyle, config.matchCase)
  //   const lines = results?.[0]
  //   const contexts = results?.[1]
  //   // write output, starting with a heading if needed
  //   if (lines.length > 0) {
  //     log(pluginJson, `  Found ${lines.length} results for '${searchTerm}'`)
  //     // format the output
  //     for (let i = 0; i < lines.length; i++) {
  //       outputArray.push(`${config.resultPrefix}${lines[i]} ${contexts[i]}`)
  //       resultCount += 1
  //     }
  //     outputArray.unshift(`${headingMarker} ${searchTerm}`)
  //   } else if (config.showEmptyOccurrences) {
  //     // If there's nothing to report, make that clear
  //     outputArray.push(`${headingMarker} ${searchTerm}`)
  //     outputArray.push('(no matches)')
  //   }
  // }
  // const elapsedTimeGML = timer(startTime)
  // log(pluginJson, `Search time (GML): ${elapsedTimeGML} -> ${resultCount} results`)

  //---------------------------------------------------------
  // newer method using search() API available from v3.6.0
  startTime = new Date
  resultCount = 0
  for (const searchTerm of stringsToMatch) {
    // get list of matching paragraphs for this string
    const resultParas = await DataStore.search(searchTerm, ['calendar', 'notes'], undefined, config.foldersToExclude) // search over all notes
    const lines = resultParas
    // output a heading first
    outputArray.push(`${headingMarker} ${searchTerm}`)
    if (lines.length > 0) {
      log(pluginJson, `  Found ${lines.length} results for '${searchTerm}'`)
      // form the output
      for (let i = 0; i < lines.length; i++) {
        let matchLine = lines[i].content
        // If the test is within a URL or the path of a [!][link](path) skip this result
        if (termInURL(searchTerm, matchLine)) {
          log(pluginJson, `- Info: Match '${searchTerm}' ignored in '${matchLine} because it's in a URL`)
          continue
        }
        if (termInMarkdownPath(searchTerm, matchLine)) {
          log(pluginJson, `- Info: Match '${searchTerm}' ignored in '${matchLine} because it's in a [...](path)`)
          continue
        }
        // Format the line for output (trimming, highlighting)
        matchLine = trimAndHighlightSearchResult(matchLine, searchTerm, config.highlightOccurrences, 80)
        // Make context suffix
        const suffix = `(from ${titleAsLink(lines[i].note)})`
        outputArray.push(`${config.resultPrefix}${matchLine} ${suffix}`)
        resultCount += 1
      }
    } else if (config.showEmptyOccurrences) {
      // If there's nothing to report, make that clear
      outputArray.push('(no matches)')
    }
  }
  const elapsedTimeAPI = timer(startTime)
  log(pluginJson, `Search time (API): ${elapsedTimeAPI} -> ${resultCount} results`)


  // Work out where to save this summary to
  let destination = ''
  if (searchTermsArg !== undefined) {
    // Being called from x-callback so will only write to current note
    log(pluginJson, `  running from x-callback so will write to current note`)
    destination = 'current'
  }
  else {
    // else ask user
    const labelString = `🖊 Create/update note in folder '${config.folderToStore}'`
    destination = await chooseOption(
      `Where should I save the ${resultCount} search results?`,
      [
        {
          label: labelString,
          value: 'newnote',
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
      'newnote',
    )
  }

  const headingString = `${resultCount} ${config.occurrencesHeading} (at ${nowLocaleDateTime})`
  switch (destination) {
    case 'current': {
      const currentNote = Editor.note
      if (currentNote == null) {
        logError(pluginJson, `No note is open`)
      } else {
        log(pluginJson,
          `  appending ${outputArray.length} results to current note (${currentNote.filename ?? ''})`,
        )
        const insertionLineIndex = currentNote.paragraphs.length - 1
        currentNote.insertHeading(
          headingString,
          insertionLineIndex,
          config.headingLevel,
        )
        currentNote.appendParagraph(
          outputArray.join('\n'),
          'text',
        )
        // log(pluginJson, `\tappended results to current note`)
      }
      break
    }
    case 'newnote': {
      const requestedTitle = await getInput(`What do you want to call this note?`)
      if (typeof requestedTitle === 'boolean') {
        // i.e. user has cancelled
        logWarn(pluginJson, `User has cancelled operation.`)
        return
      }

      let note: ?TNote
      // first see if this note has already been created
      // (look only in active notes, not Archive or Trash)
      const existingNotes: $ReadOnlyArray<TNote> =
        DataStore.projectNoteByTitle(requestedTitle, true, false) ?? []

      // log(pluginJson,`  found ${existingNotes.length} existing ${requestedTitle} notes`)

      if (existingNotes.length > 0) {
        note = existingNotes[0] // pick the first if more than one
        // log(pluginJson, `  filename of first matching note: ${displayTitle(note)}`)
      } else {
        // make a new note for this. NB: filename here = folder + filename
        const noteFilename = DataStore.newNote(requestedTitle, config.folderToStore) ?? ''
        if (noteFilename === '') {
          logError(pluginJson, `  Error creating new note (filename '${noteFilename}')`)
          await showMessage('There was an error creating the new note')
          return
        }
        log(pluginJson, `  newNote filename: ${noteFilename}`)
        note = DataStore.projectNoteByFilename(noteFilename)
        if (note == null) {
          logError(pluginJson, `Can't get new note (filename: ${noteFilename})`)
          await showMessage('There was an error getting the new note ready to write')
          return
        }
      }
      log(pluginJson, `  writing results to the new note '${displayTitle(note)}'`)

      // Do we have an existing Hashtag counts section? If so, delete it.
      // (Sets place to insert either after the found section heading, or at end of note)
      const insertionLineIndex = removeSection(
        note,
        headingString,
      )
      // write in reverse order to avoid having to calculate insertion point again
      note.insertParagraph(
        outputArray.join('\n'),
        insertionLineIndex + 1,
        'text',
      )
      note.insertHeading(
        headingString,
        insertionLineIndex,
        config.headingLevel,
      )
      await Editor.openNoteByFilename(note.filename)

      log(pluginJson, `  written results to note '${requestedTitle}'`)
      break
    }

    case 'log': {
      log(pluginJson, headingString)
      log(pluginJson, outputArray.join('\n'))
      break
    }

    case 'cancel': {
      log(pluginJson, `User cancelled command`)
      break
    }

    default: {
      logError(pluginJson, `No valid save location code supplied`)
      break
    }
  }
}

/**
 * Take a line of text, shorten it to maxChars characters around the first matching 'term',
 * at word boundaries (thanks to the power of regex!). Add ==highlight== if wanted.
 * @author @jgclark
 * 
 * @param {string} input string
 * @param {String} term to find/highlight
 * @param {boolean} addHighlight 
 * @param {number} maxChars to return around first matching term
 * @returns {string}
 */
function trimAndHighlightSearchResult(
  input: string,
  term: string,
  addHighlight: boolean,
  maxChars: number = 60
): string {
  let output = input
  const LRSplit = Math.round(maxChars * 0.55)
  const re = new RegExp(`(?:^|\\b)(.{0,${String(LRSplit)}}${term}.{0,${String(maxChars - LRSplit)}})\\b\\w+`, "gi")
  const matches = input.match(re) ?? [] // multiple matches
  if (matches.length > 0) {
    output = matches.join(' ...')
    if (output.match(/^\W/)) { // i.e. starts with a non-word character (an approximation)
      output = `...${output}`
    }
    if (output.length < input.length) { // TODO: an approximation
      output = `${output} ...`
    }
    // Add highlighting if wanted (using defined Regex si can use 'g' flag)
    // (A simple .replace() command doesn't work as it won't keep capitalisation)
    if (addHighlight) {
      const re = new RegExp(term, "gi") // TODO: highlight each term found
      const leftPos = Array.from(output.matchAll(re))[0].index
      const rightPos = leftPos + term.length
      const highlitOutput = `${output.slice(0, leftPos)}==${output.slice(leftPos, rightPos)}==${output.slice(rightPos,)}`
      return highlitOutput
    } else {
      return output
    }
    //
  } else {
    // For some reason we didn't find the matching term, so return first part of line
    return (output.length >= maxChars) ? output.slice(0, maxChars) : output
  }
}
