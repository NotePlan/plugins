// @flow
//-----------------------------------------------------------------------------
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 29.6.2022 for v0.1.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getSearchSettings } from './searchHelpers'
import { nowLocaleDateTime } from '@helpers/dateTime'
import { log, logWarn, logError, timer } from '@helpers/dev'
// import { getFolderFromFilename } from '@helpers/folders'
import { displayTitle, titleAsLink } from '@helpers/general'
import { replaceSection } from '@helpers/note'
import { removeSection, termInMarkdownPath, termInURL, trimAndHighlightSearchResult } from '@helpers/paragraph'
// import { gatherMatchingLines } from '@helpers/NPParagraph'
import {
  chooseOption,
  getInput,
  // showMessage,
} from '@helpers/userInput'

// import noLabelVar from "eslint/lib/rules/no-label-var";

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
  const config = await getSearchSettings()
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
  // newer search method using search() API available from v3.6.0
  startTime = new Date
  resultCount = 0
  for (const searchTerm of stringsToMatch) {
    // get list of matching paragraphs for this string
    const resultParas = await DataStore.search(searchTerm, ['calendar', 'notes'], undefined, config.foldersToExclude) // search over all notes
    const lines = resultParas
    // output a heading first
    outputArray.push(`${headingMarker} ${config.occurrencesHeading} for '${searchTerm}' at ${nowLocaleDateTime}`)
    if (lines.length > 0) {
      log(pluginJson, `  Found ${lines.length} results for '${searchTerm}'`)

      // form the output
      let previousNoteTitle = ''
      for (let i = 0; i < lines.length; i++) {
        let matchLine = lines[i].content
        const thisNoteTitle = displayTitle(lines[i].note)
        // If the test is within a URL or the path of a [!][link](path) skip this result
        if (termInURL(searchTerm, matchLine)) {
          log(pluginJson, `- Info: Match '${searchTerm}' ignored in '${matchLine} because it's in a URL`)
          continue
        }
        if (termInMarkdownPath(searchTerm, matchLine)) {
          log(pluginJson, `- Info: Match '${searchTerm}' ignored in '${matchLine} because it's in a [...](path)`)
          continue
        }
        // Format the line and context for output (trimming, highlighting)
        // TODO: add setting for length
        matchLine = trimAndHighlightSearchResult(matchLine, searchTerm, config.highlightOccurrences, 100)
        if (config.groupResultsByNote) {
          // Write out note title (if not seen before) then the matchLine
          if (previousNoteTitle !== thisNoteTitle) {
            outputArray.push(`${headingMarker}# ${titleAsLink(lines[i].note)}:`) // i.e. lower level heading + note title
          }
          outputArray.push(`${config.resultPrefix}${matchLine}`)
        } else {
          // Write out matchLine followed by note title
          const suffix = `(from ${titleAsLink(lines[i].note)})`
          outputArray.push(`${config.resultPrefix}${matchLine} ${suffix}`)
        }
        resultCount += 1
        previousNoteTitle = thisNoteTitle
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
          // TODO: Make it open in split note
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

  // const headingString = `${resultCount} ${config.occurrencesHeading}`
  switch (destination) {
    case 'current': {
      // TODO: use replaceSection logic
      const currentNote = Editor.note
      if (currentNote == null) {
        logError(pluginJson, `No note is open`)
      } else {
        // log(pluginJson, `  appending results to current note (${currentNote.filename ?? ''})`)
        // const insertionLineIndex = currentNote.paragraphs.length - 1
        // currentNote.insertHeading(
        //   headingString,
        //   insertionLineIndex,
        //   config.headingLevel,
        // )
        currentNote.appendParagraph(
          outputArray.join('\n'),
          'text',
        )
      }
      break
    }
    case 'newnote': {
      // TODO: use replaceSection logic
      const requestedTitle = await getInput(`What do you want to call this note?`, 'OK', 'Save Search Results to Note', `Search Results at ${nowLocaleDateTime}`)
      if (typeof requestedTitle === 'boolean') {
        // i.e. user has cancelled
        logWarn(pluginJson, `User has cancelled operation.`)
        return
      }

      const newNoteFilename = DataStore.newNoteWithContent(outputArray.join('\n'), config.folderToStore, requestedTitle)

      await Editor.openNoteByFilename(newNoteFilename)
      log(pluginJson, `  written results to note '${newNoteFilename}'`)
      break
    }

    case 'log': {
      // log(pluginJson, headingString)
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

