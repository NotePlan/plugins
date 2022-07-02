// @flow
//-----------------------------------------------------------------------------
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 2.7.2022 for v0.1.0, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Helper functions

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  getSearchSettings,
  type resultObjectType,
  runSearches,
  writeResultsNote,
} from './searchHelpers'
import {
  formatNoteDate,
  getDateStringFromCalendarFilename,
  // nowLocaleDateTime,
  RE_ISO_DATE,
  RE_YYYYMMDD_DATE,
  unhyphenateString,
  unhyphenatedDate,
  withinDateRange,
} from '@helpers/dateTime'
import { getPeriodStartEndDates } from '@helpers/NPdateTime'
import { log, logWarn, logError, timer } from '@helpers/dev'
import { titleAsLink } from '@helpers/general'
import { replaceSection } from '@helpers/note'
import { isTermInMarkdownPath, isTermInURL } from '@helpers/paragraph'
import { trimAndHighlightTermInLine } from '@helpers/search'
import {
  chooseOption,
  getInput,
  showMessage,
} from '@helpers/userInput'

//-------------------------------------------------------------------------------

/**
 * Run a search over all notes in a given period, saving the results in one of several locations.
 * Works interactively (if no arguments given) or in the background (using supplied arguments).
 * Uses 'moment' library to work out time periods.
 * @author @jgclark
 *
 * @param {string?} searchTermsArg optional comma-separated list of search terms to search
 * @param {number?} periodArg optional number of days to search over (from before today). If not given then defaults to 3 months
 */
