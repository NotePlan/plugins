/* eslint-disable max-len */
// @flow
//-----------------------------------------------------------------------------
// Commands to search and replace over NP notes.
// Jonathan Clark
// Last updated 2026-02-18 for v2.0.3, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import type { resultOutputType, TSearchOptions, typedSearchTerm } from './searchHelpers'
import { getSearchSettings, logBasicResultLines, runExtendedSearches, validateAndTypeSearchTerms, } from './searchHelpers'
import { clo, logDebug, logInfo, logError, logTimer, logWarn } from '@helpers/dev'
import { getNoteFromFilename } from '@helpers/NPnote'
import { escapeRegExp } from '@helpers/regex'
import { getInput, showMessage, showMessageYesNo } from '@helpers/userInput'

//-------------------------------------------------------------------------------
// Helper functions

/**
 * Build regex pattern for replacement, handling regex vs plain text searches
 * @param {typedSearchTerm} searchTerm - the validated search term
 * @param {string} searchStr - the original search string (fallback)
 * @param {boolean} caseSensitive - whether search should be case sensitive
 * @returns {RegExp} regex pattern for replacement
 */
function buildReplaceRegex(searchTerm: typedSearchTerm, searchStr: string, caseSensitive: boolean): RegExp {
  const isRegexSearch = searchTerm.type === 'regex'
  // Use the validated term if available, otherwise fall back to searchStr
  const termToUse = searchTerm.term || searchStr
  const patternToUse = isRegexSearch ? termToUse : escapeRegExp(termToUse)
  const flags = caseSensitive ? 'g' : 'gi'

  try {
    return new RegExp(patternToUse, flags)
  } catch (err) {
    logError('replace', `Invalid regex pattern '${patternToUse}': ${err.message}`)
    throw new Error(`Invalid search pattern: ${termToUse}`)
  }
}

/**
 * Get search term from user input or supplied argument
 * @param {string?} searchTermArg - optional search term argument
 * @param {string} commandNameToDisplay - command name for dialog
 * @param {Array<string>} defaultSearchTerms - default search terms from config
 * @returns {Promise<?string>} search term string or null if cancelled
 */
async function getSearchTermFromUserOrArg(
  searchTermArg?: string,
  commandNameToDisplay: string = 'Search-and-replace',
  defaultSearchTerms: Array<string> = []
): Promise<?string> {
  if (searchTermArg) {
    logDebug('replace', `arg0 -> search terms [${searchTermArg}]`)
    return searchTermArg
  }

  // ask user
  // Convert array to string for getInput (use first element or empty string)
  const defaultSearchTermsStr = defaultSearchTerms.length > 0 ? defaultSearchTerms[0] : ''
  const newTerms = await getInput(`Enter the search term.`, 'OK', commandNameToDisplay, defaultSearchTermsStr)
  if (typeof newTerms === 'boolean') {
    // i.e. user has cancelled
    logInfo('replace', `User has cancelled operation.`)
    return null
  }
  logDebug('replace', `user -> search term [${newTerms}]`)
  return newTerms
}

/**
 * Get replace expression from user input or supplied argument
 * @param {string?} replaceExpressionArg - optional replace expression argument
 * @param {string} commandNameToDisplay - command name for dialog
 * @returns {Promise<?string>} replace expression string or null if cancelled
 */
async function getReplaceExpressionFromUserOrArg(
  replaceExpressionArg?: string,
  commandNameToDisplay: string = 'Search-and-replace'
): Promise<?string> {
  if (replaceExpressionArg) {
    logDebug('replace', `arg1 -> replace expression [${replaceExpressionArg}]`)
    return replaceExpressionArg
  }

  // ask user
  const newTerm = await getInput(`Enter the replace expression.`, 'OK', commandNameToDisplay, '')
  if (typeof newTerm === 'boolean') {
    // i.e. user has cancelled
    logInfo('replace', `User has cancelled operation.`)
    return null
  }
  logDebug('replace', `user -> replace expression [${newTerm}]`)
  return newTerm
}

