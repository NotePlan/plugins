// @flow
//-----------------------------------------------------------------------------
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 22.7.2022 for v0.5.0, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Helper functions

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  getSearchSettings,
  type resultObjectTypeV2,
  runSearchesV2,
  validateAndTypeSearchTerms,
  writeSearchResultsToNote
} from './searchHelpers'
import {
  formatNoteDate,
  getDateStringFromCalendarFilename,
  RE_ISO_DATE,
  RE_YYYYMMDD_DATE,
  unhyphenateString,
  unhyphenatedDate,
  withinDateRange,
} from '@helpers/dateTime'
import { getPeriodStartEndDates } from '@helpers/NPDateTime'
import { log, logDebug, logWarn, logError, timer } from '@helpers/dev'
import { displayTitle, titleAsLink } from '@helpers/general'
import { replaceSection } from '@helpers/note'
import { isTermInMarkdownPath, isTermInURL } from '@helpers/paragraph'
import { trimAndHighlightTermInLine } from '@helpers/search'
import { chooseOption, getInput, showMessage } from '@helpers/userInput'

//-------------------------------------------------------------------------------

/**
 * Run a search over all notes in a given period, saving the results in one of several locations.
 * Works interactively (if no arguments given) or in the background (using supplied arguments).
 * Uses 'moment' library to work out time periods.
 * @author @jgclark
 *
 * @param {string?} searchTermsArg optional comma-separated list of search terms to search
 * @param {string?} fromDateArg optional start date to search over (YYYYMMDD or YYYY-MM-DD). If not given, then defaults to 3 months ago.
 * @param {string?} toDateArg optional end date to search over (YYYYMMDD or YYYY-MM-DD). If not given, then defaults to today.
 */
