// @flow
//-----------------------------------------------------------------------------
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 5.7.2022 for v0.1.2, @jgclark
//-----------------------------------------------------------------------------
/** 
 * FIXME(Eduard): 
 * - the search API appears to return hits on notes in 'Saved Search' even when that folder is on the exclusion list
 */

//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  getSearchSettings,
  // type resultObjectType,
  writeResultsNote,
  runSearches,
} from './searchHelpers'
import { log, logWarn, logError } from '@helpers/dev'
import { replaceSection } from '@helpers/note'
import {
  chooseOption,
  getInput,
  showMessage,
} from '@helpers/userInput'

//-------------------------------------------------------------------------------

export async function saveSearchOverNotes(searchTermsArg?: string): Promise<void> {
  // Call the main function, but requesting only Project notes be searched.
  await saveSearch(['notes'], searchTermsArg ?? undefined)
}

export async function saveSearchOverAll(searchTermsArg?: string): Promise<void> {
  // Call the main function, but requesting only Project notes be searched.
  await saveSearch(['notes', 'calendar'], searchTermsArg ?? undefined)
}


/**
 * Run a search over all notes, saving the results in one of several locations.
 * Works interactively (if no arguments given) or in the background (using supplied arguments).
 * @author @jgclark
 * 
 * @param {Array<string>} noteTypesToInclude array defined by DataStore.search() command: curretnly 'project','calendar' or both
 * @param {string?} searchTermsArg optional comma-separated list of search terms to search
 */
export async function saveSearch(
  noteTypesToInclude: Array<string>,
  searchTermsArg?: string,
): Promise<void> {
  try {
    // get relevant settings
    const config = await getSearchSettings()
    const headingMarker = '#'.repeat(config.headingLevel)
    let calledIndirectly = false

    // Get the search terms, treating ' OR ' and ',' as equivalent term separators
    let termsToMatchArr = []
    if (searchTermsArg !== undefined) {
      // either from argument supplied
      termsToMatchArr = searchTermsArg.replace(/ OR /, ',').split(',')
      log(pluginJson, `saveSearch: will use arg0 '${searchTermsArg}'`)
      // make note we're running indirectly (probably from x-callback call)
      calledIndirectly = true
    }
    else {
      // or by asking user
      termsToMatchArr = Array.from(config.defaultSearchTerms)
      const newTerms = await getInput(`Enter search term (or terms separated by OR or commas). (Searches are not case sensitive.)`, 'OK', `Search`, termsToMatchArr.join(', '))
      if (typeof newTerms === 'boolean') {
        // i.e. user has cancelled
        log(pluginJson, `User has cancelled operation.`)
        return
      } else {
        termsToMatchArr = Array.from(newTerms.replace(/ OR /, ',').split(','))
      }
    }

    // Weed out any too-short search terms
    const filteredTermsToMatchArr = termsToMatchArr.filter((t) => t.length > 2)
    const termsToMatchStr = String(filteredTermsToMatchArr)
    log(pluginJson, `Search terms: ${termsToMatchStr} over note types [${noteTypesToInclude.join(', ')}] (except in folders ${config.foldersToExclude.join(', ')})`)
    if (filteredTermsToMatchArr.length < termsToMatchArr.length) {
      logWarn(pluginJson, `Note: some search terms were removed because they were less than 3 characters long.`)
      await showMessage(`Some search terms were removed as they were less than 3 characters long.`)
    }
    // Stop if we don't have any search terms
    if (termsToMatchArr.length === 0 || termsToMatchStr === '') {
      logWarn(pluginJson, 'no search terms given; stopping.')
      await showMessage(`No search terms given; stopping.`)
      return
    }
    // Stop if we have a silly number of search terms
    if (termsToMatchArr.length > 7) {
      logWarn(pluginJson, `too many search terms given (${termsToMatchArr.length}); stopping as this might be an error.`)
      await showMessage(`Too many search terms given(${termsToMatchArr.length}); stopping as this might be an error.`)
      return
    }

    //---------------------------------------------------------
    // Search using search() API available from v3.6.0
    // let results: Array<resultObjectType> = []
    // let resultCount = 0

    // const startTime = new Date
    // CommandBar.showLoading(true, `Running search for ${String(termsToMatchArr)} ...`)
    // await CommandBar.onAsyncThread()

    // for (const untrimmedSearchTerm of termsToMatchArr) {
      // search over all notes, apart from specified folders
      // const searchTerm = untrimmedSearchTerm.trim()
    const resultsProm = runSearches(termsToMatchArr, noteTypesToInclude, null, config.foldersToExclude, config)
      // const resultObject: resultObjectType = await runSearch(searchTerm, ['calendar', 'notes'], [], config.foldersToExclude, config)
      
      // Save this search term and results as a new object in results array
      // results.push(resultObject)
      // results.push( { resultHeading: thisResultHeading, resultLines: outputArray })
      // resultCount += resultObject.resultCount
    // }
    // await CommandBar.onMainThread()
    // CommandBar.showLoading(false)

    // const elapsedTimeAPI = timer(startTime)
    // log(pluginJson, `Search time (API): ${termsToMatchArr.length} searches in ${elapsedTimeAPI} -> ${resultCount} results`)

    //---------------------------------------------------------
    // Work out where to save this summary to
    let destination = ''
    if (calledIndirectly) {
      // Being called from x-callback so will only write to 'newnote' destination
      log(pluginJson, `  running from x-callback so will write to a note in the specified folder.`)
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

    resultsProm.then((results) => {
      // log(pluginJson, `resultsProm resolved`)
      // clo(results, 'resultsProm resolved ->')

      //---------------------------------------------------------
      // Do output
      const headingString = `${termsToMatchStr} ${config.searchHeading}`

      // console.log(`before destination switch ${destination}`)
      switch (destination) {
        case 'current': {
          // We won't write an overarching heading.
          // For each search term result set, replace the search term's block (if already present) or append.
          const currentNote = Editor.note
          if (currentNote == null) {
            logError(pluginJson, `No note is open`)
          } else {
            log(pluginJson, `Will write update/append to current note (${currentNote.filename ?? ''})`)
            for (const r of results) {
              const thisResultHeading = `${r.searchTerm} ${config.searchHeading} (${r.resultCount} results)`
              replaceSection(currentNote, r.searchTerm, thisResultHeading, config.headingLevel, r.resultLines.join('\n'))
            }
          }
          break
        }

        case 'newnote': {
          // We will write an overarching heading, as we need an identifying title for the note.
          // As this is likely to be a note just used for this set of search terms, just delete the whole
          // note contents and re-write each search term's block.
          const requestedTitle = headingString
          const xCallbackLink = `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=saveSearchResults&arg0=${encodeURIComponent(termsToMatchStr)}`

          // normally I'd use await... in the next line, but can't as we're now in then...
          const noteFilenameProm = writeResultsNote(results, requestedTitle, config.folderToStore,
            config.headingLevel, calledIndirectly, xCallbackLink)
          noteFilenameProm.then((filename) => {
            console.log(filename)
            // Make it open in split note, unless called from the x-callback ...
            if (!calledIndirectly) {
              Editor.openNoteByFilename(filename, false, 0, 0, true)
            }
          })
          break
        }

        case 'log': {
          for (const r of results) {
            log(pluginJson, `${headingMarker} ${r.searchTerm}(${r.resultCount} results)`)
            log(pluginJson, r.resultLines.join('\n'))
          }
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