/**
 * Confirm replacement with user before proceeding
 * @param {resultOutputType} searchResults - search results to display
 * @param {typedSearchTerm} searchTerm - validated search term
 * @param {string} replaceExpression - replacement expression
 * @param {any} config - search configuration
 * @returns {Promise<boolean>} true if user confirmed, false if cancelled
 */
async function confirmReplaceWithUser(
  searchResults: resultOutputType,
  searchTerm: typedSearchTerm,
  replaceExpression: string,
  config: any
): Promise<boolean> {
  if (searchResults.resultCount === 0) {
    logDebug('replace', `No results found for search ${searchTerm.termRep}`)
    await showMessage(`No results found for search ${searchTerm.termRep}`)
    return false
  }

  logBasicResultLines(searchResults, config)
  const res = await showMessageYesNo(
    `There are ${searchResults.resultCount} matches in ${searchResults.resultNoteCount} notes (see plugin log for the details).\nAre you sure you want to continue and replace with '${replaceExpression}'?\n\nNote: This is no way to easily undo this.`,
    ['Yes', 'Cancel'],
    'Confirm Replace',
    false
  )
  // Treat any response other than 'Yes' as cancel (e.g. 'Cancel' or 'No' — dialog shows ['Yes', 'Cancel'] so Cancel returns 'Cancel')
  if (res !== 'Yes') {
    logDebug('replace', `User has cancelled operation.`)
    return false
  }
  return true
}

/**
 * Perform replacements on all found matches
 * @param {resultOutputType} searchResults - search results containing matches
 * @param {typedSearchTerm} searchTerm - validated search term
 * @param {string} searchStr - original search string
 * @param {string} replaceExpression - replacement expression
 * @param {TSearchOptions} searchOptions - search options including case sensitivity
 * @returns {void}
 */
function performReplacements(
  searchResults: resultOutputType,
  searchTerm: typedSearchTerm,
  searchStr: string,
  replaceExpression: string,
  searchOptions: TSearchOptions
): void {
  logDebug('replace', `Will now replace with '${replaceExpression}'`)
  // Use updateParagraph() multiple times. (Can't really use updateParagraphs() as it only works on a single note at a time.)
  for (let c = 0; c < searchResults.resultNoteAndLineArr.length; c++) {
    const nal = searchResults.resultNoteAndLineArr[c]
    const thisFilename = nal.noteFilename
    const thisNote = getNoteFromFilename(thisFilename)
    if (!thisNote) {
      logWarn('replace', `Couldn't find note for ${thisFilename} to update`)
      continue
    }

    // Use the index from search results to directly access the paragraph
    // This is more reliable than searching by content match
    if (nal.index < 0 || nal.index >= thisNote.paragraphs.length) {
      logWarn('replace', `Invalid paragraph index ${nal.index} for note ${thisFilename} (note has ${thisNote.paragraphs.length} paragraphs)`)
      continue
    }

    const thisPara = thisNote.paragraphs[nal.index]
    if (!thisPara) {
      logWarn('replace', `Couldn't access paragraph at index ${nal.index} in ${thisFilename}`)
      continue
    }

    // Get the current content (use rawContent if available, otherwise content)
    const currentContent = thisPara.rawContent || thisPara.content

    // JS .replaceAll() is always case-sensitive with simple strings. So we need to use it via a regex.
    // Build regex pattern, handling regex vs plain text searches and escaping special characters
    const replaceRegex = buildReplaceRegex(searchTerm, searchStr, searchOptions.caseSensitiveSearching ?? false)
    logDebug('replace', `replaceRegex = ${replaceRegex.toString()} with caseSensitiveSearching = ${String(searchOptions.caseSensitiveSearching)}`)

    // Perform replacement on the current content
    const replacedContent = currentContent.replaceAll(replaceRegex, replaceExpression)

    // Only update if content actually changed
    if (replacedContent !== currentContent) {
      thisPara.content = replacedContent
      logDebug('replace', `#${String(c)} in ${thisFilename} [index ${nal.index}] -> ${replacedContent}`)
      thisNote.updateParagraph(thisPara)
      // Update cache after modifying note (required by workspace rules)
      DataStore.updateCache(thisNote, true)
    } else {
      logDebug('replace', `#${String(c)} in ${thisFilename} [index ${nal.index}] -> no change (content already matches)`)
    }
  }
}

