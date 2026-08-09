/* eslint-disable max-len */
// @flow
//-----------------------------------------------------------------------------
// Commands to search and replace over NP notes.
// Jonathan Clark
// Last updated 2026-08-09 for v3.0.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import type { noteAndLine, resultOutputV3Type, TSearchOptions } from './searchHelpers'
import { applySearchOperatorsToOptions, getSearchSettings, logBasicResultLines, } from './searchHelpers'
import { runNPExtendedSyntaxSearches } from './NPExtendedSyntaxHelpers'
import { logDebug, logInfo, logError, logTimer, logWarn } from '@helpers/dev'
import { findParaFromStringAndFilename } from '@helpers/NPParagraph'
import { getNoteFromFilename } from '@helpers/NPnote'
import { getSearchOperators, removeSearchOperators } from '@helpers/search'
import {
  getInputTrimmed,
  showMessage,
  showMessageYesNo
} from '@helpers/userInput'

//-------------------------------------------------------------------------------
// Private helper functions

/**
 * Build a regular expression for the search-and-replace.
 * First need to escape any special characters in the search term (unless already part of a valid regex).
 * Also match all instances of the search term in the line (g flag), and may include a case insensitive flag.
 * @author @jgclark
 * @param {string} searchTerm
 * @param {boolean} caseSensitive
 * @returns {RegExp}
 */
function buildReplaceRegex(searchTerm: string, caseSensitive: boolean = false): RegExp {
  // First need to escape any special characters in the search term
  // Leave * and ? alone now
  // $FlowFixMe[incompatible-type]
  const escapedSearchTerm: string = searchTerm.replace(/[\-\]\[{}()+.,\\^$|#]/g, '\\$&')
  // Now turn into a regex which also:
  // match all instances of the search term in the line (g flag)
  // Include 'i' flag if not case-sensitive
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[invalid-constructor]
  // $FlowFixMe[invalid-compare]
  const re = caseSensitive
    ? new RegExp(escapedSearchTerm, "g")
    : new RegExp(escapedSearchTerm, "gi")
  return re
}

/**
 * Do a search-and-replace for a single result item.
 * @author @jgclark
 * @param {noteAndLine} nal noteAndLine object for this result item
 * @param {RegExp} replaceRegex regular expression for the search-and-replace
 * @param {string} replacementText replacement text
 */
function doReplaceForAResult(nal: noteAndLine, replaceRegex: RegExp, replacementText: string): void {
  try {
    const thisNote = getNoteFromFilename(nal.noteFilename)
    if (!thisNote) {
      logWarn('replace', `Couldn't find note for filename ${nal.noteFilename}`)
      return
    }
    // Now get this paragraph; first by lineIndex, with a backup of searching for the original content, in case the note has changed.
    // $FlowFixMe[incompatible-type]
    let thisPara = thisNote.paragraphs[nal.index] ?? null
    if (!thisPara || thisPara.content !== nal.line) {
      // go look for the paragraph that matches the original search result line
      thisPara = findParaFromStringAndFilename(nal.noteFilename, nal.line)
      if (!thisPara) {
        logWarn('replace', `Couldn't find paragraph matching original content '${nal.line}' in note '${nal.noteFilename}'. Will try to continue, but it may not be correct.`)
        return
      }
    }
    // now we have a matching paragraph, so replace
    // Note: we can't use the replace() method, as it just takes a string: so let's use a RegExp instead
    logDebug('replace', `will replace RE ${replaceRegex.toString()} with '${replacementText}' in '${thisPara.content}'`)
    thisPara.content = thisPara.content.replace(replaceRegex, replacementText)
    thisNote.updateParagraph(thisPara)
    logDebug('replace', `-> now '${thisPara.content}'`)
  }
  catch (err) {
    logError(pluginJson, err.message)
  }
}

//-------------------------------------------------------------------------------
/**
 * Entry point for Search-and-Replace.
 * Uses NotePlan advanced (native) search only (requires NP 3.18.1+).
 * @author @jgclark
 * @param {string?} searchStringArg optional search string
 * @param {string?} replacementTextArg optional text to replace
 * @param {string?} noteTypesToIncludeArg optional list of note types to include (default is 'both')
 * @param {string?} paraTypeFilterArg optional list of paragraph types to include (default is empty)
 * @param {string?} commandNameToDisplay optional name of the command to display (default is 'Search-and-replace')
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

    // Get the noteTypes to include, from arg2
    const noteTypesToInclude: Array<string> = (noteTypesToIncludeArg === 'both' || noteTypesToIncludeArg === '') ? ['notes', 'calendar'] : [noteTypesToIncludeArg]
    logDebug('replace', `arg2 -> note types '${noteTypesToInclude.toString()}'`)

    // Get the paraTypes to include
    // $FlowFixMe[incompatible-type]
    const paraTypesToInclude: Array<ParagraphType> = (paraTypeFilterArg && paraTypeFilterArg !== '') ? paraTypeFilterArg.split(',') : []
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

    logDebug('replace', `Using NP advanced search syntax`)
    const searchOperators = (searchStr)
      ? getSearchOperators(searchStr) // Note: this will include any date: range operators
      : []
    const searchStrWithoutOperators = removeSearchOperators(searchStr)

    if (searchOperators) {
      logDebug('replace', `- searchOperators: ${String(searchOperators)}`)
      applySearchOperatorsToOptions(searchOperators, searchOptions)
    }

    //---------------------------------------------------------
    // Search using search() API via NP advanced search helpers
    CommandBar.showLoading(true, `${commandNameToDisplay} for [${searchStr}] ...`)
    await CommandBar.onAsyncThread()

    // $FlowFixMe[incompatible-exact] Note: deliberately no await: this is resolved later
    const resultsProm: Promise<resultOutputV3Type> = runNPExtendedSyntaxSearches(searchStr, config, searchOptions)

    await CommandBar.onMainThread()

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
    // End of search Call started above: resolve the promise
    logDebug('replace', `before promise resolves`)
    const searchResults: ?resultOutputV3Type = await resultsProm
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
      if (res !== 'Yes') {
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

    // Confirmatory check, if DEBUG logging is enabled: run search again and see if it is zero
    if (config._logLevel === 'DEBUG') {
      const checkResults: resultOutputV3Type = await runNPExtendedSyntaxSearches(searchStr, config, searchOptions)
      if (checkResults.resultCount > 0) {
        logWarn('replace', `I've double-checked the replace, and found that there are ${checkResults.resultCount} unchanged copies of '${searchStr}'`)
      } else {
        logDebug('replace', `I've double-checked the replace, and it has changed all the copies.`)
      }
    }
  }
  catch (err) {
    logError(pluginJson, err.message)
  }
}
