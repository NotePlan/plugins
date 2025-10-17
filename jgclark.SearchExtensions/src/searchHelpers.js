/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Search Extensions helpers, for both older and newer methods of running searches.
// Search Extensions helpers, for both older and newer methods of running searches.
// Jonathan Clark
// Last updated 2025-10-05 for v3.0.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { clo, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import {
  displayTitle,
  type headingLevelType,
} from '@helpers/general'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { getNoteByFilename, getNoteLinkForDisplay,
  replaceSection, setIconForNote } from '@helpers/note'
import { getOrMakeRegularNoteInFolder, getNoteTitleFromFilename } from '@helpers/NPnote'
import { trimAndHighlightTermInLine } from '@helpers/search'
import { showMessageYesNo } from '@helpers/userInput'

//------------------------------------------------------------------------------
// Data types

// Minimal data type needed to pass right through to result display
// Note: named before needing to add the 'type' item
export type noteAndLine = {
  noteFilename: string,
  line: string,  // contents of the paragraph
  index: number, // index number of the paragraph, to do any necessary further lookups
}

export type typedSearchTerm = {
  term: string, // (e.g. 'fixed')
  termRep: string, // short for termRepresentation (e.g. '-fixed')
  type: 'must' | 'may' | 'not-line' | 'not-note' | 'regex',
}

export type resultObjectType = {
  searchTerm: typedSearchTerm,
  resultNoteAndLineArr: Array<noteAndLine>,
  resultCount: number,
}

// Note: Deprecated; used before v3.
export type resultOutputType = {
  searchTermsRepArr: Array<string>;
  resultNoteAndLineArr: Array<noteAndLine>;
  resultCount: number;
  resultNoteCount: number;
  fullResultCount: number;
}

export type resultOutputV3Type = {
  searchTermsStr: string;
  searchOperatorsStr: string;
  searchTermsToHighlight: Array<string>;
  resultNoteAndLineArr: Array<noteAndLine>;
  resultCount: number;
  resultNoteCount: number;
  fullResultCount: number;
}

// Reduced set of paragraph.* fields
export type reducedFieldSet = {
  filename: string;
  changedDate?: Date;
  createdDate?: Date;
  title: string;
  type: ParagraphType;
  content: string;
  rawContent: string;
  lineIndex: number;
}

// Settings for a particular search
// Note: different from the config for the SearchExtensions plugin (below)
export type TSearchOptions = {
  noteTypesToInclude?: Array<string>,
  foldersToInclude?: Array<string>,
  foldersToExclude?: Array<string>,
  caseSensitiveSearching?: boolean,
  fullWordSearching?: boolean,
  paraTypesToInclude?: Array<ParagraphType>,
  syncOpenResultItems?: boolean,
  fromDateStr?: string,
  toDateStr?: string,
  originatorCommand?: string,
  commandNameToDisplay?: string,
  destinationArg?: string,// optional output desination indicator: 'current', 'newnote', 'log'
}

//-------------------------------------------------------------------------------
// Constants

export const OPEN_PARA_TYPES = ['open', 'scheduled', 'checklist', 'checklistScheduled']
export const SYNCABLE_PARA_TYPES = ['open', 'scheduled', 'checklist', 'checklistScheduled']

//------------------------------------------------------------------------------
// Config for SearchExtensions plugin
// Note: different from the settings for a particular search (above)

export type SearchConfig = {
  useNativeSearch: boolean,
  caseSensitiveSearching: boolean,
  fullWordSearching: boolean,
  includeArchive: boolean,
  foldersToExclude: Array<string>,
  autoSave: boolean,
  folderToStore: string,
  quickSearchResultsTitle: string,
  resultStyle: string,
  resultLimit: number,
  headingLevel: headingLevelType,
  searchHeading: string,
  sortOrder: string,
  groupResultsByNote: boolean,
  resultPrefix: string,
  resultQuoteLength: number,
  highlightResults: boolean,
  dateStyle: string,
  defaultSearchTerms: Array<string>,
  _logLevel: string,
  _logTimer: boolean,
  _runComparison: boolean,
  // includeSpecialFolders: boolean, // can't remember when this was removed
  syncOpenResultItems: boolean, // Note: not in settings.json, but desrived in getSearchSettings() below
}

