// @flow
//-----------------------------------------------------------------------------
// Search Extensions helpers
// Jonathan Clark
// Last updated 8.7.2022 for v0.3.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  formatNoteDate,
  nowLocaleDateTime,
  toISOShortDateTimeString,
} from '@helpers/dateTime'
import { copyObject, log, logError, timer } from '@helpers/dev'
import {
  displayTitle,
  type headingLevelType,
  titleAsLink,
} from '@helpers/general'
import {
  isTermInMarkdownPath,
  isTermInURL,
} from '@helpers/paragraph'
import { trimAndHighlightTermInLine } from '@helpers/search'
import { sortListBy } from '@helpers/sorting'
import { showMessage } from '@helpers/userInput'

//------------------------------------------------------------------------------

export type resultObjectType = {
  searchTerm: string,
  resultLines: Array<string>,
  resultCount: number
}

//------------------------------------------------------------------------------
// Settings things

const configKey = 'search'

export type SearchConfig = {
  autoSave: boolean,
  folderToStore: string,
  foldersToExclude: Array<string>,
  headingLevel: headingLevelType,
  defaultSearchTerms: Array<string>,
  searchHeading: string,
  groupResultsByNote: boolean,
  sortOrder: string,
  resultPrefix: string,
  resultQuoteLength: number,
  highlightResults: boolean,
  showEmptyResults: boolean,
  dateStyle: string,
}

/**
 * Get config settings using Config V2 system.
 *
 * @return {SearchConfig} object with configuration
 */
export async function getSearchSettings(): Promise<any> {
  // log(pluginJson, `Start of getSearchSettings()`)
  try {
    // Get settings using ConfigV2
    const v2Config: SearchConfig = await DataStore.loadJSON('../jgclark.SearchExtensions/settings.json')
    // clo(v2Config, `${configKey} settings from V2:`)

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      throw new Error(`Cannot find settings for '${configKey}' plugin`)
    }
    return v2Config
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return null // for completeness
  }
}

export const sortByChangedDate = (): Function => {
  return (b, a) => {
    if (a.note.changedDate !== b.note.changedDate) {
      if (a.note.changedDate > b.note.changedDate) {
        return -1
      }
      if (b.note.changedDate > a.note.changedDate) {
        return 1
      }
    }
    return 0
  }
}

export const sortByTitle = (): Function => {
  return (b, a) => {
    const aTitle = displayTitle(a)
    const bTitle = displayTitle(b)
    if (aTitle !== bTitle) {
      if (aTitle > bTitle) {
        return -1
      }
      if (bTitle > aTitle) {
        return 1
      }
    }
    return 0
  }
}

/**
 * Run a search over all search terms in 'termsToMatchArr' over the set of notes determined by 
 * - notesTypesToInclude (['notes'] or ['calendar'] or both)
 * - foldersToInclude (can be empty list)
 * - foldersToExclude (can be empty list)
 * - config for various settings
 * 
 * @param {Array<string>} termsToMatchArr 
 * @param {Array<string>} noteTypesToInclude 
 * @param {Array<string>} foldersToInclude 
 * @param {Array<string>} foldersToExclude 
 * @param {SearchConfig} config 
 * @returns {Array<resultObjectType>} array of result sets
 */
export async function runSearches(
  termsToMatchArr: Array<string>,
  noteTypesToInclude: Array<string>,
  foldersToInclude: Array<string>,
  foldersToExclude: Array<string>,
  config: SearchConfig
): Promise<Array<resultObjectType>> {
  try {
    const results: Array<resultObjectType> = []
    let resultCount = 0
    const outerStartTime = new Date

    // CommandBar.showLoading(true, `Running search for ${String(termsToMatchArr)} ...`)
    // await CommandBar.onAsyncThread()

    for (const untrimmedSearchTerm of termsToMatchArr) {
      const innerStartTime = new Date
      // search over all notes, apart from specified folders
      const searchTerm = untrimmedSearchTerm.trim()
      const resultObject = await runSearch(searchTerm, noteTypesToInclude, foldersToInclude, foldersToExclude, config)

      // Save this search term and results as a new object in results array
      results.push(resultObject)
      // results.push( { resultHeading: thisResultHeading, resultLines: outputArray })
      resultCount += resultObject.resultCount
      log(pluginJson, `- search time (API): '${searchTerm}' search in ${timer(innerStartTime)} -> ${resultObject.resultCount} results`)
    }

    // await CommandBar.onMainThread()
    // CommandBar.showLoading(false)

    log(pluginJson, `Total Search time (API): ${termsToMatchArr.length} searches in ${timer(outerStartTime)} -> ${resultCount} results`)
    return results
  }
  catch (err) {
    logError(pluginJson, err.message)
    return [] // for completeness
  }
}

/**
 * Run a search for 'searchTerm' over the set of notes determined by 
 * - notesTypesToInclude (['notes'] or ['calendar'] or both)
 * - foldersToInclude (can be empty list)
 * - foldersToExclude (can be empty list)
 * - config for various settings
 * 
 * @param {Array<string>} searchTerm 
 * @param {Array<string>} noteTypesToInclude 
 * @param {Array<string>} foldersToInclude 
 * @param {Array<string>} foldersToExclude 
 * @param {SearchConfig} config 
 * @returns {resultObjectType} single result set
 */
