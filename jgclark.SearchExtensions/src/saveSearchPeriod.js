// @flow
//-----------------------------------------------------------------------------
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 29.6.2022 for v0.1.0, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Helper functions

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  getSearchSettings,
  getPeriodStartEndDates,
} from './searchHelpers'
import {
  getDateStringFromCalendarFilename,
  nowLocaleDateTime,
  unhyphenatedDate,
  withinDateRange,
} from '@helpers/dateTime'
import { log, logWarn, logError, timer } from '@helpers/dev'
import { displayTitle, titleAsLink } from '@helpers/general'
import { gatherMatchingLines } from '@helpers/NPParagraph'
import { removeSection, termInMarkdownPath, termInURL, trimAndHighlightSearchResult } from '@helpers/paragraph'
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
export async function saveSearchPeriod(searchTermsArg?: string, periodArg?: number = 91): Promise<void> {
  try {
    // Get config settings from Template folder _configuration note
    // await getPluginSettings()
    const config = await getSearchSettings()
    const headingMarker = '#'.repeat(config.headingLevel)

    // Work out time period to cover
    let fromDate: Date
    let toDate: Date
    let periodString = ''
    let periodPartStr = ''
    let periodType = ''
    if (searchTermsArg !== undefined && periodArg !== undefined) {
      // Use arg2 (and possibly its default) if arg1 supplied
      log(pluginJson, `  will use arg2 '${periodArg}'`)
      const periodArgNumber = parseInt(periodArg)
      toDate = moment.now().startOf('day').toJSDate() // today
      fromDate = moment.now().startOf('day').subtract(periodArgNumber, 'days').toJSDate() // periodArg days ago
      periodString = `last ${periodArgNumber} days`
    } else {
      // Otherwise ask user
      [fromDate, toDate, periodType, periodString, periodPartStr] = await getPeriodStartEndDates(`What period shall I search over?`) // eslint-disable-line
      if (fromDate == null || toDate == null) {
        logError(pluginJson, 'dates could not be parsed')
        return
      }
    }
    const fromDateStr = unhyphenatedDate(fromDate)
    const toDateStr = unhyphenatedDate(toDate)

    // Get the search terms
    let stringsToMatch = []
    if (searchTermsArg !== undefined) {
      // either from argument supplied
      stringsToMatch = searchTermsArg.split(',')
      log(pluginJson, `  will use arg0 '${searchTermsArg}'`)
    } else {
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

    //------------------------------------------------------------
    // Find matches in notes for the time period (original method)
    const outputArray = []
    let resultCount = 0
    let startTime = new Date // for timer
    for (const searchTerm of stringsToMatch) {
      // get list of matching paragraphs for this string
      const results = gatherMatchingLines(periodDailyNotes, searchTerm,
        config.highlightOccurrences, config.dateStyle, config.matchCase)
      const lines = results?.[0]
      resultCount += lines.length
      const context = results?.[1]
      // output a heading first
      outputArray.push(`${headingMarker} ${searchTerm}`)
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
    const elapsedTimeGML = timer(startTime)
    log(pluginJson, `Search time (GML): ${elapsedTimeGML} -> ${resultCount} results`)

    //-------------------------------------------------------------
    // newer search method using search() API available from v3.6.0
    // Strategy: search all calendar notes, and then only select in
    // the notes that match the time period
    startTime = new Date
    resultCount = 0
    for (const searchTerm of stringsToMatch) {
      // get list of matching paragraphs for this string
      const resultParas = await DataStore.search(searchTerm, ['calendar'], undefined, config.foldersToExclude) // search over all notes
      const lines = resultParas
      // output a heading first
      outputArray.push(`${headingMarker} '${searchTerm}' ${config.occurrencesHeading} for ${periodString}${periodPartStr !== '' ? ` (at ${periodPartStr})` : ''}`)
      if (lines.length > 0) {
        log(pluginJson, `  Found ${lines.length} results for '${searchTerm}'`)

        // form the output
        let previousNoteTitle = ''
        for (let i = 0; i < lines.length; i++) {
          let matchLine = lines[i].content
          // Keep this match if within selected date range
          if (withinDateRange(getDateStringFromCalendarFilename(lines[i].note.filename), fromDateStr, toDateStr)) {
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
        }
      } else if (config.showEmptyOccurrences) {
        // If there's nothing to report, make that clear
        outputArray.push('(no matches)')
      }
    }
    const elapsedTimeAPI = timer(startTime)
    log(pluginJson, `Search time (API): ${elapsedTimeAPI} -> ${resultCount} results`)


    const labelString = `🖊 Create/update note '${periodString}' in folder '${String(config.folderToStore)}'`

    // Work out where to save this summary to
    let destination = ''
    if (searchTermsArg !== undefined) {
      // Being called from x-callback so will only write to current note
      log(pluginJson, `  running from x-callback so will write to current note`)
      destination = 'current'
    } else {
      // else ask user
      destination = await chooseOption(
        `Where should I save the results for ${periodString}?`,
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
        'note',
      )
    }

    const headingLine = `${config.occurrencesHeading} for ${periodString}${periodPartStr !== '' ? ` (at ${periodPartStr})` : ''}`
    switch (destination) {
      case 'current': {
        // TODO: use replaceSection logic
        const currentNote = Editor.note
        if (currentNote == null) {
          logError(pluginJson, `no note is open`)
        } else {
          log(pluginJson,
            `appending results to current note (${currentNote.filename ?? ''})`,
          )
          const insertionLineIndex = currentNote.paragraphs.length - 1
          // currentNote.insertHeading(
          //   headingLine,
          //   insertionLineIndex,
          //   config.headingLevel,
          // )
          // FIXME: Can't see why a blank line appears here
          currentNote.appendParagraph(
            outputArray.join('\n'),
            'text',
          )
        }
        break
      }
      case 'newnote': {
        let note: ?TNote
        // first see if this note has already been created
        // (look only in active notes, not Archive or Trash)
        const existingNotes: $ReadOnlyArray<TNote> =
          DataStore.projectNoteByTitle(periodString, true, false) ?? []

        log(pluginJson, `found ${existingNotes.length} existing summary notes for this period`)

        if (existingNotes.length > 0) {
          note = existingNotes[0] // pick the first if more than one
          // log(pluginJson, `filename of first matching note: ${displayTitle(note)}`)
        } else {
          // TODO: check using replaceSection logic
          // make a new note for this. NB: filename here = folder + filename
          const noteFilename = DataStore.newNote(periodString, config.folderToStore) ?? ''
          if (!noteFilename) {
            logError(pluginJson, `Can't create new note (filename: ${noteFilename})`)
            await showMessage('There was an error creating the new note')
            return
          }
          log(pluginJson, `newNote filename: ${noteFilename}`)
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
        // note.insertHeading(
        //   headingLine,
        //   insertionLineIndex,
        //   config.headingLevel,
        // )
        await Editor.openNoteByFilename(note.filename)

        log(pluginJson, `written results to note '${periodString}'`)
        break
      }

      case 'log': {
        // log(pluginJson, headingLine)
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
  catch (err) {
    logError(pluginJson, err.message)
  }
}
