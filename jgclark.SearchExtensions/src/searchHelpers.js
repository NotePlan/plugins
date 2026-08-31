/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Search Extensions helpers, for both older and newer methods of running searches.
// Jonathan Clark
// Last updated 2025-12-26 for v3.0.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { stringToTailwindColorName } from '@helpers/colors'
import { clo, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import {
  displayTitle,
  type headingLevelType,
} from '@helpers/general'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { getNoteByFilename, getNoteLinkForDisplay, removeSection, replaceSection, setIconForNote } from '@helpers/note'
import { endOfFrontmatterLineIndex, ensureFrontmatter, getFrontmatterAttributes, getFrontmatterWriteTarget, hasFrontMatter, noteHasFrontMatter, setNoteFrontmatterAttributes } from '@helpers/NPFrontMatter'
import { nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { getOrMakeRegularNoteInFolder, getNoteTitleFromFilename, getStartOfActiveContentCharIndex, scrollEditorToStartOfActiveNote } from '@helpers/NPnote'
import { findEndOfActivePartOfNote, findStartOfActivePartOfNote } from '@helpers/paragraph'
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
  useNativeSortOrder?: boolean, // from v3.0.0, set when a 'sort:asc' or 'sort:desc' operator is found in the search string
  destinationArg?: string,// optional output desination indicator: 'current', 'newnote', 'log'
}

//-------------------------------------------------------------------------------
// Constants

export const OPEN_PARA_TYPES = ['open', 'scheduled', 'checklist', 'checklistScheduled']
export const SYNCABLE_PARA_TYPES = ['open', 'scheduled', 'checklist', 'checklistScheduled']

// Look-up table for sort details
export const SORT_MAP: Map<string, Array<string>> = new Map([
  ['note title', ['title', 'lineIndex']], // ascending
  ['note title (descending)', ['-title', 'lineIndex']], // descending
  ['folder name then note title', ['filename', 'lineIndex']], // ascending
  ['folder name then note title (descending)', ['-filename', 'lineIndex']], // descending
  ['updated (most recent note first)', ['-changedDate', 'lineIndex']], // descending
  ['updated (least recent note first)', ['changedDate', 'lineIndex']], // ascending
  ['created (newest note first)', ['-createdDate', 'lineIndex']], // descending
  ['created (oldest note first)', ['createdDate', 'lineIndex']], // ascending
])

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
    // Normalise legacy setting values so existing installs recover
    if (config.resultStyle === 'NotePlan-style') {
      config.resultStyle = 'NotePlan'
    }
    if (config.sortOrder === 'updated (most recent first)') {
      config.sortOrder = 'updated (most recent note first)'
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
// Helper Functions

/**
 * Map internal originatorCommand to registered plugin.json command name for x-callback URLs.
 * @param {string} originatorCommand
 * @returns {string}
 */
export function getSearchCommandName(originatorCommand: string): string {
  const commandMap: { [key: string]: string } = {
    searchOverAll: 'search',
    searchPeriod: 'searchInPeriod',
    searchOverCalendar: 'searchOverCalendar',
    searchOverNotes: 'searchOverNotes',
    searchOpenTasks: 'searchOpenTasks',
    quickSearch: 'quickSearch',
  }
  return commandMap[originatorCommand] ?? originatorCommand
}

/**
 * Build x-callback args for re-run/refresh links, matching each command's JS signature.
 * @param {string} originatorCommand
 * @param {string} termsToMatchStr
 * @param {string} noteTypesAsStr
 * @param {string} paraTypesAsStr
 * @param {string?} fromDateStr
 * @param {string?} toDateStr
 * @returns {Array<string>}
 */
export function buildRefreshCallbackArgs(
  originatorCommand: string,
  termsToMatchStr: string,
  noteTypesAsStr: string,
  paraTypesAsStr: string,
  fromDateStr?: string,
  toDateStr?: string,
): Array<string> {
  const refreshDest = 'refresh'
  switch (originatorCommand) {
    case 'searchPeriod':
      return [termsToMatchStr, paraTypesAsStr, noteTypesAsStr, refreshDest, fromDateStr ?? '', toDateStr ?? '']
    case 'searchOpenTasks':
      return [termsToMatchStr, noteTypesAsStr, paraTypesAsStr, refreshDest]
    default:
      return [termsToMatchStr, noteTypesAsStr, paraTypesAsStr, refreshDest]
  }
}

/**
 * Add blockIDs to open-task source lines when NotePlan result style is active.
 * @param {resultOutputV3Type} resultSet
 * @param {SearchConfig} config
 * @returns {Promise<resultOutputV3Type>}
 */
export async function applySyncOpenResultItemsIfNeeded(
  resultSet: resultOutputV3Type,
  config: SearchConfig,
): Promise<resultOutputV3Type> {
  if (config.resultStyle === 'NotePlan' && config.syncOpenResultItems) {
    return await makeAnySyncs(resultSet)
  }
  return resultSet
}

/**
 * Get array of paragraph types from a string
 * For v3 we need to map 'not-task' to 'quote', 'list', 'title' (heading), and 'text'
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
  if (paraTypesAsStr.includes('not-task')) {
    paraTypesToInclude.push('quote')
    paraTypesToInclude.push('list')
    paraTypesToInclude.push('title')
    paraTypesToInclude.push('text')
    paraTypesToInclude.splice(paraTypesToInclude.indexOf('not-task'), 1)
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

/**
 * Form the heading line for the search results note, using the representation of the search string in square brackets.
 * @author @jgclark
 * @param {resultOutputV3Type} resultSet
 * @returns {string}
 */
export function formSearchResultsHeadingLine(resultSet: resultOutputV3Type): string {
  // const headingMarker = '#'.repeat(config.headingLevel)
  const searchTermsRepStr = resultSet.searchTermsStr ?? '?'
  return `[${searchTermsRepStr}]`
}

/**
 * Form the metadata line for the search results note.
 * @author @jgclark
 * @param {resultOutputV3Type} resultSet
 * @param {string} xCallbackURL
 * @returns {string}
 */
export function formSearchResultsMetadataLine(resultSet: resultOutputV3Type, xCallbackURL: string): string {
  const resultCountsStr = resultCounts(resultSet)
  const searchOperatorsRepStr = resultSet.searchOperatorsStr ? `, with operators [${resultSet.searchOperatorsStr}]` : ''

  // V1
  // const searchTermsRepStr = resultSet.searchTermsStr ?? '?'
  // const xCallbackText = (xCallbackURL !== '') ? `[🔄 Refresh '${searchTermsRepStr}' search](${xCallbackURL})` : ''
  // return `${resultCountsStr}${searchOperatorsRepStr} at ${nowLocaleShortDateTime()}\n${xCallbackText}`

  // V2
  const xCallbackText = (xCallbackURL !== '') ? `[🔄 Re-run search](${xCallbackURL})` : ''
  return `${resultCountsStr}${searchOperatorsRepStr} at ${nowLocaleShortDateTime()} ${xCallbackText}`
}

/**
 * Write results set to a note, reusing it where it already exists.
 * Note: It's now possible to give a 'justReplaceThisSection' parameter: if it's given then just that section will be replaced, otherwise the whole contents will be deleted first. This allows for some preamble text to be left between runs.
 * Note: A heading is also needed for QuickSearch note, as otherwise the search terms aren't given.
 * Note: If doNotCreateNoteIfNoResults is true, and there are no results, then a new note will not be created. But if it already exists, then it will be updated, to be accurate to the current results.
 * @author @jgclark
 *
 * @param {SearchConfig} config
 * @param {resultOutputType} resultSet object
 * @param {string} requestedTitle requested note title to use/make
 * @param {string?} xCallbackURL URL to cause a 'refresh' of this command
 * @param {boolean?} justReplaceThisSection if set, will just replace this justReplaceThisSection's section, not replace the whole note (default: false)
 * @param {boolean?} doNotCreateNoteIfNoResults? (default: true)
 * @param {TNote?} targetNote optional note to write to (e.g. Editor.note when re-running an open results note)
 * @returns {string} filename of note we've written to
 */
export async function writeSearchResultsToNote(
  config: SearchConfig,
  resultSet: resultOutputV3Type,
  requestedTitle: string,
  xCallbackURL: string = '',
  justReplaceThisSection: boolean = false,
  doNotCreateNoteIfNoResults: boolean = true,
  targetNote: ?TNote = null,
): Promise<string> {
  try {
    logDebug('writeSearchResultsToNote', `Starting with ${resultSet.resultCount} results to write to note ${requestedTitle}, ${justReplaceThisSection ? 'just replacing this section' : 'replacing the whole note'}`)
    let noteFilename = ''
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
    // resultsContent = `${metadataLine}${resultsContent}`

    // If there are no results, and we would be creating a note, then stop
    const possExistingNotes = DataStore.projectNoteByTitle(requestedTitle)
    if (resultSet.resultCount === 0 && doNotCreateNoteIfNoResults && (!possExistingNotes || possExistingNotes.length === 0)) {
      logDebug('writeSearchResultsToNote', `- no results, and no existing results note '${requestedTitle}', so stopping.`)
      return ''
    }

    // Get existing note by title, or use the supplied target (e.g. Editor when re-running an open results note).
    let outputNote = targetNote ?? await getOrMakeRegularNoteInFolder(requestedTitle, config.folderToStore)

    // TODO: Try to write different OR parts to separate sections.

    if (!outputNote) {
      throw new Error(`Couldn't find or make note for ${requestedTitle}. Stopping.`)
    }
    outputNote = getFrontmatterWriteTarget(outputNote)

    // If the relevant note has more than just a title line, decide whether to replace all contents, or just replace a given heading section
    if (justReplaceThisSection && outputNote.paragraphs.length > 1) {
      // Remove section from note using older possible heading formats
      const olderResultHeadingStart1 = `'${searchTermsRepStr}'`
      logDebug('writeSearchResultsToNote', `Will remove section '${olderResultHeadingStart1}' from current note`)
      const _res1 = removeSection(outputNote, olderResultHeadingStart1)
      const _res2 = removeSection(outputNote, searchTermsRepStr)
      const _res3 = removeSection(outputNote, headingLine)

      // Replace the results section
      logDebug('writeSearchResultsToNote', `- just replacing section '${headingLine}' in ${outputNote.filename}`)
      replaceSection(outputNote, headingLine, headingLine, config.headingLevel, resultsContent)

      // Metadata before finalise: updateParagraph() on body can wipe a frontmatter block
      // that was just added, so title/FM finalisation must run last.
      insertOrReplaceMetadataLine(outputNote, config, metadataLine)
      finaliseSpecificSearchResultNote(outputNote, requestedTitle)

    } else {
      // Replace all note contents. Specific-result notes use frontmatter title (no H1).
      logDebug('writeSearchResultsToNote', `- replacing note content in ${outputNote.filename}`)
      const newContent = justReplaceThisSection
        ? `${metadataLine}\n${headingMarker} ${headingLine}\n${resultsContent}`
        : `${titleLine}\n${metadataLine}\n${headingMarker} ${headingLine}\n${resultsContent}`
      // logDebug('', `${newContent} = ${newContent.length} bytes`)
      outputNote.content = newContent
      if (justReplaceThisSection) {
        insertOrReplaceMetadataLine(outputNote, config, metadataLine)
        finaliseSpecificSearchResultNote(outputNote, requestedTitle)
      }
    }

    // Set note's icon (after finalise — setIconForNote merges existing frontmatter keys)
    setIconForNote(outputNote, 'magnifying-glass', stringToTailwindColorName(requestedTitle))

    // H1 removal must be last: icon/metadata writes can leave a stale body title line when the note is open in Editor.
    if (justReplaceThisSection) {
      removeBodyH1IfTitleInFrontmatter(outputNote, requestedTitle)
    }

    // replaceSection / note.content edits scroll the open Editor to the bottom; show metadata at top.
    scrollEditorToStartOfActiveNote(outputNote)

    noteFilename = outputNote.filename ?? '<error>'
    logDebug('writeSearchResultsToNote', `written resultSet for ${searchTermsRepStr} to the note ${noteFilename} (${displayTitle(outputNote)})`)
    return noteFilename
  }
  catch (err) {
    logError('writeSearchResultsToNote', err.message)
    return 'error' // for completeness
  }
}

/**
 * Whether a paragraph is the search-results metadata line (counts, date, re-run link).
 * @param {string} content
 * @returns {boolean}
 */
export function isSearchResultsMetadataLine(content: string): boolean {
  const hasRefreshLink = /(🔄|Re-run search|Refresh )/.test(content)
  const hasResultCounts = /from\s+\d+\s+notes?\b/i.test(content)
  const hasCallback = /noteplan:\/\/x-callback-url\/runPlugin/i.test(content)
  return (hasRefreshLink && hasResultCounts) || (hasResultCounts && hasCallback)
}

/**
 * Paragraph array index of the first section heading at or above headingLevel, or -1.
 * @param {TNote} note
 * @param {number} headingLevel
 * @returns {number}
 */
export function findFirstSectionHeadingParagraphIndex(note: TNote, headingLevel: number): number {
  const startOfActive = findStartOfActivePartOfNote(note)
  const endOfActive = findEndOfActivePartOfNote(note)
  const paras = note.paragraphs ?? []
  for (let i = startOfActive; i <= endOfActive; i++) {
    const p = paras[i]
    if (p.type === 'title' && p.headingLevel >= headingLevel) {
      return i
    }
  }
  return -1
}

/**
 * Whether a raw markdown line is a sole body H1 for the given title (not H2+).
 * @param {string} line
 * @param {string} titleText
 * @returns {boolean}
 */
function isH1ContentLine(line: string, titleText: string): boolean {
  const trimmed = line.trim()
  if (!/^#+\s/.test(trimmed) || /^##+\s/.test(trimmed)) return false
  const textOnly = trimmed.replace(/^#+\s*/, '')
  return textOnly === titleText
}

/** Whether a paragraph is a legacy body H1 to remove when title lives in frontmatter. */
export function isBodyH1Paragraph(p: TParagraph, titleText?: string): boolean {
  const raw = (p.rawContent ?? p.content ?? '').trim()
  if (titleText && isH1ContentLine(raw, titleText)) return true
  if (p.headingLevel === 1 && (!titleText || p.content === titleText)) return true
  if (/^#\s/.test(raw) && !/^##\s/.test(raw)) return true
  return false
}

/**
 * Remove a legacy body H1 when the note title now lives in frontmatter.
 *
 * Uses `getFrontmatterWriteTarget` for paragraph removal. NotePlan often does not persist
 * `removeParagraph*` on an open note — fall back to stripping the H1 line from `note.content`,
 * then re-assert frontmatter title via `setNoteFrontmatterAttributes`.
 *
 * @param {TNote} note
 * @param {string} frontmatterTitle
 */
export function removeBodyH1IfTitleInFrontmatter(note: TNote, frontmatterTitle: string): void {
  const writeTarget = getFrontmatterWriteTarget(note)
  const titleInFM = getFrontmatterAttributes(note).title || frontmatterTitle
  if (!titleInFM) return

  const h1Index = writeTarget.paragraphs.findIndex((p) => isBodyH1Paragraph(p, frontmatterTitle))
  if (h1Index >= 0) {
    logDebug('removeBodyH1IfTitleInFrontmatter', `removing body H1 at paragraph ${h1Index}`)
    writeTarget.removeParagraphAtIndex(h1Index)
  }

  // NotePlan may not persist removeParagraph* on Editor when the note is open; strip the H1 line from content.
  const stillHasH1 = writeTarget.paragraphs.some((p) => isBodyH1Paragraph(p, frontmatterTitle))
  if (stillHasH1) {
    const lines = (writeTarget.content || '').split('\n')
    const filtered = lines.filter((line) => !isH1ContentLine(line, frontmatterTitle))
    if (filtered.length < lines.length) {
      logDebug('removeBodyH1IfTitleInFrontmatter', `fallback: stripping H1 line from note.content`)
      writeTarget.content = filtered.join('\n')
      setNoteFrontmatterAttributes(note, { title: frontmatterTitle })
    }
  }
}

/**
 * Finish a specific (per-search-terms) results note: set frontmatter title to the
 * full note title (e.g. `[#watercolour] (Search Results)`), drop any H1 (title lives
 * in frontmatter), and remove a blank line immediately after the closing frontmatter separator.
 * @param {TNote} note
 * @param {string} frontmatterTitle e.g. `[#watercolour] (Search Results)`
 */
export function finaliseSpecificSearchResultNote(note: TNote, frontmatterTitle: string): void {
  try {
    const writeTarget = getFrontmatterWriteTarget(note)
    const hadFMBlock = noteHasFrontMatter(note) || hasFrontMatter(note.content || '')

    if (!hadFMBlock) {
      logDebug('finaliseSpecificSearchResultNote', `no frontmatter block yet for ${note.filename ?? '?'} — creating from legacy layout`)
      ensureFrontmatter(writeTarget, true, frontmatterTitle)
    }

    // Set title via frontmatterAttributes merge (Editor when open). Do not use
    // updateFrontMatterVars here — on Editor.note it takes the non-Editor path and
    // can call ensureFrontmatter against stale note.content.
    setNoteFrontmatterAttributes(note, { title: frontmatterTitle })

    const titleInFM = getFrontmatterAttributes(note).title || frontmatterTitle

    if (titleInFM) {
      removeBodyH1IfTitleInFrontmatter(note, frontmatterTitle)
    } else {
      logWarn('finaliseSpecificSearchResultNote', `title not set in frontmatter for ${note.filename ?? '?'} — keeping any H1 in body`)
    }

    const endFM = endOfFrontmatterLineIndex(writeTarget)
    if (typeof endFM === 'number' && endFM > 0) {
      const next = writeTarget.paragraphs[endFM + 1]
      if (next && (next.type === 'empty' || next.content.trim() === '')) {
        writeTarget.removeParagraph(next)
      }
    }

    // Paragraph removals can re-parse frontmatter from YAML; re-assert title (and sync title: line).
    setNoteFrontmatterAttributes(note, { title: frontmatterTitle })

    logDebug('finaliseSpecificSearchResultNote', `title='${frontmatterTitle}' for ${note.filename}`)
  } catch (err) {
    logError('finaliseSpecificSearchResultNote', err.message)
  }
}

export function insertOrReplaceMetadataLine(outputNote: TNote, config: SearchConfig, metadataLine: string): void {
  try {
    const writeTarget = getFrontmatterWriteTarget(outputNote)
    // Replace contents of an existing metadata line before the first results section, if present.
    const firstSectionHeadingParaIndex = findFirstSectionHeadingParagraphIndex(writeTarget, config.headingLevel)
    const searchLimit = firstSectionHeadingParaIndex === -1 ? writeTarget.paragraphs.length : firstSectionHeadingParaIndex
    logDebug('insertOrReplaceMetadataLine', `- firstSectionHeadingParaIndex = ${firstSectionHeadingParaIndex}, searchLimit = ${searchLimit}`)

    let metadataLineIndex = -1
    for (let i = 0; i < searchLimit; i++) {
      if (isSearchResultsMetadataLine(writeTarget.paragraphs[i].content)) {
        metadataLineIndex = i
        break
      }
    }
    logDebug('insertOrReplaceMetadataLine', `- metadataLineIndex = ${metadataLineIndex}`)

    if (metadataLineIndex !== -1) {
      logDebug('insertOrReplaceMetadataLine', `- replacing metadata at paragraph ${String(metadataLineIndex)}`)
      const metadataPara = writeTarget.paragraphs[metadataLineIndex]
      metadataPara.content = metadataLine
      writeTarget.updateParagraph(metadataPara)
      // Remove any duplicate metadata lines before the first section heading
      for (let i = searchLimit - 1; i >= 0; i--) {
        if (i !== metadataLineIndex && isSearchResultsMetadataLine(writeTarget.paragraphs[i].content)) {
          logDebug('insertOrReplaceMetadataLine', `- removing duplicate metadata at paragraph ${String(i)}`)
          writeTarget.removeParagraph(writeTarget.paragraphs[i])
        }
      }
    } else {
      // Insert at start of active part (past frontmatter). If that line is blank, replace it.
      // If it is an H1 title, insert after the title.
      let insertAt = findStartOfActivePartOfNote(writeTarget)
      const paraAtStart = writeTarget.paragraphs[insertAt]
      if (paraAtStart && paraAtStart.type === 'empty') {
        writeTarget.removeParagraph(paraAtStart)
      } else if (paraAtStart && isBodyH1Paragraph(paraAtStart)) {
        insertAt += 1
      }
      logDebug('insertOrReplaceMetadataLine', `- inserting metadata line at ${String(insertAt)}`)
      writeTarget.insertParagraph(metadataLine, insertAt, 'text')
      const insertedPara = writeTarget.paragraphs[insertAt]
      if (insertedPara) {
        if (insertedPara.content !== metadataLine) {
          insertedPara.content = metadataLine
        }
        writeTarget.updateParagraph(insertedPara)
      }
    }
  } catch (err) {
    logError('insertOrReplaceMetadataLine', err.message)
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
        // Note: way back, suffixes were causing sync line problems. TEST: to see if this is still a problem.
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
 * Apply supported search operators to mutate the given searchOptions
 * Supports:
 * - source:notes|calendar|notes,calendar
 * - is:open|done|scheduled|cancelled|checklist|checklist-done|checklist-scheduled|checklist-cancelled|not-task
 * @param {Array<string>} searchOperators
 * @param {any} searchOptions
 */
export function applySearchOperatorsToOptions(searchOperators: Array<string>, searchOptions: any): void {
  try {
    if (!Array.isArray(searchOperators) || searchOperators.length === 0 || !searchOptions) return

    // Handle 'source:' operator -> noteTypesToInclude
    if (searchOperators.includes('source:notes,calendar') || searchOperators.includes('source:calendar,notes')) {
      searchOptions.noteTypesToInclude = ['notes', 'calendar']
    } else if (searchOperators.includes('source:notes')) {
      searchOptions.noteTypesToInclude = ['notes']
    } else if (searchOperators.includes('source:calendar')) {
      searchOptions.noteTypesToInclude = ['calendar']
    }

    // Handle 'is:' operator -> paraTypesToInclude
    const paraTypeOperator = searchOperators.find(op => op.startsWith('is:')) ?? ''
    if (paraTypeOperator.length > 0) {
      // $FlowFixMe[incompatible-type]
      searchOptions.paraTypesToInclude = paraTypeOperator.replace('is:', '').split(',')
      logDebug('applySearchOperatorsToOptions', `- paraTypesToInclude: ${String(searchOptions.paraTypesToInclude)}`)
    }

    // Handle 'sort:' operator -> sortOrder
    const sortOperator = searchOperators.find(op => op.startsWith('sort:')) ?? ''
    if (sortOperator.length > 0) {
      searchOptions.useNativeSortOrder = true
      logDebug('applySearchOperatorsToOptions', `- operator  '${sortOperator}' found. useNativeSortOrder -> ${String(searchOptions.useNativeSortOrder)}`)
    }
  } catch (error) {
    logError('searchHelpers/applySearchOperatorsToOptions', error.message)
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
