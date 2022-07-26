// @flow
//-----------------------------------------------------------------------------
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 23.7.2022 for v0.5.0, @jgclark
//-----------------------------------------------------------------------------
/** 
 * TODO: test again to see if notInFolder param is working.
 */

//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  getSearchSettings,
  type resultOutputTypeV2,
  runSearchesV2,
  type typedSearchTerm,
  validateAndTypeSearchTerms,
  writeSearchResultsToNote,
} from './searchHelpers'
import { log, logDebug, logWarn, logError } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { replaceSection } from '@helpers/note'
import {
  chooseOption,
  getInput,
  showMessage,
} from '@helpers/userInput'

//-------------------------------------------------------------------------------

/** 
 * Call the main function, but requesting only Calendar notes be searched.
 * * TODO: andd start date, end date args
 */
export async function saveSearchOverCalendar(searchTermsArg?: string): Promise<void> {
  await saveSearch(
    'calendar',
    searchTermsArg ?? undefined)
}

/** 
 * Call the main function, but requesting only Project notes be searched.
 */
export async function saveSearchOverNotes(searchTermsArg?: string): Promise<void> {
  await saveSearch(
    'notes',
    searchTermsArg ?? undefined)
}

/**
 * Call the main function, searching over all notes.
 */
export async function saveSearchOverAll(searchTermsArg?: string): Promise<void> {
  await saveSearch(
    'both',
    searchTermsArg ?? undefined)
}

/** 
 * Call the main function, searching over all notes.
 * This is also the route in for refresh-an-existing-search-note
 * TODO: confirm this is still true
 */
export async function quickSearch(notesTypesToInclude?: string, searchTermsArg?: string, paraTypeFilterArg?: string): Promise<void> {
  await saveSearch(
    notesTypesToInclude ?? 'both',
    searchTermsArg ?? undefined,
    'quick',
    paraTypeFilterArg ?? undefined)
}

/**
 * Run a search over all notes, saving the results in one of several locations.
 * Works interactively (if no arguments given) or in the background (using supplied arguments).
 * @author @jgclark
 * 
 * @param {string} noteTypesToInclude either 'project','calendar' or 'both' -- as string not array
 * @param {string?} searchTermsArg optional comma-separated list of search terms to search
 * @param {string?} destinationArg optional output desination indicator: 'quick', 'current', 'newnote', 'log'
 */
