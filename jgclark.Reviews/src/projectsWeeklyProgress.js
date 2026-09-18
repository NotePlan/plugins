// @flow
//-----------------------------------------------------------------------------
// Weekly Area/Project progress: weekly-note upsert (quick) + CSV/heatmaps (full)
// - `/weeklyProjectsProgress` updates the weekly note from Shared notes-changed-recently
// - `/heatmaps for weekly Projects Progress` full-scans, writes CSV in the plugin data folder:
//   - progress-per-folder.csv: notes-per-week
//   - task-completion-per-folder.csv: tasks-per-week
//   then shows heatmaps
//
// Last updated 2026-09-18 for v2.3.0 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getMatchingProjectTypeTagsOnNote } from './reviewHelpers'
import { getReviewSettings, parseMarkdownHeadingSetting, type ReviewConfig } from './reviewSettings'
import {
  generateNotesChangedRecentlyCache,
  getFilenamesChangedRecently,
  isNotesChangedRecentlyCacheAvailable,
  isNotesChangedRecentlyCacheGenerationScheduled,
  updateNotesChangedRecentlyCacheIfTooOld,
} from '../../np.Shared/src/notesChangedRecentlyCache.js'
import {
  RE_DONE_DATE_OPT_TIME,
  RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE,
  convertISOToYYYYMMDD,
  YYYYMMDDDateStringFromDate,
} from '@helpers/dateTime'
import { getNPWeekData, pad } from '@helpers/NPdateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, overrideSettingsWithEncodedTypedArgs, timer } from '@helpers/dev'
import { createPrettyRunPluginLink } from '@helpers/general'
import { getRegularNotesFromFilteredFolders, getFolderFromFilename } from '@helpers/folders'
import { getOpenEditorFromFilename, getOrOpenEditorFromFilename } from '@helpers/NPEditor'
import { runSyncWorkOnAsyncThread } from '@helpers/NPThreads'
import { replaceSection } from '@helpers/note'
import { isDone } from '@helpers/utils'
import { showHTMLV2 } from '@helpers/HTMLView'
import { showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------------------
// Constants
//-----------------------------------------------------------------------------

const DEFAULT_NUM_WEEKS: number = 26
const PROJECT_FOLDER_MATCHERS: Array<string> = ['area', 'project']
const PROGRESS_PER_FOLDER_FILENAME: string = 'progress-per-folder.csv'
const TASK_COMPLETION_PER_FOLDER_FILENAME: string = 'task-completion-per-folder.csv'
const PLUGIN_ID: string = 'jgclark.Reviews'
export const HIDE_EMPTY_FOLDERS_PARAM: string = 'hide'
export const SHOW_EMPTY_FOLDERS_PARAM: string = 'show'
/** How often to refresh CommandBar.showLoading during note scans (every N notes). */
const SHOW_LOADING_UPDATE_EVERY_N_NOTES: number = 10

//-----------------------------------------------------------------------------
// Types

type WeekInfo = {
  label: string, // e.g. 2026-W06
  startDate: Date,
  endDate: Date,
}

type TWeeklyHeatmapChart = {
  data: Array<{ x: string, y: string, heat: number }>,
  chartTitle: string,
  containerId: string,
}

type TWeeklyProgressByFolderAndTag = {
  weekLabel: string,
  folders: Array<string>,
  tags: Array<string>,
  counts: Map<string, Map<string, number>>,
  notesByTag: Map<string, Array<string>>,
  notesByFolderAndTag: Map<string, Map<string, Array<string>>>,
}

//-----------------------------------------------------------------------------
// Helpers

/**
 * Compute the last N NotePlan weeks (including the current week) using getNPWeekData().
 * Returns an array ordered from oldest to newest, each with a week label and JS start/end dates.
 * @author @cursor
 *
 * @param {number} numWeeks
 * @returns {Array<WeekInfo>}
 */
export function getLastNWeeks(numWeeks: number = DEFAULT_NUM_WEEKS): Array<WeekInfo> {
  try {
    const weeks: Array<WeekInfo> = []
    const today = new Date()

    for (let i = numWeeks - 1; i >= 0; i--) {
      const weekData = getNPWeekData(today, -i, 'week')
      if (!weekData) {
        logError(pluginJson, `getLastNWeeks: getNPWeekData() returned null for offset ${String(-i)}`)
        continue
      }
      const label = `${String(weekData.weekYear)}-W${pad(weekData.weekNumber)}`
      weeks.push({
        label,
        startDate: weekData.startDate,
        endDate: weekData.endDate,
      })
    }

    logDebug(pluginJson, `getLastNWeeks: generated ${String(weeks.length)} weeks`)
    return weeks
  } catch (error) {
    logError(pluginJson, `getLastNWeeks: ${error.message}`)
    return []
  }
}

/**
 * Does a folder name count as an Area/Project folder? (case-insensitive substring match)
 * @param {string} folderName
 * @returns {boolean}
 */
function isAreaOrProjectFolder(folderName: string): boolean {
  const lc = folderName.toLowerCase()
  return PROJECT_FOLDER_MATCHERS.some((matcher) => lc.includes(matcher))
}

/**
 * Determine which week (if any) a given ISO date string (YYYY-MM-DD) falls into.
 * Returns the week label or empty string if not in range.
 * @param {string} isoDate
 * @param {Array<WeekInfo>} weeks
 * @returns {string}
 */
function getWeekLabelForISODate(isoDate: string, weeks: Array<WeekInfo>): string {
  if (!isoDate || weeks.length === 0) return ''
  const yyyymmdd = convertISOToYYYYMMDD(isoDate)
  for (const w of weeks) {
    const startStr = YYYYMMDDDateStringFromDate(w.startDate)
    const endStr = YYYYMMDDDateStringFromDate(w.endDate)
    if (yyyymmdd >= startStr && yyyymmdd <= endStr) {
      return w.label
    }
  }
  return ''
}

/**
 * Helper to build a folder/week key for Maps.
 * @param {string} folder
 * @param {string} weekLabel
 * @returns {string}
 */
function makeFolderWeekKey(folder: string, weekLabel: string): string {
  return `${folder}::${weekLabel}`
}

/**
 * Parse a @done(YYYY-MM-DD ...) date from paragraph content.
 * Returns the ISO date part or empty string.
 * @param {string} content
 * @returns {string}
 */
function getDoneISODateFromContent(content: string): string {
  if (!content || !content.match(RE_DONE_DATE_OPT_TIME)) return ''
  const reReturnArray = content.match(RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE) ?? []
  const doneDate = reReturnArray[1]
  return typeof doneDate === 'string' ? doneDate : ''
}

/**
 * Return true if the note title looks like an index/MOC note to exclude from progress stats.
 * @param {?string} title
 * @returns {boolean}
 */
function isIndexOrMOCNoteTitle(title: ?string): boolean {
  if (!title) return false
  return Boolean(title.match(/^index $/i) || title.match(/ index$/i) || title.match(/^moc $/i) || title.match(/ moc$/i))
}

/**
 * Derive distinct folder paths from a list of notes (folders with no notes are never included).
 * @param {Array<TNote>} notes
 * @returns {Array<string>}
 */
function getDistinctSortedFolderPathsFromNotes(notes: Array<TNote>): Array<string> {
  return Array.from(new Set(notes.map((n) => getFolderFromFilename(n.filename))))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/**
 * Get notes in Area/Project folders, plus the sorted list of folder paths found.
 * Folder paths are derived only from notes that exist — empty folders are never included.
 * @param {ReviewConfig} config
 * @returns {{ notes: Array<TNote>, folders: Array<string> }}
 */
function getNotesInTargetProjectFolders(config: ReviewConfig): { notes: Array<TNote>, folders: Array<string> } {
  const foldersToExclude = config.foldersToIgnore ?? []
  const allNotes = getRegularNotesFromFilteredFolders(foldersToExclude, true)
  const notesInTargetFolders = allNotes.filter((n) => {
    const folderPath = getFolderFromFilename(n.filename)
    return isAreaOrProjectFolder(folderPath) && !isIndexOrMOCNoteTitle(n.title)
  })
  const folders = getDistinctSortedFolderPathsFromNotes(notesInTargetFolders)
  return { notes: notesInTargetFolders, folders }
}

/**
 * Build a markdown table for current-week notes progressed, by folder and project tag.
 * Empty cells are left blank (not zero).
 * @param {Array<string>} folders
 * @param {Array<string>} tags
 * @param {Map<string, Map<string, number>>} counts
 * @returns {string}
 */
function buildWeeklyProgressMarkdownTable(
  folders: Array<string>,
  tags: Array<string>,
  counts: Map<string, Map<string, number>>,
): string {
  if (tags.length === 0) {
    return ''
  }
  const escapeCell = (value: string): string => value.replace(/\|/g, '\\|')
  const headerCells = ['Folder', ...tags].map(escapeCell)
  const alignCells = headerCells.map((_, index) => (index === 0 ? '---' : '---:'))
  const lines: Array<string> = [
    `| ${headerCells.join(' | ')} |`,
    `| ${alignCells.join(' | ')} |`,
  ]

  const columnTotals: Array<number> = tags.map((tag) => {
    let total = 0
    for (const folder of folders) {
      total += counts.get(folder)?.get(tag) ?? 0
    }
    return total
  })
  const totalRowCells = [
    '**TOTAL**',
    ...columnTotals.map((count) => String(count)),
  ].map(escapeCell)
  lines.push(`| ${totalRowCells.join(' | ')} |`)

  for (const folder of folders) {
    const tagCounts = counts.get(folder) ?? new Map()
    const rowCells = [escapeCell(folder)]
    for (const tag of tags) {
      const count = tagCounts.get(tag) ?? 0
      rowCells.push(count > 0 ? String(count) : '')
    }
    lines.push(`| ${rowCells.join(' | ')} |`)
  }

  return lines.join('\n')
}

/**
 * Label for a project-type tag in bullet summaries (no #; plural when count !== 1).
 * @param {string} tag
 * @param {number} count
 * @returns {string}
 */
export function formatProjectTypeTagCountLabel(tag: string, count: number): string {
  const base = tag.replace(/^#/, '').toLowerCase()
  if (count === 1) {
    return base
  }
  if (base.endsWith('s')) {
    return base
  }
  return `${base}s`
}

/**
 * Return true if the tag name (without #) appears in the folder name (case-insensitive).
 * @param {string} folderName
 * @param {string} tag
 * @returns {boolean}
 */
export function tagNamePresentInFolderName(folderName: string, tag: string): boolean {
  const tagBase = tag.replace(/^#/, '')
  if (!tagBase) {
    return false
  }
  return folderName.toLowerCase().includes(tagBase.toLowerCase())
}

/**
 * Bold-label text for folder/subfolder bullet summaries: "{folder} {count}" or "{folder} {count} {tagLabel}".
 * Omits the tag label when the tag name already appears in the folder name.
 * @param {string} folderName
 * @param {string} tag
 * @param {number} count
 * @returns {string}
 */
export function formatFolderTagSummaryLabel(folderName: string, tag: string, count: number): string {
  if (tagNamePresentInFolderName(folderName, tag)) {
    return `**${String(count)} ${folderName}**`
  }
  const label = formatProjectTypeTagCountLabel(tag, count)
  return `**${String(count)} ${folderName}** ${label}`
}

/**
 * First path segment of a folder path (e.g. "Projects/Area A" -> "Projects").
 * @param {string} folderPath
 * @returns {string}
 */
export function getTopLevelFolderPath(folderPath: string): string {
  if (!folderPath || folderPath === '/') {
    return folderPath || '/'
  }
  const parts = folderPath.split('/').filter((part) => part !== '')
  return parts[0] ?? folderPath
}

/**
 * Sort note titles for bullet summaries.
 * @param {Array<string>} titles
 * @returns {Array<string>}
 */
function sortNoteTitlesForSummary(titles: Array<string>): Array<string> {
  return [...titles].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/**
 * Build bullet lines summarising progressed notes per project tag.
 * Format: - **{count} {tagLabel}**: Title1・Title2 (one line per tag, in tag order)
 * @param {Array<string>} tags
 * @param {Map<string, Array<string>>} notesByTag
 * @returns {string}
 */
export function buildWeeklyProgressTagSummaryLines(
  tags: Array<string>,
  notesByTag: Map<string, Array<string>>,
): string {
  const lines: Array<string> = []
  for (const tag of tags) {
    const titles = notesByTag.get(tag) ?? []
    if (titles.length === 0) {
      continue
    }
    const sortedTitles = sortNoteTitlesForSummary(titles)
    const label = formatProjectTypeTagCountLabel(tag, sortedTitles.length)
    lines.push(`- **${String(sortedTitles.length)} ${label}**: ${sortedTitles.join('・')}`)
  }
  return lines.join('\n')
}

/**
 * Short comma-separated summary of progressed note counts per tag, e.g. "3 goals, 4 projects and 0 areas".
 * @param {Array<string>} tags
 * @param {Map<string, Array<string>>} notesByTag
 * @returns {string}
 */
export function buildWeeklyProgressTagCountSummary(
  tags: Array<string>,
  notesByTag: Map<string, Array<string>>,
): string {
  const parts: Array<string> = tags.map((tag) => {
    const count = notesByTag.get(tag)?.length ?? 0
    const label = formatProjectTypeTagCountLabel(tag, count)
    return `${String(count)} ${label}`
  })
  if (parts.length === 0) {
    return '0 notes'
  }
  if (parts.length === 1) {
    return parts[0]
  }
  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`
  }
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * Merge note titles into a map keyed by tag (deduped, sorted later).
 * @param {Map<string, Array<string>>} target
 * @param {string} tag
 * @param {Array<string>} titles
 */
function mergeNoteTitlesIntoTagMap(target: Map<string, Array<string>>, tag: string, titles: Array<string>): void {
  if (titles.length === 0) {
    return
  }
  const existing = target.get(tag) ?? []
  target.set(tag, Array.from(new Set([...existing, ...titles])))
}

/**
 * Build bullet lines grouped by top-level folder (one line per top-level folder and tag).
 * @param {Array<string>} tags
 * @param {Map<string, Map<string, Array<string>>>} notesByFolderAndTag
 * @returns {string}
 */
export function buildWeeklyProgressByFolderSummaryLines(
  tags: Array<string>,
  notesByFolderAndTag: Map<string, Map<string, Array<string>>>,
): string {
  const byTopLevel: Map<string, Map<string, Array<string>>> = new Map()

  for (const [folderPath, tagMap] of notesByFolderAndTag.entries()) {
    const topLevel = getTopLevelFolderPath(folderPath)
    const topLevelTagMap = byTopLevel.get(topLevel) ?? new Map()
    for (const [tag, titles] of tagMap.entries()) {
      mergeNoteTitlesIntoTagMap(topLevelTagMap, tag, titles)
    }
    byTopLevel.set(topLevel, topLevelTagMap)
  }

  const lines: Array<string> = []
  const sortedTopLevels = Array.from(byTopLevel.keys()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  for (const topLevel of sortedTopLevels) {
    const tagMap = byTopLevel.get(topLevel) ?? new Map()
    for (const tag of tags) {
      const titles = tagMap.get(tag) ?? []
      if (titles.length === 0) {
        continue
      }
      const sortedTitles = sortNoteTitlesForSummary(titles)
      const label = formatFolderTagSummaryLabel(topLevel, tag, sortedTitles.length)
      lines.push(`- ${label}: ${sortedTitles.join(' ・ ')}`)
    }
  }
  return lines.join('\n')
}

/**
 * Build bullet lines grouped by top-level folder with sub-bullets per full folder path and tag.
 * @param {Array<string>} tags
 * @param {Map<string, Map<string, Array<string>>>} notesByFolderAndTag
 * @returns {string}
 */
export function buildWeeklyProgressBySubFolderSummaryLines(
  tags: Array<string>,
  notesByFolderAndTag: Map<string, Map<string, Array<string>>>,
): string {
  const foldersByTopLevel: Map<string, Array<string>> = new Map()

  for (const folderPath of notesByFolderAndTag.keys()) {
    const topLevel = getTopLevelFolderPath(folderPath)
    const folderList = foldersByTopLevel.get(topLevel) ?? []
    if (!folderList.includes(folderPath)) {
      folderList.push(folderPath)
    }
    foldersByTopLevel.set(topLevel, folderList)
  }

  const lines: Array<string> = []
  const sortedTopLevels = Array.from(foldersByTopLevel.keys()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  for (const topLevel of sortedTopLevels) {
    const folderPaths = (foldersByTopLevel.get(topLevel) ?? []).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    const subLines: Array<string> = []
    for (const folderPath of folderPaths) {
      const tagMap = notesByFolderAndTag.get(folderPath) ?? new Map()
      for (const tag of tags) {
        const titles = tagMap.get(tag) ?? []
        if (titles.length === 0) {
          continue
        }
        const sortedTitles = sortNoteTitlesForSummary(titles)
        const label = formatFolderTagSummaryLabel(folderPath, tag, sortedTitles.length)
        subLines.push(`\t- ${label}: ${sortedTitles.join(' ・ ')}`)
      }
    }
    if (subLines.length > 0) {
      lines.push(`- ${topLevel}`)
      lines.push(...subLines)
    }
  }
  return lines.join('\n')
}

/**
 * Build bullet summary block for the configured summary mode.
 * @param {'byTag' | 'byFolder' | 'bySubFolder' | 'none' | ''} mode
 * @param {Array<string>} tags
 * @param {Map<string, Array<string>>} notesByTag
 * @param {Map<string, Map<string, Array<string>>>} notesByFolderAndTag
 * @returns {string}
 */
export function buildWeeklyProgressBulletSummary(
  mode: 'byTag' | 'byFolder' | 'bySubFolder' | 'none' | '',
  tags: Array<string>,
  notesByTag: Map<string, Array<string>>,
  notesByFolderAndTag: Map<string, Map<string, Array<string>>>,
): string {
  if (mode === 'byTag') {
    return buildWeeklyProgressTagSummaryLines(tags, notesByTag)
  }
  if (mode === 'byFolder') {
    return buildWeeklyProgressByFolderSummaryLines(tags, notesByFolderAndTag)
  }
  if (mode === 'bySubFolder') {
    return buildWeeklyProgressBySubFolderSummaryLines(tags, notesByFolderAndTag)
  }
  return ''
}

/**
 * Whether to include folder rows with no progress in the weekly table (default: true).
 * @param {ReviewConfig} config
 * @returns {boolean}
 */
function getWeeklyProjectProgressShowEmptyFolders(config: ReviewConfig): boolean {
  return config.weeklyProjectProgressShowEmptyFolders !== false
}

type TWeeklyProjectProgressBulletSummaryMode = 'byTag' | 'byFolder' | 'bySubFolder' | 'none' | ''

type TWeeklyProjectProgressOutputStyle = {
  showTable: boolean,
  bulletMode: TWeeklyProjectProgressBulletSummaryMode,
}

/** User-facing output style labels stored in settings */
export const WEEKLY_PROJECT_PROGRESS_OUTPUT_LIST_BY_TAG: string = 'List by tag'
export const WEEKLY_PROJECT_PROGRESS_OUTPUT_LIST_BY_FOLDER: string = 'List by folder'
export const WEEKLY_PROJECT_PROGRESS_OUTPUT_LIST_BY_SUBFOLDER: string = 'List by sub-folder'
export const WEEKLY_PROJECT_PROGRESS_OUTPUT_TABLE_BY_SUBFOLDER: string = 'Table by sub-folder'

/**
 * Resolve weekly note output style from settings (list vs table, and bullet grouping).
 * Accepts current user-facing labels and legacy internal tokens (byTag, byFolder, etc.).
 * @param {ReviewConfig} config
 * @returns {TWeeklyProjectProgressOutputStyle}
 */
export function resolveWeeklyProjectProgressOutputStyle(config: ReviewConfig): TWeeklyProjectProgressOutputStyle {
  const style = config.weeklyProjectProgressBulletSummary?.trim() ?? WEEKLY_PROJECT_PROGRESS_OUTPUT_LIST_BY_SUBFOLDER
  switch (style) {
    case WEEKLY_PROJECT_PROGRESS_OUTPUT_LIST_BY_TAG:
    case 'byTag':
      return { showTable: false, bulletMode: 'byTag' }
    case WEEKLY_PROJECT_PROGRESS_OUTPUT_LIST_BY_FOLDER:
    case 'byFolder':
      return { showTable: false, bulletMode: 'byFolder' }
    case WEEKLY_PROJECT_PROGRESS_OUTPUT_LIST_BY_SUBFOLDER:
    case 'bySubFolder':
      return { showTable: false, bulletMode: 'bySubFolder' }
    case WEEKLY_PROJECT_PROGRESS_OUTPUT_TABLE_BY_SUBFOLDER:
      return { showTable: true, bulletMode: 'none' }
    case 'none':
    case '':
      return { showTable: false, bulletMode: 'none' }
    default:
      logWarn(
        'resolveWeeklyProjectProgressOutputStyle',
        `Invalid weeklyProjectProgressBulletSummary '${style}'; defaulting to '${WEEKLY_PROJECT_PROGRESS_OUTPUT_LIST_BY_SUBFOLDER}'`,
      )
      return { showTable: false, bulletMode: 'bySubFolder' }
  }
}

/**
 * Return folder rows for the weekly table, optionally hiding folders with no progress that week.
 * @param {Array<string>} allFolders
 * @param {Map<string, Map<string, number>>} counts
 * @param {boolean} showEmptyFolders
 * @returns {Array<string>}
 */
function getFoldersForWeeklyProgressTable(
  allFolders: Array<string>,
  counts: Map<string, Map<string, number>>,
  showEmptyFolders: boolean,
): Array<string> {
  if (showEmptyFolders) {
    return allFolders
  }
  return allFolders.filter((folder) => {
    const tagCounts = counts.get(folder)
    if (!tagCounts) {
      return false
    }
    return Array.from(tagCounts.values()).some((count) => count > 0)
  })
}

/**
 * Decode x-callback arg tokens safely.
 * @param {string} paramsStr
 * @returns {string}
 */
function decodeParamToken(paramsStr: string): string {
  if (!paramsStr) {
    return ''
  }
  try {
    return decodeURIComponent(paramsStr)
  } catch (_) {
    return paramsStr
  }
}

/**
 * Normalise command/x-callback input to a string (NotePlan may pass a string or other types).
 * @param {any} paramsIn
 * @returns {string}
 */
export function normalizeWeeklyProjectProgressParam(paramsIn: any): string {
  if (paramsIn == null || paramsIn === '') {
    return ''
  }
  if (typeof paramsIn === 'object') {
    return JSON.stringify(paramsIn)
  }
  return String(paramsIn).trim()
}

/** ISO week label e.g. 2026-W35 */
const WEEK_LABEL_RE: RegExp = /^(\d{4})-W(\d{1,2})$/i

/**
 * Pick the first non-empty normalised param from NotePlan command arguments.
 * @param {Array<any>} argsIn
 * @returns {string}
 */
export function getFirstWeeklyProjectProgressParam(argsIn: Array<any>): string {
  for (const arg of argsIn) {
    const normalised = normalizeWeeklyProjectProgressParam(arg)
    if (normalised !== '') {
      return normalised
    }
  }
  return ''
}

/**
 * Normalise all non-empty command/x-callback arguments to strings.
 * @param {Array<any>} argsIn
 * @returns {Array<string>}
 */
export function normalizeWeeklyProjectProgressArgs(argsIn: Array<any>): Array<string> {
  return argsIn
    .map(normalizeWeeklyProjectProgressParam)
    .filter((arg) => arg !== '')
}

/**
 * Parse an ISO week label param (e.g. 2026-W35), or null if not a week token.
 * @param {string} paramsStr
 * @returns {?string}
 */
export function parseWeekLabelParam(paramsStr: string): ?string {
  if (!paramsStr) {
    return null
  }
  const token = decodeParamToken(paramsStr).toUpperCase()
  const match = token.match(WEEK_LABEL_RE)
  if (!match) {
    return null
  }
  return `${match[1]}-W${pad(Number(match[2]))}`
}

/**
 * Return the first week label found in command arguments, if any.
 * @param {Array<any>} argsIn
 * @returns {?string}
 */
export function resolveWeekLabelFromArgs(argsIn: Array<any>): ?string {
  for (const arg of normalizeWeeklyProjectProgressArgs(argsIn)) {
    const weekLabel = parseWeekLabelParam(arg)
    if (weekLabel) {
      return weekLabel
    }
  }
  return null
}

/**
 * Resolve the desired show-empty-folders value from a command param, if specified.
 * Uses explicit hide/show tokens.
 * @param {string} paramsStr
 * @param {ReviewConfig} config
 * @returns {?boolean}
 */
export function resolveShowEmptyFoldersFromParam(paramsStr: string, config: ReviewConfig): ?boolean {
  if (!paramsStr) {
    return null
  }
  const token = decodeParamToken(paramsStr)
  if (token === HIDE_EMPTY_FOLDERS_PARAM) {
    return false
  }
  if (token === SHOW_EMPTY_FOLDERS_PARAM) {
    return true
  }
  try {
    const parsed = JSON.parse(token)
    if (typeof parsed?.weeklyProjectProgressShowEmptyFolders === 'boolean') {
      return parsed.weeklyProjectProgressShowEmptyFolders
    }
  } catch (_) {
    // not JSON — fall through
  }
  return null
}

/**
 * Apply a show/hide empty-folders param to config (does not persist).
 * @param {ReviewConfig} config
 * @param {string} paramsStr
 * @returns {ReviewConfig}
 */
export function applyShowEmptyFoldersParamToConfig(config: ReviewConfig, paramsStr: string): ReviewConfig {
  const resolved = resolveShowEmptyFoldersFromParam(paramsStr, config)
  if (resolved == null) {
    return overrideSettingsWithEncodedTypedArgs(config, paramsStr)
  }
  return {
    ...config,
    weeklyProjectProgressShowEmptyFolders: resolved,
  }
}

/**
 * x-callback param that preserves the current empty-folder view mode on refresh.
 * @param {boolean} showEmptyFolders
 * @returns {string}
 */
export function getWeeklyProjectProgressViewParam(showEmptyFolders: boolean): string {
  return showEmptyFolders ? SHOW_EMPTY_FOLDERS_PARAM : HIDE_EMPTY_FOLDERS_PARAM
}

/*
 * Markdown x-callback link for hide/show empty-folder rows — disabled for now.
function getEmptyFoldersToggleLinkMD(showEmptyFolders: boolean): string {
  const linkText = showEmptyFolders ? 'Hide folders with no progress' : 'Show folders with no progress'
  const param = showEmptyFolders ? HIDE_EMPTY_FOLDERS_PARAM : SHOW_EMPTY_FOLDERS_PARAM
  return createPrettyRunPluginLink(linkText, PLUGIN_ID, 'weeklyProjectsProgress', [param])
}
 */

/**
 * Markdown x-callback refresh link that preserves view mode and target week.
 * @param {boolean} showEmptyFolders
 * @param {string} weekLabel
 * @returns {string}
 */
function getWeeklyProjectProgressRefreshLinkMD(showEmptyFolders: boolean, weekLabel: string): string {
  return createPrettyRunPluginLink(
    '🔄 Refresh',
    PLUGIN_ID,
    'weeklyProjectsProgress',
    [getWeeklyProjectProgressViewParam(showEmptyFolders), weekLabel],
  )
}

/**
 * @returns {string}
 */
function getCurrentWeekLabel(): string {
  const weekData = getNPWeekData(new Date(), 0, 'week')
  if (!weekData) {
    throw new Error('getCurrentWeekLabel: could not determine current week')
  }
  return weekData.weekString ?? `${String(weekData.weekYear)}-W${pad(weekData.weekNumber)}`
}

/**
 * @param {string} weekLabel
 * @returns {WeekInfo}
 */
function getWeekInfoFromWeekLabel(weekLabel: string): WeekInfo {
  const weekData = getNPWeekData(weekLabel, 0, 'week')
  if (!weekData) {
    throw new Error(`getWeekInfoFromWeekLabel: could not resolve week '${weekLabel}'`)
  }
  const label = weekData.weekString ?? `${String(weekData.weekYear)}-W${pad(weekData.weekNumber)}`
  return {
    label,
    startDate: weekData.startDate,
    endDate: weekData.endDate,
  }
}

/**
 * Apply optional params from command/x-callback invocation (hide/show empty-folder rows, etc.).
 * Persists setting changes to settings.json when a show/hide override is present. Returns the in-memory config used for this run.
 * @param {ReviewConfig} config
 * @param {Array<any>} argsIn
 * @returns {Promise<ReviewConfig>}
 */
async function applyWeeklyProjectProgressCommandParamsFromArgs(config: ReviewConfig, argsIn: Array<any>): Promise<ReviewConfig> {
  try {
    const normalisedArgs = normalizeWeeklyProjectProgressArgs(argsIn)
    if (normalisedArgs.length === 0) {
      return config
    }

    for (const arg of normalisedArgs) {
      const resolvedShowEmpty = resolveShowEmptyFoldersFromParam(arg, config)
      if (resolvedShowEmpty != null) {
        const updatedConfig = { ...config, weeklyProjectProgressShowEmptyFolders: resolvedShowEmpty }
        logInfo(
          'applyWeeklyProjectProgressCommandParams',
          `Set weeklyProjectProgressShowEmptyFolders to ${String(updatedConfig.weeklyProjectProgressShowEmptyFolders)} from param '${decodeParamToken(arg)}'`,
        )
        await DataStore.saveJSON(updatedConfig, '../jgclark.Reviews/settings.json', true)
        return updatedConfig
      }
    }

    for (const arg of normalisedArgs) {
      if (parseWeekLabelParam(arg)) {
        continue
      }
      const updatedConfig = applyShowEmptyFoldersParamToConfig(config, arg)
      if (updatedConfig !== config) {
        await DataStore.saveJSON(updatedConfig, '../jgclark.Reviews/settings.json', true)
        return updatedConfig
      }
    }

    return config
  } catch (error) {
    logError('applyWeeklyProjectProgressCommandParams', error.message)
    return config
  }
}

/**
 * Convert raw week-progress sets into the maps used by weekly-note markdown builders.
 * @param {string} weekLabel
 * @param {Array<string>} folders
 * @param {Array<string>} projectTypeTags
 * @param {Map<string, Map<string, Set<string>>>} counts
 * @param {Map<string, Set<string>>} notesByTagSets
 * @param {Map<string, Map<string, Set<string>>>} notesByFolderAndTagSets
 * @returns {TWeeklyProgressByFolderAndTag}
 */
function finalizeWeekProgressFromSets(
  weekLabel: string,
  folders: Array<string>,
  projectTypeTags: Array<string>,
  counts: Map<string, Map<string, Set<string>>>,
  notesByTagSets: Map<string, Set<string>>,
  notesByFolderAndTagSets: Map<string, Map<string, Set<string>>>,
): TWeeklyProgressByFolderAndTag {
  const countNumbers: Map<string, Map<string, number>> = new Map()
  for (const [folder, tagMap] of counts.entries()) {
    const numberMap: Map<string, number> = new Map()
    for (const [tag, noteSet] of tagMap.entries()) {
      numberMap.set(tag, noteSet.size)
    }
    countNumbers.set(folder, numberMap)
  }

  const notesByTag: Map<string, Array<string>> = new Map()
  for (const tag of projectTypeTags) {
    const titleSet = notesByTagSets.get(tag)
    if (!titleSet || titleSet.size === 0) {
      continue
    }
    notesByTag.set(
      tag,
      Array.from(titleSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    )
  }

  const notesByFolderAndTag: Map<string, Map<string, Array<string>>> = new Map()
  for (const [folderPath, tagMap] of notesByFolderAndTagSets.entries()) {
    const titleMap: Map<string, Array<string>> = new Map()
    for (const [tag, titleSet] of tagMap.entries()) {
      if (titleSet.size === 0) {
        continue
      }
      titleMap.set(
        tag,
        Array.from(titleSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
      )
    }
    if (titleMap.size > 0) {
      notesByFolderAndTag.set(folderPath, titleMap)
    }
  }

  return {
    weekLabel,
    folders,
    tags: projectTypeTags,
    counts: countNumbers,
    notesByTag,
    notesByFolderAndTag,
  }
}

/**
 * True when weekly-note upsert is configured (heading text present after parse).
 * @param {ReviewConfig} config
 * @returns {boolean}
 */
function shouldWriteWeeklyProjectProgressNote(config: ReviewConfig): boolean {
  const headingSetting = config.weeklyProjectProgressHeading?.trim() ?? ''
  if (!headingSetting) {
    return false
  }
  const { text: headingText } = parseMarkdownHeadingSetting(headingSetting)
  return headingText !== ''
}

type TWeeklyProgressCombinedScanResult = {
  notesPerWeekMap: Map<string, Set<string>>,
  tasksPerWeekMap: Map<string, number>,
  weekProgress: ?TWeeklyProgressByFolderAndTag,
}

/**
 * Sync: one pass over notes/paragraphs for multi-week CSV maps, and optionally single-week
 * folder×tag aggregates for the weekly note. Shows one CommandBar loading dialog.
 * Safe for `runSyncWorkOnAsyncThread` (read-only).
 * @param {Array<TNote>} notesInTargetFolders
 * @param {Array<string>} folders
 * @param {Array<WeekInfo>} weeks
 * @param {Array<string>} projectTypeTags
 * @param {?WeekInfo} targetWeekForNote - when set, also build weekProgress for that week
 * @returns {TWeeklyProgressCombinedScanResult}
 */
function scanWeeklyProgressCombinedSync(
  notesInTargetFolders: Array<TNote>,
  folders: Array<string>,
  weeks: Array<WeekInfo>,
  projectTypeTags: Array<string>,
  targetWeekForNote: ?WeekInfo,
): TWeeklyProgressCombinedScanResult {
  const notesPerWeekMap: Map<string, Set<string>> = new Map()
  const tasksPerWeekMap: Map<string, number> = new Map()
  const collectWeekProgress = targetWeekForNote != null
  const targetWeekLabel = targetWeekForNote?.label ?? ''

  const weekCounts: Map<string, Map<string, Set<string>>> = new Map()
  const notesByTagSets: Map<string, Set<string>> = new Map()
  const notesByFolderAndTagSets: Map<string, Map<string, Set<string>>> = new Map()

  if (collectWeekProgress && projectTypeTags.length === 0) {
    logWarn('scanWeeklyProgressCombinedSync', 'No projectTypeTags configured; weekly note table will be empty')
  }

  const total = notesInTargetFolders.length
  let loadingShown = false
  try {
    if (total > 0) {
      CommandBar.showLoading(true, `Scanning notes for weekly project progress\n0/${String(total)}`, 0)
      loadingShown = true
    }
    let index = 0
    for (const note of notesInTargetFolders) {
      index += 1
      if (loadingShown && (index % SHOW_LOADING_UPDATE_EVERY_N_NOTES === 0 || index === total)) {
        CommandBar.showLoading(true, `Scanning notes for weekly project progress\n${String(index)}/${String(total)}`, index / total)
      }
      const folderPath = getFolderFromFilename(note.filename)
      let progressedInTargetWeek = false
      for (const p of note.paragraphs) {
        if (!isDone(p)) continue
        const doneISO = getDoneISODateFromContent(p.content)
        if (!doneISO) continue

        const weekLabel = getWeekLabelForISODate(doneISO, weeks)
        if (!weekLabel) continue

        const key = makeFolderWeekKey(folderPath, weekLabel)
        const currentTasks = tasksPerWeekMap.get(key) ?? 0
        tasksPerWeekMap.set(key, currentTasks + 1)

        const noteSet = notesPerWeekMap.get(key) ?? new Set()
        noteSet.add(note.filename)
        notesPerWeekMap.set(key, noteSet)

        if (collectWeekProgress && weekLabel === targetWeekLabel) {
          progressedInTargetWeek = true
        }
      }

      if (!collectWeekProgress || !progressedInTargetWeek || projectTypeTags.length === 0) {
        continue
      }

      const matchingTags = getMatchingProjectTypeTagsOnNote(note, projectTypeTags)
      if (matchingTags.length === 0) continue

      const noteTitle = (note.title ?? '').trim() !== '' ? (note.title ?? '').trim() : note.filename
      for (const tag of matchingTags) {
        const folderMap = weekCounts.get(folderPath) ?? new Map()
        const noteSet = folderMap.get(tag) ?? new Set()
        noteSet.add(note.filename)
        folderMap.set(tag, noteSet)
        weekCounts.set(folderPath, folderMap)

        const titleSet = notesByTagSets.get(tag) ?? new Set()
        titleSet.add(noteTitle)
        notesByTagSets.set(tag, titleSet)

        const folderTagMap = notesByFolderAndTagSets.get(folderPath) ?? new Map()
        const folderTitleSet = folderTagMap.get(tag) ?? new Set()
        folderTitleSet.add(noteTitle)
        folderTagMap.set(tag, folderTitleSet)
        notesByFolderAndTagSets.set(folderPath, folderTagMap)
      }
    }
  } finally {
    if (loadingShown) {
      CommandBar.showLoading(false)
    }
  }

  const weekProgress =
    collectWeekProgress && targetWeekForNote != null
      ? finalizeWeekProgressFromSets(
        targetWeekForNote.label,
        folders,
        projectTypeTags,
        weekCounts,
        notesByTagSets,
        notesByFolderAndTagSets,
      )
      : null

  return { notesPerWeekMap, tasksPerWeekMap, weekProgress }
}

/**
 * Upsert a project progress table into a weekly calendar note using precomputed scan aggregates.
 * @param {ReviewConfig} config
 * @param {string} weekLabel - ISO week label (e.g. 2026-W35)
 * @param {TWeeklyProgressByFolderAndTag} weekProgress
 * @returns {Promise<void>}
 */
async function writeWeeklyProjectProgressToWeeklyNote(
  config: ReviewConfig,
  weekLabel: string,
  weekProgress: TWeeklyProgressByFolderAndTag,
): Promise<void> {
  const headingSetting = config.weeklyProjectProgressHeading?.trim() ?? ''
  if (!headingSetting) {
    logDebug('writeWeeklyProjectProgressToWeeklyNote', `weeklyProjectProgressHeading not set; skipping weekly note write`)
    return
  }

  const { level: headingLevel, text: headingText } = parseMarkdownHeadingSetting(headingSetting)
  if (!headingText) {
    logWarn('writeWeeklyProjectProgressToWeeklyNote', `weeklyProjectProgressHeading is blank after parsing; skipping weekly note write`)
    return
  }

  const targetWeek = getWeekInfoFromWeekLabel(weekLabel)
  const { folders: allFolders, tags, counts, notesByTag, notesByFolderAndTag } = weekProgress
  const showEmptyFolders = getWeeklyProjectProgressShowEmptyFolders(config)
  const folders = getFoldersForWeeklyProgressTable(allFolders, counts, showEmptyFolders)
  const hiddenFolderCount = allFolders.length - folders.length
  logInfo(
    'writeWeeklyProjectProgressToWeeklyNote',
    `week=${weekLabel}; showEmptyFolders=${String(showEmptyFolders)}; table rows=${String(folders.length)} of ${String(allFolders.length)} folders (${String(hiddenFolderCount)} hidden)`,
  )
  const xCallbackMD = getWeeklyProjectProgressRefreshLinkMD(showEmptyFolders, weekLabel)
  const sectionHeadingWithLinks = `${headingText} ${xCallbackMD}`
  const { showTable, bulletMode } = resolveWeeklyProjectProgressOutputStyle(config)
  const table = showTable ? buildWeeklyProgressMarkdownTable(folders, tags, counts) : ''
  const tagsSummary = buildWeeklyProgressTagCountSummary(tags, notesByTag)
  const introLine = `Progress: ${tagsSummary} in ${weekLabel}:`
  let bulletBlock = ''
  if (bulletMode !== 'none' && bulletMode !== '') {
    bulletBlock = buildWeeklyProgressBulletSummary(bulletMode, tags, notesByTag, notesByFolderAndTag)
  }
  const bodyParts: Array<string> = [introLine]
  if (showTable && table !== '') {
    bodyParts.push(table)
  }
  if (bulletBlock !== '') {
    bodyParts.push(bulletBlock)
  }
  const bodyContent = bodyParts.join('\n')

  const destNote = DataStore.calendarNoteByDateString(weekLabel)
    ?? DataStore.calendarNoteByDate(targetWeek.startDate, 'week')
  if (!destNote) {
    logError('writeWeeklyProjectProgressToWeeklyNote', `Cannot find weekly note to write to for ${weekLabel}`)
    return
  }

  let noteToUpdate: CoreNoteFields = destNote
  const openEditor = getOpenEditorFromFilename(destNote.filename, true)
  if (openEditor) {
    noteToUpdate = openEditor
    logDebug('writeWeeklyProjectProgressToWeeklyNote', `Weekly note '${destNote.filename}' is open in Editor; updating Editor pane`)
  } else {
    const openedEditor = await getOrOpenEditorFromFilename(destNote.filename, 'window')
    if (openedEditor) {
      noteToUpdate = openedEditor
      logDebug('writeWeeklyProjectProgressToWeeklyNote', `Weekly note '${destNote.filename}' opened in Editor for update`)
    }
  }
  replaceSection(noteToUpdate, headingText, sectionHeadingWithLinks, headingLevel, bodyContent)
  logInfo('writeWeeklyProjectProgressToWeeklyNote', `Updated section '${headingText}' in weekly note '${destNote.filename}' for ${weekLabel}`)
}

type TGenerateWeeklyProgressLinesResult = {
  notesRows: Array<string>,
  tasksRows: Array<string>,
  weekProgress: ?TWeeklyProgressByFolderAndTag,
}

type TGenerateWeeklyProgressOptions = {
  /** 'full' = all Area/Project folder notes; 'changedRecently' = Shared 7-day changed notes ∩ those folders */
  noteSet?: 'full' | 'changedRecently',
  /** When false, skip building CSV row arrays (weekly-note-only path). Default true. */
  buildCsvRows?: boolean,
}

/**
 * Ensure Shared notes-changed-recently cache is available; generate if missing/scheduled.
 * @returns {Promise<boolean>} true when cache is available after ensure
 */
async function ensureNotesChangedRecentlyCacheForWeeklyProgress(): Promise<boolean> {
  await updateNotesChangedRecentlyCacheIfTooOld()
  if (isNotesChangedRecentlyCacheGenerationScheduled()) {
    await generateNotesChangedRecentlyCache('Reviews weeklyProjectsProgress')
  }
  if (!isNotesChangedRecentlyCacheAvailable()) {
    await generateNotesChangedRecentlyCache('Reviews weeklyProjectsProgress (cache missing)')
  }
  return isNotesChangedRecentlyCacheAvailable()
}

/**
 * Notes for weekly progress: full folder set, or Shared changed-recently ∩ folder set.
 * Folder list always comes from the full target set (for empty-folder table rows).
 * @param {ReviewConfig} config
 * @param {'full' | 'changedRecently'} noteSet
 * @returns {Promise<{ notes: Array<TNote>, folders: Array<string>, usedChangedRecently: boolean }>}
 */
async function resolveNotesForWeeklyProgressScan(
  config: ReviewConfig,
  noteSet: 'full' | 'changedRecently',
): Promise<{ notes: Array<TNote>, folders: Array<string>, usedChangedRecently: boolean }> {
  const { notes: allTargetNotes, folders } = getNotesInTargetProjectFolders(config)
  if (noteSet !== 'changedRecently') {
    return { notes: allTargetNotes, folders, usedChangedRecently: false }
  }

  const cacheOk = await ensureNotesChangedRecentlyCacheForWeeklyProgress()
  if (!cacheOk) {
    logWarn(
      'resolveNotesForWeeklyProgressScan',
      `notes-changed-recently cache unavailable; falling back to full Area/Project folder note set`,
    )
    return { notes: allTargetNotes, folders, usedChangedRecently: false }
  }

  const changedFilenames = getFilenamesChangedRecently({ noteTypes: ['Notes'] })
  const changedSet = new Set(changedFilenames)
  const notes = allTargetNotes.filter((n) => n.filename && changedSet.has(n.filename))
  logInfo(
    'resolveNotesForWeeklyProgressScan',
    `Quick scan: ${String(notes.length)} of ${String(allTargetNotes.length)} Area/Project notes from ${String(changedFilenames.length)} Shared changed-recently filename(s)`,
  )
  return { notes, folders, usedChangedRecently: true }
}

/**
 * Generate weekly Project/Area progress stats per relevant folder for the last N weeks.
 * Full note set builds CSV row data; changed-recently set is for weekly-note aggregates.
 * @author @jgclark (spec) + @cursor (implementation)
 * @param {?ReviewConfig} configIn - when null, loads settings
 * @param {?WeekInfo} targetWeekForNote - when set, also return folder×tag aggregates for that week
 * @param {TGenerateWeeklyProgressOptions} [options]
 * @returns {Promise<TGenerateWeeklyProgressLinesResult>}
 */
async function generateProjectsWeeklyProgressLines(
  configIn: ?ReviewConfig = null,
  targetWeekForNote: ?WeekInfo = null,
  options: TGenerateWeeklyProgressOptions = {},
): Promise<TGenerateWeeklyProgressLinesResult> {
  try {
    const noteSet = options.noteSet ?? 'full'
    const buildCsvRows = options.buildCsvRows !== false
    logDebug(pluginJson, `generateProjectsWeeklyProgressLines: starting noteSet=${noteSet} buildCsvRows=${String(buildCsvRows)}`)
    const startTime = new Date()
    const config: ReviewConfig | null = configIn != null ? configIn : ((await getReviewSettings(): any): ReviewConfig)
    if (!config) {
      throw new Error('generateProjectsWeeklyProgressLines: could not load Review settings. Stopping.')
    }

    const weeks: Array<WeekInfo> = getLastNWeeks(DEFAULT_NUM_WEEKS)
    if (weeks.length === 0) {
      throw new Error('No week range could be calculated')
    }
    const weekLabels: Array<string> = weeks.map((w) => w.label)

    // Ensure target week is included in done-date week matching (may be outside last N weeks).
    let weeksForScan = weeks
    if (targetWeekForNote != null && !weeks.some((w) => w.label === targetWeekForNote.label)) {
      weeksForScan = [...weeks, targetWeekForNote]
    }

    const { notes: notesInTargetFolders, folders } = await resolveNotesForWeeklyProgressScan(config, noteSet)
    logDebug('generateProjectsWeeklyProgressLines', `considering ${String(notesInTargetFolders.length)} regular notes`)
    logInfo('generateProjectsWeeklyProgressLines', `found ${String(folders.length)} Area/Project folders and ${String(notesInTargetFolders.length)} notes to scan`)

    if (folders.length === 0) {
      logInfo('generateProjectsWeeklyProgressLines', `no Area/Project folders found: nothing to write`)
      return { notesRows: [], tasksRows: [], weekProgress: null }
    }

    let projectTypeTags: Array<string> = config.projectTypeTags ?? []
    if (typeof projectTypeTags === 'string') {
      projectTypeTags = [projectTypeTags]
    }

    let scanHolder: ?TWeeklyProgressCombinedScanResult = null
    await runSyncWorkOnAsyncThread('generateProjectsWeeklyProgressLines scan', () => {
      scanHolder = scanWeeklyProgressCombinedSync(
        notesInTargetFolders,
        folders,
        weeksForScan,
        projectTypeTags,
        targetWeekForNote,
      )
      return true
    })
    const scanResult: TWeeklyProgressCombinedScanResult =
      scanHolder != null
        ? scanHolder
        : scanWeeklyProgressCombinedSync(
          notesInTargetFolders,
          folders,
          weeksForScan,
          projectTypeTags,
          targetWeekForNote,
        )
    if (scanHolder == null) {
      logWarn('generateProjectsWeeklyProgressLines', `- async result missing; scanned on main thread`)
    }
    const { notesPerWeekMap, tasksPerWeekMap, weekProgress } = scanResult

    if (!buildCsvRows) {
      logInfo('projectsWeeklyProgressCSV', `Scanned ${String(notesInTargetFolders.length)} notes for weekly note only in ${timer(startTime)}`)
      return { notesRows: [], tasksRows: [], weekProgress }
    }

    const notesRows: Array<string> = [
      ['Folder / Notes progressed per week', ...weekLabels, 'total'].join(','),
    ]
    const tasksRows: Array<string> = [
      ['Folder / Tasks completed per week', ...weekLabels, 'total'].join(','),
    ]

    for (const folderName of folders) {
      const noteCounts: Array<string> = []
      let noteCountTotal = 0
      const taskCounts: Array<string> = []
      let taskCountTotal = 0

      for (const weekLabel of weekLabels) {
        const key = makeFolderWeekKey(folderName, weekLabel)
        const noteSetForWeek = notesPerWeekMap.get(key)
        const noteCount = noteSetForWeek ? noteSetForWeek.size : 0
        const taskCount = tasksPerWeekMap.get(key) ?? 0
        noteCounts.push(String(noteCount))
        noteCountTotal += noteCount
        taskCounts.push(String(taskCount))
        taskCountTotal += taskCount
      }

      notesRows.push([`"${folderName}"`].concat(noteCounts).concat(String(noteCountTotal)).join(','))
      tasksRows.push([`"${folderName}"`].concat(taskCounts).concat(String(taskCountTotal)).join(','))
    }

    if (folders.length > 0) {
      const notesColumnTotals: Array<number> = new Array<number>(weekLabels.length + 1).fill(0)
      const tasksColumnTotals: Array<number> = new Array<number>(weekLabels.length + 1).fill(0)

      for (const folderName of folders) {
        const rowPartsNotes = notesRows.find((r) => r.startsWith(`"${folderName}"`))
        const rowPartsTasks = tasksRows.find((r) => r.startsWith(`"${folderName}"`))
        if (!rowPartsNotes || !rowPartsTasks) {
          continue
        }
        const colsNotes = rowPartsNotes.split(',').slice(1).map((v) => Number(v) || 0)
        const colsTasks = rowPartsTasks.split(',').slice(1).map((v) => Number(v) || 0)
        colsNotes.forEach((val, idx) => {
          notesColumnTotals[idx] += val
        })
        colsTasks.forEach((val, idx) => {
          tasksColumnTotals[idx] += val
        })
      }

      notesRows.push(['"TOTAL"', ...notesColumnTotals.map((n) => String(n))].join(','))
      tasksRows.push(['"TOTAL"', ...tasksColumnTotals.map((n) => String(n))].join(','))
    }
    logInfo('projectsWeeklyProgressCSV', `Generated ${String(notesRows.length)} notes rows and ${String(tasksRows.length)} tasks rows in ${timer(startTime)}`)
    return { notesRows, tasksRows, weekProgress }
  } catch (error) {
    logError('projectsWeeklyProgressCSV', error.message)
    throw error
  }
}

//-----------------------------------------------------------------------------
// Main commands

/**
 * Write progress-per-folder and task-completion CSV files from precomputed row arrays.
 * @param {Array<string>} notesRows
 * @param {Array<string>} tasksRows
 * @returns {Promise<void>}
 */
async function writeWeeklyProgressCsvFiles(notesRows: Array<string>, tasksRows: Array<string>): Promise<void> {
  const notesCsvString = notesRows.join('\n')
  await DataStore.saveData(notesCsvString, PROGRESS_PER_FOLDER_FILENAME, true)
  const tasksCsvString = tasksRows.join('\n')
  await DataStore.saveData(tasksCsvString, TASK_COMPLETION_PER_FOLDER_FILENAME, true)
  logInfo('writeWeeklyProgressCsvFiles', `Written weekly progress CSV to '${PROGRESS_PER_FOLDER_FILENAME}' and '${TASK_COMPLETION_PER_FOLDER_FILENAME}'`)
}

/**
 * Upsert this week's Area/Project progress summary into the weekly note (when heading is configured).
 * Uses the Shared notes-changed-recently cache to scan only recently changed notes (falls back to full folder set if cache unavailable).
 * Does **not** rewrite the multi-week CSV files -- those are written by `/heatmaps for weekly Projects Progress`.
 *
 * @author @jgclark (spec) + @cursor (implementation)
 * @returns {Promise<void>}
 */
export async function updateWeeklyProjectsProgress(...argsIn: any[]): Promise<void> {
  try {
    const normalisedArgs = normalizeWeeklyProjectProgressArgs(argsIn)
    logDebug(
      pluginJson,
      `updateWeeklyProjectsProgress: starting with ${String(normalisedArgs.length)} arg(s)${normalisedArgs.length > 0 ? `: [${normalisedArgs.join(', ')}]` : ''}`,
    )

    let config: ReviewConfig | null = ((await getReviewSettings(): any): ReviewConfig)
    if (!config) {
      throw new Error('updateWeeklyProjectsProgress: could not load Review settings. Stopping.')
    }

    if (normalisedArgs.length > 0) {
      config = await applyWeeklyProjectProgressCommandParamsFromArgs(config, argsIn)
    }
    const weekLabel = resolveWeekLabelFromArgs(argsIn) ?? getCurrentWeekLabel()
    if (!shouldWriteWeeklyProjectProgressNote(config)) {
      logInfo(
        'updateWeeklyProjectsProgress',
        `weeklyProjectProgressHeading not set; nothing to write (CSV is produced by heatmaps command)`,
      )
      await showMessage(
        "No weekly-note heading is configured.\n\nSet 'Heading for Weekly Project Progress output' to upsert a summary into the weekly note.\n\nMulti-week CSV files are written by '/heatmaps for weekly Projects Progress'.",
        'OK',
        'Weekly Project Progress',
      )
      return
    }

    const targetWeekForNote = getWeekInfoFromWeekLabel(weekLabel)
    logDebug(
      pluginJson,
      `updateWeeklyProjectsProgress: using weeklyProjectProgressShowEmptyFolders=${String(getWeeklyProjectProgressShowEmptyFolders(config))}, week=${weekLabel}`,
    )

    const { weekProgress } = await generateProjectsWeeklyProgressLines(config, targetWeekForNote, {
      noteSet: 'changedRecently',
      buildCsvRows: false,
    })

    if (weekProgress != null) {
      await writeWeeklyProjectProgressToWeeklyNote(config, weekLabel, weekProgress)
      logInfo('updateWeeklyProjectsProgress', `Updated weekly note progress for ${weekLabel}`)
    } else {
      logWarn('updateWeeklyProjectsProgress', `No weekProgress aggregates for ${weekLabel}; weekly note not updated`)
    }
  } catch (error) {
    logError('updateWeeklyProjectsProgress', error.message)
    throw error
  }
}

/**
 * @deprecated Use {@link updateWeeklyProjectsProgress}. Kept so older x-callbacks / plugin.json rebuilds keep working until Rollup picks up the rename.
 * @returns {Promise<void>}
 */
export async function writeProjectsWeeklyProgressToCSV(...argsIn: any[]): Promise<void> {
  return updateWeeklyProjectsProgress(...argsIn)
}

//-----------------------------------------------------------------------------
// Heatmap visualisation

/**
 * Convert the CSV-style rows returned by generateProjectsWeeklyProgressLines()
 * into the data structure expected by AnyChart's heatMap chart.
 * The header row is expected to be:
 *   label,week1,week2,...,weekN,total
 * Subsequent rows are:
 *   "folder name",v1,v2,...,vN,total
 * The TOTAL row is ignored.
 * @param {Array<string>} rows
 * @returns {Array<{x: string, y: string, heat: number}>}
 */
function buildHeatmapDataFromCSVRows(rows: Array<string>): Array<{ x: string, y: string, heat: number }> {
  if (rows.length < 2) {
    return []
  }

  const headerParts = rows[0].split(',')
  if (headerParts.length < 3) {
    return []
  }

  const weekLabels = headerParts.slice(1, -1)
  const data = []

  for (let i = 1; i < rows.length; i++) {
    const line = rows[i]
    if (!line || line.trim() === '') {
      continue
    }
    const parts = line.split(',')
    if (parts.length < weekLabels.length + 2) {
      continue
    }

    const rawFolder = parts[0]
    const folderName = rawFolder.startsWith('"') && rawFolder.endsWith('"')
      ? rawFolder.slice(1, -1)
      : rawFolder

    if (folderName.toUpperCase() === 'TOTAL') {
      continue
    }

    for (let w = 0; w < weekLabels.length; w++) {
      const valStr = parts[1 + w]
      const heat = Number(valStr) || 0
      data.push({
        x: weekLabels[w],
        y: folderName,
        heat,
      })
    }
  }

  return data
}

/**
 * Render one or more weekly-progress heatmaps in a single HTML window.
 * Uses AnyChart's heatMap chart in the same way as the Summaries plugin's heatmap generator.
 * Each chart gets its own container id so two charts can draw in one document.
 * @param {Array<TWeeklyHeatmapChart>} charts
 * @param {string} windowTitle
 * @returns {Promise<void>}
 */
async function showProjectsWeeklyProgressHeatmapWindow(
  charts: Array<TWeeklyHeatmapChart>,
  windowTitle: string,
): Promise<void> {
  try {
    if (charts.length === 0) {
      logInfo('showProjectsWeeklyProgressHeatmapWindow', 'No heatmap data to display')
      return
    }

    const heatmapCSS = `html, body {
  width: 100%;
  height: 100%;
  margin: 0px;
  padding: 0px;
  color: var(--fg-main-color);
  background-color: var(--bg-main-color);
}
.heatmap-stack {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}
.heatmap-container {
  width: 100%;
  flex: 1;
  min-height: 0;
}
`

    const preScript = `<!-- Load AnyChart scripts -->
<script src="https://cdn.anychart.com/releases/8.7.1/js/anychart-core.min.js"></script>
<script src="https://cdn.anychart.com/releases/8.7.1/js/anychart-heatmap.min.js"></script>
`

    const containerDivs = charts
      .map((chart) => `<div id="${chart.containerId}" class="heatmap-container"></div>`)
      .join('\n')

    const drawCalls = charts
      .map((chart) => `    drawHeatmap(${JSON.stringify(chart.data)}, ${JSON.stringify(chart.chartTitle)}, ${JSON.stringify(chart.containerId)});`)
      .join('\n')

    const body = `
<div class="heatmap-stack">
${containerDivs}
</div>
<script>
  anychart.onDocumentReady(function () {
    function formatWeekAxisLabel() {
      var v = this.value;
      if (!v || typeof v !== 'string') {
        return v;
      }
      var parts = v.split('-W');
      if (parts.length !== 2) {
        return v;
      }
      var year = parts[0];
      var week = parts[1];
      if (week === '00' || week === '01') {
        return year;
      }
      return 'W' + week;
    }

    function drawHeatmap(data, title, containerId) {
      var chart = anychart.heatMap(data);
      chart.title(title);
      var customColorScale = anychart.scales.linearColor();
      customColorScale.colors(["#F4FFF4", "#09B009"]);
      chart.colorScale(customColorScale);
      chart.container(containerId);
      chart.labels().enabled(false);
      chart.xAxis().orientation('bottom');
      // Format x-axis labels:
      // - normally drop the leading "YYYY-" and show "WNN"
      // - but on the first week of a new year (W00/W01), drop the "-WNN" part and show just "YYYY"
      chart.xAxis().labels().format(formatWeekAxisLabel);
      // Rotate x-axis labels to go (nearly) vertically upwards
      chart.xAxis().labels().rotation(290);
      var tooltip = chart.tooltip();
      tooltip.titleFormat('');
      tooltip.padding().left(20);
      tooltip.separator(false);
      tooltip.format(function () {
        if (this.heat != null && this.heat !== '' && !isNaN(this.heat)) {
          return this.heat + ' items\\nFolder: ' + this.getData("y") + '\\nWeek: ' + this.getData("x");
        } else {
          return 'No data';
        }
      });
      chart.xScroller().enabled(true);
      chart.legend(true);
      chart.draw();
    }

${drawCalls}
  });
</script>
`

    const winOpts = {
      windowTitle,
      width: 800,
      height: charts.length > 1 ? 900 : 500,
      generalCSSIn: '',
      specificCSS: heatmapCSS,
      preBodyScript: preScript,
      postBodyScript: '',
      customId: `${PLUGIN_ID}.projects-weekly-progress-heatmaps`,
      savedFilename: 'projects-weekly-progress-heatmap.html',
      makeModal: false,
      reuseUsersWindowRect: true,
      shouldFocus: true,
    }

    await showHTMLV2(body, winOpts)
    logInfo('showProjectsWeeklyProgressHeatmapWindow', `Shown window titled '${windowTitle}' with ${String(charts.length)} chart(s)`)
  } catch (error) {
    logError('showProjectsWeeklyProgressHeatmapWindow', error.message)
  }
}

/**
 * Full-scan weekly Area/Project progress: write multi-week CSV files, then show heatmaps
 * (notes progressed and tasks completed) in one HTML window.
 * This is the authoritative path for CSV / multi-week visualisation; `/weeklyProjectsProgress`
 * only updates the weekly note from recently changed notes.
 * @returns {Promise<void>}
 */
export async function showProjectsWeeklyProgressHeatmaps(): Promise<void> {
  try {
    logDebug(pluginJson, `showProjectsWeeklyProgressHeatmaps: starting (full scan + CSV + heatmaps)`)

    const { notesRows, tasksRows } = await generateProjectsWeeklyProgressLines(null, null, {
      noteSet: 'full',
      buildCsvRows: true,
    })

    if (notesRows.length > 0 || tasksRows.length > 0) {
      await writeWeeklyProgressCsvFiles(notesRows, tasksRows)
    }

    const charts: Array<TWeeklyHeatmapChart> = []
    if (notesRows.length > 0) {
      const notesData = buildHeatmapDataFromCSVRows(notesRows)
      if (notesData.length > 0) {
        charts.push({
          data: notesData,
          chartTitle: 'Area/Project Notes progressed per week',
          containerId: 'notes-heatmap-container',
        })
      }
    }
    if (tasksRows.length > 0) {
      const tasksData = buildHeatmapDataFromCSVRows(tasksRows)
      if (tasksData.length > 0) {
        charts.push({
          data: tasksData,
          chartTitle: 'Area/Project Tasks completed per week',
          containerId: 'tasks-heatmap-container',
        })
      }
    }

    if (charts.length === 0) {
      logInfo('showProjectsWeeklyProgressHeatmaps', 'No weekly progress data available to visualise')
      await showMessage('No weekly progress data available to visualise', 'OK', 'Weekly Progress Heatmaps')
      return
    }

    const windowTitle = charts.length === 2
      ? 'Projects Weekly Progress'
      : (charts[0].containerId === 'notes-heatmap-container'
        ? 'Projects Weekly Progress - Notes'
        : 'Projects Weekly Progress - Tasks')

    await showProjectsWeeklyProgressHeatmapWindow(charts, windowTitle)
  } catch (error) {
    logError('showProjectsWeeklyProgressHeatmaps', error.message)
    throw error
  }
}