export async function saveSearchPeriod(
  searchTermsArg?: string,
  fromDateArg?: string = 'default',
  toDateArg?: string = 'default',
): Promise<void> {
  try {
    // Get config settings from Template folder _configuration note
    // await getPluginSettings()
    const config = await getSearchSettings()
    const headingMarker = '#'.repeat(config.headingLevel)
    let calledIndirectly = false

    // Work out time period to cover
    let fromDate: Date
    let fromDateStr = ''
    let toDate: Date
    let toDateStr = ''
    let periodString = ''
    let periodPartStr = ''
    let periodType = ''
    if (searchTermsArg !== undefined) {
      // Use supplied arguments
      if (fromDateArg === 'default') {
        fromDate = moment.now().startOf('day').subtract(91, 'days').toJSDate() // 91 days ago
      } else {
        // cope with YYYYMMDD or YYYY-MM-DD formats
        fromDateStr = fromDateArg.match(RE_ISO_DATE) // for YYYY-MM-DD
          ? fromDateArg
          : fromDateArg.match(RE_YYYYMMDD_DATE) // for YYYYMMDD
            ? unhyphenateString(fromDateArg)
            : 'error'
      }
      if (fromDateArg === 'default') {
        toDate = moment.now().startOf('day').toJSDate() // today
      } else {
        // cope with YYYYMMDD or YYYY-MM-DD formats
        toDateStr = toDateArg.match(RE_ISO_DATE) // for YYYY-MM-DD
          ? toDateArg
          : toDateArg.match(RE_YYYYMMDD_DATE) // for YYYYMMDD
            ? unhyphenateString(toDateArg)
            : 'error'
      }
      periodString = `${fromDateStr} - ${toDateStr}`
    } else {
      // Otherwise ask user
      [fromDate, toDate, periodType, periodString, periodPartStr] = await getPeriodStartEndDates(`What period shall I search over?`) // eslint-disable-line
      if (fromDate == null || toDate == null) {
        logError(pluginJson, 'dates could not be parsed')
        return
      }
      fromDateStr = unhyphenatedDate(fromDate)
      toDateStr = unhyphenatedDate(toDate)
    }
    log(pluginJson, `  time period: ${periodString}`)

    // Get the search terms, treating ' OR ' and ',' as equivalent term separators
    let termsToMatchArr = []
    if (searchTermsArg !== undefined) {
      // either from argument supplied
      termsToMatchArr = searchTermsArg.replace(/ OR /, ',').split(',')
      log(pluginJson, `  will use arg0 '${searchTermsArg}'`)
      calledIndirectly = true
    } else {
      // or by asking user
      const defaultTermsToMatchStr = config.defaultSearchTerms.join(', ')
      const newTerms = await getInput(`Enter search term (or comma-separated set of terms)`, 'OK', `Search`, defaultTermsToMatchStr)
      if (typeof newTerms === 'boolean') {
        // i.e. user has cancelled
        log(pluginJson, `User has cancelled operation.`)
        return
      } else {
        termsToMatchArr = Array.from(newTerms.replace(/ OR /, ',').split(','))
      }
    }

    // Weed out any too-short search terms
    const filteredTermsToMatchArr = termsToMatchArr.filter((t) => t.length > 2)
    const termsToMatchStr = String(filteredTermsToMatchArr)
    log(pluginJson, `Search terms: ${termsToMatchStr} over all Calendar notes (except in folders ${config.foldersToExclude.join(', ')})`)
    if (filteredTermsToMatchArr.length < termsToMatchArr.length) {
      logWarn(pluginJson, `Note: some search terms were removed because they were less than 3 characters long.`)
      await showMessage(`Some search terms were removed as they were less than 3 characters long.`)
    }
    // Stop if we don't have any search terms
    if (termsToMatchArr.length === 0 || termsToMatchStr === '') {
      logWarn(pluginJson, 'no search terms given; stopping.')
      await showMessage(`No search terms given; stopping.`)
      return
    }
    // Stop if we have a silly number of search terms
    if (termsToMatchArr.length > 7) {
      logWarn(pluginJson, `too many search terms given (${termsToMatchArr.length}); stopping as this might be an error.`)
      await showMessage(`Too many search terms given(${termsToMatchArr.length}); stopping as this might be an error.`)
      return
    }

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

    //------------------------------------------------------------
    // Find matches in notes for the time period (original method)
    // const outputArray = []
    // let resultCount = 0
    // let startTime = new Date // for timer
    // for (const untrimmedSearchTerm of filteredTermsToMatchArr) {
    //   const searchTerm = untrimmedSearchTerm.trim()
    //   // get list of matching paragraphs for this string
    //   // FIXME: why always zero results?
    //   const results = gatherMatchingLines(periodDailyNotes, searchTerm,
    //     config.highlightResults, config.dateStyle, config.matchCase)
    //   const lines = results?.[0]
    //   resultCount += lines.length
    //   const context = results?.[1]
    //   // output a heading first
    //   outputArray.push(`${headingMarker} ${searchTerm}`)
    //   if (lines.length > 0) {
    //     log(pluginJson, `- Found ${lines.length} results for '${searchTerm}'`)
    //     // form the output
    //     for (let i = 0; i < lines.length; i++) {
    //       outputArray.push(`${config.resultPrefix}${lines[i]} ${context[i]}`)
    //     }
    //   } else if (config.showEmptyResults) {
    //     // If there's nothing to report, make that clear
    //     outputArray.push('(no matches)')
    //   }
    // }
    // const elapsedTimeGML = timer(startTime)
    // log(pluginJson, `Search time (GML): ${elapsedTimeGML} -> ${resultCount} results`)

    //-------------------------------------------------------------
    // newer search method using search() API available from v3.6.0
    // Strategy: search all calendar notes, and then only select in
    // the notes that match the selected time period.
    // TODO: Ideally update runSearches/runSearch to be able to be used here
    // TODO: and then switch to using Promise system
    const startTime = new Date
    let resultCount = 0
    const results: Array<resultObjectType> = []
    for (const untrimmedSearchTerm of filteredTermsToMatchArr) {
      const searchTerm = untrimmedSearchTerm.trim()
      const outputArray = []
      // get list of matching paragraphs for this string
      const resultParas = await DataStore.search(searchTerm, ['calendar'], undefined, config.foldersToExclude) // search over all notes
      const lines = resultParas
      // output a heading first
      // const thisResultHeading = `${searchTerm} ${config.searchHeading} for ${periodString}${periodPartStr !== '' ? ` (at ${periodPartStr})` : ''}`
      // outputArray.push(`${headingMarker} '${searchTerm}' ${config.searchHeading} for ${periodString}${periodPartStr !== '' ? ` (at ${periodPartStr})` : ''}`)
      if (lines.length > 0) {
        log(pluginJson, `- Found ${lines.length} results for '${searchTerm}'`)

        // form the output
        let previousNoteTitle = ''
        for (let i = 0; i < lines.length; i++) {
          let matchLine = lines[i].content
          const thisNoteTitleDisplay = (lines[i].note.date != null)
            ? formatNoteDate(lines[i].note.date, config.dateStyle)
            : titleAsLink(lines[i].note)
          // Keep this match if within selected date range
          if (withinDateRange(getDateStringFromCalendarFilename(lines[i].note.filename), fromDateStr, toDateStr)) {
            // const thisNoteTitle = displayTitle(lines[i].note)
            // If the test is within a URL or the path of a [!][link](path) skip this result
            if (isTermInURL(searchTerm, matchLine)) {
              log(pluginJson, `  - Info: Match '${searchTerm}' ignored in '${matchLine} because it's in a URL`)
              continue
            }
            if (isTermInMarkdownPath(searchTerm, matchLine)) {
              log(pluginJson, `  - Info: Match '${searchTerm}' ignored in '${matchLine} because it's in a [...](path)`)
              continue
            }
            // Format the line and context for output (trimming, highlighting)
            matchLine = trimAndHighlightTermInLine(matchLine, searchTerm,
              config.highlightResults, config.resultQuoteLength)
            if (config.groupResultsByNote) {
              // Write out note title (if not seen before) then the matchLine
              if (previousNoteTitle !== thisNoteTitleDisplay) {
                outputArray.push(`${headingMarker}# ${thisNoteTitleDisplay}:`) // i.e. lower level heading + note title
              }
              // if (previousNoteTitle !== thisNoteTitle) {
              //   outputArray.push(`${headingMarker}# ${titleAsLink(lines[i].note)}:`) // i.e. lower level heading + note title
              // }
              outputArray.push(`${config.resultPrefix}${matchLine}`)
            } else {
              // Write out matchLine followed by note title
              const suffix = `(from ${thisNoteTitleDisplay})`
              outputArray.push(`${config.resultPrefix}${matchLine} ${suffix}`)
            }
            resultCount += 1
            // previousNoteTitle = thisNoteTitle
            previousNoteTitle = thisNoteTitleDisplay
          }
        }
      } else if (config.showEmptyResults) {
        // If there's nothing to report, make that clear
        outputArray.push('(no matches)')
      }
      // Save this search term and results as a new object in results array
      results.push({ searchTerm: searchTerm, resultLines: outputArray, resultCount: resultCount })

    }
    const elapsedTimeAPI = timer(startTime)
    log(pluginJson, `Search time (API): ${termsToMatchArr.length} searches in ${elapsedTimeAPI} -> ${resultCount} results`)

    const labelString = `🖊 Create/update note '${periodString}' in folder '${String(config.folderToStore)}'`

    //---------------------------------------------------------
    // Work out where to save this summary to
    let destination = ''
    if (calledIndirectly) {
      // Being called from x-callback so will only write to 'newnote' destination
      log(pluginJson, `  running from x-callback so will write to note in the specified folder.`)
      destination = 'newnote'
    } else {
      // else ask user
      destination = await chooseOption(
        `Where should I save the search results for ${periodString}?`,
        [
          { label: labelString, value: 'newnote' },
          { label: '🖊 Append/update your current note', value: 'current' },
          { label: '📋 Write to plugin console log', value: 'log' },
          { label: '❌ Cancel', value: 'cancel' },
        ],
        'note',
      )
    }

    //---------------------------------------------------------
    // Do output
    // const sectionStringToRemove = `${termsToMatchStr} ${config.searchHeading}`

    switch (destination) {
      case 'current': {
        // We won't write an overarching heading.
        // For each search term result set, replace the search term's block (if already present) or append.
        const currentNote = Editor.note
        if (currentNote == null) {
          logError(pluginJson, `No note is open`)
        } else {
          log(pluginJson, `Will write update/append to current note (${currentNote.filename ?? ''})`)
          for (const r of results) {
            const thisResultHeading = `${r.searchTerm} (${r.resultCount} results) for ${periodString}${periodPartStr !== '' ? ` (at ${periodPartStr})` : ''}`
            replaceSection(currentNote, r.searchTerm, thisResultHeading, config.headingLevel, r.resultLines.join('\n'))
          }
        }
        break
      }

      case 'newnote': {
        // We will write an overarching heading, as we need an identifying title for the note.
        // As this is likely to be a note just used for this set of search terms, just delete the whole
        // note contents and re-write each search term's block.
        // Also don't include x-callback link, as
        //   a) it's hard to work back from start/end dates to the human-friendly period string
        //   b) over a fixed time period it's unlikely to need updating

        // let outputNote: ?TNote
        // let noteFilename = ''
        const requestedTitle = `${termsToMatchStr} ${config.searchHeading} for ${periodString}${periodPartStr !== '' ? ` (at ${periodPartStr})` : ''}`
        // const xCallbackLink = `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=saveSearchResultsInPeriod&arg0=${encodeURIComponent(termsToMatchStr)}&arg1=${fromDateStr}&arg2=${toDateStr}`

        const noteFilename = await writeResultsNote(results, requestedTitle, config.folderToStore,
          config.headingLevel, calledIndirectly, '') //xCallbackLink)

        // let fullNoteContent = `# ${requestedTitle}\nat ${nowLocaleDateTime} [Click to refresh these results](${xCallbackLink})`
        // for (const r of results) {
        //   fullNoteContent += `\n${headingMarker} ${r.searchTerm} (${r.resultCount} results) ${config.searchHeading} for ${periodString}${periodPartStr !== '' ? ` (at ${periodPartStr})` : ''}\n${r.resultLines.join('\n')}`
        // }

        // // See if this note has already been created
        // // (look only in active notes, not Archive or Trash)
        // const existingNotes: $ReadOnlyArray<TNote> =
        //   DataStore.projectNoteByTitle(requestedTitle, true, false) ?? []
        // log(pluginJson, `found ${existingNotes.length} existing search result notes titled ${periodString}`)

        // // const outputText = `at ${nowLocaleDateTime}. [Click to refresh these results](${xcallbackLink})\n${outputArray.join('\n')}`

        // if (existingNotes.length > 0) {
        //   outputNote = existingNotes[0] // pick the first if more than one
        //   // log(pluginJson, `filename of first matching note: ${displayTitle(note)}`)
        //   outputNote.content = fullNoteContent

        // } else {
        //   // make a new note for this. NB: filename here = folder + filename
        //   // noteFilename = DataStore.newNote(periodString, config.folderToStore) ?? ''
        //   noteFilename = DataStore.newNoteWithContent(fullNoteContent, config.folderToStore, requestedTitle)
        //   if (!noteFilename) {
        //     logError(pluginJson, `Can't create new note (filename: ${noteFilename})`)
        //     await showMessage('There was an error creating the new note')
        //     return
        //   }
        //   outputNote = DataStore.projectNoteByFilename(noteFilename)
        //   log(pluginJson, `Created new search note with filename: ${noteFilename}`)
        //   // if (outputNote == null) {
        //   //   logError(pluginJson, `Can't get new note (filename: ${noteFilename})`)
        //   //   await showMessage('There was an error getting the new note ready to write')
        //   //   return
        //   // }
        // }
        // log(pluginJson, `written results to note '${periodString}'`)

        // // Do we have an existing Hashtag counts section? If so, delete it.
        // // (Sets place to insert either after the found section heading, or at end of note)
        // const insertionLineIndex = removeSection(
        //   outputNote,
        //   config.searchHeading,
        // )
        // // log(pluginJson, `\tinsertionLineIndex: ${String(insertionLineIndex)}`)
        // // write in reverse order to avoid having to calculate insertion point again
        // outputNote.insertParagraph(
        //   outputText,
        //   insertionLineIndex + 1,
        //   'text',
        // )
        // // outputNote.insertHeading(
        // //   headingString,
        // //   insertionLineIndex,
        // //   config.headingLevel,
        // // )
        // await Editor.openNoteByFilename(outputNote.filename)

        // Make it open in split note, unless called from the x-callback ...
        if (!calledIndirectly) {
          await Editor.openNoteByFilename(noteFilename, false, 0, 0, true)
        }
        break
      }

      case 'log': {
        for (const r of results) {
          log(pluginJson, `${headingMarker} ${r.searchTerm}(${r.resultCount} results)`)
          log(pluginJson, r.resultLines.join('\n'))
        }
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
  catch (err) {
    logError(pluginJson, err.message)
  }
}
