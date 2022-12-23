// @flow
//-----------------------------------------------------------------------------
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 23.12.2022 for v1.1.0-beta, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  createFormattedResultLines,
  getSearchSettings,
  makeAnySyncs,
  resultCounts,
  type resultOutputTypeV3,
  runSearchesV2,
  validateAndTypeSearchTerms,
  writeSearchResultsToNote,
} from './searchHelpers'
import { nowLocaleDateTime } from '@helpers/dateTime'
import { logDebug, logInfo, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { replaceSection } from '@helpers/note'
import {
  chooseOption,
  getInput,
  showMessage,
} from '@helpers/userInput'

//-------------------------------------------------------------------------------

// New thinking on destinations 
// If we remove all options to specify note title, then simplifies
// callback /non-Quick: arg0 fixed; 1=searchTerm; 2=dest 'refresh' ? ; arg
// user     /non-Quick: arg0 fixed; 1=searchTerm; 2=dest 'newNote' ?
// callback /Quick:     0=noteTypes varies??; 1=searchTerm; 2=dest 'quick'; 3=paraTypes
// user     /Quick:     ditto

/**
 * Call the main function, searching over all notes.
 */
export async function searchOverAll(searchTermsArg?: string, paraTypeFilterArg?: string): Promise<void> {
  await saveSearch(
    searchTermsArg,
    'both',
    'saveSearch',
    paraTypeFilterArg,
    'Searching all'
  )
}

/**
 * Call the main function, searching over all open tasks, and sync (set block IDs) the results.
 */
export async function searchOpenTasks(searchTermsArg?: string): Promise<void> {
  await saveSearch(
    searchTermsArg,
    'both',
    'searchOpenTasks',
    'open',
    'Searching open tasks')
}

/**
 * Call the main function, but requesting only Calendar notes be searched.
 */
export async function searchOverCalendar(searchTermsArg?: string, paraTypeFilterArg?: string): Promise<void> {
  await saveSearch(
    searchTermsArg,
    'calendar',
    'searchOverCalendar',
    paraTypeFilterArg,
    'Searching Calendar notes')
}

/**
 * Call the main function, but requesting only Project notes be searched.
 */
export async function searchOverNotes(searchTermsArg?: string, paraTypeFilterArg?: string): Promise<void> {
  await saveSearch(
    searchTermsArg,
    'notes',
    'searchOverNotes',
    paraTypeFilterArg,
    'Searching all notes')
}

/**
 * Call the main function, searching over all notes, but using a fixed note for results
 */
export async function quickSearch(searchTermsArg?: string, paraTypeFilterArg?: string, noteTypesToIncludeArg?: string): Promise<void> {
  await saveSearch(
    searchTermsArg,
    noteTypesToIncludeArg ?? 'both',
    'quickSearch',
    paraTypeFilterArg,
    'Searching')
}

/**------------------------------------------------------------------------
 * Run a search over all notes, saving the results in one of several locations.
 * Works interactively (if no arguments given) or in the background (using supplied arguments).
 * @author @jgclark
 * 
 * @param {string?} searchTermsArg optional comma-separated list of search terms to search
 * @param {string} noteTypesToInclude either 'project','calendar' or 'both' -- as string not array
 * @param {string?} originatorCommand optional output desination indicator: 'quick', 'current', 'newnote', 'log'
 * @param {string?} paraTypeFilterArg optional list of paragraph types to filter by
 * @param {string?} commandNameToDisplay optional
*/
export async function saveSearch(
  searchTermsArg?: string,
  noteTypesToIncludeArg?: string = 'both',
  originatorCommand?: string = 'quickSearch',
  paraTypeFilterArg?: string = '',
  commandNameToDisplay?: string = 'Searching',
): Promise<void> {
  try {
    // get relevant settings
    const config = await getSearchSettings()
    const headingMarker = '#'.repeat(config.headingLevel)
    let calledIndirectly = false

    // Get the noteTypes to include
    const noteTypesToInclude: Array<string> = (noteTypesToIncludeArg === 'both') ? ['notes', 'calendar'] : [noteTypesToIncludeArg]
    logDebug(pluginJson, `arg0 -> note types '${noteTypesToInclude.toString()}'`)

    // Get the search terms
    let termsToMatchStr = ''
    if (searchTermsArg) {
      // either from argument supplied
      termsToMatchStr = searchTermsArg
      logDebug(pluginJson, `arg1 -> search terms [${termsToMatchStr}]`)
      // we are running indirectly (probably from x-callback call)
      calledIndirectly = true
    }
    else {
      // or by asking user
      // defaultTermsToMatchArr = Array.from(config.defaultSearchTerms)
      const newTerms = await getInput(`Enter search term(s) separated by spaces or commas. (You can use +term, -term and !term as well.)`, 'OK', commandNameToDisplay, config.defaultSearchTerms)
      if (typeof newTerms === 'boolean') {
        // i.e. user has cancelled
        logInfo(pluginJson, `User has cancelled operation.`)
        return
      } else {
        termsToMatchStr = newTerms
        logDebug(pluginJson, `user -> search terms [${termsToMatchStr}]`)
      }
    }
    logDebug(pluginJson, `- called indirectly? ${String(calledIndirectly)}`)

    // Validate the search terms: an empty return means failure. There is error logging in the function.
    const validatedSearchTerms = await validateAndTypeSearchTerms(termsToMatchStr, true)
    if (validatedSearchTerms == null || validatedSearchTerms.length === 0) {
      await showMessage(`These search terms aren't valid. Please see Plugin Console for details.`)
      return
    }
    logDebug(pluginJson, `arg2 -> originatorCommand = '${originatorCommand}'`)

    // Get the paraTypes to include
    // $FlowFixMe[incompatible-type]
    const paraTypesToInclude: Array<ParagraphType> = (paraTypeFilterArg && paraTypeFilterArg !== '') ? paraTypeFilterArg.split(',') : []
    // logDebug(pluginJson, `arg3 -> para types '${typeof paraTypeFilterArg}'`)
    // logDebug(pluginJson, `arg3 -> para types '${paraTypeFilterArg ?? '(null)'}'`)
    logDebug(pluginJson, `arg3 -> para types '${paraTypesToInclude.toString()}'`)

    //---------------------------------------------------------
    // Search using search() API available from v3.6.0
    CommandBar.showLoading(true, `${commandNameToDisplay} ...`)
    await CommandBar.onAsyncThread()

    // $FlowFixMe[incompatible-exact]
    const resultsProm: resultOutputTypeV3 = runSearchesV2(validatedSearchTerms, noteTypesToInclude, [], config.foldersToExclude, config, paraTypesToInclude) // Note: no await; resolved later

    await CommandBar.onMainThread()

    //---------------------------------------------------------
    // Work out where to save this summary
    let destination = ''
    if (originatorCommand === 'quickSearch') {
      destination = 'quick'
    }
    else if (calledIndirectly || config.autoSave) {
      // Being called from x-callback so will only write to 'newnote' destination
      // Or we have a setting asking to save automatically to 'newnote'
      destination = 'newnote'
    }
    else {
      // else ask user
      const labelString = `🖊 Create/update note in folder '${config.folderToStore}'`
      // destination = await chooseOption(
      destination = await chooseOption(
        `Where should I save the search results?`,
        [
          { label: labelString, value: 'newnote' },
          { label: '🖊 Append/update your current note', value: 'current' },
          { label: '📋 Write to plugin console log', value: 'log' },
          { label: '❌ Cancel', value: 'cancel' },
        ],
        'newnote',
      )
    }
    logDebug(pluginJson, `destination = ${destination}, started with originatorCommand = ${originatorCommand ?? 'undefined'}`)

    //---------------------------------------------------------
    // End of main work started above

    let resultSet = await resultsProm
    CommandBar.showLoading(false)

    //---------------------------------------------------------
    // Do output
    // logDebug(pluginJson, 'reached do output stage')
    const searchTermsRepStr = `"${resultSet.searchTermsRepArr.join(' ')}"`

    switch (destination) {
      case 'current': {
        // We won't write an overarching title, but will add a section heading.
        // Replace the search term's block (if already present) or append.
        // TODO: add x-callback, which first requires seeing what the current filename is when called by an x-callback
        const currentNote = Editor.note
        if (currentNote == null) {
          logError(pluginJson, `No note is open`)
        } else {
          const resultCountsStr = resultCounts(resultSet)
          // const xCallbackLink = `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=${originatorCommand}&arg0=${encodeURIComponent(termsToMatchStr)}&arg1=${paraTypeFilterArg ?? ''}`
          const thisResultHeading = `${searchTermsRepStr} ${config.searchHeading} ${resultCountsStr}`
          logDebug(pluginJson, `Will write update/append section '${thisResultHeading}' to current note (${currentNote.filename ?? ''})`)

          // resultOutputLines.unshift(`at ${nowLocaleDateTime} [🔄 Refresh results](${xCallbackLink})`)
          const resultOutputLines: Array<string> = createFormattedResultLines(resultSet, config)
          logDebug(pluginJson, resultOutputLines.length)
          resultOutputLines.unshift(`at ${nowLocaleDateTime}`)
          replaceSection(currentNote, searchTermsRepStr, thisResultHeading, config.headingLevel, resultOutputLines.join('\n'))
        }
        break
      }

      case 'newnote': {
        // We will write an overarching title, as we need an identifying title for the note.
        // Note: Does again need to include a subhead with search term + result count
        // const thisResultHeading = `${resultSet.searchTerm} ${config.searchHeading}`
        // const thisResultHeadingAndCount = `${thisResultHeading} (${resultSet.resultCount} results)`
        const requestedTitle = `${termsToMatchStr} ${config.searchHeading}`
        const xCallbackLink = `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=${originatorCommand}&arg0=${encodeURIComponent(termsToMatchStr)}&arg1=${paraTypeFilterArg ?? ''}`

        // Earlier approach:
        // As this is likely to be a note just used for this set of search terms, just delete the whole note contents and re-write each search term's block.

        // Newer approach:
        // Get/make note, and then replace the search term's block (if already present) or append.
        const noteFilename = await writeSearchResultsToNote(resultSet, requestedTitle, requestedTitle, config, xCallbackLink, true)

        logDebug(pluginJson, `- filename to write to, and show in split: ${noteFilename}`)
        if (Editor.note?.filename !== noteFilename && !calledIndirectly) {
          // Open the results note in a new split window, unless we can tell
          // we already have this note open. Only works for Editor, though.
          // TODO: persuade Eduard to do better than this.
          await Editor.openNoteByFilename(noteFilename, false, 0, 0, true)
        }
        break
      }

      case 'quick': {
        // Write to the same 'Quick Search Results' note (or whatever the user's setting is)
        // Delete the note's contents and re-write each time.
        // *Does* need to include a subhead with search term + result count, as title is fixed.
        const requestedTitle = config.quickSearchResultsTitle
        const xCallbackLink = `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=quickSearch&arg0=${encodeURIComponent(termsToMatchStr)}&arg1=${paraTypeFilterArg ?? ''}&arg2=${noteTypesToIncludeArg ?? ''}`

        const noteFilename = await writeSearchResultsToNote(resultSet, requestedTitle, requestedTitle, config, xCallbackLink, false)

        logDebug(pluginJson, `- filename to open in split: ${noteFilename}`)
        // Open the results note in a new split window, unless we already have this note open
        if (Editor.note?.filename !== noteFilename && !calledIndirectly) {
          // Open the results note in a new split window, unless we can tell
          // we already have this note open. Only works for Editor, though.
          // TODO: persuade Eduard to do better than this.
          await Editor.openNoteByFilename(noteFilename, false, 0, 0, true)
        }
        break
      }

      case 'log': {
        const resultOutputLines: Array<string> = createFormattedResultLines(resultSet, config)
        logInfo(pluginJson, `${headingMarker} ${searchTermsRepStr} ${resultCounts(resultSet)} results)`)
        logInfo(pluginJson, resultOutputLines.join('\n'))
        break
      }

      case 'cancel': {
        logInfo(pluginJson, `User cancelled this command`)
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
