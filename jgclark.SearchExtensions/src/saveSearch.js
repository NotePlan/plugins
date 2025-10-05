/* eslint-disable max-len */
// @flow
//-----------------------------------------------------------------------------
// Interactive commands for SearchExtensions plugin.
// Create list of occurrences of note paragraphs with specified strings, which can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 2025-10-05 for v3.0.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  // getDateRangeFromSearchOptions,
  getDateRangeFromUser
} from './dateRanges'
import type { resultOutputV3Type, SearchConfig, TSearchOptions } from './searchHelpers'
import {
  createFormattedResultLines,
  formSearchResultsHeadingLine,
  formSearchResultsMetadataLine,
  getNoteTypesFromString,
  getNoteTypesAsString,
  getParaTypesFromString,
  getParaTypesAsString,
  getSearchSettings,
  OPEN_PARA_TYPES,
  writeSearchResultsToNote,
} from './searchHelpers'
import { runPluginExtendedSyntaxSearches, validateAndTypeSearchTerms
} from './pluginExtendedSyntaxHelpers'
import { runNPExtendedSyntaxSearches } from './NPExtendedSyntaxHelpers'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { createRunPluginCallbackUrl } from '@helpers/general'
import { removeSection,replaceSection, setIconForNote } from '@helpers/note'
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
// user     /non-Quick: arg0 fixed; 1=searchTerm; 2=dest 'searchSpecificNote' ?
// callback /Quick:     0=noteTypes varies??; 1=searchTerm; 2=dest 'quick'; 3=paraTypes
// user     /Quick:     ditto

// Note: If a new entry function is added here, or the params are changed, then also update searchTriggers::refreshSavedSearch()

/**
 * Call the main function, searching over all notes.
 */
