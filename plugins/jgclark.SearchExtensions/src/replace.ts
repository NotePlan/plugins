/* eslint-disable max-len */
// @flow
//-----------------------------------------------------------------------------
// Commands to search and replace over NP notes.
// Jonathan Clark
// Last updated 2024-10-26 for v1.4.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  getSearchSettings,
  // getSearchTermsRep,
  logBasicResultLines,
  type resultOutputTypeV3,
  runSearchesV2,
  type typedSearchTerm,
  validateAndTypeSearchTerms,
} from './searchHelpers'
import { clo, logDebug, logInfo, logError, logTimer, logWarn } from '@np/helpers/dev'
// import { displayTitle } from '@np/helpers/general'
import { findParaFromStringAndFilename } from '@np/helpers/NPParagraph'
import {
  getInput,
  showMessage,
  showMessageYesNo
} from '@np/helpers/userInput'

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
 * Run a search and replace over notes (TODO: with regex capabilities).
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
    const headingMarker = '#'.repeat(config.headingLevel)
    logDebug(pluginJson, `arg0 -> searchTermArg ${typeof searchTermArg}`)
    logDebug(pluginJson, `arg0 -> searchTermArg '${searchTermArg ?? '(not supplied)'}'`)

    // work out if we're being called non-interactively (i.e. via x-callback) by seeing whether originatorCommand is not empty
    const calledNonInteractively = (searchTermArg !== undefined)
    logDebug('replace', `- called non-interactively? ${String(calledNonInteractively)}`)

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
      const newTerms = await getInput(`Enter the search term.`, 'OK', commandNameToDisplay, config.defaultSearchTerms)
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

    //----------------------------------------------------------------------------
    // Search using search() API, extended to make case-sensitive
    CommandBar.showLoading(true, `${commandNameToDisplay} ...`)
    await CommandBar.onAsyncThread()
    // $FlowFixMe[incompatible-exact] Note: deliberately no await: this is resolved later
    const searchResultsProm: resultOutputTypeV3 = runSearchesV2([searchTerm], noteTypesToInclude, [], config.foldersToExclude, config, paraTypesToInclude, config.caseSensitiveSearching)
    // TODO: regex search in this function
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
    // Validate the replace term if this is a regex 
    if (searchTerm.type === 'regex') {
      // If this has capturing groups sections, check there are enough in the regex definition
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

      const res = await showMessageYesNo(`There are ${searchResults.resultCount} matches in ${searchResults.resultNoteCount} notes (see log for the details).\nAre you sure you want to continue and replace with '${replaceExpression}'?\n\nNote: This is no way to easily undo this.`)
      if (res === 'No') {
        logDebug('replace', `User has cancelled operation.`)
        return
      }
    }

    //---------------------------------------------------------
    // Do the replace
    const startTime = new Date() // for timing
    logDebug('replace', `Will now replace with '${replaceExpression}'`)
    // Use updateParagraph() multiple times. (Can't really use updateParagraphs() as it only works on a single note at a time.)
    for (let c = 0; c < searchResults.resultNoteAndLineArr.length; c++) {
      const nal = searchResults.resultNoteAndLineArr[c]
      const thisFilename = nal.noteFilename
      const thisNote = DataStore.noteByFilename(thisFilename, 'Calendar')
      if (!thisNote) {
        logWarn('replace', `Couldn't find note for ${thisFilename} to update`)
        continue
      }
      const thisPara = findParaFromStringAndFilename(thisFilename, nal.line)
      if (!thisPara) {
        logWarn('replace', `Couldn't find paragraph {${nal.line}} in ${thisFilename} to update`)
        continue
      }
      const replacedContent = nal.line.replaceAll(searchStr, replaceExpression)
      thisPara.content = replacedContent
      logDebug('replace', `#${String(c)} in ${thisFilename} -> ${replacedContent}`)
      thisNote.updateParagraph(thisPara)
    }
    logTimer('replace', startTime, `replace() finished.`)

    // // Confirmatory check: run search again and see if it is zero
    // const checkResults: resultOutputTypeV3 = await runSearchesV2([searchTerm], noteTypesToInclude, [], config.foldersToExclude, config, paraTypesToInclude, config.caseSensitiveSearching)
    // if (checkResults.resultCount > 0) {
    //   logWarn('replace', `I've double-checked the replace, and found that there are still ${checkResults.resultCount} unchanged copies of '${searchStr}'`)
    // } else {
    //   logDebug('replace', `I've double-checked the replace, and it has changed all the copies.`)
    // }
  }
  catch (err) {
    logError(pluginJson, err.message)
  }
}