export async function runSearch(
  searchTerm: string,
  noteTypesToInclude: Array<string>,
  foldersToInclude: Array<string>,
  foldersToExclude: Array<string>,
  config: SearchConfig
): Promise<resultObjectType> {
  try {
    const outputArray = []
    const headingMarker = '#'.repeat(config.headingLevel)
    let resultCount = 0

    // get list of matching paragraphs for this string
    const resultParas = await DataStore.search(searchTerm, noteTypesToInclude, foldersToInclude, foldersToExclude)

    if (resultParas.length > 0) {
      log(pluginJson, `- Found ${resultParas.length} results for '${searchTerm}'`)

      // Sort the results by the user-selected sort order
      // @dwertheimer has worked out that a copy of objects returned from the API don't work as normal.
      // So he wrote the copyObject() function to help.
      // His sortListBy() function only works with elements at the top level of the object, so in order to
      // to access p.note.changedDate etc. we need to create a special new object which is what this odes:
      const resultParasWithNoteFields = resultParas
        .map(p => ({
          ...copyObject(p),
          ...{ changedDate: p.note?.changedDate },
          ...{ createdDate: p.note?.createdDate },
          ...{ title: displayTitle(p.note) }
        }))
      const sortMap = new Map([
        ['alphabetical', 'title'],
        ['updated (most recent first)', '-changedDate'],
        ['updated (least recent first)', 'changedDate'],
        ['created (newest first)', '-createdDate'],
        ['created (oldest first)', 'createdDate'],
      ])
      const sortKey = sortMap.get(config.sortOrder) ?? 'title' // get value, falling back to 'title'
      log(pluginJson, `- Will use sortKey: ${sortKey} from ${config.sortOrder}`)
      const sortedLines = sortListBy(resultParasWithNoteFields.slice(), [sortKey])

      // form the output
      let previousNoteTitle = ''
      for (let i = 0; i < sortedLines.length; i++) {
        // log the info on the paras
        // $FlowFixMe[incompatible-type]
        const thisLine: TParagraph = sortedLines[i]
        // $FlowFixMe[incompatible-type]
        const thisNote: TNote = thisLine.note
        // console.log(`- ${displayTitle(thisNote)}\t${toISOShortDateTimeString(thisNote.changedDate)}\t${toISOShortDateTimeString(thisNote.createdDate)}`)

        let matchLine = thisLine.content
        const thisNoteTitleDisplay = (thisNote.date != null)
          ? formatNoteDate(thisNote.date, config.dateStyle)
          : titleAsLink(thisNote)
        // If the test is within a URL or the path of a [!][link](path) skip this result
        if (isTermInURL(searchTerm, matchLine)) {
          // log(pluginJson, `  - Info: Match '${searchTerm}' ignored in '${matchLine} because it's in a URL`)
          continue
        }
        if (isTermInMarkdownPath(searchTerm, matchLine)) {
          // log(pluginJson, `  - Info: Match '${searchTerm}' ignored in '${matchLine} because it's in a [...](path)`)
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
    return {
      searchTerm: searchTerm,
      resultLines: outputArray,
      resultCount: resultCount
    }
  }
  catch (err) {
    logError(pluginJson, err.message)
    const emptyResultObject = { searchTerm: '', resultsLines: [], resultCount: 0 }
    // $FlowFixMe[prop-missing]
    return emptyResultObject // for completeness
  }
}

/**
 * Write results set(s) out to a note, reusing note (but not the contents) where it already exists.
 * The data is in the first parameter; the rest are various settings.
 * @param {Array<resultObjectType>} results object
 * @param {string} requestedTitle
 * @param {string} folderToStore
 * @param {number} headingLevel
 * @param {boolean} calledIndirectly
 * @param {string?} xCallbackURL
 * @returns {string} filename of note we've written to
 */
export async function writeResultsNote(
  results: Array<resultObjectType>,
  requestedTitle: string,
  folderToStore: string,
  headingLevel: number,
  calledIndirectly: boolean,
  xCallbackURL: string = '',
): Promise<string> {
  try {
    let outputNote: ?TNote
    let noteFilename = ''
    const headingMarker = '#'.repeat(headingLevel)
    let fullNoteContent = `# ${requestedTitle}\nat ${nowLocaleDateTime}${(xCallbackURL !== '') ? ` [Click to refresh these results](${xCallbackURL})` : ''}`
    for (const r of results) {
      fullNoteContent += `\n${headingMarker} ${r.searchTerm} (${r.resultCount} results)\n${r.resultLines.join('\n')}`
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
      noteFilename = DataStore.newNoteWithContent(fullNoteContent, folderToStore, requestedTitle)
      if (!noteFilename) {
        logError(pluginJson, `Error create new search note with requestedTitle '${requestedTitle}'`)
        await showMessage('There was an error creating the new search note')
        return '' // for completeness
      }
      outputNote = DataStore.projectNoteByFilename(noteFilename)
      log(pluginJson, `Created new search note with filename: ${noteFilename}`)
    }
    log(pluginJson, `written results to the new note '${displayTitle(outputNote)}'`)
    return noteFilename
  }
  catch (err) {
    logError(pluginJson, err.message)
    return 'error'  // for completeness
  }
}