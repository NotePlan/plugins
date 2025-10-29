/* eslint-disable max-len */
// @flow
//-----------------------------------------------------------------------------
// Commands to search and replace over NP notes.
// Jonathan Clark
// Last updated 2025-09-28 for v3.0.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import type { resultOutputV3Type, TSearchOptions, typedSearchTerm } from './searchHelpers'
import { getSearchSettings, logBasicResultLines, } from './searchHelpers'
import { runNPExtendedSyntaxSearches } from './NPExtendedSyntaxHelpers'
import { runPluginExtendedSyntaxSearches, validateAndTypeSearchTerms, } from './pluginExtendedSyntaxHelpers'
import { clo, logDebug, logInfo, logError, logTimer, logWarn } from '@helpers/dev'
import { findParaFromStringAndFilename } from '@helpers/NPParagraph'
import { getNoteFromFilename } from '@helpers/NPnote'
// import { getSearchOperators, quoteTermsInSearchString, removeSearchOperators } from '@helpers/search'
import {
  getInput,
  showMessage,
  showMessageYesNo
} from '@helpers/userInput'

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
 * TODO: update this to understand search operators, probably using getSearchOperators, quoteTermsInSearchString, removeSearchOperators.
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
    // const headingMarker = '#'.repeat(config.headingLevel)
    logDebug(pluginJson, `arg0 -> searchTermArg ${typeof searchTermArg}`)
    logDebug(pluginJson, `arg0 -> searchTermArg '${searchTermArg ?? '(not supplied)'}'`)
    const NPAdvancedSyntaxAvailable = NotePlan.environment.buildVersion >= 1429

    // work out if we're being called non-interactively (i.e. via x-callback) by seeing whether originatorCommand is not empty
    // const calledNonInteractively = (searchTermArg !== undefined)
    // logDebug('replace', `- called ${calledNonInteractively ? 'NON-' : ''}interactively`)

    // Get the noteTypes to include, from arg2
    const noteTypesToInclude: Array<string> = (noteTypesToIncludeArg === 'both' || noteTypesToIncludeArg === '') ? ['notes', 'calendar'] : [noteTypesToIncludeArg]
    logDebug('replace', `arg2 -> note types '${noteTypesToInclude.toString()}'`)

    // Get the search term, either from arg0 supplied, or by asking user
    let searchStr = ''
    if (searchTermArg) {
      // from argument supplied
      searchStr = searchTermArg ?? ''
      logDebug('replace', `arg0 -> search terms [${searchStr}]`)
    }
    else {
      // ask user
      const newTerms = await getInput(`Enter the search term to replace`, 'OK', commandNameToDisplay, config.defaultSearchTerms)
      if (typeof newTerms === 'boolean') {
        // i.e. user has cancelled
        logInfo('replace', `User has cancelled operation.`)
        return
      } else {
        searchStr = newTerms
        logDebug('replace', `user -> search term [${searchStr}]`)
      }
    }

    // Validate and type the search term: an empty return means failure. There is error logging in the function.
    const validatedSearchTerm = await validateAndTypeSearchTerms(searchStr, false)
    clo(validatedSearchTerm, "validatedSearchTerm")
    if (validatedSearchTerm == null || validatedSearchTerm.length === 0) {
      throw new Error(`The search term [${searchStr}] is not a valid expression. Please see Plugin Console for details.`)
    }
    const searchTerm: typedSearchTerm = validatedSearchTerm[0]

    // Get the paraTypes to include
    // $FlowFixMe[incompatible-type]
    const paraTypesToInclude: Array<ParagraphType> = (paraTypeFilterArg && paraTypeFilterArg !== '') ? paraTypeFilterArg.split(',') : []
    // logDebug('replace', `arg3 -> para types '${typeof paraTypeFilterArg}'`)
    // logDebug('replace', `arg3 -> para types '${paraTypeFilterArg ?? '(null)'}'`)
    logDebug('replace', `arg3 -> para types '${paraTypesToInclude.toString()}'`)

    // Form TSearchOptions object
    const searchOptions: TSearchOptions = {
      noteTypesToInclude: noteTypesToInclude,
      foldersToInclude: [],
      foldersToExclude: config.foldersToExclude,
      paraTypesToInclude: paraTypesToInclude,
      caseSensitiveSearching: config.caseSensitiveSearching,
    }

    //----------------------------------------------------------------------------
    // Search using search() API, extended to make case-sensitive
    let searchResultsProm: resultOutputV3Type
    CommandBar.showLoading(true, `${commandNameToDisplay} ...`)
    await CommandBar.onAsyncThread()
    // Now do the relevant processing for different versions of NP
    if (NPAdvancedSyntaxAvailable) {
      // $FlowFixMe[incompatible-exact] Note: deliberately no await: this is resolved later
      searchResultsProm = runNPExtendedSyntaxSearches(searchStr, config, searchOptions)
    } else {
      // $FlowFixMe[incompatible-exact] Note: deliberately no await: this is resolved later
      searchResultsProm = runPluginExtendedSyntaxSearches([searchTerm], config, searchOptions)
    }
    await CommandBar.onMainThread()

    //----------------------------------------------------------------------------
    // While that's thinking ...
    // Get the replace expression, either from arg1 supplied, or by asking user
    let replaceExpression = ''
    if (replaceExpressionArg) {
      // replaceExpression argument supplied
      replaceExpression = replaceExpressionArg ?? ''
      logDebug('replace', `arg1 -> search terms [${replaceExpression}]`)
    }
    else {
      // ask user
      const newTerm = await getInput(`Enter the replace expression.`, 'OK', commandNameToDisplay, '')
      if (typeof newTerm === 'boolean') {
        // i.e. user has cancelled
        logInfo('replace', `User has cancelled operation.`)
        return
      } else {
        replaceExpression = newTerm
        logDebug('replace', `user -> search term [${replaceExpression}]`)
      }
    }

    //---------------------------------------------------------
    // End of search Call started above
    const searchResults = await searchResultsProm // here's where we resolve the promise
    CommandBar.showLoading(false)

    //---------------------------------------------------------
    // Tell user results of search and double check they want to proceed
    if (searchResults.resultCount === 0) {
      logDebug('replace', `No results found for search ${searchTerm.termRep}`)
      await showMessage(`No results found for search ${searchTerm.termRep}`)
      return
    } else {
      logBasicResultLines(searchResults, config)

      const res = await showMessageYesNo(`There are ${searchResults.resultCount} matches in ${searchResults.resultNoteCount} notes (see plugin log for the details).\nAre you sure you want to continue and replace with '${replaceExpression}'?\n\nNote: This is no way to easily undo this.`, ['Yes', 'Cancel'], 'Confirm Replace', false)
      if (res === 'No') {
        logDebug('replace', `User has cancelled operation.`)
        return
      }
    }

    //---------------------------------------------------------
    // Do the replace
    const startTime = new Date() // for timing
    logDebug('replace', `------------ Will now replace with '${replaceExpression}' -------------`)
    // Use updateParagraph() multiple times. (Can't really use updateParagraphs() as it only works on a single note at a time.)
    for (let c = 0; c < searchResults.resultNoteAndLineArr.length; c++) {
      const nal = searchResults.resultNoteAndLineArr[c]
      const thisFilename = nal.noteFilename
      const thisNote = getNoteFromFilename(thisFilename)
      if (!thisNote) {
        logWarn('replace', `Couldn't find note for '${thisFilename}' to update`)
        continue
      }
      const thisPara = findParaFromStringAndFilename(thisFilename, nal.line)
      if (!thisPara) {
        logWarn('replace', `Couldn't find paragraph {${nal.line}} in '${thisFilename}' to update`)
        continue
      }
      // JS .replaceAll() is always case-sensitive with simple strings. So we need to use it via a regex.
      const replaceRegex = (searchOptions.caseSensitiveSearching)
        ? new RegExp(searchStr, 'g')
        : new RegExp(searchStr, 'gi')
      logDebug('replace', `replaceRegex = ${replaceRegex.toString()} with caseSensitiveSearching = ${String(searchOptions.caseSensitiveSearching)}`)
      const replacedContent = nal.line.replaceAll(replaceRegex, replaceExpression)
      thisPara.content = replacedContent
      logDebug('replace', `#${String(c)} in ${thisFilename} -> ${replacedContent}`)
      thisNote.updateParagraph(thisPara)
    }
    logTimer('replace', startTime, `replace() finished.`)
    logDebug('replace', `----------------------------------------------------------`)

    // Confirmatory check: run search again and see if it is zero
    const checkResults: resultOutputV3Type = (NPAdvancedSyntaxAvailable)
      ? await runNPExtendedSyntaxSearches(searchStr, config, searchOptions) 
      : await runPluginExtendedSyntaxSearches([searchTerm], config, searchOptions)
    if (checkResults.resultCount > 0) {
      logWarn('replace', `I've double-checked the replace, and found that there are ${checkResults.resultCount} unchanged copies of '${searchStr}'`)
    } else {
      logDebug('replace', `I've double-checked the replace, and it has changed all the copies.`)
    }
  }
  catch (err) {
    logError(pluginJson, err.message)
  }
}
