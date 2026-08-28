// @flow
//-----------------------------------------------------------------------------
// Weekly per-folder area/project progress stats written to CSV in @Reviews
// Writes the weekly progress of projects and areas to a CSV in @Reviews, with a structure:
// - First table: notes-per-week (distinct notes with at least one completed task)
// - Second table: tasks-per-week (total completed tasks)
// Columns: successive week labels (e.g. 2026-W06)
// Rows: folder names in alphabetical order
//
// Last updated 2026-08-28 for v2.1.0 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getReviewSettings, type ReviewConfig } from './reviewHelpers'
import {
  RE_DONE_DATE_OPT_TIME,
  RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE,
  convertISOToYYYYMMDD,
  YYYYMMDDDateStringFromDate,
} from '@helpers/dateTime'
import { getNPWeekData, pad } from '@helpers/NPdateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, overrideSettingsWithEncodedTypedArgs, timer } from '@helpers/dev'
import { createPrettyRunPluginLink, type headingLevelType } from '@helpers/general'
import { getRegularNotesFromFilteredFolders, getFolderFromFilename } from '@helpers/folders'
import { getOpenEditorFromFilename, getOrOpenEditorFromFilename } from '@helpers/NPEditor'
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
 * Parse a setting value that may include markdown heading markers (e.g. "## Weekly Project Progress").
 * @param {string} setting
 * @returns {{ level: headingLevelType, text: string }}
 */