/**
 * Get config settings from Plugin's saved settings.json.
 *
 * @return {SearchConfig} object with configuration
 */
export async function getSearchSettings(): Promise<any> {
  const pluginID = 'jgclark.SearchExtensions'
  // logDebug(pluginJson, `Start of getSearchSettings()`)
  try {
    const config: SearchConfig = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    if (config == null || Object.keys(config).length === 0) {
      throw new Error(`Cannot find settings for '${pluginID}' plugin`)
    }
    // Set syncOpenResultItems which is a special case. There's no separate setting for it (in SE), as is it is implied by resultStyle === 'NotePlan'
    // But it can be overridden by calls from other plugins.
    config.syncOpenResultItems = config.resultStyle === 'NotePlan'
    // clo(config, `${pluginID} settings:`)

    return config
  } catch (err) {
    logError(pluginJson, `getSearchSettings(): ${err.name}: ${err.message}`)
    return null // for completeness
  }
}

//------------------------------------------------------------------------------
// Functions

/**
 * Get array of paragraph types from a string
 * For v3 we need to map 'non-task' to 'quote', 'list', 'title' (heading), and 'text'
 * @author @jgclark
 * @param {string} paraTypesAsStr
 * @returns {Array<ParagraphType>}
 */
export function getParaTypesFromString(paraTypesAsStr: string): Array<ParagraphType> {
  const paraTypesToInclude: Array<ParagraphType> = (Array.isArray(paraTypesAsStr))
    ? paraTypesAsStr
    : (typeof paraTypesAsStr === 'string')
      // $FlowFixMe[incompatible-type]
      ? stringListOrArrayToArray(paraTypesAsStr, ',')
      : []
  if (paraTypesAsStr.includes('non-task')) {
    paraTypesToInclude.push('quote')
    paraTypesToInclude.push('list')
    paraTypesToInclude.push('title')
    paraTypesToInclude.push('text')
    paraTypesToInclude.splice(paraTypesToInclude.indexOf('non-task'), 1)
  }
  logDebug('getParaTypesFromString', `'${paraTypesAsStr ?? '(null)'}' -> para types [${paraTypesToInclude.toString()}]`)
  return paraTypesToInclude
}

/**
 * Get string representation of paragraph types
 * @param {Array<ParagraphType>} paraTypes
 * @returns {string}
 */
export function getParaTypesAsString(paraTypesAsStr: Array<ParagraphType>): string {
  return paraTypesAsStr.join(',')
}

/**
 * Get array of note types from a string (including 'both' option)
 * @param {string} noteTypesAsStr
 * @returns {Array<string>}
 */
export function getNoteTypesFromString(noteTypesAsStr: string): Array<string> {
  const noteTypesToInclude: Array<string> = (noteTypesAsStr === 'both' || noteTypesAsStr === '')
    ? ['notes', 'calendar']
    : [noteTypesAsStr]
  logDebug('getNoteTypesFromString', `'${noteTypesAsStr ?? '(null)'}' -> note types [${noteTypesToInclude.toString()}]`)
  return noteTypesToInclude
}

/**
 * Get string representation of note types, or 'both' if the array is empty or contains both 'notes' and 'calendar'
 * @param {Array<string>} noteTypes
 * @returns {string}
 */
export function getNoteTypesAsString(noteTypes: Array<string>): string {
  return (noteTypes.length === 0 || noteTypes.length === 2)
    ? 'both'
    : noteTypes[0]
}

/**
 * Count unique filenames present in array
 * @param {Array<noteAndLine>} inArray
 * @returns {number} of unique filenames present
 * @test in jest file
 */
export function numberOfUniqueFilenames(inArray: Array<noteAndLine>): number {
  const uniquedFilenames = inArray.map(m => m.noteFilename).filter((val, ind, arr) => arr.indexOf(val) === ind)
  // logDebug(`- uniqued filenames: ${uniquedFilenames.length}`)
  return uniquedFilenames.length
}

