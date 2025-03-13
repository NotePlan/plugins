/* eslint-disable max-len */
// @flow
//-----------------------------------------------------------------------------
// Interactive commands for SearchExtensions plugin.
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 2025-03-13 for v1.5.0, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import type { resultOutputType, TSearchOptions } from './searchHelpers'
import {
  createFormattedResultLines,
  getNoteTypesFromString,
  getNoteTypesAsString,
  getParaTypesFromString,
  getParaTypesAsString,
  getSearchSettings,
  getSearchTermsRep,
  OPEN_PARA_TYPES,
  resultCounts,
  runExtendedSearches,
  validateAndTypeSearchTerms,
  writeSearchResultsToNote,
} from './searchHelpers'
import {
  RE_ISO_DATE,
  RE_YYYYMMDD_DATE,
  unhyphenateString,
  unhyphenatedDate,
} from '@helpers/dateTime'
import {
  getPeriodStartEndDates,
} from '@helpers/NPdateTime'
import { clo, logDebug, logInfo, logError, logWarn } from '@helpers/dev'
import {
  createRunPluginCallbackUrl,
  // displayTitle
} from '@helpers/general'
import { replaceSection } from '@helpers/note'
import { noteOpenInEditor } from '@helpers/NPWindows'
import {
  chooseOption,
  getInput,
  showMessage,
  showMessageYesNo
} from '@helpers/userInput'
//-------------------------------------------------------------------------------

// Destinations:
// If we remove all options to specify note title, then simplifies
// callback /non-Quick: arg0 fixed; 1=searchTerm; 2=dest 'refresh' ? ; arg
// user     /non-Quick: arg0 fixed; 1=searchTerm; 2=dest 'newNote' ?
// callback /Quick:     0=noteTypes varies??; 1=searchTerm; 2=dest 'quick'; 3=paraTypes
// user     /Quick:     ditto

/**
 * Call the main function, searching over all notes.
 */
export async function searchOverAll(
  searchTermsArg?: string,
  paraTypesAsStr?: string = '',
  _noteTypesAsStr?: string = '', // Note: value ignored, but here to make the x-callback system work
  destinationArg?: string = 'newnote',
): Promise<void> {
  // await saveSearch(
  //   searchTermsArg,
  //   'both',
  //   'search',
  //   paraTypesAsStr,
  //   'Searching all'
  // )
  const searchOptions: TSearchOptions = {
    noteTypesToInclude: ['notes', 'calendar'],
    foldersToInclude: [],
    paraTypesToInclude: getParaTypesFromString(paraTypesAsStr),
    originatorCommand: 'searchOverAll',
    commandNameToDisplay: 'Searching all',
  }
  await saveSearch(
    searchOptions,
    searchTermsArg,
    destinationArg
  )
}

/**
 * Call the main function, but requesting only Calendar notes be searched.
 */
export async function searchOverCalendar(
  searchTermsArg?: string,
  paraTypesAsStr?: string = '',
  _noteTypesAsStr?: string = '', // Note: value ignored, but here to make the x-callback system work
  destinationArg?: string = 'newnote',
): Promise<void> {
  // await saveSearch(
  //   searchTermsArg,
  //   'calendar',
  //   'searchOverCalendar',
  //   paraTypesAsStr,
  //   'Searching Calendar notes')
  const searchOptions: TSearchOptions = {
    noteTypesToInclude: ['calendar'],
    foldersToInclude: [],
    paraTypesToInclude: getParaTypesFromString(paraTypesAsStr),
    originatorCommand: 'searchOverCalendar',
    commandNameToDisplay: 'Searching Calendar notes',
  }
  await saveSearch(
    searchOptions,
    searchTermsArg,
    destinationArg)
}

/**
 * Call the main function, but requesting only Project notes be searched.
 */