export async function saveSearch(
  noteTypesToIncludeArg: string,
  searchTermsArg?: string,
  destinationArg?: string,
  paraTypeFilterArg?: string // TODO: wire this in
): Promise<void> {
  try {
    // get relevant settings
    const config = await getSearchSettings()
    const headingMarker = '#'.repeat(config.headingLevel)
    let calledIndirectly = false

    // Get the noteTypes to include
    const noteTypesToInclude = (noteTypesToIncludeArg === 'both') ? ['notes', 'calendar'] : [noteTypesToIncludeArg]
    logDebug(pluginJson, `saveSearch: arg0 -> '${noteTypesToInclude.toString()}'`)

    // Get the search terms
    let termsToMatchStr = ''
    if (searchTermsArg !== undefined) {
      // either from argument supplied
      logDebug(pluginJson, `saveSearch: will use searchTermsArg: '${searchTermsArg}'`)
      termsToMatchStr = searchTermsArg
      // we are running indirectly (probably from x-callback call)
      calledIndirectly = true
    }
    else {
      // or by asking user
      // defaultTermsToMatchArr = Array.from(config.defaultSearchTerms)
      const newTerms = await getInput(`Enter search term (or terms separated by OR or commas). (Searches are not case sensitive.)`, 'OK', `Search`, config.defaultSearchTerms)
      if (typeof newTerms === 'boolean') {
        // i.e. user has cancelled
        log(pluginJson, `User has cancelled operation.`)
        return
      } else {
        // termsToMatchArr = Array.from(newTerms.split(','))
        // termsToMatchArr = Array.from(newTerms.split(/[, ]/))
        termsToMatchStr = newTerms
      }
    }

    // Validate the search terms: an empty return means failure. There is error logging in the function.
    const validatedSearchTerms = await validateAndTypeSearchTerms(termsToMatchStr)
    if (validatedSearchTerms == null || validatedSearchTerms.length === 0) {
      await showMessage(`These search terms aren't valid. Please see Plugin Console for details.`)
      return
    }

    logDebug(pluginJson, `- called indirectly? ${String(calledIndirectly)}`)

    //---------------------------------------------------------
    // Search using search() API available from v3.6.0
    // const startTime = new Date
    // CommandBar.showLoading(true, `Running search for ${String(termsToMatchArr)} ...`)
    // await CommandBar.onAsyncThread()

    const resultsProm: resultOutputTypeV2 = runSearchesV2(validatedSearchTerms, noteTypesToInclude, [], config.foldersToExclude, config) // note no await

    // await CommandBar.onMainThread()
    // CommandBar.showLoading(false)
    // const elapsedTimeAPI = timer(startTime)
    // log(pluginJson, `Search time (API): ${termsToMatchArr.length} searches in ${elapsedTimeAPI} -> ${resultCount} results`)

    //---------------------------------------------------------
    // Work out where to save this summary
    let destination = ''
    if (destinationArg !== undefined) {
      logDebug(pluginJson, `destinationArg = ${destinationArg}`)
      destination = destinationArg
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

    resultsProm.then((resultSet) => {
      // log(pluginJson, `resultsProm resolved`)
      // clo(results, 'resultsProm resolved ->')

      //---------------------------------------------------------
      // Do output
      const headingString = `${termsToMatchStr} ${config.searchHeading}`

      // logDebug(pluginJson, `before destination switch ${destination}`)
      switch (destination) {
        case 'current': {
          // We won't write an overarching heading.
          // For each search term result set, replace the search term's block (if already present) or append.
          const currentNote = Editor.note
          if (currentNote == null) {
            logError(pluginJson, `No note is open`)
          } else {
            logDebug(pluginJson, `Will write update/append to current note (${currentNote.filename ?? ''})`)
            // for (const r of results) {
            // const thisResultHeading = `${r.searchTerm} ${config.searchHeading} (${r.resultCount} results)`
            // replaceSection(currentNote, r.searchTerm, thisResultHeading, config.headingLevel, r.resultLines.join('\n'))
            // }
            const thisResultHeading = `${resultSet.searchTerm} ${config.searchHeading} (${resultSet.resultCount} results)`
            replaceSection(currentNote, resultSet.searchTerm, thisResultHeading, config.headingLevel, resultSet.resultLines.join('\n'))
          }
          break
        }

        case 'newnote': {
          // We will write an overarching heading, as we need an identifying title for the note.
          // As this is likely to be a note just used for this set of search terms, just delete the whole note contents and re-write each search term's block.
          // TODO: Does *not* need to include a subhead with search term + result count
          const requestedTitle = headingString
          // FIXME: don't hard-wire 'both' in what follows, but use noteTypesToIncludeArg
          const xCallbackLink = `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=quickSearch&arg0=both&arg1=${encodeURIComponent(termsToMatchStr)}`

          // normally I'd use await... in the next line, but can't as we're now in then...
          // const noteFilenameProm = writeSearchResultsToNote(resultSet, requestedTitle, config.folderToStore, config.resultStyle, config.headingLevel, config.groupResultsByNote, config.resultPrefix, config.highlightResults, config.resultQuoteLength, calledIndirectly, xCallbackLink)
          const noteFilenameProm = writeSearchResultsToNote(resultSet, requestedTitle, config, xCallbackLink)
          noteFilenameProm.then(async (filename) => {
            logDebug(pluginJson, `${filename}`)
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
          // FIXME: don't hard-wire 'both' in what follows, but use noteTypesToIncludeArg
          const xCallbackLink = `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=quickSearch&arg0=both&arg1=${encodeURIComponent(termsToMatchStr)}`

          // normally I'd use await... in the next line, but can't as we're now in then...
          // const noteFilenameProm = writeSearchResultsToNote(resultSet, requestedTitle, config.folderToStore, config.resultStyle, config.headingLevel, config.groupResultsByNote, config.resultPrefix, config.highlightResults, config.resultQuoteLength, calledIndirectly, xCallbackLink)
          const noteFilenameProm = writeSearchResultsToNote(resultSet, requestedTitle, config, xCallbackLink)

          noteFilenameProm.then(async (filename) => {
            logDebug(pluginJson, `${filename}`)
            // Open the results note in a new split window, unless we already have this note open
            // if (!calledIndirectly) {
            if (Editor.note?.filename !== filename) {
              await Editor.openNoteByFilename(filename, false, 0, 0, true)
            }
          })
          break
        }

        case 'log': {
          log(pluginJson, `${headingMarker} ${resultSet.searchTerm}(${resultSet.resultCount} results)`)
          log(pluginJson, resultSet.resultLines.join('\n'))
          break
        }

        case 'cancel': {
          log(pluginJson, `User cancelled command`)
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