/**
 * Take possibly duplicative array, and reduce to unique items, retaining order.
 * There's an almost-same solution at https://stackoverflow.com/questions/53452875/find-if-two-arrays-are-repeated-in-array-and-then-select-them/53453045#53453045
 * but I can't make it work, so I'm going to hack it by joining the two object parts together,
 * then deduping, and then splitting out again
 * @author @jgclark
 * @param {Array<noteAndLine>} inArray
 * @returns {Array<noteAndLine>} outArray
 * @tests in jest file
 */
export function reduceNoteAndLineArray(inArray: Array<noteAndLine>): Array<noteAndLine> {
  const simplifiedArray = inArray.map((m) => m.noteFilename + ':::' + String(m.index) + ':::' + m.line)
  // const sortedArray = simplifiedArray.sort()
  const reducedArray = [... new Set(simplifiedArray)]
  const outputArray: Array<noteAndLine> = reducedArray.map((m) => {
    const parts = m.split(':::')
    return { noteFilename: parts[0], index: Number(parts[1]), line: parts[2] }
  })
  // clo(outputArray, 'output')
  return outputArray
}

/**
 * Create a string to display the number of results and notes: "[first N] from M results from P notes"
 * @author @jgclark
 * @param {resultOutputType} resultSet
 * @returns {string}
 */
export function resultCounts(resultSet: resultOutputV3Type): string {
  // V2:
  // return (resultSet.resultCount < resultSet.fullResultCount)
  //   ? `(first ${resultSet.resultCount} from ${resultSet.fullResultCount} results from ${resultSet.resultNoteCount} notes)`
  //   : `(${resultSet.resultCount} results from ${resultSet.resultNoteCount} notes)`
  // V3: TEST:
  if (resultSet.resultCount === 0) {
    return `_No results_`
  }
  return (resultSet.resultCount < resultSet.fullResultCount)
    ? `**First ${resultSet.resultCount} results** (of ${resultSet.fullResultCount}) from ${resultSet.resultNoteCount} notes`
    : `**${resultSet.resultCount} results** from ${resultSet.resultNoteCount} notes`
}

export function formSearchResultsHeadingLine(resultSet: resultOutputV3Type): string {
  // const headingMarker = '#'.repeat(config.headingLevel)
  const searchTermsRepStr = resultSet.searchTermsStr ?? '?'
  return `[${searchTermsRepStr}]`
}

export function formSearchResultsMetadataLine(resultSet: resultOutputV3Type, xCallbackURL: string): string {
  const resultCountsStr = resultCounts(resultSet)
  const searchTermsRepStr = resultSet.searchTermsStr ?? '?'
  const searchOperatorsRepStr = resultSet.searchOperatorsStr ? `, with operators _${resultSet.searchOperatorsStr}_` : ''
  const xCallbackText = (xCallbackURL !== '') ? `[🔄 Refresh results for '${searchTermsRepStr}'](${xCallbackURL})` : ''
  return `${resultCountsStr}${searchOperatorsRepStr} at ${nowLocaleShortDateTime()} ${xCallbackText}`
}

/**
 * Write results set to a note, reusing it where it already exists.
 * Note: It's now possible to give a 'justReplaceThisSection' parameter: if it's given then just that section will be replaced, otherwise the whole contents will be deleted first. This allows for some preamble text to be left between runs.
 * Note: A heading is also needed for QuickSearch note, as otherwise the search terms aren't given.
 * @author @jgclark
 *
 * @param {SearchConfig} config
 * @param {resultOutputType} resultSet object
 * @param {string} requestedTitle requested note title to use/make
 * @param {string?} xCallbackURL URL to cause a 'refresh' of this command
 * @param {boolean?} justReplaceThisSection if set, will just replace this justReplaceThisSection's section, not replace the whole note (default: false)
 * @param {boolean?} createNoteIfNoResults if set, will create a note even if there are no results
 * @returns {string} filename of note we've written to
 */
