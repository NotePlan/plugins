/* eslint-disable max-len */
// @flow
//-----------------------------------------------------------------------------
// Interactive commands for SearchExtensions plugin.
// Create list of occurrences of note paragraphs with specified strings, which can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 2025-10-30 for v3.0.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getDateRangeFromUser } from './dateRanges'
import type { TSearchResultSet, SearchConfig, TSearchOptions } from './searchHelpers'
import {
  applyOperatorsFromSearchString,
  buildRefreshCallbackArgs,
  createFormattedResultLines,
  formSearchResultsHeadingLine,
  formSearchResultsMetadataLine,
  getNoteTypesFromString,
  getNoteTypesAsString,
  getParaTypesFromString,
  getParaTypesAsString,
  getSearchCommandName,
  getSearchSettings,
  insertOrReplaceMetadataLine,
  mergeSearchOptionsWithConfig,
  normaliseDestination,
  OPEN_PARA_TYPES,
  prependDateOperatorsIfNeeded,
  writeSearchResultsToNote,
} from './searchHelpers'
import { runNativeSearch } from './nativeSearch'
import { stringToTailwindColorName } from '@helpers/colors'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { ensureFrontmatter } from '@helpers/NPFrontMatter'
import { createRunPluginCallbackUrl } from '@helpers/general'
import { removeSection, replaceSection, setIconForNote } from '@helpers/note'
import { noteOpenInEditor } from '@helpers/NPEditor'
import {
  chooseOption,
  getInputTrimmed,
  showMessage,
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
    commandNameToDisplay: 'Search over all notes',
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
  logDebug('searchPeriod', `starting with searchTermsArg=${searchTermsArg ?? ''} with date range args '${fromDateArg}' to '${toDateArg}' and destinationArg=${destinationArg ?? ''}`)
  let fromDateStr = fromDateArg
  let toDateStr = toDateArg
  let _periodString: string
  let _periodAndPartStr: string
  // If we have neither fromDate and toDate, then ask user for them, ensuring we have at least one of them.
  if (!fromDateStr  && !toDateStr) {
    [fromDateStr, toDateStr, _periodString, _periodAndPartStr] = await getDateRangeFromUser()
    logDebug('searchPeriod', `- user requested date range '${fromDateStr}' to '${toDateStr}'`)
    if (fromDateStr > toDateStr) {
      throw new Error(`Stopping: fromDate ${fromDateStr} is after toDate ${toDateStr}`)
    }
    if (fromDateStr === '' && toDateStr === '') {
      fromDateStr = 'past'
    }
  }
  const searchOptions: TSearchOptions = {
    noteTypesToInclude: ['calendar'],
    foldersToInclude: [],
    paraTypesToInclude: getParaTypesFromString(paraTypesAsStr),
    originatorCommand: 'searchPeriod',
    commandNameToDisplay: 'Searching in period',
    destinationArg: destinationArg,
    fromDateStr: fromDateStr,
    toDateStr: toDateStr,
    useNativeSortOrder: false
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
 * Uses NotePlan advanced (native) search only (requires NP 3.18.1+).
 * @author @jgclark
 *
 * @param {TSearchOptions} searchOptions an object holding a number of settings
 * @param {string?} searchTermsArg optional search terms (native advanced syntax)
 * @param {string?} destinationArg optional output destination: 'current', 'searchSpecificNote'/'newnote', 'quick', 'log'. (Default: 'searchSpecificNote' where relevant.)
*/
export async function saveSearch(
  searchOptions: TSearchOptions,
  searchTermsArg?: string,
  destinationArg?: string = 'searchSpecificNote',
): Promise<void> {
  try {
    const config = await getSearchSettings()
    logDebug(pluginJson, `Starting saveSearch() with searchTermsArg '${searchTermsArg ?? '(not supplied)'}', on NP build version ${String(NotePlan.environment.buildVersion)}`)
    // clo(searchOptions, 'saveSearch starting with searchOptions:')

    // Get the noteTypes to include (may be updated later from search operators)
    let noteTypesToInclude = searchOptions.noteTypesToInclude || ['calendar', 'notes']

    mergeSearchOptionsWithConfig(searchOptions, config)
    const originatorCommand = searchOptions.originatorCommand ?? ''
    logDebug('saveSearch', `- originatorCommand = '${originatorCommand}'`)

    const commandNameToDisplay = searchOptions.commandNameToDisplay ?? 'Searching'

    // Get the search terms, either from argument supplied, or by asking user
    let termsToMatchStr = ''
    if (searchTermsArg) {
      // from argument supplied
      termsToMatchStr = searchTermsArg ?? ''
      logDebug('saveSearch', `- arg1 -> search terms [${termsToMatchStr}]`)
    }
    else {
      // ask user
      const newTerms = await getInputTrimmed(`Enter search term(s)`, 'OK', commandNameToDisplay, config.defaultSearchTerms)
      if (typeof newTerms === 'boolean') {
        // i.e. user has cancelled
        logInfo('saveSearch', `User has cancelled operation.`)
        CommandBar.showLoading(false)
        return
      }
      termsToMatchStr = newTerms
      logDebug('saveSearch', `user -> search terms [${termsToMatchStr}]`)
    }

    // Get the paraTypes to include
    const paraTypesToInclude: Array<ParagraphType> = searchOptions.paraTypesToInclude || []
    logDebug('saveSearch', `- arg3 -> para types '${paraTypesToInclude.toString()}'`)

    // Set up shared variables
    let searchTermsRepStr = ''
    let periodString = ''
    let periodAndPartStr = ''
    // Preserve period dates from searchOptions for refresh x-callbacks
    let fromDateStr = searchOptions.fromDateStr ?? ''
    let toDateStr = searchOptions.toDateStr ?? ''

    //---------------------------------------------------------
    // NP advanced (native) search syntax only (requires NP 3.18.1+)
    logDebug('saveSearch', `Using NP advanced search syntax`)
    applyOperatorsFromSearchString(termsToMatchStr, searchOptions)
    noteTypesToInclude = searchOptions.noteTypesToInclude || noteTypesToInclude

    // If we have a date range passed in (rather than only as search operators), prefix date: onto the terms
    logDebug('saveSearch', `- date range? ${String('fromDateStr' in searchOptions)} and ${String('toDateStr' in searchOptions)}`)
    const datePrep = prependDateOperatorsIfNeeded(termsToMatchStr, searchOptions)
    termsToMatchStr = datePrep.terms
    fromDateStr = datePrep.fromDateStr
    toDateStr = datePrep.toDateStr
    periodString = datePrep.periodString
    periodAndPartStr = datePrep.periodAndPartStr
    searchTermsRepStr = termsToMatchStr

    CommandBar.showLoading(true, `${commandNameToDisplay} for [${searchTermsRepStr}] ...`)
    await CommandBar.onAsyncThread()

    // Note: deliberately no await: this is resolved below, after we have worked out where to save the results
    const resultsProm: Promise<TSearchResultSet> = runNativeSearch(termsToMatchStr, config, searchOptions)

    await CommandBar.onMainThread()

    //---------------------------------------------------------
    // While the search goes on, work out where to save this summary
    let destination = ''
    if (originatorCommand === 'quickSearch') {
      destination = 'quick'
    }
    else if (destinationArg != null && destinationArg !== '') {
      destination = normaliseDestination(destinationArg)
    }
    else if (config.autoSave) {
      // Config asks to save automatically to 'searchSpecificNote'
      destination = 'searchSpecificNote'
    }
    else {
      // else ask user
      const labelString = `🖊 Create/update note ${searchTermsRepStr} ${config.searchHeading} ${periodString ? `'${periodString}' ` : ' '}in folder '${config.folderToStore}'`
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
      destination = normaliseDestination(destination)
    }
    logDebug('saveSearch', `destination = ${destination}, started with originatorCommand = ${originatorCommand ?? 'undefined'}`)

    //---------------------------------------------------------
    // End of main work started above: resolve the promise
    logDebug('saveSearch', `before promise resolves`)
    const resultSetToUse: ?TSearchResultSet = await resultsProm
    CommandBar.showLoading(false)

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
    // Create the x-callback URL for the refresh action.
    // Use plugin command name (not jsFunction) and per-command arg order.
    const refreshCommandName = getSearchCommandName(originatorCommand)
    const refreshArgs = buildRefreshCallbackArgs(
      originatorCommand,
      termsToMatchStr,
      getNoteTypesAsString(noteTypesToInclude),
      getParaTypesAsString(paraTypesToInclude),
      'refresh',
      fromDateStr,
      toDateStr,
    )
    const xCallbackURL = createRunPluginCallbackUrl('jgclark.SearchExtensions', refreshCommandName, refreshArgs)

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
        writeSearchResultsToCurrentNote(config, resultSetToUse, xCallbackURL)
        break
      }
    }
  }
  catch (err) {
    logError('saveSearch', JSP(err))
  }
}

