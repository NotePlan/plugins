// @flow
//-----------------------------------------------------------------------------
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 1.7.2022 for v0.1.0, @jgclark
//-----------------------------------------------------------------------------
/** FIXME(Eduard): 
 * the search API appears to return hits on notes in 'Saved Search'
 * even when that folder is on the exclusion list.
 */
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  getSearchSettings,
  type resultObjectType,
} from './searchHelpers'
import {
  formatNoteDate,
  // hyphenatedDateString,
  nowLocaleDateTime,
} from '@helpers/dateTime'
import { log, logWarn, logError, timer } from '@helpers/dev'
import { displayTitle, titleAsLink } from '@helpers/general'
import { replaceSection } from '@helpers/note'
// import { gatherMatchingLines } from '@helpers/NPParagraph'
import {
  isTermInMarkdownPath,
  isTermInURL,
} from '@helpers/paragraph'
import { trimAndHighlightTermInLine } from '@helpers/search'
import {
  chooseOption,
  getInput,
  showMessage,
} from '@helpers/userInput'

//-------------------------------------------------------------------------------

/**
 * Run a search over all notes, saving the results in one of several locations.
 * Works interactively (if no arguments given) or in the background (using supplied arguments).
 * @author @jgclark
 * 
 * @param {string?} searchTermsArg optional comma-separated list of search terms to search
 */
export async function saveSearch(searchTermsArg?: string): Promise<void> {
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
      const newTerms = await getInput(`Enter search term (or comma-separated set of terms)`, 'OK', `Search`, termsToMatchArr.join(', '))
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
    log(pluginJson, `Search terms: ${termsToMatchStr} over all notes (except in folders ${config.foldersToExclude.join(', ')})`)
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
    // newer search method using search() API available from v3.6.0
    let resultCount = 0
    const results: Array<resultObjectType> = []

    // const outputArray = []
    const startTime = new Date
    for (const untrimmedSearchTerm of termsToMatchArr) {
      const searchTerm = untrimmedSearchTerm.trim()
      const outputArray = []
      // get list of matching paragraphs for this string
      const resultParas = await DataStore.search(searchTerm, ['calendar', 'notes'], undefined, config.foldersToExclude) // search over all notes
      const lines = resultParas
      // output a heading first
      const thisResultHeading = `${searchTerm} ${config.searchHeading}`
      if (lines.length > 0) {
        log(pluginJson, `- Found ${lines.length} results for '${searchTerm}'`)

        // form the output
        let previousNoteTitle = ''
        for (let i = 0; i < lines.length; i++) {
          let matchLine = lines[i].content
          const thisNoteTitleDisplay = (lines[i].note.date != null)
            ? formatNoteDate(lines[i].note.date, config.dateStyle)
            : titleAsLink(lines[i].note)
          // If the test is within a URL or the path of a [!][link](path) skip this result
          if (isTermInURL(searchTerm, matchLine)) {
            log(pluginJson, `  - Info: Match '${searchTerm}' ignored in '${matchLine} because it's in a URL`)
            continue
          }
          if (isTermInMarkdownPath(searchTerm, matchLine)) {
            log(pluginJson, `  - Info: Match '${searchTerm}' ignored in '${matchLine} because it's in a [...](path)`)
            continue
          }
          // Format the line and context for output (trimming, highlighting)
          matchLine = trimAndHighlightTermInLine(matchLine, searchTerm,
            config.highlightResults, config.resultQuoteLength)
          if (config.groupResultsByNote) {
            // Write out note title (if not seen before) then the matchLine
            if (previousNoteTitle !== thisNoteTitleDisplay) {
              outputArray.push(`${headingMarker}# ${thisNoteTitleDisplay}:`) // i.e. lower level heading + note title
            }
            outputArray.push(`${config.resultPrefix}${matchLine}`)
          } else {
            // Write out matchLine followed by note title
            const suffix = `(from ${thisNoteTitleDisplay})`
            outputArray.push(`${config.resultPrefix}${matchLine} ${suffix}`)
          }
          resultCount += 1
          previousNoteTitle = thisNoteTitleDisplay
        }
      } else if (config.showEmptyResults) {
        // If there's nothing to report, make that clear
        outputArray.push('(no matches)')
      }
      // Save this search term and results as a new object in results array
      results.push({ resultHeading: thisResultHeading, resultLines: outputArray })
    }
    const elapsedTimeAPI = timer(startTime)
    log(pluginJson, `Search time (API): ${elapsedTimeAPI} -> ${resultCount} results`)

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
      destination = await chooseOption(
        `Where should I save the ${resultCount} search results?`,
        [
          { label: labelString, value: 'newnote' },
          { label: '🖊 Append/update your current note', value: 'current' },
          { label: '📋 Write to plugin console log', value: 'log' },
          { label: '❌ Cancel', value: 'cancel' },
        ],
        'newnote',
      )
    }

    //---------------------------------------------------------
    // Do output
    const headingString = `${termsToMatchStr} ${config.searchHeading}`

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
            replaceSection(currentNote, r.resultHeading, r.resultHeading, config.headingLevel, r.resultLines.join('\n'))
          }
        }
        break
      }

      case 'newnote': {
        // We will write an overarching heading, as we need an identifying title for the note.
        // As this is likely to be a note just used for this set of search terms, just delete the whole 
        // note contents and re-write each search term's block.

        let outputNote: ?TNote
        let noteFilename = ''
        const requestedTitle = headingString
        const xcallbackLink = `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=saveSearchResults&arg0=${encodeURIComponent(termsToMatchStr)}`
        let fullNoteContent = `# ${requestedTitle}\nat ${nowLocaleDateTime} [Click to refresh these results](${xcallbackLink})`
        for (const r of results) {
          fullNoteContent += `\n${headingMarker} ${r.resultHeading}\n${r.resultLines.join('\n')}`
        }

        // See if this note has already been created
        // (look only in active notes, not Archive or Trash)
        const existingNotes: $ReadOnlyArray<TNote> =
          DataStore.projectNoteByTitle(requestedTitle, true, false) ?? []
        log(pluginJson, `- found ${existingNotes.length} existing search result note(s) titled ${requestedTitle}`)

        if (existingNotes.length > 0) {
          // write to the existing note (the first matching if more than one)
          outputNote = existingNotes[0]
          outputNote.content = fullNoteContent

        } else {
          // make a new note for this. NB: filename here = folder + filename
          noteFilename = DataStore.newNoteWithContent(fullNoteContent, config.folderToStore, requestedTitle)
          if (!noteFilename) {
            logError(pluginJson, `Error create new search note with requestedTitle '${requestedTitle}'`)
            await showMessage('There was an error creating the new search note')
            return
          }
          outputNote = DataStore.projectNoteByFilename(noteFilename)
          log(pluginJson, `Created new search note with filename: ${noteFilename}`)
        }
        log(pluginJson, `written results to the new note '${displayTitle(outputNote)}'`)

        // Make it open in split note, unless called from the x-callback ...
        if (!calledIndirectly) {
          await Editor.openNoteByFilename(noteFilename, false, 0, 0, true)
        }
        break
      }

      case 'log': {
        for (const r of results) {
          log(pluginJson, r.resultHeading)
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
  }
  catch (err) {
    logError(pluginJson, err.message)
  }
}