/**
 * Verify replacements by running search again (only in debug mode)
 * @param {typedSearchTerm} searchTerm - validated search term
 * @param {string} searchStr - original search string
 * @param {any} config - search configuration
 * @param {TSearchOptions} searchOptions - search options
 * @returns {Promise<void>}
 */
async function verifyReplacements(
  searchTerm: typedSearchTerm,
  searchStr: string,
  config: any,
  searchOptions: TSearchOptions
): Promise<void> {
  if (config._logLevel === 'debug') {
    const checkResults: resultOutputType = await runExtendedSearches([searchTerm], config, searchOptions)
    if (checkResults.resultCount > 0) {
      logWarn('replace', `I've double-checked the replace, and found that there are still ${checkResults.resultCount} unchanged copies of '${searchStr}'`)
    } else {
      logDebug('replace', `I've double-checked the replace, and it has changed all the copies.`)
    }
  }
}

/**
 * Build search options object for replace operation
 * @param {string} noteTypesToIncludeArg - note types to include ('both', 'notes', 'calendar')
 * @param {string?} paraTypeFilterArg - optional comma-separated paragraph types
 * @param {any} config - search configuration
 * @returns {TSearchOptions} search options object
 */
function buildSearchOptionsForReplace(
  noteTypesToIncludeArg: string,
  paraTypeFilterArg?: string,
  config: any
): TSearchOptions {
  // Get the noteTypes to include, from arg2
  const noteTypesToInclude: Array<string> = (noteTypesToIncludeArg === 'both' || noteTypesToIncludeArg === '') ? ['notes', 'calendar'] : [noteTypesToIncludeArg]
  logDebug('replace', `arg2 -> note types '${noteTypesToInclude.toString()}'`)

  // Get the paraTypes to include
  // $FlowFixMe[incompatible-type]
  const paraTypesToInclude: Array<ParagraphType> = (paraTypeFilterArg && paraTypeFilterArg !== '') ? paraTypeFilterArg.split(',') : []
  logDebug('replace', `arg3 -> para types '${paraTypesToInclude.toString()}'`)

  // Form TSearchOptions object
  const searchOptions: TSearchOptions = {
    noteTypesToInclude: noteTypesToInclude,
    foldersToInclude: [],
    foldersToExclude: config.foldersToExclude,
    paraTypesToInclude: paraTypesToInclude,
    caseSensitiveSearching: config.caseSensitiveSearching,
  }

  return searchOptions
}

//-------------------------------------------------------------------------------

/**
 * Call the main function, search-and-replace over all notes.
 */
export async function replaceOverAll(searchTermsArg?: string, replaceTermArg?: string, paraTypeFilterArg?: string): Promise<void> {
  await replace(
    searchTermsArg,
    replaceTermArg,
    'both',
    paraTypeFilterArg,
    'Search-and-Replace'
  )
}

/**
 * Call the main function, but requesting only Calendar notes be search-and-replaced.
 */
export async function replaceOverCalendar(searchTermsArg?: string, replaceTermArg?: string, paraTypeFilterArg?: string): Promise<void> {
  await replace(
    searchTermsArg,
    replaceTermArg,
    'calendar',
    paraTypeFilterArg,
    'Search-and-Replace in Calendar notes')
}

/**
 * Call the main function, but requesting only Project notes be search-and-replaced.
 */
export async function replaceOverNotes(searchTermsArg?: string, replaceTermArg?: string, paraTypeFilterArg?: string): Promise<void> {
  await replace(
    searchTermsArg,
    replaceTermArg,
    'notes',
    paraTypeFilterArg,
    'Search-and-replace in Regular notes')
}