function parseMarkdownHeadingSetting(setting: string): { level: headingLevelType, text: string } {
  const trimmed = setting.trim()
  if (!trimmed) {
    return { level: 2, text: '' }
  }
  const match = trimmed.match(/^(#{1,5})\s+(.*)$/)
  if (match) {
    const level = Math.min(5, Math.max(1, match[1].length))
    return { level: (level: any), text: match[2].trim() }
  }
  return { level: 2, text: trimmed }
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
 * Return project-type tags present on a note (from note.hashtags), in config order.
 * @param {TNote} note
 * @param {Array<string>} projectTypeTags
 * @returns {Array<string>}
 */
function getMatchingProjectTagsOnNote(note: TNote, projectTypeTags: Array<string>): Array<string> {
  const hashtags: $ReadOnlyArray<string> = note.hashtags ?? []
  return projectTypeTags.filter((tag) => {
    const normalisedTag = tag.startsWith('#') ? tag : `#${tag}`
    return hashtags.includes(normalisedTag)
  })
}

/**
 * Return true if the note has at least one completed task in the given week.
 * @param {TNote} note
 * @param {WeekInfo} week
 * @returns {boolean}
 */
function noteProgressedInWeek(note: TNote, week: WeekInfo): boolean {
  for (const p of note.paragraphs) {
    if (!isDone(p)) continue
    const doneISO = getDoneISODateFromContent(p.content)
    if (!doneISO) continue
    if (getWeekLabelForISODate(doneISO, [week]) !== '') {
      return true
    }
  }
  return false
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
 * Aggregate distinct notes progressed in the given week, by folder path and project tag.
 * @param {ReviewConfig} config
 * @param {WeekInfo} week
 * @returns {TWeeklyProgressByFolderAndTag}
 */
function aggregateNotesProgressedByFolderAndTag(config: ReviewConfig, week: WeekInfo): TWeeklyProgressByFolderAndTag {
  let projectTypeTags: Array<string> = config.projectTypeTags ?? []
  if (typeof projectTypeTags === 'string') {
    projectTypeTags = [projectTypeTags]
  }

  const { notes, folders } = getNotesInTargetProjectFolders(config)
  const counts: Map<string, Map<string, Set<string>>> = new Map()
  const notesByTagSets: Map<string, Set<string>> = new Map()
  const notesByFolderAndTagSets: Map<string, Map<string, Set<string>>> = new Map()

  if (projectTypeTags.length === 0) {
    logWarn('aggregateNotesProgressedByFolderAndTag', 'No projectTypeTags configured; weekly table will be empty')
    return {
      weekLabel: week.label,
      folders,
      tags: projectTypeTags,
      counts: new Map(),
      notesByTag: new Map(),
      notesByFolderAndTag: new Map(),
    }
  }

  for (const note of notes) {
    if (!noteProgressedInWeek(note, week)) continue

    const matchingTags = getMatchingProjectTagsOnNote(note, projectTypeTags)
    if (matchingTags.length === 0) continue

    const noteTitle = (note.title ?? '').trim() !== '' ? (note.title ?? '').trim() : note.filename
    const folderPath = getFolderFromFilename(note.filename)
    for (const tag of matchingTags) {
      const folderMap = counts.get(folderPath) ?? new Map()
      const noteSet = folderMap.get(tag) ?? new Set()
      noteSet.add(note.filename)
      folderMap.set(tag, noteSet)
      counts.set(folderPath, folderMap)

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
    weekLabel: week.label,
    folders,
    tags: projectTypeTags,
    counts: countNumbers,
    notesByTag,
    notesByFolderAndTag,
  }
}

/**
 * Upsert a project progress table into a weekly calendar note.
 * @param {ReviewConfig} config
 * @param {?string} weekLabelIn - ISO week label (e.g. 2026-W35); defaults to current week
 * @returns {Promise<void>}
 */
async function writeWeeklyProjectProgressToWeeklyNote(config: ReviewConfig, weekLabelIn: ?string = null): Promise<void> {
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

  const weekLabel = weekLabelIn ?? getCurrentWeekLabel()
  const targetWeek = getWeekInfoFromWeekLabel(weekLabel)

  const { folders: allFolders, tags, counts, notesByTag, notesByFolderAndTag } = aggregateNotesProgressedByFolderAndTag(config, targetWeek)
  const showEmptyFolders = getWeeklyProjectProgressShowEmptyFolders(config)
  const folders = getFoldersForWeeklyProgressTable(allFolders, counts, showEmptyFolders)
  const hiddenFolderCount = allFolders.length - folders.length
  logInfo(
    'writeWeeklyProjectProgressToWeeklyNote',
    `week=${weekLabel}; showEmptyFolders=${String(showEmptyFolders)}; table rows=${String(folders.length)} of ${String(allFolders.length)} folders (${String(hiddenFolderCount)} hidden)`,
  )
  const xCallbackMD = getWeeklyProjectProgressRefreshLinkMD(showEmptyFolders, weekLabel)
  // Show/Hide toggle disabled pending NotePlan fix for markdown links + table body inserts
  // const emptyFoldersToggleMD = getEmptyFoldersToggleLinkMD(showEmptyFolders)
  const sectionHeadingWithLinks = `${headingText} ${xCallbackMD}`
  const { showTable, bulletMode } = resolveWeeklyProjectProgressOutputStyle(config)
  const table = showTable ? buildWeeklyProgressMarkdownTable(folders, tags, counts) : ''
  const tagsSummary = buildWeeklyProgressTagCountSummary(tags, notesByTag)
  const introLine = `${tagsSummary} progressed in ${weekLabel}:`
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

/**
 * Generate weekly Project/Area progress stats per relevant folder for the last N weeks. Returns two arrays of strings:
 * - First array: notes-per-week (distinct notes with at least one completed task)
 * - Second array: tasks-per-week (total completed tasks)
 * @author @jgclark (spec) + @cursor (implementation)
 * @returns {Promise<Array<string>>}
 */
async function generateProjectsWeeklyProgressLines(): Promise<[Array<string>, Array<string>]>
{
  try {
    logDebug(pluginJson, `generateProjectsWeeklyProgressLines: starting`)
    const startTime = new Date()
    const config: ReviewConfig | null = ((await getReviewSettings(): any): ReviewConfig)
    if (!config) {
      throw new Error('generateProjectsWeeklyProgressLines: could not load Review settings. Stopping.')
    }

    // 1. Week range (last 12 weeks, including current)
    const weeks: Array<WeekInfo> = getLastNWeeks(DEFAULT_NUM_WEEKS)
    if (weeks.length === 0) {
      throw new Error('No week range could be calculated')
    }
    const weekLabels: Array<string> = weeks.map((w) => w.label)

    // 2. Get all regular notes from filtered folders (respecting existing Projects exclusions)
    const { notes: notesInTargetFolders, folders } = getNotesInTargetProjectFolders(config)
    logDebug('generateProjectsWeeklyProgressLines', `considering ${String(notesInTargetFolders.length)} regular notes`)
    logInfo('generateProjectsWeeklyProgressLines', `found ${String(folders.length)} Area/Project folders and ${String(notesInTargetFolders.length)} notes in them`)

    if (folders.length === 0) {
      logInfo('generateProjectsWeeklyProgressLines', `no Area/Project folders found: nothing to write`)
      return [[], []]
    }

    // 4. Aggregation structures
    const notesPerWeekMap: Map<string, Set<string>> = new Map() // key: folder::week -> set of note filenames
    const tasksPerWeekMap: Map<string, number> = new Map() // key: folder::week -> task count

    // 5. Scan notes and paragraphs
    for (const note of notesInTargetFolders) {
      const folderPath = getFolderFromFilename(note.filename)
      for (const p of note.paragraphs) {
        if (!isDone(p)) continue
        const doneISO = getDoneISODateFromContent(p.content)
        if (!doneISO) continue

        const weekLabel = getWeekLabelForISODate(doneISO, weeks)
        if (!weekLabel) continue

        const key = makeFolderWeekKey(folderPath, weekLabel)

        // tasks-per-week
        const currentTasks = tasksPerWeekMap.get(key) ?? 0
        tasksPerWeekMap.set(key, currentTasks + 1)

        // notes-per-week (distinct notes)
        const noteSet = notesPerWeekMap.get(key) ?? new Set()
        noteSet.add(note.filename)
        notesPerWeekMap.set(key, noteSet)
      }
    }

    // 6. Build CSV tables
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
        const noteSet = notesPerWeekMap.get(key)
        const noteCount = noteSet ? noteSet.size : 0
        const taskCount = tasksPerWeekMap.get(key) ?? 0
        noteCounts.push(String(noteCount))
        noteCountTotal += noteCount
        taskCounts.push(String(taskCount))
        taskCountTotal += taskCount
      }

      // Note: surround folder name with quotes in case folder name contains commas
      notesRows.push([`"${folderName}"`].concat(noteCounts).concat(String(noteCountTotal)).join(','))
      tasksRows.push([`"${folderName}"`].concat(taskCounts).concat(String(taskCountTotal)).join(','))
    }

    // Add totals row (sum of each column across all folders)
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
    return [notesRows, tasksRows]
  } catch (error) {
    logError('projectsWeeklyProgressCSV', error.message)
    throw error
  }
}

//-----------------------------------------------------------------------------
// Main command

/**
 * Generate weekly Area/Project folder progress stats for the last N weeks and write them as CSV to two fixed notes in the (hidden) plugin data folder.
 * The two notes are:
 * - First note: notes-per-week (distinct notes with at least one completed task)
 * - Second note: tasks-per-week (total completed tasks)
 *
 * @author @jgclark (spec) + @cursor (implementation)
 * @returns {Promise<void>}
 */
export async function writeProjectsWeeklyProgressToCSV(...argsIn: any[]): Promise<void> {
  try {
    const normalisedArgs = normalizeWeeklyProjectProgressArgs(argsIn)
    logDebug(
      pluginJson,
      `writeProjectsWeeklyProgressToCSV: starting with ${String(normalisedArgs.length)} arg(s)${normalisedArgs.length > 0 ? `: [${normalisedArgs.join(', ')}]` : ''}`,
    )

    let config: ReviewConfig | null = ((await getReviewSettings(): any): ReviewConfig)
    if (!config) {
      throw new Error('writeProjectsWeeklyProgressToCSV: could not load Review settings. Stopping.')
    }

    if (normalisedArgs.length > 0) {
      config = await applyWeeklyProjectProgressCommandParamsFromArgs(config, argsIn)
    }
    const weekLabel = resolveWeekLabelFromArgs(argsIn) ?? getCurrentWeekLabel()
    logDebug(
      pluginJson,
      `writeProjectsWeeklyProgressToCSV: using weeklyProjectProgressShowEmptyFolders=${String(getWeeklyProjectProgressShowEmptyFolders(config))}, week=${weekLabel}`,
    )

    const [notesRows, tasksRows] = await generateProjectsWeeklyProgressLines()

    // First prepare and write the notes-per-week CSV
    const notesCsvString = notesRows.join('\n')
    await DataStore.saveData(notesCsvString, PROGRESS_PER_FOLDER_FILENAME, true)

    // Then prepare and write the tasks-per-week CSV
    const tasksCsvString = tasksRows.join('\n')
    await DataStore.saveData(tasksCsvString, TASK_COMPLETION_PER_FOLDER_FILENAME, true)

    await writeWeeklyProjectProgressToWeeklyNote(config, weekLabel)

    logInfo('writeProjectsWeeklyProgressToCSV', `Written weekly progress CSV to '${PROGRESS_PER_FOLDER_FILENAME}' and '${TASK_COMPLETION_PER_FOLDER_FILENAME}'`)
  } catch (error) {
    logError('writeProjectsWeeklyProgressToCSV', error.message)
    throw error
  }
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
 * Generate weekly Area/Project folder progress stats and display them
 * as heatmaps in one HTML window:
 * - Notes progressed per week
 * - Tasks completed per week
 * This reuses the HTML heatmap pattern from the Summaries plugin.
 * @returns {Promise<void>}
 */
export async function showProjectsWeeklyProgressHeatmaps(): Promise<void> {
  try {
    logDebug(pluginJson, `showProjectsWeeklyProgressHeatmaps: starting`)

    const [notesRows, tasksRows] = await generateProjectsWeeklyProgressLines()

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