export async function searchOverNotes(
  searchTermsArg?: string,
  paraTypesAsStr?: string = '',
  _noteTypesAsStr?: string = '', // Note: value ignored, but here to make the x-callback system work
  destinationArg?: string = 'newnote'): Promise<void> {
  // await saveSearch(
  //   searchTermsArg,
  //   'notes',
  //   'searchOverNotes',
  //   paraTypesAsStr,
  //   'Searching all notes')
  const searchOptions: TSearchOptions = {
    noteTypesToInclude: ['notes'],
    foldersToInclude: [],
    paraTypesToInclude: getParaTypesFromString(paraTypesAsStr),
    originatorCommand: 'searchOverNotes',
    commandNameToDisplay: 'Searching all notes',
  }
  await saveSearch(
    searchOptions,
    searchTermsArg,
    destinationArg)
}

/**
 * Call the main function, searching over all open tasks, and sync (set block IDs) the results.
 */
export async function searchOpenTasks(searchTermsArg?: string): Promise<void> {
  // await saveSearch(
  //   searchTermsArg,
  //   'both',
  //   'searchOpenTasks',
  //   OPEN_PARA_TYPES.join(','), // i.e. all the current 'open'-like Types
  //   'Searching open tasks')

  const searchOptions: TSearchOptions = {
    noteTypesToInclude: ['notes', 'calendar'],
    foldersToInclude: [],
    paraTypesToInclude: OPEN_PARA_TYPES,
    originatorCommand: 'searchOpenTasks',
    commandNameToDisplay: 'Searching open tasks',
  }
  await saveSearch(
    searchOptions,
    searchTermsArg) // Note: destinationArg not needed for this command
}

/**
 * Call the main function, searching over all notes, but using a fixed note for results
 */
export async function quickSearch(
  searchTermsArg?: string,
  paraTypesAsStr?: string = '',
  noteTypesAsStr?: string = 'both',
  destinationArg?: string = 'newnote',
): Promise<void> {
  logDebug('quickSearch', `starting with searchTermsArg=${searchTermsArg ?? ''}, paraTypesAsStr=${paraTypesAsStr ?? ''}, noteTypesAsStr=${noteTypesAsStr ?? ''}`)
  // await saveSearch(
  //   searchTermsArg,
  //   noteTypesAsStr ?? 'both',
  //   'quickSearch',
  //   paraTypesAsStr,
  //   'Searching')
  const searchOptions: TSearchOptions = {
    noteTypesToInclude: getNoteTypesFromString(noteTypesAsStr),
    foldersToInclude: [],
    paraTypesToInclude: getParaTypesFromString(paraTypesAsStr),
    originatorCommand: 'quickSearch',
    commandNameToDisplay: 'Searching',
  }
  await saveSearch(
    searchOptions,
    searchTermsArg,
    destinationArg,
  )
}

/**
 * Call the main function, searching over Calendar dates that fall within a period of time.
 */
export async function searchPeriod(
  searchTermsArg?: string,
  paraTypesAsStr?: string = '',
  _noteTypesAsStr?: string = 'calendar', // this value is ignored, as its only Calendar notes that make sense for this command
  destinationArg?: string = 'newnote',
  fromDateArg?: string = '',
  toDateArg?: string = '',
): Promise<void> {
  logDebug('searchPeriod', `starting with searchTermsArg=${searchTermsArg ?? ''} for period '${fromDateArg}' to '${toDateArg}' and destinationArg=${destinationArg ?? ''}`)
  // await saveSearch(
  //   searchTermsArg,
  //   'both',
  //   'searchPeriod',
  //   paraTypesAsStr,
  //   'Searching in period',
  //   caseSensitiveSearchingArg,
  //   fullWordSearchingArg
  // )
  const searchOptions: TSearchOptions = {
    noteTypesToInclude: ['calendar'],
    foldersToInclude: [],
    paraTypesToInclude: getParaTypesFromString(paraTypesAsStr),
    originatorCommand: 'searchPeriod',
    commandNameToDisplay: 'Searching in period',
    destinationArg: destinationArg,
    fromDateStr: fromDateArg,
    toDateStr: toDateArg,
  }
  await saveSearch(
    searchOptions,
    searchTermsArg,
    destinationArg
  )
}