export async function searchOverAll(
  searchTermsArg?: string,
  _noteTypesAsStr?: string = '', // Note: value ignored, but here to make the x-callback system work
  paraTypesAsStr?: string = '',
  destinationArg?: string = 'searchSpecificNote',
): Promise<void> {
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
  _noteTypesAsStr?: string = '', // Note: value ignored, but here to make the x-callback system work
  paraTypesAsStr?: string = '',
  destinationArg?: string = 'searchSpecificNote',
): Promise<void> {
  const searchOptions: TSearchOptions = {
    noteTypesToInclude: ['calendar'],
    foldersToInclude: [],
    paraTypesToInclude: getParaTypesFromString(paraTypesAsStr),
    originatorCommand: 'searchOverCalendar',
    commandNameToDisplay: 'Searching Calendar notes',
  }
  logDebug('searchOverCalendar', `starting with searchTermsArg=${searchTermsArg ?? ''} and destinationArg=${destinationArg ?? ''}`)
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
  _noteTypesAsStr?: string = '', // Note: value ignored, but here to make the x-callback system work
  paraTypesAsStr?: string = '',
  destinationArg?: string = 'searchSpecificNote'
): Promise<void> {
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
export async function searchOpenTasks(
  searchTermsArg?: string,
  noteTypesAsStr?: string = 'both',
  _paraTypesAsStr?: string = '', // Note: value ignored, but here to make the x-callback system work
  destinationArg?: string = 'searchSpecificNote'
): Promise<void> {
  const searchOptions: TSearchOptions = {
    noteTypesToInclude: getNoteTypesFromString(noteTypesAsStr),
    foldersToInclude: [],
    paraTypesToInclude: OPEN_PARA_TYPES,
    originatorCommand: 'searchOpenTasks',
    commandNameToDisplay: 'Searching open tasks',
  }
  await saveSearch(
    searchOptions,
    searchTermsArg,
    destinationArg)
}

/**
 * Call the main function, searching over all notes, but using a fixed note for results
 */
export async function quickSearch(
  searchTermsArg?: string,
  noteTypesAsStr?: string = 'both',
  paraTypesAsStr?: string = '',
  destinationArg?: string = 'quick',
): Promise<void> {
  try {
  // logDebug('quickSearch', `starting with searchTermsArg=${searchTermsArg ?? ''}, paraTypesAsStr=${paraTypesAsStr ?? ''}, noteTypesAsStr=${noteTypesAsStr ?? ''}`)
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
  catch (err) {
    logError(pluginJson, `quickSearch: ${err.message}`)
  }
}

/**
 * Call the main function, searching over Calendar dates that fall within a period of time.
 */
export async function searchPeriod(
  searchTermsArg?: string,
  paraTypesAsStr?: string = '',
  _noteTypesAsStr?: string = 'calendar', // this value is ignored, as its only Calendar notes that make sense for this command
  destinationArg?: string = 'searchSpecificNote',
  fromDateArg?: string = '',
  toDateArg?: string = '',
): Promise<void> {
  logDebug('searchPeriod', `starting with searchTermsArg=${searchTermsArg ?? ''} for period '${fromDateArg}' to '${toDateArg}' and destinationArg=${destinationArg ?? ''}`)
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
 * Note: operates differently depending whether we're on NP v3.18.1+ or not:
 * - with earlier versions then more of the Plugin's extended syntax is available
 * - with 3.18.1+ then quite a lot of the Plugin's extended syntax and processing is unavailable, as NP now handles much of it more efficiently.
 * @author @jgclark
 *
 * @param {TSearchOptions} searchOptions an object holding a number of settings
 * @param {string?} searchTermsArg optional comma-separated list of search terms to search
 * @param {string?} destinationArg optional output desination indicator: 'current', 'searchSpecificNote', 'log'. (Default: 'searchSpecificNote' where relevant.)
*/
export async function saveSearch(
  searchOptions: TSearchOptions,
  searchTermsArg?: string,
  destinationArg?: string = 'searchSpecificNote',
): Promise<void> {
  try {
    const config = await getSearchSettings()
    const NPAdvancedSyntaxAvailable = NotePlan.environment.buildVersion >= 1429
    logDebug(pluginJson, `Starting saveSearch() with searchTermsArg '${searchTermsArg ?? '(not supplied)'}', on NP build version ${String(NotePlan.environment.buildVersion)} and useNativeSearch? ${String(config.useNativeSearch)}`)

    // destructure the searchOptions object, the long way
    // Get the noteTypes to include
    const noteTypesToInclude = searchOptions.noteTypesToInclude || ['notes', 'calendar']
    // TODO: Note: can also be specified in the search string:
    // - source:notes - Notes only
    // - source:calendar - Calendar notes only
    // - source:notes,calendar - Notes and Calendar notes
    logDebug('saveSearch', `- note types -> '${noteTypesToInclude.toString()}'`)
    const paraTypesToInclude = searchOptions.paraTypesToInclude || []
    if (!('caseSensitiveSearching' in searchOptions)) {
      searchOptions.caseSensitiveSearching = config.caseSensitiveSearching
    }
    if (!('fullWordSearching' in searchOptions)) {
      searchOptions.fullWordSearching = config.fullWordSearching
    }
    if (!('foldersToInclude' in searchOptions)) {
      searchOptions.foldersToInclude = []
    }
    if (!('foldersToExclude' in searchOptions)) {
      searchOptions.foldersToExclude = config.foldersToExclude
    }
    if (!('originatorCommand' in searchOptions)) {
      searchOptions.originatorCommand = ''
    }
    const originatorCommand = searchOptions.originatorCommand ?? ''
    if (!('commandNameToDisplay' in searchOptions)) {
      searchOptions.commandNameToDisplay = 'Searching'
    }
    logDebug('saveSearch', `- originatorCommand = '${originatorCommand}'`)

    const commandNameToDisplay = searchOptions.commandNameToDisplay ?? 'Searching'

    // work out if we're being called non-interactively (i.e. via x-callback) by seeing whether originatorCommand is not empty
    // Note: now checking destinationArg instead (below)
    // const calledNonInteractively = (originatorCommand === '')
    // logDebug('saveSearch', `- called ${calledNonInteractively ? 'NON-' : ''}interactively`)

    // Get the search terms, either from argument supplied, or by asking user
    let termsToMatchStr = ''
    if (searchTermsArg) {
      // from argument supplied
      termsToMatchStr = searchTermsArg ?? ''
      logDebug('saveSearch', `- arg1 -> search terms [${termsToMatchStr}]`)
    }
    else {
      // ask user
      const newTerms = (NPAdvancedSyntaxAvailable)
        ? await getInput(`Enter search term(s)`, 'OK', commandNameToDisplay, config.defaultSearchTerms)
        : await getInput(`Enter search term(s) separated by spaces or commas. (You can use +term, -term and !term as well, and search for phrases by enclosing them in double-quotes.)`, 'OK', commandNameToDisplay, config.defaultSearchTerms)
      if (typeof newTerms === 'boolean') {
        // i.e. user has cancelled
        logInfo('saveSearch', `User has cancelled operation.`)
        return
      }
      termsToMatchStr = newTerms
      logDebug('saveSearch', `user -> search terms [${termsToMatchStr}]`)
    }

    // Set up shared variables
    let searchTermsRepStr = ''
    let periodString = ''
    let periodAndPartStr = ''
    let fromDateStr = ''
    let toDateStr = ''
    let newerMethodResultsProm: resultOutputV3Type
    let olderMethodResultsProm: resultOutputV3Type

    // Now do the relevant processing for different versions of NP
    if (config.useNativeSearch && NPAdvancedSyntaxAvailable) {
      logDebug('saveSearch', `Will use newer NP extended syntax`)

      // If we have a date range, then add it to the search terms
      if (('fromDateStr' in searchOptions) && ('toDateStr' in searchOptions)) {
        termsToMatchStr = `date:${fromDateStr}-${toDateStr} ${termsToMatchStr}`
      } else if ('fromDateStr' in searchOptions) {
        termsToMatchStr = `date:${fromDateStr} ${termsToMatchStr}`
      } else if ('toDateStr' in searchOptions) {
        termsToMatchStr = `date:past-${toDateStr} ${termsToMatchStr}`
      }
      searchTermsRepStr = termsToMatchStr

      //---------------------------------------------------------
      // Search using search() API via JGC modified search helpers to suit NP 3.18.1 extended search syntax
      CommandBar.showLoading(true, `${commandNameToDisplay} for [${searchTermsRepStr}] ...`)
      await CommandBar.onAsyncThread()

      // $FlowFixMe[incompatible-exact] Note: deliberately no await: this is resolved later
      newerMethodResultsProm = runNPExtendedSyntaxSearches(termsToMatchStr, config, searchOptions)

      await CommandBar.onMainThread()
    }

    if (!config.useNativeSearch ||config._runComparison || !NPAdvancedSyntaxAvailable) {
      // NP Advanced Syntax not available, or we want to compare results
      logDebug('saveSearch', `Will use older Plugin extended syntax`)

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
    
      searchTermsRepStr = `'${validatedSearchTerms.map(term => term.termRep).join(' ')}'`.trim() // Note: we normally enclose in [] but here need to use '' otherwise NP Editor renders the link wrongly

      // Now optimise the order we tackle the search terms. Note: now moved into runExtendedSearches()

      // Get the paraTypes to include. Can take string (which needs turning into an array), or array (which is fine).
      logDebug('saveSearch', `- arg3 -> para types '${paraTypesToInclude.toString()}'`)

      // Work out time period to cover (if wanted)
      if (('fromDateStr' in searchOptions) || ('toDateStr' in searchOptions)) {
        // Note: can't reliably tell if called non-interactively
        // if (calledNonInteractively) {
        //   [fromDateStr, toDateStr, periodString, periodAndPartStr] = getDateRangeFromSearchOptions(searchOptions)
        //   logDebug('saveSearch', `arg1/2 -> ${periodString}`)
        // }
        // else {
          [fromDateStr, toDateStr, periodString, periodAndPartStr] = await getDateRangeFromUser()
          logDebug('saveSearch', `Time period for search: ${periodAndPartStr}`)
        // }
        if (fromDateStr > toDateStr) {
          throw new Error(`Stopping: fromDate ${fromDateStr} is after toDate ${toDateStr}`)
        }
      }

      //---------------------------------------------------------
      // Search using search() API via JGC extended search helpers in this plugin
      CommandBar.showLoading(true, `${commandNameToDisplay} for [${searchTermsRepStr}]...`)
      await CommandBar.onAsyncThread()

      // $FlowFixMe[incompatible-exact] Note: deliberately no await: this is resolved later
      olderMethodResultsProm = runPluginExtendedSyntaxSearches(validatedSearchTerms, config, searchOptions)
      await CommandBar.onMainThread()
    }

    //---------------------------------------------------------
    // While the search goes on, work out where to save this summary
    let destination = ''
    if (originatorCommand === 'quickSearch') {
      destination = 'quick'
    }
    else if (destinationArg!=='') {
      destination = destinationArg
    }
    else if (config.autoSave) {
      // Config asks to save automatically to 'searchSpecificNote'
      destination = 'searchSpecificNote'
    }
    else {
      // else ask user
      const labelString = `🖊 Create/update note ${searchTermsRepStr} ${config.searchHeading} ${periodString ? `'${periodString}' ` : ' '}in folder '${config.folderToStore}'`
      // destination = await chooseOption(
      destination = await chooseOption(
        `Where should I save the [${searchTermsRepStr}] search results${periodString ? ` for ${periodString}` : ''}?`,
        [
          { label: labelString, value: 'searchSpecificNote' },
          { label: '🖊 Append/update your current note', value: 'current' },
          { label: '📋 Write to plugin console log', value: 'log' },
          { label: '❌ Cancel', value: 'cancel' },
        ],
        'searchSpecificNote',
      )
    }
    logDebug('saveSearch', `destination = ${destination}, started with originatorCommand = ${originatorCommand ?? 'undefined'}`)

    //---------------------------------------------------------
    // End of main work started above: resolve the promises
    let resultSetToUse: ?resultOutputV3Type
    let resultSetForComparison: ?resultOutputV3Type

    logDebug('saveSearch', `before promises resolve`)
    if (!NPAdvancedSyntaxAvailable) {
      resultSetToUse = await olderMethodResultsProm
    } else {
      if (config.useNativeSearch) {
        resultSetToUse = await newerMethodResultsProm
        if (config._runComparison) {
          resultSetForComparison = await olderMethodResultsProm
        }
      } else {
        resultSetToUse = await olderMethodResultsProm
      }
    }
    CommandBar.showLoading(false)

    // Run a comparison check, if wanted
    if (config._runComparison) {
      if (resultSetToUse && resultSetForComparison) {
        if (resultSetToUse.resultCount === resultSetForComparison.resultCount) {
          logInfo('', `✅ NP Extended (${resultSetToUse.resultCount}) === Plugin Extended (${resultSetForComparison.resultCount})`)
        } else {
          logWarn('saveSearch', `NP Extended (${resultSetToUse.resultCount}) !== Plugin Extended (${resultSetForComparison.resultCount})`)
        }
      } else {
        logWarn('saveSearch', `We want to run a comparison check, but one or other method didn't return results.`)
      }
    }
    logDebug('saveSearch', `after comparison check`)

    if (resultSetToUse) {
      if (resultSetToUse.resultCount === 0) {
        logDebug('saveSearch', `No results found for search [${searchTermsRepStr}]`)
        await showMessage(`No results found for search [${searchTermsRepStr}] with your current settings.`)
      }
    } else {
      throw new Error(`Couldn't get results found for search [${searchTermsRepStr}]. Please check the Plugin Console for details.`)
    }

    //---------------------------------------------------------
    // Do output
    // logDebug('saveSearch', 'reached do output stage')
    // const searchTermsRepStr = `'${resultSet.searchTermsRepArr.join(' ')}'`.trim() // Note: we normally enclose in [] but here need to use '' otherwise NP Editor renders the link wrongly

    // Create the x-callback URL for the refresh action
    const xCallbackURL = (originatorCommand === 'searchPeriod')
      ? createRunPluginCallbackUrl('jgclark.SearchExtensions', originatorCommand, [
        termsToMatchStr,
        getNoteTypesAsString(noteTypesToInclude),
        getParaTypesAsString(paraTypesToInclude),
        'refresh',
        fromDateStr,
        toDateStr,
      ])
      : createRunPluginCallbackUrl('jgclark.SearchExtensions', originatorCommand, [
        termsToMatchStr,
        getNoteTypesAsString(noteTypesToInclude),
        getParaTypesAsString(paraTypesToInclude),
        'refresh',
      ])

    switch (destination) {
      case 'searchSpecificNote': {
        await writeToSearchSpecificNote(config, resultSetToUse, periodAndPartStr, xCallbackURL)
        break
      }

      case 'quick': {
        await writeToQuickSearchNote(config, resultSetToUse, xCallbackURL)
        break
      }

      case 'log': {
        writeToLog(config, resultSetToUse, searchTermsRepStr)
        break
      }

      case 'cancel': {
        logInfo('saveSearch', `User cancelled this command`)
        break
      }

      default: { // i.e. 'current' or 'refresh'
        writeToCurrentNote(config, resultSetToUse, xCallbackURL)
        break
      }
    }
  }
  catch (err) {
    logError(pluginJson, JSP(err))
  }
}

async function writeToSearchSpecificNote(
  config: SearchConfig, resultSetToUse: resultOutputV3Type, periodAndPartStr: string, xCallbackURL: string
): Promise<void> {
  // We will write an overarching title, as we need an identifying title for the note.
  // As this is likely to be a note just used for this set of search terms, just delete the whole note contents and re-write each search term's block.
  // Note: Does need to include a subhead with search term + result count. Why?
  // Note: If no results, and the search results note hasn't already been created, then don't create it just for empty results. But do update it if it already exists.
  const searchTermsRepStr = resultSetToUse.searchTermsStr ?? '?'
  // const searchOperatorsRepStr = resultSetToUse.searchOperatorsStr ? ` (${resultSetToUse.searchOperatorsStr})` : ''
  const requestedTitle = `${searchTermsRepStr} ${config.searchHeading}${periodAndPartStr ? ` for ${periodAndPartStr}` : ''}`

  // Get/make note, and then replace the search term's block (if already present) or append.
  const noteFilename = await writeSearchResultsToNote(config, resultSetToUse, requestedTitle, xCallbackURL, true, false)

  logDebug('saveSearch', `- filename to write to (and potentially show in split): '${noteFilename}'`)
  if (noteOpenInEditor(noteFilename)) {
    logDebug('saveSearch', `- note ${noteFilename} already open in an editor window`)
  } else {
    // Open the results note in a new split window, unless we can tell
    logDebug('saveSearch', `- opening note ${noteFilename} in a split window`)
    await Editor.openNoteByFilename(noteFilename, false, 0, 0, true)
  }
}

async function writeToQuickSearchNote(
  config: SearchConfig, resultSetToUse: resultOutputV3Type, xCallbackURL: string
): Promise<void> {
  // Write to the same 'Quick Search Results' note (or whatever the user's setting is)
  // Delete the note's contents and re-write each time.
  // *Does* need to include a subhead with search term + result count, as title is fixed.
  const requestedTitle = config.quickSearchResultsTitle
  const noteFilename = await writeSearchResultsToNote(config, resultSetToUse, requestedTitle, xCallbackURL, false, false)

  logDebug('saveSearch', `- filename to open in split: ${noteFilename}`)
  if (noteOpenInEditor(noteFilename)) {
    logDebug('saveSearch', `- note ${noteFilename} already open in an editor window`)
  } else {
    // Open the results note in a new split window, unless we can tell
    logDebug('saveSearch', `- opening note ${noteFilename} in a split window`)
    await Editor.openNoteByFilename(noteFilename, false, 0, 0, true)
  }
}

function writeToLog(
  config: SearchConfig, resultSetToUse: resultOutputV3Type, searchTermsRepStr: string
): void {
  const headingMarker = '#'.repeat(config.headingLevel)
  const resultOutputLines: Array<string> = createFormattedResultLines(resultSetToUse, config)
  logInfo('saveSearch', `${headingMarker} ${searchTermsRepStr} (${resultSetToUse.resultCount} results)`)
  logInfo('saveSearch', resultOutputLines.join('\n'))
}

function writeToCurrentNote(
  config: SearchConfig, resultSetToUse: resultOutputV3Type, xCallbackURL: string
): void {
  if (resultSetToUse.resultCount === 0) {
    logInfo('saveSearch', `No results found for search [${resultSetToUse.searchTermsStr}].`)
    return
  }

  // We won't write an overarching title, but will add a section heading.
  // For each search term result set, replace the search term's block (if already present) or append.
  const currentNote = Editor.note
  if (currentNote == null) {
    throw new Error(`No note is open to save search results to.`)
  }

  const thisResultHeading = formSearchResultsHeadingLine(resultSetToUse)
  const thisMetadataLine = formSearchResultsMetadataLine(resultSetToUse, xCallbackURL)
  
  // First, remove section from note using earlier formats (from v2)
  const olderResultHeadingStart1 = `'${resultSetToUse.searchTermsStr}'`
  logDebug('saveSearch', `Will remove section '${olderResultHeadingStart1}' from current note`)
  let _res = removeSection(currentNote, olderResultHeadingStart1)
  const olderResultHeadingStart2 = `${resultSetToUse.searchTermsStr}`
  logDebug('saveSearch', `Will remove section '${olderResultHeadingStart2}' from current note`)
  _res = removeSection(currentNote, olderResultHeadingStart2)
  
  logDebug('saveSearch', `Will write update/append section '${thisResultHeading}' to current note (${currentNote.filename ?? ''})`)
  const resultOutputLines: Array<string> = createFormattedResultLines(resultSetToUse, config)
  replaceSection(currentNote, thisResultHeading, thisResultHeading, config.headingLevel, `${thisMetadataLine}\n${resultOutputLines.join('\n')}`)

  // Set note's icon
  setIconForNote(currentNote, "magnifying-glass")
  logDebug('saveSearch', `saveSearch() finished writing to current note.`)
}
