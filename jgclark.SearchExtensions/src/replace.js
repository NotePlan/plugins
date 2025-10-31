/* eslint-disable max-len */
// @flow
//-----------------------------------------------------------------------------
// Commands to search and replace over NP notes.
// Jonathan Clark
// Last updated 2025-09-30 for v3.0.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import type { noteAndLine,resultOutputV3Type, TSearchOptions, typedSearchTerm } from './searchHelpers'
import { applySearchOperatorsToOptions, getSearchSettings, logBasicResultLines, } from './searchHelpers'
import { runNPExtendedSyntaxSearches } from './NPExtendedSyntaxHelpers'
import { runPluginExtendedSyntaxSearches, validateAndTypeSearchTerms, } from './pluginExtendedSyntaxHelpers'
import { clo, logDebug, logInfo, logError, logTimer, logWarn } from '@helpers/dev'
import { findParaFromStringAndFilename } from '@helpers/NPParagraph'
import { getNoteFromFilename } from '@helpers/NPnote'
import { getSearchOperators, removeSearchOperators, isNPAdvancedSyntaxAvailable } from '@helpers/search'
import {
  getInputTrimmed,
  showMessage,
  showMessageYesNo
} from '@helpers/userInput'

//-------------------------------------------------------------------------------
// Private helper functions

/**
 * Build a global RegExp for replace, honoring case sensitivity
 * @param {string} pattern
 * @param {boolean} caseSensitive
 * @returns {RegExp}
 */
function buildReplaceRegex(pattern: string, caseSensitive: boolean): RegExp {
  return caseSensitive
    ? new RegExp(pattern, 'g')
    : new RegExp(pattern, 'gi')
}

/**
 * Do the replace for a single result
 * @param {noteAndLine} nal
 * @param {RegExp} replaceRegex regular expression to use to identify the string to replace
 * @param {string} replaceExpression string to replace the identified string with
 * @returns {boolean} true if successful, false if not
 */
function doReplaceForAResult(nal: noteAndLine, replaceRegex: RegExp, replaceExpression: string): boolean {
  const thisFilename = nal.noteFilename
  const thisNote = getNoteFromFilename(thisFilename)
  if (!thisNote) {
    logWarn('replace', `Couldn't find note for '${thisFilename}' to update`)
    return false
  }
  const thisPara = findParaFromStringAndFilename(thisFilename, nal.line)
  if (!thisPara) {
    logWarn('replace', `Couldn't find paragraph {${nal.line}} in '${thisFilename}' to update`)
    return false
  }
  // Note: JavaScript .replaceAll() is always case-sensitive with simple strings. So we need to use it via a regex.
  const replacedContent = nal.line.replaceAll(replaceRegex, replaceExpression)
  thisPara.content = replacedContent
  logDebug('replace', `in ${thisFilename} -> ${replacedContent}`)
  thisNote.updateParagraph(thisPara)
  return true
}

