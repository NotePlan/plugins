// @flow
//-----------------------------------------------------------------------------
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 5.8.2022 for v0.5.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  createFormattedResultLines,
  getSearchSettings,
  type resultOutputTypeV3,
  runSearchesV2,
  // type typedSearchTerm,
  validateAndTypeSearchTerms,
  writeSearchResultsToNote,
} from './searchHelpers'
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
    searchTermsArg ?? undefined,
    'both',
    'saveSearch',
    paraTypeFilterArg ?? undefined)
}

/**
 * Call the main function, but requesting only Calendar notes be searched.
 */
export async function searchOverCalendar(searchTermsArg?: string, paraTypeFilterArg?: string): Promise<void> {
  await saveSearch(
    searchTermsArg ?? undefined,
    'calendar',
    'searchOverCalendar',
    paraTypeFilterArg ?? undefined)
}

/**
 * Call the main function, but requesting only Project notes be searched.
 */
export async function searchOverNotes(searchTermsArg?: string, paraTypeFilterArg?: string): Promise<void> {
  await saveSearch(
    searchTermsArg ?? undefined,
    'notes',
    'searchOverNotes',
    paraTypeFilterArg ?? undefined)
}

/**
 * Call the main function, searching over all notes, but using a fixed note for results
 */
export async function quickSearch(searchTermsArg?: string, paraTypeFilterArg?: string, noteTypesToIncludeArg?: string): Promise<void> {
  await saveSearch(
    searchTermsArg ?? undefined,
    noteTypesToIncludeArg ?? 'both',
    'quickSearch',
    paraTypeFilterArg ?? undefined)
}