async function writeToSearchSpecificNote(
  config: SearchConfig, resultSetToUse: TSearchResultSet, periodAndPartStr: string, xCallbackURL: string
): Promise<void> {
  // We will write an overarching title, as we need an identifying title for the note.
  // As this is likely to be a note just used for this set of search terms, just delete the whole note contents and re-write each search term's block.
  // Note: Does need to include a subhead with search term + result count. Why?
  // Note: If no results, and the search results note hasn't already been created, then don't create it just for empty results. But do update it if it already exists.
  const searchTermsRepStr = resultSetToUse.searchTermsStr ?? '?'
  // const searchOperatorsRepStr = resultSetToUse.searchOperatorsStr ? ` (${resultSetToUse.searchOperatorsStr})` : ''
  const requestedTitle = `[${searchTermsRepStr}] ${config.searchHeading}${periodAndPartStr ? ` for ${periodAndPartStr}` : ''}`

  // Get/make note, and then replace the search term's block (if already present) or append.
  const noteFilename = await writeSearchResultsToNote(config, resultSetToUse, requestedTitle, xCallbackURL, true, true)
  logDebug('saveSearch/writeToSearchSpecificNote', `- written to filename '${noteFilename}'`)

  if (resultSetToUse.resultCount === 0) {
    logDebug('saveSearch/writeToSearchSpecificNote', `- no results, so not opening results note ${noteFilename}`)
  } else {
    if (noteOpenInEditor(noteFilename)) {
      logDebug('saveSearch/writeToSearchSpecificNote', `- note ${noteFilename} already open in an editor window`)
    } else {
      // Open the results note in a new split window
      logDebug('saveSearch/writeToSearchSpecificNote', `- opening note ${noteFilename} in a split window`)
      await Editor.openNoteByFilename(noteFilename, false, 0, 0, true)
    }
  }
}