/**------------------------------------------------------------------------
 * Run a search and replace over notes.
 * Works interactively (if no arguments given) or in the background (using supplied arguments).
 * @author @jgclark
 *
 * @param {string?} searchStringArg optional search term to use (which can be regex)
 * @param {string?} replacementTextArg 
 * @param {string?} noteTypesToInclude either 'project','calendar' or 'both' -- as string not array
 * @param {string?} paraTypeFilterArg optional list of paragraph types to filter by
 * @param {string?} commandNameToDisplay optional title for dialog boxes
*/
export async function replace(
  searchStringArg?: string,
  replacementTextArg?: string = '',
  noteTypesToIncludeArg?: string = 'both',
  paraTypeFilterArg?: string = '',
  commandNameToDisplay?: string = 'Search-and-replace',
): Promise<void> {
  try {
    const config = await getSearchSettings()
    const NPAdvancedSyntaxAvailable = isNPAdvancedSyntaxAvailable()

    // Get the noteTypes to include, from arg2
    const noteTypesToInclude: Array<string> = (noteTypesToIncludeArg === 'both' || noteTypesToIncludeArg === '') ? ['notes', 'calendar'] : [noteTypesToIncludeArg]
    logDebug('replace', `arg2 -> note types '${noteTypesToInclude.toString()}'`)

    // Get the paraTypes to include
    // $FlowFixMe[incompatible-type]
    const paraTypesToInclude: Array<ParagraphType> = (paraTypeFilterArg && paraTypeFilterArg !== '') ? paraTypeFilterArg.split(',') : []
    // logDebug('replace', `arg3 -> para types '${typeof paraTypeFilterArg}'`)
    // logDebug('replace', `arg3 -> para types '${paraTypeFilterArg ?? '(null)'}'`)
    logDebug('replace', `arg3 -> para types '${paraTypesToInclude.toString()}'`)

    // Get the search term, either from arg0 supplied, or by asking user
    logDebug(pluginJson, `arg0 -> searchStringArg ${typeof searchStringArg}`)
    logDebug(pluginJson, `arg0 -> searchStringArg '${searchStringArg ?? '(not supplied)'}'`)
    let searchStr = ''
    if (searchStringArg) {
      // from argument supplied
      searchStr = searchStringArg ?? ''
      logDebug('replace', `arg0 -> search string [${searchStr}]`)
    }
    else {
      // ask user
      const newTerms = await getInputTrimmed(`Enter the search term to replace`, 'OK', commandNameToDisplay, config.defaultSearchTerms)
      if (typeof newTerms === 'boolean') {
        // i.e. user has cancelled
        logInfo('replace', `User has cancelled operation.`)
        CommandBar.showLoading(false)
        return
      } else {
        searchStr = newTerms
        logDebug('replace', `user -> search string [${searchStr}]`)
      }
    }

    // Set up search options
    const searchOptions: TSearchOptions = {
      noteTypesToInclude: noteTypesToInclude,
      foldersToInclude: [],
      foldersToExclude: config.foldersToExclude,
      // $FlowFixMe[incompatible-type]
      paraTypesToInclude: paraTypesToInclude,
      caseSensitiveSearching: config.caseSensitiveSearching,
    }

    // Set up variables for older method, that need function-wide scope
    let searchTermsRepStr = ''
    let validatedSearchTerms: Array<typedSearchTerm> = []
    let olderMethodResultsProm: resultOutputV3Type

    // Set up variables for newer method, that need function-wide scope
    let searchStrWithoutOperators = ''
    let newerMethodResultsProm: resultOutputV3Type

    // Now do the relevant processing for different versions of NP
    if (config.useNativeSearch && NPAdvancedSyntaxAvailable) {
      logDebug('replace', `Will use newer NP extended syntax`)
      const searchOperators = (searchStr)
        ? getSearchOperators(searchStr) // Note: this will include any date: range operators
        : []
      searchStrWithoutOperators = removeSearchOperators(searchStr)
      
      if (searchOperators) {
        logDebug('replace', `- searchOperators: ${String(searchOperators)}`)
        applySearchOperatorsToOptions(searchOperators, searchOptions)
      }
    
      //---------------------------------------------------------
      // Search using search() API via JGC modified search helpers to suit NP 3.18.1 extended search syntax
      CommandBar.showLoading(true, `${commandNameToDisplay} for [${searchStr}] ...`)
      await CommandBar.onAsyncThread()

      // $FlowFixMe[incompatible-exact] Note: deliberately no await: this is resolved later
      newerMethodResultsProm = runNPExtendedSyntaxSearches(searchStr, config, searchOptions)

      await CommandBar.onMainThread()

    } else {
      // NP Advanced Syntax not available, or not wanted
      logDebug('saveSearch', `Will use older Plugin extended syntax`)
      
      // Validate the search string: an empty return means failure. There is error logging in the function.
      validatedSearchTerms = await validateAndTypeSearchTerms(searchStr, true)
      if (validatedSearchTerms == null || validatedSearchTerms.length === 0) {
        await showMessage(`These search terms aren't valid. Please see Plugin Console for details.`)
        return
      }

      searchTermsRepStr = `'${validatedSearchTerms.map(term => term.termRep).join(' ')}'`.trim() // Note: we normally enclose in [] but here need to use '' otherwise NP Editor renders the link wrongly
    
      // Form TSearchOptions object
      const searchOptions: TSearchOptions = {
        noteTypesToInclude: noteTypesToInclude,
        foldersToInclude: [],
        foldersToExclude: config.foldersToExclude,
        paraTypesToInclude: paraTypesToInclude,
        caseSensitiveSearching: config.caseSensitiveSearching,
      }

      //----------------------------------------------------------------------------
      // Search using search() API via JGC extended search helpers in this plugin
      CommandBar.showLoading(true, `${commandNameToDisplay} for [${searchTermsRepStr}] ...`)
      await CommandBar.onAsyncThread()

      // $FlowFixMe[incompatible-exact] Note: deliberately no await: this is resolved later
      olderMethodResultsProm = runPluginExtendedSyntaxSearches(validatedSearchTerms, config, searchOptions)

      await CommandBar.onMainThread()
    }

    //----------------------------------------------------------------------------
    // While that's thinking ...
    // Get the replace expression, either from arg1 supplied, or by asking user
    let replacementText = ''
    if (replacementTextArg) {
      // replacementText argument supplied
      replacementText = replacementTextArg ?? ''
      logDebug('replace', `arg1 -> replacement text [${replacementText}]`)
    }
    else {
      // ask user
      const newTerm = await getInputTrimmed(`Enter the replace expression.`, 'OK', commandNameToDisplay, '')
      if (typeof newTerm === 'boolean') {
        // i.e. user has cancelled
        logInfo('replace', `User has cancelled operation.`)
        return
      } else {
        replacementText = newTerm
        logDebug('replace', `user -> replacement text [${replacementText}]`)
      }
    }

    //---------------------------------------------------------
    // End of search Call started above: resolve the promises
    let searchResults: ?resultOutputV3Type // ? to indicate may be undefined

    logDebug('replace', `before promises resolve`)
    if (config.useNativeSearch && NPAdvancedSyntaxAvailable) {
      searchResults = await newerMethodResultsProm
    } else {
      searchResults = await olderMethodResultsProm
    }
    CommandBar.showLoading(false)

    if (!searchResults) {
      throw new Error(`Couldn't get results found for search [${searchStr}]. Please check the Plugin Console for details.`)
    }

    //---------------------------------------------------------
    // Tell user results of search and double check they want to proceed
    if (searchResults.resultCount === 0) {
      logDebug('replace', `No results found for search [${searchStr}]`)
      await showMessage(`No results found for search [${searchStr}] with your current settings.`)
      return
    } else {
      logBasicResultLines(searchResults, config)

      const res = await showMessageYesNo(`There are ${searchResults.resultCount} matches in ${searchResults.resultNoteCount} notes (see plugin log for the details).\nAre you sure you want to continue and replace with '${replacementText}'?\n\nNote: This is no way to easily undo this.`, ['Yes', 'Cancel'], 'Confirm Replace', false)
      if (res === 'No') {
        logDebug('replace', `User has cancelled operation.`)
        return
      }
    }

    //---------------------------------------------------------
    // Do the replace
    const startTime = new Date() // for timing
    logDebug('replace', `------------ Will now replace with '${replacementText}' -------------`)
    const replaceRegex = buildReplaceRegex(searchStrWithoutOperators, searchOptions.caseSensitiveSearching ?? false)
    logDebug('replace', `replaceRegex = ${replaceRegex.toString()} with caseSensitiveSearching = ${String(searchOptions.caseSensitiveSearching ?? false)}`)

    // Iterate through each result and do the replace
    // Note: We can't use updateParagraphs() as it only works on a single note at a time. So we need to use updateParagraph() potentially multiple times in the same note.
    for (let c = 0; c < searchResults.resultNoteAndLineArr.length; c++) {
      const nal = searchResults.resultNoteAndLineArr[c]
      doReplaceForAResult(nal, replaceRegex, replacementText)
    }
    logTimer('replace', startTime, `replace() finished.`)
    logDebug('replace', `----------------------------------------------------------`)

    // Confirmatory check: run search again and see if it is zero
    // TODO: only run if DEBUG logging is enabled
    const checkResults: resultOutputV3Type = (NPAdvancedSyntaxAvailable)
      ? await runNPExtendedSyntaxSearches(searchStr, config, searchOptions) 
      : await runPluginExtendedSyntaxSearches(validatedSearchTerms, config, searchOptions)
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