export async function writeSearchResultsToNote(
  config: SearchConfig,
  resultSet: resultOutputV3Type,
  requestedTitle: string,
  xCallbackURL: string = '',
  justReplaceThisSection: boolean = false,
  createNoteIfNoResults: boolean = false,
): Promise<string> {
  try {
    logDebug('writeSearchResultsToNote', `Starting with ${resultSet.resultCount} results to write to note ${requestedTitle}, ${justReplaceThisSection ? 'just replacing this section' : 'replacing the whole note'}`)
    let noteFilename = ''
    // TEST:
    const searchTermsRepStr = resultSet.searchTermsStr ?? '?'
    const headingMarker = '#'.repeat(config.headingLevel)

    // Add each result line to output array
    let resultsContent = ''
    // First check if we have any results
    if (resultSet.resultCount > 0) {
      resultsContent = '\n' + createFormattedResultLines(resultSet, config).join('\n')
    }
    const titleLine = `# ${requestedTitle}`
    const headingLine = formSearchResultsHeadingLine(resultSet)
    const metadataLine = formSearchResultsMetadataLine(resultSet, xCallbackURL)
    // Prepend the results part with the timestamp+refresh line
    resultsContent = `${metadataLine}${resultsContent}`

    // If there are no results, and we would be creating a note, then stop
    const possExistingNotes = DataStore.projectNoteByTitle(requestedTitle)
    if (resultSet.resultCount === 0 && !createNoteIfNoResults && (!possExistingNotes || possExistingNotes.length === 0)) {
      logDebug('writeSearchResultsToNote', `- no results, and no existing results note '${requestedTitle}', so stopping.`)
      return ''
    }

    // Get existing note by start-of-string match on titleToMatch, if that is supplied, or requestedTitle if not.
    // Note: in theory could now use the 'content' parameter on Editor.openNoteByFilename() via NPNote/openNoteByFilename() helper here.
    const outputNote = await getOrMakeRegularNoteInFolder(requestedTitle, config.folderToStore)

    if (outputNote) {
      // If the relevant note has more than just a title line, decide whether to replace all contents, or just replace a given heading section
      if (justReplaceThisSection && outputNote.paragraphs.length > 1) {
        // Just replace the heading section, to allow for some text to be left between runs
        logDebug('writeSearchResultsToNote', `- just replacing section '${searchTermsRepStr}' in ${outputNote.filename}`)
        replaceSection(outputNote, searchTermsRepStr, headingLine, config.headingLevel, resultsContent)

        // Because of a change in where the timestamp is displayed, we potentially need to remove it from line 1 of the note
        const line1 = outputNote.paragraphs[1].content
        if (line1.startsWith('at ') && line1.includes('Refresh results for ')) {
          logDebug('writeSearchResultsToNote', `- removing timestamp from line 1 of ${outputNote.filename}. This should be one-time-only operation.`)
          outputNote.removeParagraphAtIndex(1)
        }
      }
      else {
        // Replace all note contents
        logDebug('writeSearchResultsToNote', `- replacing note content in ${outputNote.filename}`)
        const newContent = `${titleLine}\n${headingMarker} ${headingLine}\n${resultsContent}`
        // logDebug('', `${newContent} = ${newContent.length} bytes`)
        outputNote.content = newContent
      }

      // Set note's icon
      setIconForNote(outputNote, "magnifying-glass")

      noteFilename = outputNote.filename ?? '<error>'
      logDebug('writeSearchResultsToNote', `written resultSet for ${searchTermsRepStr} to the note ${noteFilename} (${displayTitle(outputNote)})`)
      return noteFilename
    }
    else {
      throw new Error(`Couldn't find or make note for ${requestedTitle}. Stopping.`)
    }
  }
  catch (err) {
    logError('writeSearchResultsToNote', err.message)
    return 'error' // for completeness
  }
}