/**------------------------------------------------------------------------
 * Run a search and replace over notes.
 * Works interactively (if no arguments given) or in the background (using supplied arguments).
 * @author @jgclark
 *
 * @param {string?} searchTermArg optional search term to use (which can be regex)
 * @param {string?} replaceExpression 
 * @param {string} noteTypesToInclude either 'project','calendar' or 'both' -- as string not array
 * @param {string?} paraTypeFilterArg optional list of paragraph types to filter by
 * @param {string?} commandNameToDisplay optional
*/
export async function replace(
  searchTermArg?: string,
  replaceExpressionArg?: string = '',
  noteTypesToIncludeArg?: string = 'both',
  paraTypeFilterArg?: string = '',
  commandNameToDisplay?: string = 'Search-and-replace',
): Promise<void> {
  try {
    // get relevant settings
    const config = await getSearchSettings()
    logDebug(pluginJson, `arg0 -> searchTermArg ${typeof searchTermArg}`)
    logDebug(pluginJson, `arg0 -> searchTermArg '${searchTermArg ?? '(not supplied)'}'`)

    // work out if we're being called non-interactively (i.e. via x-callback) by seeing whether originatorCommand is not empty
    const calledNonInteractively = (searchTermArg !== undefined && searchTermArg !== null)
    logDebug('replace', `- called non-interactively? ${String(calledNonInteractively)}`)

    // Build search options
    const searchOptions = buildSearchOptionsForReplace(
      noteTypesToIncludeArg ?? 'both',
      paraTypeFilterArg,
      config
    )

    // Get the search term, either from arg0 supplied, or by asking user
    const searchStr = await getSearchTermFromUserOrArg(searchTermArg, commandNameToDisplay, config.defaultSearchTerms)
    if (searchStr == null) {
      return // User cancelled
    }

    // Validate and type the search term: an empty return means failure. There is error logging in the function.
    const validatedSearchTerm = await validateAndTypeSearchTerms(searchStr, false)
    clo(validatedSearchTerm, "validatedSearchTerm")
    if (validatedSearchTerm == null || validatedSearchTerm.length === 0) {
      throw new Error(`The search term [${searchStr}] is not a valid expression. Please see Plugin Console for details.`)
    }
    const searchTerm: typedSearchTerm = validatedSearchTerm[0]

    //----------------------------------------------------------------------------
    // Search using search() API, extended to make case-sensitive
    CommandBar.showLoading(true, `${commandNameToDisplay} ...`)
    await CommandBar.onAsyncThread()
    // $FlowFixMe[incompatible-exact] Note: deliberately no await: this is resolved later
    const searchResultsProm: resultOutputType = runExtendedSearches([searchTerm], config, searchOptions)
    await CommandBar.onMainThread()

    //----------------------------------------------------------------------------
    // While that's thinking ...
    // Get the replace expression, either from arg1 supplied, or by asking user
    const replaceExpression = await getReplaceExpressionFromUserOrArg(replaceExpressionArg, commandNameToDisplay)
    if (replaceExpression == null) {
      CommandBar.showLoading(false)
      return // User cancelled
    }

    //---------------------------------------------------------
    // End of search Call started above
    const searchResults = await searchResultsProm // here's where we resolve the promise
    CommandBar.showLoading(false)

    //---------------------------------------------------------
    // Tell user results of search and double check they want to proceed
    const userConfirmed = await confirmReplaceWithUser(searchResults, searchTerm, replaceExpression, config)
    if (!userConfirmed) {
      return
    }

    //---------------------------------------------------------
    // Do the replace
    const startTime = new Date() // for timing
    performReplacements(searchResults, searchTerm, searchStr, replaceExpression, searchOptions)
    logTimer('replace', startTime, `replace() finished.`)

    // Verify replacements (only in debug mode)
    await verifyReplacements(searchTerm, searchStr, config, searchOptions)
  }
  catch (err) {
    logError(pluginJson, err.message)
  }
}
