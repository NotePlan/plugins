// @flow
//-----------------------------------------------------------------------------
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 23.12.2022 for v1.1.0-beta, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Helper functions

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  createFormattedResultLines,
  getSearchSettings,
  makeAnySyncs,
  type noteAndLine,
  numberOfUniqueFilenames,
  type resultOutputTypeV3,
  runSearchesV2,
  validateAndTypeSearchTerms,
  writeSearchResultsToNote
} from './searchHelpers'
import {
  formatNoteDate,
  getDateStringFromCalendarFilename,
  getDateStrForStartofPeriodFromCalendarFilename,
  RE_ISO_DATE,
  RE_YYYYMMDD_DATE,
  unhyphenateString,
  unhyphenatedDate,
  withinDateRange,
} from '@helpers/dateTime'
import { getPeriodStartEndDates } from '@helpers/NPDateTime'
import { clo, logDebug, logInfo, logWarn, logError, timer } from '@helpers/dev'
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
 * @param {string?} paraTypeFilterArg optional list of paragraph types to filter by
 * @param {string?} destinationArg optional output desination indicator: 'quick', 'current', 'newnote', 'log'
 */
export async function searchPeriod(
  searchTermsArg?: string,
  fromDateArg?: string = 'default',
  toDateArg?: string = 'default',
  paraTypeFilterArg?: string = '',
  destinationArg?: string
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
    let periodAndPartStr = ''
    let periodType = ''
    if (searchTermsArg !== undefined) {
      // Try using supplied arguments
      if (fromDateArg === 'default') {
        fromDate = moment.now().startOf('day').subtract(91, 'days').toJSDate() // 91 days ago
      } else {
        // cope with YYYYMMDD or YYYY-MM-DD formats
        fromDateStr = fromDateArg.match(RE_ISO_DATE) // for YYYY-MM-DD
          ? unhyphenateString(fromDateArg)
          : fromDateArg.match(RE_YYYYMMDD_DATE) // for YYYYMMDD
            ? fromDateArg
            : 'error'
      }
      if (fromDateArg === 'default') {
        toDate = moment.now().startOf('day').toJSDate() // today
      } else {
        // cope with YYYYMMDD or YYYY-MM-DD formats --> YYYYMMDD
        toDateStr = toDateArg.match(RE_ISO_DATE) // for YYYY-MM-DD
          ? unhyphenateString(toDateArg)
          : toDateArg.match(RE_YYYYMMDD_DATE) // for YYYYMMDD
            ? toDateArg
            : 'error'
      }
      periodString = `${fromDateStr} - ${toDateStr}`
      periodAndPartStr = periodString
    } else {
      // Otherwise ask user
      [fromDate, toDate, periodType, periodString, periodAndPartStr] = await getPeriodStartEndDates(`What period shall I search over?`, false)
      if (fromDate == null || toDate == null) {
        logError(pluginJson, 'dates could not be parsed for requested time period')
        return
      }
      fromDateStr = unhyphenatedDate(fromDate)
      toDateStr = unhyphenatedDate(toDate)
    }
    if (fromDateStr > toDateStr) {
      logError(pluginJson, `Stopping: fromDate ${fromDateStr} is after toDate ${toDateStr}`)
      return
    }
    logDebug(pluginJson, `- time period for search: ${periodString}`)

    // Get the search terms
    let termsToMatchStr = ''
    if (searchTermsArg !== undefined) {
      // either from argument supplied
      termsToMatchStr = searchTermsArg
      logDebug(pluginJson, `- arg0 -> search term(s) [${searchTermsArg}]`)
      calledIndirectly = true
    } else {
      // or by asking user
      const defaultTermsToMatchStr = config.defaultSearchTerms.join(', ')
      const newTerms = await getInput(`Enter search term(s) separated by spaces or commas. (You can use + term, -term and !term as well.)`, 'OK', `Search`, defaultTermsToMatchStr)
      if (typeof newTerms === 'boolean') {
        // i.e. user has cancelled
        logInfo(pluginJson, `User has cancelled operation.`)
        return
      } else {
        termsToMatchStr = newTerms
      }
    }
    logDebug(pluginJson, `- called indirectly? ${String(calledIndirectly)}`)

    // Validate the search terms: an empty return means failure. There is error logging in the function.
    const validatedSearchTerms = await validateAndTypeSearchTerms(termsToMatchStr, true)
    if (validatedSearchTerms == null || validatedSearchTerms.length === 0) {
      await showMessage(`These search terms aren't valid. Please see Plugin Console for details.`)
      return
    }

    // Get the paraTypes to include
    // $FlowFixMe[incompatible-type]
    const paraTypesToInclude: Array<ParagraphType> = (paraTypeFilterArg && paraTypeFilterArg !== '') ? paraTypeFilterArg.split(',') : []
    clo(paraTypesToInclude, `arg3 -> para types: `)

    //---------------------------------------------------------
    // Search using search() API available from v3.6.0
    CommandBar.showLoading(true, `Searching over period ...`)
    await CommandBar.onAsyncThread()

    // $FlowFixMe[incompatible-exact] Note: as no await, which gets resolved later
    const resultsProm: resultOutputTypeV3 = runSearchesV2(validatedSearchTerms, ['calendar'], [], config.foldersToExclude, config, paraTypesToInclude, fromDateStr, toDateStr)
    await CommandBar.onMainThread()

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
    logDebug(pluginJson, `destination = ${destination}, started with destinationArg = ${destinationArg ?? 'undefined'}`)

    //---------------------------------------------------------
    // End of main work started above

    let resultSet = await resultsProm
    CommandBar.showLoading(false)

    //---------------------------------------------------------
    // Filter out the results that aren't within the specified period

    // logDebug(pluginJson, `Before filtering out by date: ${resultSet.resultNoteAndLineArr.length} results`)
    // clo(resultSet.resultNoteAndLineArr, '- resultSet.resultNoteAndLineArr:')
    // let reducedRNALArray: Array<noteAndLine> = resultSet.resultNoteAndLineArr.filter((f) => withinDateRange(getDateStrForStartofPeriodFromCalendarFilename(f.noteFilename), fromDateStr, toDateStr))
    // // Update total count
    // resultSet.fullResultCount = reducedRNALArray.length

    // // Now check to see if we have more than config.resultLimit: if so only use the first amount to return
    // if (config.resultLimit > 0 && reducedRNALArray.length > config.resultLimit) {
    //   reducedRNALArray = reducedRNALArray.slice(0, config.resultLimit)
    //   logWarn(pluginJson, `We have more than ${config.resultLimit} results, so will discard all the ones beyond that limit.`)
    // }
    // // Update counts
    // resultSet.resultNoteAndLineArr = reducedRNALArray
    // resultSet.resultCount = reducedRNALArray.length
    // resultSet.resultNoteCount = numberOfUniqueFilenames(reducedRNALArray)

    // let numResultLines = resultSet.resultNoteAndLineArr.length
    // logDebug(pluginJson, `After filtering out by date: ${resultSet.resultCount} results remain from ${resultSet.resultNoteCount} notes:`)
    // clo(resultSet.resultNoteAndLineArr, 'resultSet.resultNoteAndLineArr')

    //---------------------------------------------------------
    // Do output
    // const sectionStringToRemove = `${termsToMatchStr} ${config.searchHeading}`
    const searchTermsRepStr = `"${resultSet.searchTermsRepArr.join(' ')}"`
    const resultOutputLines: Array<string> = createFormattedResultLines(resultSet, config)

    switch (destination) {
      case 'current': {
        // We won't write an overarching heading.
        // For each search term result set, replace the search term's block (if already present) or append.
        const currentNote = Editor.note
        if (currentNote == null) {
          logError(pluginJson, `No note is open`)
        } else {
          logDebug(pluginJson, `Will write update/append to current note (${currentNote.filename ?? ''})`)
          const thisResultHeading = `${searchTermsRepStr} (${resultSet.resultCount} results) for ${periodAndPartStr}`
          const resultOutputLines: Array<string> = createFormattedResultLines(resultSet, config)
          replaceSection(currentNote, searchTermsRepStr, thisResultHeading, config.headingLevel, resultOutputLines.join('\n'))
        }
        break
      }

      case 'newnote': {
        // We will write an overarching heading, as we need an identifying title for the note.
        // As this is likely to be a note just used for this set of search terms, just delete the whole
        // note contents and re-write each search term's block.

        const titleToMatch = `${termsToMatchStr} ${config.searchHeading}`
        const requestedTitle = `${termsToMatchStr} ${config.searchHeading} for ${periodAndPartStr}`

        // Decided to remove the x-callback link, as
        //   a) it's hard to work back from start/end dates to the human-friendly period string
        //   b) over a fixed time period it's unlikely to need updating
        const xCallbackLink = `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=searchInPeriod&arg0=${encodeURIComponent(termsToMatchStr)}&arg1=${fromDateStr}&arg2=${toDateStr}&arg3=${paraTypeFilterArg ?? ''}&arg4=${destinationArg ?? ''}`

        // can't use 'await...' in the next line, as we're now in 'then...'
        // FIXME: wrong display of result counts in subhead
        const noteFilename = await writeSearchResultsToNote(resultSet, requestedTitle, titleToMatch, config, xCallbackLink)

        logDebug(pluginJson, `- filename to open in split: ${noteFilename}`)
        if (Editor.note?.filename !== noteFilename && !calledIndirectly) {
          // Open the results note in a new split window, unless we can tell
          // we already have this note open. Only works for Editor, though.
          // TODO: persuade Eduard to do better than this.
          await Editor.openNoteByFilename(noteFilename, false, 0, 0, true)
        }
        break
      }

      case 'log': {
        logInfo(pluginJson, `${headingMarker} ${searchTermsRepStr}(${resultSet.resultCount} results)`)
        logInfo(pluginJson, resultOutputLines.join('\n'))
        break
      }

      case 'cancel': {
        logInfo(pluginJson, `User cancelled command`)
        break
      }

      default: {
        logError(pluginJson, `No valid save location code supplied`)
        break
      }
    }
  } catch (err) {
    logError(pluginJson, err.message)
  }
}