export async function saveSearchPeriod(
  noteTypesToIncludeArg: string,
  searchTermsArg?: string,
  fromDateArg?: string = 'default',
  toDateArg?: string = 'default',
  paraTypeFilterArg?: string // TODO: wire this in
): Promise<void> {
  try {
    // Get relevant settings
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
      ;[fromDate, toDate, periodType, periodString, periodPartStr] = await getPeriodStartEndDates(`What period shall I search over?`) // eslint-disable-line
      if (fromDate == null || toDate == null) {
        logError(pluginJson, 'dates could not be parsed')
        return
      }
      fromDateStr = unhyphenatedDate(fromDate)
      toDateStr = unhyphenatedDate(toDate)
    }
    logDebug(pluginJson, `  time period: ${periodString}`)

    // Get the noteTypes to include
    const noteTypesToInclude = (noteTypesToIncludeArg === 'both') ? ['notes', 'calendar'] : [noteTypesToIncludeArg]
    logDebug(pluginJson, `saveSearch: arg0 -> '${noteTypesToInclude.toString()}'`)

    // Get the search terms
    let termsToMatchStr = ''
    if (searchTermsArg !== undefined) {
      // either from argument supplied
      termsToMatchStr = searchTermsArg
      logDebug(pluginJson, `  will use arg0 '${searchTermsArg}'`)
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
        // termsToMatchArr = Array.from(newTerms.replace(/ OR /, ',').split(','))
        termsToMatchStr = newTerms
      }
    }

    // Validate the search terms: an empty return means failure. There is error logging in the function.
    const validatedSearchTerms = await validateAndTypeSearchTerms(termsToMatchStr)
    if (validatedSearchTerms == null || validatedSearchTerms.length === 0) {
      await showMessage(`These search terms aren't valid. Please see Plugin Console for details.`)
      return
    }

    // Get array of all daily notes that are within this time period
    const periodDailyNotes = DataStore.calendarNotes.filter((p) => withinDateRange(getDateStringFromCalendarFilename(p.filename), fromDateStr, toDateStr))
    if (periodDailyNotes.length === 0) {
      logWarn(pluginJson, 'no matching daily notes found')
      await showMessage(`No matching daily notes found; stopping.`)
      return
    }

    // FIXME: at this point switch to the runSearchesV2 call, and then extract out the filename filter tests from what follows

    logDebug(pluginJson, `- called indirectly? ${String(calledIndirectly)}`)

    //---------------------------------------------------------
    // Search using search() API available from v3.6.0
    // const startTime = new Date
    // CommandBar.showLoading(true, `Running search for ${String(termsToMatchArr)} ...`)
    // await CommandBar.onAsyncThread()

    const resultsProm: resultOutputTypeV2 = runSearchesV2(validatedSearchTerms, noteTypesToInclude, [], config.foldersToExclude, config) // note no await

    // await CommandBar.onMainThread()
    // CommandBar.showLoading(false)
    // const elapsedTimeAPI = timer(startTime)
    // log(pluginJson, `Search time (API): ${termsToMatchArr.length} searches in ${elapsedTimeAPI} -> ${resultCount} results`)

    //---------------------------------------------------------
    // While the search goes on, work out where to save this summary
    let destination = ''
    if (calledIndirectly || config.autoSave) {
      // Being called from x-callback so will only write to 'newnote' destination
      // Or we have a setting asking to save automatically to 'newnote'
      destination = 'newnote'
    } else {
      // else ask user
      const labelString = `🖊 Create/update note '${periodString}' in folder '${String(config.folderToStore)}'`
      destination = await chooseOption(
        `Where should I save the search results for ${periodString}?`,
        [
          { label: labelString, value: 'newnote' },
          { label: '🖊 Append/update your current note', value: 'current' },
          { label: '📋 Write to plugin console log', value: 'log' },
          { label: '❌ Cancel', value: 'cancel' },
        ],
        'newnote',
      )
    }

    resultsProm.then((resultSet) => {
      log(pluginJson, `resultsProm resolved`)
      // clo(results, 'resultsProm resolved ->')

      //---------------------------------------------------------
      // Filter out the results that aren't within the specified period

      const simplifyLine = (config.resultStyle === 'Simplified')

      logDebug(pluginJson, `Before filtering out by date: ${resultSet.resultNoteAndLinesArr.length} RNALs`)
      const reducedNoteAndLinesArr = []
      let c = 0
      for (const rnal of resultSet.resultNoteAndLinesArr) {
        const newRnal = rnal.filter((f) => (withinDateRange(getDateStringFromCalendarFilename(f.noteFilename), fromDateStr, toDateStr)))
        reducedNoteAndLinesArr.push(newRnal)
        c++
      }
      logDebug(pluginJson, `After filtering out by date: ${c} RNALs remain`)
      clo(reducedNoteAndLinesArr, 'reducedNoteAndLinesArr:')

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
            const thisResultHeading = `${resultSet.searchTerm} (${resultSet.resultCount} results) for ${periodString}${periodPartStr !== '' ? ` (at ${periodPartStr})` : ''}`
            replaceSection(currentNote, resultSet.searchTerm, thisResultHeading, config.headingLevel, resultSet.resultLines.join('\n'))
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
          const xCallbackLink = `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=saveSearchInPeriod&arg0=${encodeURIComponent(termsToMatchStr)}&arg1=${fromDateStr}&arg2=${toDateStr}`
          // TODO: Test the x-callback

          // normally I'd use await... in the next line, but can't as we're now in then...
          // const noteFilename = await writeSearchResultsToNote(resultSet, requestedTitle, config.folderToStore, config.resultStyle, config.headingLevel, config.groupResultsByNote, config.resultPrefix, config.highlightResults, config.resultQuoteLength, calledIndirectly, xCallbackLink)
          const noteFilenameProm = writeSearchResultsToNote(resultSet, requestedTitle, config, xCallbackLink)

          // let fullNoteContent = `# ${requestedTitle}\nat ${nowLocaleDateTime} [Click to refresh these results](${xCallbackLink})`
          // for (const r of results) {
          //   fullNoteContent += `\n${headingMarker} ${r.searchTerm} (${r.resultCount} results) ${config.searchHeading} for ${periodString}${periodPartStr !== '' ? ` (at ${periodPartStr})` : ''}\n${r.resultLines.join('\n')}`
          // }

          // // See if this note has already been created
          // // (look only in active notes, not Archive or Trash)
          // const existingNotes: $ReadOnlyArray<TNote> =
          //   DataStore.projectNoteByTitle(requestedTitle, true, false) ?? []
          // logDebug(pluginJson, `found ${existingNotes.length} existing search result notes titled ${periodString}`)

          // // const outputText = `at ${nowLocaleDateTime}. [Click to refresh these results](${xcallbackLink})\n${outputArray.join('\n')}`

          // if (existingNotes.length > 0) {
          //   outputNote = existingNotes[0] // pick the first if more than one
          //   // logDebug(pluginJson, `filename of first matching note: ${displayTitle(note)}`)
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
          // // logDebug(pluginJson, `\tinsertionLineIndex: ${String(insertionLineIndex)}`)
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

          noteFilenameProm.then(async (filename) => {
            logDebug(pluginJson, `${filename}`)
            // Open the results note in a new split window, unless we already have this note open
            // if (!calledIndirectly) {
            if (Editor.note?.filename !== filename) {
              await Editor.openNoteByFilename(filename, false, 0, 0, true)
            }
          })
          break
        }

        case 'log': {
          log(pluginJson, `${headingMarker} ${resultSet.searchTerm}(${resultSet.resultCount} results)`)
          log(pluginJson, resultSet.resultLines.join('\n'))
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
    })

  } catch (err) {
    logError(pluginJson, err.message)
  }
}