async function writeToQuickSearchNote(
  config: SearchConfig, resultSetToUse: TSearchResultSet, xCallbackURL: string
): Promise<void> {
  // Write to the same 'Quick Search Results' note (or whatever the user's setting is)
  // Delete the note's contents and re-write each time.
  // *Does* need to include a subhead with search term + result count, as title is fixed.
  const noteFilename = await writeSearchResultsToNote(config, resultSetToUse, config.quickSearchResultsTitle, xCallbackURL, false, false)

  // Open the results note in a split window, even if there are no results
  logDebug('saveSearch/writeToQuickSearchNote', `- filename to open in split: ${noteFilename}`)
  if (noteOpenInEditor(noteFilename)) {
    logDebug('saveSearch/writeToQuickSearchNote', `- note ${noteFilename} already open in an editor window`)
  } else {
    // Open the results note in a new split window, unless we can tell
    logDebug('saveSearch/writeToQuickSearchNote', `- opening note ${noteFilename} in a split window`)
    await Editor.openNoteByFilename(noteFilename, false, 0, 0, true)
  }
}

function writeToLog(
  config: SearchConfig, resultSetToUse: TSearchResultSet, searchTermsRepStr: string
): void {
  const headingMarker = '#'.repeat(config.headingLevel)
  const resultOutputLines: Array<string> = createFormattedResultLines(resultSetToUse, config)
  logInfo('saveSearch/writeToLog', `${headingMarker} ${searchTermsRepStr} (${resultSetToUse.resultCount} results)`)
  logInfo('saveSearch/writeToLog', resultOutputLines.join('\n'))
}

/**
 * Update search results in the current Editor note. We won't write an overarching title, but will add a section heading.
 * For each search term result set, replace the search term's block (if already present) or append.
 * @author @jgclark
 *
 * @param {SearchConfig} config
 * @param {TSearchResultSet} resultSet object
 * @param {string} xCallbackURL URL to cause a 'refresh' of this command
 */
function writeSearchResultsToCurrentNote(
  config: SearchConfig, resultSetToUse: TSearchResultSet, xCallbackURL: string
): void {
  try {
    if (resultSetToUse.resultCount === 0) {
      logInfo('saveSearch/writeSearchResultsToCurrentNote', `No results found for search [${resultSetToUse.searchTermsStr}].`)
      return
    }

    const currentNote = Editor.note
    if (currentNote == null) {
      throw new Error(`No note is open to save search results to.`)
    }

    const thisResultHeading = formSearchResultsHeadingLine(resultSetToUse)
    const thisMetadataLine = formSearchResultsMetadataLine(resultSetToUse, xCallbackURL)
    insertOrReplaceMetadataLine(currentNote, config, thisMetadataLine)
    
    // Ensure that frontmatter is present
    const FMResult = ensureFrontmatter(currentNote)
    if (!FMResult) {
      logWarn('saveSearch/writeSearchResultsToCurrentNote',`Failed to ensure frontmatter in current note. Will try to continue.`)
    }

    // Remove section from note using 2 different possible formats
    const olderResultHeadingStart1 = `'${resultSetToUse.searchTermsStr}'`
    logDebug('saveSearch/writeSearchResultsToCurrentNote', `Will try to remove section '${olderResultHeadingStart1}' from current note`)
    const _res1 = removeSection(currentNote, olderResultHeadingStart1)
    const olderResultHeadingStart2 = `${resultSetToUse.searchTermsStr}`
    logDebug('saveSearch/writeSearchResultsToCurrentNote', `Will try to remove section '${olderResultHeadingStart2}' from current note`)
    const _res2 = removeSection(currentNote, olderResultHeadingStart2)

    logDebug('saveSearch/writeSearchResultsToCurrentNote', `Will replace section '${thisResultHeading}' with new content`)
    const resultOutputLines: Array<string> = createFormattedResultLines(resultSetToUse, config)
    replaceSection(currentNote, thisResultHeading, thisResultHeading, config.headingLevel, `${resultOutputLines.join('\n')}`)

    // Set note's icon
    setIconForNote(currentNote, "magnifying-glass", stringToTailwindColorName(thisResultHeading))
    logDebug('saveSearch/writeSearchResultsToCurrentNote', `Finished writing to current note.`)
  }
  catch (err) {
    logError('saveSearch/writeSearchResultsToCurrentNote', err.message)
  }
}