/**------------------------------------------------------------------------
 * Run a search over all notes, saving the results in one of several locations.
 * Works interactively (if no arguments given) or in the background (using supplied arguments).
 * Called by interactive 'save search' commands, by /searchInPeriod command, or by x-callback.
 * @author @jgclark
 *
 * @param {TSearchOptions} searchOptions an object holding a number of settings
 * @param {string?} searchTermsArg optional comma-separated list of search terms to search
 * @param {string?} destinationArg optional output desination indicator: 'current', 'newnote', 'log'. (Default: 'newnote' where relevant.)
*/
export async function saveSearch(
  searchOptions: TSearchOptions,
  searchTermsArg?: string,
  destinationArg?: string = 'newnote',
  // noteTypesToIncludeArg?: string = 'both',
  // originatorCommand?: string = 'quickSearch',
  // paraTypesAsStr?: string = '',
  // commandNameToDisplay?: string = 'Searching',
  // caseSensitiveSearchingArg?: boolean,
  // fullWordSearchingArg?: boolean,
): Promise<void> {
  try {
    const config = await getSearchSettings()
    const headingMarker = '#'.repeat(config.headingLevel)

    // const {
    //   noteTypesToIncludeArg,// = 'both',
    //   originatorCommand,// = 'quickSearch',
    //   paraTypesAsStr,// = '',
    //   commandNameToDisplay,// = 'Searching',
    //   caseSensitiveSearchingArg,// = false,
    //   fullWordSearchingArg,// = false,
    // } = searchOptions

    logDebug(pluginJson, `Starting saveSearch() with searchTermsArg '${searchTermsArg ?? '(not supplied)'}'`)

    // work out if we're being called non-interactively (i.e. via x-callback) by seeing whether originatorCommand is not empty
    const calledNonInteractively = (searchTermsArg !== undefined)
    logDebug('saveSearch', `- called ${calledNonInteractively ? 'NON-' : ''}interactively`)

    // destructure the searchOptions object, the long way    
    const noteTypesToInclude = searchOptions.noteTypesToInclude || ['notes', 'calendar']
    const paraTypesToInclude = searchOptions.paraTypesToInclude || []
    if (!('foldersToInclude' in searchOptions)) {
      searchOptions.foldersToInclude = []
    }
    if (!('foldersToExclude' in searchOptions)) {
      searchOptions.foldersToExclude = config.foldersToExclude
    }
    if (!('caseSensitiveSearching' in searchOptions)) {
      searchOptions.caseSensitiveSearching = config.caseSensitiveSearching
    }
    if (!('fullWordSearching' in searchOptions)) {
      searchOptions.fullWordSearching = config.fullWordSearching
    }
    if (!('originatorCommand' in searchOptions)) {
      searchOptions.originatorCommand = '(not supplied)'
    }
    const originatorCommand = searchOptions.originatorCommand ?? '(not supplied)'
    if (!('commandNameToDisplay' in searchOptions)) {
      searchOptions.commandNameToDisplay = 'Searching'
    }
    const commandNameToDisplay = searchOptions.commandNameToDisplay ?? 'Searching'

    // Get the noteTypes to include
    // const noteTypesToInclude: Array<string> = (noteTypesToIncludeArg === 'both' || noteTypesToIncludeArg === '') ? ['notes', 'calendar'] : [noteTypesToIncludeArg]
    logDebug('saveSearch', `- arg1 -> note types '${noteTypesToInclude.toString()}'`)

    // Get the search terms, either from argument supplied, or by asking user
    let termsToMatchStr = ''
    if (searchTermsArg) {
      // from argument supplied
      termsToMatchStr = searchTermsArg ?? ''
      logDebug('saveSearch', `- arg0 -> search terms [${termsToMatchStr}]`)
    }
    else {
      // ask user
      logDebug('saveSearch', `- originatorCommand = '${originatorCommand}`)

      const newTerms = await getInput(`Enter search term(s) separated by spaces or commas. (You can use +term, -term and !term as well, and search for phrases by enclosing them in double-quotes.)`, 'OK', commandNameToDisplay, config.defaultSearchTerms)
      if (typeof newTerms === 'boolean') {
        // i.e. user has cancelled
        logInfo('saveSearch', `User has cancelled operation.`)
        return
      } else {
        termsToMatchStr = newTerms
        logDebug('saveSearch', `user -> search terms [${termsToMatchStr}]`)
      }
    }

    // Validate the search terms: an empty return means failure. There is error logging in the function.
    const validatedSearchTerms = await validateAndTypeSearchTerms(termsToMatchStr, true)
    if (validatedSearchTerms == null || validatedSearchTerms.length === 0) {
      await showMessage(`These search terms aren't valid. Please see Plugin Console for details.`)
      return
    }
    // If we have a blank search term, then double-check user wants to do this
    if (validatedSearchTerms.length === 1 && validatedSearchTerms[0].term === '') {
      const res = await showMessageYesNo('No search terms specified. Are you sure you want to run a potentially very long search?')
      if (res === 'No') {
        logDebug('saveSearch', 'User has cancelled search')
        return
      }
    }

    // Now optimise the order we tackle the search terms. Note: now moved into runExtendedSearches()

    // Get the paraTypes to include. Can take string (which needs turning into an array), or array (which is fine).
    // $FlowFixMe[incompatible-type]
    // const paraTypesToInclude: Array<ParagraphType> = (Array.isArray(paraTypesAsStr))
    //   ? paraTypesAsStr
    //   : (typeof paraTypesAsStr === 'string')
    //     ? getArrayFromString(paraTypesAsStr)
    //     : []
    // logDebug('saveSearch', `- arg3 -> para types '${typeof paraTypesAsStr}'`)
    logDebug('saveSearch', `- arg3 -> para types '${paraTypesToInclude.toString()}'`)

    // if caseSensitive and fullWord params are given, then override config.
    // (This is because flexiSearch can set them at run-time.)
    // logDebug('saveSearch', `- arg5 [${typeof caseSensitiveSearchingArg}] -> caseSensitiveSearchingArg '${caseSensitiveSearchingArg !== undefined ? String(caseSensitiveSearchingArg) : '(not supplied)'}'`)
    // if (caseSensitiveSearchingArg != null) {
    //   config.caseSensitiveSearching = caseSensitiveSearchingArg
    // }
    // logDebug('saveSearch', `- arg6 [${typeof fullWordSearchingArg}]  -> fullWordSearchingArg '${fullWordSearchingArg !== undefined ? String(fullWordSearchingArg) : '(not supplied)'}'`)
    // if (fullWordSearchingArg != null) {
    //   config.fullWordSearching = fullWordSearchingArg
    // }

    // Work out time period to cover (if wanted)
    let periodString = ''
    let periodAndPartStr = ''
    let periodType = ''
    let fromDateStr = ''
    let toDateStr = ''
    if (('fromDateStr' in searchOptions) || ('toDateStr' in searchOptions)) {
      if (calledNonInteractively) {
        // Try using supplied arguments (may not exist, and don't want to supply a default yet)
        const fromDateArg = searchOptions.fromDateStr
        const toDateArg = searchOptions.toDateStr
        const todayMom = new moment().startOf('day')

        fromDateStr = (fromDateArg && fromDateArg !== '')
          ? (fromDateArg.match(RE_ISO_DATE) // for YYYY-MM-DD
            ? unhyphenateString(fromDateArg)
            : fromDateArg.match(RE_YYYYMMDD_DATE) // for YYYYMMDD
              ? fromDateArg
              : 'error')
          : todayMom.subtract(91, 'days').format('YYYYMMDD') // 91 days ago
        toDateStr = (toDateArg && toDateArg !== '')
          ? (toDateArg.match(RE_ISO_DATE) // for YYYY-MM-DD
            ? unhyphenateString(toDateArg)
            : toDateArg.match(RE_YYYYMMDD_DATE) // for YYYYMMDD
              ? toDateArg
              : 'error')
          : todayMom.format('YYYYMMDD') // today
        periodString = `${fromDateStr} - ${toDateStr}`
        periodAndPartStr = periodString
        logDebug('saveSearch', `arg1/2 -> ${periodString}`)
      }
      else {
        // Otherwise ask user
        let fromDate: Date
        let toDate: Date
        // eslint-disable-next-line no-unused-vars
        [fromDate, toDate, periodType, periodString, periodAndPartStr] = await getPeriodStartEndDates(`What period shall I search over?`, false)
        if (fromDate == null || toDate == null) {
          throw new Error('dates could not be parsed for requested time period')
        }
        fromDateStr = unhyphenatedDate(fromDate)
        toDateStr = unhyphenatedDate(toDate)
        if (periodAndPartStr === '') {
          periodAndPartStr = periodString
        }
        logDebug('saveSearch', `Time period for search: ${periodAndPartStr}`)
      }
      if (fromDateStr > toDateStr) {
        throw new Error(`Stopping: fromDate ${fromDateStr} is after toDate ${toDateStr}`)
      }
    }

    // // Form TSearchOptions object
    // const searchOptions: TSearchOptions = {
    //   noteTypesToInclude: noteTypesToInclude,
    //   foldersToInclude: [],
    //   foldersToExclude: config.foldersToExclude,
    //   paraTypesToInclude: paraTypesToInclude,
    //   caseSensitiveSearching: config.caseSensitiveSearching,
    //   fullWordSearching: config.fullWordSearching,
    // }

    //---------------------------------------------------------
    // Search using search() API via JGC extended search helpers in this plugin
    CommandBar.showLoading(true, `${commandNameToDisplay} ...`)
    await CommandBar.onAsyncThread()

    // $FlowFixMe[incompatible-exact] Note: deliberately no await: this is resolved later
    const resultsProm: resultOutputType = runExtendedSearches(validatedSearchTerms, config, searchOptions)

    await CommandBar.onMainThread()

    //---------------------------------------------------------
    // While the search goes on, work out where to save this summary
    let destination = ''
    if (originatorCommand === 'quickSearch') {
      destination = 'quick'
    }
    else if (calledNonInteractively) {
      // Being called from x-callback so will only write to 'newnote' destination
      destination = (destinationArg ?? 'newnote')
    }
    else if (config.autoSave) {
      // Config asks to save automatically to 'newnote'
      destination = 'newnote'
    }
    else {
      // else ask user
      const labelString = `🖊 Create/update note ${termsToMatchStr} ${config.searchHeading} ${periodString ? `'${periodString}' ` : ' '}in folder '${config.folderToStore}'`
      // destination = await chooseOption(
      destination = await chooseOption(
        `Where should I save the [${termsToMatchStr}] search results${periodString ? ` for ${periodString}` : ''}?`,
        [
          { label: labelString, value: 'newnote' },
          { label: '🖊 Append/update your current note', value: 'current' },
          { label: '📋 Write to plugin console log', value: 'log' },
          { label: '❌ Cancel', value: 'cancel' },
        ],
        'newnote',
      )
    }
    logDebug('saveSearch', `destination = ${destination}, started with originatorCommand = ${originatorCommand ?? 'undefined'}`)

    //---------------------------------------------------------
    // End of main work started above

    const resultSet = await resultsProm // here's where we resolve the promise
    CommandBar.showLoading(false)

    if (resultSet.resultCount === 0) {
      logDebug('saveSearch', `No results found for search ${getSearchTermsRep(validatedSearchTerms)}`)
      await showMessage(`No results found for search ${getSearchTermsRep(validatedSearchTerms)} with your current settings.`)
      return
    }

    //---------------------------------------------------------
    // Do output
    // logDebug('saveSearch', 'reached do output stage')
    const searchTermsRepStr = `'${resultSet.searchTermsRepArr.join(' ')}'`.trim() // Note: we normally enclose in [] but here need to use '' otherwise NP Editor renders the link wrongly

    // Create the x-callback URL for the refresh action
    const xCallbackURL = (originatorCommand === 'searchPeriod')
      ? createRunPluginCallbackUrl('jgclark.SearchExtensions', originatorCommand, [
        termsToMatchStr,
        getParaTypesAsString(paraTypesToInclude),
        getNoteTypesAsString(noteTypesToInclude),
        destinationArg,
        fromDateStr,
        toDateStr,
      ])
      : createRunPluginCallbackUrl('jgclark.SearchExtensions', originatorCommand, [
        termsToMatchStr,
        getParaTypesAsString(paraTypesToInclude),
        getNoteTypesAsString(noteTypesToInclude),
        destinationArg,
      ])

    switch (destination) {
      case 'current': {
        // We won't write an overarching title, but will add a section heading.
        // For each search term result set, replace the search term's block (if already present) or append.
        // Note: won't add a refresh button, as that requires seeing what the current filename is when called from the x-callback
        const currentNote = Editor
        if (currentNote == null) {
          throw new Error(`No note is open to save search results to.`)
        }

        const resultCountsStr = resultCounts(resultSet)
        const thisResultHeading = `${searchTermsRepStr} ${config.searchHeading} ${resultCountsStr}`
        logDebug('saveSearch', `Will write update/append section '${thisResultHeading}' to current note (${currentNote.filename ?? ''})`)

        const resultOutputLines: Array<string> = createFormattedResultLines(resultSet, config)
        // logDebug('saveSearch', resultOutputLines.length)
        const xCallbackLine = (xCallbackURL !== '') ? ` [🔄 Refresh results for ${searchTermsRepStr}](${xCallbackURL})` : ''
        resultOutputLines.unshift(xCallbackLine)

        // $FlowIgnore[prop-missing]
        replaceSection(currentNote, searchTermsRepStr, thisResultHeading, config.headingLevel, resultOutputLines.join('\n'))

        logDebug('saveSearch', `saveSearch() finished writing to current note.`)
        break
      }

      case 'newnote': {
        // We will write an overarching title, as we need an identifying title for the note.
        // As this is likely to be a note just used for this set of search terms, just delete the whole note contents and re-write each search term's block.
        // Note: Does need to include a subhead with search term + result count
        const requestedTitle = `${termsToMatchStr} ${config.searchHeading}${periodAndPartStr ? ` for ${periodAndPartStr}` : ''}`

        // Get/make note, and then replace the search term's block (if already present) or append.
        const noteFilename = await writeSearchResultsToNote(resultSet, requestedTitle, requestedTitle, config, xCallbackURL, true)

        logDebug('saveSearch', `- filename to write to (and potentially show in split): '${noteFilename}'`)
        if (!calledNonInteractively) {
          if (noteOpenInEditor(noteFilename)) {
            logDebug('saveSearch', `- note ${noteFilename} already open in an editor window`)
          } else {
            // Open the results note in a new split window, unless we can tell
            logDebug('saveSearch', `- opening note ${noteFilename} in a split window`)
            await Editor.openNoteByFilename(noteFilename, false, 0, 0, true)
          }
        }
        break
      }

      case 'quick': {
        // Write to the same 'Quick Search Results' note (or whatever the user's setting is)
        // Delete the note's contents and re-write each time.
        // *Does* need to include a subhead with search term + result count, as title is fixed.
        const requestedTitle = config.quickSearchResultsTitle
        // const xCallbackURL = createRunPluginCallbackUrl('jgclark.SearchExtensions', 'quickSearch', [
        //   termsToMatchStr,
        //   getParaTypesAsString(paraTypesToInclude),
        //   getNoteTypesAsString(noteTypesToInclude)
        // ])
        // const xCallbackLine = (xCallbackURL !== '') ? ` [🔄 Refresh results for ${searchTermsRepStr}](${xCallbackURL})` : ''

        const noteFilename = await writeSearchResultsToNote(resultSet, requestedTitle, requestedTitle, config, xCallbackURL, false)

        logDebug('saveSearch', `- filename to open in split: ${noteFilename}`)
        // if (!calledNonInteractively) {
        if (noteOpenInEditor(noteFilename)) {
          logDebug('saveSearch', `- note ${noteFilename} already open in an editor window`)
        } else {
          // Open the results note in a new split window, unless we can tell
          logDebug('saveSearch', `- opening note ${noteFilename} in a split window`)
          await Editor.openNoteByFilename(noteFilename, false, 0, 0, true)
        }
        // }
        break
      }

      case 'log': {
        const resultOutputLines: Array<string> = createFormattedResultLines(resultSet, config)
        logInfo('saveSearch', `${headingMarker} ${searchTermsRepStr} (${resultSet.resultCount} results)`)
        logInfo('saveSearch', resultOutputLines.join('\n'))
        break
      }

      case 'cancel': {
        logInfo('saveSearch', `User cancelled this command`)
        break
      }

      default: {
        throw new Error(`No valid save location code supplied`)
      }
    }
  }
  catch (err) {
    logError(pluginJson, `saveSearch: ${err.message}`)
  }
}