/**
 * Create nicely-formatted Markdown lines to display 'resultSet', using settings from 'config'
 * @author @jgclark
 * @param {resultOutputTypeV2} resultSet
 * @param {SearchConfig} config
 * @returns {Array<string>} formatted search reuslts
 */
export function createFormattedResultLines(resultSet: resultOutputV3Type, config: SearchConfig): Array<string> {
  try {
    const resultOutputLines: Array<string> = []
    const headingMarker = '#'.repeat(config.headingLevel + 1)
    const simplifyLine = (config.resultStyle === 'Simplified')

    // Get array of 'may' or 'must' search terms ready to display highlights
    // const mayOrMustTermsRep = (resultSet.searchTermsRepArr)
    //   ? resultSet.searchTermsRepArr.filter((f) => f[0] !== '-')
    //   : resultSet.searchTermsStr.split(' ').filter((f) => f[0] !== '-')
    // // Take off leading + or ! if necessary
    // const mayOrMustTerms = mayOrMustTermsRep.map((f) => (f.match(/^[\+\!]/)) ? f.slice(1) : f)
    // const notEmptyMayOrMustTerms = mayOrMustTerms.filter((f) => f !== '')
    const searchTermsToHighlight = resultSet.searchTermsToHighlight
    // logDebug('createFormattedResultLines', `Starting with ${notEmptyMayOrMustTerms.length} notEmptyMayOrMustTerms (${String(notEmptyMayOrMustTerms)}) / simplifyLine? ${String(simplifyLine)} / groupResultsByNote? ${String(config.groupResultsByNote)} / config.resultQuoteLength = ${String(config.resultQuoteLength)}`)
    // Add each result line to output array
    let lastFilename: string
    let nc = 0
    for (const rnal of resultSet.resultNoteAndLineArr) {
      // clo(rnal, `resultNoteAndLineArr[${nc}]`)
      if (config.groupResultsByNote) {
        // Write each line without transformation, grouped by Note, with Note headings inserted accordingly
        const thisFilename = rnal.noteFilename
        if (thisFilename !== lastFilename && thisFilename !== '') {
          // though only insert heading if noteFilename isn't blank
          resultOutputLines.push(`${headingMarker} ${getNoteTitleFromFilename(rnal.noteFilename, true)}`)
        }
        const outputLine = trimAndHighlightTermInLine(rnal.line, searchTermsToHighlight, simplifyLine, config.highlightResults, config.resultPrefix, config.resultQuoteLength)
        resultOutputLines.push(outputLine)
        nc++
        lastFilename = thisFilename
      } else {
        // FIXME: suffixes causing sync line problems.
        // - do I need to remove this non-grouped option entirely?

        // Write the line, first transforming it to add context on the end, and make other changes according to what the user has configured
        let outputLine = trimAndHighlightTermInLine(rnal.line, searchTermsToHighlight, simplifyLine, config.highlightResults, config.resultPrefix, config.resultQuoteLength)
        outputLine += ` (${getNoteLinkForDisplay(rnal.noteFilename, config.dateStyle)})`
        resultOutputLines.push(outputLine)
        nc++
      }
    }
    logDebug('createFormattedResultLines', `added ${nc} output lines`)
    return resultOutputLines
  }
  catch (err) {
    logError('createFormattedResultLines', err.message)
    clo(resultSet)
    return [] // for completeness
  }
}

/**
 * Write to the log a basic display of 'resultSet', using settings from 'config'
 * @author @jgclark
 * @param {resultOutputTypeV2} resultSet
 * @param {SearchConfig} config
 */