/**
 * Run a search over all notes, saving the results in one of several locations.
 * Works interactively (if no arguments given) or in the background (using supplied arguments).
 * @author @jgclark
 * 
 * @param {string} noteTypesToInclude either 'project','calendar' or 'both' -- as string not array
 * @param {string?} searchTermsArg optional comma-separated list of search terms to search
 * @param {string?} originatorCommand optional output desination indicator: 'quick', 'current', 'newnote', 'log'
 * @param {string?} paraTypeFilterArg optional list of paragraph types to filter by
*/
export async function saveSearch(
  searchTermsArg?: string,
  noteTypesToIncludeArg?: string = 'both',
  originatorCommand?: string = 'quickSearch',
  paraTypeFilterArg?: string = ''
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
    if (searchTermsArg !== undefined) {
      // either from argument supplied
      termsToMatchStr = searchTermsArg
      logDebug(pluginJson, `arg1 -> search terms [${termsToMatchStr}]`)
      // we are running indirectly (probably from x-callback call)
      calledIndirectly = true
    }
    else {
      // or by asking user
      // defaultTermsToMatchArr = Array.from(config.defaultSearchTerms)
      const newTerms = await getInput(`Enter search term (or terms separated by OR or commas). (Searches are not case sensitive.)`, 'OK', `Search`, config.defaultSearchTerms)
      if (typeof newTerms === 'boolean') {
        // i.e. user has cancelled
        logInfo(pluginJson, `User has cancelled operation.`)
        return
      } else {
        logDebug(pluginJson, `user -> search terms [${termsToMatchStr}]`)
        termsToMatchStr = newTerms
      }
    }
    logDebug(pluginJson, `- called indirectly? ${String(calledIndirectly)}`)

    // Validate the search terms: an empty return means failure. There is error logging in the function.
    const validatedSearchTerms = await validateAndTypeSearchTerms(termsToMatchStr)
    if (validatedSearchTerms == null || validatedSearchTerms.length === 0) {
      await showMessage(`These search terms aren't valid. Please see Plugin Console for details.`)
      return
    }

    logDebug(pluginJson, `arg2 -> originatorCommand = '${originatorCommand}'`)

    // Get the paraTypes to include
    // $FlowFixMe[incompatible-type]
    const paraTypesToInclude: Array<string> = (paraTypeFilterArg !== '') ? paraTypeFilterArg.split(',') : [] // TODO: ideally Array<ParagraphType> instead
    logDebug(pluginJson, `arg3 -> para types '${paraTypesToInclude.toString()}'`)

    //---------------------------------------------------------
    // Search using search() API available from v3.6.0
    // const startTime = new Date
    // CommandBar.showLoading(true, `Running search for ${String(termsToMatchArr)} ...`)
    // await CommandBar.onAsyncThread()

    // $FlowFixMe[incompatible-exact]
    const resultsProm: resultOutputTypeV3 = runSearchesV2(validatedSearchTerms, noteTypesToInclude, [], config.foldersToExclude, config, paraTypesToInclude) // Note: no await

    // await CommandBar.onMainThread()
    // CommandBar.showLoading(false)
    // const elapsedTimeAPI = timer(startTime)
    // logDebug(pluginJson, `Search time (API): ${termsToMatchArr.length} searches in ${elapsedTimeAPI} -> ${resultCount} results`)

    //---------------------------------------------------------
    // Work out where to save this summary
    let destination = ''
    // TODO: Review whether this is appropriate, if autoSave is always true
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

    // $FlowFixMe
    resultsProm.then((resultSet) => {
      logDebug(pluginJson, `resultsProm resolved`)
      // clo(results, 'resultsProm resolved ->')

      //---------------------------------------------------------
      // Do output
      const headingString = `${termsToMatchStr} ${config.searchHeading}`

      // logDebug(pluginJson, `before destination switch ${destination}`)
      switch (destination) {
        // TODO: Looks to be rationalisable to just 'newnote', but with varying requestedTitle, if autoSave is always true
        case 'current': {
          // We won't write an overarching heading.
          // Replace the search term's block (if already present) or append.
          const currentNote = Editor.note
          if (currentNote == null) {
            logError(pluginJson, `No note is open`)
          } else {
            logDebug(pluginJson, `Will write update/append to current note (${currentNote.filename ?? ''})`)
            const thisResultHeading = `${resultSet.searchTerm} ${config.searchHeading} (${resultSet.resultCount} results)`
            // replaceSection(currentNote, resultSet.searchTerm, thisResultHeading, config.headingLevel, resultSet.resultLines.join('\n'))
            const resultOutputLines: Array<string> = createFormattedResultLines(resultSet, config)
            replaceSection(currentNote, resultSet.searchTerm, thisResultHeading, config.headingLevel, resultOutputLines.join('\n'))
          }
          break
        }

        case 'newnote': {
          // We will write an overarching heading, as we need an identifying title for the note.
          // As this is likely to be a note just used for this set of search terms, just delete the whole note contents and re-write each search term's block.
          // Note: Does *not* need to include a subhead with search term + result count
          const requestedTitle = headingString
          const xCallbackLink = `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=${originatorCommand}&arg0=${encodeURIComponent(termsToMatchStr)}&arg1=${paraTypeFilterArg}`

          // normally I'd use await... in the next line, but can't as we're now in then...
          // const noteFilenameProm = writeSearchResultsToNote(resultSet, requestedTitle, config.folderToStore, config.resultStyle, config.headingLevel, config.groupResultsByNote, config.resultPrefix, config.highlightResults, config.resultQuoteLength, calledIndirectly, xCallbackLink)
          const noteFilenameProm = writeSearchResultsToNote(resultSet, requestedTitle, requestedTitle, config, xCallbackLink)
          noteFilenameProm.then(async (filename) => {
            logDebug(pluginJson, `- filename to open in split: ${filename}`)
            // Open the results note in a new split window, unless we already have this note open
            const currentEditorNote = displayTitle(Editor.note)
            // if (!calledIndirectly) {
            if (currentEditorNote !== requestedTitle) {
              await Editor.openNoteByFilename(filename, false, 0, 0, true)
            }
          })
          break
        }

        case 'quick': {
          // Write to the same 'Quick Search Results' note (or whatever the user's setting is)
          // Delete the note's contents and re-write each time.
          // *Does* need to include a subhead with search term + result count, as title is fixed.
          const requestedTitle = config.quickSearchResultsTitle
          const xCallbackLink = `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=quickSearch&arg0=${encodeURIComponent(termsToMatchStr)}&arg1=${paraTypeFilterArg}&arg2=${noteTypesToIncludeArg}`

          // normally I'd use await... in the next line, but can't as we're now in then...
          const noteFilenameProm = writeSearchResultsToNote(resultSet, requestedTitle, requestedTitle, config, xCallbackLink)

          noteFilenameProm.then(async (filename) => {
            logDebug(pluginJson, `- filename to open in split: ${filename}`)
            // Open the results note in a new split window, unless we already have this note open
            // if (!calledIndirectly) {
            if (Editor.note?.filename !== filename) {
              await Editor.openNoteByFilename(filename, false, 0, 0, true)
            }
          })
          break
        }

        case 'log': {
          logInfo(pluginJson, `${headingMarker} ${resultSet.searchTerm}(${resultSet.resultCount} results)`)
          logInfo(pluginJson, resultSet.resultLines.join('\n'))
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

    })

  }
  catch (err) {
    logError(pluginJson, err.message)
  }
}