export function logBasicResultLines(resultSet: resultOutputV3Type, config: SearchConfig): void {
  try {
    const resultOutputLines: Array<string> = []
    const simplifyLine = true

    // Get array of 'may' or 'must' search terms ready to display highlights
    // const mayOrMustTermsRep = resultSet.searchTermsRepArr
    //   ? resultSet.searchTermsRepArr.filter((f) => f[0] !== '-')
    //   : resultSet.searchTermsStr.split(' ').filter((f) => f[0] !== '-')
    // // Take off leading + or ! if necessary
    // const mayOrMustTerms = mayOrMustTermsRep.map((f) => (f.match(/^[\+\!]/)) ? f.slice(1) : f)
    // const notEmptyMayOrMustTerms = mayOrMustTerms.filter((f) => f !== '')
    const searchTermsToHighlight = resultSet.searchTermsToHighlight
    // logDebug(pluginJson, `${resultSet.resultCount} results [from ${notEmptyMayOrMustTerms.length} notEmptyMayOrMustTerms (${String(notEmptyMayOrMustTerms)}) / simplifyLine? ${String(simplifyLine)} / groupResultsByNote? ${String(config.groupResultsByNote)} / config.resultQuoteLength = ${String(config.resultQuoteLength)}]`)
    // Add each result line to output array
    let nc = 0
    for (const rnal of resultSet.resultNoteAndLineArr) {
      // Write each line without transformation, with filename prefixed
      const thisFilename = rnal.noteFilename
      const outputLine = trimAndHighlightTermInLine(rnal.line, searchTermsToHighlight, simplifyLine, config.highlightResults, config.resultPrefix, config.resultQuoteLength)
      resultOutputLines.push(`- ${String(nc)} ${thisFilename}: ${outputLine}`)
      nc++
    }
    console.log(resultOutputLines.join('\n'))
  }
  catch (err) {
    logError('logBasicResultLines', err.message)
    clo(resultSet)
  }
}

/**
 * Go through results, and if there are open task lines, then sync lines by adding a blockID (having checked there isn't one already).
 * @author @jgclark
 * @param {resultOutputType} input
 * @returns {resultOutputType}
 */
export async function makeAnySyncs(input: resultOutputV3Type): Promise<resultOutputV3Type> {
  try {
    // Go through each line looking for open tasks
    const linesToSync = []
    let rnalCount = 0
    for (const rnal of input.resultNoteAndLineArr) {
      // Get the line details (have to get from DataStore)
      const thisIndex = rnalCount
      const thisLine = rnal.line
      const thisNote = getNoteByFilename(rnal.noteFilename)
      const thisPara = thisNote?.paragraphs?.[rnal.index]
      const thisType = thisPara?.type ?? ''

      // If this line is an open-type task without existing blockID, then add to array to process
      if (thisNote && SYNCABLE_PARA_TYPES.includes(thisType) && thisPara && !thisPara?.blockId) {
        linesToSync.push([thisIndex, thisLine, thisNote, thisPara, thisType])
        logDebug('makeAnySyncs', `- lineToSync from rnal index ${thisIndex}`)
      }
      rnalCount++
    }

    // If >=20 open tasks, check user really wants to do this
    if (linesToSync.length >= 20) {
      const res = await showMessageYesNo(`I have found ${linesToSync.length} results with open tasks, which will be sync'd to this note. Do you wish to continue?`)
      if (res !== 'Yes') {
        return input
      }
    }

    const output = input
    if (linesToSync.length > 0) {
      for (const lineDetails of linesToSync) {
        // eslint-disable-next-line no-unused-vars
        const [thisIndex, thisLine, thisNote, thisPara, thisType] = lineDetails
        // Add blockID to source
        // logDebug('makeAnySyncs', `- will add blockId to source line '${thisLine}' index ${thisIndex}`)
        thisNote.addBlockID(thisPara)
        thisNote.updateParagraph(thisPara)
        const thisBlockID = thisPara.blockId ?? '<error>'
        // logDebug('makeAnySyncs', `- added blockId '${thisBlockID}' to source line`)
        // Now append to result
        const updatedLine = `${thisLine} ${thisBlockID}`
        output.resultNoteAndLineArr[thisIndex].line = updatedLine
        logDebug('makeAnySyncs', `- appended blockId to result ${thisIndex} -> '${updatedLine}'`)
      }
    } else {
      logDebug('makeAnySyncs', `No open task lines to sync in result set`)
    }
    return output
  }
  catch (err) {
    logError('makeAnySyncs', err.message)
    // $FlowFixMe[incompatible-return]
    return null
  }
}
